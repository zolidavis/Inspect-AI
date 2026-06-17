/**
 * Object storage adapter — Edge-compatible.
 *
 * Backends:
 *   - "r2"    when R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET are set
 *   - "local" otherwise → writes to ./uploads (dev only)
 *
 * R2 uses SigV4 via `aws4fetch` (5 KB, pure Web Crypto + fetch).
 * The local backend's code lives in `./storage-local.ts` so that the
 * Edge build can stub it out — see `scripts/build-vercel.mjs`.
 */
import { AwsClient } from "aws4fetch";

export type StorageBackend = "r2" | "local";

export interface PutOptions {
  contentType?: string;
}

export interface Storage {
  readonly backend: StorageBackend;
  put(key: string, bytes: Uint8Array, opts?: PutOptions): Promise<void>;
  /** Fetch raw bytes (for Claude vision input, etc.). */
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string }>;
  /** Remove an object. No-op if it doesn't exist. */
  delete(key: string): Promise<void>;
  signedGetUrl(key: string, ttlSeconds?: number): Promise<string>;
  /** Local backend only — used by the dev pass-through route. */
  readLocal?(key: string): Promise<{ bytes: Uint8Array; contentType: string }>;
}

// ─── R2 backend ────────────────────────────────────────────────────────────

function r2BaseUrl(accountId: string, bucket: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
}

function createR2Storage(): Storage {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  const base = r2BaseUrl(accountId, bucket);

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });

  return {
    backend: "r2",
    async put(key, bytes, opts) {
      const res = await client.fetch(`${base}/${encodeURI(key)}`, {
        method: "PUT",
        body: bytes,
        headers: {
          "Content-Type": opts?.contentType ?? "application/octet-stream",
        },
      });
      if (!res.ok) {
        throw new Error(`r2.put failed ${res.status} ${await res.text()}`);
      }
    },
    async get(key) {
      const res = await client.fetch(`${base}/${encodeURI(key)}`);
      if (!res.ok) {
        throw new Error(`r2.get failed ${res.status} for ${key}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "application/octet-stream";
      return { bytes, contentType };
    },
    async delete(key) {
      const res = await client.fetch(`${base}/${encodeURI(key)}`, { method: "DELETE" });
      // R2 returns 204 on delete, 404 if already gone — both are fine.
      if (!res.ok && res.status !== 404) {
        throw new Error(`r2.delete failed ${res.status} for ${key}`);
      }
    },
    async signedGetUrl(key, ttlSeconds = 3600) {
      const signed = await client.sign(`${base}/${encodeURI(key)}`, {
        method: "GET",
        aws: { signQuery: true, allHeaders: false },
        headers: {
          "X-Amz-Expires": String(ttlSeconds),
        },
      });
      return signed.url;
    },
  };
}

// ─── Singleton ─────────────────────────────────────────────────────────────

function hasR2(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET,
  );
}

/**
 * Synchronous backend chooser — no top-level await (Vercel re-bundles
 * to CJS which can't use TLA). When R2 isn't configured, returns a
 * lazy proxy that dynamic-imports the Node-only local backend on
 * first use. On Edge, that dynamic import resolves to a stub injected
 * by `scripts/build-vercel.mjs` and throws if anyone calls it — but
 * since prod always has R2 configured, it's never invoked.
 */
function makeLazyLocalStorage(): Storage {
  let real: Storage | null = null;
  const load = async () => {
    if (!real) {
      const mod = await import("./storage-local.js");
      real = mod.createLocalStorage();
    }
    return real;
  };
  return {
    backend: "local",
    async put(key, bytes, opts) { return (await load()).put(key, bytes, opts); },
    async get(key) { return (await load()).get(key); },
    async delete(key) { return (await load()).delete(key); },
    async signedGetUrl(key, ttl) { return (await load()).signedGetUrl(key, ttl); },
    async readLocal(key) { return (await load()).readLocal!(key); },
  };
}

function chooseBackend(): Storage {
  if (hasR2()) {
    console.log("[storage] backend=r2 bucket=" + process.env.R2_BUCKET);
    return createR2Storage();
  }
  console.log("[storage] backend=local (lazy)");
  return makeLazyLocalStorage();
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
