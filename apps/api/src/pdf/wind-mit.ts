/**
 * Fill the official Florida OIR-B1-1802 (Uniform Mitigation Verification
 * Inspection Form, Rev. 01/12) AcroForm with values from an Inspection.
 *
 * Field names come from `pdf-lib`'s introspection of the official template
 * (see scripts/inspect-pdf-fields.mjs for the inventory). The mapping
 * tables below are the single source of truth.
 *
 * Strategy:
 *   - Load the template once (cached for warm Edge invocations).
 *   - Walk every Zod field on `inspection.windMit` and call the right
 *     pdf-lib setter (setText / check).
 *   - Stamp the address footer on every page (the form has 4 instances
 *     of "Property Address" and "Inspectors Initials" — one per page).
 *   - Flatten so the values are baked in and the file is read-only.
 *
 * Returns a Uint8Array ready to ship as `application/pdf`.
 */
import { PDFCheckBox, PDFDocument, PDFTextField } from "pdf-lib";
import type { Inspection } from "@inspect-ai/shared";
import { OIR_B1_1802_BASE64 } from "./oir-b1-1802.base64.js";

// ─── Field name maps (PDF field → our enum) ────────────────────────────────

const BUILDING_CODE: Record<string, string> = {
  a_built_2002_or_later_fbc: "1.A",
  b_built_1994_2001_sfbc: "1.B",
  c_unknown_or_not_meeting: "1.C",
};

/** Roof covering type → 2.1(N) checkbox. */
const ROOF_COVERING_TYPE: Record<string, string> = {
  asphalt_fiberglass_shingle: "2.1(1)",
  concrete_clay_tile: "2.1(2)",
  metal: "2.1(3)",
  built_up: "2.1(4)",
  membrane: "2.1(5)",
  wood_shake: "2.1(6)",
  other: "2.1(6)",
};

/** Roof covering compliance → 2.A/B/C/D checkbox. */
const ROOF_COVERING_MEETS_CODE: Record<string, string> = {
  a_compliant: "2.A",
  // We don't distinguish HVHZ-only (2.B) in the simplified schema; map
  // non-compliant to 2.C (the modern non-compliant box).
  b_non_compliant: "2.C",
  c_unknown: "2.D",
};

const ROOF_DECK: Record<string, string> = {
  a_plywood_osb_6d_nails_6_12: "3.A",
  b_plywood_osb_8d_nails_6_12: "3.B",
  c_plywood_osb_8d_nails_6_6: "3.C",
  d_reinforced_concrete: "3.D",
  e_other: "3.E",
  f_unknown: "3.F",
};

const ROOF_TO_WALL: Record<string, string> = {
  a_toe_nails: "4.A",
  b_clips: "4.B",
  c_single_wraps: "4.C",
  d_double_wraps: "4.D",
  e_structural: "4.E",
  f_other: "4.F",
  g_unknown: "4.G",
};

const ROOF_GEOMETRY: Record<string, string> = {
  a_hip: "5.A",
  b_flat: "5.B",
  c_other: "5.C",
};

const SWR: Record<string, string> = {
  a_yes: "6.A",
  b_no: "6.B",
  c_unknown: "6.C",
};

const OPENING_PROTECTION: Record<string, string> = {
  a_hurricane_impact: "7.A",
  b_basic_impact: "7.B",
  c_none: "7.C",
  n_other: "N",
  x_unknown: "X",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

let cachedBytes: Uint8Array | null = null;
function templateBytes(): Uint8Array {
  if (cachedBytes) return cachedBytes;
  // Inline base64 → bytes via Web APIs (works in Edge + Node).
  const bin = atob(OIR_B1_1802_BASE64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  cachedBytes = out;
  return out;
}

/** Safely set a TextField — no-op if the field doesn't exist or value empty. */
function setText(form: ReturnType<PDFDocument["getForm"]>, name: string, value: unknown) {
  if (value === undefined || value === null) return;
  const str = String(value).trim();
  if (!str) return;
  try {
    const f = form.getField(name);
    if (f instanceof PDFTextField) f.setText(str);
  } catch {
    // Field not found — silently ignore; the form revs occasionally and
    // we don't want a missing field to break the whole PDF.
  }
}

/** Check a CheckBox by name. No-op if missing. */
function check(form: ReturnType<PDFDocument["getForm"]>, name: string) {
  try {
    const f = form.getField(name);
    if (f instanceof PDFCheckBox) f.check();
  } catch {
    // ignore
  }
}

/** Compute "JS"-style initials from a name ("Jane Smith" → "JS"). */
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

// ─── Main fill routine ────────────────────────────────────────────────────

export async function fillWindMit(inspection: Inspection): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes());
  const form = doc.getForm();
  const wm: any = inspection.windMit ?? {};
  const property: any = inspection.property ?? {};

  // ── Owner / address header ──────────────────────────────────────────────
  setText(form, "Inspection Date", inspection.inspectedOn?.slice(0, 10));
  setText(form, "Owner Name", property.ownerName);
  setText(form, "Address", inspection.address.line1);
  setText(form, "City", inspection.address.city);
  setText(form, "County", property.county);
  setText(form, "Zip", inspection.address.zip);
  setText(form, "Year of Home", property.yearBuilt);

  // ── Customer / owner contact ───────────────────────────────────────────
  setText(form, "Email", inspection.ownerEmail);
  // OIR-B1-1802 has Home / Work / Cell phone fields. We capture one
  // generic phone on mobile and stamp it as "Home Phone".
  setText(form, "Home Phone", inspection.ownerPhone);

  // ── Inspector ──────────────────────────────────────────────────────────
  setText(form, "Qualified Inspector Name", inspection.inspectorName);
  setText(form, "License or Certificate", inspection.inspectorLicense);

  // ── Page-by-page footers (the form repeats these on each of 4 pages) ──
  const fullAddr = fmtAddress(inspection);
  const initials = initialsOf(inspection.inspectorName);
  for (const i of ["", "_2", "_3", "_4"]) {
    setText(form, `Property Address${i}`, fullAddr);
    setText(form, `Inspectors Initials${i}`, initials);
  }

  // ── Q1. Building Code ──────────────────────────────────────────────────
  const bc = BUILDING_CODE[wm.buildingCode];
  if (bc) check(form, bc);
  setText(form, "1.A Year Built", wm.yearOfHomeOriginalConstruction);

  // ── Q2. Roof Covering ──────────────────────────────────────────────────
  const rcType = ROOF_COVERING_TYPE[wm.roofCovering?.type];
  if (rcType) check(form, rcType);
  const rcMeets = ROOF_COVERING_MEETS_CODE[wm.roofCovering?.meetsCode];
  if (rcMeets) check(form, rcMeets);

  // ── Q3. Roof Deck Attachment ───────────────────────────────────────────
  const deck = ROOF_DECK[wm.roofDeckAttachment];
  if (deck) check(form, deck);

  // ── Q4. Roof-to-Wall Attachment ────────────────────────────────────────
  const r2w = ROOF_TO_WALL[wm.roofToWallAttachment];
  if (r2w) check(form, r2w);

  // ── Q5. Roof Geometry ──────────────────────────────────────────────────
  const geo = ROOF_GEOMETRY[wm.roofGeometry];
  if (geo) check(form, geo);

  // ── Q6. Secondary Water Resistance ─────────────────────────────────────
  const swr = SWR[wm.secondaryWaterResistance];
  if (swr) check(form, swr);

  // ── Q7. Opening Protection ─────────────────────────────────────────────
  const op = OPENING_PROTECTION[wm.openingProtection];
  if (op) check(form, op);

  // Flatten so the values are baked in — the inspector's read-only signed
  // copy. They can sign separately offline by printing.
  form.flatten();

  return await doc.save();
}
