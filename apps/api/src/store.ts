import type { Inspection, Photo } from "@inspect-ai/shared";

/**
 * Trivial in-memory store for v1. Swap for Drizzle + Postgres when ready.
 * Persists nothing across restarts.
 */
class Store {
  private inspections = new Map<string, Inspection>();
  private photos = new Map<string, Photo>();

  listInspections(): Inspection[] {
    return [...this.inspections.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }
  getInspection(id: string): Inspection | undefined {
    return this.inspections.get(id);
  }
  putInspection(i: Inspection): Inspection {
    this.inspections.set(i.id, i);
    return i;
  }
  deleteInspection(id: string): boolean {
    return this.inspections.delete(id);
  }

  listPhotos(inspectionId: string): Photo[] {
    return [...this.photos.values()].filter((p) => p.inspectionId === inspectionId);
  }
  getPhoto(id: string): Photo | undefined {
    return this.photos.get(id);
  }
  putPhoto(p: Photo): Photo {
    this.photos.set(p.id, p);
    return p;
  }
}

export const store = new Store();
