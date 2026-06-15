import { Add, Heart, Notification } from "iconsax-reactjs";
import { Button } from "./button";
import { Text } from "./typography";

type EmptyVariant = "no-comedores" | "no-donaciones" | "no-alertas";

interface EmptyStateProps {
  variant: EmptyVariant;
  title?: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const DEFAULTS: Record<EmptyVariant, { title: string; body: string; ctaLabel: string; ctaIcon: React.ReactNode }> = {
  "no-comedores": {
    title: "Todavía no hay comedores acá",
    body: "Aún no encontramos organizaciones en esta zona de Córdoba. ¿Conocés una? Ayudanos a sumarla al mapa.",
    ctaLabel: "Sumar un comedor",
    ctaIcon: <Add size={17} color="#fff" />,
  },
  "no-donaciones": {
    title: "Empezá a ayudar hoy",
    body: "Todavía no hiciste ninguna donación. Explorá las necesidades cerca tuyo y dale una mano a tu barrio.",
    ctaLabel: "Ver necesidades",
    ctaIcon: <Heart size={17} color="#fff" />,
  },
  "no-alertas": {
    title: "Tu nido está tranquilo",
    body: "No tenés alertas nuevas. Cuando un comedor de tus zonas publique una necesidad, te avisamos acá.",
    ctaLabel: "Configurar alertas",
    ctaIcon: <Notification size={17} color="#fff" />,
  },
};

function HorneroIllustration({ variant }: { variant: EmptyVariant }) {
  const base: React.CSSProperties = {
    background: "#F6ECDC",
    backgroundImage: "repeating-linear-gradient(45deg, rgba(200,90,32,.10) 0 9px, transparent 9px 18px)",
    border: "2px dashed rgba(200,90,32,.4)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    textAlign: "center",
    color: "var(--horn)",
  };
  const label = "Ilustración · Hornero";

  if (variant === "no-alertas") {
    return (
      <div
        style={{
          ...base,
          width: 132,
          height: 132 * 0.78,
          borderRadius: "40% 40% 46% 46% / 60% 60% 40% 40%",
        }}
      >
        <span style={{ fontSize: 26 }}>🪺</span>
        <Text
          variant="micro"
          as="span"
          style={{
            fontFamily: '"DM Mono", monospace',
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "#A0673E",
          }}
        >
          {label}
        </Text>
      </div>
    );
  }

  if (variant === "no-donaciones") {
    return (
      <div
        style={{
          ...base,
          width: 132,
          height: 132,
          borderRadius: "50%",
        }}
      >
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="var(--horn)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <Text
          variant="micro"
          as="span"
          style={{
            fontFamily: '"DM Mono", monospace',
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "#A0673E",
          }}
        >
          {label}
        </Text>
      </div>
    );
  }

  return (
    <div style={{ ...base, width: 132, height: 132, borderRadius: 18 }}>
      <svg width={45} height={45} viewBox="0 0 24 24" fill="none" stroke="var(--horn)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 14c0-4 3-7 7-7 2 0 4 1 4 1l3-2-1 3s1 2 1 4c0 4-3 7-7 7" />
        <circle cx="10" cy="11" r="1" fill="var(--horn)" stroke="none" />
        <path d="M5 14c-1 2-2 3-3 3 1 1 3 1 4 0" />
      </svg>
      <Text
        variant="micro"
        as="span"
        style={{
          fontFamily: '"DM Mono", monospace',
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "#A0673E",
        }}
      >
        {label}
      </Text>
    </div>
  );
}

export function EmptyState({
  variant,
  title,
  body,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  const defaults = DEFAULTS[variant];

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
      <div style={{ marginBottom: 18 }}>
        <HorneroIllustration variant={variant} />
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
      <Button
        variant="primary"
        style={{ marginTop: 18, gap: 8 }}
        onClick={onCta}
      >
        {defaults.ctaIcon}
        {ctaLabel ?? defaults.ctaLabel}
      </Button>
    </div>
  );
}
