import { Link } from 'react-router-dom';

interface LogoProps {
  height?: number;
  /** @deprecated use height */
  size?: number;
}

export function Logo({ height, size }: LogoProps) {
  const h = height ?? size ?? 44;
  return (
    <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none' }}>
      {/* full wordmark — hidden on mobile */}
      <img
        src="/logo_filled.svg"
        alt="El Hornero — Comedores Córdoba"
        height={h}
        className="hidden sm:block"
        style={{ width: '250px' }}
      />
      {/* icon mark — visible on mobile only */}
      <img
        src="/icon.svg"
        alt="El Hornero"
        height={h}
        className="block sm:hidden"
        style={{ width: '70px' }}
      />
    </Link>
  );
}
