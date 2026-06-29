const TINTS = [
  "#C85A20", "#B5781E", "#3E8E5A",
  "#1C6E96", "#9A5B3B", "#7A2A08",
];

interface AvatarProps {
  name?: string;
  size?: number;
  tintIndex?: number;
}

export function Avatar({ name = "", size = 40, tintIndex }: AvatarProps) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const bg =
    tintIndex != null
      ? TINTS[tintIndex % TINTS.length]
      : "var(--horn)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        background: bg,
        color: "#fff",
        fontWeight: 800,
        flexShrink: 0,
        width: size,
        height: size,
        fontSize: size * 0.38,
      }}
    >
      {initials}
    </span>
  );
}
