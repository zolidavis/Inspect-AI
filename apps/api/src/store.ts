/**
 * Drizzle-backed store for inspections + photos. Async/await across
 * the board — postgres-js is promise-based (unlike better-sqlite3
 * which was sync). All route handlers that touch the store await.
 *
 * Swapping providers (Neon → another Postgres) only requires updating
 * the connection in ./db/client.ts.
 */
import { desc, eq } from "drizzle-orm";
import type { Inspection, Photo } from "@inspect-ai/shared";
import { db } from "./db/client.js";
import {
  inspections as inspectionsTable,
  photos as photosTable,
  type InspectionRow,
  type PhotoRow,
} from "./db/schema.js";

// ---- row <-> domain mappers ----

function rowToInspection(row: InspectionRow): Inspection {
  return {
    id: row.id,
    type: row.type as Inspection["type"],
    address: {
      line1: row.addressLine1,
      city: row.addressCity,
      state: row.addressState,
      zip: row.addressZip,
    },
    inspectorName: row.inspectorName ?? undefined,
    inspectorLicense: row.inspectorLicense ?? undefined,
    inspectorLicenseType: (row.inspectorLicenseType as Inspection["inspectorLicenseType"]) ?? undefined,
    inspectorCompany: row.inspectorCompany ?? undefined,
    inspectorPhone: row.inspectorPhone ?? undefined,
    ownerEmail: row.ownerEmail ?? undefined,
    ownerPhone: row.ownerPhone ?? undefined,
    property: (row.property as Inspection["property"]) ?? undefined,
    fourPoint: (row.fourPoint as Inspection["fourPoint"]) ?? undefined,
    windMit: (row.windMit as Inspection["windMit"]) ?? undefined,
    status: row.status as Inspection["status"],
    inspectedOn: row.inspectedOn ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // photos are populated separately by listPhotos in the route handler
    photos: [],
  };
}

function inspectionToRow(i: Inspection) {
  return {
    id: i.id,
    type: i.type,
    addressLine1: i.address.line1,
    addressCity: i.address.city,
    addressState: i.address.state,
    addressZip: i.address.zip,
    inspectorName: i.inspectorName ?? null,
    inspectorLicense: i.inspectorLicense ?? null,
    inspectorLicenseType: i.inspectorLicenseType ?? null,
    inspectorCompany: i.inspectorCompany ?? null,
    inspectorPhone: i.inspectorPhone ?? null,
    ownerEmail: i.ownerEmail ?? null,
    ownerPhone: i.ownerPhone ?? null,
    property: i.property ?? null,
    fourPoint: i.fourPoint ?? null,
    windMit: i.windMit ?? null,
    status: i.status,
    inspectedOn: i.inspectedOn ?? null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

function rowToPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    tag: row.tag,
    storageKey: row.storageKey,
    aiAnalysis: (row.aiAnalysis as Photo["aiAnalysis"]) ?? undefined,
    capturedAt: row.capturedAt,
  };
}

function photoToRow(p: Photo) {
  return {
    id: p.id,
    inspectionId: p.inspectionId,
    tag: p.tag,
    storageKey: p.storageKey,
    aiAnalysis: p.aiAnalysis ?? null,
    capturedAt: p.capturedAt,
  };
}

// ---- store API (all methods async now) ----

class Store {
  async listInspections(): Promise<Inspection[]> {
    const rows = await db
      .select()
      .from(inspectionsTable)
      .orderBy(desc(inspectionsTable.updatedAt));
    return rows.map(rowToInspection);
  }

  async getInspection(id: string): Promise<Inspection | undefined> {
    const rows = await db
      .select()
      .from(inspectionsTable)
      .where(eq(inspectionsTable.id, id))
      .limit(1);
    return rows[0] ? rowToInspection(rows[0]) : undefined;
  }

  async putInspection(i: Inspection): Promise<Inspection> {
    const row = inspectionToRow(i);
    await db
      .insert(inspectionsTable)
      .values(row)
      .onConflictDoUpdate({ target: inspectionsTable.id, set: row });
    return i;
  }

  async deleteInspection(id: string): Promise<boolean> {
    const result = await db
      .delete(inspectionsTable)
      .where(eq(inspectionsTable.id, id))
      .returning({ id: inspectionsTable.id });
    return result.length > 0;
  }

  async listPhotos(inspectionId: string): Promise<Photo[]> {
    const rows = await db
      .select()
      .from(photosTable)
      .where(eq(photosTable.inspectionId, inspectionId));
    return rows.map(rowToPhoto);
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    const rows = await db
      .select()
      .from(photosTable)
      .where(eq(photosTable.id, id))
      .limit(1);
    return rows[0] ? rowToPhoto(rows[0]) : undefined;
  }

  async putPhoto(p: Photo): Promise<Photo> {
    const row = photoToRow(p);
    await db
      .insert(photosTable)
      .values(row)
      .onConflictDoUpdate({ target: photosTable.id, set: row });
    return p;
  }
}

export const store = new Store();
