interface AvatarProps {
  name?: string;
  size?: number;
}

/** Initials avatar — the user model has no profile photo, so this is the only avatar we can render. */
export function Avatar({ name = '', size = 40 }: AvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'var(--horn)',
        color: '#fff',
        fontWeight: 800,
        flexShrink: 0,
        width: size,
        height: size,
        fontSize: size * 0.38,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
