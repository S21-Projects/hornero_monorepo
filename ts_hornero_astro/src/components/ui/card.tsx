import { type CSSProperties } from "react";

interface CardProps {
  children: React.ReactNode;
  style?: CSSProperties;
  className?: string;
  as?: "div" | "article" | "section";
}

export function Card({ children, style, className, as: Tag = "div" }: CardProps) {
  return (
    <Tag
      className={className}
      style={{
        background: "var(--card)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--sh-1)",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
