import { type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, style, ...props }: InputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-2)" }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        {...props}
        style={{
          fontFamily: "inherit",
          fontSize: 14.5,
          color: "var(--ink)",
          background: "#fff",
          border: "1.5px solid var(--line)",
          borderRadius: "var(--r-input)",
          padding: "12px 14px",
          width: "100%",
          outline: "none",
          ...style,
        }}
      />
    </div>
  );
}
