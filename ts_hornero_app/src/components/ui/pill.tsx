import { type CSSProperties } from "react";

type PillVariant =
  | "open" | "closed" | "cat"
  | "urgent" | "medium" | "normal" | "ok" | "warn" | "bad"
  | "ghost" | "solid"
  | "role-donor" | "role-org" | "role-val" | "role-super";

interface PillProps {
  variant?: PillVariant;
  dot?: boolean;
  children: React.ReactNode;
  style?: CSSProperties;
}

const STYLES: Record<PillVariant, CSSProperties> = {
  open:        { color: "#1C6E96",              background: "var(--sky-bg)" },
  closed:      { color: "var(--gray-tx)",       background: "var(--gray-bg)" },
  cat:         { color: "var(--normal-tx)",     background: "var(--normal-bg)" },
  urgent:      { color: "var(--urgent)",        background: "var(--urgent-bg)" },
  medium:      { color: "var(--medium)",        background: "var(--medium-bg)" },
  normal:      { color: "var(--normal-tx)",     background: "var(--normal-bg)" },
  ok:          { color: "var(--ok)",            background: "var(--ok-bg)" },
  warn:        { color: "var(--warn-tx)",       background: "var(--warn-bg)" },
  bad:         { color: "var(--bad-tx)",        background: "var(--bad-bg)" },
  ghost:       { color: "var(--ink-2)",         background: "transparent", boxShadow: "inset 0 0 0 1.5px var(--line)" },
  solid:       { color: "#fff",                 background: "var(--horn)" },
  "role-donor":{ color: "#1C6E96",              background: "var(--sky-bg)" },
  "role-org":  { color: "var(--horn)",          background: "#F6E0CF" },
  "role-val":  { color: "var(--ok)",            background: "var(--ok-bg)" },
  "role-super":{ color: "var(--earth)",         background: "var(--line)" },
};

export function Pill({ variant = "cat", dot, children, style }: PillProps) {
  const variantStyle = STYLES[variant];
  const dotColor = variant === "solid" ? "#fff" : variantStyle.color;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: "var(--r-pill)",
        fontWeight: 700,
        fontSize: 12.5,
        lineHeight: 1,
        padding: "7px 12px",
        whiteSpace: "nowrap",
        letterSpacing: ".005em",
        ...variantStyle,
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: dotColor as string,
            opacity: 0.9,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
