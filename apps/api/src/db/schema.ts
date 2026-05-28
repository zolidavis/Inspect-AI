/**
 * Drizzle schema for Inspect AI.
 *
 * SQLite for local dev; designed to be Postgres-compatible for prod
 * (text IDs, ISO date strings, JSON columns). Swap the dialect package
 * (`drizzle-orm/better-sqlite3` → `drizzle-orm/postgres-js`) without
 * touching this file (column types map cleanly).
 */
import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const inspections = sqliteTable(
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

    // Nested objects stored as JSON. Shapes are validated by Zod schemas
    // in @inspect-ai/shared/forms/* before write.
    property: text("property", { mode: "json" }),
    fourPoint: text("four_point", { mode: "json" }),
    windMit: text("wind_mit", { mode: "json" }),

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

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    inspectionId: text("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    storageKey: text("storage_key").notNull(),
    // { summary: string, findings: [...] } per the AI analyze route
    aiAnalysis: text("ai_analysis", { mode: "json" }),
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
