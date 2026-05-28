import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Photo } from "@inspect-ai/shared";
import { store } from "../store.js";

export const photos = new Hono();

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

/**
 * v1 photo upload: multipart/form-data with fields:
 *   inspectionId, tag, file
 * Stores to local disk. Swap for S3 presigned URLs in production.
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

  await mkdir(UPLOAD_DIR, { recursive: true });
  const id = randomUUID();
  const ext = file.name.split(".").pop() ?? "jpg";
  const key = `${inspectionId}/${id}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOAD_DIR, key.replace("/", "_")), buf);

  const photo: Photo = {
    id,
    inspectionId,
    tag,
    storageKey: key,
    capturedAt: new Date().toISOString(),
  };
  store.putPhoto(photo);
  return c.json(photo, 201);
});

photos.get("/inspection/:id", (c) => {
  return c.json(store.listPhotos(c.req.param("id")));
});
