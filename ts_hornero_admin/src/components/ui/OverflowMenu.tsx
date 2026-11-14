import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { More } from 'iconsax-reactjs';

export interface OverflowMenuItem {
  label: string;
  /** Renders the item as a link when set; otherwise `onSelect` runs. */
  to?: string;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
  /** Accessible name of the trigger. Defaults to "Más acciones". */
  label?: string;
}

/**
 * Small "⋯" actions menu: icon trigger + popover with `role="menu"`. Escape and outside clicks
 * close it (Escape returns focus to the trigger); ArrowUp/ArrowDown move between items.
 */
export function OverflowMenu({ items, label = 'Más acciones' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function moveFocus(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const nodes = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (nodes.length === 0) return;
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
    nodes[next].focus();
  }

  function select(item: OverflowMenuItem) {
    setOpen(false);
    // Focus the trigger first so a dialog opened by the item returns focus here on close.
    triggerRef.current?.focus();
    item.onSelect?.();
  }

  return (
    <div ref={rootRef} className="overflow-menu" onKeyDown={open ? moveFocus : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <More size={20} color="currentColor" />
      </button>

      {open && (
        <div id={menuId} role="menu" aria-label={label} className="overflow-menu__panel">
          {items.map((item) => {
            const cls = `overflow-menu__item${item.danger ? ' overflow-menu__item--danger' : ''}`;
            return item.to ? (
              <Link key={item.label} role="menuitem" className={cls} to={item.to} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={cls}
                disabled={item.disabled}
                onClick={() => select(item)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
