import { describe, expect, it } from "vitest";
import { DEFAULT_DECK_DESIGN, DEFAULT_FRAMING_OPTIONS, deckDesignModelSchema, type DeckDesignModel } from "@/modules/design/model";
import { generateFraming, fmtFtIn } from "@/modules/framing/generate";
import { TABLE_2_JOISTS, TABLE_3_BEAMS, TABLE_4_FOOTINGS, TABLE_5_FOOTING_SIZE, TABLE_6_LEDGER_FASTENERS } from "@/modules/framing/rules/fairfax-2021";

const fixture: DeckDesignModel = DEFAULT_DECK_DESIGN; // 20' × 12', 4' high, 6' stair at 4', framing defaults (16" o.c., dropped beam, 1' overhangs)
const withFraming = (patch: Partial<DeckDesignModel["framing"]>, model: DeckDesignModel = fixture): DeckDesignModel => ({ ...model, framing: { ...model.framing, ...patch } });

describe("Fairfax County table transcription spot checks (Version 2021.0)", () => {
  it("Table 2 joist spans and overhangs", () => {
    expect(TABLE_2_JOISTS["2x8"].span).toEqual({ 12: 157, 16: 142, 24: 116 });
    expect(TABLE_2_JOISTS["2x6"].overhang[8]).toBe(17); // 1'-5"
    expect(TABLE_2_JOISTS["2x8"].overhang[12]).toBe(27); // 2'-3"
    expect(TABLE_2_JOISTS["2x8"].overhang[14]).toBeNull();
    expect(TABLE_2_JOISTS["2x12"].overhang[18]).toBe(49); // 4'-1"
  });
  it("Table 3 beams incl. prohibited cells", () => {
    expect(TABLE_3_BEAMS[7]![10]).toEqual([{ plies: 2, size: "2x12" }, { plies: 3, size: "2x10" }]);
    expect(TABLE_3_BEAMS[7]![14]).toBeNull();
    expect(TABLE_3_BEAMS[2]![18]).toEqual([{ plies: 3, size: "2x10" }]);
    expect(TABLE_3_BEAMS[18]![8]).toBeNull();
  });
  it("Table 4/5 footings", () => {
    expect(TABLE_4_FOOTINGS[7]![10]).toEqual({ type: "E", maxPostHeightFt: 14 });
    expect(TABLE_4_FOOTINGS[7]![12]).toEqual({ type: "E", maxPostHeightFt: 13 });
    expect(TABLE_4_FOOTINGS[10]![10]).toEqual({ type: "F", maxPostHeightFt: 11 });
    expect(TABLE_4_FOOTINGS[4]![18]).toBeNull();
    expect(TABLE_5_FOOTING_SIZE.E).toEqual({ squareIn: 20, roundIn: 22, thicknessIn: 8 });
  });
  it("Table 6 ledger fasteners", () => {
    expect(TABLE_6_LEDGER_FASTENERS["lag-screw"].lumber).toEqual([30, 23, 18, 15, 13, 11, 10]);
    expect(TABLE_6_LEDGER_FASTENERS["through-bolt"].lumber![3]).toBe(29);
    expect(TABLE_6_LEDGER_FASTENERS["adhesive-anchor"].masonry).toEqual([32, 32, 32, 24, 24, 16, 16]);
  });
});

describe("framing generator: 20' × 12' × 4' fixture, defaults", () => {
  const f = generateFraming(fixture);

  it("is permitted by the typical details", () => {
    expect(f.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(f.ok).toBe(true);
  });

  it("sizes joists from Table 2: 2x8 @ 16\" with an 11' span and 1' overhang", () => {
    expect(f.joists.size).toBe("2x8");
    expect(f.joists.spanIn).toBe(132);
    expect(f.joists.allowableSpanIn).toBe(142);
    expect(f.joists.overhangIn).toBe(12);
    expect(f.joists.overhangColumnFt).toBe(12);
    expect(f.joists.allowableOverhangIn).toBe(27);
    expect(f.joists.positionsIn).toEqual([0, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240]);
    expect(f.joists.blockingOverBeam).toBe(false);
    expect(f.joists.rimJoist).toEqual({ size: "2x8", lengthIn: 240 });
  });

  it("sizes the beam from Table 3 with influence width 6'-6\" → 7 ft and the fewest posts", () => {
    expect(f.beam.influenceWidthIn).toBe(78);
    expect(f.beam.influenceWidthTableFt).toBe(7);
    // 2 posts → 18' span: prohibited for IW 7. 3 posts → 9' span → 10' column → (2)2x12 / (3)2x10.
    expect(f.posts.count).toBe(3);
    expect(f.beam.spanIn).toBe(108);
    expect(f.beam.spanColumnFt).toBe(10);
    expect(`(${f.beam.plies})${f.beam.size}`).toBe("(2)2x12");
    expect(f.beam.alternatives).toEqual(["(2)2x12", "(3)2x10"]);
    expect(f.posts.positionsIn).toEqual([12, 120, 228]);
    expect(f.beam.centerlineFromHouseIn).toBe(132);
  });

  it("sizes footings from Tables 4/5 and posts from height", () => {
    expect(f.footings.type).toBe("E");
    expect(f.footings).toMatchObject({ squareIn: 20, roundIn: 22, thicknessIn: 8, count: 3, depthBelowGradeIn: 24 });
    // 48 − 1 decking − 7.25 joist − 11.25 beam = 28.5" → 4x4 permitted
    expect(f.posts.heightIn).toBe(28.5);
    expect(f.posts.size).toBe("4x4");
    expect(f.posts.maxHeightIn).toBe(14 * 12);
    expect(f.posts.lateral.required).toBe("none");
  });

  it("sizes the ledger from Table 6: 2x8 with ½\" lags @ 15\" o.c. (12' column, 2x band board)", () => {
    expect(f.ledger.size).toBe("2x8");
    expect(f.ledger.spanColumnFt).toBe(12);
    expect(f.ledger.spacingIn).toBe(15);
    expect(f.ledger.approxFastenerCount).toBe(8 + Math.ceil(216 / 15));
    expect(f.ledger.hangerCount).toBe(16);
  });

  it("requires guards above 30\" and lays out posts at ≤ 6' o.c.", () => {
    expect(f.guards.required).toBe(true);
    expect(f.guards.runs).toHaveLength(4);
    const xsOnOuterEdge = f.guards.posts.filter((p) => p.y === 144).map((p) => p.x).sort((a, b) => a - b);
    expect(xsOnOuterEdge[0]).toBe(0);
    expect(xsOnOuterEdge).toContain(48); // left of stair opening
    expect(xsOnOuterEdge).toContain(120); // right of stair opening
    expect(xsOnOuterEdge.at(-1)).toBe(240);
    for (let i = 1; i < xsOnOuterEdge.length; i++) expect(xsOnOuterEdge[i]! - xsOnOuterEdge[i - 1]!).toBeLessThanOrEqual(72.01);
  });

  it("lays out the stair: 6 risers @ 8\", 5 treads, 50\" run, 5 cut stringers", () => {
    expect(f.stair).toMatchObject({ risers: 6, riserHeightIn: 8, treads: 5, horizontalSpanIn: 50, stringerType: "cut", maxStringerSpanIn: 81, stringerCount: 5, guardRequired: true, handrailRequired: true });
  });

  it("fills the county 'Complete My Deck' worksheet", () => {
    const ws = Object.fromEntries(f.worksheet.map((w) => [w.label, w.value]));
    expect(ws["Joist size / spacing"]).toBe('2x8 @ 16" o.c.');
    expect(ws["Beam plies / size"]).toBe("(2)2x12");
    expect(ws["Footing size / thickness"]).toBe('Type E: 20" square or 22" round, 8" thick');
    expect(ws["Lateral support"]).toBe("None required");
  });
});

describe("framing generator: option handling and limits", () => {
  it("2 ft overhang on 2x8 at a 10' span is allowed, 3 ft is not (Table 2 + L/4)", () => {
    const ok = generateFraming(withFraming({ joistOverhangIn: 24 }));
    expect(ok.joists.size).toBe("2x8");
    expect(ok.joists.spanIn).toBe(120);
    const tooMuch = generateFraming(withFraming({ joistOverhangIn: 36 })); // span 9' → L/4 = 2'-3" for every size
    expect(tooMuch.ok).toBe(false);
    const deeper = generateFraming(withFraming({ joistOverhangIn: 36 }, { ...fixture, depthIn: 16 * 12 })); // span 13': 2x8 too short, 2x10 @ 16" allows 14' and a 3'-4" overhang
    expect(deeper.ok).toBe(true);
    expect(deeper.joists.size).toBe("2x10");
    expect(deeper.joists.spanIn).toBe(156);
    expect(deeper.joists.allowableOverhangIn).toBe(39); // min(40", L/4 = 39")
  });

  it("rejects an overhang beyond every joist size", () => {
    const f = generateFraming(withFraming({ joistOverhangIn: 60 })); // span 7' → L/4 = 1'-9"
    expect(f.ok).toBe(false);
    expect(f.issues.find((i) => i.code === "joist-np")?.message).toMatch(/overhang limited/);
  });

  it("flush beam: no overhang, beam at the edge, hangers both ends, beam depth ≥ joist depth", () => {
    const f = generateFraming(withFraming({ beamType: "flush" }));
    expect(f.joists.overhangIn).toBe(0);
    expect(f.joists.spanIn).toBe(144); // 12' → 2x8 @ 16" (11'-10") fails → 2x10
    expect(f.joists.size).toBe("2x10");
    expect(f.beam.influenceWidthTableFt).toBe(6);
    expect(f.beam.depthIn).toBeGreaterThanOrEqual(f.joists.depthIn);
    expect(f.joists.rimJoist).toBeNull();
    expect(f.materials.find((m) => m.item.startsWith("Joist hangers"))?.qty).toBe(32);
    expect(f.posts.heightIn).toBe(48 - 1 - f.beam.depthIn);
  });

  it("explicit post count: 4 posts shrink the beam and footing", () => {
    const f = generateFraming(withFraming({ postCount: 4 }));
    expect(f.beam.spanIn).toBe(72);
    expect(`(${f.beam.plies})${f.beam.size}`).toBe("(2)2x8");
    expect(f.footings.type).toBe("B");
    expect(f.posts.positionsIn).toEqual([12, 84, 156, 228]);
  });

  it("beam overhang beyond L/4 is an error", () => {
    const f = generateFraming(withFraming({ postCount: 2, beamOverhangIn: 60 })); // span 10' → L/4 = 2'-6"
    expect(f.issues.some((i) => i.code === "beam-overhang")).toBe(true);
  });

  it("tall deck: 6x6 posts, lateral Method 1 by default (≤ 11 ft), both methods above 11 ft", () => {
    const tall = generateFraming({ ...fixture, heightIn: 9 * 12 });
    expect(tall.posts.size).toBe("6x6");
    expect(tall.posts.lateral.required).toBe("either");
    expect(tall.posts.lateral.methods).toEqual(["method-1-tension-ties"]);
    expect(tall.posts.lateral.tensionTieJoistIndexes).toEqual([0, 5, 10, 15]);
    const knee = generateFraming(withFraming({ lateralPreference: "knee-bracing" }, { ...fixture, heightIn: 9 * 12 }));
    expect(knee.posts.lateral.methods).toEqual(["method-2-knee-bracing-at-beam"]);
    const veryTall = generateFraming({ ...fixture, heightIn: 13 * 12 });
    expect(veryTall.posts.lateral.required).toBe("both");
    expect(veryTall.posts.lateral.methods).toHaveLength(2);
  });

  it("post height above 14 ft or a prohibited footing cell is rejected", () => {
    const f = generateFraming({ ...fixture, heightIn: 16 * 12 });
    expect(f.ok).toBe(false);
    expect(f.issues.some((i) => i.code === "post-too-tall" || i.code === "beam-np")).toBe(true);
  });

  it("stairs: 8' rise needs 12 risers and exceeds the 6'-9\" cut-stringer span", () => {
    const f = generateFraming({ ...fixture, heightIn: 96 });
    expect(f.stair.risers).toBe(12);
    expect(f.stair.horizontalSpanIn).toBe(110);
    expect(f.issues.find((i) => i.code === "stringer-span")?.message).toMatch(/intermediate landing/);
    const solid = generateFraming({ ...fixture, heightIn: 96, stair: { widthIn: 36, offsetIn: 48 } });
    expect(solid.stair.stringerType).toBe("solid");
    expect(solid.issues.some((i) => i.code === "stringer-span")).toBe(false);
  });

  it("ledger: EWP band board tightens spacing; anchors on wood are rejected; 2x6 joists force a 2x8 ledger", () => {
    expect(generateFraming(withFraming({ bandBoard: "ewp" })).ledger.spacingIn).toBe(12);
    expect(generateFraming(withFraming({ bandBoard: "solid-masonry", ledgerFastener: "expansion-anchor" })).ledger.spacingIn).toBe(29);
    const bad = generateFraming(withFraming({ ledgerFastener: "expansion-anchor" }));
    expect(bad.issues.some((i) => i.code === "ledger-fastener")).toBe(true);
    const low = generateFraming(withFraming({ joistSize: "2x6", joistSpacingIn: 16 }, { ...fixture, depthIn: 96, heightIn: 24 }));
    expect(low.joists.size).toBe("2x6");
    expect(low.ledger.size).toBe("2x8");
    expect(low.guards.required).toBe(false);
  });

  it("hidden decking fasteners with posts over 2.5 ft require under-joist bracing", () => {
    expect(generateFraming(withFraming({ hiddenDeckingFasteners: true })).underJoistBracingRequired).toBe(false); // posts 28.5"
    expect(generateFraming(withFraming({ hiddenDeckingFasteners: true }, { ...fixture, heightIn: 72 })).underJoistBracingRequired).toBe(true);
  });

  it("older saved designs without framing options parse with defaults", () => {
    const legacy = deckDesignModelSchema.parse({ ...fixture, framing: undefined });
    expect(legacy.framing).toEqual(DEFAULT_FRAMING_OPTIONS);
  });

  it("formats feet and inches", () => {
    expect(fmtFtIn(132)).toBe("11'");
    expect(fmtFtIn(28.5)).toBe("2' 4.5\"");
    expect(fmtFtIn(81)).toBe("6' 9\"");
  });
});
