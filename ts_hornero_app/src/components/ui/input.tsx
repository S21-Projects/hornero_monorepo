import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeSlash } from "iconsax-reactjs";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  showToggle?: boolean;
}

export function Input({ label, id, style, showToggle, type, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  const isPasswordToggle = showToggle === true && type === "password";

  const inputEl = (
    <input
      id={id}
      {...props}
      type={isPasswordToggle ? (visible ? "text" : "password") : type}
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
        ...(isPasswordToggle ? { paddingRight: 44 } : {}),
        ...style,
      }}
    />
  );

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
      {isPasswordToggle ? (
        <div style={{ position: "relative" }}>
          {inputEl}
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            {visible ? (
              <EyeSlash size={18} color="var(--ink-3)" />
            ) : (
              <Eye size={18} color="var(--ink-3)" />
            )}
          </button>
        </div>
      ) : (
        inputEl
      )}
    </div>
  );
}
