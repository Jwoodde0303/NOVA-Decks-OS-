/**
 * Manufacturer decking catalog model.
 *
 * Catalog rows are shared across companies and carry no pricing. Each row carries the
 * manufacturer's installation requirements so the framing generator can honour them
 * (joist spacing, stair-stringer spacing, gapping, overhang, fastening).
 *
 * All values are transcribed from the manufacturers' current published product guides and
 * installation instructions (see `source` on each line). Rows are stored with `verified: false`
 * until someone checks them against the manufacturer's data sheet before ordering.
 */

export type DeckingProfile = "square-edge" | "grooved" | "tongue-and-groove";
export type DeckingMaterial = "capped-wood-composite" | "capped-pvc" | "mineral-composite" | "wood" | "fictional";

export interface InstallationRules {
  /** Maximum joist spacing, inches o.c., decking perpendicular to joists (residential). */
  maxJoistSpacingPerpendicularIn: number;
  /** Maximum joist spacing for diagonal (45°) layouts. */
  maxJoistSpacingDiagonalIn: number;
  /** Maximum joist spacing for commercial applications (informational). */
  maxJoistSpacingCommercialIn: number;
  /** Maximum stair-stringer spacing, inches o.c., when the decking is used as a tread. */
  maxStairStringerSpacingIn: number;
  /** Minimum stringers for a 36" stair, if the manufacturer states one. */
  minStringersAt36In?: number;
  /** Minimum stringers for stairs wider than 36", if stated. */
  minStringersOver36In?: number;
  /** Side-to-side gap between boards (used for the installed/effective width). */
  sideGapIn: number;
  /** End-to-end gap guidance (text, temperature dependent). */
  endGap: string;
  /** Maximum board overhang past the rim/fascia (perpendicular to the board). */
  maxBoardOverhangIn: number | null;
  /** Maximum stair-tread overhang past the stringer/riser. */
  maxTreadOverhangIn: number | null;
  /** Solid blocking rows between joists, if required (inches o.c. max), else null. */
  blockingRowsMaxIn: number | null;
  /** Boards must bear on at least this many joists (if stated). */
  minJoistsSpanned?: number;
  /** Manufacturer-approved hidden fastener systems for this product. */
  hiddenFastenerSystems: string[];
  /** Face/top-down fastening guidance. */
  fastening: string;
  /** Extra manufacturer notes relevant to framing or stairs. */
  notes: string[];
  /** The document the rules came from. */
  source: { title: string; url: string; retrieved: string };
}

export interface CatalogColor {
  name: string;
  /** Approximate sRGB hex for previews; not a manufacturer colour specification. */
  hex: string;
  /** Manufacturer colour code used in SKUs (Trex) or model numbers (TimberTech). */
  code?: string;
}

export interface BoardFormat {
  profile: DeckingProfile;
  thicknessIn: number;
  widthActualIn: number;
  nominal: string; // e.g. "1x6"
  lengthsFt: number[];
  /** Build the manufacturer SKU / model number for a colour + length; omit for synthesized SKUs. */
  sku?: (color: CatalogColor, lengthFt: number) => string;
  /** Overrides for lengths available only in some colours. */
  lengthsByColor?: Record<string, number[]>;
  /** Restrict this format to some colours (by name). */
  colors?: string[];
  note?: string;
}

export interface ProductLineSpec {
  manufacturer: string;
  line: string;
  /** Marketing family, e.g. "Advanced PVC" or "Composite". */
  family?: string;
  material: DeckingMaterial;
  colors: CatalogColor[];
  formats: BoardFormat[];
  installation: InstallationRules;
  warranty?: string;
  attributes?: Record<string, unknown>;
  /** Catalog document the SKUs/dimensions came from. */
  catalogSource: { title: string; url: string; retrieved: string };
}

export interface CatalogProductRow {
  category: "decking";
  manufacturer: string;
  productLine: string;
  name: string;
  sku: string;
  color: string;
  colorHex: string;
  profile: DeckingProfile;
  material: DeckingMaterial;
  thicknessIn: number;
  widthActualIn: number;
  stockLengthIn: number;
  effectiveWidthIn: number;
  installation: InstallationRules;
  attributes: Record<string, unknown>;
  dataSource: string;
  dataEffectiveOn: string;
  verified: boolean;
}

/** Expand a product line spec into one catalog row per colour × format × length. */
export function expandLine(spec: ProductLineSpec): CatalogProductRow[] {
  const rows: CatalogProductRow[] = [];
  for (const f of spec.formats) {
    const colors = f.colors ? spec.colors.filter((c) => f.colors!.includes(c.name)) : spec.colors;
    for (const c of colors) {
      const lengths = f.lengthsByColor?.[c.name] ?? f.lengthsFt;
      for (const L of lengths) {
        const sku = f.sku ? f.sku(c, L) : synthesizedSku(spec, c, f, L);
        rows.push({
          category: "decking",
          manufacturer: spec.manufacturer,
          productLine: spec.line,
          name: `${spec.line} ${c.name} ${f.nominal} ${profileLabel(f.profile)} ${L}'`,
          sku,
          color: c.name,
          colorHex: c.hex,
          profile: f.profile,
          material: spec.material,
          thicknessIn: f.thicknessIn,
          widthActualIn: f.widthActualIn,
          stockLengthIn: L * 12,
          effectiveWidthIn: round3(f.widthActualIn + spec.installation.sideGapIn),
          installation: spec.installation,
          attributes: { family: spec.family ?? null, warranty: spec.warranty ?? null, formatNote: f.note ?? null, ...(spec.attributes ?? {}) },
          dataSource: `${spec.catalogSource.title} (${spec.catalogSource.url})`,
          dataEffectiveOn: spec.catalogSource.retrieved,
          verified: false,
        });
      }
    }
  }
  return rows;
}

export function profileLabel(p: DeckingProfile) {
  return p === "grooved" ? "grooved" : p === "tongue-and-groove" ? "T&G" : "square-edge";
}

function synthesizedSku(spec: ProductLineSpec, c: CatalogColor, f: BoardFormat, L: number) {
  const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 6);
  return `${slug(spec.manufacturer).slice(0, 3)}-${slug(spec.line)}-${slug(c.name)}-${f.profile === "grooved" ? "G" : f.profile === "tongue-and-groove" ? "TG" : "S"}${f.widthActualIn}-${L}`;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
