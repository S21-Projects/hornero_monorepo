import { useEffect, useId, useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import { TickCircle, Warning2 } from 'iconsax-reactjs';
import { Button } from '../ui/button';
import { Text } from '../ui/typography';
import {
  HONEYPOT_FIELD,
  LIMITES,
  validarConsulta,
  type Consulta,
  type ErroresConsulta,
} from '../../lib/contacto';
import {
  TURNSTILE_ACTION,
  TURNSTILE_SITE_KEY,
  TURNSTILE_TOKEN_FIELD,
} from '../../lib/turnstile';

type Estado = 'idle' | 'enviando' | 'ok';

const VACIO: Consulta = { nombre: '', email: '', asunto: '', mensaje: '' };

/** Visual order of the fields — drives which error gets focus after a failed submit. */
const ORDEN_CAMPOS: (keyof Consulta)[] = ['nombre', 'email', 'asunto', 'mensaje'];

const inputBase =
  'w-full rounded-[var(--r-input)] border bg-[var(--card)] px-3.5 py-2.5 text-[15px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-3)] focus:border-[var(--horn)] focus:ring-2 focus:ring-[var(--straw)] disabled:opacity-60';

function claseInput(conError: boolean) {
  return `${inputBase} ${conError ? 'border-[var(--urgent)]' : 'border-[var(--line)]'}`;
}

interface CampoProps {
  id: string;
  etiqueta: string;
  error?: string;
  opcional?: boolean;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

function Campo({ id, etiqueta, error, opcional, children }: CampoProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold text-[var(--ink-2)]">
        {etiqueta}
        {opcional && <span className="ml-1.5 font-semibold text-[var(--ink-3)]">(opcional)</span>}
      </label>
      {children({ id, describedBy: error ? errorId : undefined, invalid: !!error })}
      {error && (
        <span id={errorId} role="alert" className="text-[12.5px] font-bold text-[var(--urgent)]">
          {error}
        </span>
      )}
    </div>
  );
}

export default function ContactForm() {
  const baseId = useId();
  const [valores, setValores] = useState<Consulta>(VACIO);
  const [errores, setErrores] = useState<ErroresConsulta>({});
  const [estado, setEstado] = useState<Estado>('idle');
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');

  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef('');

  // The success panel replaces the form, unmounting the widget container. Keying
  // the effect on this flag re-renders a fresh widget when the visitor comes
  // back via "Enviar otra consulta" — otherwise the container returns empty.
  const mostrandoFormulario = estado !== 'ok';

  // Explicit render. The script is loaded with `?render=explicit`, so Turnstile
  // never auto-scans the DOM — that scan can fire before this island hydrates
  // and would leave the container empty or render it twice.
  useEffect(() => {
    if (!mostrandoFormulario) return;

    let cancelado = false;
    let reintento: number | undefined;

    function montar(): boolean {
      if (cancelado || widgetIdRef.current !== null) return true;
      if (!window.turnstile || !turnstileRef.current) return false;

      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action: TURNSTILE_ACTION,
        callback: (t) => {
          tokenRef.current = t;
        },
        'expired-callback': () => {
          tokenRef.current = '';
        },
        'error-callback': () => {
          tokenRef.current = '';
        },
      });
      return true;
    }

    // The script tag is `async defer`, so it may still be in flight on mount.
    if (!montar()) {
      reintento = window.setInterval(() => {
        if (montar() && reintento) window.clearInterval(reintento);
      }, 150);
    }

    return () => {
      cancelado = true;
      if (reintento) window.clearInterval(reintento);
      if (widgetIdRef.current !== null) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
        tokenRef.current = '';
      }
    };
  }, [mostrandoFormulario]);

  // The banner is rendered conditionally, so it cannot be focused in the same
  // tick it is set — the node does not exist yet. This runs after it mounts.
  useEffect(() => {
    if (errorGeneral) errorGeneralRef.current?.focus();
  }, [errorGeneral]);

  /** Turnstile tokens are single-use: without a reset the next submit fails. */
  function reiniciarTurnstile() {
    tokenRef.current = '';
    if (widgetIdRef.current !== null) window.turnstile?.reset(widgetIdRef.current);
  }

  const errorGeneralRef = useRef<HTMLDivElement>(null);

  /** Single source for field ids so focus lookups cannot drift from the markup. */
  function idDe(campo: keyof Consulta) {
    return `${baseId}-${campo}`;
  }

  function actualizar<K extends keyof Consulta>(campo: K, valor: string) {
    setValores((prev) => ({ ...prev, [campo]: valor }));
    // Clear the field error as soon as the user starts fixing it — re-validating
    // on every keystroke would scold them mid-typing.
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }));
  }

  /**
   * Validate one field once the visitor leaves it, so a typo surfaces next to
   * the input instead of waiting for the submit.
   *
   * Only fields with content are checked: flagging an empty field because
   * someone tabbed past it is noise, and submit catches those anyway.
   */
  function alSalir(campo: keyof Consulta) {
    if (!valores[campo].trim()) return;
    const encontrados = validarConsulta(valores);
    setErrores((prev) => ({ ...prev, [campo]: encontrados[campo] }));
  }

  /**
   * After a rejected submit, move focus to the first field that failed.
   * `role="alert"` announces the message, but without this a keyboard or
   * screen-reader user is left sitting on the button with no way to the problem.
   */
  function enfocarPrimerError(encontrados: ErroresConsulta) {
    const primero = ORDEN_CAMPOS.find((campo) => encontrados[campo]);
    if (primero) {
      document.getElementById(idDe(primero))?.focus();
      return;
    }
    // No field to blame: send focus to the banner instead.
    errorGeneralRef.current?.focus();
  }

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorGeneral(null);

    const encontrados = validarConsulta(valores);
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados);
      enfocarPrimerError(encontrados);
      return;
    }

    setEstado('enviando');
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...valores,
          [HONEYPOT_FIELD]: honeypot,
          [TURNSTILE_TOKEN_FIELD]: tokenRef.current,
        }),
      });

      // The token is burned either way — always hand the visitor a fresh one.
      reiniciarTurnstile();

      if (res.ok) {
        setValores(VACIO);
        setErrores({});
        setEstado('ok');
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.status === 422 && data.errores) {
        const delServidor = data.errores as ErroresConsulta;
        setErrores(delServidor);
        enfocarPrimerError(delServidor);
      } else {
        setErrorGeneral(data.error ?? 'No pudimos enviar tu consulta. Intentá de nuevo.');
      }
      setEstado('idle');
    } catch {
      reiniciarTurnstile();
      setErrorGeneral('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
      setEstado('idle');
    }
  }

  if (estado === 'ok') {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-3 rounded-[var(--r-card)] bg-[var(--ok-bg)] p-7"
      >
        <TickCircle size={32} color="var(--ok)" variant="Bold" />
        <Text variant="h3" style={{ color: 'var(--ok)' }}>
          ¡Recibimos tu consulta!
        </Text>
        <Text variant="body" color="ink-2">
          Te vamos a responder al correo que nos dejaste. Gracias por escribirnos.
        </Text>
        <Button variant="secondary" size="sm" onClick={() => setEstado('idle')}>
          Enviar otra consulta
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-[var(--r-card)] bg-[var(--card)] p-6 shadow-[var(--sh-1)] sm:p-7"
    >
      <Campo id={idDe('nombre')} etiqueta="Tu nombre" error={errores.nombre}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            name="nombre"
            type="text"
            autoComplete="name"
            maxLength={LIMITES.nombre.max}
            placeholder="Cómo te llamás"
            value={valores.nombre}
            disabled={estado === 'enviando'}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onChange={(e) => actualizar('nombre', e.target.value)}
            onBlur={() => alSalir('nombre')}
            className={claseInput(invalid)}
          />
        )}
      </Campo>

      <Campo id={idDe('email')} etiqueta="Tu correo" error={errores.email}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            maxLength={LIMITES.email.max}
            placeholder="nombre@correo.com"
            value={valores.email}
            disabled={estado === 'enviando'}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onChange={(e) => actualizar('email', e.target.value)}
            onBlur={() => alSalir('email')}
            className={claseInput(invalid)}
          />
        )}
      </Campo>

      <Campo id={idDe('asunto')} etiqueta="Asunto" error={errores.asunto} opcional>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            name="asunto"
            type="text"
            maxLength={LIMITES.asunto.max}
            placeholder="Sobre qué querés escribirnos"
            value={valores.asunto}
            disabled={estado === 'enviando'}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onChange={(e) => actualizar('asunto', e.target.value)}
            onBlur={() => alSalir('asunto')}
            className={claseInput(invalid)}
          />
        )}
      </Campo>

      <Campo id={idDe('mensaje')} etiqueta="Tu consulta" error={errores.mensaje}>
        {({ id, describedBy, invalid }) => (
          <div className="flex flex-col gap-1">
            <textarea
              id={id}
              name="mensaje"
              rows={6}
              maxLength={LIMITES.mensaje.max}
              placeholder="Contanos en qué podemos ayudarte"
              value={valores.mensaje}
              disabled={estado === 'enviando'}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={(e) => actualizar('mensaje', e.target.value)}
              onBlur={() => alSalir('mensaje')}
              className={`${claseInput(invalid)} resize-y`}
            />
            <span className="self-end text-[11px] font-bold text-[var(--ink-3)]">
              {valores.mensaje.length} / {LIMITES.mensaje.max}
            </span>
          </div>
        )}
      </Campo>

      {/* Honeypot — hidden from humans, irresistible to bots. Not `display:none`:
          some bots skip those. Kept out of the tab order and the a11y tree. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${baseId}-hp`}>No completar</label>
        <input
          id={`${baseId}-hp`}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {/* Turnstile. Rendered explicitly from the effect above; the data-*
          attributes are kept for Cloudflare's integration analytics. */}
      <div
        ref={turnstileRef}
        className="cf-turnstile"
        data-sitekey={TURNSTILE_SITE_KEY}
        data-action={TURNSTILE_ACTION}
      />

      {errorGeneral && (
        <div
          ref={errorGeneralRef}
          role="alert"
          // -1 keeps it out of the tab order while still allowing the
          // programmatic focus above.
          tabIndex={-1}
          className="flex items-start gap-2.5 rounded-[var(--r-btn)] bg-[var(--bad-bg)] px-3.5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--urgent)]"
        >
          <Warning2 size={18} color="var(--urgent)" variant="Bold" />
          <span className="text-[13px] font-bold text-[var(--urgent)]">{errorGeneral}</span>
        </div>
      )}

      <Button type="submit" block loading={estado === 'enviando'} style={{ marginTop: 4 }}>
        Enviar consulta
      </Button>
    </form>
  );
}
