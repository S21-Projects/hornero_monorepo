import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  showToggle?: boolean;
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink-3)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink-3)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function Input({ label, id, style, showToggle, type, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  const isPasswordToggle = showToggle === true && type === 'password';

  const inputEl = (
    <input
      id={id}
      {...props}
      type={isPasswordToggle ? (visible ? 'text' : 'password') : type}
      style={{
        fontFamily: 'inherit',
        fontSize: 14.5,
        color: 'var(--ink)',
        background: '#fff',
        border: '1.5px solid var(--line)',
        borderRadius: 'var(--r-input)',
        padding: '12px 14px',
        width: '100%',
        outline: 'none',
        ...(isPasswordToggle ? { paddingRight: 44 } : {}),
        ...style,
      }}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)' }}
        >
          {label}
        </label>
      )}
      {isPasswordToggle ? (
        <div style={{ position: 'relative' }}>
          {inputEl}
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      ) : (
        inputEl
      )}
    </div>
  );
}
