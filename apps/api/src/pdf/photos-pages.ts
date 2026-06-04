/**
 * Photo-pages appender for the inspection PDF.
 *
 * Fetches every photo for an inspection through the storage adapter
 * (R2 in prod, local on dev), embeds them in a 2×2 grid (4 photos
 * per US-Letter page) with each cell captioned by tag + capture date,
 * and returns the resulting PDF as Uint8Array.
 *
 * The route handler merges this with the form-fill PDFs (wind-mit /
 * 4-Point) via pdf-lib's copyPages flow.
 *
 * Edge constraints honored:
 *   - No node:* imports (pdf-lib + Web fetch only)
 *   - Uint8Array everywhere (no Buffer)
 *   - storage.get() returns { bytes, contentType }
 */
import {
  PDFDocument,
  StandardFonts,
  type PDFImage,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { Inspection, Photo } from "@inspect-ai/shared";
import { storage } from "../storage.js";

const PAGE_W = 612; // US Letter in PDF points
const PAGE_H = 792;
const MARGIN = 32;
const GUTTER = 16;     // space between cells (horizontal + vertical)
const CAPTION_H = 30;  // reserved at bottom of each cell for tag + date

/** 2×2 grid → 4 photos per page. */
const COLS = 2;
const ROWS = 2;
const PER_PAGE = COLS * ROWS;

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
): Promise<PDFImage> {
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

interface Loaded {
  photo: Photo;
  // null => fetch/embed failed; render placeholder cell.
  img: PDFImage | null;
  errorMsg?: string;
}

/** Pull and embed a single photo; never throws. */
async function loadPhoto(doc: PDFDocument, photo: Photo): Promise<Loaded> {
  try {
    const fetched = await storage.get(photo.storageKey);
    try {
      const img = await embedImageSmart(doc, fetched.bytes, fetched.contentType);
      return { photo, img };
    } catch {
      return { photo, img: null, errorMsg: "image could not be embedded" };
    }
  } catch (err) {
    return {
      photo,
      img: null,
      errorMsg: (err as Error).message ?? "fetch failed",
    };
  }
}

/** Truncate a string to fit within `maxWidth` PDF points at the given font/size. */
function ellipsize(s: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  const ELL = "…";
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = ((lo + hi + 1) / 2) | 0;
    if (font.widthOfTextAtSize(s.slice(0, mid) + ELL, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo) + ELL;
}

/** Render one cell (image + caption) into the page at top-left (cellX, cellY). */
function drawCell(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  cellX: number,
  cellY: number,       // top of the cell in pdf-lib bottom-up coords
  cellW: number,
  cellH: number,
  loaded: Loaded,
  globalIdx: number,
  total: number,
) {
  const imageBoxH = cellH - CAPTION_H;
  const imageBoxBottom = cellY - cellH + CAPTION_H; // pdf-lib y of image-box bottom edge

  if (loaded.img) {
    // Scale-to-fit inside the image box, centered.
    const scale = Math.min(cellW / loaded.img.width, imageBoxH / loaded.img.height);
    const drawnW = loaded.img.width * scale;
    const drawnH = loaded.img.height * scale;
    const x = cellX + (cellW - drawnW) / 2;
    const y = imageBoxBottom + (imageBoxH - drawnH) / 2;
    page.drawImage(loaded.img, { x, y, width: drawnW, height: drawnH });
  } else {
    // Placeholder rectangle + "image unavailable" line.
    page.drawRectangle({
      x: cellX,
      y: imageBoxBottom,
      width: cellW,
      height: imageBoxH,
      borderColor: undefined,
      // light gray fill — no rgb import; use pdf-lib's default opacity-less black? Skip fill; just text.
    });
    page.drawText(`[ ${loaded.errorMsg ?? "photo unavailable"} ]`, {
      x: cellX + 8,
      y: imageBoxBottom + imageBoxH / 2 - 4,
      size: 9,
      font,
    });
  }

  // ── Caption (under the image) ─────────────────────────────────────────
  // Line 1: "Photo N of M  ·  Pretty Tag" (bold tag), ellipsized to fit
  const captionTop = imageBoxBottom - 4; // a hair of breathing room
  const prefix = `Photo ${globalIdx} of ${total}  ·  `;
  const tagLabel = prettyTag(loaded.photo.tag);
  const prefixWidth = fontBold.widthOfTextAtSize(prefix, 9);
  const tagMax = cellW - prefixWidth - 4;
  const tagFitted = ellipsize(tagLabel, fontBold, 9, Math.max(20, tagMax));
  page.drawText(prefix, { x: cellX, y: captionTop - 8, size: 9, font });
  page.drawText(tagFitted, {
    x: cellX + prefixWidth,
    y: captionTop - 8,
    size: 9,
    font: fontBold,
  });
  // Line 2: capture date, smaller
  page.drawText(`Captured ${fmtCaptured(loaded.photo.capturedAt)}`, {
    x: cellX,
    y: captionTop - 20,
    size: 8,
    font,
  });
}

/**
 * Build a multi-page PDF containing every inspection photo laid out
 * 4-up (2×2 grid) per US-Letter page, each captioned with the tag +
 * capture date. Returns an empty PDF (zero pages) when the inspection
 * has no photos.
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

  // ── Cover page ────────────────────────────────────────────────────────
  const cover = doc.addPage([PAGE_W, PAGE_H]);
  cover.drawText("Photo Documentation", {
    x: MARGIN, y: PAGE_H - 120, size: 22, font: fontBold,
  });
  cover.drawText(headerLine, {
    x: MARGIN, y: PAGE_H - 150, size: 12, font,
  });
  cover.drawText(
    `${ordered.length} photo${ordered.length === 1 ? "" : "s"} attached.`,
    { x: MARGIN, y: PAGE_H - 170, size: 11, font },
  );

  // ── 4-up grid pages ───────────────────────────────────────────────────
  // Cell geometry (top-left origin per cell, in pdf-lib bottom-up coords)
  const gridTopY = PAGE_H - MARGIN;
  const gridBottomY = MARGIN;
  const gridH = gridTopY - gridBottomY;
  const gridW = PAGE_W - 2 * MARGIN;
  const cellW = (gridW - GUTTER * (COLS - 1)) / COLS;
  const cellH = (gridH - GUTTER * (ROWS - 1)) / ROWS;

  for (let i = 0; i < ordered.length; i += PER_PAGE) {
    const batch = ordered.slice(i, i + PER_PAGE);
    // Load all 4 in parallel so the per-page wall-clock is dominated by
    // the slowest R2 fetch, not the sum.
    const loaded = await Promise.all(batch.map((p) => loadPhoto(doc, p)));

    const page = doc.addPage([PAGE_W, PAGE_H]);

    loaded.forEach((l, j) => {
      const col = j % COLS;
      const row = (j / COLS) | 0;
      const cellX = MARGIN + col * (cellW + GUTTER);
      const cellY = gridTopY - row * (cellH + GUTTER); // top of this cell
      drawCell(
        page, font, fontBold,
        cellX, cellY, cellW, cellH,
        l, i + j + 1, ordered.length,
      );
    });
  }

  return await doc.save();
}
