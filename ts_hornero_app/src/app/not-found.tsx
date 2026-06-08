import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
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
      <div
        style={{
          fontSize: 80,
          fontWeight: 900,
          color: "var(--horn)",
          lineHeight: 1,
          marginTop: 32,
        }}
      >
        404
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>
        Esta página no existe
      </h1>
      <p
        style={{
          color: "var(--ink-2)",
          fontSize: 15,
          fontWeight: 600,
          lineHeight: 1.6,
          maxWidth: 360,
          marginTop: 8,
        }}
      >
        Puede que el enlace esté roto o la página ya no esté disponible.
      </p>
      <Link href="/" style={{ marginTop: 24, textDecoration: "none" }}>
        <Button variant="primary" style={{ gap: 8 }}>
          <ArrowLeft size={17} color="#fff" />
          Volver al inicio
        </Button>
      </Link>
    </div>
  );
}
