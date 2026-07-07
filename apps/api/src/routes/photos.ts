import { Hono } from "hono";
import type { Photo } from "@inspect-ai/shared";
import { store } from "../store.js";
import { buildPhotoKey, storage } from "../storage.js";

export const photos = new Hono();

const URL_TTL_SECONDS = Number(process.env.PHOTO_URL_TTL_SECONDS ?? "3600");

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_CAPTION_CHARS = 500;

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
  if (!(await store.getInspection(inspectionId))) {
    return c.json({ error: "inspection_not_found" }, 404);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "file too large (max 15 MB)" }, 413);
  }
  const mime = file.type || "image/jpeg";
  if (!ALLOWED_MIME.has(mime)) {
    return c.json({ error: `unsupported file type: ${mime}` }, 415);
  }

  const id = crypto.randomUUID();
  const key = buildPhotoKey(inspectionId, id, file.name || "photo.jpg");
  const bytes = new Uint8Array(await file.arrayBuffer());

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
  await store.putPhoto(photo);
  return c.json(await withUrl(photo), 201);
});

/**
 * GET /photos/inspection/:id
 * Returns the photos for an inspection, each with a freshly-signed URL.
 */
photos.get("/inspection/:id", async (c) => {
  const list = await store.listPhotos(c.req.param("id"));
  const withUrls = await Promise.all(list.map(withUrl));
  return c.json(withUrls);
});

/**
 * DELETE /photos/:id
 * Removes the photo from storage (best-effort) and the DB.
 */
photos.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const photo = await store.getPhoto(id);
  if (!photo) return c.json({ error: "not_found" }, 404);
  try {
    await storage.delete(photo.storageKey);
  } catch (err) {
    // Storage delete is best-effort — don't block the DB removal on it.
    console.error("[photos] storage.delete failed", err);
  }
  const ok = await store.deletePhoto(id);
  return c.json({ ok });
});

/**
 * PATCH /photos/:id
 * Body: { tag?: string, caption?: string, rotation?: number }
 *
 * Edits a photo from the management editor:
 *   • tag      — re-tag (correcting the AI auto-classifier). Changing the
 *                tag clears the stored aiAnalysis because the old findings
 *                were extracted for the OLD tag's field map; the client
 *                re-runs /ai/analyze afterward to repopulate.
 *   • caption  — inspector caption printed under the photo in the report.
 *   • rotation — display rotation in degrees (normalized to 0/90/180/270).
 */
photos.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const photo = await store.getPhoto(id);
  if (!photo) return c.json({ error: "not_found" }, 404);

  const next: typeof photo = { ...photo };
  let changed = false;

  if (typeof body?.tag === "string") {
    const tag = body.tag.trim();
    if (tag && tag !== photo.tag) {
      next.tag = tag;
      next.aiAnalysis = null; // stale findings were for the old tag
      changed = true;
    }
  }
  if (typeof body?.caption === "string") {
    const caption = body.caption.trim().slice(0, MAX_CAPTION_CHARS);
    if (caption !== (photo.caption ?? "")) {
      next.caption = caption || undefined;
      changed = true;
    }
  }
  if (typeof body?.rotation === "number" && Number.isFinite(body.rotation)) {
    const rotation = ((Math.round(body.rotation / 90) * 90) % 360 + 360) % 360;
    if (rotation !== (photo.rotation ?? 0)) {
      next.rotation = rotation || undefined;
      changed = true;
    }
  }

  if (!changed) return c.json(await withUrl(photo));
  const updated = await store.putPhoto(next);
  return c.json(await withUrl(updated));
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
    return c.body(bytes as unknown as ArrayBuffer); // Uint8Array bytes coerce fine
  } catch {
    return c.json({ error: "not_found" }, 404);
  }
});
