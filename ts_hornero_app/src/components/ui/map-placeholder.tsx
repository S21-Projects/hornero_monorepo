import { type CSSProperties } from "react";

interface MapPin {
  x: string;
  y: string;
  active?: boolean;
  count?: number;
}

type MarkerVariant = "pin" | "dot" | "spoon";

interface MapPlaceholderProps {
  pins?: MapPin[];
  style?: CSSProperties;
  markerVariant?: MarkerVariant;
}

function MapMarker({ x, y, active, count, variant = "pin" }: MapPin & { variant?: MarkerVariant }) {
  const color = active ? "var(--sky)" : "var(--horn)";

  if (variant === "dot") {
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: "translate(-50%,-50%)",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: color,
            boxShadow: "0 0 0 4px #fff, 0 3px 8px rgba(0,0,0,.2)",
          }}
        />
      </div>
    );
  }

  if (variant === "spoon") {
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: "translate(-50%,-100%)",
          filter: "drop-shadow(0 4px 6px rgba(0,0,0,.25))",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50% 50% 50% 6px",
            background: color,
            transform: "rotate(45deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: "rotate(-45deg)" }}
          >
            <path d="M12 13c2.5 0 4-2 4-4.5S14.5 4 12 4 8 6 8 8.5 9.5 13 12 13zM12 13v7" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%,-100%)",
        filter: "drop-shadow(0 4px 6px rgba(0,0,0,.28))",
      }}
    >
      <svg width="34" height="44" viewBox="0 0 34 44">
        <path
          d="M17 0C8 0 1 7 1 16c0 11 16 28 16 28s16-17 16-28C33 7 26 0 17 0z"
          fill={color}
        />
        <circle cx="17" cy="16" r="6.5" fill="#fff" />
      </svg>
      {count != null && (
        <div
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            minWidth: 20,
            height: 20,
            padding: "0 5px",
            borderRadius: 10,
            background: "var(--earth)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #fff",
          }}
        >
          {count}
        </div>
      )}
    </div>
  );
}

export function MapPlaceholder({
  pins = [],
  style,
  markerVariant = "pin",
}: MapPlaceholderProps) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#EDE7DC",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(122,42,8,.035) 0 14px, transparent 14px 28px)",
        }}
      />
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        preserveAspectRatio="none"
      >
        <g stroke="#fff" strokeWidth="9" fill="none" opacity="0.9">
          <path d="M-20 120 L520 60" />
          <path d="M-20 320 L640 280" />
          <path d="M120 -20 L240 700" />
          <path d="M420 -20 L520 700" />
          <path d="M-20 520 L700 440" />
        </g>
        <g stroke="#E4DCCE" strokeWidth="2" fill="none">
          <path d="M-20 120 L520 60" />
          <path d="M-20 320 L640 280" />
          <path d="M120 -20 L240 700" />
          <path d="M420 -20 L520 700" />
          <path d="M-20 520 L700 440" />
        </g>
        <path
          d="M-20 220 C 180 260, 280 120, 700 200"
          stroke="#BFE0EE"
          strokeWidth="16"
          fill="none"
          opacity="0.7"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 16,
          bottom: 16,
          fontFamily: '"DM Mono", monospace',
          fontSize: 11,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "#9B8E7E",
          background: "rgba(255,255,255,.85)",
          padding: "6px 10px",
          borderRadius: 8,
        }}
      >
        ⬡ Mapa interactivo · componente
      </div>
      {pins.map((pin, i) => (
        <MapMarker key={i} {...pin} variant={markerVariant} />
      ))}
    </div>
  );
}
