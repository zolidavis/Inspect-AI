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

    // Nested objects stored as JSONB. Shapes are validated by Zod schemas
    // in @inspect-ai/shared/forms/* before write.
    property: jsonb("property"),
    fourPoint: jsonb("four_point"),
    windMit: jsonb("wind_mit"),

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
