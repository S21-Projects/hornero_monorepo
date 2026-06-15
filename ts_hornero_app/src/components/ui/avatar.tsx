'use client';

import { useState } from 'react';

const TINTS = [
  "#C85A20", "#B5781E", "#3E8E5A",
  "#1C6E96", "#9A5B3B", "#7A2A08",
];

interface AvatarProps {
  name?: string;
  size?: number;
  tintIndex?: number;
  src?: string;
}

export function Avatar({ name = "", size = 40, tintIndex, src }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

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

  if (src && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || "Avatar"}
        onError={() => setImgFailed(true)}
        style={{
          display: "inline-block",
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          width: size,
          height: size,
        }}
      />
    );
  }

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
