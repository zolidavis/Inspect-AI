/**
 * Drizzle + postgres-js client (Neon).
 *
 * Single source of truth for DB access. Runs on Node locally and on
 * Vercel's Edge runtime in prod — `postgres` is dual-published and the
 * pooled Neon URL works in both.
 *
 * Migrations are NOT auto-applied at import time anymore. Pooled
 * Postgres connections can flake on DDL, and Edge cold-starts shouldn't
 * pay the cost. Use `pnpm db:migrate` once after schema changes (the
 * standalone migrator in ./migrate.ts uses an unpooled connection).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Provision a Neon (or any Postgres) " +
      "instance and add the connection string to your env.",
  );
}

// `postgres` defaults are good. Tune for serverless if needed:
//   max: 1 — single connection per worker (Edge instance)
//   prepare: false — Neon's pooler doesn't support session-scoped prepared statements
const sql = postgres(url, {
  max: 1,
  prepare: false,
});

export const db = drizzle(sql, { schema });
