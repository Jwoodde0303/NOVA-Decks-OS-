/**
 * Renderer-neutral 2D drawing model. Generators (framing plan, deck plan, elevation, sections)
 * emit primitives in drawing units (points); `DrawingSvg` renders them for the web and
 * `DrawingPdf` renders the same list into the permit planset, so the two can never disagree.
 */

export type Stroke = { color?: string; width?: number; dash?: string };

export type Primitive =
  | ({ kind: "line"; x1: number; y1: number; x2: number; y2: number } & Stroke)
  | ({ kind: "rect"; x: number; y: number; w: number; h: number; fill?: string; hatch?: boolean } & Stroke)
  | ({ kind: "circle"; cx: number; cy: number; r: number; fill?: string } & Stroke)
  | ({ kind: "path"; d: string; fill?: string } & Stroke)
  | { kind: "text"; x: number; y: number; text: string; size?: number; anchor?: "start" | "middle" | "end"; weight?: "normal" | "bold"; color?: string; rotate?: number; mono?: boolean };

export interface Drawing {
  title: string;
  subtitle?: string;
  /** Drawing extents in points (72 per inch of paper at 1:1; the renderers scale to fit). */
  width: number;
  height: number;
  primitives: Primitive[];
  /** Model scale used, for the title block (e.g. '1/4" = 1\'-0"' or "NTS"). */
  scaleLabel: string;
}

export const INK = "#1c1f24";
export const MUTED = "#6b7078";
export const ACCENT = "#c3521f";
export const SLATE = "#2f4858";
export const PAPER = "#ffffff";

export class DrawingBuilder {
  readonly primitives: Primitive[] = [];
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  line(x1: number, y1: number, x2: number, y2: number, s: Stroke = {}) {
    this.primitives.push({ kind: "line", x1, y1, x2, y2, color: INK, width: 0.8, ...s });
    return this;
  }
  rect(x: number, y: number, w: number, h: number, o: Stroke & { fill?: string; hatch?: boolean } = {}) {
    this.primitives.push({ kind: "rect", x, y, w, h, color: INK, width: 0.8, ...o });
    return this;
  }
  circle(cx: number, cy: number, r: number, o: Stroke & { fill?: string } = {}) {
    this.primitives.push({ kind: "circle", cx, cy, r, color: INK, width: 0.8, ...o });
    return this;
  }
  path(d: string, o: Stroke & { fill?: string } = {}) {
    this.primitives.push({ kind: "path", d, color: INK, width: 0.8, ...o });
    return this;
  }
  text(x: number, y: number, text: string, o: Omit<Extract<Primitive, { kind: "text" }>, "kind" | "x" | "y" | "text"> = {}) {
    this.primitives.push({ kind: "text", x, y, text, size: 7, anchor: "start", color: INK, ...o });
    return this;
  }
  /** Horizontal dimension with ticks and a centred label. */
  hdim(x1: number, x2: number, y: number, label: string, o: { color?: string; size?: number; above?: boolean } = {}) {
    if (x2 - x1 < 1) return this;
    const c = o.color ?? MUTED;
    this.line(x1, y, x2, y, { color: c, width: 0.5 });
    this.line(x1, y - 3, x1, y + 3, { color: c, width: 0.5 });
    this.line(x2, y - 3, x2, y + 3, { color: c, width: 0.5 });
    this.text((x1 + x2) / 2, o.above ? y - 2.5 : y + 8, label, { anchor: "middle", size: o.size ?? 6.5, color: c, mono: true });
    return this;
  }
  /** Vertical dimension; label is drawn to the right (rotated when `rotate`). */
  vdim(x: number, y1: number, y2: number, label: string, o: { color?: string; size?: number; left?: boolean } = {}) {
    if (y2 - y1 < 1) return this;
    const c = o.color ?? MUTED;
    this.line(x, y1, x, y2, { color: c, width: 0.5 });
    this.line(x - 3, y1, x + 3, y1, { color: c, width: 0.5 });
    this.line(x - 3, y2, x + 3, y2, { color: c, width: 0.5 });
    this.text(o.left ? x - 4 : x + 4, (y1 + y2) / 2 + 2.3, label, { anchor: o.left ? "end" : "start", size: o.size ?? 6.5, color: c, mono: true });
    return this;
  }
  /** Leader line with a label at the far end. The label is kept inside the drawing box. */
  leader(x1: number, y1: number, x2: number, y2: number, label: string, o: { anchor?: "start" | "end"; size?: number } = {}) {
    const size = o.size ?? 6.5;
    const anchor = o.anchor ?? "start";
    const est = label.length * size * 0.58;
    let lx = x2;
    if (anchor === "start" && lx + est > this.width - 4) lx = Math.max(4 + 2, this.width - 4 - est);
    if (anchor === "end" && lx - est < 4) lx = Math.min(this.width - 4, 4 + est);
    const ly = Math.min(Math.max(y2, 8), this.height - 4);
    this.line(x1, y1, lx, ly, { color: MUTED, width: 0.5 });
    this.circle(x1, y1, 1, { fill: MUTED, color: MUTED });
    this.text(lx + (anchor === "end" ? -2 : 2), ly + 2.3, label, { anchor, size, color: INK });
    return this;
  }
  build(title: string, scaleLabel: string, subtitle?: string): Drawing {
    return { title, subtitle, width: this.width, height: this.height, primitives: this.primitives, scaleLabel };
  }
}

/** Scale helper: inches of deck → drawing points given a target box. */
export function fitScale(realWidthIn: number, realHeightIn: number, boxW: number, boxH: number) {
  return Math.min(boxW / realWidthIn, boxH / realHeightIn);
}

/** Nearest architectural scale label at or below the computed scale (points per inch). */
export function scaleLabelFor(pointsPerInch: number): string {
  // 1/4" = 1'-0" means 0.25 in paper per 12 in real → 18 pt per 12 in → 1.5 pt/in
  const scales: [string, number][] = [
    ['1" = 1\'-0"', 6],
    ['3/4" = 1\'-0"', 4.5],
    ['1/2" = 1\'-0"', 3],
    ['3/8" = 1\'-0"', 2.25],
    ['1/4" = 1\'-0"', 1.5],
    ['3/16" = 1\'-0"', 1.125],
    ['1/8" = 1\'-0"', 0.75],
    ['3/32" = 1\'-0"', 0.5625],
    ['1/16" = 1\'-0"', 0.375],
  ];
  for (const [label, ppi] of scales) if (pointsPerInch >= ppi - 1e-9) return label;
  return "NTS";
}

/** Snap a computed scale down to the nearest architectural scale so the sheet reads true to scale. */
export function snapScale(pointsPerInch: number): number {
  const steps = [6, 4.5, 3, 2.25, 1.5, 1.125, 0.75, 0.5625, 0.375];
  for (const s of steps) if (pointsPerInch >= s) return s;
  return pointsPerInch;
}
