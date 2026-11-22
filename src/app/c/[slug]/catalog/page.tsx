import { requireCompanyContext } from "@/lib/request-context";
import { listCatalogLines } from "@/modules/catalog/service";
import { Card, Chip, PageHeader } from "@/components/ui";

export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireCompanyContext(slug);
  const lines = await listCatalogLines(ctx);
  const byMfr = new Map<string, typeof lines>();
  for (const l of lines) byMfr.set(l.manufacturer, [...(byMfr.get(l.manufacturer) ?? []), l]);
  return (
    <>
      <PageHeader eyebrow="Shared catalog" title="Decking catalog">
        Manufacturer collections with the installation rules the framing generator applies. Rows are transcribed from the manufacturers&apos; current guides and marked until verified against a data sheet; prices are set per company on the Pricing page.
      </PageHeader>
      <div className="space-y-6">
        {[...byMfr.entries()].map(([mfr, ls]) => (
          <Card key={mfr} title={mfr} aside={<span className="text-[12px] text-ink-3">{ls.reduce((a, l) => a + l.skus, 0)} SKUs</span>}>
            <table className="tbl text-[13px]">
              <thead>
                <tr>
                  <th>Collection</th>
                  <th>Material</th>
                  <th>Colours</th>
                  <th>Joists max (perp / diag)</th>
                  <th>Stair stringers max</th>
                  <th>Side gap</th>
                  <th>Hidden fasteners</th>
                  <th className="text-right">SKUs</th>
                </tr>
              </thead>
              <tbody>
                {ls.map((l) => (
                  <tr key={l.productLine}>
                    <td>
                      <div className="font-medium">{l.productLine}</div>
                      <div className="text-[11px] text-ink-3">{(l.attributes as { family?: string })?.family ?? ""}</div>
                      {l.verified < l.skus && (
                        <div className="mt-1">
                          <Chip tone="amber">verify vs. data sheet</Chip>
                        </div>
                      )}
                    </td>
                    <td className="text-ink-2">{l.material.replace(/-/g, " ")}</td>
                    <td className="max-w-[260px] text-ink-2">{l.colors}</td>
                    <td className="num">{l.installation ? `${l.installation.maxJoistSpacingPerpendicularIn}" / ${l.installation.maxJoistSpacingDiagonalIn}"` : "—"}</td>
                    <td className="num">{l.installation ? `${l.installation.maxStairStringerSpacingIn}"${l.installation.minStringersAt36In ? ` · ≥${l.installation.minStringersAt36In} stringers` : ""}` : "—"}</td>
                    <td className="num">{l.installation ? `${l.installation.sideGapIn}"` : "—"}</td>
                    <td className="max-w-[240px] text-[12px] text-ink-2">{l.installation?.hiddenFastenerSystems.join("; ") || "—"}</td>
                    <td className="num text-right">{l.skus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details className="mt-3 text-[12px] text-ink-3">
              <summary className="cursor-pointer">Sources and notes</summary>
              <ul className="mt-1 list-disc pl-5">
                {ls.map((l) => (
                  <li key={l.productLine}>
                    <span className="font-medium text-ink-2">{l.productLine}:</span> {l.dataSource}
                    {l.installation && (
                      <>
                        {" "}
                        · Installation: {l.installation.source.title} ({l.installation.source.retrieved}). {l.installation.notes.join(" ")}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        ))}
      </div>
    </>
  );
}
