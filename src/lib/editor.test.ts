import { describe, expect, it } from "vitest";
import {
  applySort,
  blankPage,
  clonePage,
  groupPages,
  groupTransform,
  norm,
  numberLabel,
  pageToView,
  rotateVec,
  shiftSelected,
  viewSize,
  viewToPage,
  watermarkAnchor,
  type PageItem,
  type Rot,
  type Stamp,
} from "./editor";
import { toRoman } from "./pdf";

const ROTS: Rot[] = [0, 90, 180, 270];
const W = 600;
const H = 800;

function page(id: string, extra: Partial<PageItem> = {}): PageItem {
  return { id, source: 0, index: 0, base: 0, rotate: 0, w: W, h: H, annotations: [], ...extra };
}

/** Terapkan matriks SVG `matrix(a b c d e f)` ke titik. */
function applyMatrix(m: string, x: number, y: number): [number, number] {
  if (!m) return [x, y];
  const [a, b, c, d, e, f] = m.slice(7, -1).split(" ").map(Number);
  return [a * x + c * y + e, b * x + d * y + f];
}

describe("rotasi & koordinat", () => {
  it("norm membulatkan ke kelipatan 90 dan membungkus negatif / > 360", () => {
    expect(norm(0)).toBe(0);
    expect(norm(-90)).toBe(270);
    expect(norm(450)).toBe(90);
    expect(norm(-720)).toBe(0);
    expect(norm(89)).toBe(90);
  });

  it("ukuran tampilan bertukar di 90/270", () => {
    expect(viewSize(page("a", { rotate: 90 }))).toEqual({ w: H, h: W });
    expect(viewSize(page("a", { base: 90, rotate: 90 }))).toEqual({ w: W, h: H });
    expect(viewSize(page("a", { rotate: -90 }))).toEqual({ w: H, h: W });
  });

  it("viewToPage ∘ pageToView = identitas di semua rotasi", () => {
    for (const r of ROTS)
      for (const [x, y] of [
        [0, 0],
        [12.5, 40],
        [W, H],
        [300, 17],
      ]) {
        const [xv, yv] = pageToView(x, y, r, W, H);
        expect(viewToPage(xv, yv, r, W, H)).toEqual([x, y]);
      }
  });

  it("matriks SVG groupTransform ≡ pageToView (pratinjau = hasil)", () => {
    for (const r of ROTS)
      for (const [x, y] of [
        [0, 0],
        [W, 0],
        [0, H],
        [123, 456],
      ]) {
        const [mx, my] = applyMatrix(groupTransform(r, W, H), x, y);
        const [vx, vy] = pageToView(x, y, r, W, H);
        expect(mx).toBeCloseTo(vx);
        expect(my).toBeCloseTo(vy);
      }
  });

  it("pojok kiri-atas halaman jatuh di pojok yang benar (putar searah jarum jam)", () => {
    expect(pageToView(0, 0, 90, W, H)).toEqual([H, 0]); // kanan-atas
    expect(pageToView(0, 0, 180, W, H)).toEqual([W, H]); // kanan-bawah
    expect(pageToView(0, 0, 270, W, H)).toEqual([0, W]); // kiri-bawah
  });

  it("geser di layar mengikuti arah layar pada halaman berotasi", () => {
    // Halaman diputar 90°: geser ke kanan di layar = ke atas (y−) … di ruang halaman asli.
    const r: Rot = 90;
    const [dx, dy] = rotateVec(10, 0, -r);
    const start = pageToView(100, 100, r, W, H);
    const moved = pageToView(100 + dx, 100 + dy, r, W, H);
    expect(moved[0] - start[0]).toBeCloseTo(10);
    expect(moved[1] - start[1]).toBeCloseTo(0);
  });

  it("rotateVec tepat di 90° (tanpa sisa floating point)", () => {
    expect(rotateVec(1, 0, 90)).toEqual([0, 1]);
    expect(rotateVec(0, 1, 90)).toEqual([-1, 0]);
  });
});

describe("nomor halaman", () => {
  const base: Stamp["numbers"] = { enabled: true, format: "n", position: "bottom-center", startAt: 1, skipFirst: false };

  it("angka biasa, n/total, romawi", () => {
    expect(numberLabel(base, 0, 5)).toBe("1");
    expect(numberLabel({ ...base, format: "n-of-total" }, 2, 5)).toBe("3 / 5");
    expect(numberLabel({ ...base, format: "roman" }, 3, 5)).toBe("IV");
    expect(numberLabel({ ...base, startAt: 10 }, 0, 5)).toBe("10");
  });

  it("lewati sampul", () => {
    const s = { ...base, skipFirst: true, format: "n-of-total" as const };
    expect(numberLabel(s, 0, 5)).toBeNull();
    expect(numberLabel(s, 1, 5)).toBe("1 / 4");
    expect(numberLabel(s, 4, 5)).toBe("4 / 4");
  });

  it("toRoman", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(9)).toBe("IX");
    expect(toRoman(14)).toBe("XIV");
    expect(toRoman(1994)).toBe("MCMXCIV");
    expect(toRoman(0)).toBe("0");
  });

  it("watermark tanpa kemiringan berpusat horizontal", () => {
    const { x } = watermarkAnchor(W, H, 200, 40, 0);
    expect(x).toBeCloseTo(W / 2 - 100);
  });
});

describe("operasi daftar halaman", () => {
  const ids = (list: { id: string }[]) => list.map((p) => p.id).join("");
  const abcde = ["a", "b", "c", "d", "e"].map((id) => page(id));

  it("groupPages memecah setelah id potongan dan membuang grup kosong", () => {
    expect(groupPages(abcde, ["b", "d"]).map(ids)).toEqual(["ab", "cd", "e"]);
    expect(groupPages(abcde, ["e"]).map(ids)).toEqual(["abcde"]);
    expect(groupPages([], ["x"])).toEqual([]);
  });

  it("applySort menyisipkan blok terpilih di indeks sisa", () => {
    expect(ids(applySort(abcde, ["a"], 2))).toBe("bcade");
    expect(ids(applySort(abcde, ["b", "d"], 0))).toBe("bdace");
    expect(ids(applySort(abcde, ["d", "b"], 3))).toBe("acebd"); // tetap urutan dokumen
    expect(ids(applySort(abcde, ["a"], 99))).toBe("bcdea");
  });

  it("shiftSelected memindahkan blok satu posisi dan berhenti di tepi", () => {
    expect(ids(shiftSelected(abcde, ["c"], -1))).toBe("acbde");
    expect(ids(shiftSelected(abcde, ["b", "c"], 1))).toBe("adbce");
    expect(ids(shiftSelected(abcde, ["a", "c"], -1))).toBe("acbde");
    expect(ids(shiftSelected(abcde, ["e"], 1))).toBe("abcde");
  });

  it("clonePage memberi id baru untuk halaman dan setiap anotasi", () => {
    const p = page("a", {
      annotations: [{ id: "t1", kind: "text", x: 1, y: 2, angle: 0, text: "x", size: 12, color: "#000000", bold: false }],
    });
    const c = clonePage(p);
    expect(c.id).not.toBe(p.id);
    expect(c.annotations[0].id).not.toBe("t1");
    expect(c.annotations[0]).toMatchObject({ kind: "text", text: "x" });
    expect(p.annotations[0].id).toBe("t1"); // aslinya tidak berubah
  });

  it("blankPage mengikuti ukuran terlihat tetangga, atau A4", () => {
    expect(blankPage(page("a", { rotate: 90 }))).toMatchObject({ source: -1, w: H, h: W, rotate: 0 });
    expect(blankPage()).toMatchObject({ w: 595.28, h: 841.89 });
  });
});
