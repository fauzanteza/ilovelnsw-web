// Model data & geometri fitur Kelola PDF.
// Modul ini murni (tanpa pdf-lib/pdf.js), jadi bisa dipakai di UI, ekspor, dan tes.

import { toRoman } from "./pdf";

export type Rot = 0 | 90 | 180 | 270;
/** 3 keluarga font standar PDF (tanpa menanam file font). */
export type FontKey = "helv" | "times" | "courier";

export type PageItem = {
  /** uid unik per item (duplikat = id baru) */
  id: string;
  /** indeks ke sources[]/docs[]; -1 = halaman kosong */
  source: number;
  /** indeks halaman di PDF sumber (0-based) */
  index: number;
  /** rotasi bawaan halaman di PDF sumber (/Rotate) */
  base: Rot;
  /** putaran tambahan dari pengguna (kelipatan 90, boleh negatif / > 360) */
  rotate: number;
  /** ukuran ASLI dalam poin, TANPA rotasi (crop box) */
  w: number;
  h: number;
  annotations: Annotation[];
};

type Base = { id: string };
export type TextAnn = Base & {
  kind: "text";
  x: number;
  y: number;
  angle: Rot;
  text: string;
  size: number;
  color: string;
  bold: boolean;
  italic?: boolean;
  font?: FontKey;
};
export type RectAnn = Base & {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  angle: Rot;
  mode: "box" | "ellipse" | "highlight" | "whiteout";
  color: string;
  stroke: number;
  /** kunci text run yang ditutup (fitur edit teks) */
  origin?: string;
};
export type LineAnn = Base & {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  arrow: boolean;
};
export type MarkAnn = Base & {
  kind: "mark";
  x: number;
  y: number;
  size: number;
  angle: Rot;
  symbol: "check" | "cross";
  color: string;
};
export type InkAnn = Base & { kind: "ink"; points: number[]; color: string; width: number };
export type ImageAnn = Base & {
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  angle: Rot;
  /** data URL PNG/JPEG */
  src: string;
};

export type Annotation = TextAnn | RectAnn | InkAnn | ImageAnn | LineAnn | MarkAnn;

export type NumberFormat = "n" | "n-of-total" | "roman";
export type NumberPosition = "bottom-center" | "bottom-right" | "top-right";

export type Stamp = {
  numbers: {
    enabled: boolean;
    format: NumberFormat;
    position: NumberPosition;
    startAt: number;
    skipFirst: boolean;
  };
  watermark: { enabled: boolean; text: string; opacity: number; rotation: number };
};

export const DEFAULT_STAMP: Stamp = {
  numbers: { enabled: false, format: "n", position: "bottom-center", startAt: 1, skipFirst: false },
  watermark: { enabled: false, text: "SALINAN", opacity: 0.18, rotation: 45 },
};

export type Source = { name: string; bytes: ArrayBuffer };

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

/** Ukuran A4 dalam poin. */
export const A4 = { w: 595.28, h: 841.89 } as const;

// ───────────────────────────── Rotasi & koordinat ─────────────────────────────
//
// Tiga ruang:
//  - halaman asli ("page"): kiri-atas halaman tanpa rotasi, y ke bawah, poin
//  - tampilan ("view"):     kiri-atas halaman setelah diputar R, y ke bawah, poin
//  - PDF:                   kiri-bawah crop box, y ke atas, poin

export const norm = (deg: number): Rot =>
  ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as Rot;

export const viewRot = (p: Pick<PageItem, "base" | "rotate">): Rot => norm(p.base + p.rotate);

/** Ukuran yang terlihat setelah rotasi total. */
export function viewSize(p: Pick<PageItem, "base" | "rotate" | "w" | "h">) {
  const r = viewRot(p);
  return r === 90 || r === 270 ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

/** tampilan → halaman asli (w×h = ukuran asli). */
export function viewToPage(xv: number, yv: number, r: Rot, w: number, h: number): [number, number] {
  switch (r) {
    case 90:
      return [yv, h - xv];
    case 180:
      return [w - xv, h - yv];
    case 270:
      return [w - yv, xv];
    default:
      return [xv, yv];
  }
}

/** halaman asli → tampilan. */
export function pageToView(xt: number, yt: number, r: Rot, w: number, h: number): [number, number] {
  switch (r) {
    case 90:
      return [h - yt, xt];
    case 180:
      return [w - xt, h - yt];
    case 270:
      return [yt, w - xt];
    default:
      return [xt, yt];
  }
}

/** Transformasi SVG `<g>` yang setara `pageToView` (overlay digambar di ruang halaman asli). */
export function groupTransform(r: Rot, w: number, h: number): string {
  switch (r) {
    case 90:
      return `matrix(0 1 -1 0 ${h} 0)`;
    case 180:
      return `matrix(-1 0 0 -1 ${w} ${h})`;
    case 270:
      return `matrix(0 -1 1 0 0 ${w})`;
    default:
      return "";
  }
}

/** Putar vektor searah jarum jam (y ke bawah). Dibulatkan supaya cos/sin 90° tepat 0. */
export function rotateVec(dx: number, dy: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  const c = Math.round(Math.cos(a) * 1e9) / 1e9;
  const s = Math.round(Math.sin(a) * 1e9) / 1e9;
  return [dx * c - dy * s, dx * s + dy * c];
}

/** Titik lokal (u, v) objek berkotak → ruang halaman asli. */
export function localToPage(x: number, y: number, angle: Rot, u: number, v: number): [number, number] {
  const [dx, dy] = rotateVec(u, v, -angle);
  return [x + dx, y + dy];
}

// ───────────────────────────── Operasi daftar halaman ─────────────────────────────

/** Salinan halaman dengan id baru, termasuk id baru untuk setiap anotasi. */
export function clonePage(p: PageItem): PageItem {
  return {
    ...p,
    id: uid(),
    annotations: p.annotations.map((a) => ({ ...structuredClone(a), id: uid() })),
  };
}

/** Halaman kosong seukuran tetangga (dalam orientasi yang terlihat), atau A4. */
export function blankPage(neighbor?: PageItem): PageItem {
  const size = neighbor ? viewSize(neighbor) : A4;
  return { id: uid(), source: -1, index: 0, base: 0, rotate: 0, w: size.w, h: size.h, annotations: [] };
}

/** Kelompokkan halaman menjadi file keluaran berdasarkan `cuts` (id halaman akhir sebuah bagian). */
export function groupPages<T extends { id: string }>(pages: T[], cuts: string[]): T[][] {
  const set = new Set(cuts);
  const result: T[][] = [[]];
  for (const page of pages) {
    result[result.length - 1].push(page);
    if (set.has(page.id)) result.push([]);
  }
  return result.filter((g) => g.length);
}

/** Pindahkan blok terpilih satu posisi (Alt+←/→). Item di tepi tetap; blok bergerak bersama. */
export function shiftSelected<T extends { id: string }>(items: T[], selected: string[], dir: -1 | 1): T[] {
  const sel = new Set(selected);
  const out = [...items];
  if (dir < 0) {
    for (let i = 1; i < out.length; i++)
      if (sel.has(out[i].id) && !sel.has(out[i - 1].id)) [out[i - 1], out[i]] = [out[i], out[i - 1]];
  } else {
    for (let i = out.length - 2; i >= 0; i--)
      if (sel.has(out[i].id) && !sel.has(out[i + 1].id)) [out[i], out[i + 1]] = [out[i + 1], out[i]];
  }
  return out;
}

/** Terapkan hasil seret: `moving` (urutan dokumen) disisipkan di indeks `at` dari sisa item. */
export function applySort<T extends { id: string }>(items: T[], moving: string[], at: number): T[] {
  const set = new Set(moving);
  const rest = items.filter((p) => !set.has(p.id));
  const moved = items.filter((p) => set.has(p.id));
  const i = Math.max(0, Math.min(at, rest.length));
  return [...rest.slice(0, i), ...moved, ...rest.slice(i)];
}

// ───────────────────────────── Nomor halaman & watermark ─────────────────────────────

export const NUMBER_SIZE = 10;
export const NUMBER_MARGIN_X = 40;
export const NUMBER_BASELINE_BOTTOM = 28;
export const NUMBER_BASELINE_TOP = 40;

/** Label nomor halaman untuk posisi `position` (0-based) di file berisi `total` halaman. */
export function numberLabel(s: Stamp["numbers"], position: number, total: number): string | null {
  if (s.skipFirst && position === 0) return null; // lewati sampul
  const n = s.startAt + position - (s.skipFirst ? 1 : 0);
  const count = total - (s.skipFirst ? 1 : 0);
  if (s.format === "roman") return toRoman(n);
  if (s.format === "n-of-total") return `${n} / ${count}`;
  return String(n);
}

/**
 * Titik dasar (baseline kiri) nomor halaman di ruang TAMPILAN.
 * `tw` = lebar teks dalam poin.
 */
export function numberAnchor(position: NumberPosition, W: number, H: number, tw: number) {
  switch (position) {
    case "bottom-right":
      return { x: W - tw - NUMBER_MARGIN_X, y: H - NUMBER_BASELINE_BOTTOM };
    case "top-right":
      return { x: W - tw - NUMBER_MARGIN_X, y: NUMBER_BASELINE_TOP };
    default:
      return { x: (W - tw) / 2, y: H - NUMBER_BASELINE_BOTTOM };
  }
}

/** Ukuran font watermark yang proporsional dengan halaman. */
export const watermarkSize = (text: string, W: number, H: number) =>
  (Math.min(W, H) / Math.max(Array.from(text).length, 6)) * 1.6;

/**
 * Titik dasar watermark miring φ° (berlawanan jarum jam) supaya teks tepat di tengah,
 * di ruang TAMPILAN. `tw` = lebar teks, `size` = ukuran font.
 */
export function watermarkAnchor(W: number, H: number, tw: number, size: number, rotation: number) {
  const phi = (rotation * Math.PI) / 180;
  return {
    x: W / 2 - (Math.cos(phi) * tw) / 2 + Math.sin(phi) * size * 0.35,
    y: H / 2 + (Math.sin(phi) * tw) / 2 + Math.cos(phi) * size * 0.35,
  };
}

// ───────────────────────────── Font ─────────────────────────────

export const CSS_FONTS: Record<FontKey, string> = {
  helv: "Helvetica, Arial, 'Liberation Sans', sans-serif",
  times: "'Times New Roman', Times, 'Liberation Serif', serif",
  courier: "'Courier New', Courier, 'Liberation Mono', monospace",
};

export const TEXT_ASCENT = 0.8;
export const LINE_HEIGHT = 1.25;

export const MARK_PATHS = {
  check: "M4 12.5 L9.5 18 L20 6",
  cross: "M6 6 L18 18 M18 6 L6 18",
} as const;
export const MARK_STROKE = 2.6;

/** Panjang kepala panah. */
export const arrowHead = (width: number) => Math.max(8, width * 4);
export const ARROW_SPREAD = 28;
