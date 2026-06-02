/**
 * UI rendering metadata for the 4-point and wind-mit forms.
 *
 * Mirrors the Zod schemas in `@inspect-ai/shared/forms/*` — kept here (rather
 * than derived from Zod) for explicit control over labels, ordering,
 * and field types.
 *
 * If you add/change a Zod field, update this too.
 */

export type EnumOption = { value: string; label: string };

/**
 * Render this field only when the value at `path` equals one of the
 * `equals` values. Used to surface sub-questions after a main
 * category is picked (Q6 Roof-to-Wall, etc.).
 */
export type ShowIf = { path: string; equals: string | string[] };

type Base = { showIf?: ShowIf };
export type FieldMeta =
  | (Base & { kind: "string"; path: string; label: string; placeholder?: string })
  | (Base & { kind: "integer"; path: string; label: string; min?: number; max?: number })
  | (Base & { kind: "boolean"; path: string; label: string })
  | (Base & { kind: "enum"; path: string; label: string; options: EnumOption[] });

/** Helper used by FormEditor to decide whether to render a field. */
export function isFieldVisible(
  field: { showIf?: ShowIf },
  state: Record<string, unknown>,
  getAt: (obj: any, path: string) => unknown,
): boolean {
  const cond = field.showIf;
  if (!cond) return true;
  const v = getAt(state, cond.path);
  const target = Array.isArray(cond.equals) ? cond.equals : [cond.equals];
  return typeof v === "string" && target.includes(v);
}

export type SectionMeta = {
  title: string;
  fields: FieldMeta[];
};

const enumOptions = (codes: string[]): EnumOption[] =>
  codes.map((v) => ({ value: v, label: prettyLabel(v) }));

function prettyLabel(v: string): string {
  // strip leading enum prefix like "a_", "wm.", etc.
  return v
    .replace(/^[a-z]_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export const FOUR_POINT_SECTIONS: SectionMeta[] = [
  {
    title: "Roof",
    fields: [
      {
        kind: "enum", path: "roof.coveringType", label: "Covering",
        options: enumOptions([
          "asphalt_shingle", "metal", "tile", "built_up", "membrane", "wood_shake", "other",
        ]),
      },
      { kind: "integer", path: "roof.ageYears", label: "Age (years)", min: 0, max: 200 },
      { kind: "integer", path: "roof.remainingLifeYears", label: "Remaining life (years)", min: 0, max: 100 },
      {
        kind: "enum", path: "roof.condition", label: "Condition",
        options: enumOptions(["good", "fair", "poor"]),
      },
      { kind: "boolean", path: "roof.visibleDamage", label: "Visible damage" },
      { kind: "string", path: "roof.notes", label: "Notes", placeholder: "Optional" },
    ],
  },
  {
    title: "Electrical",
    fields: [
      { kind: "string", path: "electrical.panelBrand", label: "Panel brand", placeholder: "Square D, Eaton, ..." },
      { kind: "integer", path: "electrical.panelAmps", label: "Panel amperage", min: 0, max: 1000 },
      {
        kind: "enum", path: "electrical.wiringType", label: "Wiring",
        options: enumOptions(["copper_romex", "aluminum", "knob_tube", "mixed", "other"]),
      },
      { kind: "boolean", path: "electrical.hazardsPresent", label: "Hazards present" },
      { kind: "string", path: "electrical.hazardsDescription", label: "Hazards description", placeholder: "If hazards present" },
      { kind: "boolean", path: "electrical.gfciPresent", label: "GFCI present" },
    ],
  },
  {
    title: "Plumbing",
    fields: [
      {
        kind: "enum", path: "plumbing.supplyMaterial", label: "Supply material",
        options: enumOptions(["copper", "cpvc", "pex", "polybutylene", "galvanized", "mixed"]),
      },
      {
        kind: "enum", path: "plumbing.drainMaterial", label: "Drain material",
        options: enumOptions(["pvc", "cast_iron", "abs", "mixed"]),
      },
      { kind: "integer", path: "plumbing.waterHeaterAgeYears", label: "Water heater age (years)", min: 0, max: 100 },
      { kind: "boolean", path: "plumbing.leaksObserved", label: "Leaks observed" },
      { kind: "string", path: "plumbing.notes", label: "Notes", placeholder: "Optional" },
    ],
  },
  {
    title: "HVAC",
    fields: [
      {
        kind: "enum", path: "hvac.systemType", label: "System type",
        options: enumOptions(["central_ac", "heat_pump", "window_units", "mini_split", "other"]),
      },
      { kind: "integer", path: "hvac.ageYears", label: "Age (years)", min: 0, max: 100 },
      {
        kind: "enum", path: "hvac.condition", label: "Condition",
        options: enumOptions(["good", "fair", "poor"]),
      },
      { kind: "string", path: "hvac.notes", label: "Notes", placeholder: "Optional" },
    ],
  },
];

export const WIND_MIT_SECTIONS: SectionMeta[] = [
  {
    title: "NOTE (FORTIFIED Home certificate)",
    fields: [
      {
        kind: "enum", path: "fortifiedHome", label: "FORTIFIED certificate",
        options: [
          { value: "none", label: "None / Not FORTIFIED" },
          { value: "roof", label: "FORTIFIED Roof" },
          { value: "silver", label: "FORTIFIED Silver" },
          { value: "gold", label: "FORTIFIED Gold" },
        ],
      },
    ],
  },
  {
    title: "1. Building Code",
    fields: [
      {
        kind: "enum", path: "buildingCode", label: "Code path",
        options: [
          { value: "a_fbc_2001_2004",   label: "A. FBC 2001 & 2004 (built 2002–2006)" },
          { value: "b_fbc_2007_later",  label: "B. FBC 2007 and later (built 2007+)" },
          { value: "c_hvhz_sfbc_94",    label: "C. HVHZ only — SFBC-94 (built 1994–2001)" },
          { value: "d_unknown",         label: "D. Unknown or doesn't meet A/B/C" },
        ],
      },
      { kind: "integer", path: "yearOfHomeOriginalConstruction", label: "Year of original construction", min: 1800, max: 2100 },
      { kind: "string", path: "buildingPermitDate", label: "Building permit application date (MM/DD/YYYY)", placeholder: "e.g. 06/15/2010" },
    ],
  },
  {
    title: "2. Region (ASCE 7-22 windspeed)",
    fields: [
      {
        kind: "enum", path: "region", label: "Region",
        options: [
          { value: "hvhz",     label: "HVHZ (Miami-Dade / Broward)" },
          { value: "region_1", label: "Region 1 (≥ 140 mph)" },
          { value: "region_2", label: "Region 2 (130–139 mph)" },
          { value: "region_3", label: "Region 3 (< 130 mph)" },
        ],
      },
    ],
  },
  {
    title: "3. Roof Slope",
    fields: [
      {
        kind: "enum", path: "roofSlope", label: "Predominant slope",
        options: [
          { value: "ge_6_12", label: "Greater than or equal to 6:12" },
          { value: "lt_6_12", label: "Less than 6:12" },
        ],
      },
    ],
  },
  {
    title: "4. Roof Covering",
    fields: [
      {
        kind: "enum", path: "roofCovering.type", label: "Type",
        options: enumOptions([
          "asphalt_fiberglass_shingle", "concrete_clay_tile", "metal",
          "built_up", "membrane", "wood_shake", "other",
        ]),
      },
      // Per-type compliance columns. Inspector fills whichever applies.
      { kind: "string", path: "roofCovering.permitApplicationDate", label: "Permit application date (MM/DD/YYYY)", placeholder: "e.g. 06/15/2010" },
      { kind: "string", path: "roofCovering.productApprovalNumber", label: "FBC or MDC product approval #", placeholder: "e.g. FL12345-R1" },
      { kind: "string", path: "roofCovering.yearOfOriginalInstallation", label: "Year of original installation/replacement", placeholder: "YYYY" },
      { kind: "boolean", path: "roofCovering.noInformationProvided", label: "No information provided for compliance" },
      {
        kind: "enum", path: "roofCovering.meetsCode", label: "Overall compliance",
        options: [
          { value: "a_compliant", label: "A. Compliant" },
          { value: "b_non_compliant", label: "B. Non-compliant" },
          { value: "c_unknown", label: "C. Unknown" },
        ],
      },
    ],
  },
  {
    title: "5. Roof Deck Attachment",
    fields: [
      {
        kind: "enum", path: "roofDeckAttachment", label: "Attachment",
        options: [
          { value: "a_plywood_osb_6d_nails_6_12", label: "A. Plywood/OSB, 6d, 6\"/12\"" },
          { value: "b_plywood_osb_8d_nails_6_12", label: "B. Plywood/OSB, 8d, 6\"/12\"" },
          { value: "c_plywood_osb_8d_nails_6_6", label: "C. Plywood/OSB, 8d, 6\"/6\"" },
          { value: "d_reinforced_concrete", label: "D. Reinforced concrete" },
          { value: "e_other", label: "E. Other" },
          { value: "f_unknown", label: "F. Unknown" },
        ],
      },
    ],
  },
  {
    title: "6. Roof-to-Wall Attachment",
    fields: [
      {
        kind: "enum", path: "roofToWallAttachment", label: "WEAKEST connection",
        options: [
          { value: "a_toe_nails",     label: "A. Toenails" },
          { value: "b_clips",         label: "B. Clips" },
          { value: "c_single_wraps",  label: "C. Single wraps" },
          { value: "d_double_wraps",  label: "D. Double wraps" },
          { value: "e_structural",    label: "E. Structural (anchor bolts to concrete)" },
          { value: "f_other",         label: "F. Other" },
          { value: "g_unknown",       label: "G. Unknown or unidentified" },
          { value: "h_not_installed", label: "H. Connection(s) not installed as intended" },
        ],
      },
      // ── A. Toenails qualifying condition (shows only if A picked) ─────
      {
        kind: "enum", path: "roofToWallAQualifier", label: "A. Toenails — qualifying condition",
        showIf: { path: "roofToWallAttachment", equals: "a_toe_nails" },
        options: [
          { value: "a1", label: "A1. Anchored to top plate w/ nails at angle through truss" },
          { value: "a2", label: "A2. Metal connectors/fasteners not meeting B/C/D requirements" },
          { value: "a3", label: "A3. Other documented method ≥ 185 lbs uplift" },
        ],
      },
      // ── B/C/D minimal conditions (shared 1/2/3 set) ───────────────────
      {
        kind: "enum", path: "roofToWallMinimalCondition", label: "B/C/D minimal condition",
        showIf: { path: "roofToWallAttachment", equals: ["b_clips", "c_single_wraps", "d_double_wraps"] },
        options: [
          { value: "m1", label: "1. ≥ 3 nails to truss/rafter, attached to top plate, ≤ ½\" gap, no corrosion" },
          { value: "m2", label: "2. Single strap wrapping over truss/rafter, ≥ 3 nails each side, no corrosion" },
          { value: "m3", label: "3. Purpose-made connectors/fasteners per manufacturer spec" },
        ],
      },
    ],
  },
  {
    title: "7. Roof Geometry",
    fields: [
      {
        kind: "enum", path: "roofGeometry", label: "Roof shape",
        options: [
          { value: "a_hip",   label: "A. Hip Roof" },
          { value: "b_flat",  label: "B. Flat Roof (5+ unit bldg, ≥90% area < 2:12)" },
          { value: "c_other", label: "C. Other (gable, etc.)" },
        ],
      },
      // A. Hip needs the perimeter lengths
      {
        kind: "integer", path: "roofGeometryNonHipPerimeter",
        label: "Total length of non-hip features (feet)",
        showIf: { path: "roofGeometry", equals: "a_hip" },
        min: 0,
      },
      {
        kind: "integer", path: "roofGeometryTotalPerimeter",
        label: "Total length of roof system perimeter (feet)",
        showIf: { path: "roofGeometry", equals: "a_hip" },
        min: 0,
      },
      // B. Flat needs the areas
      {
        kind: "integer", path: "roofGeometryFlatAreaLt2_12",
        label: "Roof area with slope < 2:12 (sq ft)",
        showIf: { path: "roofGeometry", equals: "b_flat" },
        min: 0,
      },
      {
        kind: "integer", path: "roofGeometryTotalArea",
        label: "Total roof area (sq ft)",
        showIf: { path: "roofGeometry", equals: "b_flat" },
        min: 0,
      },
    ],
  },
  {
    title: "8. Sealed Roof Deck / Secondary Water Resistance",
    fields: [
      {
        kind: "enum", path: "secondaryWaterResistance", label: "Sealed Roof Deck",
        options: [
          { value: "a_yes",     label: "A. Sealed Roof Deck (SWR)" },
          { value: "b_no",      label: "B. No sealed roof deck" },
          { value: "c_unknown", label: "C. Unknown or undetermined" },
        ],
      },
      // A. Sealed Roof Deck → which qualifying method
      {
        kind: "enum", path: "swrSubMethod", label: "A. Qualifying method",
        showIf: { path: "secondaryWaterResistance", equals: "a_yes" },
        options: [
          { value: "m1_astm_d1970",   label: "1. ASTM D1970 polymer-modified bitumen (fully adhered)" },
          { value: "m2_taped_seams",  label: "2. Tape over roof deck seams (≥ 3.75″ self-adhering)" },
          { value: "m3_double_layer", label: "3. Double layer of felt or synthetic, no tape" },
          { value: "m4_spray_foam",   label: "4. Spray foam along rafter/deck intersections" },
        ],
      },
      {
        kind: "boolean", path: "swrEntireDeckCovered",
        label: "Entire roof deck underside covered",
        showIf: { path: "secondaryWaterResistance", equals: "a_yes" },
      },
    ],
  },
  {
    title: "9. Opening Protection",
    fields: [
      {
        kind: "enum", path: "openingProtection", label: "Protection",
        options: [
          { value: "a_hurricane_impact", label: "A. Hurricane impact" },
          { value: "b_basic_impact", label: "B. Basic impact" },
          { value: "c_none", label: "C. None" },
          { value: "n_other", label: "N. Other" },
          { value: "x_unknown", label: "X. Unknown" },
        ],
      },
      { kind: "string", path: "notes", label: "Notes", placeholder: "Optional" },
    ],
  },
];
