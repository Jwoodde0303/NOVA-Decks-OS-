import { renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { companies } from "@/db/schema";
import type { CompanyContext } from "@/modules/core/context";
import { getDesign } from "@/modules/design/service";
import { getPricedProduct } from "@/modules/estimating/pricing";
import { getProject, logProjectEvent } from "@/modules/projects/service";
import { buildPlansetData } from "./data";
import { PlansetDocument, PLANSET_DRAW_BOX } from "./pdf";

/** Render the permit planset PDF for a saved design. Pure data build + react-pdf render. */
export async function generatePlanset(ctx: CompanyContext, designId: string) {
  ctx.require("estimate.export");
  const design = await getDesign(ctx, designId);
  const project = await getProject(ctx, design.projectId);
  const [co] = await ctx.db.select({ name: companies.name }).from(companies).where(eq(companies.id, ctx.companyId));
  const product = design.model.deckingProductId ? await getPricedProduct(ctx, design.model.deckingProductId) : null;
  const data = buildPlansetData({
    company: { name: co!.name },
    project: {
      projectNumber: project.projectNumber,
      name: project.name,
      clientName: project.clientName,
      siteAddress: [project.siteLine1, project.siteLine2, [project.siteCity, project.siteRegion].filter(Boolean).join(", "), project.sitePostalCode].filter(Boolean).join(", "),
      jurisdiction: project.jurisdiction,
    },
    designName: design.name,
    designVersion: design.version,
    model: design.model,
    product,
    drawBox: PLANSET_DRAW_BOX,
  });
  const buffer = await renderToBuffer(PlansetDocument({ data }));
  await logProjectEvent(ctx.db, ctx, project.id, "planset_generated", `Permit planset generated from design "${design.name}" v${design.version} (${data.sheets.length} sheets)`, { designId: design.id, version: design.version });
  const filename = `${project.projectNumber}-${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-permit-set-v${design.version}.pdf`;
  return { buffer, filename, sheets: data.sheets };
}
