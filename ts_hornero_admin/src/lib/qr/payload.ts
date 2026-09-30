const PREFIJO = 'HORNERO-ENTREGA';
const CODIGO_REGEX = /^\d{6}$/;
const PAYLOAD_REGEX = new RegExp(`^${PREFIJO}:(\\d+):(\\d{6})$`);

/**
 * AD-6 (tesis-core-features slice 3c-i, spec `donacion-entrega-codigo`): the QR still encodes the
 * same plain 6-digit OTP the typed fallback accepts — never an independent token — but wrapped
 * with the target `donacionId` so a scan can be rejected as "wrong donation" before it spends a
 * verification attempt against the backend.
 */
export function formatPayload(donacionId: number, codigo: string): string {
  return `${PREFIJO}:${donacionId}:${codigo}`;
}

/**
 * Accepts either the wrapped `HORNERO-ENTREGA:{donacionId}:{codigo}` form (only when its
 * `donacionId` matches `donacionIdEsperado`) or the bare 6-digit form the typed input also
 * produces. Returns `null` for anything else, including a payload for a different donación.
 */
export function parsePayload(payload: string, donacionIdEsperado: number): string | null {
  const wrapped = PAYLOAD_REGEX.exec(payload);
  if (wrapped) {
    const [, donacionId, codigo] = wrapped;
    return Number(donacionId) === donacionIdEsperado ? codigo : null;
  }
  return CODIGO_REGEX.test(payload) ? payload : null;
}
