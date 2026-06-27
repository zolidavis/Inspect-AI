import { z } from "zod";

/**
 * Uniform Mitigation Verification Inspection Form
 * OIR-B1-1802 (Rev. 04/26), the Florida wind mitigation form.
 *
 * Section letters/numbers below mirror the official form.
 * See: https://floir.gov/consumers/wind-mitigation-resources
 */

// 1. Building Code — the 04/26 form has 4 options A/B/C/D. The UI offers
// all four. Legacy 01/12 enum values (a_built_2002_or_later_fbc etc.)
// are accepted for back-compat — the PDF filler routes them to the
// correct A/B/C/D box.
export const BuildingCodeSchema = z.enum([
  // New 04/26 explicit values
  "a_fbc_2001_2004",          // A. FBC 2001 & 2004 (built 2002-2006)
  "b_fbc_2007_later",         // B. FBC 2007 and later (built 2007+)
  "c_hvhz_sfbc_94",           // C. HVHZ only — SFBC-94 (built 1994-2001 HVHZ)
  "d_unknown",                // D. Unknown or doesn't meet A/B/C
  // Legacy 01/12 values (kept for back-compat with stored inspections)
  "a_built_2002_or_later_fbc",
  "b_built_1994_2001_sfbc",
  "c_unknown_or_not_meeting",
]);

/** Building permit application date as MM/DD/YYYY (free-text for inspector). */
export const BuildingPermitDateSchema = z.string();

// 2. Region — new in the 04/26 revision. Based on ASCE 7-22 design wind
// speed (700-year MRI), Risk Category 2.
export const RegionSchema = z.enum([
  "hvhz",       // High-Velocity Hurricane Zone (Miami-Dade / Broward)
  "region_1",   // ≥ 140 mph
  "region_2",   // 130 mph – 139 mph
  "region_3",   // < 130 mph
]);

// 3. Roof Slope — new in the 04/26 revision.
export const RoofSlopeSchema = z.enum([
  "ge_6_12",    // ≥ 6:12
  "lt_6_12",    // < 6:12
]);

// NOTE block — FORTIFIED Home certificate (optional, the form's NOTE
// area lists this on page 1).
export const FortifiedHomeSchema = z.enum([
  "none",
  "roof",
  "silver",
  "gold",
]);

// 2. Roof Covering
export const RoofCoveringTypeSchema = z.enum([
  "asphalt_fiberglass_shingle",
  "concrete_clay_tile",
  "metal",
  "built_up",
  "membrane",
  "wood_shake",
  "other",
]);
export const RoofCoveringSchema = z.object({
  type: RoofCoveringTypeSchema,
  // Per-covering compliance data (the 4 columns on the form, any of
  // which can be filled by the inspector to demonstrate compliance):
  /** Permit Application Date — MM/DD/YYYY free-text. */
  permitApplicationDate: z.string().nullable().optional(),
  /** FBC or MDC Product Approval # — the actual number from the label. */
  productApprovalNumber: z.string().nullable().optional(),
  /** Year of Original Installation or Replacement — YYYY. */
  yearOfOriginalInstallation: z.string().nullable().optional(),
  /** "No Information Provided for Compliance" checkbox. */
  noInformationProvided: z.boolean().optional(),
  /** Legacy "is there any FBC/MDC approval visible?" boolean. The AI
   *  vision route still emits this hint. */
  fbcOrMiamiDadeApproved: z.boolean().optional(),
  /** Overall compliance question A/B/C/D (covers the whole roof). */
  meetsCode: z.enum(["a_compliant", "b_non_compliant", "c_unknown"]),
});

// 3. Roof Deck Attachment
export const RoofDeckAttachmentSchema = z.enum([
  "a_plywood_osb_6d_nails_6_12",
  "b_plywood_osb_8d_nails_6_12",
  "c_plywood_osb_8d_nails_6_6",
  "d_reinforced_concrete",
  "e_other",
  "f_unknown",
]);

// 6. Roof to Wall Attachment (was Q4 in 01/12, renumbered in 04/26).
//
// The 04/26 revision keeps the full A–I category list, it just spreads it
// across two printed pages: page 2 has "A. Toenails" (+ sub-bullets a1/a2/a3)
// and the "Minimal conditions to qualify for categories B, C, or D" numbered
// 1/2/3; page 3 has the B/C/D/E/F/G/H/I rows with their own sub-bullets.
//
// The inspector's primary answer (`roofToWallAttachment`) is the WEAKEST
// CATEGORY: A–I. Supporting selections:
//   • roofToWallAQualifier       — A.1/A.2/A.3 (only when A)
//   • roofToWallMinimalCondition — 1/2/3, the qualifying connection class
//                                  required for B/C/D (Note: all retrofit
//                                  connectors / structural fasteners must
//                                  meet option 3)
//   • roofToWallBSub/CSub/DSub   — the specific sub-bullet under B/C/D
//   • roofToWallOther            — free text for F
//
// Legacy values are still accepted so old rows validate: m1/m2/m3 (an
// earlier 04/26 pass that folded the minimal condition into the answer) and
// h_not_installed (the 01/12 "not installed as intended", now category I).
export const RoofToWallSchema = z.enum([
  "a_toe_nails",
  "b_clips",
  "c_single_wraps",
  "d_double_wraps",
  "e_structural",
  "f_other",
  "g_unknown",
  "h_no_attic_access",
  "i_not_installed",
  // legacy — accepted for backward compatibility, not offered in the picker:
  "m1",
  "m2",
  "m3",
  "h_not_installed",
]);

/** A.1/A.2/A.3 — which qualifying condition for option A (toenails). */
export const RoofToWallAQualifierSchema = z.enum(["a1", "a2", "a3"]);

/** Minimal condition 1/2/3 that a B/C/D connection must satisfy. */
export const RoofToWallMinimalConditionSchema = z.enum(["m1", "m2", "m3"]);

/** B. Clips sub-bullets. */
export const RoofToWallBSubSchema = z.enum(["b1", "b2", "b3"]);
/** C. Single Wraps sub-bullets. */
export const RoofToWallCSubSchema = z.enum(["c1", "c2"]);
/** D. Double Wraps sub-bullets. */
export const RoofToWallDSubSchema = z.enum(["d1", "d2", "d3"]);

// 7. Roof Geometry (was Q5 in 01/12)
export const RoofGeometrySchema = z.enum(["a_hip", "b_flat", "c_other"]);

// 8. Secondary Water Resistance / Sealed Roof Deck (was Q6 in 01/12).
// A = Sealed Roof Deck (the value our schema legacy-encodes as "a_yes")
// B = No sealed roof deck (was "b_no")
// C = Unknown or undetermined (was "c_unknown")
export const SwrSchema = z.enum(["a_yes", "b_no", "c_unknown"]);

/** Q8.A sub-method — which qualifying construction is in place. */
export const SwrSubMethodSchema = z.enum([
  "m1_astm_d1970",      // Fully adhered ASTM D1970 polymer-modified bitumen
  "m2_taped_seams",     // Tape over roof deck seams (≥ 3.75″ self-adhering strip)
  "m3_double_layer",    // Double layer of felt/synthetic with no tape
  "m4_spray_foam",      // Spray foam product along rafter/deck intersections
]);

// 9a. Opening Protection — the WEAKEST overall protection (kept for back-compat
// with the existing summary field).
export const OpeningProtectionSchema = z.enum([
  "a_hurricane_impact",
  "b_basic_impact",
  "c_none",
  "n_other",
  "x_unknown",
]);

// 9a. Opening Protection chart — rows are protection levels.
//
//  Glazed columns can be N/A, A, B, C, N, X, Z (no D — D only applies to
//  non-glazed entry / garage doors per the form's gray-out).
//  Non-glazed columns add D.
//
// Rows:
//   N/A — Not applicable (no openings of this type)
//   A   — Verified cyclic pressure + large missile (9 lb / windows;
//         4.5 lb / skylights)
//   B   — Verified cyclic pressure + large missile (4-8 lb / windows;
//         2 lb / skylights)
//   C   — Verified plywood/OSB meeting Table 1609.1.2 of FBC 2007
//   D   — (non-glazed only) Verified per ASTM E 330, ANSI/DASMA 108,
//         or PA/TAS 202
//   N   — Appear to be A or B but not verified / Other products
//         that cannot be identified as A, B, or C
//   X   — No windborne debris protection
//   Z   — Damaged openings in need of repair/replacement
export const Q9LevelGlazedSchema    = z.enum(["na", "a", "b", "c", "n", "x", "z"]);
export const Q9LevelNonGlazedSchema = z.enum(["na", "a", "b", "c", "d", "n", "x", "z"]);

export const Q9OpeningProtectionChartSchema = z.object({
  // Glazed openings
  windowsOrEntryDoorsGlazed: Q9LevelGlazedSchema.optional(),
  garageDoorsGlazed:         Q9LevelGlazedSchema.optional(),
  skylightsGlazed:           Q9LevelGlazedSchema.optional(),
  glassBlockGlazed:          Q9LevelGlazedSchema.optional(),
  // Non-glazed openings
  entryDoorsNonGlazed:       Q9LevelNonGlazedSchema.optional(),
  garageDoorsNonGlazed:      Q9LevelNonGlazedSchema.optional(),
});

// 9b. Secondary classification. The primary picks the protection
// product class for the glazed openings (A through Z), and the sub
// picks how the non-glazed openings are classified relative to that.
export const Q9bPrimarySchema = z.enum(["a", "b", "c", "n", "x", "z"]);
export const Q9bASubSchema = z.enum(["a1", "a2", "a3"]);
export const Q9bBSubSchema = z.enum(["b1", "b2"]);
export const Q9bCSubSchema = z.enum(["c1", "c2", "c3"]);
export const Q9bNSubSchema = z.enum(["n1", "n2", "n3"]);

export const WindMitFormSchema = z.object({
  // NOTE area
  fortifiedHome: FortifiedHomeSchema.optional(),
  // 1. Building Code
  buildingCode: BuildingCodeSchema,
  buildingPermitDate: BuildingPermitDateSchema.optional(),
  yearOfHomeOriginalConstruction: z.number().int(),
  // 2. Region
  region: RegionSchema.optional(),
  // 3. Roof Slope
  roofSlope: RoofSlopeSchema.optional(),
  // 4. Roof Covering
  roofCovering: RoofCoveringSchema,
  // 5+. (the 04/26 form re-shuffled the numbers but the underlying
  // classifications still apply)
  roofDeckAttachment: RoofDeckAttachmentSchema,
  // 04/26 section 6: WEAKEST category A–I, plus supporting sub-selections.
  roofToWallAttachment: RoofToWallSchema,
  /** A. Toenails: which of A.1/A.2/A.3 qualifying condition applies. */
  roofToWallAQualifier: RoofToWallAQualifierSchema.optional(),
  /** Minimal condition 1/2/3 the B/C/D connection meets. */
  roofToWallMinimalCondition: RoofToWallMinimalConditionSchema.optional(),
  /** B. Clips: which sub-bullet applies. */
  roofToWallBSub: RoofToWallBSubSchema.optional(),
  /** C. Single Wraps: which sub-bullet applies. */
  roofToWallCSub: RoofToWallCSubSchema.optional(),
  /** D. Double Wraps: which sub-bullet applies. */
  roofToWallDSub: RoofToWallDSubSchema.optional(),
  /** F. Other: free-text description. */
  roofToWallOther: z.string().optional(),

  // 7. Roof Geometry. A. Hip needs perimeter lengths; B. Flat needs areas.
  roofGeometry: RoofGeometrySchema,
  /** A. Hip: total length of non-hip features (feet). */
  roofGeometryNonHipPerimeter: z.number().optional(),
  /** A. Hip: total roof system perimeter (feet). */
  roofGeometryTotalPerimeter: z.number().optional(),
  /** B. Flat: roof area with slope less than 2:12 (sq ft). */
  roofGeometryFlatAreaLt2_12: z.number().optional(),
  /** B. Flat: total roof area (sq ft). */
  roofGeometryTotalArea: z.number().optional(),

  // 8. SWR / Sealed Roof Deck.
  secondaryWaterResistance: SwrSchema,
  /** A. Sealed Roof Deck: which qualifying method. */
  swrSubMethod: SwrSubMethodSchema.optional(),
  /** Optional flag: "entire roof deck underside covered" (typically with spray foam). */
  swrEntireDeckCovered: z.boolean().optional(),
  // 9. Opening Protection
  openingProtection: OpeningProtectionSchema,                          // 9a summary "WEAKEST" enum
  openingProtectionChart: Q9OpeningProtectionChartSchema.optional(),   // 9a per-opening chart
  // 9b secondary classification — primary + per-primary sub picker
  q9bPrimary: Q9bPrimarySchema.optional(),
  q9bSubA: Q9bASubSchema.optional(),
  q9bSubB: Q9bBSubSchema.optional(),
  q9bSubC: Q9bCSubSchema.optional(),
  q9bSubN: Q9bNSubSchema.optional(),
  notes: z.string().optional(),
});
export type WindMitForm = z.infer<typeof WindMitFormSchema>;

export const photoTags = [
  "wm.elevation",
  "wm.roof_covering",
  "wm.roof_deck_attic",
  "wm.roof_to_wall",
  "wm.roof_geometry",
  "wm.swr",
  "wm.opening_protection",
  "wm.permit_documents",
] as const;
export type PhotoTag = (typeof photoTags)[number];
