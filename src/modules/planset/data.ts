import type { DeckDesignModel } from "@/modules/design/model";
import { analyzeDeck } from "@/modules/design/model";
import { fmtFtIn, generateFraming, type FramingResult } from "@/modules/framing/generate";
import { CONNECTION_RULES, FOOTING_RULES, GUARD_RULES, LEDGER_RULES, STAIR_RULES, TENSION_TIES } from "@/modules/framing/rules/fairfax-2021";
import { allDrawings, type DrawingInputs } from "@/modules/drawing/deck-drawings";
import type { Drawing } from "@/modules/drawing/model";
import type { PricedProduct } from "@/modules/estimating/takeoff";
import { ValidationError } from "@/modules/core/errors";

/** Everything the planset PDF needs, computed purely so it can be tested without a database. */
export interface PlansetData {
  company: { name: string };
  project: { projectNumber: string; name: string; clientName: string | null; siteAddress: string; jurisdiction: string };
  designVersion: number;
  dateLabel: string;
  generatedLabel: string;
  framing: FramingResult;
  drawings: ReturnType<typeof allDrawings>;
  sheets: { no: string; title: string; scale: string }[];
  summary: { footprint: string; height: string; stairRun: string; lines: string[] };
  deckingSchedule: (string | number)[][];
  notes: { title: string; items: string[] }[];
}

export interface PlansetInputs {
  company: { name: string };
  project: PlansetData["project"];
  designName: string;
  designVersion: number;
  model: DeckDesignModel;
  product: PricedProduct | null;
  drawBox: { w: number; h: number };
  now?: Date;
}

export function buildPlansetData(i: PlansetInputs): PlansetData {
  const analysis = analyzeDeck(i.model, i.product);
  const framing = generateFraming(i.model, i.product);
  if (!analysis.valid) throw new ValidationError("Design has validation errors; fix them before generating a planset.", analysis.issues.map((x) => x.message));
  if (!framing.ok) throw new ValidationError("Framing is not permitted by the typical details; fix the blocking issues before generating a planset.", framing.issues.filter((x) => x.severity === "error").map((x) => x.message));
  const inputs: DrawingInputs = { model: i.model, analysis, framing, product: i.product ? { manufacturer: i.product.manufacturer, productLine: i.product.productLine, color: i.product.color, name: i.product.name, effectiveWidthIn: i.product.effectiveWidthIn, widthActualIn: i.product.widthActualIn } : null };
  const drawings = allDrawings(inputs, i.drawBox);
  const now = i.now ?? new Date();
  const dateLabel = now.toISOString().slice(0, 10);
  const sheets = [
    { no: "G-001", title: "Cover sheet & index", scale: "NTS" },
    { no: "G-002", title: "Site plan (attach plat)", scale: "NTS" },
    { no: "A-101", title: "Deck plan", scale: drawings.deckPlan.scaleLabel },
    { no: "S-101", title: "Framing plan", scale: drawings.framingPlan.scaleLabel },
    { no: "S-201", title: "Front elevation", scale: drawings.elevation.scaleLabel },
    { no: "S-301", title: "Section A-A", scale: drawings.section.scaleLabel },
    { no: "S-302", title: "Stair section", scale: drawings.stairSection.scaleLabel },
    { no: "S-401", title: "Schedules & worksheet", scale: "NTS" },
    { no: "G-003", title: "General notes", scale: "NTS" },
  ];
  const p = i.product;
  const summaryLines = [
    `Decking: ${p ? `${p.manufacturer} ${p.name} (${p.sku}), boards parallel to the house at ${p.effectiveWidthIn}" installed width` : "per schedule"}`,
    `Joists ${framing.joists.size} @ ${framing.joists.spacingIn}" o.c., span ${fmtFtIn(framing.joists.spanIn)}, overhang ${fmtFtIn(framing.joists.overhangIn)}; ledger ${framing.ledger.size} with ${framing.ledger.fastenerLabel}${framing.ledger.spacingIn ? ` @ ${framing.ledger.spacingIn}" o.c.` : ""}`,
    `Beam (${framing.beam.plies})${framing.beam.size} ${framing.beam.type}, span ${fmtFtIn(framing.beam.spanIn)} on ${framing.posts.count} ${framing.posts.size} posts, type ${framing.footings.type ?? "?"} footings (${framing.footings.roundIn}" rd / ${framing.footings.squareIn}" sq x ${framing.footings.thicknessIn}") ${framing.footings.depthBelowGradeIn}" min below grade`,
    `Lateral support: ${framing.posts.lateral.description}`,
    `Guards: ${framing.guards.required ? `required, 36" min, ${framing.guards.posts.length} 4x4 posts` : "not required (deck <= 30\" above grade)"}; stair ${fmtFtIn(i.model.stair.widthIn)} wide, ${framing.stair.risers} risers @ ${framing.stair.riserHeightIn.toFixed(2)}", ${framing.stair.stringerCount} 2x12 stringers @ ${framing.stair.stringerSpacingIn.toFixed(1)}" o.c.`,
    ...(framing.manufacturerRules ? [`Manufacturer installation rules applied (${framing.manufacturerRules.manufacturer} ${framing.manufacturerRules.productLine ?? ""}): ${framing.manufacturerRules.applied.join(" ")}`] : []),
  ];
  const deckingSchedule: (string | number)[][] = p
    ? [
        ["Product", `${p.manufacturer} ${p.productLine} ${p.color ?? ""}`.trim()],
        ["SKU / profile", `${p.sku} - ${p.profile}${p.widthActualIn ? `, ${p.widthActualIn}" x ${p.thicknessIn}"` : ""}`],
        ["Installed width / gap", `${p.effectiveWidthIn}" (side gap ${p.installation?.sideGapIn ?? "-"}")`],
        ["Max joist spacing", p.installation ? `${p.installation.maxJoistSpacingPerpendicularIn}" perpendicular, ${p.installation.maxJoistSpacingDiagonalIn}" diagonal` : "-"],
        ["Stair stringers", p.installation ? `${p.installation.maxStairStringerSpacingIn}" o.c. max${p.installation.minStringersAt36In ? `, min ${p.installation.minStringersAt36In} at 36"` : ""}` : "-"],
        ["Fastening", p.installation?.fastening ?? "-"],
        ["Hidden fasteners", p.installation?.hiddenFastenerSystems.join("; ") || "-"],
        ["Board count (no waste)", analysis.decking ? `${analysis.decking.totalPieces} x ${analysis.decking.stockLengthIn / 12} ft` : "-"],
        ["Source", p.installation?.source.title ?? "-"],
      ]
    : [["Product", "Not selected"]];

  const notes: PlansetData["notes"] = [
    {
      title: "General",
      items: [
        `All work per ${framing.ruleset.title} Version ${framing.ruleset.version} and the ${framing.ruleset.basis}; the county document with Section 10 completed shall be on site at every inspection.`,
        `Design loads: ${framing.ruleset.designLoads}.`,
        "Single-level deck only; sharing posts or footings with another level is prohibited. Not approved for hot tubs, privacy screens, planters, built-in seating or surface-mounted guard posts.",
        "Deviation from the typical details requires county approval prior to construction. Verify existing conditions; if the house band board cannot support the deck or is a prohibited condition (open-web trusses, brick/stone veneer, chimney, bay window), a free-standing deck or engineered design is required.",
      ],
    },
    {
      title: "Materials",
      items: [
        `${framing.ruleset.lumber}. Lumber in contact with the ground shall be ground-contact rated (UC4A if buried).`,
        `Concrete 3,000 PSI minimum. Nails threaded/ring-shank; 1/8" pilot holes at toe-nails. Fasteners hot-dipped galvanized or stainless; hardware ${CONNECTION_RULES.hardwareCoating}.`,
        "Ledger flashing copper (copper nails only), stainless, UV-resistant plastic or G-185 galvanized.",
      ],
    },
    {
      title: "Joists & beam",
      items: [
        `Joists ${framing.joists.size} @ ${framing.joists.spacingIn}" o.c.; span ${fmtFtIn(framing.joists.spanIn)} (allowable ${fmtFtIn(framing.joists.allowableSpanIn)}); overhang ${fmtFtIn(framing.joists.overhangIn)} (Table 2, max 1/4 span).`,
        `Joist hangers at ledger${framing.beam.type === "flush" ? " and flush beam" : ""} with depth >= 60% of joist depth, manufacturer screws into the ledger/beam. ${CONNECTION_RULES.joistToBeam.charAt(0).toUpperCase() + CONNECTION_RULES.joistToBeam.slice(1)}.`,
        `Rim joist attached with ${CONNECTION_RULES.rimToJoist}. Blocking >= 60% joist depth between overhanging joists over the beam when overhang exceeds 2 ft.`,
        `Beam (${framing.beam.plies})${framing.beam.size}; plies fastened with ${CONNECTION_RULES.beamPlyFastening}. Splices only at interior posts. Beam overhang past post <= 1/4 beam span.`,
      ],
    },
    {
      title: "Posts & footings",
      items: [
        `Posts ${framing.posts.size}; ${framing.posts.size === "4x4" ? "4x4 permitted because post height <= 2.5 ft; post cap connection only" : CONNECTION_RULES.beamToPost6x6}. Cut ends field-treated with copper naphthenate.`,
        `Footings type ${framing.footings.type ?? "?"}: ${framing.footings.squareIn}" square or ${framing.footings.roundIn}" round, ${framing.footings.thicknessIn}" thick (Tables 4-5), bearing on solid ground ${FOOTING_RULES.minDepthBelowGradeIn}" minimum below grade (deeper if solid ground is not found); bearing verified by the inspector before concrete.`,
        `Post anchors with ${FOOTING_RULES.postBaseMinIn}" minimum base; posts centred on footings. Footings within 5 ft of the house wall shall bear at the house footing elevation. Call Miss Utility (811) before digging.`,
      ],
    },
    {
      title: "Ledger",
      items: [
        `Ledger ${framing.ledger.size} (depth >= joist depth, never less than 2x8), top flush with top of joists. Siding removed; continuous flashing.`,
        `Fasteners: ${framing.ledger.fastenerLabel}${framing.ledger.spacingIn ? ` @ ${framing.ledger.spacingIn}" o.c.` : ""}, 2 rows staggered, ${LEDGER_RULES.fastenersEachEnd} fasteners at each end, 2" minimum end clearance (Table 6, Figure 26). Lead anchors prohibited.`,
        "Lag screws: 1/2\" hole in ledger, 5/16\" pilot in band, washer, hand-tightened; through-bolts with washers at head and nut, re-tightened 6-12 months after construction.",
      ],
    },
    {
      title: "Lateral support",
      items: [
        framing.posts.lateral.description,
        ...(framing.posts.lateral.methods.includes("method-1-tension-ties") ? [`Tension ties: ${TENSION_TIES.approved.join(", ")} (${TENSION_TIES.minCapacityLb} lb min), one at each end joist and two equally spaced inside joists; fasteners ${TENSION_TIES.minPenetrationIn}" into sill or top plate (Figures 28-29).`] : []),
      ],
    },
    {
      title: "Guards",
      items: [
        framing.guards.required ? `Guard required (deck > ${GUARD_RULES.requiredAboveGradeIn}" above grade): ${GUARD_RULES.minHeightIn}" minimum height; 4x4 posts at <= 6 ft o.c. attached with ${GUARD_RULES.postBolts} and ${GUARD_RULES.holdDownMinLb} lb hold-down anchors to the end/rim joist with blocking; ${GUARD_RULES.balusters}; openings reject a ${GUARD_RULES.maxOpeningSphereIn}" sphere; cap ${GUARD_RULES.cap}. Notching guard posts is prohibited.` : `Guard not required (deck <= ${GUARD_RULES.requiredAboveGradeIn}" above grade); any guard provided shall comply with Section 8.`,
      ],
    },
    {
      title: "Stairs",
      items: [
        `Stair ${fmtFtIn(i.model.stair.widthIn)} wide (36" min); ${framing.stair.risers} risers @ ${framing.stair.riserHeightIn.toFixed(2)}" (max ${STAIR_RULES.maxRiserIn}"), ${framing.stair.treads} treads @ ${framing.stair.treadRunIn}" run (min ${STAIR_RULES.minTreadIn}"), nosing 3/4"-1-1/4"; variation <= 3/8".`,
        `Stringers ${STAIR_RULES.stringer}, ${framing.stair.stringerCount} @ ${framing.stair.stringerSpacingIn.toFixed(1)}" o.c. (max ${framing.stair.stringerMaxSpacingIn}"); throat ${STAIR_RULES.minThroatIn}" minimum; horizontal span ${fmtFtIn(framing.stair.horizontalSpanIn)} (max ${fmtFtIn(framing.stair.maxStringerSpanIn)}). ${STAIR_RULES.footing}; ${STAIR_RULES.upperBearing}.`,
        `${framing.stair.guardRequired ? "Stair guard 34\"-38\" above nosings, triangular opening rejects a 6\" sphere. " : ""}${framing.stair.handrailRequired ? "Handrail on one side 34\"-38\" above nosings, graspable, continuous, returned at ends. " : ""}Each stairway section lit by an interior-switched or automatic light.`,
      ],
    },
    {
      title: "Decking (manufacturer)",
      items: p?.installation
        ? [
            `${p.manufacturer} ${p.productLine}: joists ${p.installation.maxJoistSpacingPerpendicularIn}" o.c. max (${p.installation.maxJoistSpacingDiagonalIn}" diagonal); side gap ${p.installation.sideGapIn}"; end gap ${p.installation.endGap}.`,
            `${p.installation.fastening}.`,
            ...p.installation.notes,
            `Source: ${p.installation.source.title}.`,
          ]
        : ["Install decking per the manufacturer's current installation instructions; composite/PVC joist spacing per manufacturer (Table 1)."],
    },
    {
      title: "Other",
      items: ["One electrical receptacle along the deck perimeter within 6.5 ft of the floor. Safety glazing per Figure 4 where windows are adjacent to the deck or stairs.", "Hidden decking fasteners with any post over 2.5 ft require 2x6 under-joist bracing (Figures 2-3)."],
    },
  ];

  return {
    company: i.company,
    project: i.project,
    designVersion: i.designVersion,
    dateLabel,
    generatedLabel: `Generated ${dateLabel} from design "${i.designName}" v${i.designVersion}`,
    framing,
    drawings,
    sheets,
    summary: { footprint: `${fmtFtIn(i.model.widthIn)} x ${fmtFtIn(i.model.depthIn)}`, height: fmtFtIn(i.model.heightIn), stairRun: fmtFtIn(framing.stair.horizontalSpanIn), lines: summaryLines },
    deckingSchedule,
    notes,
  };
}

export type { Drawing };
