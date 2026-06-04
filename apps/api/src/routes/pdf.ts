import { Hono } from "hono";
import { PDFDocument } from "pdf-lib";
import { store } from "../store.js";
import { fillWindMit } from "../pdf/wind-mit.js";
import { fillFourPoint } from "../pdf/four-point.js";
import { buildPhotoPagesPdf } from "../pdf/photos-pages.js";

export const pdf = new Hono();

/**
 * GET /pdf/:inspectionId?type=four_point|wind_mitigation|both
 *
 *   - wind_mitigation: fills the OFFICIAL FL OIR-B1-1802 fillable AcroForm
 *     template. See pdf/wind-mit.ts for the mapping.
 *   - four_point: overlays values on the Citizens Insurance 4-Point form
 *     (Insp4pt 03 25), the de-facto carrier standard. See pdf/four-point.ts.
 *   - both: OIR-B1-1802 first, then Citizens 4-Point appended.
 *
 * In every case, all photos for the inspection are embedded onto
 * captioned pages and appended to the end of the report.
 */
pdf.get("/:inspectionId", async (c) => {
  const inspection = await store.getInspection(c.req.param("inspectionId"));
  if (!inspection) return c.json({ error: "not_found" }, 404);

  const type = (c.req.query("type") ?? inspection.type) as
    | "four_point"
    | "wind_mitigation"
    | "both";

  // Build the form-fill parts.
  const formParts: Uint8Array[] = [];
  if (type === "wind_mitigation") {
    formParts.push(await fillWindMit(inspection));
  } else if (type === "four_point") {
    formParts.push(await fillFourPoint(inspection));
  } else {
    formParts.push(await fillWindMit(inspection));
    formParts.push(await fillFourPoint(inspection));
  }

  // Append photo documentation pages (cover + one page per photo).
  // Photos live in their own table; fetch them by inspectionId.
  const photos = await store.listPhotos(inspection.id);
  const photoBytes = await buildPhotoPagesPdf(inspection, photos);

  const bytes = await mergePdfs([...formParts, photoBytes]);

  c.header("Content-Type", "application/pdf");
  c.header(
    "Content-Disposition",
    `inline; filename="inspection-${inspection.id}.pdf"`,
  );
  return c.body(bytes as unknown as ArrayBuffer);
});

// ─── PDF merge helper ──────────────────────────────────────────────────────

async function mergePdfs(parts: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const part of parts) {
    const src = await PDFDocument.load(part);
    if (src.getPageCount() === 0) continue; // skip empty parts (no photos)
    const copied = await out.copyPages(src, src.getPageIndices());
    for (const p of copied) out.addPage(p);
  }
  return await out.save();
}
