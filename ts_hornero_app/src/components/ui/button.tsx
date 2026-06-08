import { type ButtonHTMLAttributes, type CSSProperties } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "sky";
type ButtonSize = "default" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary:   { background: "var(--horn)",   color: "#fff",            boxShadow: "0 2px 0 #A8481699" },
  secondary: { background: "#fff",          color: "var(--earth)",    boxShadow: "inset 0 0 0 1.6px var(--line)" },
  ghost:     { background: "transparent",   color: "var(--ink-2)" },
  sky:       { background: "var(--sky)",    color: "#fff" },
};

const SIZE_STYLES: Record<ButtonSize, CSSProperties> = {
  default: { padding: "13px 20px", fontSize: 15, borderRadius: "var(--r-btn)" },
  sm:      { padding: "9px 14px",  fontSize: 13.5, borderRadius: 10 },
};

export function Button({
  variant = "primary",
  size = "default",
  block,
  style,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontWeight: 800,
        lineHeight: 1,
        transition: "filter .15s, background .15s",
        width: block ? "100%" : undefined,
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
