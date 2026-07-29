import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown2 } from 'iconsax-reactjs';
import { Skeleton } from './Skeleton';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
}

/**
 * Custom animated select. Replaces the native <select> (inconsistent
 * cross-browser chrome, no room for a loading state) with a Motion-animated
 * panel and an iconsax chevron that rotates with open state.
 */
export function Dropdown({
  value,
  options,
  onChange,
  disabled,
  loading,
  placeholder = 'Seleccionar…',
  style,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const isDisabled = disabled || loading;

  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth: 220, ...style }}>
      <button
        type="button"
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 'var(--r-input)',
          border: `1px solid ${open ? 'var(--horn)' : 'var(--line)'}`,
          background: '#fff',
          fontSize: 'var(--fs-body-sm)',
          fontFamily: 'inherit',
          color: 'var(--ink)',
          cursor: isDisabled ? 'default' : 'pointer',
          opacity: isDisabled ? 0.6 : 1,
          transition: 'border-color .15s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loading ? 'Cargando…' : (selected?.label ?? placeholder)}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          style={{ display: 'flex', flexShrink: 0 }}
        >
          <ArrowDown2 size={16} color="var(--ink-3)" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 20,
              background: '#fff',
              borderRadius: 'var(--r-input)',
              border: '1px solid var(--line)',
              boxShadow: 'var(--sh-pop)',
              padding: 6,
              maxHeight: 260,
              overflowY: 'auto',
              transformOrigin: 'top',
            }}
          >
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
                <Skeleton height={28} />
                <Skeleton height={28} />
                <Skeleton height={28} />
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: option.value === value ? 'var(--straw)' : 'transparent',
                    color: 'var(--ink)',
                    fontSize: 'var(--fs-body-sm)',
                    fontFamily: 'inherit',
                    fontWeight: option.value === value ? 700 : 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (option.value !== value) e.currentTarget.style.background = 'var(--card-2)';
                  }}
                  onMouseLeave={(e) => {
                    if (option.value !== value) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {option.label}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
