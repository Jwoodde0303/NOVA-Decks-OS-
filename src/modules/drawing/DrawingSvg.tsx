import type { Drawing, Primitive } from "./model";

/** Web renderer for the neutral drawing model. */
export function DrawingSvg({ drawing, className = "h-auto w-full" }: { drawing: Drawing; className?: string }) {
  return (
    <svg viewBox={`0 0 ${drawing.width} ${drawing.height}`} className={className} role="img" aria-label={drawing.title}>
      <defs>
        <pattern id="dw-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#2f4858" strokeWidth="0.9" />
        </pattern>
      </defs>
      {drawing.primitives.map((p, i) => (
        <Prim key={i} p={p} />
      ))}
    </svg>
  );
}

function Prim({ p }: { p: Primitive }) {
  switch (p.kind) {
    case "line":
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={p.width} strokeDasharray={p.dash} />;
    case "rect":
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.hatch ? "url(#dw-hatch)" : (p.fill ?? "none")} stroke={p.color} strokeWidth={p.width} strokeDasharray={p.dash} />;
    case "circle":
      return <circle cx={p.cx} cy={p.cy} r={p.r} fill={p.fill ?? "none"} stroke={p.color} strokeWidth={p.width} strokeDasharray={p.dash} />;
    case "path":
      return <path d={p.d} fill={p.fill ?? "none"} stroke={p.color} strokeWidth={p.width} strokeDasharray={p.dash} />;
    case "text":
      return (
        <text x={p.x} y={p.y} fontSize={p.size} textAnchor={p.anchor} fontWeight={p.weight} fill={p.color} fontFamily={p.mono ? "var(--font-mono)" : "var(--font-sans)"} transform={p.rotate ? `rotate(${p.rotate} ${p.x} ${p.y})` : undefined}>
          {p.text}
        </text>
      );
  }
}
