import { Hono } from "hono";
import {
  AddressSchema,
  FourPoint,
  InspectionTypeSchema,
  WindMit,
  type Inspection,
} from "@inspect-ai/shared";
import { z } from "zod";
import { store } from "../store.js";

export const inspections = new Hono();

const CreateBody = z.object({
  type: InspectionTypeSchema,
  address: AddressSchema,
  inspectorName: z.string().optional(),
  inspectorLicense: z.string().optional(),
  ownerEmail: z.string().optional(),
  ownerPhone: z.string().optional(),
});

inspections.get("/", async (c) => c.json(await store.listInspections()));

inspections.post("/", async (c) => {
  const parsed = CreateBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const now = new Date().toISOString();
  const inspection: Inspection = {
    id: crypto.randomUUID(),
    type: parsed.data.type,
    address: parsed.data.address,
    photos: [],
    inspectorName: parsed.data.inspectorName,
    inspectorLicense: parsed.data.inspectorLicense,
    ownerEmail: parsed.data.ownerEmail,
    ownerPhone: parsed.data.ownerPhone,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  await store.putInspection(inspection);
  return c.json(inspection, 201);
});

inspections.get("/:id", async (c) => {
  const i = await store.getInspection(c.req.param("id"));
  if (!i) return c.json({ error: "not_found" }, 404);
  const photos = await store.listPhotos(i.id);
  return c.json({ ...i, photos });
});

inspections.patch("/:id", async (c) => {
  const existing = await store.getInspection(c.req.param("id"));
  if (!existing) return c.json({ error: "not_found" }, 404);
  const patch = await c.req.json();
  const next: Inspection = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await store.putInspection(next);
  return c.json(next);
});

inspections.delete("/:id", async (c) => {
  const ok = await store.deleteInspection(c.req.param("id"));
  return c.json({ ok });
});

/**
 * POST /inspections/:id/complete
 *
 * Runs the FULL (non-partial) form schemas against whichever forms apply
 * for this inspection's type. On success, sets status to "complete".
 * On failure, returns 400 with per-form flattened field errors so the
 * client can highlight what's missing.
 */
inspections.post("/:id/complete", async (c) => {
  const existing = await store.getInspection(c.req.param("id"));
  if (!existing) return c.json({ error: "not_found" }, 404);

  const needFp = existing.type === "four_point" || existing.type === "both";
  const needWm = existing.type === "wind_mitigation" || existing.type === "both";

  const fpResult = needFp
    ? FourPoint.FourPointFormSchema.safeParse(existing.fourPoint ?? {})
    : null;
  const wmResult = needWm
    ? WindMit.WindMitFormSchema.safeParse(existing.windMit ?? {})
    : null;

  const fpOk = !fpResult || fpResult.success;
  const wmOk = !wmResult || wmResult.success;

  if (!fpOk || !wmOk) {
    const fmt = (issues: import("zod").ZodIssue[] | undefined) =>
      (issues ?? []).map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
    return c.json(
      {
        error: "incomplete",
        fourPoint: fpResult && !fpResult.success ? fmt(fpResult.error.issues) : null,
        windMit: wmResult && !wmResult.success ? fmt(wmResult.error.issues) : null,
      },
      400
    );
  }

  const next: Inspection = {
    ...existing,
    status: "complete",
    inspectedOn: existing.inspectedOn ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await store.putInspection(next);
  return c.json(next);
});
