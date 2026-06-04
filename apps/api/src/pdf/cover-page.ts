/**
 * Cover page for the inspection report.
 *
 * Prepended to the merged PDF (before the wind-mit / 4-point form pages
 * and the photo grid) when the inspector has a business logo in their
 * profile. Layout:
 *
 *   ┌─────────────────────────────────────────┐
 *   │                                         │
 *   │                                         │
 *   │              [ LOGO ]                   │
 *   │                                         │
 *   │                                         │
 *   │       ─────────────────────────         │
 *   │           INSPECTION REPORT             │
 *   │       ─────────────────────────         │
 *   │                                         │
 *   │       Property                          │
 *   │       123 Main St                       │
 *   │       Tampa, FL 33629                   │
 *   │                                         │
 *   │       Owner                             │
 *   │       James Michael Doherty             │
 *   │                                         │
 *   │       Inspection date  2026-06-04       │
 *   │       Inspector        Jane A. Smith    │
 *   │       License          HI-12345         │
 *   │                                         │
 *   └─────────────────────────────────────────┘
 */
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
} from "pdf-lib";
import type { Inspection } from "@inspect-ai/shared";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;

/** Decode "data:image/<mime>;base64,…" → { bytes, mime }. */
function decodeDataUri(uri: string): { bytes: Uint8Array; mime: string } | null {
  const m = uri.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!m) return null;
  const mime = m[1]!.toLowerCase() === "png" ? "image/png" : "image/jpeg";
  try {
    const bin = atob(m[2]!);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { bytes: out, mime };
  } catch {
    return null;
  }
}

/** Build a 1-page PDF with the cover, returns Uint8Array bytes. Caller
 *  merges via pdf-lib's copyPages flow. Returns empty PDF if no logo.
 */
export async function buildCoverPage(
  inspection: Inspection,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  if (!inspection.businessLogoPng) return await doc.save();

  const decoded = decodeDataUri(inspection.businessLogoPng);
  if (!decoded) return await doc.save();

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let img: PDFImage;
  try {
    img =
      decoded.mime === "image/png"
        ? await doc.embedPng(decoded.bytes)
        : await doc.embedJpg(decoded.bytes);
  } catch {
    // Couldn't embed (corrupt / unknown subtype) — bail with empty.
    return await doc.save();
  }

  const page = doc.addPage([PAGE_W, PAGE_H]);

  // ── Logo block (top half, ~300pt tall max) ──────────────────────────
  const logoMaxW = PAGE_W - 2 * MARGIN;
  const logoMaxH = 300;
  const logoScale = Math.min(logoMaxW / img.width, logoMaxH / img.height);
  const logoW = img.width * logoScale;
  const logoH = img.height * logoScale;
  const logoX = (PAGE_W - logoW) / 2;
  // Top of logo at y ≈ PAGE_H - 110, drawing downward
  const logoTopY = PAGE_H - 110;
  const logoY = logoTopY - logoH; // pdf-lib y of bottom-left
  page.drawImage(img, { x: logoX, y: logoY, width: logoW, height: logoH });

  // ── Divider + title block ───────────────────────────────────────────
  const titleBlockTop = logoY - 50;
  // Top divider
  page.drawLine({
    start: { x: MARGIN + 60, y: titleBlockTop },
    end:   { x: PAGE_W - MARGIN - 60, y: titleBlockTop },
    thickness: 0.75,
    color: rgb(0.2, 0.27, 0.4),
  });
  // Title text
  const titleText = "INSPECTION REPORT";
  const titleSize = 18;
  const titleWidth = fontBold.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: (PAGE_W - titleWidth) / 2,
    y: titleBlockTop - 25,
    size: titleSize,
    font: fontBold,
    color: rgb(0.11, 0.26, 0.5),
  });
  // Bottom divider
  page.drawLine({
    start: { x: MARGIN + 60, y: titleBlockTop - 38 },
    end:   { x: PAGE_W - MARGIN - 60, y: titleBlockTop - 38 },
    thickness: 0.75,
    color: rgb(0.2, 0.27, 0.4),
  });

  // ── Details block ───────────────────────────────────────────────────
  // Plain "Label / Value" layout, left-aligned starting at MARGIN.
  const detailsTop = titleBlockTop - 100;
  let cursorY = detailsTop;
  const drawSection = (label: string, lines: string[]) => {
    if (lines.length === 0) return;
    page.drawText(label.toUpperCase(), {
      x: MARGIN, y: cursorY, size: 9,
      font: fontBold,
      color: rgb(0.45, 0.5, 0.6),
    });
    cursorY -= 14;
    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN, y: cursorY, size: 13, font,
        color: rgb(0.08, 0.1, 0.15),
      });
      cursorY -= 18;
    }
    cursorY -= 14;
  };

  const addr = inspection.address;
  drawSection("Property", [
    addr.line1,
    `${addr.city}, ${addr.state} ${addr.zip}`,
  ]);

  const ownerLines: string[] = [];
  if (inspection.property?.ownerName) ownerLines.push(inspection.property.ownerName);
  if (inspection.ownerEmail) ownerLines.push(inspection.ownerEmail);
  if (inspection.ownerPhone) ownerLines.push(inspection.ownerPhone);
  drawSection("Owner", ownerLines);

  // Inspection meta — laid out as label/value pairs side by side.
  const META_LABEL_W = 160;
  const metaTop = cursorY;
  const drawMeta = (label: string, value: string) => {
    if (!value) return;
    page.drawText(label, {
      x: MARGIN, y: cursorY, size: 11,
      font, color: rgb(0.45, 0.5, 0.6),
    });
    page.drawText(value, {
      x: MARGIN + META_LABEL_W, y: cursorY, size: 11,
      font: fontBold, color: rgb(0.08, 0.1, 0.15),
    });
    cursorY -= 16;
  };

  drawMeta(
    "Inspection type",
    inspection.type === "four_point"
      ? "4-Point"
      : inspection.type === "wind_mitigation"
        ? "Wind Mitigation (OIR-B1-1802)"
        : "4-Point + Wind Mitigation",
  );
  drawMeta(
    "Inspection date",
    (inspection.inspectedOn ?? inspection.createdAt).slice(0, 10),
  );
  drawMeta("Inspector", inspection.inspectorName ?? "");
  drawMeta("License #", inspection.inspectorLicense ?? "");
  if (inspection.inspectorCompany) {
    drawMeta("Company", inspection.inspectorCompany);
  }
  if (inspection.inspectorPhone) {
    drawMeta("Phone", inspection.inspectorPhone);
  }

  // Footer
  page.drawText(
    "OIR-B1-1802 (Rev. 04/26) — Florida Wind Mitigation Inspection",
    {
      x: MARGIN, y: MARGIN, size: 8, font,
      color: rgb(0.5, 0.55, 0.62),
    },
  );

  // suppress unused warning
  void metaTop;

  return await doc.save();
}
