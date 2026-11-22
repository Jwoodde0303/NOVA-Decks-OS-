import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { DEFAULT_COMPANY_SETTINGS } from "@/db/schema";
import type { CompanyContext } from "@/modules/core/context";
import { ForbiddenError, ValidationError } from "@/modules/core/errors";
import { DEFAULT_DECK_DESIGN } from "@/modules/design/model";
import { saveDesign } from "@/modules/design/service";
import { generateFraming } from "@/modules/framing/generate";
import { buildEstimate, estimateToCsv } from "@/modules/estimating/engine";
import { getPriceBook, getPricedProduct, setPriceBookItem, setProductPrice } from "@/modules/estimating/pricing";
import { createRevision, exportRevisionCsv, getEstimate, setEstimateStatus } from "@/modules/estimating/service";
import { createProject, getProject, listProjects } from "@/modules/projects/service";
import { closeDb, ctxFor, freshSeededDb, productId } from "./helpers";

let db: Db;
let owner: CompanyContext;
let member: CompanyContext;

beforeAll(async () => {
  db = await freshSeededDb();
  owner = await ctxFor(db, "nova", "owner");
  member = await ctxFor(db, "nova", "member");
});
afterAll(closeDb);

describe("estimating engine (pure)", () => {
  it("prices the 20' × 12' fixture with Trex Transcend Tropicals Spiced Rum 16' grooved", async () => {
    const pid = await productId(db, "SR010616TG01");
    const product = await getPricedProduct(owner, pid);
    expect(product.unitPriceCents).toBe(7900);
    expect(product.installation?.maxStairStringerSpacingIn).toBe(12);
    const model = { ...DEFAULT_DECK_DESIGN, deckingProductId: pid };
    const framing = generateFraming(model, product);
    expect(framing.ok).toBe(true);
    // Trex: 36" stair needs 4 stringers, over 36" needs 5; our 6' stair at 12" o.c. → 7 stringers
    expect(framing.stair.stringerMaxSpacingIn).toBe(12);
    expect(framing.stair.stringerCount).toBe(7);
    const book = await getPriceBook(owner);
    const est = buildEstimate({ model, product, framing, priceBook: book, settings: DEFAULT_COMPANY_SETTINGS });

    // Decking: installed width 5.5 + 3/16 = 5.6875" → 144 / 5.6875 = 25.3 → 26 rows × 2 pieces = 52 boards, +10% waste = 58
    const decking = est.sections.find((s) => s.key === "decking")!;
    expect(decking.lines[0]).toMatchObject({ qty: 58, unitPriceCents: 7900, totalCents: 58 * 7900, priced: true, source: "catalog" });
    // Treads: 5 treads × 2 boards × 6' → 2 pieces per 16' board → 5 boards, +10% → 6
    expect(decking.lines[1]).toMatchObject({ qty: 6, totalCents: 6 * 7900 });
    expect(decking.lines[2]!.key).toBe("fastener.hidden-clip-sqft");
    expect(decking.lines[2]!.qty).toBe(240);

    const framingSec = est.sections.find((s) => s.key === "framing")!;
    const joists = framingSec.lines.find((l) => l.description.includes("joists"))!;
    expect(joists).toMatchObject({ key: "lumber.pt.2x8", qty: 16 * 12, unit: "lf" });
    const hardware = est.sections.find((s) => s.key === "hardware")!;
    expect(hardware.lines.find((l) => l.key === "hardware.joist-hanger")!.qty).toBe(16);
    expect(hardware.lines.find((l) => l.key === "hardware.post-cap")!.qty).toBe(3); // 4x4 posts → caps
    expect(hardware.lines.find((l) => l.key === "hardware.hold-down")!.qty).toBe(9); // guard posts: 3 + 3 sides, 1 + 2 outer edge, corners shared
    const footings = est.sections.find((s) => s.key === "footings")!;
    expect(footings.lines[0]!.qty).toBeGreaterThan(20);
    const labor = est.sections.find((s) => s.key === "labor")!;
    expect(labor.lines.find((l) => l.key === "labor.deck-sqft")!.qty).toBe(240);
    expect(labor.lines.find((l) => l.key === "labor.stair-riser")!.qty).toBe(6);

    expect(est.warnings).toEqual([]);
    expect(est.materialsCents).toBe(est.sections.filter((s) => s.key !== "labor").reduce((a, s) => a + s.subtotalCents, 0));
    expect(est.markupCents).toBe(Math.round((est.materialsCents + est.laborCents) * 0.25));
    expect(est.taxCents).toBe(0);
    expect(est.totalCents).toBe(est.materialsCents + est.laborCents + est.markupCents);

    const csv = estimateToCsv({ title: "T", revisionNumber: 1, build: est });
    expect(csv).toContain("Decking,Trex Transcend Tropicals Spiced Rum");
    expect(csv).toContain(",Total,");
  });

  it("flags unpriced products and missing price-book keys instead of failing", async () => {
    const pid = await productId(db, "AGB15516EW"); // TimberTech Vintage English Walnut: no NOVA price
    const product = await getPricedProduct(owner, pid);
    expect(product.unitPriceCents).toBeNull();
    const model = { ...DEFAULT_DECK_DESIGN, deckingProductId: pid };
    const framing = generateFraming(model, product);
    const book = await getPriceBook(owner);
    book.delete("labor.deck-sqft");
    const est = buildEstimate({ model, product, framing, priceBook: book, settings: DEFAULT_COMPANY_SETTINGS });
    expect(est.warnings.some((w) => w.includes("No company price"))).toBe(true);
    expect(est.warnings.some((w) => w.includes('"labor.deck-sqft"'))).toBe(true);
    expect(est.sections[0]!.lines[0]!.priced).toBe(false);
    expect(est.sections.find((s) => s.key === "labor")!.lines.find((l) => l.key === "labor.deck-sqft")!.priced).toBe(false);
  });

  it("refuses to estimate an invalid design or framing that fails the typical details", async () => {
    const pid = await productId(db, "SR010616TG01");
    const product = await getPricedProduct(owner, pid);
    const bad = { ...DEFAULT_DECK_DESIGN, deckingProductId: pid, stair: { widthIn: 72, offsetIn: 192 } };
    expect(() => buildEstimate({ model: bad, product, framing: generateFraming(bad, product), priceBook: new Map(), settings: DEFAULT_COMPANY_SETTINGS })).toThrow(ValidationError);
    const badFraming = { ...DEFAULT_DECK_DESIGN, deckingProductId: pid, framing: { ...DEFAULT_DECK_DESIGN.framing, joistOverhangIn: 60 } }; // valid design, overhang beyond Table 2
    expect(() => buildEstimate({ model: badFraming, product, framing: generateFraming(badFraming, product), priceBook: new Map(), settings: DEFAULT_COMPANY_SETTINGS })).toThrow(/typical details/);
  });

  it("manufacturer joist spacing limits are enforced in framing (Trex 1x6 at 24\" o.c. is rejected; 2x6 Trex allows 24\")", async () => {
    const trex16 = await getPricedProduct(owner, await productId(db, "SR010616TG01"));
    const bad = generateFraming({ ...DEFAULT_DECK_DESIGN, framing: { ...DEFAULT_DECK_DESIGN.framing, joistSpacingIn: 24 } }, trex16);
    expect(bad.issues.some((i) => i.code === "manufacturer-joist-spacing")).toBe(true);
    const voyage = await getPricedProduct(owner, await productId(db, "DEC-VOYAGE-KHAYA-G5.5-16"));
    const f = generateFraming(DEFAULT_DECK_DESIGN, voyage);
    expect(f.stair.stringerMaxSpacingIn).toBe(9);
    expect(f.stair.stringerCount).toBe(9); // 72/9 + 1
    expect(f.manufacturerRules?.applied.some((a) => a.includes("9\""))).toBe(true);
  });
});

describe("project → design → estimate workflow", () => {
  it("creates numbered projects linked to a CRM job", async () => {
    const p = await createProject(member, { name: "Rear deck", clientName: "Taylor", externalCrm: { provider: "jobtread", externalId: "JT-1", url: "https://app.jobtread.com/jobs/JT-1" } });
    expect(p.projectNumber).toBe("P-1001");
    expect(p.externalCrm).toMatchObject({ provider: "jobtread", externalId: "JT-1" });
    const full = await getProject(member, p.id);
    expect(full.events.map((e) => e.event.kind)).toEqual(["project_created"]);
    expect((await listProjects(owner, { q: "rear" })).map((r) => r.project.id)).toEqual([p.id]);
  });

  it("saves revisions that stay intact when the design, product price or price book changes", async () => {
    const p = await createProject(member, { name: "Revision test" });
    const pid = await productId(db, "LCGV5416P"); // TimberTech Legacy Pecan @ $82
    const design = await saveDesign(member, { projectId: p.id, name: "Main deck", model: { ...DEFAULT_DECK_DESIGN, deckingProductId: pid } });
    const rev1 = await createRevision(member, { designId: design.id });
    expect(rev1.revisionNumber).toBe(1);
    expect(rev1.designVersion).toBe(1);
    expect(rev1.warnings).toEqual([]);
    const deck1 = rev1.sections[0]!.lines[0]!;
    expect(deck1.unitPriceCents).toBe(8200);

    // Change design depth, raise the product price and a labor rate; Team Member cannot change prices.
    await saveDesign(member, { id: design.id, projectId: p.id, name: "Main deck", model: { ...design.model, depthIn: 13 * 12 } });
    await setProductPrice(owner, { catalogProductId: pid, unitPriceCents: 9000, source: "test", effectiveOn: "2026-01-02" });
    await setPriceBookItem(owner, { key: "labor.deck-sqft", category: "labor", description: "x", unit: "sqft", unitPriceCents: 3000, source: "test", effectiveOn: "2026-01-02" });
    await expect(setPriceBookItem(member, { key: "labor.deck-sqft", category: "labor", description: "x", unit: "sqft", unitPriceCents: 1, source: "x", effectiveOn: "2026-01-03" })).rejects.toThrow(ForbiddenError);

    const rev2 = await createRevision(member, { designId: design.id, estimateId: rev1.estimateId });
    expect(rev2.revisionNumber).toBe(2);
    expect(rev2.designVersion).toBe(2);
    expect(rev2.sections[0]!.lines[0]!.unitPriceCents).toBe(9000);
    expect(rev2.sections.find((s) => s.key === "labor")!.lines.find((l) => l.key === "labor.deck-sqft")!.unitPriceCents).toBe(3000);
    expect(rev2.totalCents).toBeGreaterThan(rev1.totalCents);

    const est = await getEstimate(member, rev1.estimateId);
    const stored1 = est.revisions.find((r) => r.revisionNumber === 1)!;
    expect(stored1.totalCents).toBe(rev1.totalCents);
    expect(stored1.sections[0]!.lines[0]!.unitPriceCents).toBe(8200);
    expect(stored1.designSnapshot.depthIn).toBe(144);
    expect(stored1.framingSnapshot.joists.size).toBe("2x8");
    expect(stored1.productSnapshot.sku).toBe("LCGV5416P");

    const { csv, filename } = await exportRevisionCsv(member, stored1.id);
    expect(filename).toMatch(/rev1\.csv$/);
    expect(csv).toContain("TimberTech Legacy Collection Pecan");

    await expect(setEstimateStatus(member, rev1.estimateId, "sent")).rejects.toThrow(ForbiddenError);
    expect((await setEstimateStatus(owner, rev1.estimateId, "sent")).status).toBe("sent");
    const proj = await getProject(member, p.id);
    expect(proj.events.map((e) => e.event.kind)).toEqual(["project_created", "design_saved", "estimate_revision", "design_saved", "estimate_revision", "estimate_status"]);
  });
});
