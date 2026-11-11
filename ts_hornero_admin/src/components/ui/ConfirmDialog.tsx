import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Warning2 } from 'iconsax-reactjs';
import { Button } from './Button';
import { Text } from './Typography';

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  /** Label of the safe action. Defaults to "Volver". */
  cancelLabel?: string;
  /** `danger` (default) for destructive actions, `primary` otherwise. */
  tone?: 'danger' | 'primary';
  /** Locks the dialog (no Escape / scrim dismissal) and shows a spinner on confirm. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

/**
 * Modal alertdialog for confirming a destructive (or otherwise consequential) action.
 * Focus starts on the safe (cancel) button, Escape and the scrim cancel unless `loading`,
 * Tab stays inside, and focus returns to the opener on close. Presentational: callers own `open`.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Volver',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const loadingRef = useRef(loading);

  useEffect(() => {
    onCancelRef.current = onCancel;
    loadingRef.current = loading;
  }, [onCancel, loading]);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented && !loadingRef.current) onCancelRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const target = returnFocusTo.current;
      returnFocusTo.current = null;
      if (target && document.contains(target)) target.focus();
    };
  }, [open]);

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

  if (!open) return null;

  return createPortal(
    <div className="confirm-dialog">
      <div
        className="confirm-dialog__scrim"
        data-testid="confirm-dialog-scrim"
        onClick={() => {
          if (!loading) onCancel();
        }}
      />
      <div
        ref={panelRef}
        className="confirm-dialog__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={trapTab}
      >
        {tone === 'danger' && (
          <div className="confirm-dialog__icon" aria-hidden="true">
            <Warning2 size={24} variant="Bold" />
          </div>
        )}
        <Text id={titleId} variant="h3" as="h2" className="confirm-dialog__title">
          {title}
        </Text>
        {description && (
          <Text id={descId} variant="body-sm" color="ink-2" as="div" className="confirm-dialog__body">
            {description}
          </Text>
        )}
        <div className="confirm-dialog__actions">
          <Button data-autofocus type="button" variant="secondary" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
