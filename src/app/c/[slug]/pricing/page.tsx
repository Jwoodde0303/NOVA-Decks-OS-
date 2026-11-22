import { requireCompanyContext } from "@/lib/request-context";
import { getCompanySettings } from "@/modules/core/company";
import { listDeckingCatalog } from "@/modules/catalog/service";
import { currentProductPrices, getPriceBook, priceBookCoverage, PRICE_BOOK_CATALOG } from "@/modules/estimating/pricing";
import { ActionForm } from "@/components/ActionForm";
import { Card, Field, Money, PageHeader } from "@/components/ui";
import { setPriceBookItemAction, setProductPriceAction, updateCompanySettingsAction } from "../actions";

export default async function PricingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> }) {
  const { slug } = await params;
  const { q } = await searchParams;
  const ctx = await requireCompanyContext(slug);
  const [settings, catalog, prices, book, coverage] = await Promise.all([getCompanySettings(ctx), listDeckingCatalog(ctx), currentProductPrices(ctx), getPriceBook(ctx), priceBookCoverage(ctx)]);
  const canManage = ctx.can("pricing.manage");
  const today = new Date().toISOString().slice(0, 10);
  const query = (q ?? "").toLowerCase();
  const products = catalog.filter((c) => (query ? `${c.manufacturer} ${c.productLine} ${c.color} ${c.sku}`.toLowerCase().includes(query) : prices.has(c.id))).slice(0, 200);

  return (
    <>
      <PageHeader eyebrow={ctx.companyName} title="Pricing">
        Your decking prices, price book and estimate settings. Prices are append-only by effective date; saved estimate revisions never change.
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card title="Estimate settings">
          {canManage ? (
            <ActionForm action={updateCompanySettingsAction.bind(null, slug)} submitLabel="Save settings">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Decking waste %">
                  <input name="wastePct" type="number" step="0.5" min={0} max={50} defaultValue={settings.wastePct} className="field num" />
                </Field>
                <Field label="Markup %">
                  <input name="markupPct" type="number" step="0.5" min={0} max={200} defaultValue={settings.markupPct} className="field num" />
                </Field>
                <Field label="Material tax %">
                  <input name="materialTaxPct" type="number" step="0.25" min={0} max={30} defaultValue={settings.materialTaxPct} className="field num" />
                </Field>
              </div>
              <input type="hidden" name="framingRuleset" value={settings.framingRuleset} />
              <p className="mt-2 text-[12px] text-ink-3">Markup applies to materials and labor; tax applies to materials only. Framing rules: {settings.framingRuleset}.</p>
            </ActionForm>
          ) : (
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-[14px]">
              <dt>Decking waste</dt>
              <dd className="num">{settings.wastePct}%</dd>
              <dt>Markup</dt>
              <dd className="num">{settings.markupPct}%</dd>
              <dt>Material tax</dt>
              <dd className="num">{settings.materialTaxPct}%</dd>
            </dl>
          )}
        </Card>

        <Card title={`Price book · ${coverage.priced}/${coverage.total} items priced`}>
          {coverage.missing.length > 0 && <div className="mb-3 rounded-[var(--radius-sm)] border border-amber/30 bg-amber-soft px-3 py-2 text-[12px] text-amber">Unpriced keys: {coverage.missing.join(", ")}. Estimates will flag these lines.</div>}
          <div className="max-h-[420px] overflow-auto">
            <table className="tbl text-[13px]">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Unit</th>
                  <th className="text-right">Price</th>
                  <th>Effective</th>
                </tr>
              </thead>
              <tbody>
                {PRICE_BOOK_CATALOG.map((i) => {
                  const cur = book.get(i.key);
                  return (
                    <tr key={i.key}>
                      <td>
                        <div>{i.description}</div>
                        <div className="num text-[11px] text-ink-3">{i.key}</div>
                      </td>
                      <td className="text-ink-2">{i.unit}</td>
                      <td className="text-right">{cur ? <Money cents={cur.unitPriceCents} /> : <span className="text-brick">—</span>}</td>
                      <td className="num text-[12px] text-ink-3">{cur?.effectiveOn ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {canManage && (
            <ActionForm action={setPriceBookItemAction.bind(null, slug)} submitLabel="Set price" resetOnSuccess className="mt-4 border-t border-line pt-4">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2">
                <select name="key" className="field" required defaultValue="">
                  <option value="" disabled>
                    Item…
                  </option>
                  {PRICE_BOOK_CATALOG.map((i) => (
                    <option key={i.key} value={i.key}>
                      {i.description} ({i.unit})
                    </option>
                  ))}
                </select>
                <input name="price" type="number" step="0.01" min={0} required placeholder="$ per unit" className="field num" />
                <input name="effectiveOn" type="date" defaultValue={today} required className="field num" />
                <input name="source" placeholder="Source" className="field" />
              </div>
              <PriceBookHidden />
            </ActionForm>
          )}
        </Card>
      </div>

      <Card title="Decking prices (per board)" className="mt-5">
        <form className="mb-3 flex gap-2" method="get">
          <input name="q" defaultValue={q ?? ""} placeholder="Search the catalog: manufacturer, collection, colour or SKU" className="field max-w-[460px]" />
          <button className="btn btn-secondary" type="submit">
            Search
          </button>
        </form>
        <div className="text-[12px] text-ink-3">{query ? `${products.length} matching products (first 200)` : `${products.length} priced products. Search to price more.`}</div>
        <div className="mt-2 max-h-[560px] overflow-auto">
          <table className="tbl text-[13px]">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th className="text-right">Current price</th>
                {canManage && <th>Set price</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const cur = prices.get(p.id);
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-black/10 align-middle" style={{ background: p.colorHex ?? "#999" }} />
                      {`${p.manufacturer} ${p.productLine} ${p.color} · ${p.profile} ${p.widthActualIn}" · ${p.stockLengthIn / 12} ft`}
                    </td>
                    <td className="num">{p.sku}</td>
                    <td className="text-right">{cur ? <Money cents={cur.unitPriceCents} /> : <span className="text-ink-3">—</span>}</td>
                    {canManage && (
                      <td>
                        <ActionForm action={setProductPriceAction.bind(null, slug)} submitLabel="Set" resetOnSuccess className="flex items-center gap-1 [&>div]:mt-0">
                          <input type="hidden" name="catalogProductId" value={p.id} />
                          <input type="hidden" name="effectiveOn" value={today} />
                          <input type="hidden" name="source" value="manual" />
                          <input name="price" type="number" step="0.01" min={0} required placeholder="$" className="field h-8 w-24 py-1 text-[13px] num" />
                        </ActionForm>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

/** The price-book form needs category/unit/description for a chosen key; these are filled server-side from the key. */
function PriceBookHidden() {
  return (
    <>
      <input type="hidden" name="category" value="" />
      <input type="hidden" name="unit" value="" />
      <input type="hidden" name="description" value="" />
    </>
  );
}
