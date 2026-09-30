/**
 * AD-7 (tesis-core-features slice 3c-i): QR scanning adapter behind a small module boundary so
 * `EscanerQr.tsx` can `import()` it lazily and tests can `vi.mock` it without ever touching a real
 * camera. Uses the native `BarcodeDetector` when the runtime exposes it (most Android browsers);
 * falls back to the `barcode-detector` ponyfill otherwise (needed on iOS Safari, which lacks the
 * native API). `qr-scanner` (nimiq) was the design's first choice but its last release predates
 * this project by roughly four years — per AD-7's named fallback, this adapter uses the
 * `barcode-detector` ponyfill instead, with no change to any component that calls this module.
 */

interface DetectorResultado {
  rawValue: string;
}

interface Detector {
  detect(source: HTMLVideoElement): Promise<DetectorResultado[]>;
}

type BarcodeDetectorCtor = new (opciones: { formats: string[] }) => Detector;

const INTERVALO_MS = 300;

let detectorActivo: Detector | null = null;
let intervaloId: ReturnType<typeof setInterval> | null = null;
let generacionActual = 0;

function obtenerBarcodeDetectorNativo(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const global = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return global.BarcodeDetector ?? null;
}

async function crearDetector(): Promise<Detector> {
  const Nativo = obtenerBarcodeDetectorNativo();
  if (Nativo) {
    return new Nativo({ formats: ['qr_code'] });
  }
  const { BarcodeDetector } = await import('barcode-detector/pure');
  return new (BarcodeDetector as unknown as BarcodeDetectorCtor)({ formats: ['qr_code'] });
}

/**
 * Starts polling `video` for a decodable QR code and invokes `onPayload` with the raw decoded
 * string on every successful read (the caller — `EscanerQr.tsx` — is responsible for interpreting
 * it via `payload.ts`'s `parsePayload`). Safe to call again after `detener()`.
 */
export async function iniciar(
  video: HTMLVideoElement,
  onPayload: (payload: string) => void,
): Promise<void> {
  detener();
  const generacion = ++generacionActual;
  const detector = await crearDetector();
  // A concurrent detener()/iniciar() may have run while awaiting crearDetector(); only the
  // still-current generation may install itself.
  if (generacion !== generacionActual) return;
  detectorActivo = detector;

  intervaloId = setInterval(() => {
    if (generacion !== generacionActual || !detectorActivo) return;
    detectorActivo
      .detect(video)
      .then((resultados) => {
        if (generacion !== generacionActual) return;
        const primero = resultados[0];
        if (primero) onPayload(primero.rawValue);
      })
      .catch(() => {
        // A transient decode failure (e.g. a blurry frame) is not fatal — keep polling.
      });
  }, INTERVALO_MS);
}

/** Stops the polling loop started by `iniciar()`. Idempotent; safe to call when never started. */
export function detener(): void {
  generacionActual += 1;
  detectorActivo = null;
  if (intervaloId !== null) {
    clearInterval(intervaloId);
    intervaloId = null;
  }
}
