import { z } from "zod";

export const AddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().length(2).default("FL"),
  zip: z.string().min(5),
});
export type Address = z.infer<typeof AddressSchema>;

export const PropertyLookupSchema = z.object({
  address: AddressSchema,
  ownerName: z.string().nullable(),
  yearBuilt: z.number().int().nullable(),
  squareFootage: z.number().int().nullable(),
  lotSize: z.number().nullable(),
  bedrooms: z.number().int().nullable(),
  bathrooms: z.number().nullable(),
  parcelId: z.string().nullable(),
  /** FL county the property is in. Used to detect HVHZ (Miami-Dade / Broward). */
  county: z.string().nullable().optional(),
  /** Number of stories above grade. Stamped on OIR-B1-1802 page 1 ("# of Stories"). */
  numberOfStories: z.number().int().nullable().optional(),
  // Permits stubbed for v1 — wire county scrapers later.
  permits: z
    .array(
      z.object({
        number: z.string(),
        description: z.string(),
        issuedOn: z.string(), // ISO date
        status: z.string().optional(),
      })
    )
    .default([]),
  source: z.enum(["rentcast", "mock", "county"]),
});
export type PropertyLookup = z.infer<typeof PropertyLookupSchema>;

export const InspectionTypeSchema = z.enum(["four_point", "wind_mitigation", "both"]);
export type InspectionType = z.infer<typeof InspectionTypeSchema>;

/**
 * Minimum Photo Requirements — the 6 checkboxes printed on page 1 of the
 * Citizens 4-Point form. Inspector confirms they shot each category before
 * the form is submitted. We persist the booleans so the PDF reflects the
 * inspector's commitments and the mobile UI can show "X of 6 confirmed".
 */
export const PhotoRequirementsSchema = z.object({
  dwellingEachSide: z.boolean().optional(),
  roofEachSlope: z.boolean().optional(),
  plumbingWaterHeater: z.boolean().optional(),
  electricalServicePanel: z.boolean().optional(),
  electricalBoxWithPanelOff: z.boolean().optional(),
  hazardsOrDeficiencies: z.boolean().optional(),
});
export type PhotoRequirements = z.infer<typeof PhotoRequirementsSchema>;

/**
 * Human-readable labels matching the form's printed text. Used by the
 * mobile UI + report cover page if we ever want to surface them.
 */
export const PHOTO_REQUIREMENT_LABELS: Record<keyof PhotoRequirements, string> = {
  dwellingEachSide:          "Dwelling: Each side",
  roofEachSlope:             "Roof: Each slope",
  plumbingWaterHeater:       "Plumbing: Water heater (incl TPRV), under cabinet plumbing/drains, exposed valves",
  electricalServicePanel:    "Main electrical service panel with interior door label",
  electricalBoxWithPanelOff: "Electrical box with panel off",
  hazardsOrDeficiencies:     "All hazards or deficiencies noted in this report",
};

/**
 * "I hold an active license as a:" — Qualified Inspector category on the
 * OIR-B1-1802 (Rev. 04/26) form. Stamped on every wind-mit report.
 */
export const InspectorLicenseTypeSchema = z.enum([
  "home_inspector",            // §468.8314, FL Statutes (home inspector)
  "building_code_inspector",   // §468.607 (building code inspector)
  "contractor",                // §489.111 (general / building / residential contractor)
  "engineer",                  // §471.015 (professional engineer)
  "architect",                 // §481.213 (professional architect)
  "other_authorized",          // any other entity recognized by the insurer
]);
export type InspectorLicenseType = z.infer<typeof InspectorLicenseTypeSchema>;

export const PhotoSchema = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid(),
  // Which form section/field this photo documents (e.g. "roof.covering", "electrical.panel").
  tag: z.string(),
  storageKey: z.string(),
  url: z.string().url().optional(),
  capturedAt: z.string(),
  aiAnalysis: z
    .object({
      summary: z.string(),
      findings: z.array(
        z.object({
          field: z.string(),
          value: z.string(),
          confidence: z.number().min(0).max(1),
          notes: z.string().optional(),
        })
      ),
    })
    .nullable()
    .optional(),
});
export type Photo = z.infer<typeof PhotoSchema>;

export const InspectionSchema = z.object({
  id: z.string().uuid(),
  type: InspectionTypeSchema,
  address: AddressSchema,
  property: PropertyLookupSchema.nullable().optional(),
  fourPoint: z.unknown().optional(),     // validated by forms/four-point
  windMit: z.unknown().optional(),       // validated by forms/wind-mitigation
  /** Inspector's pre-flight photo checklist (page 1 of Citizens 4-Point). */
  photoRequirements: PhotoRequirementsSchema.optional(),
  photos: z.array(PhotoSchema).default([]),
  inspectorName: z.string().optional(),
  inspectorLicense: z.string().optional(),
  /** "I hold an active license as a:" category from the OIR-B1-1802 form. */
  inspectorLicenseType: InspectorLicenseTypeSchema.optional(),
  /** Inspection company name. */
  inspectorCompany: z.string().optional(),
  /** Inspector contact phone. */
  inspectorPhone: z.string().optional(),
  /** Inspector / business contact email. Surfaced on the cover page. */
  inspectorEmail: z.string().optional(),
  /** Customer / property-owner contact, captured at inspection creation. */
  ownerEmail: z.string().optional(),
  ownerPhone: z.string().optional(),
  /**
   * Inspector signature as a data URI (base64 PNG, ~5-30 KB). Copied
   * from the Profile signature at inspection-create time, stamped on
   * the page-6 inspector signature line.
   */
  inspectorSignaturePng: z.string().optional(),
  /**
   * Optional inspector business logo as a base64 data URI (PNG/JPEG,
   * usually 20-200 KB). When set, the PDF gets a cover page with the
   * logo + inspection address + owner + date.
   */
  businessLogoPng: z.string().optional(),
  /**
   * Homeowner signature as a data URI. Captured per-inspection from
   * the /sign screen (inspector hands the phone to the homeowner).
   */
  homeownerSignaturePng: z.string().optional(),
  /** ISO timestamp the homeowner signed. */
  homeownerSignedAt: z.string().optional(),
  inspectedOn: z.string().optional(),
  status: z.enum(["draft", "in_progress", "complete"]).default("draft"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Inspection = z.infer<typeof InspectionSchema>;
