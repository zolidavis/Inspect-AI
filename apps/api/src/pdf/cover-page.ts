/**
 * Cover page for the inspection report.
 *
 * Prepended to the merged PDF (before the wind-mit / 4-point form pages
 * and the photo grid) when the inspector has a business logo in their
 * profile. Layout:
 *
 *   ┌─────────────────────────────────────────┐
 *   │                                         │
 *   │              [ LOGO ]                   │
 *   │                                         │
 *   │       ─────────────────────────         │
 *   │       Inspector  Jane A. Smith          │
 *   │       License #  HI-12345               │
 *   │       Company    Acme Home Inspections  │
 *   │       Phone      (555) 555-5555         │
 *   │       Email      jane@acme.com          │
 *   │       ─────────────────────────         │
 *   │                                         │
 *   │           INSPECTION REPORT             │
 *   │                                         │
 *   │       Property                          │
 *   │       123 Main St                       │
 *   │       Tampa, FL 33629                   │
 *   │                                         │
 *   │       Owner                             │
 *   │       James Michael Doherty             │
 *   │                                         │
 *   │       Inspection type   4-Point + WM    │
 *   │       Inspection date   2026-06-04      │
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

  // ── Logo block (top, ~220pt tall max — leaves room for inspector
  //    block directly under it) ──────────────────────────────────────
  const logoMaxW = PAGE_W - 2 * MARGIN;
  const logoMaxH = 220;
  const logoScale = Math.min(logoMaxW / img.width, logoMaxH / img.height);
  const logoW = img.width * logoScale;
  const logoH = img.height * logoScale;
  const logoX = (PAGE_W - logoW) / 2;
  const logoTopY = PAGE_H - 80; // y in pdf-lib coords (origin bottom-left)
  const logoY = logoTopY - logoH;
  page.drawImage(img, { x: logoX, y: logoY, width: logoW, height: logoH });

  // ── INSPECTOR / COMPANY block — DIRECTLY under the logo ────────────
  // Label/value pairs, with a divider line above + below for visual
  // separation from the logo and the "INSPECTION REPORT" title.
  const LABEL_W = 140;
  const ROW_H = 18;
  const DIVIDER_INSET = 60;

  const inspectorRows: { label: string; value: string }[] = [];
  const push = (label: string, value: string | undefined) => {
    if (value && value.trim()) inspectorRows.push({ label, value: value.trim() });
  };
  push("Inspector", inspection.inspectorName);
  push("License #", inspection.inspectorLicense);
  push("Company",   inspection.inspectorCompany);
  push("Phone",     inspection.inspectorPhone);
  push("Email",     inspection.inspectorEmail);

  const blockTop = logoY - 24; // top divider sits 24pt below logo bottom
  let cursorY = blockTop;
  // Top divider
  page.drawLine({
    start: { x: MARGIN + DIVIDER_INSET, y: cursorY },
    end:   { x: PAGE_W - MARGIN - DIVIDER_INSET, y: cursorY },
    thickness: 0.75,
    color: rgb(0.2, 0.27, 0.4),
  });
  cursorY -= 22; // gap below divider before first row

  for (const { label, value } of inspectorRows) {
    page.drawText(label, {
      x: MARGIN + DIVIDER_INSET, y: cursorY, size: 11,
      font, color: rgb(0.45, 0.5, 0.6),
    });
    page.drawText(value, {
      x: MARGIN + DIVIDER_INSET + LABEL_W, y: cursorY, size: 11,
      font: fontBold, color: rgb(0.08, 0.1, 0.15),
    });
    cursorY -= ROW_H;
  }
  cursorY -= 4; // small gap before bottom divider
  // Bottom divider
  page.drawLine({
    start: { x: MARGIN + DIVIDER_INSET, y: cursorY },
    end:   { x: PAGE_W - MARGIN - DIVIDER_INSET, y: cursorY },
    thickness: 0.75,
    color: rgb(0.2, 0.27, 0.4),
  });

  // ── "INSPECTION REPORT" title (centered, below the inspector block) ─
  const titleSize = 18;
  const titleY = cursorY - 38;
  const titleText = "INSPECTION REPORT";
  const titleWidth = fontBold.widthOfTextAtSize(titleText, titleSize);
  page.drawText(titleText, {
    x: (PAGE_W - titleWidth) / 2,
    y: titleY,
    size: titleSize,
    font: fontBold,
    color: rgb(0.11, 0.26, 0.5),
  });

  // ── Property + owner + inspection meta ──────────────────────────────
  cursorY = titleY - 40;
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
    cursorY -= 12;
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

  const META_LABEL_W = 160;
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

  // Footer
  page.drawText(
    "OIR-B1-1802 (Rev. 04/26) — Florida Wind Mitigation Inspection",
    {
      x: MARGIN, y: MARGIN, size: 8, font,
      color: rgb(0.5, 0.55, 0.62),
    },
  );

  return await doc.save();
}
