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
/** Quick-fill suggestion chip for a string field. `danger` styles it red. */
export type Suggestion = { value: string; danger?: boolean };
export type FieldMeta =
  | (Base & { kind: "string"; path: string; label: string; placeholder?: string; suggestions?: Suggestion[] })
  | (Base & { kind: "integer"; path: string; label: string; min?: number; max?: number })
  | (Base & { kind: "boolean"; path: string; label: string })
  | (Base & { kind: "enum"; path: string; label: string; options: EnumOption[] });

/**
 * 10 most common residential electrical panel brands. The four flagged
 * `danger` are the notorious fire-hazard / non-insurable makes inspectors
 * must call out (Federal Pacific Stab-Lok, Zinsco, Sylvania-Zinsco, Challenger).
 */
export const PANEL_BRANDS: Suggestion[] = [
  { value: "Square D" },
  { value: "Eaton / Cutler-Hammer" },
  { value: "General Electric (GE)" },
  { value: "Siemens" },
  { value: "Murray" },
  { value: "Westinghouse" },
  { value: "Federal Pacific (Stab-Lok)", danger: true },
  { value: "Zinsco", danger: true },
  { value: "Sylvania", danger: true },
  { value: "Challenger", danger: true },
];

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

/** Sat/Unsat/N/A picker for one plumbing fixture row. */
const fixtureField = (path: string, label: string): FieldMeta => ({
  kind: "enum",
  path,
  label,
  options: [
    { value: "satisfactory", label: "Satisfactory" },
    { value: "unsatisfactory", label: "Unsatisfactory" },
    { value: "na", label: "N/A" },
  ],
});

const PIPING_AGE_OPTIONS: EnumOption[] = [
  { value: "original", label: "Original to home" },
  { value: "completely_repiped", label: "Completely re-piped" },
  { value: "partially_repiped", label: "Partially re-piped" },
];

function prettyLabel(v: string): string {
  // strip leading enum prefix like "a_", "wm.", etc.
  return v
    .replace(/^[a-z]_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export const FOUR_POINT_SECTIONS: SectionMeta[] = [
  // 1a. Electrical — Main Panel
  {
    title: "Electrical — Main Panel",
    fields: [
      {
        kind: "enum", path: "electrical.mainPanel.type", label: "Type",
        options: [
          { value: "circuit_breaker", label: "Circuit breaker" },
          { value: "fuse",            label: "Fuse" },
        ],
      },
      { kind: "integer", path: "electrical.mainPanel.totalAmps", label: "Total amps", min: 0, max: 1000 },
      { kind: "boolean", path: "electrical.mainPanel.amperageSufficient", label: "Is amperage sufficient for current usage?" },
      { kind: "string",  path: "electrical.mainPanel.amperageSufficientExplain", label: "If no, explain", placeholder: "Optional" },
    ],
  },
  // 1b. Electrical — Second Panel (optional)
  {
    title: "Electrical — Second Panel (if present)",
    fields: [
      {
        kind: "enum", path: "electrical.secondPanel.type", label: "Type",
        options: [
          { value: "circuit_breaker", label: "Circuit breaker" },
          { value: "fuse",            label: "Fuse" },
        ],
      },
      { kind: "integer", path: "electrical.secondPanel.totalAmps", label: "Total amps", min: 0, max: 1000 },
      { kind: "boolean", path: "electrical.secondPanel.amperageSufficient", label: "Is amperage sufficient for current usage?" },
      { kind: "string",  path: "electrical.secondPanel.amperageSufficientExplain", label: "If no, explain", placeholder: "Optional" },
    ],
  },
  // 1c. Indicate presence of any of the following
  {
    title: "Electrical — Indicate presence of any of the following",
    fields: [
      { kind: "boolean", path: "electrical.presence.clothWiring",                     label: "Cloth wiring" },
      { kind: "boolean", path: "electrical.presence.activeKnobAndTube",               label: "Active knob and tube" },
      { kind: "boolean", path: "electrical.presence.branchCircuitAluminumWiring",     label: "Branch circuit aluminum wiring" },
      { kind: "string",  path: "electrical.presence.aluminumWiringDescription",       label: "If present, describe usage of all aluminum wiring", placeholder: "Optional" },
      { kind: "boolean", path: "electrical.presence.connectionsRepairedCopalumCrimp", label: "Connections repaired via COPALUM crimp" },
      { kind: "boolean", path: "electrical.presence.connectionsRepairedAlumiConn",    label: "Connections repaired via AlumiConn" },
    ],
  },
  // 1d. Hazards Present (all 13 boxes)
  {
    title: "Electrical — Hazards Present",
    fields: [
      { kind: "boolean", path: "electrical.hazards.blowingFuses",        label: "Blowing fuses" },
      { kind: "boolean", path: "electrical.hazards.trippingBreakers",    label: "Tripping breakers" },
      { kind: "boolean", path: "electrical.hazards.emptySockets",        label: "Empty sockets" },
      { kind: "boolean", path: "electrical.hazards.looseWiring",         label: "Loose wiring" },
      { kind: "boolean", path: "electrical.hazards.improperGrounding",   label: "Improper grounding" },
      { kind: "boolean", path: "electrical.hazards.corrosion",           label: "Corrosion" },
      { kind: "boolean", path: "electrical.hazards.overFusing",          label: "Over fusing" },
      { kind: "boolean", path: "electrical.hazards.doubleTaps",          label: "Double taps" },
      { kind: "boolean", path: "electrical.hazards.exposedWiring",       label: "Exposed wiring" },
      { kind: "boolean", path: "electrical.hazards.unsafeWiring",        label: "Unsafe wiring" },
      { kind: "boolean", path: "electrical.hazards.improperBreakerSize", label: "Improper breaker size" },
      { kind: "boolean", path: "electrical.hazards.scorching",           label: "Scorching" },
      { kind: "boolean", path: "electrical.hazards.other",               label: "Other" },
      { kind: "string",  path: "electrical.hazards.otherExplain",        label: "If other, explain", placeholder: "Optional" },
    ],
  },
  // 1e. General condition + supplemental
  {
    title: "Electrical — General condition & supplemental",
    fields: [
      {
        kind: "enum", path: "electrical.generalCondition", label: "General condition of electrical system",
        options: enumOptions(["satisfactory", "unsatisfactory"]),
      },
      { kind: "string", path: "electrical.generalConditionExplain", label: "If unsatisfactory, explain", placeholder: "Optional" },
      // Main panel supplemental
      { kind: "integer", path: "electrical.mainPanel.panelAge",        label: "Main panel age (years)", min: 0, max: 150 },
      { kind: "integer", path: "electrical.mainPanel.yearLastUpdated", label: "Main panel year last updated", min: 1900, max: 2100 },
      { kind: "string",  path: "electrical.mainPanel.brandModel",      label: "Main panel brand/model", placeholder: "Square D, Eaton, …", suggestions: PANEL_BRANDS },
      // Second panel supplemental
      { kind: "integer", path: "electrical.secondPanel.panelAge",        label: "Second panel age (years)", min: 0, max: 150 },
      { kind: "integer", path: "electrical.secondPanel.yearLastUpdated", label: "Second panel year last updated", min: 1900, max: 2100 },
      { kind: "string",  path: "electrical.secondPanel.brandModel",      label: "Second panel brand/model", placeholder: "Optional", suggestions: PANEL_BRANDS },
      // Wiring Type(s) — check all that apply
      { kind: "boolean", path: "electrical.wiringTypes.copper",                     label: "Wiring: Copper" },
      { kind: "boolean", path: "electrical.wiringTypes.copperCladAl",               label: "Wiring: Copper Clad AL" },
      { kind: "boolean", path: "electrical.wiringTypes.nmBxOrConduit",              label: "Wiring: NM, BX or Conduit" },
      { kind: "boolean", path: "electrical.wiringTypes.singleStrandAl",             label: "Wiring: Single Strand AL" },
      { kind: "boolean", path: "electrical.wiringTypes.clothKnobAndTube",           label: "Wiring: Cloth (Knob & Tube)" },
      { kind: "boolean", path: "electrical.wiringTypes.multistrandAl",              label: "Wiring: Multistrand AL" },
      { kind: "boolean", path: "electrical.wiringTypes.clothJacketRubberInsulated", label: "Wiring: Cloth Jacket Rubber Insulated" },
      { kind: "boolean", path: "electrical.wiringTypes.other",                      label: "Wiring: Other" },
      { kind: "string",  path: "electrical.notes", label: "Notes", placeholder: "Optional" },
    ],
  },
  // 2a. HVAC System
  {
    title: "HVAC System",
    fields: [
      { kind: "boolean", path: "hvac.centralAc", label: "Central AC" },
      { kind: "boolean", path: "hvac.centralHeat", label: "Central heat" },
      { kind: "string",  path: "hvac.primaryHeatSource", label: "If not central heat, primary heat source & fuel type", placeholder: "Optional" },
      { kind: "boolean", path: "hvac.inGoodWorkingOrder", label: "Are the HVAC systems in good working order?" },
      { kind: "string",  path: "hvac.inGoodWorkingOrderExplain", label: "If no, explain", placeholder: "Optional" },
      { kind: "string",  path: "hvac.lastServiceDate", label: "Date of last HVAC servicing/inspection", placeholder: "MM/DD/YYYY" },
    ],
  },
  // 2b. HVAC — Hazards Present
  {
    title: "HVAC — Hazards Present",
    fields: [
      { kind: "boolean", path: "hvac.hazards.woodStoveOrGasFireplacePresent",  label: "Wood-burning stove or central gas fireplace present?" },
      { kind: "boolean", path: "hvac.hazards.woodStoveProfessionallyInstalled", label: "If present, was it professionally installed?" },
      { kind: "boolean", path: "hvac.hazards.spaceHeaterPrimarySource",         label: "Space heater used as primary heat source?" },
      { kind: "boolean", path: "hvac.hazards.spaceHeaterPortable",              label: "If a space heater, is the source portable?" },
      { kind: "boolean", path: "hvac.hazards.airHandlerBlockageOrLeakage",      label: "Air handler/condensate/drain pan blockage or leakage?" },
    ],
  },
  // 2c. HVAC — Supplemental
  {
    title: "HVAC — Supplemental",
    fields: [
      { kind: "integer", path: "hvac.ageYears", label: "Age of system (years)", min: 0, max: 100 },
      { kind: "integer", path: "hvac.yearLastUpdated", label: "Year last updated", min: 1900, max: 2100 },
      { kind: "string",  path: "hvac.notes", label: "Notes", placeholder: "Optional" },
    ],
  },
  // 3a. Plumbing System
  {
    title: "Plumbing System",
    fields: [
      { kind: "boolean", path: "plumbing.tprvPresent", label: "Temperature pressure relief valve on water heater?" },
      { kind: "boolean", path: "plumbing.activeLeak",  label: "Any indication of an active leak?" },
      { kind: "boolean", path: "plumbing.priorLeak",   label: "Any indication of a prior leak?" },
      { kind: "string",  path: "plumbing.waterHeaterLocation", label: "Water heater location", placeholder: "Garage, closet, attic…" },
    ],
  },
  // 3b. Plumbing — Fixtures condition (Sat / Unsat / N/A)
  {
    title: "Plumbing — Fixtures condition",
    fields: [
      fixtureField("plumbing.fixtures.dishwasher",       "Dishwasher"),
      fixtureField("plumbing.fixtures.refrigerator",     "Refrigerator"),
      fixtureField("plumbing.fixtures.washingMachine",   "Washing machine"),
      fixtureField("plumbing.fixtures.waterHeater",      "Water heater"),
      fixtureField("plumbing.fixtures.showersTubs",      "Showers/Tubs"),
      fixtureField("plumbing.fixtures.toilets",          "Toilets"),
      fixtureField("plumbing.fixtures.sinks",            "Sinks"),
      fixtureField("plumbing.fixtures.sumpPump",         "Sump pump"),
      fixtureField("plumbing.fixtures.mainShutOffValve", "Main shut off valve"),
      fixtureField("plumbing.fixtures.allOtherVisible",  "All other visible"),
      { kind: "string", path: "plumbing.unsatisfactoryComments", label: "If unsatisfactory, comments/details", placeholder: "leaks, soft spots, mold, corrosion…" },
    ],
  },
  // 3c. Plumbing — Supplemental
  {
    title: "Plumbing — Supplemental",
    fields: [
      { kind: "enum", path: "plumbing.supplyPipingAge", label: "Age of piping — supply system", options: PIPING_AGE_OPTIONS },
      { kind: "enum", path: "plumbing.drainPipingAge",  label: "Age of piping — drain system",  options: PIPING_AGE_OPTIONS },
      { kind: "boolean", path: "plumbing.pipeTypes.copper",       label: "Pipe type: Copper" },
      { kind: "boolean", path: "plumbing.pipeTypes.pvcCpvc",      label: "Pipe type: PVC/CPVC" },
      { kind: "boolean", path: "plumbing.pipeTypes.galvanized",   label: "Pipe type: Galvanized" },
      { kind: "boolean", path: "plumbing.pipeTypes.castIron",     label: "Pipe type: Cast Iron" },
      { kind: "boolean", path: "plumbing.pipeTypes.polybutylene", label: "Pipe type: Polybutylene" },
      { kind: "boolean", path: "plumbing.pipeTypes.abs",          label: "Pipe type: ABS" },
      { kind: "boolean", path: "plumbing.pipeTypes.pex",          label: "Pipe type: PEX" },
      { kind: "boolean", path: "plumbing.pipeTypes.other",        label: "Pipe type: Other" },
      { kind: "string",  path: "plumbing.pipeTypes.yearInstalled", label: "Pipes year installed", placeholder: "Optional" },
      { kind: "integer", path: "plumbing.waterHeaterAgeYears", label: "Water heater age (years)", min: 0, max: 100 },
      { kind: "string",  path: "plumbing.notes", label: "Notes", placeholder: "Optional" },
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
      { kind: "boolean", path: "roof.predominant.visibleDamage", label: "Any visible damage / deterioration?" },
      // Damage check-all (check all that apply)
      { kind: "boolean", path: "roof.predominant.damage.cracking",                label: "Damage: Cracking" },
      { kind: "boolean", path: "roof.predominant.damage.cuppingCurling",          label: "Damage: Cupping/curling" },
      { kind: "boolean", path: "roof.predominant.damage.excessiveGranuleLoss",    label: "Damage: Excessive granule loss" },
      { kind: "boolean", path: "roof.predominant.damage.exposedAsphalt",          label: "Damage: Exposed asphalt" },
      { kind: "boolean", path: "roof.predominant.damage.exposedFelt",             label: "Damage: Exposed felt" },
      { kind: "boolean", path: "roof.predominant.damage.missingLooseCrackedTabs", label: "Damage: Missing/loose/cracked tabs or tiles" },
      { kind: "boolean", path: "roof.predominant.damage.softSpotsInDecking",      label: "Damage: Soft spots in decking" },
      { kind: "boolean", path: "roof.predominant.damage.visibleHailDamage",       label: "Damage: Visible hail damage" },
      { kind: "boolean", path: "roof.predominant.visibleLeaks",        label: "Any visible signs of leaks?" },
      { kind: "boolean", path: "roof.predominant.leakAtticUnderside",  label: "Leak — attic/underside of decking?" },
      { kind: "boolean", path: "roof.predominant.leakInteriorCeilings", label: "Leak — interior ceilings?" },
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
      { kind: "boolean", path: "roof.secondary.visibleDamage", label: "Any visible damage / deterioration?" },
      // Damage check-all (check all that apply)
      { kind: "boolean", path: "roof.secondary.damage.cracking",                label: "Damage: Cracking" },
      { kind: "boolean", path: "roof.secondary.damage.cuppingCurling",          label: "Damage: Cupping/curling" },
      { kind: "boolean", path: "roof.secondary.damage.excessiveGranuleLoss",    label: "Damage: Excessive granule loss" },
      { kind: "boolean", path: "roof.secondary.damage.exposedAsphalt",          label: "Damage: Exposed asphalt" },
      { kind: "boolean", path: "roof.secondary.damage.exposedFelt",             label: "Damage: Exposed felt" },
      { kind: "boolean", path: "roof.secondary.damage.missingLooseCrackedTabs", label: "Damage: Missing/loose/cracked tabs or tiles" },
      { kind: "boolean", path: "roof.secondary.damage.softSpotsInDecking",      label: "Damage: Soft spots in decking" },
      { kind: "boolean", path: "roof.secondary.damage.visibleHailDamage",       label: "Damage: Visible hail damage" },
      { kind: "boolean", path: "roof.secondary.visibleLeaks",         label: "Any visible signs of leaks?" },
      { kind: "boolean", path: "roof.secondary.leakAtticUnderside",   label: "Leak — attic/underside of decking?" },
      { kind: "boolean", path: "roof.secondary.leakInteriorCeilings", label: "Leak — interior ceilings?" },
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
      // 04/26 form: the only checkboxes are A (toenails) and the three
      // "minimal conditions" 1/2/3. Pick the WEAKEST directly.
      {
        kind: "enum", path: "roofToWallAttachment", label: "WEAKEST connection",
        options: [
          { value: "a_toe_nails", label: "A. Toenails" },
          { value: "m1", label: "1. Metal connectors, ≥ 3 nails to truss/rafter + top plate, ≤ ½\" gap, no corrosion" },
          { value: "m2", label: "2. Single strap wrapping over truss/rafter, ≥ 3 nails each side, no corrosion" },
          { value: "m3", label: "3. Purpose-made connector / structural fastener per manufacturer spec" },
        ],
      },
      // ── A. Toenails qualifying condition (shows only if A picked) ─────
      {
        kind: "enum", path: "roofToWallAQualifier", label: "A. Toenails — which applies",
        showIf: { path: "roofToWallAttachment", equals: "a_toe_nails" },
        options: [
          { value: "a1", label: "A1. Anchored to top plate w/ nails at an angle through truss/rafter" },
          { value: "a2", label: "A2. Metal connectors/fasteners not installed as intended / don't meet 1, 2 or 3" },
          { value: "a3", label: "A3. Other documented method ≥ 185 lbs uplift" },
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
