import { z } from "zod";

/**
 * Florida 4-Point Insurance Inspection.
 * Covers the four systems insurers care about for older homes,
 * ordered to match the Citizens "Insp4pt" carrier form:
 *   1. Electrical
 *   2. HVAC (heating + cooling)
 *   3. Plumbing
 *   4. Roof  (with predominant + optional secondary covering)
 *
 * Carrier-specific variations are accommodated by the optional
 * `carrierFields` map.
 *
 * Note: all section-level fields are optional so partial inspections
 * are persistable. /complete validates required fields server-side
 * (see apps/api/src/routes/inspections.ts).
 */

// ── Electrical ───────────────────────────────────────────────────────
// Schema mirrors the Citizens "Insp4pt 03 25" Electrical System section
// 1-for-1. Two panels (Main + Second), an "Indicate presence of any of
// the following" check-all group, a Hazards Present check-all group, a
// Satisfactory/Unsatisfactory rating, plus a Supplemental Information
// block with per-panel age/year/brand and a Wiring Type(s) check-all.

/** One electrical panel (Main or Second). */
export const ElectricalPanelSchema = z.object({
  type: z.enum(["circuit_breaker", "fuse"]).optional(),
  totalAmps: z.number().int().min(0).max(1000).optional(),
  amperageSufficient: z.boolean().optional(),
  amperageSufficientExplain: z.string().optional(),
  /** Supplemental info — panel age (years). */
  panelAge: z.number().int().min(0).max(150).optional(),
  yearLastUpdated: z.number().int().min(1900).max(2100).optional(),
  brandModel: z.string().optional(),
});

/** "Indicate presence of any of the following:" group (check all that apply). */
export const ElectricalPresenceSchema = z.object({
  clothWiring: z.boolean().optional(),
  activeKnobAndTube: z.boolean().optional(),
  branchCircuitAluminumWiring: z.boolean().optional(),
  /** "If present, describe the usage of all aluminum wiring." */
  aluminumWiringDescription: z.string().optional(),
  connectionsRepairedCopalumCrimp: z.boolean().optional(),
  connectionsRepairedAlumiConn: z.boolean().optional(),
});

/** "Hazards Present" group — all 13 boxes on the form. */
export const ElectricalHazardsSchema = z.object({
  // Left column
  blowingFuses: z.boolean().optional(),
  trippingBreakers: z.boolean().optional(),
  emptySockets: z.boolean().optional(),
  looseWiring: z.boolean().optional(),
  improperGrounding: z.boolean().optional(),
  corrosion: z.boolean().optional(),
  overFusing: z.boolean().optional(),
  // Right column
  doubleTaps: z.boolean().optional(),
  exposedWiring: z.boolean().optional(),
  unsafeWiring: z.boolean().optional(),
  improperBreakerSize: z.boolean().optional(),
  scorching: z.boolean().optional(),
  other: z.boolean().optional(),
  otherExplain: z.string().optional(),
});

/** "Wiring Type(s)" check-all from the Supplemental Information block. */
export const WiringTypesSchema = z.object({
  copper: z.boolean().optional(),
  copperCladAl: z.boolean().optional(),
  nmBxOrConduit: z.boolean().optional(),
  singleStrandAl: z.boolean().optional(),
  clothKnobAndTube: z.boolean().optional(),
  multistrandAl: z.boolean().optional(),
  clothJacketRubberInsulated: z.boolean().optional(),
  other: z.boolean().optional(),
});

export const ElectricalSchema = z.object({
  mainPanel: ElectricalPanelSchema.optional(),
  secondPanel: ElectricalPanelSchema.optional(),
  presence: ElectricalPresenceSchema.optional(),
  hazards: ElectricalHazardsSchema.optional(),
  generalCondition: z.enum(["satisfactory", "unsatisfactory"]).optional(),
  generalConditionExplain: z.string().optional(),
  wiringTypes: WiringTypesSchema.optional(),
  notes: z.string().optional(),
});

// ── HVAC (Heating + Cooling) ────────────────────────────────────────
export const HvacSchema = z.object({
  systemType: z
    .enum(["central_ac", "heat_pump", "window_units", "mini_split", "other"])
    .optional(),
  ageYears: z.number().int().min(0).optional(),
  yearLastUpdated: z.number().int().min(1900).max(2100).optional(),
  condition: z.enum(["good", "fair", "poor"]).optional(),
  hazardsPresent: z.boolean().optional(),
  inGoodWorkingOrder: z.boolean().optional(),
  notes: z.string().optional(),
});

// ── Plumbing ────────────────────────────────────────────────────────
export const PlumbingSchema = z.object({
  ageYears: z.number().int().min(0).optional(),
  yearLastUpdated: z.number().int().min(1900).max(2100).optional(),
  supplyMaterial: z
    .enum(["copper", "cpvc", "pex", "polybutylene", "galvanized", "mixed"])
    .optional(),
  drainMaterial: z.enum(["pvc", "cast_iron", "abs", "mixed"]).optional(),
  waterHeaterAgeYears: z.number().int().min(0).optional(),
  inGoodWorkingOrder: z.boolean().optional(),
  leaksObserved: z.boolean().optional(),
  notes: z.string().optional(),
});

// ── Roof ────────────────────────────────────────────────────────────
/**
 * One roof-covering record. The Citizens form has two columns side by
 * side ("Predominant Roof" + "Secondary Roof") with identical sub-fields,
 * so we use the same schema twice.
 */
export const RoofCoverageSchema = z.object({
  /** Free-form covering material (asphalt shingle, metal, tile, …). */
  coveringMaterial: z
    .enum([
      "asphalt_shingle",
      "metal",
      "tile",
      "built_up",
      "membrane",
      "wood_shake",
      "other",
    ])
    .optional(),
  ageYears: z.number().int().min(0).optional(),
  remainingLifeYears: z.number().int().min(0).optional(),
  /** Date of last roofing permit (MM/DD/YYYY or ISO string). */
  lastPermitDate: z.string().optional(),
  /** Date of last update (MM/DD/YYYY or ISO). */
  lastUpdateDate: z.string().optional(),
  /** If updated, kind of update. */
  updateExtent: z.enum(["full_replacement", "partial_replacement"]).optional(),
  /** Percent replaced (0-100) when updateExtent = partial_replacement. */
  updatePercent: z.number().int().min(0).max(100).optional(),
  condition: z.enum(["satisfactory", "unsatisfactory"]).optional(),
  visibleDamage: z.boolean().optional(),
  visibleLeaks: z.boolean().optional(),
});

export const RoofSchema = z.object({
  predominant: RoofCoverageSchema.optional(),
  secondary: RoofCoverageSchema.optional(),
  /** Free-form damage / overall notes. */
  notes: z.string().optional(),
});

// ── Form (section order matters — drives default render order in the
// mobile FormEditor; backend treats it as a plain object) ────────────
export const FourPointFormSchema = z.object({
  electrical: ElectricalSchema.optional(),
  hvac: HvacSchema.optional(),
  plumbing: PlumbingSchema.optional(),
  roof: RoofSchema.optional(),
  carrierFields: z.record(z.string(), z.string()).optional(),
});
export type FourPointForm = z.infer<typeof FourPointFormSchema>;

export const photoTags = [
  "electrical.panel",
  "electrical.wiring",
  "hvac.condenser",
  "hvac.air_handler",
  "plumbing.supply",
  "plumbing.water_heater",
  "roof.predominant",
  "roof.secondary",
  "roof.condition",
] as const;
export type PhotoTag = (typeof photoTags)[number];
