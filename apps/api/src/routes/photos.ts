import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { Photo } from "@inspect-ai/shared";
import { store } from "../store.js";
import { buildPhotoKey, storage } from "../storage.js";

export const photos = new Hono();

const URL_TTL_SECONDS = Number(process.env.PHOTO_URL_TTL_SECONDS ?? "3600");

/** Add a fresh signed URL onto a stored Photo. */
async function withUrl(p: Photo): Promise<Photo> {
  try {
    const url = await storage.signedGetUrl(p.storageKey, URL_TTL_SECONDS);
    return { ...p, url };
  } catch {
    return p;
  }
}

/**
 * POST /photos
 * multipart/form-data: inspectionId, tag, file
 *
 * Writes the photo bytes through the storage adapter (R2 in prod,
 * local disk in dev) and returns the Photo record with a signed URL.
 */
photos.post("/", async (c) => {
  const form = await c.req.formData();
  const inspectionId = String(form.get("inspectionId") ?? "");
  const tag = String(form.get("tag") ?? "");
  const file = form.get("file");
  if (!inspectionId || !tag || !(file instanceof File)) {
    return c.json({ error: "missing_fields" }, 400);
  }
  if (!store.getInspection(inspectionId)) {
    return c.json({ error: "inspection_not_found" }, 404);
  }

  const id = randomUUID();
  const key = buildPhotoKey(inspectionId, id, file.name || "photo.jpg");
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await storage.put(key, bytes, { contentType: file.type || "image/jpeg" });
  } catch (err) {
    console.error("[photos] storage.put failed", err);
    return c.json({ error: "upload_failed" }, 502);
  }

  const photo: Photo = {
    id,
    inspectionId,
    tag,
    storageKey: key,
    capturedAt: new Date().toISOString(),
  };
  store.putPhoto(photo);
  return c.json(await withUrl(photo), 201);
});

/**
 * GET /photos/inspection/:id
 * Returns the photos for an inspection, each with a freshly-signed URL.
 */
photos.get("/inspection/:id", async (c) => {
  const list = store.listPhotos(c.req.param("id"));
  const withUrls = await Promise.all(list.map(withUrl));
  return c.json(withUrls);
});

/**
 * GET /photos/local/:key
 * Dev-only pass-through that serves a file from the local-disk backend.
 * R2 mode skips this route — clients hit Cloudflare directly via the
 * signed URL.
 */
photos.get("/local/:key{.+}", async (c) => {
  if (storage.backend !== "local" || !storage.readLocal) {
    return c.json({ error: "local_storage_disabled" }, 404);
  }
  const key = decodeURIComponent(c.req.param("key"));
  try {
    const { bytes, contentType } = await storage.readLocal(key);
    c.header("Content-Type", contentType);
    return c.body(bytes as unknown as ArrayBuffer);
  } catch {
    return c.json({ error: "not_found" }, 404);
  }
});
