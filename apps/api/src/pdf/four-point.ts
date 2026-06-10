/**
 * Fill the Citizens Property Insurance 4-Point Inspection Form
 * (Insp4pt 03 25) by OVERLAYING text on the flat PDF template.
 *
 * Citizens' form is not an AcroForm (zero fillable fields) but is the
 * de-facto carrier-accepted 4-Point in Florida. We bundle the official
 * template and use pdf-lib's drawText() to put values at hard-coded
 * positions next to the printed labels.
 *
 * Form layout (PDF top-down coords; baselines = yMax - 2 of label bbox):
 *   Page 1: Insured/Address header + Electrical System
 *   Page 2: HVAC System + Plumbing System
 *   Page 3: Roof (Predominant + Secondary columns) + Inspector signature
 *   Page 4: Disclosures (we leave blank)
 *
 * Positions extracted from pdftotext bbox dump at /tmp/oir/4pt-bbox.html.
 *
 * Coordinate system: PDF points, bottom-left origin. US Letter = 612×792.
 */
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { Inspection } from "@inspect-ai/shared";
import { CITIZENS_4PT_BASE64 } from "./citizens-4pt.base64.js";

const PAGE_H = 792;

/** Map pdftotext bbox (top-down) y → pdf-lib baseline y. */
const yFromTop = (yMaxTopDown: number) => PAGE_H - yMaxTopDown;

// Cache the decoded template bytes per warm-isolate.
let cachedBytes: Uint8Array | null = null;
function templateBytes(): Uint8Array {
  if (cachedBytes) return cachedBytes;
  const bin = atob(CITIZENS_4PT_BASE64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  cachedBytes = out;
  return out;
}

interface FieldDraw {
  page: 0 | 1 | 2;
  x: number;
  y: number;
  size?: number;
  value: unknown;
  bold?: boolean;
}

/**
 * Helper: drop an "X" centered inside a checkbox at top-down (xBox, yBox).
 * Same +12 baseline offset as the wind-mit form (see PDF tuning notes in
 * CLAUDE.md — bbox boxes ~14pt tall, baseline at yBox+12 visually centers
 * the size-10 bold "X" character).
 */
function checkBox(
  out: FieldDraw[],
  page: 0 | 1 | 2,
  xBox: number,
  yBox: number,
) {
  out.push({
    page,
    x: xBox + 1,
    y: yFromTop(yBox + 12),
    size: 10,
    value: "X",
    bold: true,
  });
}

function fieldsFor(inspection: Inspection): FieldDraw[] {
  const property: any = inspection.property ?? {};
  const fp: any = inspection.fourPoint ?? {};
  const electrical: any = fp.electrical ?? {};
  const hvac: any = fp.hvac ?? {};
  const plumbing: any = fp.plumbing ?? {};
  const roof: any = fp.roof ?? {};
  const predominant: any = roof.predominant ?? {};
  const secondary: any = roof.secondary ?? {};
  const addr = inspection.address;
  const out: FieldDraw[] = [];

  const push = (f: FieldDraw) => {
    if (f.value === undefined || f.value === null || f.value === "") return;
    out.push({ size: 10, ...f });
  };

  // ── PAGE 1 — Header ───────────────────────────────────────────────────
  // (verified pixel-correct in V1)
  push({ page: 0, x: 134, y: yFromTop(73), value: property.ownerName });
  const fullAddr = `${addr.line1}, ${addr.city}, ${addr.state} ${addr.zip}`;
  push({ page: 0, x: 116, y: yFromTop(91), value: fullAddr });
  push({ page: 0, x: 108, y: yFromTop(112), value: property.yearBuilt });
  push({
    page: 0,
    x: 379,
    y: yFromTop(112),
    value: inspection.inspectedOn?.slice(0, 10),
  });

  // ── PAGE 1 — Electrical System ────────────────────────────────────────
  // Position derivation: every checkbox ☐ glyph is ~10pt wide and sits to
  // the LEFT of its label word — i.e. ckbx_x ≈ (label_word_xMin - 11).
  // All y values are top-down yMin of the label word; the checkBox helper
  // adds +12 for the X baseline.
  //
  // Total Amps — "Total Amps:" label ends at x≈85 (main) / x≈356 (second), y=334.
  // Blank input starts ~3pt after the colon.
  push({ page: 0, x: 88, y: yFromTop(341), value: electrical.panelAmps, size: 10 });

  // "General condition of the electrical system" — y=620.
  // "Satisfactory" word at x=222 → ☐ at x≈211. "Unsatisfactory" at x=284 → ☐ at x≈273.
  if (electrical.inGoodWorkingOrder === true) {
    checkBox(out, 0, 211, 620);
  } else if (electrical.inGoodWorkingOrder === false) {
    checkBox(out, 0, 273, 620);
  }

  // Hazards Present — Blowing fuses ckbx at y=507, "Blowing" word x=62 → ☐ x≈51.
  // (We don't model individual hazards yet — stamp one box as a flag.)
  if (electrical.hazardsPresent === true) {
    checkBox(out, 0, 51, 507);
  }

  // Wiring Type(s) Supplemental Information — page 1 bottom.
  //   y=691: "Copper" word x=320 → ☐ x≈309 | "Copper Clad AL" word x=411 → ☐ x≈400 | "NM," x=507 → ☐ x≈496
  //   y=706: "Single Strand AL" x=320 → ☐ x≈309 | "Cloth (Knob & Tube)" x=412 → ☐ x≈401 | "Other" x=506 → ☐ x≈495
  //   y=718: "Multistrand AL" x=320 → ☐ x≈309 | "Cloth Jacket..." x=412 → ☐ x≈401
  const WIRING_BOX: Record<string, { x: number; y: number }> = {
    copper_romex:  { x: 309, y: 691 }, // Copper
    aluminum:      { x: 309, y: 706 }, // Single Strand AL
    knob_tube:     { x: 401, y: 706 }, // Cloth (Knob & Tube)
    mixed:         { x: 309, y: 718 }, // Multistrand AL
    other:         { x: 495, y: 706 }, // Other
  };
  const wireBox = WIRING_BOX[electrical.wiringType];
  if (wireBox) checkBox(out, 0, wireBox.x, wireBox.y);

  // Brand/Model — Main panel "Brand/Model:" label ends at x≈90, y=721.
  push({ page: 0, x: 94, y: yFromTop(728), value: electrical.panelBrand, size: 9 });

  // ── PAGE 2 — HVAC System ──────────────────────────────────────────────
  // Central AC — y=108. "Yes" word x=108 → ☐ x≈97. "No" word x=144 → ☐ x≈133.
  if (hvac.systemType === "central_ac" || hvac.systemType === "heat_pump") {
    checkBox(out, 1, 97, 108); // Central AC Yes
  } else if (hvac.systemType) {
    checkBox(out, 1, 133, 108); // Central AC No
  }

  // "Are the heating, ventilation and AC systems in good working order?" y=154.
  // "Yes" word x=342 → ☐ x≈331. "No" word x=374 → ☐ x≈363.
  if (hvac.inGoodWorkingOrder === true) {
    checkBox(out, 1, 331, 154);
  } else if (hvac.inGoodWorkingOrder === false) {
    checkBox(out, 1, 363, 154);
  }

  // Hazards Present — wood-burning stove "present?" at y=208.
  // "Yes" x=257 → ☐ x≈246. (Single sentinel for any HVAC hazard.)
  if (hvac.hazardsPresent === true) {
    checkBox(out, 1, 246, 208);
  }

  // Supplemental Information — Age of system at y=303, Year last updated y=318.
  push({ page: 1, x: 100, y: yFromTop(310), value: hvac.ageYears });
  push({ page: 1, x: 110, y: yFromTop(325), value: hvac.yearLastUpdated });

  // ── PAGE 2 — Plumbing System ──────────────────────────────────────────
  // "Is there any indication of an active leak?" y=403.
  // "Yes" x=202 → ☐ x≈191. "No" x=234 → ☐ x≈223.
  if (plumbing.leaksObserved === true) {
    checkBox(out, 1, 191, 403);
  } else if (plumbing.leaksObserved === false) {
    checkBox(out, 1, 223, 403);
  }

  // General condition Sat/Unsat — supplied via plumbing.inGoodWorkingOrder.
  // The N/A column matrix is too detailed for a single bool; instead we just
  // skip the per-fixture grid and rely on the "If unsatisfactory..." comment
  // box. The condition flows into the "All other visible" row Sat/Unsat ckbx.
  // y≈728 (All other visible) — leave for v3.

  // Supplemental — Type of pipes (check all that apply). Each row:
  //   y=633: Copper ☐ x=352 | PEX ☐ x=449
  //   y=648: PVC/CPVC ☐ x=352 | Other ☐ x=449
  //   y=663: Galvanized ☐ x=352
  //   y=678: Cast Iron ☐ x=352
  //   y=695: Polybutylene ☐ x=352
  //   y=710: ABS ☐ x=352
  const PIPE_BOX: Record<string, { x: number; y: number }> = {
    copper:        { x: 352, y: 633 },
    cpvc:          { x: 352, y: 648 }, // PVC/CPVC
    pex:           { x: 449, y: 633 }, // PEX
    galvanized:    { x: 352, y: 663 },
    polybutylene:  { x: 352, y: 695 },
    mixed:         { x: 449, y: 648 }, // Other (specify) — closest fallback
  };
  const pipeBox = PIPE_BOX[plumbing.supplyMaterial];
  if (pipeBox) checkBox(out, 1, pipeBox.x, pipeBox.y);

  // Age of water heater at y=676, blank at x≈110.
  push({ page: 1, x: 116, y: yFromTop(683), value: plumbing.waterHeaterAgeYears });

  // ── PAGE 3 — Roof (Predominant + Secondary columns) ───────────────────
  // Two parallel columns: predominant labels at x≈42, secondary at x≈313.
  // Blank inputs start ~5pt after each label's xMax.
  //
  // Row baselines (all yMax - 2):
  //   y=117  Covering material:        blank x predom=100 | sec=371
  //   y=132  Roof age (years):         blank x predom=115 | sec=385
  //   y=148  Remaining useful life:    blank x predom=160 | sec=430
  //   y=163  Date of last roofing permit:  blank x predom=140 | sec=410
  //   y=178  Date of last update:      blank x predom=115 | sec=385
  //
  // Checkboxes:
  //   y=200  Full replacement ☐   x predom=55  | sec=322
  //   y=215  Partial replacement ☐ x predom=55  | sec=322
  //   y=230  % of replacement:    blank x predom=130 | sec=400
  //   y=260  Satisfactory ☐       x predom=55  | sec=322
  //   y=275  Unsatisfactory ☐     x predom=55  | sec=322
  //
  //   y=422  Any visible signs of leaks? Yes ☐ | No ☐  (predom Y x≈153, N x≈190 | sec Y x≈424, N x≈460)

  const COVERING_LABEL: Record<string, string> = {
    asphalt_shingle: "Asphalt shingle",
    metal:           "Metal",
    tile:            "Tile",
    built_up:        "Built-up",
    membrane:        "Membrane",
    wood_shake:      "Wood shake",
    other:           "Other",
  };

  // Helper that fills one roof column (predominant or secondary).
  // xOffset: 0 for predominant column, 271 for secondary.
  // Each value is placed ~5pt after its label's xMax:
  //   "Covering material:" xMax=107 → value at x≈112
  //   "Roof age (years):" xMax=104 → value at x≈109
  //   "Remaining useful life (years):" xMax=146 → value at x≈151
  //   "Date of last roofing permit:" xMax=136 → value at x≈141
  //   "Date of last update:" xMax=112 → value at x≈117
  const fillRoofColumn = (col: any, xOffset: number) => {
    push({
      page: 2,
      x: 112 + xOffset,
      y: yFromTop(117),
      value: col.coveringMaterial ? COVERING_LABEL[col.coveringMaterial] : undefined,
      size: 9,
    });
    push({ page: 2, x: 109 + xOffset, y: yFromTop(132), value: col.ageYears });
    push({ page: 2, x: 151 + xOffset, y: yFromTop(148), value: col.remainingLifeYears });
    push({ page: 2, x: 141 + xOffset, y: yFromTop(163), value: col.lastPermitDate, size: 9 });
    push({ page: 2, x: 117 + xOffset, y: yFromTop(178), value: col.lastUpdateDate, size: 9 });
    // Full replacement ckbx: "Full" word x=62 (predom) → ☐ x≈51. Secondary x=329 → x≈318.
    if (col.updateExtent === "full_replacement") {
      checkBox(out, 2, 51 + xOffset, 200);
    } else if (col.updateExtent === "partial_replacement") {
      checkBox(out, 2, 51 + xOffset, 215);
      push({
        page: 2,
        x: 130 + xOffset,
        y: yFromTop(237),
        value: col.updatePercent != null ? `${col.updatePercent}%` : undefined,
        size: 9,
      });
    }
    if (col.condition === "satisfactory") {
      checkBox(out, 2, 51 + xOffset, 260);
    } else if (col.condition === "unsatisfactory") {
      checkBox(out, 2, 51 + xOffset, 275);
    }
    // "Any visible signs of leaks?" Yes/No at y=422.
    // Predom: "Yes" x=163 → ☐ x≈152, "No" x=195 → ☐ x≈184.
    // Secondary: "Yes" x=434 → ☐ x≈423 (consistent with xOffset=271→ 152+271=423 ✓).
    if (col.visibleLeaks === true) {
      checkBox(out, 2, 152 + xOffset, 422);
    } else if (col.visibleLeaks === false) {
      checkBox(out, 2, 184 + xOffset, 422);
    }
  };

  if (predominant && Object.keys(predominant).length > 0) {
    fillRoofColumn(predominant, 0);
  }
  if (secondary && Object.keys(secondary).length > 0) {
    // Secondary column "Full" word starts at x=329, predominant at x=62 → 267pt offset.
    // But the leaks "Yes" gap is 434−163=271. The label/blank inputs use 271 offset
    // (e.g. "Covering material:" predom x=42 vs secondary x=313 = 271). The Full/Partial
    // ckbx column has a slightly different offset (267) due to layout drift. Splitting
    // the difference at 269 keeps both rows on-cell within the ~14pt-wide checkboxes.
    fillRoofColumn(secondary, 271);
  }

  // ── PAGE 3 — Inspector signature block (V1, kept) ─────────────────────
  push({ page: 2, x: 50, y: yFromTop(648), value: inspection.inspectorName });
  push({ page: 2, x: 444, y: yFromTop(648), value: inspection.inspectorLicense });
  push({
    page: 2,
    x: 465,
    y: yFromTop(625),
    value: inspection.inspectedOn?.slice(0, 10),
  });

  return out;
}

function drawAll(
  pages: PDFPage[],
  font: PDFFont,
  fontBold: PDFFont,
  fields: FieldDraw[],
) {
  for (const f of fields) {
    const page = pages[f.page];
    if (!page) continue;
    page.drawText(String(f.value), {
      x: f.x,
      y: f.y,
      size: f.size ?? 10,
      font: f.bold ? fontBold : font,
    });
  }
}

export async function fillFourPoint(inspection: Inspection): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pages = doc.getPages();
  const fields = fieldsFor(inspection);
  drawAll(pages, font, fontBold, fields);

  return await doc.save();
}
