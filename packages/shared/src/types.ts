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
  photos: z.array(PhotoSchema).default([]),
  inspectorName: z.string().optional(),
  inspectorLicense: z.string().optional(),
  /** Customer / property-owner contact, captured at inspection creation. */
  ownerEmail: z.string().optional(),
  ownerPhone: z.string().optional(),
  inspectedOn: z.string().optional(),
  status: z.enum(["draft", "in_progress", "complete"]).default("draft"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Inspection = z.infer<typeof InspectionSchema>;
