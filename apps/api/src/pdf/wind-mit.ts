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

function fieldsFor(inspection: Inspection): FieldDraw[] {
  const property: any = inspection.property ?? {};
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

  // ── Per-page footers (Inspectors Initials + Property Address × 6) ─────
  const fullAddr = fmtAddress(inspection);
  const initials = initialsOf(inspection.inspectorName);
  // Footer y is consistent across pages — label bbox yMax ≈ 725.
  for (let p = 0; p < 6; p++) {
    push({ page: p, x: 122, y: yFromTop(725), value: initials });
    push({ page: p, x: 220, y: yFromTop(725), value: fullAddr });
  }

  // TODO(v2): body questions Q1-Q9, inspector signature block on
  // pages 5-6 (Qualified Inspector type check + signature + license).

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
