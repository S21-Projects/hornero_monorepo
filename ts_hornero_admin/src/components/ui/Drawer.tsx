import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CloseCircle } from 'iconsax-reactjs';
import { Text } from './Typography';

export interface DrawerTab {
  id: string;
  label: string;
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Small uppercase line above the title (e.g. the entity kind). */
  eyebrow?: ReactNode;
  /** Line under the title (e.g. badges or a short status sentence). */
  status?: ReactNode;
  tabs?: DrawerTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  /** Sticky actions area at the bottom of the panel. */
  footer?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Right-side panel with scrim, rendered in a portal. Esc, the scrim and the close
 * button call `onClose`. Focus moves into the panel on open and returns to the
 * previously focused element once it closes. Presentational: callers own `open`.
 */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  status,
  tabs,
  activeTab,
  onTabChange,
  footer,
  children,
}: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const reduceMotion = useReducedMotion();
  const duration = reduceMotion ? 0 : 0.2;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Move focus in on open, give it back on close.
  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      const target = returnFocusTo.current;
      returnFocusTo.current = null;
      if (target && document.contains(target)) target.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented) onCloseRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Keep Tab cycling inside the dialog.
  function trapTab(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900 }}>
          <motion.div
            data-testid="drawer-scrim"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(43,33,27,.32)' }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={trapTab}
            initial={{ x: reduceMotion ? 0 : 40, opacity: reduceMotion ? 1 : 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reduceMotion ? 0 : 40, opacity: reduceMotion ? 1 : 0 }}
            transition={{ duration, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(480px, 100%)',
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
              boxShadow: 'var(--sh-pop)',
              outline: 'none',
            }}
          >
            <div style={{ padding: '20px 24px 0', borderBottom: tabs ? undefined : '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {eyebrow && (
                    <Text
                      variant="caption"
                      color="ink-3"
                      as="div"
                      style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}
                    >
                      {eyebrow}
                    </Text>
                  )}
                  <Text id={titleId} variant="h3" as="h2" style={{ margin: '2px 0 0' }}>
                    {title}
                  </Text>
                  {status && <div style={{ marginTop: 8 }}>{status}</div>}
                </div>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={onClose}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    color: 'var(--ink-3)',
                  }}
                >
                  <CloseCircle size={24} />
                </button>
              </div>
              {tabs && (
                <div
                  role="tablist"
                  style={{ display: 'flex', gap: 4, marginTop: 16, borderBottom: '1px solid var(--line)' }}
                >
                  {tabs.map((t) => {
                    const selected = t.id === activeTab;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onTabChange?.(t.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 'var(--fs-body-sm)',
                          fontWeight: selected ? 800 : 600,
                          color: selected ? 'var(--horn)' : 'var(--ink-3)',
                          padding: '10px 12px',
                          marginBottom: -1,
                          borderBottom: `2px solid ${selected ? 'var(--horn)' : 'transparent'}`,
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{children}</div>

            {footer && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  flexWrap: 'wrap',
                  padding: '16px 24px',
                  borderTop: '1px solid var(--line)',
                  background: '#fff',
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
