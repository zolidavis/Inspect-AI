/**
 * Local-disk storage backend (DEV ONLY).
 *
 * This file imports `node:fs/promises` and `node:path` statically.
 * Those are NOT available on Vercel Edge — so the Vercel build script
 * replaces this entire module with a stub (`scripts/build-vercel.mjs`
 * → esbuild plugin). At runtime in Node, this file loads normally.
 */
import { mkdir, writeFile, readFile, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Storage } from "./storage.js";

const LOCAL_UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

function publicBaseUrl(): string {
  return process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`;
}

export function createLocalStorage(): Storage {
  async function readImpl(key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const target = join(LOCAL_UPLOAD_DIR, key);
    await stat(target); // throws if missing → 404 in caller
    const bytes = await readFile(target);
    const ext = key.split(".").pop()?.toLowerCase();
    const ct =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "png" ? "image/png"
      : ext === "webp" ? "image/webp"
      : ext === "heic" ? "image/heic"
      : "application/octet-stream";
    return { bytes: new Uint8Array(bytes), contentType: ct };
  }

  return {
    backend: "local",
    async put(key, bytes) {
      const target = join(LOCAL_UPLOAD_DIR, key);
      const dir = target.substring(0, target.lastIndexOf("/"));
      if (dir) await mkdir(dir, { recursive: true });
      await writeFile(target, bytes);
    },
    get: readImpl,
    async delete(key) {
      try {
        await unlink(join(LOCAL_UPLOAD_DIR, key));
      } catch {
        /* already gone — ignore */
      }
    },
    async signedGetUrl(key) {
      return `${publicBaseUrl()}/photos/local/${encodeURIComponent(key)}`;
    },
    readLocal: readImpl,
  };
}
