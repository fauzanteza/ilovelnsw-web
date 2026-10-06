import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { exportPdfs } from "./export";
import { DEFAULT_STAMP, blankPage, groupPages, type PageItem, type Source, type Stamp } from "./editor";
import { PdfError } from "./pdf";

/** PDF uji: halaman berukuran berbeda supaya urutan bisa dikenali dari ukurannya. */
async function makeSource(name: string, sizes: [number, number][], rotations: number[] = []): Promise<Source> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  sizes.forEach(([w, h], i) => {
    const p = doc.addPage([w, h]);
    p.drawText(`Halaman ${i + 1}`, { x: 20, y: h - 40, size: 14, font });
    if (rotations[i]) p.setRotation(degrees(rotations[i]));
  });
  const bytes = await doc.save();
  return { name, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
}

function item(source: number, index: number, [w, h]: [number, number], extra: Partial<PageItem> = {}): PageItem {
  return { id: `${source}-${index}-${Math.random()}`, source, index, base: 0, rotate: 0, w, h, annotations: [], ...extra };
}

const sizesOf = async (bytes: Uint8Array) => {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => {
    const { width, height } = p.getSize();
    return [Math.round(width), Math.round(height), p.getRotation().angle];
  });
};

const A: [number, number] = [300, 400];
const B: [number, number] = [310, 410];
const C: [number, number] = [320, 420];

describe("exportPdfs", () => {
  it("menyusun ulang, memutar, dan menggabungkan dari beberapa sumber", async () => {
    const s0 = await makeSource("satu.pdf", [A, B]);
    const s1 = await makeSource("dua.pdf", [C]);
    const pages = [item(1, 0, C), item(0, 1, B, { rotate: 90 }), item(0, 0, A, { rotate: -90 })];
    const [out] = await exportPdfs([s0, s1], [pages], DEFAULT_STAMP);
    expect(await sizesOf(out)).toEqual([
      [320, 420, 0],
      [310, 410, 90],
      [300, 400, 270],
    ]);
  });

  it("rotasi bawaan ditambah rotasi pengguna", async () => {
    const s0 = await makeSource("rot.pdf", [A], [90]);
    const [out] = await exportPdfs([s0], [[item(0, 0, A, { base: 90, rotate: 180 })]], DEFAULT_STAMP);
    expect((await sizesOf(out))[0][2]).toBe(270);
  });

  it("halaman kosong & duplikat halaman yang sama", async () => {
    const s0 = await makeSource("x.pdf", [A]);
    const first = item(0, 0, A);
    const pages = [first, { ...first, id: "dup" }, blankPage(first)];
    const [out] = await exportPdfs([s0], [pages], DEFAULT_STAMP);
    expect(await sizesOf(out)).toEqual([
      [300, 400, 0],
      [300, 400, 0],
      [300, 400, 0],
    ]);
  });

  it("pisah file mengikuti potongan", async () => {
    const s0 = await makeSource("x.pdf", [A, B, C]);
    const pages = [item(0, 0, A), item(0, 1, B), item(0, 2, C)];
    const outs = await exportPdfs([s0], groupPages(pages, [pages[0].id]), DEFAULT_STAMP);
    expect(outs).toHaveLength(2);
    expect((await sizesOf(outs[0])).length).toBe(1);
    expect((await sizesOf(outs[1])).length).toBe(2);
  });

  it("menanam anotasi, nomor halaman, dan watermark (termasuk karakter non-WinAnsi)", async () => {
    const s0 = await makeSource("x.pdf", [A, B]);
    const stamp: Stamp = {
      numbers: { enabled: true, format: "roman", position: "bottom-right", startAt: 1, skipFirst: false },
      watermark: { enabled: true, text: "RAHASIA 😀 漢字", opacity: 0.2, rotation: 45 },
    };
    const png1x1 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const pages = [
      item(0, 0, A, {
        rotate: 90,
        annotations: [
          { id: "1", kind: "text", x: 20, y: 30, angle: 90, text: "Halo “dunia” ✓\nbaris 2", size: 12, color: "#1f5fd1", bold: true, italic: true, font: "times" },
          { id: "2", kind: "rect", x: 10, y: 10, w: 50, h: 20, angle: 0, mode: "highlight", color: "#f6db00", stroke: 2 },
          { id: "3", kind: "rect", x: 10, y: 40, w: 50, h: 20, angle: 90, mode: "ellipse", color: "#b42318", stroke: 2 },
          { id: "4", kind: "rect", x: 10, y: 70, w: 50, h: 20, angle: 0, mode: "whiteout", color: "#ffffff", stroke: 0 },
          { id: "5", kind: "line", x1: 0, y1: 0, x2: 100, y2: 100, color: "#000000", width: 2, arrow: true },
          { id: "6", kind: "mark", x: 100, y: 100, size: 18, angle: 0, symbol: "check", color: "#000000" },
          { id: "7", kind: "ink", points: [0, 0, 5, 5, 10, 3], color: "#000000", width: 2 },
          { id: "8", kind: "image", x: 150, y: 150, w: 20, h: 20, angle: 180, src: png1x1 },
          { id: "9", kind: "text", x: 20, y: 200, angle: 0, text: "Courier", size: 10, color: "#000000", bold: false, font: "courier" },
        ],
      }),
      item(0, 1, B),
    ];
    const [out] = await exportPdfs([s0], [pages], stamp);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(out.byteLength).toBeGreaterThan(1000);
  });

  it("menolak ekspor kosong", async () => {
    await expect(exportPdfs([], [], DEFAULT_STAMP)).rejects.toBeInstanceOf(PdfError);
    await expect(exportPdfs([], [[]], DEFAULT_STAMP)).rejects.toMatchObject({ code: "empty" });
  });

  it("sumber yang rusak menghasilkan PdfError yang jelas", async () => {
    const broken: Source = { name: "rusak.pdf", bytes: new TextEncoder().encode("bukan pdf").buffer as ArrayBuffer };
    await expect(exportPdfs([broken], [[item(0, 0, A)]], DEFAULT_STAMP)).rejects.toMatchObject({
      code: "unreadable",
      file: "rusak.pdf",
    });
  });
});
