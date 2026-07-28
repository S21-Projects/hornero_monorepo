import { type CSSProperties, type ElementType, type HTMLAttributes } from "react";

export type TextVariant =
  | "display" | "stat"
  | "h1" | "h2" | "h3"
  | "title"
  | "body" | "body-sm"
  | "label" | "caption" | "micro";

export type TextColor =
  | "earth" | "ink" | "ink-2" | "ink-3"
  | "horn" | "urgent" | "ok" | "medium" | "sky-tx" | "gray-tx";

interface TextProps extends HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  color?: TextColor;
  as?: ElementType;
}

const VARIANT_STYLES: Record<TextVariant, CSSProperties> = {
  display:   { fontSize: "var(--fs-display)",  fontWeight: "var(--fw-black)",  color: "var(--earth)", letterSpacing: "-0.02em", lineHeight: 1 },
  stat:      { fontSize: "var(--fs-stat)",     fontWeight: "var(--fw-black)",  color: "var(--earth)", lineHeight: 1 },
  h1:        { fontSize: "var(--fs-h1)",       fontWeight: "var(--fw-black)",  color: "var(--earth)", letterSpacing: "-0.01em", lineHeight: 1.1 },
  h2:        { fontSize: "var(--fs-h2)",       fontWeight: "var(--fw-black)",  color: "var(--earth)", letterSpacing: "-0.01em", lineHeight: 1.2 },
  h3:        { fontSize: "var(--fs-h3)",       fontWeight: "var(--fw-black)",  color: "var(--earth)", lineHeight: 1.3 },
  title:     { fontSize: "var(--fs-title)",    fontWeight: "var(--fw-bolder)", color: "var(--earth)", lineHeight: 1.3 },
  body:      { fontSize: "var(--fs-body)",     fontWeight: "var(--fw-regular)",color: "var(--ink)",   lineHeight: 1.5 },
  "body-sm": { fontSize: "var(--fs-body-sm)",  fontWeight: "var(--fw-regular)",color: "var(--ink)",   lineHeight: 1.5 },
  label:     { fontSize: "var(--fs-label)",    fontWeight: "var(--fw-bold)",   color: "var(--ink-2)", lineHeight: 1.4 },
  caption:   { fontSize: "var(--fs-caption)",  fontWeight: "var(--fw-bold)",   color: "var(--ink-3)", lineHeight: 1.4 },
  micro:     { fontSize: "var(--fs-micro)",    fontWeight: "var(--fw-bold)",   color: "var(--ink-3)", lineHeight: 1.3 },
};

const COLOR_VARS: Record<TextColor, string> = {
  earth:    "var(--earth)",
  ink:      "var(--ink)",
  "ink-2":  "var(--ink-2)",
  "ink-3":  "var(--ink-3)",
  horn:     "var(--horn)",
  urgent:   "var(--urgent)",
  ok:       "var(--ok)",
  medium:   "var(--medium)",
  "sky-tx": "var(--sky-tx)",
  "gray-tx":"var(--gray-tx)",
};

const DEFAULT_TAG: Record<TextVariant, ElementType> = {
  display:   "p",
  stat:      "p",
  h1:        "h1",
  h2:        "h2",
  h3:        "h3",
  title:     "p",
  body:      "p",
  "body-sm": "p",
  label:     "span",
  caption:   "span",
  micro:     "span",
};

export function Text({ variant = "body", color, as, style, ...props }: TextProps) {
  const Tag = as ?? DEFAULT_TAG[variant];
  return (
    <Tag
      style={{
        ...VARIANT_STYLES[variant],
        ...(color ? { color: COLOR_VARS[color] } : {}),
        ...style,
      }}
      {...props}
    />
  );
}
