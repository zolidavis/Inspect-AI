/**
 * Standalone migration runner. Use `pnpm db:migrate` to apply pending
 * migrations against $DATABASE_URL. Safe to run repeatedly — Drizzle
 * tracks applied migrations in __drizzle_migrations.
 *
 * Uses a fresh unpooled connection so DDL doesn't conflict with the
 * pooler's session limits.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, "../../drizzle");

await migrate(db, { migrationsFolder });
await sql.end();
console.log("✓ migrations applied");
