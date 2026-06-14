import Link from 'next/link';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 34 }: LogoProps) {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          background: "var(--horn)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 0 #A8481699",
        }}
      >
        <svg
          width={size * 0.6}
          height={size * 0.6}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 14c0-4 3-7 7-7 2 0 4 1 4 1l3-2-1 3s1 2 1 4c0 4-3 7-7 7" />
          <circle cx="10" cy="11" r="0.9" fill="#fff" stroke="none" />
          <path d="M5 14c-1 2-2 3-3 3 1 1 3 1 4 0" />
        </svg>
      </div>
      <div style={{ lineHeight: 1 }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: size * 0.5,
            color: "var(--earth)",
            letterSpacing: "-0.02em",
          }}
        >
          El Hornero
        </div>
        <div
          style={{
            fontSize: size * 0.27,
            color: "var(--ink-3)",
            fontWeight: 700,
            letterSpacing: ".04em",
            marginTop: 2,
          }}
        >
          Comedores · Córdoba
        </div>
      </div>
    </Link>
  );
}
