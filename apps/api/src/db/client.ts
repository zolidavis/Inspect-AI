/**
 * SQLite + Drizzle client. Auto-runs migrations from ./drizzle on
 * first import so `pnpm api` is a single command.
 *
 * For prod (Postgres), swap to:
 *   import { drizzle } from "drizzle-orm/postgres-js";
 *   import postgres from "postgres";
 *   const sql = postgres(process.env.DATABASE_URL!);
 *   export const db = drizzle(sql, { schema });
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as schema from "./schema.js";

const rawUrl = process.env.DATABASE_URL ?? "file:./inspect-ai.db";
const dbPath = rawUrl.replace(/^file:/, "");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Run pending migrations on startup. Path is relative to this source
// file so it works both from `tsx watch src/index.ts` and from compiled
// dist/.
const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, "../../drizzle");
migrate(db, { migrationsFolder });
