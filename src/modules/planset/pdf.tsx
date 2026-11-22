import React from "react";
import { Circle, Document, G, Line, Page, Path, Rect, StyleSheet, Svg, Text, View, Text as PdfText } from "@react-pdf/renderer";
import type { Drawing, Primitive } from "@/modules/drawing/model";
import type { PlansetData } from "./data";

/**
 * Permit planset: letter landscape sheets with a title block. Drawings are the neutral drawing
 * model rendered 1:1 in points, so the scale printed in the title block is true at 100% print.
 * Generated to Fairfax County, VA Typical Deck Details; it is a design aid, not a sealed drawing.
 */

const PAGE = { w: 792, h: 612, margin: 22, titleBlockH: 60 };
const DRAW_BOX = { w: PAGE.w - PAGE.margin * 2, h: PAGE.h - PAGE.margin * 2 - PAGE.titleBlockH - 6 };
export const PLANSET_DRAW_BOX = { w: DRAW_BOX.w - 8, h: DRAW_BOX.h - 8 };

const st = StyleSheet.create({
  page: { padding: PAGE.margin, fontFamily: "Helvetica", fontSize: 8, color: "#1c1f24" },
  frame: { borderWidth: 1, borderColor: "#1c1f24", width: DRAW_BOX.w, height: DRAW_BOX.h, padding: 4 },
  titleBlock: { marginTop: 6, borderWidth: 1, borderColor: "#1c1f24", height: PAGE.titleBlockH, flexDirection: "row" },
  tbCell: { borderRightWidth: 1, borderRightColor: "#1c1f24", padding: 4, justifyContent: "space-between" },
  tbLabel: { fontSize: 5.5, color: "#6b7078", textTransform: "uppercase", letterSpacing: 0.4 },
  tbValue: { fontSize: 8 },
  tbTitle: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h2: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },
  p: { fontSize: 8, lineHeight: 1.35 },
  small: { fontSize: 6.5, color: "#6b7078", lineHeight: 1.3 },
  row: { flexDirection: "row" },
  col: { flex: 1, paddingRight: 10 },
  table: { borderWidth: 0.5, borderColor: "#1c1f24", marginTop: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#b8ae9d" },
  th: { fontSize: 6, fontFamily: "Helvetica-Bold", padding: 2.5, backgroundColor: "#efeae2" },
  td: { fontSize: 7, padding: 2.5 },
  mono: { fontFamily: "Courier" },
});

/** WinAnsi-safe text for the built-in fonts. */
export function pdfText(s: string): string {
  return s
    .replaceAll("≥", ">=")
    .replaceAll("≤", "<=")
    .replaceAll("·", "-")
    .replaceAll("→", "->")
    .replaceAll("↗", "")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("’", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("″", '"')
    .replaceAll("′", "'")
    .replaceAll("⅛", "1/8")
    .replaceAll("¼", "1/4")
    .replaceAll("⅜", "3/8")
    .replaceAll("½", "1/2")
    .replaceAll("¾", "3/4")
    .replaceAll("×", "x")
    .replaceAll("°", " deg");
}

function DrawingPdf({ d }: { d: Drawing }) {
  return (
    <Svg width={d.width} height={d.height} viewBox={`0 0 ${d.width} ${d.height}`}>
      {d.primitives.map((p, i) => (
        <Prim key={i} p={p} />
      ))}
    </Svg>
  );
}

function Prim({ p }: { p: Primitive }) {
  const dash = (d?: string) => (d ? d.split(" ").map(Number) : undefined);
  switch (p.kind) {
    case "line":
      return <Line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={p.width} strokeDasharray={dash(p.dash)?.join(",")} />;
    case "rect":
      if (p.hatch) {
        const lines = [];
        const step = 4;
        for (let o = -p.h; o < p.w; o += step) {
          const x1 = Math.max(p.x, p.x + o);
          const y1 = o < 0 ? p.y - o : p.y;
          const x2 = Math.min(p.x + p.w, p.x + o + p.h);
          const y2 = y1 + (x2 - x1);
          if (x2 > x1) lines.push(<Line key={o} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2f4858" strokeWidth={0.5} />);
        }
        return (
          <G>
            <Rect x={p.x} y={p.y} width={p.w} height={p.h} stroke={p.color} strokeWidth={p.width} fill="none" />
            {lines}
          </G>
        );
      }
      return <Rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill ?? "none"} stroke={p.color} strokeWidth={p.width} strokeDasharray={dash(p.dash)?.join(",")} />;
    case "circle":
      return <Circle cx={p.cx} cy={p.cy} r={p.r} fill={p.fill ?? "none"} stroke={p.color} strokeWidth={p.width} strokeDasharray={dash(p.dash)?.join(",")} />;
    case "path":
      return <Path d={p.d} fill={p.fill ?? "none"} stroke={p.color} strokeWidth={p.width} />;
    case "text":
      return (
        <Text x={p.x} y={p.y} fill={p.color} style={{ fontSize: p.size ?? 7, fontFamily: p.weight === "bold" ? "Helvetica-Bold" : p.mono ? "Courier" : "Helvetica" }} textAnchor={p.anchor} transform={p.rotate ? `rotate(${p.rotate}, ${p.x}, ${p.y})` : undefined}>
          {pdfText(p.text)}
        </Text>
      );
  }
}

function TitleBlock({ data, sheetNo, title, scale }: { data: PlansetData; sheetNo: string; title: string; scale: string }) {
  return (
    <View style={st.titleBlock}>
      <View style={[st.tbCell, { width: 170 }]}>
        <PdfText style={st.tbLabel}>Prepared by</PdfText>
        <PdfText style={st.tbValue}>{pdfText(data.company.name)}</PdfText>
        <PdfText style={st.small}>{pdfText(data.generatedLabel)}</PdfText>
      </View>
      <View style={[st.tbCell, { width: 210 }]}>
        <PdfText style={st.tbLabel}>Project</PdfText>
        <PdfText style={st.tbValue}>
          {pdfText(data.project.projectNumber)} - {pdfText(data.project.name)}
        </PdfText>
        <PdfText style={st.small}>{pdfText([data.project.clientName, data.project.siteAddress].filter(Boolean).join(" - "))}</PdfText>
      </View>
      <View style={[st.tbCell, { width: 180 }]}>
        <PdfText style={st.tbLabel}>Basis</PdfText>
        <PdfText style={st.small}>{pdfText(`${data.framing.ruleset.title} v${data.framing.ruleset.version} (${data.framing.ruleset.basis}). Design aid generated by software; not a sealed engineering drawing. County plan review and inspections apply.`)}</PdfText>
      </View>
      <View style={[st.tbCell, { flex: 1 }]}>
        <PdfText style={st.tbLabel}>Sheet</PdfText>
        <PdfText style={st.tbTitle}>{pdfText(title)}</PdfText>
        <PdfText style={st.small}>
          Scale {pdfText(scale)} on 11 x 8.5 - Design v{data.designVersion} - {data.dateLabel}
        </PdfText>
      </View>
      <View style={[st.tbCell, { width: 62, borderRightWidth: 0, alignItems: "center", justifyContent: "center" }]}>
        <PdfText style={{ fontSize: 16, fontFamily: "Helvetica-Bold" }}>{sheetNo}</PdfText>
        <PdfText style={st.small}>
          of {data.sheets.length}
        </PdfText>
      </View>
    </View>
  );
}

function Sheet({ data, sheetNo, title, scale, children }: { data: PlansetData; sheetNo: string; title: string; scale: string; children: React.ReactNode }) {
  return (
    <Page size="LETTER" orientation="landscape" style={st.page}>
      <View style={st.frame}>{children}</View>
      <TitleBlock data={data} sheetNo={sheetNo} title={title} scale={scale} />
    </Page>
  );
}

function Table({ head, rows, widths }: { head: string[]; rows: (string | number)[][]; widths: number[] }) {
  return (
    <View style={st.table}>
      <View style={st.tr}>
        {head.map((h, i) => (
          <PdfText key={i} style={[st.th, { width: widths[i] }]}>
            {pdfText(h)}
          </PdfText>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={st.tr}>
          {r.map((c, i) => (
            <PdfText key={i} style={[st.td, { width: widths[i] }]}>
              {pdfText(String(c))}
            </PdfText>
          ))}
        </View>
      ))}
    </View>
  );
}

export function PlansetDocument({ data }: { data: PlansetData }) {
  const f = data.framing;
  const d = data.drawings;
  return (
    <Document title={`${data.project.projectNumber} ${data.project.name} - Deck permit set`} author={data.company.name} subject="Deck permit planset">
      {/* G-001 Cover */}
      <Sheet data={data} sheetNo="G-001" title="COVER SHEET & INDEX" scale="NTS">
        <View style={st.row}>
          <View style={[st.col, { flex: 1.2 }]}>
            <PdfText style={st.h1}>{pdfText(`${data.project.name}`)}</PdfText>
            <PdfText style={st.p}>{pdfText(`Residential single-level attached deck - ${data.summary.footprint}, ${data.summary.height} above grade, with one straight stair.`)}</PdfText>
            <PdfText style={st.h2}>Project</PdfText>
            <PdfText style={st.p}>{pdfText(`${data.project.projectNumber} - ${data.project.name}\nClient: ${data.project.clientName ?? "-"}\nSite: ${data.project.siteAddress || "-"}\nJurisdiction: ${data.project.jurisdiction}`)}</PdfText>
            <PdfText style={st.h2}>Contractor</PdfText>
            <PdfText style={st.p}>{pdfText(data.company.name)}</PdfText>
            <PdfText style={st.h2}>Design summary</PdfText>
            {data.summary.lines.map((l) => (
              <PdfText key={l} style={st.p}>
                - {pdfText(l)}
              </PdfText>
            ))}
          </View>
          <View style={st.col}>
            <PdfText style={st.h2}>Sheet index</PdfText>
            <Table head={["No.", "Sheet", "Scale"]} rows={data.sheets.map((s) => [s.no, s.title, s.scale])} widths={[50, 220, 70]} />
            <PdfText style={st.h2}>Applicable requirements</PdfText>
            <PdfText style={st.p}>{pdfText(`Construction shall follow ${f.ruleset.title}, Version ${f.ruleset.version}, based on the ${f.ruleset.basis}. A copy of that document with Section 10 completed (see sheet S-401) must be on the job site and available at each inspection. Deviation from the typical details requires approval by the county prior to construction.`)}</PdfText>
            <PdfText style={st.p}>{pdfText(`Design loads: ${f.ruleset.designLoads}. Lumber: ${f.ruleset.lumber}.`)}</PdfText>
            <PdfText style={st.h2}>Required inspections</PdfText>
            <PdfText style={st.p}>{pdfText("Footing (holes dug, ledger attached) - Framing (posts, beams, joists before decking) - Final. Call Miss Utility (811) before digging.")}</PdfText>
            <PdfText style={[st.small, { marginTop: 10 }]}>{pdfText("These drawings were generated by software from the deck design and the county typical details. They are a design aid prepared for the contractor's permit application and are not sealed engineering drawings. Verify all site conditions, the existing house band board, utilities and setbacks before construction.")}</PdfText>
          </View>
        </View>
      </Sheet>

      {/* G-002 Site plan placeholder */}
      <Sheet data={data} sheetNo="G-002" title="SITE PLAN (ATTACH PLAT)" scale="NTS">
        <View style={{ flex: 1, borderWidth: 0.8, borderColor: "#6b7078", borderStyle: "dashed", padding: 14, justifyContent: "center", alignItems: "center" }}>
          <PdfText style={[st.h2, { fontSize: 12 }]}>ATTACH HOUSE LOCATION PLAT / SURVEY HERE</PdfText>
          <PdfText style={[st.p, { textAlign: "center", maxWidth: 520 }]}>{pdfText(`Draw the deck on the plat at ${data.summary.footprint} against the house, with the stair projecting ${data.summary.stairRun} from the outer edge, and dimension it to the property lines. Show setbacks per the zoning district, easements, septic/well locations and any utility lines. Footings must not be constructed over utility lines or service pipe.`)}</PdfText>
          <PdfText style={[st.small, { marginTop: 8, textAlign: "center" }]}>{pdfText("The plat is supplied by the owner; this software cannot generate it. Fairfax County requires the approved plat and building plans on the job site.")}</PdfText>
        </View>
      </Sheet>

      <Sheet data={data} sheetNo="A-101" title="DECK PLAN" scale={d.deckPlan.scaleLabel}>
        <DrawingPdf d={d.deckPlan} />
      </Sheet>
      <Sheet data={data} sheetNo="S-101" title="FRAMING PLAN" scale={d.framingPlan.scaleLabel}>
        <DrawingPdf d={d.framingPlan} />
      </Sheet>
      <Sheet data={data} sheetNo="S-201" title="FRONT ELEVATION" scale={d.elevation.scaleLabel}>
        <DrawingPdf d={d.elevation} />
      </Sheet>
      <Sheet data={data} sheetNo="S-301" title="SECTION A-A" scale={d.section.scaleLabel}>
        <DrawingPdf d={d.section} />
      </Sheet>
      <Sheet data={data} sheetNo="S-302" title="STAIR SECTION" scale={d.stairSection.scaleLabel}>
        <DrawingPdf d={d.stairSection} />
      </Sheet>

      {/* S-401 Schedules + county worksheet */}
      <Sheet data={data} sheetNo="S-401" title="SCHEDULES" scale="NTS">
        <View style={st.row}>
          <View style={st.col}>
            <PdfText style={st.h2}>{pdfText(`Section 10 - "Complete My Deck" (${f.ruleset.title}, p. 27)`)}</PdfText>
            <Table head={["Item", "Value"]} rows={f.worksheet.map((w) => [w.label, w.value])} widths={[150, 200]} />
            <PdfText style={st.h2}>Decking</PdfText>
            <Table head={["Item", "Value"]} rows={data.deckingSchedule} widths={[150, 200]} />
          </View>
          <View style={st.col}>
            <PdfText style={st.h2}>Framing & hardware schedule</PdfText>
            <Table head={["Item", "Qty", "Size / unit", "Note"]} rows={f.materials.map((m) => [m.item, m.qty, m.unit, m.note ?? ""])} widths={[150, 30, 110, 80]} />
          </View>
        </View>
      </Sheet>

      {/* G-003 Notes */}
      <Sheet data={data} sheetNo="G-003" title="GENERAL NOTES" scale="NTS">
        <View style={st.row}>
          {[0, 1, 2].map((colIdx) => (
            <View key={colIdx} style={st.col}>
              {data.notes
                .filter((_, k) => k % 3 === colIdx)
                .map((n) => (
                  <View key={n.title}>
                    <PdfText style={st.h2}>{pdfText(n.title)}</PdfText>
                    {n.items.map((it, k) => (
                      <PdfText key={k} style={st.p}>
                        {k + 1}. {pdfText(it)}
                      </PdfText>
                    ))}
                  </View>
                ))}
            </View>
          ))}
        </View>
      </Sheet>
    </Document>
  );
}
