/**
 * Drizzle schema for Inspect AI (Postgres).
 *
 * Runs on Neon (prod + local dev) via postgres-js. JSONB columns hold
 * shapes validated by the Zod form schemas in @inspect-ai/shared/forms/*
 * before write.
 */
import { pgTable, text, jsonb, index } from "drizzle-orm/pg-core";

export const inspections = pgTable(
  "inspections",
  {
    id: text("id").primaryKey(),

    // Inspection type: 'four_point' | 'wind_mitigation' | 'both'
    type: text("type").notNull(),

    // Address (flattened — these are the four fields every inspection has)
    addressLine1: text("address_line1").notNull(),
    addressCity: text("address_city").notNull(),
    addressState: text("address_state").notNull(),
    addressZip: text("address_zip").notNull(),

    inspectorName: text("inspector_name"),
    inspectorLicense: text("inspector_license"),
    // Qualified Inspector certification (OIR-B1-1802 04/26).
    // Set once on the Profile screen, auto-stamped on every inspection.
    inspectorLicenseType: text("inspector_license_type"),
    inspectorCompany: text("inspector_company"),
    inspectorPhone: text("inspector_phone"),
    inspectorEmail: text("inspector_email"),

    // Customer / property-owner contact (captured at inspection creation).
    ownerEmail: text("owner_email"),
    ownerPhone: text("owner_phone"),

    // Signatures — base64 data URIs (~5-30 KB each). Inspector signature
    // comes from the Profile screen and is auto-stamped at create time;
    // homeowner signature is captured per-job on the /sign screen.
    inspectorSignaturePng: text("inspector_signature_png"),
    homeownerSignaturePng: text("homeowner_signature_png"),
    homeownerSignedAt: text("homeowner_signed_at"),
    // Optional inspector business logo (data URI) — drives the cover page.
    businessLogoPng: text("business_logo_png"),

    // Nested objects stored as JSONB. Shapes are validated by Zod schemas
    // in @inspect-ai/shared/forms/* before write.
    property: jsonb("property"),
    fourPoint: jsonb("four_point"),
    windMit: jsonb("wind_mit"),
    // Inspector's pre-flight photo checklist (page 1 of Citizens 4-Point).
    // 6 optional booleans, see PhotoRequirementsSchema.
    photoRequirements: jsonb("photo_requirements"),

    // 'draft' | 'complete'
    status: text("status").notNull().default("draft"),

    inspectedOn: text("inspected_on"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    statusIdx: index("inspections_status_idx").on(t.status),
    updatedAtIdx: index("inspections_updated_at_idx").on(t.updatedAt),
  }),
);

export const photos = pgTable(
  "photos",
  {
    id: text("id").primaryKey(),
    inspectionId: text("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    storageKey: text("storage_key").notNull(),
    // { summary: string, findings: [...] } per the AI analyze route
    aiAnalysis: jsonb("ai_analysis"),
    capturedAt: text("captured_at").notNull(),
  },
  (t) => ({
    inspectionIdx: index("photos_inspection_idx").on(t.inspectionId),
  }),
);

export type InspectionRow = typeof inspections.$inferSelect;
export type InspectionInsert = typeof inspections.$inferInsert;
export type PhotoRow = typeof photos.$inferSelect;
export type PhotoInsert = typeof photos.$inferInsert;
