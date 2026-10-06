// Ekspor PDF dengan pdf-lib. Dimuat secara dinamis hanya saat menyimpan.

import {
  BlendMode,
  LineCapStyle,
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type Color,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import {
  ARROW_SPREAD,
  LINE_HEIGHT,
  MARK_PATHS,
  MARK_STROKE,
  NUMBER_SIZE,
  TEXT_ASCENT,
  arrowHead,
  localToPage,
  numberAnchor,
  numberLabel,
  viewRot,
  viewToPage,
  watermarkAnchor,
  watermarkSize,
  type Annotation,
  type FontKey,
  type PageItem,
  type Rot,
  type Source,
  type Stamp,
  type TextAnn,
} from "./editor";
import { PdfError } from "./pdf";

type Ctx = { page: PDFPage; r: Rot; w: number; h: number; ox: number; oy: number };
type Fonts = Map<StandardFonts, PDFFont>;
type Images = Map<string, PDFImage>;

const FONT_FAMILIES: Record<FontKey, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  // [regular, bold, italic, bold-italic]
  helv: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
  times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  courier: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
};

export function standardFont(a: Pick<TextAnn, "font" | "bold" | "italic">): StandardFonts {
  const family = FONT_FAMILIES[a.font ?? "helv"];
  return family[(a.bold ? 1 : 0) + (a.italic ? 2 : 0)];
}

export function hexColor(hex: string): Color {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Font standar PDF hanya mendukung WinAnsi; karakter lain diganti "?" supaya pdf-lib tidak throw. */
export function safeText(font: PDFFont, text: string): string {
  const ok = new Set(font.getCharacterSet());
  return Array.from(text)
    .map((c) => (ok.has(c.codePointAt(0)!) ? c : "?"))
    .join("");
}

function dataUrlBytes(src: string): Uint8Array {
  // atob tersedia di browser, worker, dan Node ≥ 16 (dipakai tes).
  const bin = atob(src.slice(src.indexOf(",") + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Font & gambar ditanam sekali per dokumen keluaran (gambar dideduplikasi per `src`). */
async function embedResources(out: PDFDocument, pages: PageItem[]) {
  const needed = new Set<StandardFonts>([StandardFonts.Helvetica, StandardFonts.HelveticaBold]);
  const srcs = new Set<string>();
  for (const p of pages)
    for (const a of p.annotations) {
      if (a.kind === "text") needed.add(standardFont(a));
      if (a.kind === "image") srcs.add(a.src);
    }
  const fonts: Fonts = new Map();
  for (const f of needed) fonts.set(f, await out.embedFont(f));
  const images: Images = new Map();
  for (const src of srcs) {
    const bytes = dataUrlBytes(src);
    images.set(src, src.startsWith("data:image/png") ? await out.embedPng(bytes) : await out.embedJpg(bytes));
  }
  return { fonts, images };
}

/** halaman asli → koordinat PDF (kiri-bawah crop box, y ke atas). */
const toPdf = (ctx: Ctx, xt: number, yt: number) => ({ x: ctx.ox + xt, y: ctx.oy + ctx.h - yt });

export function drawAnnotation(ctx: Ctx, ann: Annotation, fonts: Fonts, images: Images) {
  const { page } = ctx;
  switch (ann.kind) {
    case "text": {
      const font = fonts.get(standardFont(ann))!;
      const color = hexColor(ann.color);
      ann.text.split("\n").forEach((line, i) => {
        if (!line) return;
        const [px, py] = localToPage(ann.x, ann.y, ann.angle, 0, ann.size * TEXT_ASCENT + i * ann.size * LINE_HEIGHT);
        page.drawText(safeText(font, line), {
          ...toPdf(ctx, px, py),
          size: ann.size,
          font,
          color,
          rotate: degrees(ann.angle),
        });
      });
      break;
    }
    case "rect": {
      const color = hexColor(ann.color);
      if (ann.mode === "ellipse") {
        const [cx, cy] = localToPage(ann.x, ann.y, ann.angle, ann.w / 2, ann.h / 2);
        const swap = ann.angle === 90 || ann.angle === 270;
        page.drawEllipse({
          ...toPdf(ctx, cx, cy),
          xScale: (swap ? ann.h : ann.w) / 2,
          yScale: (swap ? ann.w : ann.h) / 2,
          borderColor: color,
          borderWidth: ann.stroke,
        });
        break;
      }
      // Jangkar pdf-lib = sudut kiri-bawah di kerangka lokal.
      const [ax, ay] = localToPage(ann.x, ann.y, ann.angle, 0, ann.h);
      const common = { ...toPdf(ctx, ax, ay), width: ann.w, height: ann.h, rotate: degrees(ann.angle) };
      if (ann.mode === "box") page.drawRectangle({ ...common, borderColor: color, borderWidth: ann.stroke });
      else if (ann.mode === "highlight")
        page.drawRectangle({ ...common, color, opacity: 0.4, blendMode: BlendMode.Multiply });
      else page.drawRectangle({ ...common, color });
      break;
    }
    case "line": {
      const color = hexColor(ann.color);
      const style = { thickness: ann.width, color, lineCap: LineCapStyle.Round };
      const end = toPdf(ctx, ann.x2, ann.y2);
      page.drawLine({ start: toPdf(ctx, ann.x1, ann.y1), end, ...style });
      if (ann.arrow) {
        const len = arrowHead(ann.width);
        const ang = Math.atan2(ann.y1 - ann.y2, ann.x1 - ann.x2);
        for (const sign of [-1, 1]) {
          const a = ang + (sign * ARROW_SPREAD * Math.PI) / 180;
          page.drawLine({
            start: end,
            end: toPdf(ctx, ann.x2 + Math.cos(a) * len, ann.y2 + Math.sin(a) * len),
            ...style,
          });
        }
      }
      break;
    }
    case "ink": {
      const color = hexColor(ann.color);
      const pts = ann.points;
      for (let i = 0; i + 3 < pts.length; i += 2)
        page.drawLine({
          start: toPdf(ctx, pts[i], pts[i + 1]),
          end: toPdf(ctx, pts[i + 2], pts[i + 3]),
          thickness: ann.width,
          color,
          lineCap: LineCapStyle.Round,
        });
      break;
    }
    case "mark": {
      page.drawSvgPath(MARK_PATHS[ann.symbol], {
        ...toPdf(ctx, ann.x, ann.y),
        scale: ann.size / 24,
        rotate: degrees(ann.angle),
        borderColor: hexColor(ann.color),
        borderWidth: MARK_STROKE,
        borderLineCap: LineCapStyle.Round,
      });
      break;
    }
    case "image": {
      const img = images.get(ann.src);
      if (!img) break;
      const [ax, ay] = localToPage(ann.x, ann.y, ann.angle, 0, ann.h);
      page.drawImage(img, { ...toPdf(ctx, ax, ay), width: ann.w, height: ann.h, rotate: degrees(ann.angle) });
      break;
    }
  }
}

/** Gambar teks yang tegak di ruang TAMPILAN, mulai dari titik baseline (xv, yv). */
function drawViewText(ctx: Ctx, text: string, xv: number, yv: number, extraDeg: number, opts: Parameters<PDFPage["drawText"]>[1]) {
  const [xt, yt] = viewToPage(xv, yv, ctx.r, ctx.w, ctx.h);
  ctx.page.drawText(text, { ...opts, ...toPdf(ctx, xt, yt), rotate: degrees(ctx.r + extraDeg) });
}

export function drawStamp(ctx: Ctx, stamp: Stamp, position: number, total: number, fonts: Fonts) {
  const swap = ctx.r === 90 || ctx.r === 270;
  const W = swap ? ctx.h : ctx.w;
  const H = swap ? ctx.w : ctx.h;

  if (stamp.watermark.enabled && stamp.watermark.text.trim()) {
    const font = fonts.get(StandardFonts.HelveticaBold)!;
    const text = safeText(font, stamp.watermark.text.trim());
    const size = watermarkSize(text, W, H);
    const tw = font.widthOfTextAtSize(text, size);
    const { x, y } = watermarkAnchor(W, H, tw, size, stamp.watermark.rotation);
    drawViewText(ctx, text, x, y, stamp.watermark.rotation, {
      size,
      font,
      color: rgb(0.45, 0.45, 0.5),
      opacity: stamp.watermark.opacity,
    });
  }

  if (stamp.numbers.enabled) {
    const label = numberLabel(stamp.numbers, position, total);
    if (label) {
      const font = fonts.get(StandardFonts.Helvetica)!;
      const tw = font.widthOfTextAtSize(label, NUMBER_SIZE);
      const { x, y } = numberAnchor(stamp.numbers.position, W, H, tw);
      drawViewText(ctx, label, x, y, 0, { size: NUMBER_SIZE, font, color: rgb(0.2, 0.2, 0.25) });
    }
  }
}

async function loadSource(source: Source): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(source.bytes);
  } catch (err) {
    if (/encrypt/i.test(String((err as Error)?.message ?? err))) throw new PdfError("encrypted", source.name);
    throw new PdfError("unreadable", source.name);
  }
}

/**
 * Bangun satu PDF baru per kelompok halaman.
 * File asli tidak pernah diubah: rotasi, urutan, dan anotasi hanya data sampai titik ini.
 */
export async function exportPdfs(sources: Source[], groups: PageItem[][], stamp: Stamp): Promise<Uint8Array[]> {
  const nonEmpty = groups.filter((g) => g.length);
  if (!nonEmpty.length) throw new PdfError("empty");

  const loaded = new Map<number, PDFDocument>(); // muat tiap sumber SEKALI
  const load = async (i: number) => {
    let doc = loaded.get(i);
    if (!doc) loaded.set(i, (doc = await loadSource(sources[i])));
    return doc;
  };

  const outputs: Uint8Array[] = [];
  for (const pages of nonEmpty) {
    const out = await PDFDocument.create();
    const { fonts, images } = await embedResources(out, pages);

    // Salin halaman per sumber dalam satu panggilan copyPages (lebih cepat untuk dokumen besar).
    const copies = new Map<string, PDFPage>();
    const bySource = new Map<number, number[]>();
    for (const item of pages) {
      if (item.source < 0) continue;
      const list = bySource.get(item.source) ?? [];
      if (!list.includes(item.index)) list.push(item.index);
      bySource.set(item.source, list);
    }
    for (const [source, indices] of bySource) {
      const copied = await out.copyPages(await load(source), indices);
      indices.forEach((index, k) => copies.set(`${source}:${index}`, copied[k]));
    }
    const used = new Set<string>();

    for (let position = 0; position < pages.length; position++) {
      const item = pages[position];
      let page: PDFPage;
      if (item.source < 0) {
        page = out.addPage([item.w, item.h]);
      } else {
        const key = `${item.source}:${item.index}`;
        // Halaman duplikat butuh objek halaman terpisah: salin ulang kalau sudah dipakai.
        const copy = used.has(key)
          ? (await out.copyPages(await load(item.source), [item.index]))[0]
          : copies.get(key)!;
        used.add(key);
        page = out.addPage(copy);
      }
      const r = viewRot(item);
      page.setRotation(degrees(r)); // rotasi = /Rotate, bukan menggambar ulang isi
      const box = page.getCropBox();
      const ctx: Ctx = { page, r, w: item.w, h: item.h, ox: box.x, oy: box.y };
      for (const ann of item.annotations) drawAnnotation(ctx, ann, fonts, images);
      drawStamp(ctx, stamp, position, pages.length, fonts);
    }
    outputs.push(await out.save());
  }
  return outputs;
}
