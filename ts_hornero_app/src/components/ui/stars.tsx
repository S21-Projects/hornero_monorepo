interface StarsProps {
  value?: number;
  size?: number;
  showNum?: boolean;
}

export function Stars({ value = 0, size = 15, showNum = true }: StarsProps) {
  const full = Math.round(value);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ display: "inline-flex", gap: 1.5 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <svg
            key={i}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={i < full ? "var(--sun)" : "none"}
            stroke="var(--sun)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          >
            <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z" />
          </svg>
        ))}
      </span>
      {showNum && (
        <span
          style={{
            fontSize: size - 2,
            fontWeight: 800,
            color: "#A6810D",
            marginLeft: 2,
          }}
        >
          {value.toFixed(1)}
        </span>
      )}
    </span>
  );
}
