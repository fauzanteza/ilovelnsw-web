# I love LNSW — frontend

Alat PDF yang berjalan sepenuhnya di browser. SvelteKit 3 + Svelte 5 (runes), TypeScript, Tailwind CSS 4,
`pdf-lib` (tulis PDF) dan `pdfjs-dist` (render PDF). Situs statis (`adapter-static`).

Spesifikasi fitur: [`manage_pdf.md`](manage_pdf.md).

## Perintah

```sh
npm install
npm run dev      # http://localhost:5173
npm run test     # Vitest: geometri, nomor halaman, operasi daftar, ekspor pdf-lib
npm run check    # svelte-check
npm run build    # hasil statis di build/
```

## Fitur: Kelola PDF (`/kelola-pdf`)

Layar grid (§3–12, §18–22 spesifikasi):

- Buka banyak PDF sekaligus (pilih atau jatuhkan di mana saja), thumbnail bertahap + progres
- Gabung, putar ±90°, hapus (toast + urungkan), duplikat, halaman kosong, ambil halaman terpilih
- Seleksi klik / Shift+klik / Ctrl+A, bilah aksi kontekstual
- Seret untuk mengurutkan (Pointer Events: ghost, multi-pilih, tahan 260 ms di layar sentuh, auto-scroll, Esc batal) + Alt+←/→
- Pisah file dengan gunting di antara halaman, "Tiap halaman", "Hapus potongan"
- Nomor halaman (1, 1/N, romawi; 3 posisi; mulai dari; lewati sampul) & watermark, pratinjau SVG langsung
- Undo/redo snapshot (80 langkah), Ctrl+Z / Ctrl+Y / Ctrl+S / Delete / Esc
- Ekspor pdf-lib + modal hasil (unduh per file / semua)
- Dua bahasa (ID/EN), reduced motion, ARIA

Editor isi halaman (§13–17: teks, pena, bentuk, tanda tangan, dll.) belum dibangun. Model data anotasi,
pratinjau SVG-nya (`PageOverlay`), dan ekspornya (`drawAnnotation`) sudah ada sebagai fondasi.

## Struktur

```
src/lib/
├─ editor.ts            model data, geometri rotasi, operasi daftar, tata letak nomor/watermark (murni)
├─ export.ts            exportPdfs + drawAnnotation/drawStamp (pdf-lib, dimuat saat menyimpan)
├─ pdfrender.ts         openPdf, pageInfos, renderPageUrl (pdf.js, dimuat saat membuka file)
├─ pdf.ts               PdfError, toRoman, util file
├─ i18n.svelte.ts       L(id, en)
├─ actions/sortable.ts  seret-urut berbasis Pointer Events
├─ actions/portal.ts
└─ components/
   ├─ tools/PdfEditor.svelte   entry fitur (pemilik state)
   ├─ PageOverlay.svelte       SVG anotasi + nomor + watermark
   ├─ Dropzone, ResultModal, PanelSection, Segmented, Icon, LoaderMini
```

Catatan SvelteKit 3: konfigurasi diberikan langsung ke `sveltekit({...})` di `vite.config.ts`, dan alias
`$lib` diganti subpath import `#lib/*` (lihat `"imports"` di `package.json`).
