/**
 * Object storage adapter.
 *
 * Backends:
 *   - "r2"   when R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET are set
 *   - "local" otherwise → writes to ./uploads (dev only)
 *
 * R2 uses the standard S3 API, so @aws-sdk/client-s3 works as-is with
 * a custom endpoint. Photos are private; we serve them via presigned
 * GET URLs (1h expiry) returned with each Photo on read.
 *
 * Designed so the public API (put / signedGetUrl) is identical between
 * backends — routes don't care which one is active.
 */
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageBackend = "r2" | "local";

export interface PutOptions {
  contentType?: string;
}

export interface Storage {
  readonly backend: StorageBackend;
  put(key: string, bytes: Buffer, opts?: PutOptions): Promise<void>;
  /**
   * Fetch raw bytes for server-side use (e.g. feeding a photo into
   * Claude vision). Works in both backends.
   */
  get(key: string): Promise<{ bytes: Buffer; contentType: string }>;
  signedGetUrl(key: string, ttlSeconds?: number): Promise<string>;
  /** Local backend only — read raw bytes for the dev pass-through route. */
  readLocal?(key: string): Promise<{ bytes: Buffer; contentType: string }>;
}

// ─── R2 backend ────────────────────────────────────────────────────────────

function r2Client(accountId: string, accessKeyId: string, secretAccessKey: string): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function createR2Storage(): Storage {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  const client = r2Client(accountId, accessKeyId, secretAccessKey);

  return {
    backend: "r2",
    async put(key, bytes, opts) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: opts?.contentType ?? "application/octet-stream",
        }),
      );
    },
    async get(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!res.Body) throw new Error(`r2.get: empty body for ${key}`);
      const bytes = Buffer.from(await res.Body.transformToByteArray());
      return { bytes, contentType: res.ContentType ?? "application/octet-stream" };
    },
    async signedGetUrl(key, ttlSeconds = 3600) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: ttlSeconds,
      });
    },
  };
}

// ─── Local-disk backend (dev only) ─────────────────────────────────────────

const LOCAL_UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

/**
 * Mobile reads the API base URL from app.json#extra.apiBaseUrl. For
 * the local-served URL to actually reach the device we need that same
 * host:port. API_PUBLIC_URL lets you override (e.g. when serving from
 * a LAN IP for physical-device testing).
 */
function publicBaseUrl(): string {
  return process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;
}

function createLocalStorage(): Storage {
  async function readLocalImpl(key: string): Promise<{ bytes: Buffer; contentType: string }> {
    const target = join(LOCAL_UPLOAD_DIR, key);
    await stat(target); // throws if missing → 404 in caller
    const bytes = await readFile(target);
    // Best-effort content-type from extension.
    const ext = key.split(".").pop()?.toLowerCase();
    const ct =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "png" ? "image/png"
      : ext === "webp" ? "image/webp"
      : ext === "heic" ? "image/heic"
      : "application/octet-stream";
    return { bytes, contentType: ct };
  }

  return {
    backend: "local",
    async put(key, bytes) {
      // Preserve slashes so structure mirrors R2 paths. The dev GET
      // route below resolves these back.
      const target = join(LOCAL_UPLOAD_DIR, key);
      const dir = target.substring(0, target.lastIndexOf("/"));
      if (dir) await mkdir(dir, { recursive: true });
      await writeFile(target, bytes);
    },
    get: readLocalImpl,
    async signedGetUrl(key) {
      // Local "signing" is just opaque path encoding — the dev route
      // accepts the same key back. No expiry for dev.
      return `${publicBaseUrl()}/photos/local/${encodeURIComponent(key)}`;
    },
    readLocal: readLocalImpl,
  };
}

// ─── Singleton ─────────────────────────────────────────────────────────────

function chooseBackend(): Storage {
  const hasR2 =
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET;
  if (hasR2) {
    console.log("[storage] backend=r2 bucket=" + process.env.R2_BUCKET);
    return createR2Storage();
  }
  console.log("[storage] backend=local dir=" + LOCAL_UPLOAD_DIR);
  return createLocalStorage();
}

export const storage: Storage = chooseBackend();

/**
 * Helper: derive the file extension Mobile sends → a normalized key
 * with stable layout: `inspections/<id>/<photoId>.<ext>`.
 */
export function buildPhotoKey(inspectionId: string, photoId: string, filename: string): string {
  const rawExt = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : "jpg";
  return `inspections/${inspectionId}/${photoId}.${ext}`;
}
