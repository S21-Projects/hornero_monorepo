import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ArrowLeft } from "iconsax-reactjs";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 24px",
        background: "var(--adobe)",
        gap: 8,
      }}
    >
      <Logo size={40} />
      <Text variant="display" color="horn" style={{ marginTop: 32 }}>
        404
      </Text>
      <Text variant="h2" as="h1" style={{ marginTop: 8 }}>
        Esta página no existe
      </Text>
      <Text
        variant="body"
        color="ink-2"
        style={{ maxWidth: 360, marginTop: 8 }}
      >
        Puede que el enlace esté roto o la página ya no esté disponible.
      </Text>
      <Link href="/" style={{ marginTop: 24, textDecoration: "none" }}>
        <Button variant="primary" style={{ gap: 8 }}>
          <ArrowLeft size={17} color="#fff" />
          Volver al inicio
        </Button>
      </Link>
    </div>
  );
}
