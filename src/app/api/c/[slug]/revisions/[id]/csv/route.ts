import { apiCompanyContext, errorResponse } from "@/lib/request-context";
import { exportRevisionCsv } from "@/modules/estimating/service";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await apiCompanyContext(slug);
  if (ctx instanceof Response) return ctx;
  try {
    const { csv, filename } = await exportRevisionCsv(ctx, id);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
