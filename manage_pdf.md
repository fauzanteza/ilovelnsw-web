# Kelola PDF (Manage PDF): Spesifikasi Teknis untuk Replikasi

Dokumen ini menjelaskan fitur **Kelola PDF** secara lengkap: stack, arsitektur, model data, sistem koordinat, algoritma, UI/UX, performa, dan jebakan yang perlu dihindari. Tujuannya supaya fitur ini bisa dibangun ulang di project lain, termasuk project yang tidak memakai Svelte.

Fitur ini menggabungkan beberapa alat lama dalam satu editor: **gabung, pisah, putar, urutkan, hapus, duplikat, ambil halaman, halaman kosong, nomor halaman, watermark**, plus **editor isi halaman** (teks, edit teks yang sudah ada, pena, stabilo, penutup, bentuk, garis/panah, centang/silang, tanggal, gambar, tanda tangan).

> Prinsip utama: **semua diproses di browser.** Tidak ada byte dokumen yang dikirim ke server. Biaya server nol, terasa instan, dan aman untuk dokumen pribadi.

---

## Daftar isi

1. [Stack & library](#1-stack--library)
2. [Peta file](#2-peta-file)
3. [Arsitektur & alur data](#3-arsitektur--alur-data)
4. [Model data](#4-model-data)
5. [Sistem koordinat & rotasi (bagian terpenting)](#5-sistem-koordinat--rotasi)
6. [Memuat file & thumbnail](#6-memuat-file--thumbnail)
7. [Layar grid: operasi halaman](#7-layar-grid-operasi-halaman)
8. [Undo / redo](#8-undo--redo)
9. [Seret untuk mengurutkan (sortable)](#9-seret-untuk-mengurutkan-sortable)
10. [Nomor halaman & watermark](#10-nomor-halaman--watermark)
11. [Pisah file (cuts)](#11-pisah-file-cuts)
12. [Ekspor PDF (pdf-lib)](#12-ekspor-pdf-pdf-lib)
13. [Editor isi halaman (DocEditor)](#13-editor-isi-halaman-doceditor)
14. [Interaksi anotasi di halaman (EditorPage)](#14-interaksi-anotasi-di-halaman-editorpage)
15. [Edit teks yang sudah ada](#15-edit-teks-yang-sudah-ada)
16. [Penempatan adaptif & deteksi garis tanda tangan](#16-penempatan-adaptif--deteksi-garis-tanda-tangan)
17. [Tanda tangan & paraf](#17-tanda-tangan--paraf)
18. [Pintasan keyboard](#18-pintasan-keyboard)
19. [UI/UX: tata letak, gaya, animasi, responsif](#19-uiux-tata-letak-gaya-animasi-responsif)
20. [Performa](#20-performa)
21. [Aksesibilitas](#21-aksesibilitas)
22. [Error handling & teks pesan](#22-error-handling--teks-pesan)
23. [Testing](#23-testing)
24. [Keterbatasan yang diketahui & ide perbaikan](#24-keterbatasan-yang-diketahui--ide-perbaikan)
25. [Panduan port ke framework lain](#25-panduan-port-ke-framework-lain)
26. [Checklist implementasi](#26-checklist-implementasi)

---

## 1. Stack & library

| Lapisan | Pilihan | Versi terpasang | Peran |
|---|---|---|---|
| Framework | SvelteKit + **Svelte 5 (runes)** | kit 2.70, svelte 5.57 | UI & reaktivitas (`$state`, `$derived`, `$effect`) |
| Build | Vite 6 + `@sveltejs/adapter-static` | | Situs statis/prerender, tanpa server Node |
| Bahasa | TypeScript 5.7 | | |
| CSS | Tailwind CSS 4 (`@tailwindcss/vite`) + CSS per komponen | 4.3 | Utility + gaya scoped |
| **Tulis/susun PDF** | **pdf-lib** | 1.17.1 | Salin halaman, rotasi, gambar teks/bentuk/gambar, simpan |
| **Render/baca PDF** | **pdfjs-dist** (pdf.js) | 4.10.x (`^4.8.69`) | Thumbnail, render halaman, ukuran & rotasi halaman, ekstraksi teks |
| Test | Vitest 2 (environment `node`) | | Unit test geometri, ekspor, snap, text run |

Kenapa **dua** library PDF:
- **pdf-lib** bisa *menulis* PDF (copy page, draw, save), tetapi **tidak bisa merender** ke gambar.
- **pdf.js** bisa *merender* dan membaca teks, tetapi **tidak bisa menulis**.

Jadi pdf.js dipakai untuk semua yang terlihat di layar, dan pdf-lib hanya dipakai saat menyimpan.

Konfigurasi penting di `vite.config.ts`:

```ts
export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  worker: { format: "es" },                 // worker pdf.js adalah modul ES
  optimizeDeps: { include: ["pdf-lib"] },   // pdf-lib CJS → di-prebundle
});
```

Worker pdf.js di-bundle sendiri (bukan dari CDN), jadi tetap jalan offline dan dokumen tidak pernah keluar dari perangkat:

```ts
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
```

> Di Next.js/Webpack: salin `pdf.worker.min.mjs` ke `public/` lalu set `workerSrc = "/pdf.worker.min.mjs"`, atau pakai `new Worker(new URL(...), { type: "module" })` dan `GlobalWorkerOptions.workerPort`.

`pdfrender.ts` di-*import* secara dinamis (`await import("$lib/pdfrender")`). Bundle pdf.js (~1 MB) baru diunduh saat pengguna benar-benar membuka file, dan modul ini tidak ikut saat prerender/SSR (pdf.js butuh `window`/`document`).

---

## 2. Peta file

```
src/lib/
├─ components/tools/PdfEditor.svelte    # Layar grid (entry fitur): load, operasi halaman, panel, simpan, undo
├─ components/editor/
│  ├─ DocEditor.svelte                  # Editor isi layar penuh: rail alat, zoom, panel, props bar, tanda tangan
│  ├─ EditorPage.svelte                 # Satu halaman di editor: render malas, pointer, seleksi, teks, edit teks
│  ├─ PageOverlay.svelte                # Lapisan SVG anotasi + nomor + watermark (thumbnail & editor)
│  └─ state.svelte.ts                   # EditorState: alat aktif, gaya default, seleksi, snap
├─ editor.ts                            # Model data, geometri rotasi, resize, EKSPOR (pdf-lib)
├─ pdfrender.ts                         # pdf.js: openPdf, pageInfos, renderPageUrl
├─ textruns.ts                          # Gabung potongan teks pdf.js → baris yang bisa diedit
├─ snap.ts                              # Deteksi garis dari piksel + snapBox
├─ signatures.svelte.ts                 # Simpan tanda tangan (localStorage) + trimToPng
├─ actions/sortable.ts                  # Seret-urut berbasis Pointer Events
├─ actions/portal.ts                    # Pindahkan node ke <body> (modal/overlay)
├─ components/SignatureDialog.svelte    # Buat tanda tangan: gambar / ketik / unggah foto
├─ components/SignaturePad.svelte       # Kanvas gambar (Bézier + tebal berdasar kecepatan/tekanan)
├─ components/Dropzone.svelte           # Pilih/jatuhkan file (varian stage & compact)
├─ components/ResultActions.svelte      # Unduh / Simpan ke Drive
└─ pdf.ts                               # PdfError, toRoman, downloadBlob, dll.
```

Ukuran kira-kira: PdfEditor ~1.200 baris, DocEditor ~1.800, EditorPage ~980, editor.ts ~680, sortable ~360.

---

## 3. Arsitektur & alur data

```
                 ┌──────────────────────────── PdfEditor (pemilik state) ───────────────────────────┐
File[] ──► addFiles ──► sources[] (ArrayBuffer asli, untuk pdf-lib)                                 │
                   └─► docs[]    (PDFDocumentProxy, untuk render & teks)                            │
                   └─► pages[]   (PageItem: urutan, rotasi, anotasi)  ◄── semua operasi halaman    │
                   └─► thumbs{}  ("source:index" → object URL JPEG)                                 │
                        cuts[], selection[], stamp, past[]/future[] (undo)                          │
                                                                                                    │
   Grid (thumbnail + PageOverlay)          DocEditor (layar penuh, via portal)                      │
        │ dblclick/Enter/"Edit isi PDF"  ──►  props: pages, docs, thumbs, stamp,                    │
        │                                       checkpoint(), patch(id, fn), undo, redo             │
        │                                     └─ EditorPage × N  ─► patch() mengubah pages[i]       │
        ▼                                                                                           │
   save() ─► exportPdfs(sources, groups, stamp)  ─► Uint8Array[] ─► Blob[] ─► modal hasil           │
                                                                     (Unduh / Simpan ke Drive)      │
                 └──────────────────────────────────────────────────────────────────────────────────┘
```

Keputusan desain inti:

1. **Satu sumber kebenaran:** `pages: PageItem[]`. Urutan array = urutan dokumen hasil. Gabung = menambahkan halaman dari sumber lain ke array yang sama.
2. **Non-destruktif sampai disimpan.** File asli tidak pernah diubah. Rotasi, urutan, dan anotasi hanyalah data. Ekspor membangun PDF baru dari `sources` + `pages`.
3. **Pratinjau = hasil.** Anotasi digambar di layar sebagai SVG dengan rumus koordinat yang sama dengan ekspor (ada tes yang memastikan `groupTransform` ≡ `pageToView`).
4. **Editor anak tidak punya state dokumen sendiri.** DocEditor/EditorPage mengubah halaman lewat `patch(id, fn)` dan mencatat riwayat lewat `checkpoint()` milik induk, sehingga undo/redo tetap satu tumpukan untuk grid dan editor.
5. **Thumbnail di-cache per halaman sumber** (`"source:index"`), bukan per `PageItem`. Duplikat halaman memakai gambar yang sama. Rotasi pengguna diterapkan lewat CSS `transform`, bukan render ulang.

---

## 4. Model data

Semua di `editor.ts`.

```ts
export type Rot = 0 | 90 | 180 | 270;
export type FontKey = "helv" | "times" | "courier";   // 3 keluarga font standar PDF (tanpa embed file font)

export type PageItem = {
  id: string;            // uid unik per item (duplikat = id baru)
  source: number;        // indeks ke sources[]/docs[]; -1 = halaman kosong
  index: number;         // indeks halaman di PDF sumber (0-based)
  base: Rot;             // rotasi bawaan halaman di PDF sumber (/Rotate)
  rotate: number;        // putaran tambahan dari pengguna (kelipatan 90, boleh negatif/lebih dari 360)
  w: number; h: number;  // ukuran ASLI dalam poin, TANPA rotasi (dari crop box / page.view)
  annotations: Annotation[];
};

export type Annotation = TextAnn | RectAnn | InkAnn | ImageAnn | LineAnn | MarkAnn;

type TextAnn  = { id; kind: "text";  x; y; angle: Rot; text; size; color; bold; italic?; font?: FontKey };
type RectAnn  = { id; kind: "rect";  x; y; w; h; angle: Rot;
                  mode: "box" | "ellipse" | "highlight" | "whiteout"; color; stroke;
                  origin?: string };           // kunci text run yang ditutup (fitur edit teks)
type LineAnn  = { id; kind: "line";  x1; y1; x2; y2; color; width; arrow: boolean };
type MarkAnn  = { id; kind: "mark";  x; y; size; angle: Rot; symbol: "check" | "cross"; color };
type InkAnn   = { id; kind: "ink";   points: number[]; color; width };   // [x0,y0,x1,y1,…]
type ImageAnn = { id; kind: "image"; x; y; w; h; angle: Rot; src: string }; // src = data URL PNG/JPEG

export type Stamp = {
  numbers:   { enabled; format: "n" | "n-of-total" | "roman";
               position: "bottom-center" | "bottom-right" | "top-right"; startAt; skipFirst };
  watermark: { enabled; text; opacity; rotation };
};
export const DEFAULT_STAMP: Stamp = {
  numbers:   { enabled: false, format: "n", position: "bottom-center", startAt: 1, skipFirst: false },
  watermark: { enabled: false, text: "SALINAN", opacity: 0.18, rotation: 45 },
};

export type Source = { name: string; bytes: ArrayBuffer };
export const uid = () => Math.random().toString(36).slice(2, 10);
```

Aturan model:
- Koordinat anotasi selalu disimpan di **ruang halaman asli** (poin, origin kiri-atas, **y ke bawah**), *bukan* ruang layar. Akibatnya anotasi ikut berputar bersama halaman, seperti di Acrobat.
- `angle` pada teks/kotak/gambar/tanda = rotasi tampilan saat objek itu dibuat. Objek tetap tegak di tampilan tempat ia dibuat; kalau halaman diputar lagi, objek ikut miring bersama halaman.
- Warna disimpan sebagai hex `#rrggbb`.
- Gambar disimpan sebagai **data URL** supaya objek anotasi bisa di-*clone* (`structuredClone`/snapshot) tanpa referensi Blob.

---

## 5. Sistem koordinat & rotasi

Bagian ini yang paling mudah salah. Ada tiga ruang:

| Ruang | Origin & sumbu | Dipakai untuk |
|---|---|---|
| **Halaman asli** ("page") | kiri-atas halaman tanpa rotasi, y ke bawah, satuan poin | Menyimpan anotasi |
| **Tampilan** ("view") | kiri-atas halaman *setelah* diputar R, y ke bawah, poin | Pointer, seleksi, snap, kotak pembatas |
| **PDF** | kiri-bawah crop box, y ke atas, poin | Saat menggambar dengan pdf-lib |

Rotasi total tampilan:

```ts
export const norm = (deg: number): Rot => ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as Rot;
export const viewRot = (p) => norm(p.base + p.rotate);
export function viewSize(p) {                     // ukuran yang terlihat
  const r = viewRot(p);
  return r === 90 || r === 270 ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}
```

Konversi titik (W×H = ukuran asli):

```ts
// tampilan → halaman asli
function viewToPage(xv, yv, r, w, h) {
  switch (r) { case 90: return [yv, h - xv];  case 180: return [w - xv, h - yv];
               case 270: return [w - yv, xv]; default: return [xv, yv]; }
}
// halaman asli → tampilan
function pageToView(xt, yt, r, w, h) {
  switch (r) { case 90: return [h - yt, xt];  case 180: return [w - xt, h - yt];
               case 270: return [yt, w - xt]; default: return [xt, yt]; }
}
// transformasi SVG <g> yang setara pageToView (overlay digambar di ruang halaman asli)
function groupTransform(r, w, h) {
  switch (r) { case 90: return `matrix(0 1 -1 0 ${h} 0)`;
               case 180: return `matrix(-1 0 0 -1 ${w} ${h})`;
               case 270: return `matrix(0 -1 1 0 0 ${w})`; default: return ""; }
}
// putar vektor searah jarum jam (y ke bawah); dibulatkan supaya cos/sin 90° tepat 0
function rotateVec(dx, dy, deg) {
  const a = deg * Math.PI / 180;
  const c = Math.round(Math.cos(a) * 1e9) / 1e9, s = Math.round(Math.sin(a) * 1e9) / 1e9;
  return [dx * c - dy * s, dx * s + dy * c];
}
```

Pola pemakaian:
- **Geser anotasi** sejauh (dx, dy) di layar: ubah ke vektor halaman dengan `rotateVec(dx, dy, -R)` lalu tambahkan ke x/y (atau ke semua titik ink/line).
- **Kerangka lokal** objek berkotak (teks/kotak/gambar/tanda) = `rotate(-angle)` di sekitar (x, y). Titik lokal (u, v) → halaman: `[x, y] + rotateVec(u, v, -angle)`.
- **Kotak pembatas di tampilan** (`viewBox`): ambil 4 sudut kerangka lokal (atau semua titik ink), ubah ke tampilan dengan `pageToView`, ambil min/max, tambahkan padding (setengah tebal garis + 2; panah + panjang kepala). Karena semua sudut kelipatan 90°, kotak ini selalu tegak lurus layar.
- **PDF ↔ halaman asli:** `toPdf(xt, yt) = { x: cropBox.x + xt, y: cropBox.y + H - yt }`. Pakai **crop box** halaman *setelah* dicopy, bukan media box; banyak PDF punya crop box dengan origin ≠ (0,0).

Dari pdf.js, ukuran asli & rotasi bawaan diambil dari `page.view` (= crop box `[x1,y1,x2,y2]`) dan `page.rotate`.

Rotasi halaman di grid dirender sebagai CSS: gambar thumbnail (yang sudah memuat rotasi bawaan) diputar `rotate(page.rotate deg)` di dalam kotak dengan rasio `viewSize`. Kalau rotasi pengguna 90/270, lebar/tinggi `<img>` ditukar memakai unit container query (`100cqh`/`100cqw`), lalu `translate(-50%,-50%)` dari tengah. Transisi `0.55s` dengan easing spring, jadi halaman terlihat "berputar".

---

## 6. Memuat file & thumbnail

```ts
async function addFiles(list: File[]) {
  opening = pages.length === 0;                                // layar loader besar hanya untuk file pertama
  const { openPdf, pageInfos, renderPageUrl } = await import("$lib/pdfrender");
  for (const file of list) {
    const bytes = await file.arrayBuffer();
    const doc = await openPdf(bytes.slice(0));                 // ⚠ pdf.js MEMINDAHKAN buffer ke worker → kirim salinan
    const infos = await pageInfos(doc);                        // {index, w, h, rotate} per halaman
    const source = sources.length;
    sources.push({ name: file.name, bytes });                  // simpan buffer asli untuk pdf-lib
    docs.push(doc);
    for (const info of infos) added.push({ id: uid(), source, index: info.index,
      base: norm(info.rotate), rotate: 0, w: info.w, h: info.h, annotations: [] });
  }
  checkpoint(); pages = [...pages, ...added];                  // halaman langsung bisa diatur…
  for (const page of added) {                                  // …thumbnail menyusul satu per satu
    const key = `${page.source}:${page.index}`;
    if (!thumbs[key]) thumbs[key] = await renderPageUrl(docs[page.source], page.index, 300);
    loading.done++;
  }
}
```

`renderPageUrl(doc, index, widthPx, rotation?, type = "image/jpeg")`:
1. `page.getViewport({ scale: 1, rotation })` untuk lebar dasar, lalu `scale = widthPx / base.width`.
2. Kanvas baru, **isi putih dulu** (PDF transparan jadi tidak hitam di JPEG), lalu `page.render(...)`.
3. `canvas.toBlob(type, 0.82)` → `URL.createObjectURL(blob)`. **Object URL, bukan data URL**: lebih hemat memori dan tidak memblokir thread untuk base64.
4. `canvas.width = canvas.height = 0` untuk membebaskan memori kanvas segera (penting di iOS Safari yang membatasi total memori kanvas).

Detail lain:
- Thumbnail grid: lebar **300 px, JPEG 0.82**. Selama belum ada, tampil *shimmer* (gradien bergerak 1,2 s).
- Halaman yang gagal dirender tetap bisa diatur, hanya tanpa pratinjau.
- Bilah atas menampilkan "Menyiapkan halaman 12/40" + `LoaderMini`, dan ada progress bar 3 px di bawahnya.
- Halaman masuk dengan animasi `scale` 0.9→1, delay bertahap `min(index, 20) * 18 ms`.
- Saat komponen dihancurkan: `URL.revokeObjectURL` untuk semua thumbnail dan `doc.destroy()` untuk semua dokumen pdf.js.
- Deteksi PDF berpassword: pesan error pdf.js memuat "password" (`PasswordException`). Arahkan pengguna ke alat Buka Password.

---

## 7. Layar grid: operasi halaman

Semua operasi bekerja pada `targets(id?)`: kalau dipanggil dari tombol di kartu, targetnya satu halaman; kalau dari bilah atas, targetnya `selection`. **Setiap operasi memanggil `checkpoint()` dulu.**

| Operasi | Implementasi |
|---|---|
| Putar ±90° | `page.rotate += delta` (tidak dinormalisasi supaya transisi CSS selalu berputar ke arah yang benar) |
| Hapus | filter `pages`, bersihkan `cuts` & `selection`, tampilkan **toast** "N halaman dihapus. Ctrl+Z untuk membatalkan" (3,2 s) |
| Duplikat | sisipkan salinan tepat setelah aslinya; `id` baru, dan **setiap anotasi juga diberi id baru** |
| Halaman kosong | `source: -1`, ukuran mengikuti halaman tetangga (`viewSize`), atau A4 `595.28 × 841.89` |
| Ambil halaman terpilih | `save(true)`: ekspor hanya `selection` sebagai satu file `…-halaman-terpilih.pdf` |
| Tambah file | `Dropzone variant="compact"` di bilah atas; halaman baru ditambahkan di akhir |
| Pisah | gunting di antara kartu (lihat §11) |

Seleksi:
- Klik = toggle satu halaman. **Shift+klik** = tambahkan rentang dari klik terakhir (`lastClicked`).
- Ctrl/Cmd+A = pilih semua. Esc = kosongkan.
- Klik dua kali / Enter = buka editor isi di halaman itu. Spasi = toggle pilih.
- Saat ada seleksi, bilah atas berubah jadi **bilah aksi kontekstual**: badge jumlah, "dipilih", putar kiri/kanan, duplikat, hapus, "Ambil halaman ini", batal pilih.

Kartu halaman (`.cell`):
- Bingkai `aspect-ratio: 3/4`, padding 10 px, radius 18 px, latar `--sunken`; di dalamnya "kertas" putih dengan rasio asli halaman (`width: min(100cqw, 100cqh * var(--ar))`) dan bayangan.
- Pojok kiri-atas: lingkaran centang (muncul saat hover/terpilih, *spring scale* 1.1). Pojok kanan-atas: badge pena kalau halaman punya anotasi.
- Bawah: pil gelap berisi tombol putar kiri/kanan, edit, duplikat, hapus. Muncul saat hover/focus-within dengan slide naik 8 px. Di perangkat sentuh (`@media (hover: none)`) selalu tampil.
- Caption: nomor halaman (tabular-nums) + nama file sumber (atau "Halaman kosong").
- Sel terakhir: tombol bergaris putus-putus "+ Halaman kosong".
- Slider ukuran thumbnail 110–260 px (desktop), dipasang ke CSS var `--thumb` untuk `grid-template-columns: repeat(auto-fill, minmax(var(--thumb), 1fr))`. Di layar ≤480 px grid selalu 2 kolom.

---

## 8. Undo / redo

Snapshot penuh (bukan command pattern). Sederhana dan cukup cepat karena data halaman kecil.

```ts
type Snap = { pages: PageItem[]; cuts: string[] };
let past: Snap[] = [], future: Snap[] = [];
const snap = () => ({ pages: $state.snapshot(pages), cuts: [...cuts] });  // deep clone non-reaktif

function checkpoint() { past.push(snap()); if (past.length > 80) past.shift(); future = []; }
function undo() { const s = past.pop(); if (!s) return; future.push(snap()); restore(s); }
function redo() { const s = future.pop(); if (!s) return; past.push(snap()); restore(s); }
function restore(s) {
  pages = s.pages; cuts = s.cuts;
  selection = selection.filter(id => pages.some(p => p.id === id));     // buang seleksi yang sudah tidak ada
  if (editingId && !pages.some(p => p.id === editingId)) editingId = null;
}
```

Aturan kapan memanggil `checkpoint()`:
- **Sebelum** mutasi diskret (putar, hapus, tambah anotasi, ubah warna).
- Untuk gerakan kontinu (seret objek, ubah ukuran, slider tebal garis): **sekali di awal gerakan**, bukan per frame. Contoh: saat seret objek baru melewati ambang 3 px; `pointerdown` pada slider tebal garis.
- `stamp` (nomor/watermark) **tidak** masuk riwayat; itu pengaturan dokumen, bukan edit.
- Batas 80 langkah. ⚠ Snapshot memuat data URL gambar/tanda tangan, jadi riwayat bisa memakan memori kalau banyak gambar besar (lihat §24).

---

## 9. Seret untuk mengurutkan (sortable)

`actions/sortable.ts` adalah action Svelte (fungsi `(node, options) => { update, destroy }`) yang mudah di-port ke hook React atau JS biasa. **Tidak memakai HTML5 Drag & Drop**, karena:
- gambar seret bawaan statis & transparan,
- tidak jalan di layar sentuh,
- `dragover` membuat grid berkedip.

Pemakaian:

```svelte
<ul use:sortable={{ ids, selection, onsort: (moving, at) => …, onstart, onend, disabled }}>
  {#each pages as page (page.id)}<li data-sort-id={page.id}>…</li>{/each}
</ul>
```

Algoritma:

1. **pointerdown** pada item (abaikan `button, input, a, textarea, select, [data-no-drag]`):
   - Mouse: mulai menyeret setelah bergerak **> 6 px**.
   - Sentuh/pena: **tahan 260 ms** (long-press). Kalau jari bergerak > 10 px sebelum itu, anggap scroll biasa dan batalkan.
2. **begin:**
   - Yang dipindah = semua halaman terpilih (dalam urutan dokumen) kalau item yang dipegang termasuk seleksi; kalau tidak, hanya item itu.
   - Ukur **slot** semua item sekali (`getBoundingClientRect` + `scrollX/Y` → koordinat dokumen).
   - Buat **ghost**: `div` fixed berisi `cloneNode(true)` item, `pointer-events:none`, `z-index:1000`. Kalau memindah >1 halaman, tambahkan maksimal 2 lapisan "tumpukan" (geser 6 px, miring 2,5°) + badge jumlah.
   - Item yang dipindah diberi kelas `.sort-source`, ditampilkan sebagai "lubang" bergaris putus-putus.
   - `navigator.vibrate?.(8)` sebagai haptik di HP. Animasi "angkat" 160 ms ke `scale(1.04)`.
   - Pasang listener `pointermove` (non-passive), `pointerup`, `pointercancel`, `keydown` (Esc), dan `touchmove` dengan `preventDefault` supaya halaman tidak ikut menggulir.
3. **move** (dibatasi `requestAnimationFrame`):
   - Ghost: `translate(x - offsetX, y - offsetY) rotate(tilt) scale(1.04)`; tilt = selisih horizontal × 0,02, dibatasi ±4°.
   - Cari **slot terdekat** dari titik tengah ghost dengan jarak berbobot `dx² + (dy·1.4)²` (sumbu vertikal diberi bobot lebih supaya pindah baris terasa disengaja).
   - `target = nearest - indeks item yang dipegang di dalam moving`, di-clamp.
   - Bangun urutan baru `rest[0..target] + moving + rest[target..]` dan geser **setiap sel dengan `transform: translate(...)`** dari slot lamanya ke slot barunya (transisi 0,32 s `cubic-bezier(0.22,1,0.36,1)`). **DOM tidak diubah selama menyeret.**
   - Auto-scroll: kalau kursor ≤ 90 px dari tepi atas/bawah viewport, `scrollBy(0, ±((jarak/90)²) * 22)` per frame.
4. **up:**
   - Telan klik berikutnya (`click` capture sekali) supaya lepasan tidak dianggap "pilih halaman".
   - Ghost dianimasikan **mendarat** di slot tujuan (220 ms), lalu dihapus.
   - Kalau urutan berubah: panggil `onsort(moving, target)`. Induk menerapkan urutan baru ke state.
   - Setelah `tick()` (DOM sudah berurutan baru), lepas semua `transform` **tanpa transisi** (posisi nyata = posisi visual, jadi tidak ada loncatan). Sel yang baru mendarat diberi `.sort-landing` (`visibility:hidden`) sampai ghost selesai mendarat.
5. **Esc / pointercancel:** semua kembali ke posisi awal.
6. `prefers-reduced-motion`: semua durasi 0.

Interaksi dengan animasi daftar Svelte (`animate:flip`): saat urutan dari seretan diterapkan, set `settling = true` supaya durasi FLIP = 0 (sel sudah di tempatnya), lalu kembalikan setelah 2× `requestAnimationFrame`. Untuk perubahan urutan lain (Alt+panah, hapus, duplikat), FLIP 380 ms tetap aktif.

Selama menyeret: `html.is-sorting * { cursor: grabbing !important; user-select: none !important }`, dan tombol melayang/gunting/centang disembunyikan supaya grid tenang.

Alternatif tanpa mouse: **Alt+← / Alt+→** memindahkan blok terpilih satu posisi.

---

## 10. Nomor halaman & watermark

Pengaturan di panel samping (`<details>` dengan switch di `<summary>`). Pratinjau langsung di setiap thumbnail dan di editor lewat `PageOverlay` (SVG).

**Nomor halaman**

```ts
function numberLabel(s, position, total) {
  if (s.skipFirst && position === 0) return null;          // lewati sampul
  const n = s.startAt + position - (s.skipFirst ? 1 : 0);
  const count = total - (s.skipFirst ? 1 : 0);
  return s.format === "roman" ? toRoman(n) : s.format === "n-of-total" ? `${n} / ${count}` : String(n);
}
```

- Ukuran font 10 pt, Helvetica, warna `rgb(0.2,0.2,0.25)`.
- Posisi di ruang **tampilan**: tengah-bawah `x=(W−tw)/2, y=H−28`; kanan-bawah `x=W−tw−40, y=H−28`; kanan-atas `x=W−tw−40, y=40`.
- Nomor dihitung **per file keluaran**: kalau dokumen dipisah, tiap bagian mulai dari `startAt` lagi.

**Watermark**

- Teks tebal, abu `rgb(0.45,0.45,0.5)`, opacity 0,05–0,6 (default 0,18), kemiringan 0–90° (default 45°).
- Ukuran: `size = (min(W,H) / max(len(text), 6)) * 1.6`.
- Supaya teks miring tepat di tengah, titik dasar dihitung:
  `xv = W/2 − cos(φ)·tw/2 + sin(φ)·size·0.35`, `yv = H/2 + sin(φ)·tw/2 + cos(φ)·size·0.35`.
- Di SVG cukup `text-anchor="middle" dominant-baseline="central"` + `rotate(-φ, cx, cy)`.

Teks di pdf-lib digambar dengan rotasi `degrees(R + φ)` di titik hasil `viewToPage`, sehingga tetap tegak di tampilan walaupun halaman diputar.

---

## 11. Pisah file (cuts)

- `cuts: string[]` berisi **id halaman yang menjadi akhir sebuah bagian**.
- Tombol gunting bulat kecil di celah kanan setiap kartu (kecuali kartu terakhir), muncul saat hover; di perangkat sentuh selalu tampil. Saat aktif: kuning, dan ada garis putus-putus vertikal (`::before`) yang menandai titik potong.
- Panel "Pisah file": tombol **Tiap halaman** (`cuts = semua kecuali terakhir`) dan **Hapus potongan**; badge "N file".
- Mengubah `cuts` masuk riwayat undo.
- Pengelompokan:

```ts
const groups = (() => {
  const result = [[]];
  for (const page of pages) { result.at(-1).push(page); if (cuts.includes(page.id)) result.push([]); }
  return result.filter(g => g.length);
})();
```

- Tombol simpan berubah jadi "Simpan 3 PDF". Nama hasil: `{stem}-bagian-{n}.pdf`; satu file: `{stem}-kelola.pdf`; seleksi: `{stem}-halaman-terpilih.pdf`. `stem` = nama file pertama tanpa `.pdf`.

---

## 12. Ekspor PDF (pdf-lib)

```ts
export async function exportPdfs(sources: Source[], groups: PageItem[][], stamp: Stamp): Promise<Uint8Array[]> {
  const loaded = new Map<number, PDFDocument>();                 // muat tiap sumber SEKALI
  const load = async (i) => loaded.get(i) ?? (loaded.set(i, await PDFDocument.load(sources[i].bytes)), loaded.get(i));
  const outputs = [];
  for (const pages of groups) {
    const out = await PDFDocument.create();
    const { fonts, images } = await embedResources(out, pages);  // font & gambar ditanam sekali per dokumen
    for (let position = 0; position < pages.length; position++) {
      const item = pages[position];
      const page = item.source < 0
        ? out.addPage([item.w, item.h])
        : out.addPage((await out.copyPages(await load(item.source), [item.index]))[0]);
      const r = viewRot(item);
      page.setRotation(degrees(r));                               // rotasi = /Rotate, bukan menggambar ulang isi
      const box = page.getCropBox();
      const ctx = { page, r, w: item.w, h: item.h, ox: box.x, oy: box.y };
      for (const ann of item.annotations) drawAnnotation(ctx, ann, fonts, images);
      /* watermark lalu nomor halaman (lihat §10) */
    }
    outputs.push(await out.save());
  }
  return outputs;
}
```

`embedResources`: kumpulkan font yang dibutuhkan (selalu Helvetica & Helvetica-Bold untuk nomor/watermark, plus `standardFont(ann)` tiap teks) dan gambar unik per `src` (`embedPng` kalau `data:image/png`, selain itu `embedJpg`).

`drawAnnotation` per jenis:

| Jenis | Cara gambar |
|---|---|
| `text` | per baris (`split("\n")`): baseline = `(x,y) + down(size·0.8 + i·size·1.25)` dengan `down(d) = [d·sin a, d·cos a]`; `drawText(safeText(font, line), { size, font, color, rotate: degrees(a) })` |
| `rect` box | `drawRectangle({ borderColor, borderWidth, rotate })`. Jangkar pdf-lib = sudut **kiri-bawah** di kerangka lokal, yaitu titik `(x,y) + down(h)` |
| `rect` highlight | `drawRectangle({ color, opacity: 0.4, blendMode: BlendMode.Multiply })` (teks di bawahnya tetap terbaca) |
| `rect` whiteout | `drawRectangle({ color: fill })`, isi solid |
| `rect` ellipse | `drawEllipse` di titik tengah; untuk sudut 90/270 tukar `xScale`/`yScale` (elips simetris) |
| `line` | `drawLine` dengan `LineCapStyle.Round`; panah = 2 garis dari ujung, panjang `max(8, width·4)`, bukaan ±28° |
| `ink` | `drawLine` antar titik berurutan, round cap (polyline) |
| `mark` | `drawSvgPath(path, { scale: size/24, rotate, borderColor, borderWidth: 2.6, borderLineCap: Round })`; path: centang `M4 12.5 L9.5 18 L20 6`, silang `M6 6 L18 18 M18 6 L6 18` |
| `image` | `drawImage(embedded, { x, y, width: w, height: h, rotate })` dengan jangkar kiri-bawah seperti kotak |

Font standar PDF hanya mendukung **WinAnsi**. Karakter lain (emoji, aksara non-Latin, beberapa tanda kutip) membuat pdf-lib *throw*, jadi diganti `?`:

```ts
function safeText(font, text) {
  const ok = new Set(font.getCharacterSet());
  return Array.from(text).map(c => ok.has(c.codePointAt(0)!) ? c : "?").join("");
}
```

Pemetaan font: `helv` → Helvetica, `times` → Times-Roman, `courier` → Courier, masing-masing dengan varian Bold / Oblique(Italic) / BoldOblique. Di layar, padanan CSS-nya `Helvetica, Arial, 'Liberation Sans'` / `'Times New Roman', Times, 'Liberation Serif'` / `'Courier New', Courier, 'Liberation Mono'` (metriknya hampir sama, jadi pratinjau cocok dengan hasil).

**Varian "tulis di dokumen asli"** (`annotatePdf`, dipakai alat Tanda Tangan PDF): `PDFDocument.load(source)` lalu gambar anotasi langsung ke `doc.getPage(index)` dan `save()`. Bookmark, formulir, dan metadata tetap utuh. Gunakan varian ini kalau urutan/jumlah halaman tidak berubah.

Setelah simpan, hasil **tidak diunduh otomatis**. Muncul modal "PDF siap" berisi daftar file + ukuran, dengan tombol **Unduh** (`<a download>` per file, jeda 300 ms antarfile supaya browser tidak memblokir) dan **Simpan ke Google Drive** (opsional). Klik di luar modal atau Esc menutup.

---

## 13. Editor isi halaman (DocEditor)

Overlay layar penuh (`position: fixed; inset: 0; z-index: 80`), dirender lewat `portal` ke `<body>`, dengan tema gelap (`#1b1a17`) supaya kertas putih menonjol. Saat dibuka, `document.documentElement.style.overflow = "hidden"`.

### Tata letak

```
┌ top bar (3.5rem, gelap) ─────────────────────────────────────────────────────────────┐
│ ← [panel] Nama file / N halaman │ ↑ 3/12 ↓ │ − [125% ▾] + │   undo redo │ [✓ Selesai] │
├──────┬──────────┬────────────────────────────────────────────────────────────────────┤
│ rail │ thumbs   │  props bar kontekstual (sticky, mengambang di atas halaman)        │
│ alat │ (≥1100px)│  ┌─ Halaman 1 ──── ⟲ ⟳ ┐                                           │
│ 4.75 │ 13.5rem  │  │      kertas putih   │   semua halaman dalam satu gulir vertikal │
│ rem  │          │  └─────────────────────┘                                           │
└──────┴──────────┴────────────────────────────────────────────────────────────────────┘
```

### Rail alat (mode edit)

| Alat | Ikon | Pintasan |
|---|---|---|
| Pilih | cursor | V |
| Edit teks (yang ada) | text-edit | E |
| Teks | type | T |
| Tanda tangan | signature | S |
| Pena | pen | P |
| Stabilo | highlighter | H |
| Penutup (whiteout) | eraser | W |
| **Bentuk** ▸ Kotak / Elips / Garis / Panah | shapes | B / O / L / A |
| **Isian** ▸ Centang / Silang / Tanggal | check | K / X / D |
| Gambar | image | I (membuka file picker) |

Grup memakai **flyout**: tombol grup menampilkan ikon alat terakhir yang dipilih dari grup itu (`groupPick`), ada segitiga kecil di pojok, dan klik membuka menu di samping (di HP: menu tetap di atas rail bawah). Mode `sign` (alat Tanda Tangan PDF) memakai rail yang lebih pendek.

### Props bar kontekstual

Isinya ditentukan oleh `kind`: jenis objek terpilih, atau alat aktif kalau tidak ada yang dipilih.
- Teks: pilih font (Sans/Serif/Mono), stepper ukuran 4–200, **B**, *I*.
- Warna: swatch (`COLORS` 9 warna; `HIGHLIGHTS` 5 warna untuk stabilo; putih/krem/abu/hitam untuk penutup) + `<input type="color">`.
- Pena/garis/kotak/elips: slider tebal 0,5–14.
- Ada objek terpilih: tombol Duplikat (Ctrl+D) dan Hapus (Del).
- Tidak ada objek terpilih: teks petunjuk per alat ("Klik di halaman untuk mulai mengetik.", "Seret untuk menutup bagian halaman.", …) + tombol Batal saat sedang menaruh gambar.
- Mengubah gaya saat ada objek terpilih juga mengubah objek itu (dengan checkpoint). Tanpa seleksi, yang berubah gaya default (`EditorState`).

### Zoom

- Satuan: `PT = 96/72` (1 poin PDF = 1,333 px CSS pada 100%).
- Mode: `"auto"` = `min(fitWidth, 125%)`, `"width"`, `"page"`, atau angka.
- `fitWidth = (lebarStage − (narrow ? 24 : 72)) / lebarAcuan`. **Lebar acuan = median lebar halaman, bukan maksimum**, supaya satu halaman lanskap tidak membuat semua halaman potret mengecil.
- `fitPage = min(fitWidth, (tinggiStage − 72) / tinggiHalamanSaatIni)`.
- Tangga zoom: `[0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]`; batas 25–400%.
- **Zoom terjangkar:** simpan titik dokumen di bawah anchor (`scrollLeft + ax`), ubah zoom, `await tick()`, lalu `scrollLeft = cx * k − ax` (k = skala baru / lama). Anchor default: tengah horizontal, sepertiga atas.
- Ctrl/Cmd + roda (termasuk cubit trackpad, yang dikirim browser sebagai `ctrlKey` wheel): faktor `exp(−deltaY · 0.0022)`, terjangkar di kursor. Listener **non-passive** karena butuh `preventDefault`.
- Cubit dua jari (touch events): skala = jarak awal / jarak sekarang, terjangkar di titik tengah.
- Menu zoom: Muat lebar, Muat halaman, 50/75/100/125/150/200/300%.

### Navigasi

- Halaman "sekarang" = halaman terakhir yang `offsetTop`-nya ≤ `scrollTop + 35% tinggi stage` (dihitung di `onScroll`, dibatasi rAF).
- ↑/↓ di bar atas, klik thumbnail di panel → `scrollTo({ top: node.offsetTop − 60, behavior: "smooth" })`.
- Thumbnail aktif di panel di-`scrollIntoView({ block: "nearest" })`.
- Saat dibuka, editor langsung menggulir ke halaman yang diklik dua kali, setelah ukuran stage terukur (supaya skalanya sudah final).

### Salin / tempel

`Ctrl+C/X` menyalin objek terpilih ke clipboard internal (`st.clipboard`, bukan clipboard OS). `Ctrl+V` menempel di halaman terpilih/halaman saat ini dengan offset 14 pt. `Ctrl+D` = duplikat di tempat (offset 14).

### Tambah gambar

`FileReader → dataURL → Image.decode()`. Format selain PNG/JPEG (mis. WEBP) dikonversi ke PNG lewat kanvas, karena pdf-lib hanya mendukung PNG & JPEG. Gambar ditaruh di tengah halaman saat ini dengan lebar `min(45% lebar halaman, lebar asli)`, lalu langsung terpilih.

---

## 14. Interaksi anotasi di halaman (EditorPage)

Struktur DOM satu halaman:

```html
<section class="pg" data-page-id>
  <header>Halaman 3  ⟲ ⟳</header>
  <div class="sheet" data-page-sheet style="width:W*scale; height:H*scale; cursor:…">
    <img class="lo">        <!-- thumbnail 300px (sementara), diputar CSS, sedikit blur -->
    <img class="hi">        <!-- render resolusi tinggi sesuai zoom, fade-in 180ms -->
    <PageOverlay/>          <!-- SVG anotasi + nomor + watermark -->
    <div class="runs">      <!-- kotak klik "edit teks yang ada" -->
    <div class="sel">       <!-- kotak seleksi + 4/8 pegangan -->
    <textarea class="text-edit"> <!-- saat mengetik -->
    <span class="guide">    <!-- garis bantu snap -->
    <img class="ghost">     <!-- bayangan gambar yang akan ditaruh -->
  </div>
</section>
```

Hit-testing memakai DOM: setiap anotasi di SVG punya `data-id`, setiap pegangan punya `data-handle`, dan elemen UI yang tidak boleh memicu alat diberi `data-ui`. `event.target.closest("[data-id]")` sudah cukup; tidak perlu menghitung geometri sendiri. Garis tipis diberi garis transparan setebal `max(width, 10)` supaya mudah diklik, dan teks diberi `<rect fill="transparent">` seukuran kotaknya.

`pointerdown` pada `.sheet` memanggil `preventDefault()` (kalau tidak, fokus pindah ke `<body>` dan textarea baru langsung blur), lalu `setPointerCapture`. Alurnya:

| Kondisi | Aksi |
|---|---|
| sedang mengetik | selesaikan teks (commit), berhenti |
| klik pegangan p1/p2 (garis) | drag `end`: geser satu ujung; Shift = kunci 45° |
| klik pegangan lain | drag `resize` |
| sedang menaruh gambar/tanda tangan | taruh di posisi hover yang sudah di-snap |
| klik teks dengan alat Teks/Edit | masuk mode mengetik |
| alat pilih/edit/sign/image (atau isian di atas objek) | pilih objek + siapkan drag `move`; klik di area kosong = batal pilih |
| Teks | buat teks kosong di titik itu (baseline ≈ kursor), mulai mengetik |
| Tanggal | buat teks berisi tanggal hari ini (`toLocaleDateString` "3 Oktober 2026"), langsung terpilih |
| Centang/Silang | buat tanda 18 pt berpusat di kursor |
| Pena | buat ink, drag `ink` |
| Stabilo/Kotak/Elips/Penutup | buat rect 0×0, drag `rect` (Shift = persegi) |
| Garis/Panah | buat line, drag `line` (Shift = kelipatan 45°) |

Detail drag:
- **move:** baru dianggap menyeret setelah > 3 px layar. Saat itu `checkpoint()` dan kotak seleksi masuk gaya "terangkat" (garis putus-putus + bayangan). Objek di-snap (§16) kecuali Alt ditahan. Ink & garis tidak di-snap.
- **ink:** pakai `event.getCoalescedEvents()` untuk goresan halus pada pointer 120 Hz+. Titik baru hanya ditambahkan kalau berjarak > 1,5 px layar dari titik terakhir. Satu klik tanpa gerak = titik kecil (ditambah satu titik +0,1).
- **rect/line selesai:** kalau ukuran < 4 px layar, objek dibuang (klik tidak sengaja). Kalau tidak, objek langsung terpilih.
- **resize:** `resizeBox(startBox, handle, dx, dy, keepRatio)` di ruang tampilan, lalu `fitToBox(orig, page, box)` memetakan kotak baru kembali ke objek:
  - ink/line: semua titik diskalakan relatif terhadap kotak lama;
  - teks: ubah **ukuran font** (`size × box.h/old.h`, dibulatkan 0,5, 4–200);
  - kotak/gambar: `w,h` (ditukar kalau `norm(R − angle) % 180 === 90`);
  - tanda: `size = max(w,h)`.
  Lalu objek digeser supaya kotak pembatasnya tepat di `box`.
- Rasio terkunci untuk semua jenis kecuali `rect` (hanya pegangan sudut yang tampil); **Shift membalik kunci rasio**. Rect punya 8 pegangan.

```ts
function resizeBox(start, handle, dx, dy, keepRatio, min = 4) {
  let { x, y, w, h } = start;
  if (handle.includes("e")) w = start.w + dx;   if (handle.includes("w")) w = start.w - dx;
  if (handle.includes("s")) h = start.h + dy;   if (handle.includes("n")) h = start.h - dy;
  w = Math.max(min, w); h = Math.max(min, h);
  if (keepRatio && handle.length === 2) {
    const f = Math.max(w / start.w, h / start.h, min / Math.min(start.w, start.h));
    w = start.w * f; h = start.h * f;
  }
  if (handle.includes("w")) x = start.x + start.w - w;
  if (handle.includes("n")) y = start.y + start.h - h;
  return { x, y, w, h };
}
```

Mengetik:
- `<textarea>` transparan diletakkan tepat di atas teks (font CSS & ukuran × scale, `line-height: 1.25`, `white-space: pre`, `transform: rotate(norm(R − angle))`, origin kiri-atas). Teks SVG aslinya disembunyikan (`hideId`) selama mengetik.
- Setiap `input` langsung meng-update anotasi.
- Selesai dengan Esc, Ctrl/Cmd+Enter, blur, atau klik di halaman. **Teks kosong otomatis dibuang** (efek yang memantau perubahan `st.editing`).
- Klik dua kali pada teks, atau klik kedua pada teks yang sudah terpilih (tanpa digeser), = mulai mengetik.

Ukuran teks di layar diukur dengan `CanvasRenderingContext2D.measureText` (satu kanvas dipakai ulang): lebar = baris terpanjang (minimal `size·0,6`), tinggi = `jumlahBaris · size · 1,25`. Baseline baris pertama = `y + size · 0,8` (`TEXT_ASCENT`).

Sentuh:
- `.sheet` memakai `touch-action: pan-x pan-y` supaya halaman bisa digulir.
- Listener `touchstart` non-passive memanggil `preventDefault` hanya kalau alat menggambar aktif, atau jari mengenai objek/pegangan. Dengan alat pilih di area kosong, jari tetap menggulir.

Kursor: SVG kustom hitam-dengan-garis-putih (`--cursor-pen`, `--cursor-cross` di `app.css`), karena kursor bawaan OS bisa putih di mode gelap dan tidak terlihat di atas kertas putih. Teks memakai `text`; saat menaruh gambar `copy`; objek `move`.

---

## 15. Edit teks yang sudah ada

PDF tidak menyimpan paragraf, hanya potongan glyph yang diposisikan absolut. Cara yang andal (dan dipakai editor PDF web lain): **tutup teks lama dengan kotak berwarna latar, lalu taruh teks baru di posisi & ukuran yang sama.**

1. Saat alat **Edit teks** aktif dan halaman terlihat: `page.getTextContent()` (pdf.js), di-cache per dokumen+halaman (`WeakMap<PDFDocumentProxy, Map<index, Promise<TextRun[]>>>`).
2. `buildRuns(items, page.view, hint)` (`textruns.ts`):
   - Untuk tiap item: `size = hypot(c, d)` dari `transform = [a,b,c,d,e,f]`. **Lewati** teks miring/terbalik (`|b| > 0.02|a|`, `a ≤ 0`, atau `d ≤ 0`) dan teks < 1 pt.
   - Posisi: `x = e − view.x1`, baseline `= view.y2 − f` (y ke bawah).
   - Urutkan per baris (toleransi baseline 0,3 × size), lalu per x.
   - Gabungkan potongan berurutan kalau baseline sama (< 0,3·size), ukuran mirip (< 20%), dan celah antara −0,5·size dan 1,2·size. Sisipkan spasi kalau celah > 0,15·size dan belum ada spasi.
   - Run: `x` (dikoreksi spasi di depan), `y = baseline − size·0,92`, `w`, `h = size·1,18`, `size` dibulatkan 0,5, plus `key = "x:baseline:16 huruf pertama"`.
   - `guessFont`: buang prefix subset (`ABCDEF+`), lalu courier/mono/consol/menlo → `courier`; times/serif/georgia/garamond/cambria/minion/book/palatino → `times`; selain itu `helv`. Bold dari bold/black/heavy/semibold/demi; italic dari italic/oblique. Petunjuk diambil dari `content.styles[fontName]` dan `page.commonObjs.get(fontName)`.
3. Setiap run digambar sebagai `<button class="run">` transparan dengan outline putus-putus biru tipis; hover = latar biru 10% + outline solid. Run yang sudah ditutup (`RectAnn.origin === run.key`) disembunyikan.
4. Klik run → `sampleColors(box)` dari gambar halaman yang sudah dirender:
   - **Latar:** histogram warna piksel di **tepi** kotak (bingkai 2 px), dikuantisasi ke 15-bit (5 bit/kanal); warna terbanyak = latar.
   - **Teks:** urutkan semua piksel berdasar jarak warna dari latar; rata-rata 4% piksel terjauh = warna teks (kalau kontrasnya < 90, pakai hitam).
5. Tambahkan dua anotasi dalam satu checkpoint: `rect whiteout` (warna latar, origin = key, sedikit lebih lebar ±1 pt) + `text` (isi, font, ukuran, warna sama), lalu langsung masuk mode mengetik dengan kursor di akhir teks.

Hasilnya, menghapus teks = kosongkan isi teks baru (penutup tetap ada); mengganti teks = ketik ulang.

---

## 16. Penempatan adaptif & deteksi garis tanda tangan

Tujuannya: tanda tangan "tertarik" ke garis tanda tangan `________` di dokumen, rata tengah garis, dan semua objek bisa rata tengah halaman. Ada garis bantu visual. **Tahan Alt untuk menaruh bebas.**

**Deteksi garis dari piksel** (`findLines`, `snap.ts`). Bekerja pada gambar halaman yang sudah dirender, jadi garis gambar, garis bawah teks, dan garis tabel hasil scan sama-sama terbaca:
1. Gambar halaman diperkecil ke lebar ≤ 1000 px, lalu `getImageData` (kanvas `willReadFrequently: true`).
2. Piksel gelap = alpha > 128 dan luminans `0,299R+0,587G+0,114B < 150`.
3. Per baris piksel, cari deretan gelap dengan panjang ≥ `max(24, 7% lebar)`, dengan toleransi celah ≤ 2 px (antialias/garis putus halus).
4. Deretan yang bertumpuk di baris berurutan digabung jadi *band*. Band yang lebih tebal dari `max(3, 0,5% tinggi)` dibuang (blok/foto/teks tebal).
5. Hasil `{x1, x2, y}` dikonversi ke poin tampilan dan **di-cache per URL gambar**.

**snapBox(box, { w, h, lines, threshold, magnet, sink = 0.18 })**:
- Magnet garis: kandidat yang tumpang tindih horizontal ≥ 30% dari `min(lebar kotak, lebar garis)`. Target `y = garis.y − h·(1 − sink)` (tanda tangan sedikit "duduk" menembus garis, 18%). Pilih yang terdekat dalam jarak `magnet`.
  - Setelah menempel: kalau pusat kotak dekat pusat garis (< 2·threshold), ratakan ke tengah garis (garis bantu vertikal pendek); kalau tidak, dan dekat ujung kiri, ratakan ke kiri.
- Kalau tidak menempel garis: rata tengah halaman kalau pusatnya < threshold dari tengah.
- Selalu di-clamp di dalam halaman.
- **Jarak tangkap dihitung dalam piksel layar** supaya terasa sama di semua zoom: `threshold = 8 / scale`, `magnet = 44 / scale` (dalam poin).

Garis magnet hanya dipakai untuk gambar/tanda tangan. Objek lain hanya rata tengah. Visual: garis bantu 1 px magenta `#e11d74`; garis tanda tangan yang "menangkap" disorot kuning tebal 3 px dengan glow dan animasi scaleX 0,6→1.

---

## 17. Tanda tangan & paraf

**Penyimpanan** (`signatures.svelte.ts`): `localStorage["avagenc.signatures"]` berisi `SavedSig[]` `{ id, kind: "sign" | "initials", src: PNG dataURL, w, h }`, maksimal 6 item (terbaru di depan). Tidak pernah dikirim ke server. Semua akses dibungkus `try/catch` (mode privat / kuota penuh).

**trimToPng(source, w, h, { removeLight, tint, maxSide = 1600 })**:
1. Gambar ke kanvas (diperkecil ke sisi terpanjang ≤ maxSide).
2. Kalau `removeLight` (foto tanda tangan di kertas): `alpha *= clamp((215 − lum)/70, 0, 1)`, jadi bagian terang jadi transparan dengan tepi halus; opsional warnai ulang ke warna tinta (`tint`).
3. Cari bounding box piksel dengan alpha > 12, beri padding 1% + 2 px, potong, lalu `toDataURL("image/png")`.

**SignatureDialog**, tiga tab:
- **Gambar:** `SignaturePad`. Kanvas dengan DPR, goresan dihaluskan memakai `quadraticCurveTo` melalui titik tengah antartitik. Tebal 1,1–3,6 px mengikuti **kecepatan** (cepat = tipis) atau **tekanan** pena (`pointerType === "pen"`). Memakai `getCoalescedEvents`. Ganti warna tinta = gambar ulang semua goresan.
- **Ketik:** 4 font tulisan tangan Google Fonts (Dancing Script, Great Vibes, Caveat, Sacramento), dimuat hanya saat dialog dibuka; dirender ke kanvas ukuran 120 px lalu `trimToPng`.
- **Unggah:** foto tanda tangan di kertas; toggle "buang latar" (default aktif) dan warna tinta.
- Pilihan tinta: hitam `#0b0a08`, biru `#1d3fae`, merah `#b42318`.

**Menaruh tanda tangan**:
- Klik kartu tanda tangan → mode menaruh (`st.placing`): bayangan semi-transparan mengikuti kursor (sudah di-snap), klik halaman = taruh. Lebar default: tanda tangan `min(170, 32% lebar halaman)`, paraf `min(64, 14%)`.
- **Seret dari panel ke halaman** (desktop, mode sign). Klon mengikuti kursor dengan **pegas**, bukan menempel kaku:
  - Posisi `pos += (target − pos) · 0,34` per frame, ukuran `· 0,24`.
  - Miring mengikuti kecepatan horizontal (`vx · 0,7`, ±10°); di atas halaman miringnya dikurangi jadi 25% supaya presisi.
  - Titik yang dipegang (`gx, gy` relatif 0..1) tetap di bawah kursor.
  - Halaman di bawah kursor dicari dengan `document.elementFromPoint(...).closest("[data-page-sheet]")`. Di atas halaman, klon berubah ke ukuran akhir (× zoom), kartu putihnya hilang, kotak di-snap, dan halaman tujuan diberi cincin kuning (`.drop-target`).
  - Lepas di atas halaman: animasi **mendarat** 170 ms, lalu diganti anotasi sungguhan. Lepas di luar: klon **kembali** ke panel (260 ms, memudar). Esc membatalkan.
  - Auto-scroll di tepi stage (70 px, kecepatan kuadratik maks 18).
  - Gerak < 4 px = dianggap klik (masuk mode menaruh).
- Di HP / mode edit: tanda tangan dipilih dari **bottom sheet**.

---

## 18. Pintasan keyboard

Layar grid:

| Tombol | Aksi |
|---|---|
| Ctrl/Cmd+Z, Ctrl+Shift+Z / Ctrl+Y | Undo / Redo |
| Ctrl/Cmd+A | Pilih semua halaman |
| Delete / Backspace | Hapus halaman terpilih |
| Alt+← / Alt+→ | Pindahkan halaman terpilih satu posisi |
| Esc | Batal pilih / tutup modal hasil |
| Enter (pada kartu) | Buka editor isi |
| Spasi (pada kartu) | Toggle pilih |

Editor isi:

| Tombol | Aksi |
|---|---|
| V E T S P H W B O L A K X D I | Pilih alat (lihat §13) |
| Ctrl + / Ctrl − / Ctrl 0 | Zoom in / out / auto |
| Ctrl+Z / Ctrl+Y | Undo / Redo (riwayat yang sama dengan grid) |
| Ctrl+C / X / V / D | Salin / potong / tempel / duplikat objek |
| Delete / Backspace | Hapus objek terpilih |
| Panah (Shift = 10) | Geser objek 1 pt (10 pt) |
| Esc | Bertahap: tutup menu → batal menaruh → selesai mengetik → batal pilih → kembali ke alat Pilih |
| Shift (saat menggambar) | Persegi / garis 45° / balik kunci rasio saat resize |
| Alt (saat menyeret/menaruh) | Matikan snap |

Pintasan diabaikan kalau fokus ada di `input, textarea, select, [contenteditable]` (kecuali zoom), dan pintasan grid dinonaktifkan selama editor isi terbuka.

---

## 19. UI/UX: tata letak, gaya, animasi, responsif

### Tiga tahap layar
1. **Kosong:** Dropzone besar. Seluruh panel bisa diklik, file bisa dijatuhkan di mana saja di halaman (listener `dragenter/leave` di `window` dengan penghitung kedalaman), menerima banyak PDF sekaligus.
2. **Membuka file pertama:** loader besar ("Membuka PDF / Membaca halaman di perangkatmu…").
3. **Ruang kerja:** grid 2 kolom di desktop (`minmax(0,1fr) 320px`):
   - **Kiri:** bilah atas *sticky* (`top: 4.75rem`, latar semi-transparan + `backdrop-filter: blur(12px)`, radius 24 px), teks petunjuk (versi desktop & HP berbeda), grid halaman.
   - **Kanan:** panel *sticky* berisi akordion `<details>` (Nomor halaman, Watermark, Pisah file), tombol besar **Simpan PDF**, "Mulai ulang", dan catatan privasi dengan ikon perisai.

### Token visual (dari `app.css`)

```css
--makara: #f6db00;  --makara-deep: #d9bf00;  --makara-soft: #fdf5c4;  --on-makara: #0b0a08;  /* aksen kuning */
--night: #0b0a08;   --on-night: #f6f5f0;     --on-night-muted: #a9a79d; --night-line: rgb(255 255 255 / .1);
--fg: #121110; --muted: #5d5b54; --faint: #8b8980;
--bg: #f3f2ee; --surface: #fff; --sunken: #ebeae5; --line: #e2e0da; --line-strong: #cbc9c1;
--danger: #b42318; --danger-soft: #fdecea;
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--font-sans: "DM Sans";  --font-serif: "Fraunces";
```

Warna fungsional di editor: seleksi biru `#1f5fd1`, garis bantu magenta `#e11d74`, magnet/drop target kuning `--makara`.

### Animasi (semua menghormati `prefers-reduced-motion`)

| Elemen | Animasi |
|---|---|
| Kartu masuk | scale 0.9→1, 380 ms, stagger 18 ms |
| Perubahan urutan | FLIP 380 ms (dimatikan saat menerapkan hasil seret) |
| Rotasi halaman | `transform` 550 ms spring |
| Tombol melayang kartu | opacity + translateY 8 px, 250/350 ms |
| Centang seleksi | spring scale 1.1 |
| Seret | angkat 160 ms, geser sel 320 ms, mendarat 220 ms |
| Panel akordion | `slide` 250 ms |
| Modal hasil | backdrop fade 180 ms + kartu fly y:24 320 ms |
| Toast | fly y:20 320 ms, hilang setelah 3,2 s |
| Gambar halaman resolusi tinggi | fade-in 180 ms di atas thumbnail |
| Kotak seleksi | outline fade-in 160 ms |
| Tombol ikon | `:active` scale 0.9 |

### Responsif
- `< 1024px`: panel kanan turun ke bawah grid.
- `≤ 480px`: grid selalu 2 kolom; gunting lebih dekat ke kartu.
- `@media (hover: none)`: tombol kartu, centang, dan gunting selalu terlihat (tidak ada hover di HP).
- Seret di HP: **tahan 260 ms** lalu seret; petunjuk HP: "Ketuk untuk memilih, tahan lalu seret untuk mengurutkan."
- Editor isi `< 900px`:
  - rail pindah ke **bawah** (`flex-direction: column-reverse`), scroll horizontal, padding `env(safe-area-inset-bottom)`;
  - flyout jadi menu tetap di atas rail;
  - tanda tangan via bottom sheet;
  - label tombol utama disembunyikan;
  - ada tombol zoom mengambang (`.zoom-fab`, < 768 px);
  - panel thumbnail hanya tampil ≥ 1100 px.
- Pegangan resize di `pointer: coarse`: 20 px bulat (desktop 12 px kotak).

### Mikro-copy
Gaya bahasa santai dan jelas, dua bahasa (id/en) lewat helper `L(id, en)`. Contoh: "Klik untuk memilih (Shift untuk rentang), seret untuk mengurutkan (atau Alt+panah), klik dua kali untuk mengedit isi. Gunting di antara halaman untuk memisah file."

---

## 20. Performa

1. **Lazy import** modul pdf.js (`await import("$lib/pdfrender")`) dan `textruns` hanya saat dibutuhkan.
2. **Satu dokumen pdf.js per file**, dipakai ulang untuk thumbnail, render editor, dan teks. `doc.destroy()` saat selesai.
3. **Thumbnail bertahap & berurutan:** halaman sudah bisa diatur sebelum semua thumbnail siap.
4. **Object URL + kanvas dibebaskan** (`canvas.width = 0`) setelah `toBlob`; semua URL di-revoke saat tidak dipakai.
5. **Thumbnail dibagi** antarhalaman duplikat (key `source:index`); rotasi via CSS, tanpa render ulang.
6. **Render malas di editor:** `IntersectionObserver` dengan `root = stage` dan `rootMargin: "700px 0px"`; hanya halaman (hampir) terlihat yang dirender resolusi tinggi.
7. **Tangga resolusi:** lebar render dibulatkan ke pangkat 1,3 (`px = 1.3^ceil(log(want)/log(1.3))`), `want = clamp(viewW·scale·min(dpr,2), 400, 2800)`. Zoom kecil tidak memicu render ulang; render ulang ditunda 160 ms (debounce) kalau sudah ada gambar.
8. **Antrian render serial** (`queue = queue.then(job)`): render paralel banyak halaman membuat gulir tersendat. Job yang sudah usang (key berubah) dilewati, dan URL hasilnya langsung di-revoke.
9. **Placeholder instan:** thumbnail 300 px tampil (diperbesar, sedikit blur) sampai render tinggi siap.
10. **Rotasi berubah** → buang gambar render lama (tidak cocok lagi).
11. **Ekspor:** setiap PDF sumber di-*load* sekali per ekspor (Map); font & gambar di-*embed* sekali per dokumen keluaran (gambar dideduplikasi per `src`).
12. **Seret:** ukur slot sekali di awal, lalu hanya `transform` (komposit GPU, tanpa reflow); update dibatasi rAF; `will-change: transform` selama menyeret.
13. **Pointer:** `getCoalescedEvents` untuk ink, ambang jarak 1,5 px supaya jumlah titik terkendali.
14. **Deteksi garis:** gambar diperkecil ≤ 1000 px, hasil di-cache per URL gambar.
15. **Text runs** di-cache per dokumen+halaman dalam `WeakMap` (otomatis bebas bersama dokumen).
16. `buffer.slice(0)` saat membuka di pdf.js: pdf.js men-*transfer* ArrayBuffer ke worker (buffer asli jadi kosong/detached), padahal pdf-lib masih butuh byte asli saat ekspor.

---

## 21. Aksesibilitas

- Kartu halaman: `role="button"`, `tabindex=0`, `aria-pressed` (terpilih), `aria-label="Halaman N"`, Enter/Spasi berfungsi.
- Semua tombol ikon punya `title` + `aria-label`.
- Switch: `<input type="checkbox" role="switch">`; grup pilihan: `role="radiogroup"` + `role="radio"` + `aria-checked`.
- Modal hasil: `role="dialog" aria-modal="true" aria-labelledby`. Toast: `role="status"`.
- Rail editor: `<nav aria-label="Alat">`, `aria-pressed` per alat; flyout `aria-haspopup="menu"` + `aria-expanded`, item `role="menuitem"` dengan `<kbd>` pintasan.
- Halaman di editor: `role="application"` + label.
- Alternatif keyboard untuk semua gerakan mouse: Alt+panah untuk mengurutkan, panah untuk menggeser objek, pintasan alat.
- Reduced motion dihormati di sortable, animasi tanda tangan, dan transisi.
- Pesan error: `role="alert"`.

---

## 22. Error handling & teks pesan

| Kasus | Deteksi | Pesan (id) |
|---|---|---|
| PDF berpassword (saat buka) | pesan/nama error pdf.js memuat "password" | "“x.pdf” terkunci password. Buka dulu lewat alat Buka Password PDF." |
| PDF rusak (saat buka) | error lain dari pdf.js | "“x.pdf” tidak bisa dibaca sebagai PDF." |
| PDF terenkripsi (saat ekspor) | pesan pdf-lib memuat "encrypt" | "… terkunci password. Buka proteksinya dulu…" |
| Tidak ada halaman | `outputs.length === 0` | "Tidak ada halaman untuk disimpan." |
| Gagal simpan lainnya | catch | "Gagal menyimpan PDF." |
| File bukan PDF dijatuhkan | `matchesAccept` di Dropzone | "Sebagian file dilewati. Alat ini hanya menerima PDF." |
| Satu halaman gagal render | catch per halaman | diam; halaman tetap bisa diatur tanpa pratinjau |

`PdfError extends Error` dipakai untuk membedakan pesan yang aman ditampilkan ke pengguna dari error teknis.

---

## 23. Testing

Vitest, environment `node`. pdf-lib jalan di Node, jadi ekspor bisa diuji end-to-end tanpa browser.

- **Geometri rotasi:** `norm`; ukuran bertukar di 90/270; `viewToPage ∘ pageToView = identitas` di semua rotasi; **matriks SVG `groupTransform` ≡ `pageToView`** (menjamin pratinjau = hasil); pojok kiri-atas jatuh di pojok yang benar; geser mengikuti arah layar di halaman berotasi.
- **Nomor halaman:** angka, n/total, romawi, lewati sampul.
- **Ekspor:** susun ulang, putar, halaman kosong, pisah; menanam anotasi/nomor/watermark termasuk karakter non-WinAnsi; menolak ekspor kosong; elips, garis/panah, tanda, penutup berwarna, font serif/mono; `annotatePdf` mempertahankan metadata.
- **Resize:** pegangan sisi/sudut + kunci rasio; `fitToBox` tepat di semua jenis × semua rotasi; teks diperbesar lewat ukuran font.
- **snap:** `findLines` menemukan garis tipis panjang dan mengabaikan blok tebal/coretan pendek; menyambung celah antialias; `snapBox` (duduk di garis, rata tengah, jarak terlalu jauh, magnet mati, clamp).
- **textruns:** penggabungan + spasi yang hilang; pemisahan karena celah/ukuran; abaikan teks miring/kosong; `guessFont`.

Cara membuat PDF uji di test: `PDFDocument.create()`, `addPage([w,h])`, `setRotation(degrees(90))`, `save()` → jadikan `Source`, ekspor, lalu `PDFDocument.load(hasil)` dan periksa `getPageCount()`, `getRotation().angle`, `getSize()`.

---

## 24. Keterbatasan yang diketahui & ide perbaikan

1. **Font standar saja (WinAnsi):** karakter non-Latin dan emoji jadi `?`. Perbaikan: `@pdf-lib/fontkit` + embed TTF (mis. Noto Sans, dengan subset) untuk teks yang butuh.
2. **Edit teks = tutup + tulis ulang**, bukan edit stream konten asli. Teks asli masih ada di bawah penutup (bisa terbaca oleh copy/paste/screen reader). Untuk redaksi sungguhan perlu rasterisasi atau penghapusan operator teks.
3. **Text run hanya untuk teks mendatar.**
4. **Ekspor membuat dokumen baru:** bookmark/outline, formulir, link internal, dan metadata hilang (`copyPages` hanya menyalin halaman). Pakai `annotatePdf` kalau struktur dokumen tidak berubah.
5. **Memori:** semua byte PDF disimpan di memori; riwayat undo menyimpan snapshot penuh termasuk data URL gambar (maks 80 langkah). Untuk dokumen besar/banyak gambar: simpan gambar di registry terpisah (`id → dataURL`) dan simpan id-nya saja di anotasi, atau pakai patch/immer.
6. `copyPages` dipanggil per halaman; untuk ratusan halaman dari sumber yang sama lebih cepat mengelompokkan indeks lalu memanggil `copyPages(src, [i1, i2, …])` sekali.
7. **Ekspor di main thread:** file sangat besar bisa membekukan UI sebentar. Bisa dipindah ke Web Worker (pdf-lib jalan di worker).
8. **Thumbnail berurutan:** untuk PDF ratusan halaman, pertimbangkan render thumbnail malas dengan `IntersectionObserver` seperti di editor.
9. `uid()` memakai `Math.random`; cukup untuk sesi lokal, tapi `crypto.randomUUID()` lebih aman.

---

## 25. Panduan port ke framework lain

Modul **murni** (bisa disalin apa adanya, tanpa framework): `editor.ts`, `snap.ts`, `textruns.ts`, `pdfrender.ts`, bagian `trimToPng` dari `signatures.svelte.ts`, dan `sortable.ts` (hanya memakai `tick` dari Svelte; ganti dengan `await new Promise(requestAnimationFrame)` atau `flushSync` di React).

| Konsep Svelte | React | Vue |
|---|---|---|
| `$state` (deep reactive) | `useState`/`useReducer` + immer, atau zustand | `ref`/`reactive` |
| `$state.snapshot(x)` | `structuredClone(x)` (atau state immer yang memang immutable) | `structuredClone(toRaw(x))` |
| `$derived` | `useMemo` | `computed` |
| `$effect` + cleanup | `useEffect` + cleanup | `watchEffect` + `onCleanup` |
| `use:sortable` | `useSortable(ref, options)` dengan `useEffect` | directive `v-sortable` |
| `use:portal` | `createPortal(node, document.body)` | `<Teleport to="body">` |
| `animate:flip` | Framer Motion `layout`, atau FLIP manual | `<TransitionGroup>` |
| `bind:clientWidth` | `ResizeObserver` | `useResizeObserver` (VueUse) |
| `{#each … (key)}` | `.map` dengan `key` | `v-for :key` |

Catatan port:
- **Pola `patch(id, fn)`:** di React dengan immer, `setPages(produce(draft => fn(draft.find(p => p.id === id))))`. `checkpoint()` mendorong `pages` saat ini ke `past`.
- **Hindari re-render seluruh grid saat menyeret:** sortable bekerja langsung di DOM (transform), bukan lewat state. Pertahankan pola itu; jangan menyimpan posisi seret di state React.
- **Pointer move berfrekuensi tinggi** (ink, resize): di React, simpan drag di `useRef`; untuk ink, mutasi titik di ref lalu commit ke state per rAF, supaya tidak re-render per event.
- SSR/Next.js: komponen editor harus client-only (`"use client"` + `dynamic(() => import(...), { ssr: false })`), karena pdf.js butuh `window`.
- Alternatif drag library: **dnd-kit** (React) atau **SortableJS** bisa menggantikan `sortable.ts`, tapi pastikan multi-select (memindah seleksi), long-press di sentuh, dan auto-scroll tersedia.

---

## 26. Checklist implementasi

**Fondasi**
- [ ] Pasang `pdf-lib@1.17` dan `pdfjs-dist@4`, konfigurasi worker lokal, lazy import modul render.
- [ ] Salin model data & geometri (`editor.ts`: tipe, `norm`, `viewRot`, `viewSize`, `viewToPage`, `pageToView`, `groupTransform`, `rotateVec`) beserta tesnya.
- [ ] `openPdf` (kirim `bytes.slice(0)`), `pageInfos`, `renderPageUrl` (latar putih, object URL, bebaskan kanvas).

**Grid**
- [ ] State `pages / sources / docs / thumbs / selection / cuts / stamp`; `addFiles` dengan thumbnail bertahap + progress.
- [ ] Kartu halaman (rasio asli, rotasi CSS + swap ukuran), seleksi klik/Shift/Ctrl+A, tombol melayang.
- [ ] Operasi: putar, hapus (+toast), duplikat (id anotasi baru), halaman kosong, ambil terpilih.
- [ ] Undo/redo snapshot (maks 80) + pintasan.
- [ ] Sortable pointer-events (ghost, multi-select, long-press, auto-scroll, landing, Esc) + Alt+panah.
- [ ] Gunting/pisah + panel "Tiap halaman".
- [ ] Panel nomor halaman & watermark + pratinjau SVG (`PageOverlay`).
- [ ] `exportPdfs` + modal hasil (Unduh / simpan ke cloud).

**Editor isi**
- [ ] Overlay layar penuh, rail alat + flyout + pintasan, props bar kontekstual.
- [ ] Zoom (median width, terjangkar, Ctrl+wheel, pinch, menu), navigasi halaman.
- [ ] Render malas (IntersectionObserver, tangga resolusi, antrian serial, placeholder thumbnail).
- [ ] Pointer: buat teks/ink/rect/line/mark, pilih, geser (ambang 3 px), resize 4/8 pegangan (`resizeBox` + `fitToBox`), ujung garis.
- [ ] Textarea overlay untuk mengetik; teks kosong dibuang.
- [ ] Salin/tempel/duplikat, panah untuk menggeser, Delete.
- [ ] Tambah gambar (konversi ke PNG kalau perlu).
- [ ] Edit teks yang ada (`buildRuns`, `guessFont`, `sampleColors`, whiteout + teks).
- [ ] Snap (`findLines`, `snapBox`, garis bantu, Alt untuk bebas).
- [ ] Tanda tangan: dialog (gambar/ketik/unggah), localStorage, mode menaruh, seret dari panel dengan pegas.

**Polesan**
- [ ] Responsif (rail bawah, bottom sheet, `hover: none`, handle besar untuk `pointer: coarse`, safe-area).
- [ ] Reduced motion, ARIA, label dua bahasa.
- [ ] Bersihkan resource: revoke URL, `doc.destroy()`, kembalikan `overflow` dokumen.
- [ ] Tes: geometri, ekspor, resize, snap, textruns.
