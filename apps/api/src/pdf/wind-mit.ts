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

/**
 * "X" mark inside a checkbox printed at top-down (xBox, yBox).
 *
 * Form checkboxes are ~14pt tall starting at top-down y=yBox. To center
 * an "X" (size 10 bold, cap height ~7pt) inside, the baseline should sit
 * at yBox + box_height/2 + cap_height/2 ≈ yBox + 11 in top-down PDF
 * coords. Tuned empirically against the rendered PDF.
 */
function checkBox(out: FieldDraw[], page: number, xBox: number, yBox: number) {
  out.push({
    page,
    x: xBox + 0.5,
    y: yFromTop(yBox + 12),
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

  // ── PAGE 2 — Q4 WEAKEST overall roof-covering compliance ──────────────
  // Four boxes A/B/C/D at top of page 2.
  const Q4_WEAKEST_Y: Record<string, number> = {
    a_compliant:     73,   // A. All meet 2007 FBC product approval reqs
    // No exact b_compliant_mdc match in schema; legacy bug:
    b_non_compliant: 119,  // C. One or more do not meet
    // c_unknown has no checkbox — D = "no roof coverings meet" doesn't fit.
  };
  const meetsCode = rc.meetsCode;
  if (meetsCode && Q4_WEAKEST_Y[meetsCode] !== undefined) {
    checkBox(out, 1, 36, Q4_WEAKEST_Y[meetsCode]!);
  }

  // ── PAGE 2 — Q5 Roof Deck Attachment ──────────────────────────────────
  const Q5_Y: Record<string, number> = {
    a_plywood_osb_6d_nails_6_12: 165,
    b_plywood_osb_8d_nails_6_12: 234,
    c_plywood_osb_8d_nails_6_6:  280,
    d_reinforced_concrete:       337,
    e_other:                     372,  // F. Other on the form
    f_unknown:                   383,  // G. Unknown on the form
  };
  if (wm.roofDeckAttachment && Q5_Y[wm.roofDeckAttachment] !== undefined) {
    checkBox(out, 1, 36, Q5_Y[wm.roofDeckAttachment]!);
  }

  // ── PAGE 2/3 — Q6 Roof-to-Wall Attachment ─────────────────────────────
  // Main category boxes A (toenails) on p2, B-I on p3.
  type RtwBox = { page: number; y: number };
  const Q6_MAIN: Record<string, RtwBox> = {
    a_toe_nails:      { page: 1, y: 464 },  // page 2
    b_clips:          { page: 2, y:  62 },  // page 3
    c_single_wraps:   { page: 2, y: 154 },
    d_double_wraps:   { page: 2, y: 223 },
    e_structural:     { page: 2, y: 315 },
    f_other:          { page: 2, y: 326 },
    g_unknown:        { page: 2, y: 338 },
    h_not_installed:  { page: 2, y: 361 },  // I. Connection(s) not installed
  };
  const rtw = wm.roofToWallAttachment;
  if (rtw && Q6_MAIN[rtw]) {
    const m = Q6_MAIN[rtw]!;
    checkBox(out, m.page, 36, m.y);

    // A.Toenails sub-qualifier (A.1 / A.2 / A.3) — page 2, x=72
    if (rtw === "a_toe_nails" && wm.roofToWallAQualifier) {
      const A_SUB_Y: Record<string, number> = { a1: 476, a2: 499, a3: 522 };
      const y = A_SUB_Y[wm.roofToWallAQualifier];
      if (y !== undefined) checkBox(out, 1, 72, y);
    }

    // B/C/D minimal-condition sub-pickers — page 3, x=72
    // Each category has its own m1/m2/m3 rows.
    if (wm.roofToWallMinimalCondition) {
      const M_SUB_Y: Record<string, Record<string, number>> = {
        b_clips:        { m1:  85, m2:  96, m3: 120 },
        c_single_wraps: { m1: 165, m2: 189 },        // C only has 2 sub-options on form
        d_double_wraps: { m1: 234, m2: 269, m3: 292 },
      };
      const subs = M_SUB_Y[rtw];
      if (subs) {
        const y = subs[wm.roofToWallMinimalCondition];
        if (y !== undefined) checkBox(out, 2, 72, y);
      }
    }
  }

  // ── PAGE 3 — Q7 Roof Geometry ─────────────────────────────────────────
  const Q7_Y: Record<string, number> = {
    a_hip:   418,
    b_flat:  441,
    c_other: 464,
  };
  if (wm.roofGeometry && Q7_Y[wm.roofGeometry] !== undefined) {
    checkBox(out, 2, 36, Q7_Y[wm.roofGeometry]!);
  }
  // Perimeter/area blanks — Hip option needs total perimeter + non-hip
  // perimeter; Flat option needs flat area + total area.
  // These print on a 2nd-pass line under the geometry section. Positions
  // estimated; tune from a generated sample if needed.
  if (wm.roofGeometry === "a_hip") {
    push({ page: 2, x: 420, y: yFromTop(418), size: 9, value: wm.roofGeometryNonHipPerimeter });
    push({ page: 2, x: 420, y: yFromTop(430), size: 9, value: wm.roofGeometryTotalPerimeter });
  } else if (wm.roofGeometry === "b_flat") {
    push({ page: 2, x: 420, y: yFromTop(441), size: 9, value: wm.roofGeometryFlatAreaLt2_12 });
    push({ page: 2, x: 420, y: yFromTop(453), size: 9, value: wm.roofGeometryTotalArea });
  }

  // ── PAGE 3 — Q8 Sealed Roof Deck (SWR) ────────────────────────────────
  const Q8_Y: Record<string, number> = {
    a_yes:     522,  // A. Sealed Roof Deck
    b_no:      625,  // B. No SWR
    c_unknown: 637,  // C. Unknown
  };
  if (wm.secondaryWaterResistance && Q8_Y[wm.secondaryWaterResistance] !== undefined) {
    checkBox(out, 2, 36, Q8_Y[wm.secondaryWaterResistance]!);
  }
  // Sub-method only applies under A.
  if (wm.secondaryWaterResistance === "a_yes" && wm.swrSubMethod) {
    const SWR_SUB_Y: Record<string, number> = {
      m1_astm_d1970:  533,
      m2_taped_seams: 545,
      m3_double_layer: 579,
      m4_spray_foam:  602,
    };
    const y = SWR_SUB_Y[wm.swrSubMethod];
    if (y !== undefined) checkBox(out, 2, 72, y);
    // "entire roof deck underside covered" — sub-checkbox under m4_spray_foam
    if (wm.swrSubMethod === "m4_spray_foam" && wm.swrEntireDeckCovered) {
      checkBox(out, 2, 108, 614);
    }
  }

  // ── PAGE 4 — Q9a Opening Protection Level Chart ───────────────────────
  // 6 columns × 8 rows. The inspector marks an "X" in each row that
  // applies for each opening type column. We render the picked level
  // for each column as an X in that row's cell.
  //
  // Column centers (x positions for centered "X"):
  const Q9A_COL_X: Record<string, number> = {
    windowsOrEntryDoorsGlazed: 305, // Windows or Entry Doors (glazed)
    garageDoorsGlazed:         355, // Garage Doors (glazed)
    skylightsGlazed:           405, // Skylights
    glassBlockGlazed:          455, // Glass Block
    entryDoorsNonGlazed:       505, // Entry Doors (non-glazed)
    garageDoorsNonGlazed:      555, // Garage Doors (non-glazed)
  };
  // Row label y positions (top-down) — baseline of the level letter.
  const Q9A_ROW_Y: Record<string, number> = {
    na: 178,  // N/A
    a:  204,
    b:  229,
    c:  252,
    d:  281,  // non-glazed only on form
    n:  311,
    x:  343,
    z:  364,
  };
  const chart = wm.openingProtectionChart ?? {};
  for (const [colKey, level] of Object.entries(chart)) {
    if (typeof level !== "string") continue;
    const colX = Q9A_COL_X[colKey];
    const rowY = Q9A_ROW_Y[level];
    if (colX !== undefined && rowY !== undefined) {
      out.push({
        page: 3,
        x: colX,
        y: yFromTop(rowY),
        size: 11,
        value: "X",
        bold: true,
      });
    }
  }

  // ── PAGE 4-5 — Q9b Secondary Classification ───────────────────────────
  // Primary picker (A/B/C/N/X/Z) + per-primary sub picker (a1..3, b1..3, c1..3, n1..3).
  type Q9bBox = { page: number; y: number };
  const Q9B_PRIMARY: Record<string, Q9bBox> = {
    a: { page: 3, y: 403 },  // page 4
    b: { page: 3, y: 592 },
    c: { page: 4, y:  94 },  // page 5
    n: { page: 4, y: 184 },
    x: { page: 4, y: 273 },
    z: { page: 4, y: 308 },
  };
  if (wm.q9bPrimary && Q9B_PRIMARY[wm.q9bPrimary]) {
    const p = Q9B_PRIMARY[wm.q9bPrimary]!;
    checkBox(out, p.page, 36, p.y);
  }
  // A sub (A.1/A.2/A.3) — all on page 4, x=66
  if (wm.q9bPrimary === "a" && wm.q9bSubA) {
    const A_SUB_Y: Record<string, number> = { a1: 537, a2: 549, a3: 571 };
    const y = A_SUB_Y[wm.q9bSubA];
    if (y !== undefined) checkBox(out, 3, 66, y);
  }
  // B sub (B.1 on p4, B.2/B.3 on p5)
  if (wm.q9bPrimary === "b" && wm.q9bSubB) {
    const B_SUB: Record<string, { page: number; y: number }> = {
      b1: { page: 3, y: 693 },
      b2: { page: 4, y:  50 },
      b3: { page: 4, y:  72 },
    };
    const b = B_SUB[wm.q9bSubB];
    if (b) checkBox(out, b.page, 66, b.y);
  }
  // C sub — all on page 5, x=84
  if (wm.q9bPrimary === "c" && wm.q9bSubC) {
    const C_SUB_Y: Record<string, number> = { c1: 129, c2: 140, c3: 162 };
    const y = C_SUB_Y[wm.q9bSubC];
    if (y !== undefined) checkBox(out, 4, 84, y);
  }
  // N sub — all on page 5, x=84
  if (wm.q9bPrimary === "n" && wm.q9bSubN) {
    const N_SUB_Y: Record<string, number> = { n1: 218, n2: 230, n3: 252 };
    const y = N_SUB_Y[wm.q9bSubN];
    if (y !== undefined) checkBox(out, 4, 84, y);
  }

  // ── PAGE 5 — Qualified Inspector certification ────────────────────────
  // Row 1 (y=380): Qualified Inspector Name | License Type | License or Cert #
  // Row 2 (y=399): Inspection Company | Phone
  const inspectorName = inspection.inspectorName ?? "";
  const licenseType = (inspection as any).inspectorLicenseType as string | undefined;
  const company = (inspection as any).inspectorCompany as string | undefined;
  const phone = (inspection as any).inspectorPhone as string | undefined;
  const licenseNum = inspection.inspectorLicense ?? "";

  // Labels at y=380-391 top-down; baseline ≈ 391 (yMax). Use yMax for value baselines.
  push({ page: 4, x: 130, y: yFromTop(391), size: 9, value: inspectorName });
  push({ page: 4, x: 270, y: yFromTop(391), size: 9, value: licenseTypeLabelShort(licenseType) });
  push({ page: 4, x: 482, y: yFromTop(391), size: 9, value: licenseNum });
  push({ page: 4, x: 114, y: yFromTop(410), size: 9, value: company });
  push({ page: 4, x: 426, y: yFromTop(410), size: 9, value: phone });

  // "I hold an active license as a:" — six radio-style checkboxes on page 5
  const LICENSE_TYPE_Y: Record<string, number> = {
    home_inspector:            446,
    building_code_inspector:   467,
    contractor:                479,
    engineer:                  490,
    architect:                 502,
    other_authorized:          513,
  };
  if (licenseType && LICENSE_TYPE_Y[licenseType] !== undefined) {
    checkBox(out, 4, 36, LICENSE_TYPE_Y[licenseType]!);
  }

  // ── PAGE 6 — "I, <print name>" + Signature Date ──────────────────────
  // "I, ____________, am a qualified inspector" — label baseline at top-down y≈134.
  push({ page: 5, x: 60, y: yFromTop(134), size: 9, value: inspectorName });
  // Inspector signature date — label "Date:" yMin=189 yMax=203, x ~380.
  const dateStr = (inspection.inspectedOn ?? new Date().toISOString()).slice(0, 10);
  push({ page: 5, x: 380, y: yFromTop(200), size: 9, value: dateStr });
  // Homeowner date — label "Date:" on the homeowner row (top-down y≈332).
  if (inspection.homeownerSignedAt) {
    push({
      page: 5,
      x: 380,
      y: yFromTop(343),
      size: 9,
      value: inspection.homeownerSignedAt.slice(0, 10),
    });
  }

  // ── Per-page footers (Inspectors Initials + Property Address × 6) ─────
  // Footer label bbox: yMin=712, yMax=725. Label baseline ≈ yMax - 2 = 723.
  // X positions:
  //   "Inspectors Initials" label ends at x=113; underscores 115-171, so
  //     the initials sit at x≈122 (inside the underscore range).
  //   "Property" word ends at x=211, "Address" word starts at x=214 and
  //     itself is ~50pt wide (text "Address"), so the address value must
  //     start at x ≈ 270 to clear the label.
  const fullAddr = fmtAddress(inspection);
  const initials = initialsOf(inspection.inspectorName);
  for (let p = 0; p < 6; p++) {
    push({ page: p, x: 122, y: yFromTop(723), value: initials });
    push({ page: p, x: 270, y: yFromTop(723), value: fullAddr });
  }

  // TODO(v3): Q9a Opening Protection chart cells (6 rows × 7 columns —
  // label-letter fills like "A"/"B"/"C"/"D"/"N"/"X"/"Z" rather than
  // glyph checkboxes; needs separate position table).

  return out;
}

/** Short label for the inspector license-type enum, printed in the
 *  "License Type:" blank on page 5 row 1. */
function licenseTypeLabelShort(v: string | undefined): string {
  switch (v) {
    case "home_inspector": return "Home Inspector";
    case "building_code_inspector": return "Bldg Code Insp.";
    case "contractor": return "Contractor";
    case "engineer": return "Professional Eng.";
    case "architect": return "Professional Arch.";
    case "other_authorized": return "Other";
    default: return "";
  }
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

/**
 * Decode a "data:image/png;base64,…" URI into raw PNG bytes for pdf-lib.
 * Returns null if the URI is missing, malformed, or not a PNG.
 */
function decodePngDataUri(uri: string | undefined | null): Uint8Array | null {
  if (!uri) return null;
  const m = uri.match(/^data:image\/png;base64,(.+)$/);
  if (!m) return null;
  try {
    const bin = atob(m[1]!);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Embed the inspector + homeowner signature images on page 6 over the
 * "Qualified Inspector Signature: ___" and "Signature: ___" lines.
 *
 * The lines run from x≈208 to x≈340 on the inspector row (top-down
 * y≈189-203) and from x≈122 to x≈300 on the homeowner row
 * (top-down y≈332-348). We scale signatures to fit within those boxes
 * and anchor them above the line (signed-into-the-line look).
 */
async function embedSignatures(doc: PDFDocument, inspection: Inspection) {
  const page = doc.getPages()[5];
  if (!page) return;

  // Inspector signature box on page 6 — top-down coords from the form.
  const INSPECTOR_BOX = { xLeft: 208, xRight: 340, yTop: 175, yBottom: 200 };
  // Homeowner signature box.
  const HOMEOWNER_BOX = { xLeft: 122, xRight: 300, yTop: 318, yBottom: 345 };

  const drawSig = async (dataUri: string, box: typeof INSPECTOR_BOX) => {
    const bytes = decodePngDataUri(dataUri);
    if (!bytes) return;
    const img = await doc.embedPng(bytes);
    const boxW = box.xRight - box.xLeft;
    const boxH = box.yBottom - box.yTop;
    const scale = Math.min(boxW / img.width, boxH / img.height);
    const drawnW = img.width * scale;
    const drawnH = img.height * scale;
    // Center inside the box.
    const x = box.xLeft + (boxW - drawnW) / 2;
    // pdf-lib y is bottom-up; we know the box top in top-down coords.
    // bottom-left of drawn image in pdf-lib coords:
    const y = (792 - box.yBottom) + (boxH - drawnH) / 2;
    page.drawImage(img, { x, y, width: drawnW, height: drawnH });
  };

  if (inspection.inspectorSignaturePng) {
    try { await drawSig(inspection.inspectorSignaturePng, INSPECTOR_BOX); }
    catch (err) { console.warn("[pdf] inspector sig embed failed", err); }
  }
  if (inspection.homeownerSignaturePng) {
    try { await drawSig(inspection.homeownerSignaturePng, HOMEOWNER_BOX); }
    catch (err) { console.warn("[pdf] homeowner sig embed failed", err); }
  }
}

export async function fillWindMit(inspection: Inspection): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pages = doc.getPages();
  const fields = fieldsFor(inspection);
  drawAll(pages, font, fontBold, fields);

  // Embed PNG signature images on top of the printed signature lines.
  await embedSignatures(doc, inspection);

  return await doc.save();
}
