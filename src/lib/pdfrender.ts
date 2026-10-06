// pdf.js: membuka, membaca ukuran, dan merender halaman.
// Modul ini di-import secara dinamis (`await import("#lib/pdfrender.ts")`) supaya bundle pdf.js
// (~1 MB) baru diunduh saat pengguna membuka file, dan tidak ikut saat prerender/SSR.

import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
// Worker di-bundle sendiri (bukan CDN): tetap jalan offline, dokumen tidak pernah keluar perangkat.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PdfError } from "./pdf";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy };
export type PageInfo = { index: number; w: number; h: number; rotate: number };

/**
 * Buka PDF. ⚠ pdf.js MEMINDAHKAN buffer ke worker (buffer jadi detached),
 * jadi pemanggil harus mengirim salinan (`bytes.slice(0)`) kalau masih butuh byte aslinya.
 */
export async function openPdf(bytes: ArrayBuffer, name = "dokumen.pdf"): Promise<PDFDocumentProxy> {
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (/password/i.test(`${e?.name} ${e?.message}`)) throw new PdfError("password", name);
    throw new PdfError("unreadable", name);
  }
}

/** Ukuran asli (crop box, tanpa rotasi) & rotasi bawaan setiap halaman. */
export async function pageInfos(doc: PDFDocumentProxy): Promise<PageInfo[]> {
  const out: PageInfo[] = [];
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1);
    const [x1, y1, x2, y2] = page.view;
    out.push({ index: i, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), rotate: page.rotate });
  }
  return out;
}

/**
 * Render satu halaman ke object URL.
 * - latar diisi putih dulu (PDF transparan tidak jadi hitam di JPEG)
 * - object URL, bukan data URL: hemat memori, tanpa base64 di main thread
 * - kanvas dibebaskan segera (penting di iOS Safari)
 */
export async function renderPageUrl(
  doc: PDFDocumentProxy,
  index: number,
  widthPx: number,
  rotation?: number,
  type = "image/jpeg",
): Promise<string> {
  const page = await doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1, rotation });
  const viewport = page.getViewport({ scale: widthPx / base.width, rotation });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  try {
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82));
    if (!blob) throw new Error("toBlob gagal");
    return URL.createObjectURL(blob);
  } finally {
    canvas.width = canvas.height = 0;
    page.cleanup();
  }
}
