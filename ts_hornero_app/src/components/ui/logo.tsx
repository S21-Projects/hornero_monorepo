import Link from 'next/link';

interface LogoProps {
  height?: number;
  /** @deprecated use height */
  size?: number;
}

export function Logo({ height, size, }: LogoProps) {
  const h = height ?? size ?? 44;
  return (
    <Link href="/" style={{ display: 'inline-flex', textDecoration: 'none' }}>
      <img
        src="/logo_filled.svg"
        alt="El Hornero — Comedores Córdoba"
        height={h}
        style={{ display: 'block', width: '250px' }} // TODO: PONER ACA UNO PARA VERSION MOBILE
      />
    </Link>
  );
}
