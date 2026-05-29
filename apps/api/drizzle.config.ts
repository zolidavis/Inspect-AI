import type { Config } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn(
    "drizzle.config: DATABASE_URL not set. drizzle-kit commands that " +
      "talk to the DB (e.g. push, studio) will fail until it is.",
  );
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: url ?? "" },
} satisfies Config;
