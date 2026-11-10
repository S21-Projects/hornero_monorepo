import type { SelectHTMLAttributes } from 'react';
import { ArrowDown2 } from 'iconsax-reactjs';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  /** Renders the text in the muted placeholder colour (e.g. nothing chosen yet). */
  placeholder?: boolean;
}

/**
 * Native <select> (keeps mobile pickers and form semantics) with the native
 * chrome removed and a custom chevron, styled like Input.
 */
export function Select({ label, id, style, placeholder, children, disabled, ...props }: SelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <select
          id={id}
          disabled={disabled}
          {...props}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            fontFamily: 'inherit',
            fontSize: 14.5,
            color: placeholder ? 'var(--ink-3)' : 'var(--ink)',
            background: '#fff',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-input)',
            padding: '12px 40px 12px 14px',
            width: '100%',
            outline: 'none',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            ...style,
          }}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            pointerEvents: 'none',
          }}
        >
          <ArrowDown2 size={16} color="var(--ink-3)" />
        </span>
      </div>
    </div>
  );
}
