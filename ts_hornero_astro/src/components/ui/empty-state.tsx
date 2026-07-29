import { Buildings2, Heart, Notification, ClipboardText, type Icon } from "iconsax-reactjs";
import { Button } from "./button";
import { Text } from "./typography";

type EmptyVariant = "no-comedores" | "no-donaciones" | "no-alertas" | "no-necesidades";

interface EmptyStateProps {
  variant: EmptyVariant;
  title?: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const DEFAULTS: Record<EmptyVariant, { title: string; body: string; icon: Icon }> = {
  "no-comedores": {
    title: "Todavía no hay comedores acá",
    body: "Aún no encontramos organizaciones en esta zona de Córdoba. ¿Conocés una? Ayudanos a sumarla al mapa.",
    icon: Buildings2,
  },
  "no-donaciones": {
    title: "Empezá a ayudar hoy",
    body: "Todavía no hiciste ninguna donación. Explorá las necesidades cerca tuyo y dale una mano a tu barrio.",
    icon: Heart,
  },
  "no-alertas": {
    title: "Tu nido está tranquilo",
    body: "No tenés alertas nuevas. Cuando un comedor de tus zonas publique una necesidad, te avisamos acá.",
    icon: Notification,
  },
  "no-necesidades": {
    title: "Todavía no publicaste necesidades",
    body: "Cuando tu organización necesite algo, publicalo acá y los donantes podrán ayudarte.",
    icon: ClipboardText,
  },
};

export function EmptyState({
  variant,
  title,
  body,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  const defaults = DEFAULTS[variant];
  const StateIcon = defaults.icon;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px 36px",
        gap: 6,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#F6ECDC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <StateIcon size={26} color="var(--horn)" variant="Bulk" />
      </div>
      <Text variant="h2">
        {title ?? defaults.title}
      </Text>
      <Text
        variant="body-sm"
        color="ink-2"
        style={{ maxWidth: 300, marginTop: 4 }}
      >
        {body ?? defaults.body}
      </Text>
      {ctaLabel && (
        <Button
          variant="primary"
          style={{ marginTop: 16, gap: 8 }}
          onClick={onCta}
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
