/**
 * Overlay values on the official Florida OIR-B1-1802 (Rev. 04/26)
 * Uniform Mitigation Verification Inspection Form.
 *
 * The 04/26 revision is effective April 1, 2026 (per Rule 69O-170.0155
 * F.A.C.) and replaces the 01/12 fillable AcroForm version we used
 * previously. The new form is a 6-page **flat PDF** (zero AcroForm
 * fields), so we use pdf-lib's drawText() to overlay values at
 * hard-coded x/y positions next to the printed labels — same pattern
 * as Citizens 4-Point.
 *
 * **V1 scope (this commit):**
 *   • Page-1 Owner Information block (owner, contact, address, phones,
 *     policy, year, stories, email)
 *   • Inspection Date
 *   • Per-page footers (Inspectors Initials + Property Address × 6 pages)
 *
 * **V2 TODO:**
 *   • Q1 Building Code checkbox + year fields
 *   • Q2 Roof Covering checkboxes + permit dates
 *   • Q3 Roof Deck Attachment checkbox
 *   • Q4 Roof to Wall Attachment checkbox (matrix changed in 04/26)
 *   • Q5 Roof Geometry + Total roof system perimeter + Total roof area
 *   • Q6 SWR
 *   • Q7 Opening Protection — significantly more granular in 04/26
 *   • Q8, Q9 — new questions added in 04/26
 *   • Inspector signature block on page 5/6 (Qualified Inspector type
 *     check + signature + license number)
 *
 * Positions measured from the rendered template
 * (/src/samples/inspect-ai-oir-1802-2026-p{1..6}.png) and pdftotext
 * bbox HTML. Coordinate system: PDF points, bottom-left origin.
 * US Letter = 612 × 792.
 */
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { Inspection } from "@inspect-ai/shared";
import { OIR_B1_1802_2026_BASE64 } from "./oir-b1-1802-2026.base64.js";

const PAGE_H = 792;

/** pdftotext-bbox top-down yMax → pdf-lib bottom-up baseline. */
const yFromTop = (yMaxTopDown: number) => PAGE_H - yMaxTopDown;

// Cache the decoded template bytes per warm-isolate.
let cachedBytes: Uint8Array | null = null;
function templateBytes(): Uint8Array {
  if (cachedBytes) return cachedBytes;
  const bin = atob(OIR_B1_1802_2026_BASE64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  cachedBytes = out;
  return out;
}

interface FieldDraw {
  page: number; // 0-based page index
  x: number;
  y: number; // pdf-lib bottom-up baseline
  size?: number;
  value: unknown;
  bold?: boolean;
}

function initialsOf(name: string | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function fmtAddress(insp: Inspection): string {
  const a = insp.address;
  return `${a.line1}, ${a.city}, ${a.state} ${a.zip}`;
}

/** "X" mark inside a checkbox printed at top-down (xBox, yBox). */
function checkBox(out: FieldDraw[], page: number, xBox: number, yBox: number) {
  out.push({
    page,
    x: xBox + 0.5,
    y: yFromTop(yBox + 7),
    size: 10,
    value: "X",
    bold: true,
  });
}

function fieldsFor(inspection: Inspection): FieldDraw[] {
  const property: any = inspection.property ?? {};
  const wm: any = inspection.windMit ?? {};
  const addr = inspection.address;
  const out: FieldDraw[] = [];

  const push = (f: FieldDraw) => {
    if (f.value === undefined || f.value === null || f.value === "") return;
    out.push({ size: 10, ...f });
  };

  // ── PAGE 1 — Inspection Date (top right) ───────────────────────────────
  // "Inspection Date:" label bbox: xMax≈118, yMax≈70 (top-down)
  push({
    page: 0,
    x: 124,
    y: yFromTop(70),
    value: inspection.inspectedOn?.slice(0, 10),
  });

  // ── PAGE 1 — Owner Information block ───────────────────────────────────
  // bbox y values (top-down). Row baseline ≈ yMin + 14 ≈ yMax of text.
  //   row 1 (y≈114):  Owner Name: 108  |  Contact Person: 427
  //   row 2 (y≈136):  Address: 85      |  Home Phone:    418
  //   row 3 (y≈158):  City: 68 | Zip: 220  |  Work Phone: 416
  //   row 4 (y≈180):  County: 81       |  Cell Phone:    409
  //   row 5 (y≈202):  Insurance Company: 137  |  Policy #: 397
  //   row 6 (y≈224):  Year of Home: 112 | # of Stories: 255 | Email: 387

  // Row 1
  push({ page: 0, x: 114, y: yFromTop(114), value: property.ownerName });

  // Row 2
  push({ page: 0, x: 92, y: yFromTop(136), value: addr.line1 });
  push({ page: 0, x: 424, y: yFromTop(136), value: inspection.ownerPhone });

  // Row 3
  push({ page: 0, x: 74, y: yFromTop(158), value: addr.city });
  push({ page: 0, x: 226, y: yFromTop(158), value: addr.zip });

  // Row 4
  push({ page: 0, x: 88, y: yFromTop(180), value: property.county });

  // Row 5 — Insurance Company + Policy # not in our schema (left blank for
  // the inspector to fill manually).

  // Row 6
  push({ page: 0, x: 118, y: yFromTop(224), value: property.yearBuilt });
  push({ page: 0, x: 394, y: yFromTop(224), value: inspection.ownerEmail });

  // ── NOTE — FORTIFIED Home certificate checkboxes ───────────────────────
  // Checkboxes at top-down y≈251. Positions: Roof x=285, Silver x=321, Gold x=374.
  const FORTIFIED_X: Record<string, number> = {
    roof: 285, silver: 321, gold: 374,
  };
  if (wm.fortifiedHome && FORTIFIED_X[wm.fortifiedHome]) {
    checkBox(out, 0, FORTIFIED_X[wm.fortifiedHome]!, 251);
  }

  // ── Q1. Building Code ──────────────────────────────────────────────────
  // The 04/26 form has 4 options A/B/C/D. Either the inspector picked
  // one of the new explicit enums (a_fbc_2001_2004 etc.) OR we fall back
  // to the legacy 01/12 enum + year-based smart routing.
  const year =
    Number(wm.yearOfHomeOriginalConstruction) || Number(property.yearBuilt) || 0;
  // Box y positions per option (top-down) — used by both explicit + legacy paths.
  const Q1A = { x: 36, y: 331, yearBlankX: 400, yearBlankY: 343 };
  const Q1B = { x: 35, y: 354, yearBlankX: 400, yearBlankY: 366 };
  const Q1C = { x: 35, y: 377, yearBlankX: 419, yearBlankY: 389 };
  const Q1D = { x: 36, y: 412 } as { x: number; y: number; yearBlankX?: number; yearBlankY?: number };
  type Q1Box = typeof Q1A;
  let q1Box: Q1Box | typeof Q1D | null = null;
  switch (wm.buildingCode) {
    case "a_fbc_2001_2004":  q1Box = Q1A; break;
    case "b_fbc_2007_later": q1Box = Q1B; break;
    case "c_hvhz_sfbc_94":   q1Box = Q1C; break;
    case "d_unknown":        q1Box = Q1D; break;
    // Legacy 01/12 enum values → smart-route based on year.
    case "a_built_2002_or_later_fbc":
      q1Box = year >= 2007 ? Q1B : Q1A;
      break;
    case "b_built_1994_2001_sfbc": q1Box = Q1C; break;
    case "c_unknown_or_not_meeting": q1Box = Q1D; break;
  }
  if (q1Box) {
    checkBox(out, 0, q1Box.x, q1Box.y);
    // Year built blank (only A/B/C have a Year Built input)
    if (q1Box.yearBlankX && q1Box.yearBlankY && year > 0) {
      push({ page: 0, x: q1Box.yearBlankX, y: yFromTop(q1Box.yearBlankY), value: year });
    }
    // Permit date — MM/DD/YYYY split blank at x≈478, y just below box
    if (wm.buildingPermitDate && q1Box.yearBlankY) {
      push({
        page: 0,
        x: 478,
        y: yFromTop(q1Box.yearBlankY + 11),
        value: wm.buildingPermitDate,
      });
    }
  }

  // ── Q2. Region ─────────────────────────────────────────────────────────
  // y≈446 (top-down). Positions per option:
  const REGION_X: Record<string, number> = {
    hvhz: 36,
    region_1: 79,
    region_2: 180,
    region_3: 318,
  };
  if (wm.region && REGION_X[wm.region] !== undefined) {
    checkBox(out, 0, REGION_X[wm.region]!, 446);
  }

  // ── Q4. Roof Covering — type row + per-row compliance columns ──────────
  // 7 type rows on page 1 (top-down y positions of the checkbox/label).
  // Each row has columns at:
  //   Permit Date:     x ≈ 168 (blank ____/____/____)
  //   Product Approval #: x ≈ 248 (blank ________________)
  //   Year of Original:   x ≈ 349 (blank ________________)
  //   No Info checkbox:   x ≈ 466
  const COVERING_ROW_Y: Record<string, number> = {
    asphalt_fiberglass_shingle: 577,
    concrete_clay_tile:         598,
    // 04/26 added Synthetic/Composite Tile — schema doesn't track it
    // separately yet; "other" routes to the bottom "Other ___" row.
    metal:                      619,
    built_up:                   629,
    membrane:                   640,
    wood_shake:                 655,  // routes to "Other"
    other:                      655,
  };
  const rc: any = wm.roofCovering ?? {};
  const rowY = COVERING_ROW_Y[rc.type];
  if (rowY !== undefined) {
    // 1. Mark the type checkbox at x=41
    checkBox(out, 0, 41, rowY);
    // 2. Permit Application Date column
    push({ page: 0, x: 168, y: yFromTop(rowY + 7), value: rc.permitApplicationDate, size: 8 });
    // 3. FBC or MDC Product Approval #
    push({ page: 0, x: 248, y: yFromTop(rowY + 7), value: rc.productApprovalNumber, size: 8 });
    // 4. Year of Original Installation/Replacement
    push({ page: 0, x: 349, y: yFromTop(rowY + 7), value: rc.yearOfOriginalInstallation, size: 8 });
    // 5. No Info Provided checkbox at x=466
    if (rc.noInformationProvided) {
      checkBox(out, 0, 466, rowY);
    }
  }

  // ── Q3. Roof Slope ─────────────────────────────────────────────────────
  // y≈492 (top-down). ≥ 6:12 at x=36, < 6:12 at x=176.
  const ROOF_SLOPE_X: Record<string, number> = {
    ge_6_12: 36,
    lt_6_12: 176,
  };
  if (wm.roofSlope && ROOF_SLOPE_X[wm.roofSlope] !== undefined) {
    checkBox(out, 0, ROOF_SLOPE_X[wm.roofSlope]!, 492);
  }

  // ── Per-page footers (Inspectors Initials + Property Address × 6) ─────
  const fullAddr = fmtAddress(inspection);
  const initials = initialsOf(inspection.inspectorName);
  // Footer y is consistent across pages — label bbox yMax ≈ 725.
  for (let p = 0; p < 6; p++) {
    push({ page: p, x: 122, y: yFromTop(725), value: initials });
    push({ page: p, x: 220, y: yFromTop(725), value: fullAddr });
  }

  // TODO(v2): Q4 Roof Covering (rows of dates + product approval),
  // Q5 Roof Geometry, Q6 SWR, Q7 Opening Protection, Q8/Q9 new questions,
  // inspector signature block on page 5/6.

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

export async function fillWindMit(inspection: Inspection): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pages = doc.getPages();
  const fields = fieldsFor(inspection);
  drawAll(pages, font, fontBold, fields);

  return await doc.save();
}
