import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { FourPoint, WindMit } from "@inspect-ai/shared";
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

/**
 * Plain-English label per tag, used in the classifier prompt so Claude
 * can match a photo to the right section. The classifier sees one
 * bulleted line per tag — keep these terse and concrete.
 */
const TAG_DESCRIPTIONS: Record<string, string> = {
  // four-point
  "roof.covering":          "Exterior roof shot showing the covering material (shingles, tile, metal, etc.).",
  "roof.condition":         "Roof close-up showing damage, granule loss, ponding, soft spots, or missing material.",
  "electrical.panel":       "Open electrical panel box showing breakers, main breaker, label / data plate.",
  "electrical.wiring":      "Branch wiring close-up (Romex, aluminum, knob-and-tube).",
  "plumbing.supply":        "Supply piping (copper, CPVC, PEX, polybutylene, galvanized) visible at a fixture or under sink.",
  "plumbing.water_heater":  "Water heater unit, ideally with the data plate showing manufacture date.",
  "hvac.condenser":         "Outdoor HVAC condenser unit with data plate visible.",
  "hvac.air_handler":       "Indoor HVAC air handler with data plate.",
  // wind-mit
  "wm.elevation":           "Exterior elevation of the building (front / rear / side view of the whole house).",
  "wm.roof_covering":       "Roof covering shot focused on FBC / Miami-Dade product approval marks or material identification.",
  "wm.roof_deck_attic":     "Inside-the-attic shot showing roof deck plywood/OSB and nailing pattern.",
  "wm.roof_to_wall":        "Truss-to-wall connection: toe nails, clips, single wraps, double wraps, or structural strap.",
  "wm.roof_geometry":       "Aerial / wide exterior shot showing the roof shape (hip, flat, gable, etc.).",
  "wm.swr":                 "Secondary water resistance — self-adhering bitumen underlayment visible on the roof deck.",
  "wm.opening_protection":  "Hurricane shutters or impact-rated window / door, ideally with the label visible.",
  "wm.permit_documents":    "Building permit document or paperwork (close-up of the permit page itself).",
};

/** Tags relevant for an inspection of the given type. */
function tagsForInspectionType(t: "four_point" | "wind_mitigation" | "both"): string[] {
  if (t === "four_point") return [...FourPoint.photoTags];
  if (t === "wind_mitigation") return [...WindMit.photoTags];
  return [...FourPoint.photoTags, ...WindMit.photoTags];
}

/** Strip code fences / extra prose around a JSON blob so JSON.parse can run. */
function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

const Body = z.object({ photoId: z.string().uuid() });

/**
 * POST /ai/auto-analyze
 *
 * Single-call "shoot anything, AI figures out what section it belongs
 * to" flow for inspectors who don't want to pick a tag for every shot.
 * Server performs:
 *
 *   1. Classify the photo into one of the tags valid for the inspection
 *      type (TAG_DESCRIPTIONS) — small/short Claude call.
 *   2. Re-tag the stored Photo row to the classified tag.
 *   3. Run the existing /analyze pipeline (TAG_SPECS-constrained field
 *      extraction) with the new tag so the suggestions screen sees real
 *      fields, not a free-form summary.
 *
 * Returns: { classifiedAs, summary, findings } so the mobile camera
 * screen can display "Classified as X" alongside the analysis.
 */
ai.post("/auto-analyze", async (c) => {
  const parsed = Body.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const photo = await store.getPhoto(parsed.data.photoId);
  if (!photo) return c.json({ error: "photo_not_found" }, 404);
  const inspection = await store.getInspection(photo.inspectionId);
  if (!inspection) return c.json({ error: "inspection_not_found" }, 404);

  // No Claude key → return a stub so the mobile flow still works in dev.
  if (!client) {
    return c.json({
      classifiedAs: photo.tag,
      summary: "AI classification unavailable (ANTHROPIC_API_KEY not set).",
      findings: [],
    });
  }

  const validTags = tagsForInspectionType(
    inspection.type as "four_point" | "wind_mitigation" | "both",
  );

  // Fetch the photo bytes (used for BOTH the classify and analyze calls).
  const fetched = await storage.get(photo.storageKey);
  const base64 = uint8ToBase64(fetched.bytes);
  const mediaType =
    fetched.contentType.startsWith("image/")
      ? (fetched.contentType as "image/jpeg" | "image/png" | "image/webp")
      : photo.storageKey.endsWith(".png") ? "image/png" : "image/jpeg";

  // ── Step 1: Classify ────────────────────────────────────────────────
  const classifyList = validTags
    .map((t) => `  - "${t}" — ${TAG_DESCRIPTIONS[t] ?? "(no description)"}`)
    .join("\n");

  const classifySystem = [
    "You are classifying a single home-inspection photo into ONE of the",
    "allowed section tags below. Return STRICT JSON only — no prose, no",
    "markdown — matching this shape:",
    '{"tag": string, "confidence": number}',
    "Rules:",
    "  • `tag` MUST be one of the exact strings listed.",
    "  • `confidence` is 0..1. Be conservative.",
    "  • If the photo doesn't clearly match any section, pick the closest",
    "    and lower confidence — never invent a tag.",
  ].join("\n");

  const classifyUser = [
    "Pick the single best tag for this photo. Allowed tags:",
    classifyList,
    "\nReturn JSON only.",
  ].join("\n");

  let classifiedAs = photo.tag;
  let classifyConfidence = 0;
  try {
    const classifyMsg = await client.messages.create({
      model: MODEL,
      max_tokens: 128,
      system: classifySystem,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: classifyUser },
          ],
        },
      ],
    });
    const text = classifyMsg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const json = extractJson(text);
    if (json) {
      const parsedC = JSON.parse(json) as { tag?: string; confidence?: number };
      if (typeof parsedC.tag === "string" && validTags.includes(parsedC.tag)) {
        classifiedAs = parsedC.tag;
        classifyConfidence = Number(parsedC.confidence ?? 0);
      }
    }
  } catch (err) {
    // Classification failure shouldn't 500 — fall through with original tag.
    console.warn("[ai/auto-analyze] classify failed:", err);
  }

  // ── Step 2: Re-tag the stored photo ─────────────────────────────────
  if (classifiedAs !== photo.tag) {
    await store.putPhoto({ ...photo, tag: classifiedAs });
  }

  // ── Step 3: Run the existing field-extraction analyze pass ──────────
  // Inline the analyze flow so we re-use the bytes we already fetched.
  const spec = TAG_SPECS[classifiedAs];
  const fieldList = spec
    ? spec.fields
        .map((f) => `  - "${f.path}" (${f.type}) — ${f.description}`)
        .join("\n")
    : "  (no field map for this tag — return free-form findings)";

  const analyzeSystem = [
    "You are a licensed Florida home inspector reviewing a single inspection photo.",
    "Return STRICT JSON only — no prose, no markdown — matching this shape:",
    '{"summary": string, "findings": [{"field": string, "value": string, "confidence": number, "notes"?: string}]}',
    "Rules:",
    "  • `field` MUST be one of the allowed paths below. Omit any field you cannot confidently read.",
    "  • `value` is always a string. For booleans use 'true'/'false'. For enums use the exact code (e.g. 'a_clips'). For integers, digits only.",
    "  • `confidence` is 0..1. Be conservative — under 0.5 for fields you're guessing.",
    "  • Today is " + new Date().toISOString().slice(0, 10) + ". Compute ages from manufacture dates on data plates.",
  ].join("\n");

  const analyzeUser = [
    `Photo tag: ${classifiedAs}`,
    `Focus: ${spec?.focus ?? "Describe inspection-relevant details."}`,
    `Allowed fields:`,
    fieldList,
    `\nReturn JSON only.`,
  ].join("\n");

  let analysis: { summary: string; findings: any[] } = { summary: "", findings: [] };
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: analyzeSystem,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: analyzeUser },
          ],
        },
      ],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const json = extractJson(text);
    if (json) analysis = JSON.parse(json);
    else analysis = { summary: text.slice(0, 500), findings: [] };
  } catch (err) {
    console.warn("[ai/auto-analyze] analyze failed:", err);
    analysis = { summary: "Photo uploaded; AI analysis unavailable.", findings: [] };
  }

  // Filter to allowed paths so a hallucinated field can't slip through.
  if (spec) {
    const allowed = new Set(spec.fields.map((f) => f.path));
    analysis.findings = (analysis.findings ?? []).filter(
      (f) => f && typeof f.field === "string" && allowed.has(f.field),
    );
  }

  await store.putPhoto({
    ...photo,
    tag: classifiedAs,
    aiAnalysis: analysis as any,
  });

  return c.json({
    classifiedAs,
    classifyConfidence,
    summary: analysis.summary,
    findings: analysis.findings,
  });
});

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
  const base64 = uint8ToBase64(fetched.bytes);
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

/**
 * Convert Uint8Array → base64 string using only Web APIs.
 * Buffer.toString("base64") would be simpler but isn't reliably
 * present in Edge runtimes; btoa + chunked String.fromCharCode is.
 * Chunk size keeps us under the stack-arg-count ceiling on big files.
 */
function uint8ToBase64(u8: Uint8Array): string {
  const CHUNK = 0x8000;
  let s = "";
  for (let i = 0; i < u8.length; i += CHUNK) {
    s += String.fromCharCode.apply(
      null,
      u8.subarray(i, Math.min(i + CHUNK, u8.length)) as unknown as number[],
    );
  }
  return btoa(s);
}
