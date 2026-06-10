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
  // 1. Electrical
  {
    title: "Electrical System",
    fields: [
      { kind: "string", path: "electrical.panelBrand", label: "Main panel brand", placeholder: "Square D, Eaton, …" },
      { kind: "integer", path: "electrical.panelAmps", label: "Total system amps", min: 0, max: 1000 },
      {
        kind: "enum", path: "electrical.wiringType", label: "Predominant wiring",
        options: enumOptions(["copper_romex", "aluminum", "knob_tube", "mixed", "other"]),
      },
      { kind: "boolean", path: "electrical.hazardsPresent", label: "Hazards present" },
      { kind: "string", path: "electrical.hazardsDescription", label: "Hazards description", placeholder: "If hazards present" },
      { kind: "boolean", path: "electrical.gfciPresent", label: "GFCI present" },
      { kind: "boolean", path: "electrical.inGoodWorkingOrder", label: "In good working order" },
      { kind: "string", path: "electrical.notes", label: "Notes", placeholder: "Optional" },
    ],
  },
  // 2. HVAC
  {
    title: "HVAC System",
    fields: [
      {
        kind: "enum", path: "hvac.systemType", label: "System type",
        options: enumOptions(["central_ac", "heat_pump", "window_units", "mini_split", "other"]),
      },
      { kind: "integer", path: "hvac.ageYears", label: "Age of system (years)", min: 0, max: 100 },
      { kind: "integer", path: "hvac.yearLastUpdated", label: "Year last updated", min: 1900, max: 2100 },
      {
        kind: "enum", path: "hvac.condition", label: "Condition",
        options: enumOptions(["good", "fair", "poor"]),
      },
      { kind: "boolean", path: "hvac.hazardsPresent", label: "Hazards present" },
      { kind: "boolean", path: "hvac.inGoodWorkingOrder", label: "In good working order" },
      { kind: "string", path: "hvac.notes", label: "Notes", placeholder: "Optional" },
    ],
  },
  // 3. Plumbing
  {
    title: "Plumbing System",
    fields: [
      { kind: "integer", path: "plumbing.ageYears", label: "Age of system (years)", min: 0, max: 100 },
      { kind: "integer", path: "plumbing.yearLastUpdated", label: "Year last updated", min: 1900, max: 2100 },
      {
        kind: "enum", path: "plumbing.supplyMaterial", label: "Supply material",
        options: enumOptions(["copper", "cpvc", "pex", "polybutylene", "galvanized", "mixed"]),
      },
      {
        kind: "enum", path: "plumbing.drainMaterial", label: "Drain material",
        options: enumOptions(["pvc", "cast_iron", "abs", "mixed"]),
      },
      { kind: "integer", path: "plumbing.waterHeaterAgeYears", label: "Water heater age (years)", min: 0, max: 100 },
      { kind: "boolean", path: "plumbing.inGoodWorkingOrder", label: "In good working order" },
      { kind: "boolean", path: "plumbing.leaksObserved", label: "Active leaks observed" },
      { kind: "string", path: "plumbing.notes", label: "Notes", placeholder: "Optional" },
    ],
  },
  // 4. Roof — Predominant covering
  {
    title: "Roof — Predominant covering",
    fields: [
      {
        kind: "enum", path: "roof.predominant.coveringMaterial", label: "Covering material",
        options: enumOptions([
          "asphalt_shingle", "metal", "tile", "built_up", "membrane", "wood_shake", "other",
        ]),
      },
      { kind: "integer", path: "roof.predominant.ageYears", label: "Roof age (years)", min: 0, max: 200 },
      { kind: "integer", path: "roof.predominant.remainingLifeYears", label: "Remaining useful life (years)", min: 0, max: 100 },
      { kind: "string", path: "roof.predominant.lastPermitDate", label: "Date of last roofing permit", placeholder: "MM/DD/YYYY" },
      { kind: "string", path: "roof.predominant.lastUpdateDate", label: "Date of last update", placeholder: "MM/DD/YYYY" },
      {
        kind: "enum", path: "roof.predominant.updateExtent", label: "If updated",
        options: enumOptions(["full_replacement", "partial_replacement"]),
      },
      {
        kind: "integer", path: "roof.predominant.updatePercent", label: "% of replacement", min: 0, max: 100,
        showIf: { path: "roof.predominant.updateExtent", equals: "partial_replacement" },
      },
      {
        kind: "enum", path: "roof.predominant.condition", label: "Overall condition",
        options: enumOptions(["satisfactory", "unsatisfactory"]),
      },
      { kind: "boolean", path: "roof.predominant.visibleDamage", label: "Visible damage / deterioration" },
      { kind: "boolean", path: "roof.predominant.visibleLeaks", label: "Visible signs of leaks" },
    ],
  },
  // 4b. Roof — Secondary covering (optional)
  {
    title: "Roof — Secondary covering (optional)",
    fields: [
      {
        kind: "enum", path: "roof.secondary.coveringMaterial", label: "Covering material",
        options: enumOptions([
          "asphalt_shingle", "metal", "tile", "built_up", "membrane", "wood_shake", "other",
        ]),
      },
      { kind: "integer", path: "roof.secondary.ageYears", label: "Roof age (years)", min: 0, max: 200 },
      { kind: "integer", path: "roof.secondary.remainingLifeYears", label: "Remaining useful life (years)", min: 0, max: 100 },
      { kind: "string", path: "roof.secondary.lastPermitDate", label: "Date of last roofing permit", placeholder: "MM/DD/YYYY" },
      { kind: "string", path: "roof.secondary.lastUpdateDate", label: "Date of last update", placeholder: "MM/DD/YYYY" },
      {
        kind: "enum", path: "roof.secondary.updateExtent", label: "If updated",
        options: enumOptions(["full_replacement", "partial_replacement"]),
      },
      {
        kind: "integer", path: "roof.secondary.updatePercent", label: "% of replacement", min: 0, max: 100,
        showIf: { path: "roof.secondary.updateExtent", equals: "partial_replacement" },
      },
      {
        kind: "enum", path: "roof.secondary.condition", label: "Overall condition",
        options: enumOptions(["satisfactory", "unsatisfactory"]),
      },
      { kind: "boolean", path: "roof.secondary.visibleDamage", label: "Visible damage / deterioration" },
      { kind: "boolean", path: "roof.secondary.visibleLeaks", label: "Visible signs of leaks" },
      { kind: "string", path: "roof.notes", label: "Roof notes (both coverings)", placeholder: "Optional" },
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
  // 9a. Opening Protection — per-opening chart.
  // Inspector picks the WEAKEST protection level for each of the 6
  // opening types. Levels:
  //   N/A · A (9lb cyclic) · B (4-8lb) · C (plywood/OSB per FBC 2007) ·
  //   D (non-glazed only — ASTM E 330 etc.) ·
  //   N (appears A/B but unverified) · X (none) · Z (damaged/repair)
  {
    title: "9a. Opening Protection — Glazed Openings",
    fields: [
      {
        kind: "enum", path: "openingProtectionChart.windowsOrEntryDoorsGlazed",
        label: "Windows or Entry Doors",
        options: [
          { value: "na", label: "N/A — no openings of this type" },
          { value: "a",  label: "A. Cyclic + large missile (9 lb)" },
          { value: "b",  label: "B. Cyclic + large missile (4-8 lb)" },
          { value: "c",  label: "C. Plywood/OSB per Table 1609.1.2 FBC 2007" },
          { value: "n",  label: "N. Appears A/B but not verified, OR unidentifiable" },
          { value: "x",  label: "X. No windborne debris protection" },
          { value: "z",  label: "Z. Damaged — needs repair/replacement" },
        ],
      },
      {
        kind: "enum", path: "openingProtectionChart.garageDoorsGlazed",
        label: "Garage Doors (glazed)",
        options: [
          { value: "na", label: "N/A" }, { value: "a", label: "A" },
          { value: "b",  label: "B" },   { value: "c", label: "C" },
          { value: "n",  label: "N" },   { value: "x", label: "X" },
          { value: "z",  label: "Z" },
        ],
      },
      {
        kind: "enum", path: "openingProtectionChart.skylightsGlazed",
        label: "Skylights",
        options: [
          { value: "na", label: "N/A" }, { value: "a", label: "A (4.5 lb)" },
          { value: "b",  label: "B (2 lb)" }, { value: "c", label: "C" },
          { value: "n",  label: "N" },   { value: "x", label: "X" },
          { value: "z",  label: "Z" },
        ],
      },
      {
        kind: "enum", path: "openingProtectionChart.glassBlockGlazed",
        label: "Glass Block",
        options: [
          { value: "na", label: "N/A" }, { value: "a", label: "A" },
          { value: "b",  label: "B" },   { value: "c", label: "C" },
          { value: "n",  label: "N" },   { value: "x", label: "X" },
          { value: "z",  label: "Z" },
        ],
      },
    ],
  },
  {
    title: "9a. Opening Protection — Non-Glazed Openings",
    fields: [
      {
        kind: "enum", path: "openingProtectionChart.entryDoorsNonGlazed",
        label: "Entry Doors (non-glazed)",
        options: [
          { value: "na", label: "N/A" }, { value: "a", label: "A" },
          { value: "b",  label: "B" },   { value: "c", label: "C" },
          { value: "d",  label: "D. ASTM E 330 / ANSI/DASMA 108 / PA/TAS 202" },
          { value: "n",  label: "N" },   { value: "x", label: "X" },
          { value: "z",  label: "Z" },
        ],
      },
      {
        kind: "enum", path: "openingProtectionChart.garageDoorsNonGlazed",
        label: "Garage Doors (non-glazed)",
        options: [
          { value: "na", label: "N/A" }, { value: "a", label: "A" },
          { value: "b",  label: "B" },   { value: "c", label: "C" },
          { value: "d",  label: "D. ASTM E 330 / ANSI/DASMA 108 / PA/TAS 202" },
          { value: "n",  label: "N" },   { value: "x", label: "X" },
          { value: "z",  label: "Z" },
        ],
      },
    ],
  },
  {
    title: "9a. WEAKEST overall protection (summary)",
    fields: [
      {
        kind: "enum", path: "openingProtection", label: "WEAKEST overall",
        options: [
          { value: "a_hurricane_impact", label: "A. Hurricane impact" },
          { value: "b_basic_impact",     label: "B. Basic impact" },
          { value: "c_none",             label: "C. None" },
          { value: "n_other",            label: "N. Other" },
          { value: "x_unknown",          label: "X. Unknown" },
        ],
      },
    ],
  },
  // 9b — Secondary classification. Inspector picks a primary class
  // (A/B/C/N/X/Z) describing the GLAZED opening product compliance,
  // then a sub-class describing how the NON-GLAZED openings relate.
  {
    title: "9b. Secondary Classification",
    fields: [
      {
        kind: "enum", path: "q9bPrimary", label: "Primary classification",
        options: [
          { value: "a", label: "A. Cyclic + 9 lb large missile (Level A — Miami-Dade PA 201/202/203, TAS, ASTM E 1886/1996)" },
          { value: "b", label: "B. Cyclic + 4-8 lb large missile (Level B — ASTM, SSTD 12)" },
          { value: "c", label: "C. Wood structural panels per FBC 2007 (Level C — plywood/OSB)" },
          { value: "n", label: "N. Unverified shutter systems / no documentation" },
          { value: "x", label: "X. None or some glazed unprotected" },
          { value: "z", label: "Z. Damaged openings — repair/replacement" },
        ],
      },
      // A sub-conditions
      {
        kind: "enum", path: "q9bSubA", label: "A. Non-glazed scenario",
        showIf: { path: "q9bPrimary", equals: "a" },
        options: [
          { value: "a1", label: "A.1 All non-glazed are A, or no non-glazed exist" },
          { value: "a2", label: "A.2 Some non-glazed are B or D; none are C, N, X, or Z" },
          { value: "a3", label: "A.3 Some non-glazed are C, N, X, or Z" },
        ],
      },
      // B sub-conditions
      {
        kind: "enum", path: "q9bSubB", label: "B. Non-glazed scenario",
        showIf: { path: "q9bPrimary", equals: "b" },
        options: [
          { value: "b1", label: "B.1 All non-glazed are A or B" },
          { value: "b2", label: "B.2 Some non-glazed are C, N, X or Z; or no non-glazed exist" },
        ],
      },
      // C sub-conditions
      {
        kind: "enum", path: "q9bSubC", label: "C. Non-glazed scenario",
        showIf: { path: "q9bPrimary", equals: "c" },
        options: [
          { value: "c1", label: "C.1 All non-glazed are A, B or C; or no non-glazed exist" },
          { value: "c2", label: "C.2 Some non-glazed are D; none are N or X" },
          { value: "c3", label: "C.3 Some non-glazed are N or X" },
        ],
      },
      // N sub-conditions
      {
        kind: "enum", path: "q9bSubN", label: "N. Non-glazed scenario",
        showIf: { path: "q9bPrimary", equals: "n" },
        options: [
          { value: "n1", label: "N.1 All non-glazed are A, B or C; or no non-glazed exist" },
          { value: "n2", label: "N.2 Some non-glazed are D; none are N or X" },
          { value: "n3", label: "N.3 Some non-glazed are N or X" },
        ],
      },
      // X / Z have no sub-conditions
    ],
  },
  {
    title: "Notes",
    fields: [
      { kind: "string", path: "notes", label: "Inspector notes", placeholder: "Optional" },
    ],
  },
];
