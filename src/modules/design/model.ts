import { z } from "zod";

/**
 * The single deck design model. Every output (plan view, 3D preview, board takeoff,
 * open perimeter, CSV) is derived from this object via `analyzeDeck`, so they cannot disagree.
 *
 * Geometry convention (plan view, looking down):
 *   - The house runs along the top edge (y = 0). The deck extends away from the house by `depthIn`.
 *   - x runs left → right along the house from 0 to `widthIn`.
 *   - The single straight stair sits on the outer edge (y = depthIn), opposite the house.
 *   - `stairOffsetIn` is measured from the LEFT outer corner to the left side of the stair opening.
 */
export const deckDesignModelSchema = z.object({
  schemaVersion: z.literal(1),
  widthIn: z.number().int().positive(),
  depthIn: z.number().int().positive(),
  heightIn: z.number().int().nonnegative(),
  stair: z.object({
    widthIn: z.number().int().positive(),
    offsetIn: z.number().int().nonnegative(),
  }),
  /** Boards run parallel to the house (along x). Other directions are future work. */
  boardDirection: z.literal("parallel_to_house"),
  deckingProductId: z.string().uuid().nullable(),
});

export type DeckDesignModel = z.infer<typeof deckDesignModelSchema>;

/** What the takeoff needs to know about a decking product. Catalog-neutral. */
export interface DeckingProductSpec {
  id: string;
  name: string;
  sku: string;
  manufacturer: string;
  stockLengthIn: number;
  effectiveWidthIn: number;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export const DESIGN_LIMITS = {
  minWidthIn: 48,
  maxWidthIn: 12 * 60,
  minDepthIn: 48,
  maxDepthIn: 12 * 40,
  maxHeightIn: 12 * 12,
  minStairWidthIn: 36,
} as const;

export function validateDeckDesign(model: DeckDesignModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const L = DESIGN_LIMITS;
  if (model.widthIn < L.minWidthIn || model.widthIn > L.maxWidthIn)
    issues.push({ field: "widthIn", message: `Deck width must be between ${L.minWidthIn / 12} ft and ${L.maxWidthIn / 12} ft.` });
  if (model.depthIn < L.minDepthIn || model.depthIn > L.maxDepthIn)
    issues.push({ field: "depthIn", message: `Deck depth must be between ${L.minDepthIn / 12} ft and ${L.maxDepthIn / 12} ft.` });
  if (model.heightIn > L.maxHeightIn)
    issues.push({ field: "heightIn", message: `Deck height must be ${L.maxHeightIn / 12} ft or less.` });
  if (model.stair.widthIn < L.minStairWidthIn)
    issues.push({ field: "stair.widthIn", message: `Stair width must be at least ${L.minStairWidthIn} in.` });
  if (model.stair.offsetIn + model.stair.widthIn > model.widthIn) {
    const over = model.stair.offsetIn + model.stair.widthIn - model.widthIn;
    issues.push({
      field: "stair.offsetIn",
      message: `Stair opening extends ${formatIn(over)} past the right corner. Reduce the offset or stair width, or widen the deck.`,
    });
  }
  return issues;
}

function formatIn(totalInches: number) {
  const ft = Math.floor(totalInches / 12);
  const inch = totalInches % 12;
  return inch === 0 ? `${ft} ft` : ft === 0 ? `${inch} in` : `${ft} ft ${inch} in`;
}

/** Schematic stair sizing only. Real riser/tread/stringer design is a later milestone. */
export const STAIR_SCHEMATIC = { maxRiserIn: 7.75, treadRunIn: 11 } as const;

export interface DeckAnalysis {
  valid: boolean;
  issues: ValidationIssue[];
  /** Outer edge segments remaining on each side of the stair opening, in inches. */
  outerEdge: { leftSegmentIn: number; stairOpeningIn: number; rightSegmentIn: number };
  /** Total open perimeter requiring guard/edge treatment: both sides + outer edge, excluding house edge and stair opening. */
  openPerimeterIn: number;
  stairSchematic: { risers: number; treads: number; totalRunIn: number; riserHeightIn: number };
  decking: {
    rows: number;
    piecesPerRow: number;
    totalPieces: number;
    rowLengthIn: number;
    stockLengthIn: number;
    effectiveWidthIn: number;
  } | null;
}

/**
 * Decking takeoff for this fixture: boards run parallel to the house, so every row spans the
 * full deck width. Rows = depth / effective width (rounded up). Each row uses the number of
 * stock pieces needed to cover its length (rounded up). No waste factor, no cut reuse.
 */
export function analyzeDeck(model: DeckDesignModel, product: DeckingProductSpec | null): DeckAnalysis {
  const issues = validateDeckDesign(model);
  const stairOpeningIn = Math.min(model.stair.widthIn, Math.max(0, model.widthIn - model.stair.offsetIn));
  const leftSegmentIn = Math.min(model.stair.offsetIn, model.widthIn);
  const rightSegmentIn = Math.max(0, model.widthIn - model.stair.offsetIn - model.stair.widthIn);
  const openPerimeterIn = model.depthIn * 2 + leftSegmentIn + rightSegmentIn;

  const risers = Math.max(1, Math.ceil(model.heightIn / STAIR_SCHEMATIC.maxRiserIn));
  const treads = Math.max(0, risers - 1);

  const decking = product
    ? (() => {
        const rows = Math.ceil(model.depthIn / product.effectiveWidthIn);
        const piecesPerRow = Math.ceil(model.widthIn / product.stockLengthIn);
        return {
          rows,
          piecesPerRow,
          totalPieces: rows * piecesPerRow,
          rowLengthIn: model.widthIn,
          stockLengthIn: product.stockLengthIn,
          effectiveWidthIn: product.effectiveWidthIn,
        };
      })()
    : null;

  return {
    valid: issues.length === 0,
    issues,
    outerEdge: { leftSegmentIn, stairOpeningIn, rightSegmentIn },
    openPerimeterIn,
    stairSchematic: {
      risers,
      treads,
      totalRunIn: treads * STAIR_SCHEMATIC.treadRunIn,
      riserHeightIn: model.heightIn / risers,
    },
    decking,
  };
}

export const DEFAULT_DECK_DESIGN: DeckDesignModel = {
  schemaVersion: 1,
  widthIn: 20 * 12,
  depthIn: 12 * 12,
  heightIn: 4 * 12,
  stair: { widthIn: 6 * 12, offsetIn: 4 * 12 },
  boardDirection: "parallel_to_house",
  deckingProductId: null,
};
