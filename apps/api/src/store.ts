/**
 * Drizzle-backed store for inspections + photos.
 *
 * The store layer is a thin facade — routes call these methods, the
 * route data shape stays unchanged. Swapping SQLite → Postgres later
 * only requires changing the import in ./db/client.ts.
 *
 * NOTE: keep this synchronous-feeling. `better-sqlite3` is synchronous
 * by design; routes await nothing for DB work, which simplifies error
 * handling and matches the original in-memory Store API.
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

// ---- store API (signatures match the previous in-memory impl) ----

class Store {
  listInspections(): Inspection[] {
    return db
      .select()
      .from(inspectionsTable)
      .orderBy(desc(inspectionsTable.updatedAt))
      .all()
      .map(rowToInspection);
  }

  getInspection(id: string): Inspection | undefined {
    const row = db
      .select()
      .from(inspectionsTable)
      .where(eq(inspectionsTable.id, id))
      .get();
    return row ? rowToInspection(row) : undefined;
  }

  putInspection(i: Inspection): Inspection {
    const row = inspectionToRow(i);
    db.insert(inspectionsTable)
      .values(row)
      .onConflictDoUpdate({ target: inspectionsTable.id, set: row })
      .run();
    return i;
  }

  deleteInspection(id: string): boolean {
    const result = db
      .delete(inspectionsTable)
      .where(eq(inspectionsTable.id, id))
      .run();
    return result.changes > 0;
  }

  listPhotos(inspectionId: string): Photo[] {
    return db
      .select()
      .from(photosTable)
      .where(eq(photosTable.inspectionId, inspectionId))
      .all()
      .map(rowToPhoto);
  }

  getPhoto(id: string): Photo | undefined {
    const row = db
      .select()
      .from(photosTable)
      .where(eq(photosTable.id, id))
      .get();
    return row ? rowToPhoto(row) : undefined;
  }

  putPhoto(p: Photo): Photo {
    const row = photoToRow(p);
    db.insert(photosTable)
      .values(row)
      .onConflictDoUpdate({ target: photosTable.id, set: row })
      .run();
    return p;
  }
}

export const store = new Store();
