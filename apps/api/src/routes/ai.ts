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
  "roof.predominant": {
    form: "fourPoint",
    focus: "Main / largest roof covering material and condition.",
    fields: [
      { path: "roof.predominant.coveringMaterial", type: "enum: asphalt_shingle|metal|tile|built_up|membrane|wood_shake|other", description: "What the predominant roof is covered with." },
      { path: "roof.predominant.condition", type: "enum: satisfactory|unsatisfactory", description: "Overall condition rating." },
      { path: "roof.predominant.visibleDamage", type: "boolean", description: "True if any damage is visible." },
    ],
  },
  "roof.secondary": {
    form: "fourPoint",
    focus: "Secondary / smaller roof section covering material (separate from predominant).",
    fields: [
      { path: "roof.secondary.coveringMaterial", type: "enum: asphalt_shingle|metal|tile|built_up|membrane|wood_shake|other", description: "What the secondary roof is covered with." },
      { path: "roof.secondary.condition", type: "enum: satisfactory|unsatisfactory", description: "Overall condition rating." },
      { path: "roof.secondary.visibleDamage", type: "boolean", description: "True if any damage is visible." },
    ],
  },
  "roof.condition": {
    form: "fourPoint",
    focus: "Damage, granule loss, ponding, missing shingles, soft spots — usually on the predominant roof.",
    fields: [
      { path: "roof.predominant.condition", type: "enum: satisfactory|unsatisfactory", description: "Overall condition rating of predominant roof." },
      { path: "roof.predominant.visibleDamage", type: "boolean", description: "Any visible damage." },
      { path: "roof.notes", type: "string", description: "Brief description of damage if visible." },
    ],
  },
  "electrical.panel": {
    form: "fourPoint",
    focus: "Main panel: brand/model on the label, total amps from the main breaker, type (breaker vs fuse), and hazardous makes (Federal Pacific, Zinsco, Challenger).",
    fields: [
      { path: "electrical.mainPanel.brandModel", type: "string", description: "Manufacturer/model from the panel label." },
      { path: "electrical.mainPanel.totalAmps", type: "integer", description: "Total amperage from the main breaker." },
      { path: "electrical.mainPanel.type", type: "enum: circuit_breaker|fuse", description: "Panel type: modern circuit breaker or older fuse." },
      { path: "electrical.hazards.scorching", type: "boolean", description: "True if scorching/burning is visible inside the panel." },
      { path: "electrical.hazards.corrosion", type: "boolean", description: "True if corrosion is visible." },
      { path: "electrical.hazards.doubleTaps", type: "boolean", description: "True if double-tapped breakers visible." },
    ],
  },
  "electrical.wiring": {
    form: "fourPoint",
    focus: "Branch wiring type: Copper, NM/BX/Conduit, Single/Multistrand AL, Knob & Tube, Cloth.",
    fields: [
      { path: "electrical.wiringTypes.copper", type: "boolean", description: "True if standard copper wiring observed." },
      { path: "electrical.wiringTypes.nmBxOrConduit", type: "boolean", description: "True if NM cable, BX armored cable, or conduit observed." },
      { path: "electrical.wiringTypes.singleStrandAl", type: "boolean", description: "True if single-strand aluminum branch wiring observed (hazard)." },
      { path: "electrical.wiringTypes.clothKnobAndTube", type: "boolean", description: "True if cloth-insulated knob & tube observed (hazard)." },
      { path: "electrical.presence.activeKnobAndTube", type: "boolean", description: "True if knob & tube is still energized." },
      { path: "electrical.presence.clothWiring", type: "boolean", description: "True if cloth wiring observed." },
    ],
  },
  "plumbing.supply": {
    form: "fourPoint",
    focus: "Supply piping material — set the matching pipe-type flag(s).",
    fields: [
      { path: "plumbing.pipeTypes.copper", type: "boolean", description: "True if copper supply lines observed." },
      { path: "plumbing.pipeTypes.pvcCpvc", type: "boolean", description: "True if PVC/CPVC supply lines observed." },
      { path: "plumbing.pipeTypes.pex", type: "boolean", description: "True if PEX supply lines observed." },
      { path: "plumbing.pipeTypes.galvanized", type: "boolean", description: "True if galvanized steel supply lines observed (often a hazard)." },
      { path: "plumbing.pipeTypes.polybutylene", type: "boolean", description: "True if polybutylene supply lines observed (a hazard)." },
      { path: "plumbing.activeLeak", type: "boolean", description: "Any visible active leak." },
    ],
  },
  "plumbing.water_heater": {
    form: "fourPoint",
    focus: "Water heater data plate. Read manufacture date to compute age in years.",
    fields: [
      { path: "plumbing.waterHeaterAgeYears", type: "integer", description: "Age in years computed from manufacture date on data plate." },
      { path: "plumbing.activeLeak", type: "boolean", description: "Any visible leak around tank or fittings." },
      { path: "plumbing.tprvPresent", type: "boolean", description: "True if a temperature-pressure relief (TPR) valve is visible on the tank." },
    ],
  },
  "hvac.condenser": {
    form: "fourPoint",
    focus: "Outdoor condenser data plate (manufacturer, model, manufacture date).",
    fields: [
      { path: "hvac.centralAc", type: "boolean", description: "True if this is a central AC / heat-pump condenser (vs window/mini-split)." },
      { path: "hvac.ageYears", type: "integer", description: "Age in years from the data plate manufacture date." },
    ],
  },
  "hvac.air_handler": {
    form: "fourPoint",
    focus: "Indoor air handler data plate and condensate/drain pan condition.",
    fields: [
      { path: "hvac.ageYears", type: "integer", description: "Age in years from the data plate manufacture date." },
      { path: "hvac.hazards.airHandlerBlockageOrLeakage", type: "boolean", description: "True if the air handler/condensate line/drain pan shows blockage, leakage, or water damage." },
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
      { path: "roofToWallAttachment", type: "enum: a_toe_nails|m1|m2|m3", description: "OIR-B1-1802 (04/26) section 6 WEAKEST connection: a_toe_nails = toenails only; m1 = metal connectors with 3+ nails to truss/rafter and top plate; m2 = single strap wrapping over the truss/rafter with 3+ nails each side; m3 = purpose-made connector or structural fastener." },
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
  "roof.predominant":       "Exterior roof shot showing the COVERING MATERIAL of the main/largest roof (asphalt shingles, tile, metal). Use for a normal, undamaged main-roof material shot. The whole-roof-by-material default.",
  "roof.secondary":         "Exterior shot of a SEPARATE, smaller roof section (porch, carport, addition, dormer) that has a DIFFERENT covering than the main roof. Only when two distinct roof coverings are visible/implied.",
  "roof.condition":         "Roof CLOSE-UP whose subject is DAMAGE or wear — granule loss, cracked/curling/missing shingles, ponding water, soft spots, exposed felt. Pick this over roof.predominant when the photo's point is a defect, not the material.",
  "electrical.panel":       "The electrical service PANEL: an open breaker/fuse box showing rows of breakers, the main breaker, bus bars, or the panel label/data plate. Any panel-box interior or its rating sticker.",
  "electrical.wiring":      "BRANCH WIRING close-up — individual conductors/cables (Romex/NM, BX, aluminum, cloth, knob-and-tube) routed through framing, a junction box, or attic. NOT the panel box itself.",
  "plumbing.supply":        "SUPPLY/DRAIN PIPING runs — pipes under a sink, in a wall, or in the attic where you can identify the material (copper, CPVC, PEX, galvanized, polybutylene). NOT the water heater tank.",
  "plumbing.water_heater":  "The WATER HEATER TANK itself (cylindrical tank) or its rating/data plate. Use whenever the subject is the water-heater unit, even if pipes are visible on it.",
  "hvac.condenser":         "OUTDOOR HVAC unit — the condenser/heat-pump box sitting OUTSIDE on a pad or bracket beside the house, with a fan grille on top. Outdoors = condenser.",
  "hvac.air_handler":       "INDOOR HVAC unit — the air handler/furnace in a closet, garage, attic, or interior space, usually connected to ductwork or a condensate drain pan. Indoors = air handler.",
  // wind-mit
  "wm.elevation":           "Whole-building exterior — front, rear, or side view of the entire house/facade for documentation. Wide shot, no single component is the subject.",
  "wm.roof_covering":       "Roof covering shot whose subject is the FBC / Miami-Dade PRODUCT APPROVAL stamp or a material-ID marking (a label/sticker), used to verify code compliance.",
  "wm.roof_deck_attic":     "INSIDE-THE-ATTIC shot looking up at the underside of the roof deck — plywood/OSB sheathing and the NAIL pattern poking through. Taken from inside the attic.",
  "wm.roof_to_wall":        "TRUSS/RAFTER-TO-WALL connection close-up — metal hardware where a truss meets the top of the wall: toe nails, clips, single wraps, double wraps, or structural strap. Usually shot in the attic at the eave.",
  "wm.roof_geometry":       "Wide or aerial exterior showing the overall ROOF SHAPE (hip, gable, flat) — the silhouette/outline of the roof is the subject, not the covering material.",
  "wm.swr":                 "SECONDARY WATER RESISTANCE — a self-adhering peel-and-stick bitumen membrane/underlayment over the roof deck seams (often shot from above the deck during re-roof).",
  "wm.opening_protection":  "Window/door opening protection — hurricane shutters (accordion, panel, roll-down) or an impact-rated window/door, ideally with the impact-rating label visible.",
  "wm.permit_documents":    "A DOCUMENT — building permit, paperwork, or a screen/printout. The subject is printed text on paper, not a building component.",
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
    "You are an expert Florida home inspector sorting ONE inspection photo",
    "into the single section it documents. Identify the photo's PRIMARY",
    "SUBJECT (the component the inspector clearly aimed at), then choose the",
    "best-matching tag.",
    "",
    "Return STRICT JSON only — no prose, no markdown — matching this shape:",
    '{"reason": string, "tag": string, "confidence": number}',
    "Field order matters: write `reason` FIRST (one short sentence naming",
    "what you see and why it maps to the tag), THEN the `tag`, THEN",
    "`confidence` (0..1, conservative — below 0.5 when you are unsure).",
    "",
    "Rules:",
    "  • `tag` MUST be one of the exact strings listed in the user message.",
    "  • Decide by the dominant subject, not background clutter (e.g. pipes",
    "    behind a water-heater tank → it's still the water heater).",
    "",
    "Disambiguation cues:",
    "  • Breaker/fuse BOX interior or its rating label → electrical.panel.",
    "    Loose conductors/cables in framing or a junction box → electrical.wiring.",
    "  • HVAC unit OUTSIDE on a pad (fan grille on top) → hvac.condenser.",
    "    HVAC unit INSIDE a closet/garage/attic with ducts → hvac.air_handler.",
    "  • The cylindrical TANK → plumbing.water_heater. A run of PIPE you can",
    "    identify by material → plumbing.supply.",
    "  • Normal main-roof MATERIAL shot → roof.predominant. Subject is a",
    "    DEFECT (damage/wear) → roof.condition. A distinctly SEPARATE smaller",
    "    roof with a different covering → roof.secondary.",
    "  • Roof SILHOUETTE/shape from far away → wm.roof_geometry. A product-",
    "    approval/material LABEL on the covering → wm.roof_covering.",
    "  • Shot from INSIDE the attic of the deck underside + nails →",
    "    wm.roof_deck_attic. Metal connector where truss meets wall →",
    "    wm.roof_to_wall.",
    "  • Printed paper/permit → wm.permit_documents. Whole-house facade →",
    "    wm.elevation.",
  ].join("\n");

  const classifyUser = [
    "Classify this photo. Allowed tags:",
    classifyList,
    "\nReturn JSON only ({reason, tag, confidence}).",
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
