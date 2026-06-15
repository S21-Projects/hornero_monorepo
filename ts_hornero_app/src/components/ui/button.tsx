import { type ButtonHTMLAttributes, type CSSProperties } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "sky" | "danger" | "ok";
type ButtonSize = "default" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary:   { background: "var(--horn)",    color: "#fff",         boxShadow: "0 2px 0 #A8481699" },
  secondary: { background: "#fff",           color: "var(--earth)", boxShadow: "inset 0 0 0 1.6px var(--line)" },
  ghost:     { background: "transparent",    color: "var(--ink-2)" },
  sky:       { background: "var(--sky)",     color: "#fff" },
  danger:    { background: "var(--urgent)",  color: "#fff",         boxShadow: "0 2px 0 #9B2A1F99" },
  ok:        { background: "var(--ok)",     color: "#fff",         boxShadow: "0 2px 0 #2E6E4499" },
};

const SIZE_STYLES: Record<ButtonSize, CSSProperties> = {
  default: { padding: "13px 20px", fontSize: "var(--fs-body)",    borderRadius: "var(--r-btn)" },
  sm:      { padding: "9px 14px",  fontSize: "var(--fs-body-sm)", borderRadius: 10 },
};

export function Button({
  variant = "primary",
  size = "default",
  block,
  style,
  className,
  children,
  loading,
  disabled,
  ...props
}: ButtonProps) {
  const classes = ["inline-flex", block ? "w-full" : "", className].filter(Boolean).join(" ");

  return (
    <button
      {...props}
      disabled={loading || !!disabled}
      className={classes}
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontWeight: "var(--fw-bolder)" as CSSProperties["fontWeight"],
        lineHeight: 1,
        transition: "filter .15s, background .15s",
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
    >
      {loading ? (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
          <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="0.75s" repeatCount="indefinite" />
          </path>
        </svg>
      ) : (
        children
      )}
    </button>
  );
}
