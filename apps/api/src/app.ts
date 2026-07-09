import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { inspections } from "./routes/inspections";
import { photos } from "./routes/photos";
import { address } from "./routes/address";
import { ai } from "./routes/ai";
import { pdf } from "./routes/pdf";
import { suggestions } from "./routes/suggestions";

/**
 * Hono app. Exported separately from the dev-server entry so it can be
 * mounted both locally (via `@hono/node-server`) and on Vercel
 * serverless functions (via `hono/vercel` from `../api/index.ts`).
 */
export const app = new Hono();

// Redact the `?key=` credential (used by plain-URL PDF downloads) from the
// request log — hono's logger writes the full path incl. query string, which
// would otherwise leak the shared API key into Vercel logs on every PDF fetch.
const redactKey = (msg: string, ...rest: string[]) =>
  console.log(msg.replace(/([?&]key=)[^&\s]+/gi, "$1[REDACTED]"), ...rest);
app.use("*", logger(redactKey));
app.use("*", cors());

/** Length-checked constant-time string compare (Edge-safe, no node:crypto). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Never leak internal errors/stack traces to clients.
app.onError((err, c) => {
  console.error("[api] unhandled error", err);
  return c.json({ error: "internal_error" }, 500);
});

// --- API key auth -----------------------------------------------------
// Shared-key gate (v1 — not per-user auth). If API_KEY is unset (local dev
// without env), all requests pass — matching the project convention that
// every external key is optional in dev.
//
// Accepted credentials:
//   • Authorization: Bearer <key>
//   • x-api-key: <key>            (what the mobile client sends)
//   • ?key=<key>                  (for plain-URL consumers, i.e. the PDF
//                                  download via FileSystem.downloadAsync)
app.use("*", async (c, next) => {
  const required = process.env.API_KEY;
  if (!required) return next();

  const path = new URL(c.req.url).pathname;
  // Public endpoints: root + health (uptime checks) and the dev-only
  // local-photo passthrough (only active when R2 is not configured).
  if (path === "/" || path === "/health" || path.startsWith("/photos/local/")) {
    return next();
  }

  const auth = c.req.header("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const headerKey = c.req.header("x-api-key") ?? "";
  const queryKey = c.req.query("key") ?? "";

  if (
    safeEqual(bearer, required) ||
    safeEqual(headerKey, required) ||
    safeEqual(queryKey, required)
  ) {
    return next();
  }
  return c.json({ error: "unauthorized" }, 401);
});

app.get("/", (c) => c.json({ name: "inspect-ai-api", status: "ok" }));
app.get("/health", (c) => c.json({ ok: true }));

app.route("/inspections", inspections);
app.route("/photos", photos);
app.route("/address", address);
app.route("/ai", ai);
app.route("/pdf", pdf);
// `suggestions` defines its own /inspections/:id/* paths so it mounts at root.
app.route("/", suggestions);
