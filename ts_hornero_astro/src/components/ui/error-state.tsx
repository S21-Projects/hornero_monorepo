// "use client" removed — Astro handles hydration via island directives, not React file-level directives.
import { Warning2, Refresh2 } from "iconsax-reactjs";
import { Button } from "./button";
import { Text } from "./typography";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Algo salió mal",
  message = "Ocurrió un error inesperado. Intentá de nuevo en unos momentos.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 36px",
        gap: 6,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: "var(--urgent-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <Warning2 size={40} color="var(--urgent)" variant="Bold" />
      </div>
      <Text variant="h2">{title}</Text>
      <Text
        variant="body-sm"
        color="ink-2"
        style={{ maxWidth: 320, marginTop: 4 }}
      >
        {message}
      </Text>
      {onRetry && (
        <Button
          variant="secondary"
          style={{ marginTop: 18, gap: 8 }}
          onClick={onRetry}
        >
          <Refresh2 size={17} color="var(--earth)" />
          Intentar de nuevo
        </Button>
      )}
    </div>
  );
}
