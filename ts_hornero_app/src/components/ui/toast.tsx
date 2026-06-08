interface ToastProps {
  icon?: React.ReactNode;
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}

export function Toast({ icon, title, body, action }: ToastProps) {
  return (
    <div
      style={{
        background: "#fff",
        borderLeft: "4px solid var(--horn)",
        borderRadius: 12,
        boxShadow: "var(--sh-pop)",
        padding: "14px 16px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      {icon && (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#F6E0CF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: 14,
            color: "var(--earth)",
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--ink-2)",
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          {body}
        </p>
        {action && <div style={{ marginTop: 6 }}>{action}</div>}
      </div>
    </div>
  );
}
