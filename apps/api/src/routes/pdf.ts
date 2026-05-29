import { Hono } from "hono";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { store } from "../store.js";

export const pdf = new Hono();

/**
 * GET /pdf/:inspectionId?type=four_point|wind_mitigation
 *
 * Generates a printable inspection report. This is a layout-faithful
 * but NOT pixel-exact rendition of the official forms — to ship a
 * carrier-acceptable OIR-B1-1802, replace this with a fillable-PDF
 * template (pdf-lib + AcroForm fields).
 */
pdf.get("/:inspectionId", async (c) => {
  const inspection = await store.getInspection(c.req.param("inspectionId"));
  if (!inspection) return c.json({ error: "not_found" }, 404);
  const type = (c.req.query("type") ?? inspection.type) as
    | "four_point"
    | "wind_mitigation"
    | "both";

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const drawHeader = (page: any, title: string) => {
    page.drawText(title, { x: 50, y: 760, size: 18, font: bold });
    page.drawText(
      `${inspection.address.line1}, ${inspection.address.city}, ${inspection.address.state} ${inspection.address.zip}`,
      { x: 50, y: 740, size: 11, font }
    );
    if (inspection.property?.ownerName) {
      page.drawText(`Owner: ${inspection.property.ownerName}`, {
        x: 50, y: 725, size: 10, font,
      });
    }
    if (inspection.property?.yearBuilt) {
      page.drawText(`Year Built: ${inspection.property.yearBuilt}`, {
        x: 50, y: 710, size: 10, font,
      });
    }
    if (inspection.inspectorName) {
      page.drawText(
        `Inspector: ${inspection.inspectorName}${inspection.inspectorLicense ? ` (Lic. ${inspection.inspectorLicense})` : ""}`,
        { x: 50, y: 695, size: 10, font }
      );
    }
    page.drawLine({
      start: { x: 50, y: 685 }, end: { x: 545, y: 685 },
      thickness: 1, color: rgb(0, 0, 0),
    });
  };

  const drawKv = (page: any, y: number, k: string, v: string) => {
    page.drawText(k, { x: 50, y, size: 10, font: bold });
    page.drawText(v, { x: 220, y, size: 10, font });
  };

  if (type === "four_point" || type === "both") {
    const page = doc.addPage();
    drawHeader(page, "Florida 4-Point Inspection Report");
    const fp = (inspection.fourPoint ?? {}) as any;
    let y = 660;
    const rows: [string, string][] = [
      ["Roof Covering", fp?.roof?.coveringType ?? "—"],
      ["Roof Age (yrs)", String(fp?.roof?.ageYears ?? "—")],
      ["Roof Condition", fp?.roof?.condition ?? "—"],
      ["Electrical Panel", `${fp?.electrical?.panelBrand ?? "—"} @ ${fp?.electrical?.panelAmps ?? "—"}A`],
      ["Wiring Type", fp?.electrical?.wiringType ?? "—"],
      ["Plumbing Supply", fp?.plumbing?.supplyMaterial ?? "—"],
      ["Water Heater Age", String(fp?.plumbing?.waterHeaterAgeYears ?? "—")],
      ["HVAC Type", fp?.hvac?.systemType ?? "—"],
      ["HVAC Age", String(fp?.hvac?.ageYears ?? "—")],
    ];
    for (const [k, v] of rows) { drawKv(page, y, k, v); y -= 22; }
  }

  if (type === "wind_mitigation" || type === "both") {
    const page = doc.addPage();
    drawHeader(page, "Uniform Mitigation Verification (OIR-B1-1802)");
    const wm = (inspection.windMit ?? {}) as any;
    let y = 660;
    const rows: [string, string][] = [
      ["1. Building Code", wm?.buildingCode ?? "—"],
      ["2. Roof Covering", wm?.roofCovering?.type ?? "—"],
      ["   Meets Code", wm?.roofCovering?.meetsCode ?? "—"],
      ["3. Roof Deck Attachment", wm?.roofDeckAttachment ?? "—"],
      ["4. Roof-to-Wall Attachment", wm?.roofToWallAttachment ?? "—"],
      ["5. Roof Geometry", wm?.roofGeometry ?? "—"],
      ["6. Secondary Water Resistance", wm?.secondaryWaterResistance ?? "—"],
      ["7. Opening Protection", wm?.openingProtection ?? "—"],
      ["Year of Original Construction", String(wm?.yearOfHomeOriginalConstruction ?? "—")],
    ];
    for (const [k, v] of rows) { drawKv(page, y, k, v); y -= 22; }
  }

  const bytes = await doc.save();
  c.header("Content-Type", "application/pdf");
  c.header(
    "Content-Disposition",
    `inline; filename="inspection-${inspection.id}.pdf"`
  );
  return c.body(bytes as unknown as ArrayBuffer);
});
