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
export type FieldMeta =
  | { kind: "string"; path: string; label: string; placeholder?: string }
  | { kind: "integer"; path: string; label: string; min?: number; max?: number }
  | { kind: "boolean"; path: string; label: string }
  | { kind: "enum"; path: string; label: string; options: EnumOption[] };

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
    title: "1. Building Code",
    fields: [
      {
        kind: "enum", path: "buildingCode", label: "Code path",
        options: [
          { value: "a_built_2002_or_later_fbc", label: "A. Built 2002+ (FBC)" },
          { value: "b_built_1994_2001_sfbc", label: "B. 1994–2001 (SFBC)" },
          { value: "c_unknown_or_not_meeting", label: "C. Unknown / not meeting" },
        ],
      },
      { kind: "integer", path: "yearOfHomeOriginalConstruction", label: "Year of original construction", min: 1800, max: 2100 },
    ],
  },
  {
    title: "2. Roof Covering",
    fields: [
      {
        kind: "enum", path: "roofCovering.type", label: "Type",
        options: enumOptions([
          "asphalt_fiberglass_shingle", "concrete_clay_tile", "metal",
          "built_up", "membrane", "wood_shake", "other",
        ]),
      },
      { kind: "boolean", path: "roofCovering.fbcOrMiamiDadeApproved", label: "FBC/Miami-Dade approved" },
      {
        kind: "enum", path: "roofCovering.meetsCode", label: "Compliance",
        options: [
          { value: "a_compliant", label: "A. Compliant" },
          { value: "b_non_compliant", label: "B. Non-compliant" },
          { value: "c_unknown", label: "C. Unknown" },
        ],
      },
    ],
  },
  {
    title: "3. Roof Deck Attachment",
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
    title: "4. Roof-to-Wall Attachment",
    fields: [
      {
        kind: "enum", path: "roofToWallAttachment", label: "Attachment",
        options: [
          { value: "a_toe_nails", label: "A. Toe nails" },
          { value: "b_clips", label: "B. Clips" },
          { value: "c_single_wraps", label: "C. Single wraps" },
          { value: "d_double_wraps", label: "D. Double wraps" },
          { value: "e_structural", label: "E. Structural" },
          { value: "f_other", label: "F. Other" },
          { value: "g_unknown", label: "G. Unknown" },
        ],
      },
    ],
  },
  {
    title: "5. Roof Geometry",
    fields: [
      {
        kind: "enum", path: "roofGeometry", label: "Geometry",
        options: [
          { value: "a_hip", label: "A. Hip" },
          { value: "b_flat", label: "B. Flat" },
          { value: "c_other", label: "C. Other (gable, etc.)" },
        ],
      },
    ],
  },
  {
    title: "6. Secondary Water Resistance",
    fields: [
      {
        kind: "enum", path: "secondaryWaterResistance", label: "SWR",
        options: [
          { value: "a_yes", label: "A. Yes" },
          { value: "b_no", label: "B. No" },
          { value: "c_unknown", label: "C. Unknown" },
        ],
      },
    ],
  },
  {
    title: "7. Opening Protection",
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
