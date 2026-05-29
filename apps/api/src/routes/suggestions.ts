import { Hono } from "hono";
import { z } from "zod";
import { FourPoint, WindMit } from "@inspect-ai/shared";
import { store } from "../store.js";
import { formForTag } from "./ai.js";

export const suggestions = new Hono();

type FormKey = "fourPoint" | "windMit";

export interface Suggestion {
  form: FormKey;
  path: string;          // e.g. "electrical.panelAmps"
  value: unknown;        // coerced to the schema type
  rawValue: string;      // original string from Claude
  confidence: number;
  notes?: string;
  sourcePhotoId: string;
  sourcePhotoTag: string;
  currentValue: unknown; // what's already on the inspection at this path
  conflictsWithCurrent: boolean;
}

/** Walk a dot path on an object. */
function getAt(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}
/** Set a dot path on a (cloned) object, creating intermediate objects. */
function setAt(obj: any, path: string, value: unknown) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]!] = value;
  return obj;
}

/** Coerce a string finding to a JS value the form schema will accept. */
function coerce(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
  return raw;
}

/**
 * GET /inspections/:id/suggestions
 *
 * Aggregates all per-photo AI findings into a deduplicated list of
 * suggestions, highest-confidence first per (form, path).
 */
suggestions.get("/inspections/:id/suggestions", async (c) => {
  const inspection = await store.getInspection(c.req.param("id"));
  if (!inspection) return c.json({ error: "not_found" }, 404);
  const photos = await store.listPhotos(inspection.id);

  // (form, path) -> best suggestion so far
  const best = new Map<string, Suggestion>();

  for (const p of photos) {
    const form = formForTag(p.tag);
    if (!form || !p.aiAnalysis) continue;
    for (const f of p.aiAnalysis.findings ?? []) {
      if (!f.field || typeof f.field !== "string") continue;
      const key = `${form}:${f.field}`;
      const value = coerce(String(f.value));
      const current = getAt((inspection as any)[form], f.field);
      const conflicts = current !== undefined && current !== null && current !== value;
      const candidate: Suggestion = {
        form,
        path: f.field,
        value,
        rawValue: String(f.value),
        confidence: typeof f.confidence === "number" ? f.confidence : 0,
        notes: f.notes,
        sourcePhotoId: p.id,
        sourcePhotoTag: p.tag,
        currentValue: current ?? null,
        conflictsWithCurrent: conflicts,
      };
      const prev = best.get(key);
      if (!prev || candidate.confidence > prev.confidence) best.set(key, candidate);
    }
  }

  const list = [...best.values()].sort((a, b) => b.confidence - a.confidence);
  return c.json({ suggestions: list });
});

/**
 * POST /inspections/:id/apply
 *
 * body: { applied: [{ form, path, value }] }
 *
 * Merges accepted suggestions into fourPoint / windMit. Validates the
 * resulting form payload against the Zod schema — partial fields are OK
 * (we use .deepPartial()) so the form can be filled incrementally.
 */
const ApplyBody = z.object({
  applied: z.array(
    z.object({
      form: z.enum(["fourPoint", "windMit"]),
      path: z.string().min(1),
      value: z.unknown(),
    })
  ),
});

const FourPointPartial = FourPoint.FourPointFormSchema.deepPartial();
const WindMitPartial = WindMit.WindMitFormSchema.deepPartial();

suggestions.post("/inspections/:id/apply", async (c) => {
  const inspection = await store.getInspection(c.req.param("id"));
  if (!inspection) return c.json({ error: "not_found" }, 404);
  const parsed = ApplyBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const fourPoint: any = structuredClone(inspection.fourPoint ?? {});
  const windMit: any = structuredClone(inspection.windMit ?? {});

  for (const a of parsed.data.applied) {
    if (a.form === "fourPoint") setAt(fourPoint, a.path, a.value);
    else setAt(windMit, a.path, a.value);
  }

  const fpResult = FourPointPartial.safeParse(fourPoint);
  const wmResult = WindMitPartial.safeParse(windMit);
  if (!fpResult.success || !wmResult.success) {
    return c.json(
      {
        error: "validation_failed",
        fourPoint: fpResult.success ? null : fpResult.error.flatten(),
        windMit: wmResult.success ? null : wmResult.error.flatten(),
      },
      400
    );
  }

  const updated = {
    ...inspection,
    fourPoint: fpResult.data,
    windMit: wmResult.data,
    updatedAt: new Date().toISOString(),
  };
  await store.putInspection(updated);
  return c.json(updated);
});
