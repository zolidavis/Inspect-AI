import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { store } from "../store.js";
import { storage } from "../storage.js";

export const ai = new Hono();

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

/**
 * Per-tag instructions for the vision model.
 *
 * `fields` lists the EXACT form paths Claude is allowed to populate, the
 * allowed value type/enum, and what to look for. Claude must omit a field
 * rather than guess.
 *
 * Paths use dot notation rooted at the form payload — e.g. an entry on a
 * four-point photo writes to inspection.fourPoint.<path>, and a wind-mit
 * entry writes to inspection.windMit.<path>.
 */
type TagSpec = {
  form: "fourPoint" | "windMit";
  focus: string;
  fields: Array<{ path: string; type: string; description: string }>;
};

const TAG_SPECS: Record<string, TagSpec> = {
  "roof.covering": {
    form: "fourPoint",
    focus: "Roof covering material and condition.",
    fields: [
      { path: "roof.coveringType", type: "enum: asphalt_shingle|metal|tile|built_up|membrane|wood_shake|other", description: "What the roof is covered with." },
      { path: "roof.condition", type: "enum: good|fair|poor", description: "Overall condition rating." },
      { path: "roof.visibleDamage", type: "boolean", description: "True if any damage is visible." },
    ],
  },
  "roof.condition": {
    form: "fourPoint",
    focus: "Damage, granule loss, ponding, missing shingles, soft spots.",
    fields: [
      { path: "roof.condition", type: "enum: good|fair|poor", description: "Overall condition rating." },
      { path: "roof.visibleDamage", type: "boolean", description: "Any visible damage." },
      { path: "roof.notes", type: "string", description: "Brief description of damage if visible." },
    ],
  },
  "electrical.panel": {
    form: "fourPoint",
    focus: "Panel brand, amperage, hazardous panel makes (Federal Pacific, Zinsco, Challenger).",
    fields: [
      { path: "electrical.panelBrand", type: "string", description: "Manufacturer from the panel label." },
      { path: "electrical.panelAmps", type: "integer", description: "Main breaker amperage." },
      { path: "electrical.hazardsPresent", type: "boolean", description: "True for known hazardous panel makes or visible damage." },
      { path: "electrical.hazardsDescription", type: "string", description: "If hazardsPresent, brief reason." },
    ],
  },
  "electrical.wiring": {
    form: "fourPoint",
    focus: "Wiring type and condition.",
    fields: [
      { path: "electrical.wiringType", type: "enum: copper_romex|aluminum|knob_tube|mixed|other", description: "Predominant wiring observed." },
      { path: "electrical.hazardsPresent", type: "boolean", description: "Any visible hazards." },
    ],
  },
  "plumbing.supply": {
    form: "fourPoint",
    focus: "Supply piping material.",
    fields: [
      { path: "plumbing.supplyMaterial", type: "enum: copper|cpvc|pex|polybutylene|galvanized|mixed", description: "Material of supply lines." },
      { path: "plumbing.leaksObserved", type: "boolean", description: "Any visible active leaks." },
    ],
  },
  "plumbing.water_heater": {
    form: "fourPoint",
    focus: "Water heater data plate. Read manufacture date to compute age in years.",
    fields: [
      { path: "plumbing.waterHeaterAgeYears", type: "integer", description: "Age in years computed from manufacture date on data plate." },
      { path: "plumbing.leaksObserved", type: "boolean", description: "Any visible leaks around tank or fittings." },
    ],
  },
  "hvac.condenser": {
    form: "fourPoint",
    focus: "Condenser data plate (manufacturer, model, manufacture date).",
    fields: [
      { path: "hvac.systemType", type: "enum: central_ac|heat_pump|window_units|mini_split|other", description: "System type inferred from unit." },
      { path: "hvac.ageYears", type: "integer", description: "Age in years from data plate." },
      { path: "hvac.condition", type: "enum: good|fair|poor", description: "Visible condition." },
    ],
  },
  "hvac.air_handler": {
    form: "fourPoint",
    focus: "Air handler data plate and condition.",
    fields: [
      { path: "hvac.ageYears", type: "integer", description: "Age in years from data plate." },
      { path: "hvac.condition", type: "enum: good|fair|poor", description: "Visible condition." },
    ],
  },

  // Wind mit
  "wm.roof_covering": {
    form: "windMit",
    focus: "Roof covering material and FBC/Miami-Dade product approval markings.",
    fields: [
      { path: "roofCovering.type", type: "enum: asphalt_fiberglass_shingle|concrete_clay_tile|metal|built_up|membrane|wood_shake|other", description: "Material." },
      { path: "roofCovering.fbcOrMiamiDadeApproved", type: "boolean", description: "True if FBC/Miami-Dade product approval visible." },
      { path: "roofCovering.meetsCode", type: "enum: a_compliant|b_non_compliant|c_unknown", description: "Compliance status." },
    ],
  },
  "wm.roof_to_wall": {
    form: "windMit",
    focus: "Truss-to-wall connection: toe nails, clips, single wraps, double wraps, or structural.",
    fields: [
      { path: "roofToWallAttachment", type: "enum: a_toe_nails|b_clips|c_single_wraps|d_double_wraps|e_structural|f_other|g_unknown", description: "Connection classification per OIR-B1-1802 section 4." },
    ],
  },
  "wm.roof_geometry": {
    form: "windMit",
    focus: "Roof shape: hip, flat, or other (gable etc.).",
    fields: [
      { path: "roofGeometry", type: "enum: a_hip|b_flat|c_other", description: "Roof geometry per section 5." },
    ],
  },
  "wm.opening_protection": {
    form: "windMit",
    focus: "Hurricane shutters or impact-rated openings, including labels.",
    fields: [
      { path: "openingProtection", type: "enum: a_hurricane_impact|b_basic_impact|c_none|n_other|x_unknown", description: "Opening protection per section 7." },
    ],
  },
  "wm.swr": {
    form: "windMit",
    focus: "Secondary water resistance — self-adhering polymer-modified bitumen roofing underlayment.",
    fields: [
      { path: "secondaryWaterResistance", type: "enum: a_yes|b_no|c_unknown", description: "SWR present?" },
    ],
  },
  "wm.roof_deck_attic": {
    form: "windMit",
    focus: "Deck material and nailing pattern visible from attic.",
    fields: [
      { path: "roofDeckAttachment", type: "enum: a_plywood_osb_6d_nails_6_12|b_plywood_osb_8d_nails_6_12|c_plywood_osb_8d_nails_6_6|d_reinforced_concrete|e_other|f_unknown", description: "Roof deck attachment per section 3." },
    ],
  },
};

const Body = z.object({ photoId: z.string().uuid() });

ai.post("/analyze", async (c) => {
  const parsed = Body.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const photo = await store.getPhoto(parsed.data.photoId);
  if (!photo) return c.json({ error: "photo_not_found" }, 404);

  const spec = TAG_SPECS[photo.tag];

  if (!client) {
    const analysis = {
      summary: "AI analysis unavailable (ANTHROPIC_API_KEY not set).",
      findings: [],
    };
    await store.putPhoto({ ...photo, aiAnalysis: analysis });
    return c.json(analysis);
  }

  // Fetch the photo bytes through the storage adapter (R2 or local).
  const fetched = await storage.get(photo.storageKey);
  const base64 = fetched.bytes.toString("base64");
  const mediaType =
    fetched.contentType.startsWith("image/")
      ? (fetched.contentType as "image/jpeg" | "image/png" | "image/webp")
      : photo.storageKey.endsWith(".png") ? "image/png" : "image/jpeg";

  const fieldList = spec
    ? spec.fields
        .map((f) => `  - "${f.path}" (${f.type}) — ${f.description}`)
        .join("\n")
    : "  (no field map for this tag — return free-form findings)";

  const system = [
    "You are a licensed Florida home inspector reviewing a single inspection photo.",
    "Return STRICT JSON only — no prose, no markdown — matching this shape:",
    '{"summary": string, "findings": [{"field": string, "value": string, "confidence": number, "notes"?: string}]}',
    "Rules:",
    "  • `field` MUST be one of the allowed paths below. Omit any field you cannot confidently read.",
    "  • `value` is always a string. For booleans use 'true'/'false'. For enums use the exact code (e.g. 'a_clips'). For integers, digits only.",
    "  • `confidence` is 0..1. Be conservative — under 0.5 for fields you're guessing.",
    "  • Today is " + new Date().toISOString().slice(0, 10) + ". Compute ages from manufacture dates on data plates.",
  ].join("\n");

  const userText = [
    `Photo tag: ${photo.tag}`,
    `Focus: ${spec?.focus ?? "Describe inspection-relevant details."}`,
    `Allowed fields:`,
    fieldList,
    `\nReturn JSON only.`,
  ].join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: userText },
        ],
      },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  let analysis: { summary: string; findings: any[] };
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    analysis = JSON.parse(text.slice(start, end + 1));
  } catch {
    analysis = { summary: text.slice(0, 500), findings: [] };
  }

  // Filter to allowed paths so a hallucinated field can't slip through.
  if (spec) {
    const allowed = new Set(spec.fields.map((f) => f.path));
    analysis.findings = (analysis.findings ?? []).filter(
      (f) => f && typeof f.field === "string" && allowed.has(f.field)
    );
  }

  await store.putPhoto({ ...photo, aiAnalysis: analysis as any });
  return c.json(analysis);
});

/** Exported so the suggestions route can resolve which form a tag writes to. */
export function formForTag(tag: string): "fourPoint" | "windMit" | null {
  return TAG_SPECS[tag]?.form ?? null;
}
