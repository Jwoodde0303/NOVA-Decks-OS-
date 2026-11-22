"use client";
import { useMemo } from "react";
import { analyzeDeck, type DeckDesignModel } from "@/modules/design/model";
import type { FramingResult } from "@/modules/framing/generate";
import { framingPlanDrawing } from "@/modules/drawing/deck-drawings";
import { DrawingSvg } from "@/modules/drawing/DrawingSvg";

/**
 * Auto-generated framing plan for the web. It renders the same drawing model that goes onto the
 * permit planset sheet S-101, so the screen and the PDF cannot disagree.
 */
export function FramingPlan({ model, framing }: { model: DeckDesignModel; framing: FramingResult }) {
  const drawing = useMemo(() => framingPlanDrawing({ model, analysis: analyzeDeck(model, null), framing }, { w: 760, h: 460 }), [model, framing]);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-ink-3">
        <span className="font-display font-semibold text-ink">{drawing.title}</span>
        <span>
          {drawing.subtitle} · sheet scale {drawing.scaleLabel} · design aid, not a sealed drawing
        </span>
      </div>
      <DrawingSvg drawing={drawing} />
    </div>
  );
}
