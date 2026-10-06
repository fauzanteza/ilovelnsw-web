// Utilitas umum PDF yang tidak bergantung pada pdf-lib/pdf.js.

export type PdfErrorCode =
  | "password" // terkunci password saat dibuka (pdf.js)
  | "unreadable" // bukan PDF / rusak
  | "encrypted" // terenkripsi saat ekspor (pdf-lib)
  | "empty"; // tidak ada halaman untuk disimpan

/**
 * Error yang aman ditampilkan ke pengguna. UI memetakan `code` ke pesan dua bahasa,
 * sehingga error teknis lain bisa dibedakan dan diberi pesan umum.
 */
export class PdfError extends Error {
  constructor(
    public code: PdfErrorCode,
    public file?: string,
  ) {
    super(file ? `${code}: ${file}` : code);
    this.name = "PdfError";
  }
}

const ROMAN: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** Angka romawi kapital; angka ≤ 0 dikembalikan sebagai angka biasa. */
export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  let rest = Math.floor(n);
  let out = "";
  for (const [value, sym] of ROMAN) {
    while (rest >= value) {
      out += sym;
      rest -= value;
    }
  }
  return out;
}

/** Nama file tanpa ekstensi .pdf. */
export const stem = (name: string) => name.replace(/\.pdf$/i, "") || "dokumen";

export function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0).replace(".", ",")} ${units[i]}`;
}

/** Unduh blob lewat `<a download>`. */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
