import { apiCompanyContext, errorResponse } from "@/lib/request-context";
import { generatePlanset } from "@/modules/planset/service";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await apiCompanyContext(slug);
  if (ctx instanceof Response) return ctx;
  try {
    const { buffer, filename } = await generatePlanset(ctx, id);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
