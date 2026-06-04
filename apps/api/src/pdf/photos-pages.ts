/**
 * Photo-pages appender for the inspection PDF.
 *
 * Fetches every photo for an inspection through the storage adapter
 * (R2 in prod, local on dev), embeds each one onto a new US-Letter PDF
 * page (one per photo) with a tag caption + capture timestamp, and
 * returns the resulting PDF as Uint8Array.
 *
 * The route handler merges this with the form-fill PDFs (wind-mit /
 * 4-Point) via pdf-lib's copyPages flow.
 *
 * Edge constraints honored:
 *   - No node:* imports (pdf-lib + Web fetch only)
 *   - Uint8Array everywhere (no Buffer)
 *   - storage.get() returns { bytes, contentType }
 */
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Inspection, Photo } from "@inspect-ai/shared";
import { storage } from "../storage.js";

const PAGE_W = 612; // US Letter in PDF points
const PAGE_H = 792;
const MARGIN_X = 36;
const CAPTION_HEIGHT = 56;   // reserved at top of page for the caption
const IMAGE_MARGIN_TOP = 16; // space between caption and image
const IMAGE_MARGIN_BOTTOM = 36; // bottom margin under image

/** Human-friendly label for a stored photo tag. */
function prettyTag(tag: string): string {
  return tag
    .replace(/^wm\./, "Wind Mit · ")
    .replace(/^roof\./, "Roof · ")
    .replace(/^electrical\./, "Electrical · ")
    .replace(/^plumbing\./, "Plumbing · ")
    .replace(/^hvac\./, "HVAC · ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Format an ISO timestamp into "YYYY-MM-DD HH:MM" UTC. */
function fmtCaptured(iso: string): string {
  try {
    const d = new Date(iso);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mi = String(d.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
  } catch {
    return iso;
  }
}

/** Embed bytes as JPEG or PNG depending on content-type / signature. */
async function embedImageSmart(
  doc: PDFDocument,
  bytes: Uint8Array,
  contentType: string,
) {
  // PNG signature: 89 50 4E 47
  const isPng =
    contentType.includes("png") ||
    (bytes.length >= 4 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47);
  if (isPng) return await doc.embedPng(bytes);
  return await doc.embedJpg(bytes);
}

/**
 * Build a multi-page PDF containing every inspection photo, one per
 * page, captioned with the tag + capture date. Returns an empty PDF
 * (zero pages) when the inspection has no photos.
 */
export async function buildPhotoPagesPdf(
  inspection: Inspection,
  photos: Photo[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  if (photos.length === 0) return await doc.save();

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const addr = inspection.address;
  const headerLine = `${addr.line1}, ${addr.city}, ${addr.state} ${addr.zip}`;

  // Group by tag and stable-sort by captured time within each group, so
  // the report reads naturally (all elevation photos together, etc.).
  const groups = new Map<string, Photo[]>();
  for (const p of photos) {
    const arr = groups.get(p.tag) ?? [];
    arr.push(p);
    groups.set(p.tag, arr);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  }
  // Flatten in tag order (tags themselves sorted A→Z for determinism).
  const ordered: Photo[] = [];
  for (const tag of Array.from(groups.keys()).sort()) {
    for (const p of groups.get(tag)!) ordered.push(p);
  }

  // Section divider on first page so the photo block is obvious in the
  // merged report. Standalone page with the inspection address + photo
  // count + a "Photo documentation" banner.
  const cover = doc.addPage([PAGE_W, PAGE_H]);
  cover.drawText("Photo Documentation", {
    x: MARGIN_X,
    y: PAGE_H - 120,
    size: 22,
    font: fontBold,
  });
  cover.drawText(headerLine, {
    x: MARGIN_X,
    y: PAGE_H - 150,
    size: 12,
    font,
  });
  cover.drawText(
    `${ordered.length} photo${ordered.length === 1 ? "" : "s"} attached.`,
    { x: MARGIN_X, y: PAGE_H - 170, size: 11, font },
  );

  let pageIdx = 1; // 1-based for caption "Photo N of M"
  for (const photo of ordered) {
    let fetched: { bytes: Uint8Array; contentType: string };
    try {
      fetched = await storage.get(photo.storageKey);
    } catch (err) {
      // If a single photo fails to load, emit a placeholder page so the
      // report still ships rather than 500-ing.
      const failPage = doc.addPage([PAGE_W, PAGE_H]);
      failPage.drawText(`Photo ${pageIdx} of ${ordered.length}`, {
        x: MARGIN_X, y: PAGE_H - 36, size: 9, font,
      });
      failPage.drawText(`Tag: ${prettyTag(photo.tag)}`, {
        x: MARGIN_X, y: PAGE_H - 52, size: 12, font: fontBold,
      });
      failPage.drawText(
        `[ photo unavailable — ${(err as Error).message ?? "fetch failed"} ]`,
        { x: MARGIN_X, y: PAGE_H - 84, size: 10, font },
      );
      pageIdx++;
      continue;
    }

    let img: Awaited<ReturnType<typeof embedImageSmart>>;
    try {
      img = await embedImageSmart(doc, fetched.bytes, fetched.contentType);
    } catch {
      // Couldn't embed (corrupt? unknown format?) — skip with a stub.
      const failPage = doc.addPage([PAGE_W, PAGE_H]);
      failPage.drawText(`Photo ${pageIdx} of ${ordered.length}`, {
        x: MARGIN_X, y: PAGE_H - 36, size: 9, font,
      });
      failPage.drawText(`Tag: ${prettyTag(photo.tag)}`, {
        x: MARGIN_X, y: PAGE_H - 52, size: 12, font: fontBold,
      });
      failPage.drawText("[ image could not be embedded ]", {
        x: MARGIN_X, y: PAGE_H - 84, size: 10, font,
      });
      pageIdx++;
      continue;
    }

    const page = doc.addPage([PAGE_W, PAGE_H]);

    // ─── Caption block (top) ────────────────────────────────────────────
    page.drawText(`Photo ${pageIdx} of ${ordered.length}`, {
      x: MARGIN_X,
      y: PAGE_H - 36,
      size: 9,
      font,
    });
    page.drawText(prettyTag(photo.tag), {
      x: MARGIN_X,
      y: PAGE_H - 52,
      size: 14,
      font: fontBold,
    });
    page.drawText(`Captured ${fmtCaptured(photo.capturedAt)}`, {
      x: MARGIN_X,
      y: PAGE_H - 70,
      size: 9,
      font,
    });

    // ─── Image — scale-to-fit inside available space, centered ─────────
    const avail_w = PAGE_W - 2 * MARGIN_X;
    const avail_h =
      PAGE_H - CAPTION_HEIGHT - IMAGE_MARGIN_TOP - IMAGE_MARGIN_BOTTOM;
    const scale = Math.min(avail_w / img.width, avail_h / img.height);
    const drawn_w = img.width * scale;
    const drawn_h = img.height * scale;
    const x = (PAGE_W - drawn_w) / 2;
    const y = IMAGE_MARGIN_BOTTOM + (avail_h - drawn_h) / 2;
    page.drawImage(img, { x, y, width: drawn_w, height: drawn_h });

    pageIdx++;
  }

  return await doc.save();
}
