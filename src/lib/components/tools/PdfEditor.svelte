<script lang="ts">
  // Kelola PDF — layar grid (entry fitur).
  // Pemilik semua state dokumen: sumber, halaman, thumbnail, seleksi, potongan, stempel, riwayat.
  // Semua diproses di browser: tidak ada byte dokumen yang dikirim ke server.
  import { onDestroy, onMount } from "svelte";
  import { flip } from "svelte/animate";
  import { fade, fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { PDFDocumentProxy } from "pdfjs-dist";

  import {
    DEFAULT_STAMP,
    applySort,
    blankPage,
    clonePage,
    groupPages,
    norm,
    shiftSelected,
    uid,
    viewSize,
    type NumberFormat,
    type NumberPosition,
    type PageItem,
    type Source,
    type Stamp,
  } from "#lib/editor.ts";
  import { PdfError, isPdf, stem } from "#lib/pdf.ts";
  import { sortable } from "#lib/actions/sortable.ts";
  import { L } from "#lib/i18n.svelte.ts";
  import Dropzone from "../Dropzone.svelte";
  import Icon from "../Icon.svelte";
  import LoaderMini from "../LoaderMini.svelte";
  import PageOverlay from "../PageOverlay.svelte";
  import PanelSection from "../PanelSection.svelte";
  import ResultModal, { type ResultFile } from "../ResultModal.svelte";
  import Segmented from "../Segmented.svelte";

  // ───────────────────────────── State ─────────────────────────────

  /** ArrayBuffer asli per file, untuk pdf-lib saat ekspor (tidak reaktif). */
  let sources: Source[] = [];
  /** Dokumen pdf.js per file, untuk render (tidak reaktif). */
  let docs: PDFDocumentProxy[] = [];

  /** Satu sumber kebenaran: urutan array = urutan dokumen hasil. */
  let pages = $state<PageItem[]>([]);
  /** "source:index" → object URL JPEG ("" = gagal dirender). Dibagi antarhalaman duplikat. */
  let thumbs = $state<Record<string, string>>({});
  let selection = $state<string[]>([]);
  /** Id halaman yang menjadi akhir sebuah bagian (pisah file). */
  let cuts = $state<string[]>([]);
  let stamp = $state<Stamp>(structuredClone(DEFAULT_STAMP));

  let names = $state<string[]>([]); // nama file per sumber, untuk caption
  let opening = $state(false);
  let loading = $state({ total: 0, done: 0 });
  let saving = $state<false | "all" | "selected">(false);
  let error = $state("");
  let notice = $state("");
  let toast = $state<{ id: string; text: string } | null>(null);
  let results = $state<ResultFile[] | null>(null);
  let thumbSize = $state(170);
  let settling = $state(false);
  let sorting = $state(false);
  let fileDrag = $state(false);
  let confirmReset = $state(false);
  let reduced = $state(false);
  let panels = $state({ numbers: false, watermark: false, split: false });

  let lastClicked: string | null = null;
  let destroyed = false;
  let dragDepth = 0;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  // ───────────────────────────── Turunan ─────────────────────────────

  const ids = $derived(pages.map((p) => p.id));
  const groups = $derived(groupPages(pages, cuts));
  /** Posisi & jumlah halaman per file keluaran (nomor halaman dihitung per file). */
  const placement = $derived.by(() => {
    const m = new Map<string, { position: number; total: number }>();
    for (const g of groups) g.forEach((p, position) => m.set(p.id, { position, total: g.length }));
    return m;
  });
  const selectedSet = $derived(new Set(selection));
  const cutSet = $derived(new Set(cuts));
  const busy = $derived(opening || !!saving);
  const workspace = $derived(pages.length > 0);

  // ───────────────────────────── Undo / redo (snapshot penuh) ─────────────────────────────

  type Snap = { pages: PageItem[]; cuts: string[] };
  const HISTORY = 80;
  let past = $state.raw<Snap[]>([]);
  let future = $state.raw<Snap[]>([]);

  const snap = (): Snap => ({ pages: $state.snapshot(pages) as PageItem[], cuts: [...cuts] });

  /** Panggil SEBELUM setiap mutasi diskret. */
  function checkpoint() {
    past = [...past.slice(-(HISTORY - 1)), snap()];
    future = [];
  }
  function undo() {
    const s = past.at(-1);
    if (!s) return;
    past = past.slice(0, -1);
    future = [...future, snap()];
    restore(s);
  }
  function redo() {
    const s = future.at(-1);
    if (!s) return;
    future = future.slice(0, -1);
    past = [...past, snap()];
    restore(s);
  }
  function restore(s: Snap) {
    pages = s.pages;
    cuts = s.cuts;
    selection = selection.filter((id) => pages.some((p) => p.id === id)); // buang seleksi yang sudah tidak ada
  }

  // ───────────────────────────── Pesan ─────────────────────────────

  function messageFor(err: unknown, fallback = L("Gagal menyimpan PDF.", "Couldn't save the PDF.")): string {
    if (err instanceof PdfError) {
      const f = err.file ?? "";
      switch (err.code) {
        case "password":
          return L(
            `“${f}” terkunci password. Buka dulu lewat alat Buka Password PDF.`,
            `“${f}” is password-protected. Unlock it first with the Unlock PDF tool.`,
          );
        case "unreadable":
          return L(`“${f}” tidak bisa dibaca sebagai PDF.`, `“${f}” couldn't be read as a PDF.`);
        case "encrypted":
          return L(
            `“${f}” terkunci password. Buka proteksinya dulu, lalu coba lagi.`,
            `“${f}” is encrypted. Remove its protection first, then try again.`,
          );
        case "empty":
          return L("Tidak ada halaman untuk disimpan.", "There are no pages to save.");
      }
    }
    console.error(err);
    return fallback;
  }

  function showToast(text: string) {
    clearTimeout(toastTimer);
    toast = { id: uid(), text };
    toastTimer = setTimeout(() => (toast = null), 3200);
  }

  // ───────────────────────────── Memuat file & thumbnail ─────────────────────────────

  async function addFiles(list: File[]) {
    const pdfs = list.filter(isPdf);
    notice =
      pdfs.length < list.length
        ? L("Sebagian file dilewati. Alat ini hanya menerima PDF.", "Some files were skipped. This tool only accepts PDFs.")
        : "";
    if (!pdfs.length) return;
    error = "";
    opening = pages.length === 0; // loader besar hanya untuk file pertama

    let render: typeof import("#lib/pdfrender.ts");
    try {
      render = await import("#lib/pdfrender.ts");
    } catch (err) {
      opening = false;
      error = messageFor(err, L("Gagal memuat pembaca PDF. Periksa koneksi lalu coba lagi.", "Couldn't load the PDF reader. Check your connection and try again."));
      return;
    }

    const added: PageItem[] = [];
    const errors: string[] = [];
    for (const file of pdfs) {
      try {
        const bytes = await file.arrayBuffer();
        // ⚠ pdf.js memindahkan buffer ke worker → kirim salinan, simpan yang asli untuk pdf-lib.
        const doc = await render.openPdf(bytes.slice(0), file.name);
        const infos = await render.pageInfos(doc);
        if (destroyed) {
          void doc.destroy();
          return;
        }
        const source = sources.length;
        sources.push({ name: file.name, bytes });
        docs.push(doc);
        names = [...names, file.name];
        for (const info of infos)
          added.push({
            id: uid(),
            source,
            index: info.index,
            base: norm(info.rotate),
            rotate: 0,
            w: info.w,
            h: info.h,
            annotations: [],
          });
      } catch (err) {
        errors.push(messageFor(err, L(`“${file.name}” tidak bisa dibaca sebagai PDF.`, `“${file.name}” couldn't be read as a PDF.`)));
      }
    }
    opening = false;
    if (errors.length) error = errors.join(" ");
    if (!added.length) return;

    // Halaman langsung bisa diatur…
    checkpoint();
    pages = [...pages, ...added];
    loading.total += added.length;

    // …thumbnail menyusul satu per satu.
    for (const page of added) {
      if (destroyed) return;
      const key = `${page.source}:${page.index}`;
      if (thumbs[key] === undefined) {
        try {
          const url = await render.renderPageUrl(docs[page.source], page.index, 300);
          if (destroyed) {
            URL.revokeObjectURL(url);
            return;
          }
          thumbs[key] = url;
        } catch {
          thumbs[key] = ""; // gagal render: halaman tetap bisa diatur tanpa pratinjau
        }
      }
      loading.done++;
    }
    if (loading.done >= loading.total) loading = { total: 0, done: 0 };
  }

  // ───────────────────────────── Operasi halaman ─────────────────────────────

  /** Dari tombol kartu: satu halaman. Dari bilah atas: seleksi. */
  const targets = (id?: string) => (id ? [id] : selection);

  function rotate(delta: number, id?: string) {
    const t = new Set(targets(id));
    if (!t.size) return;
    checkpoint();
    // Tidak dinormalisasi supaya transisi CSS selalu berputar ke arah yang benar.
    for (const p of pages) if (t.has(p.id)) p.rotate += delta;
  }

  function remove(id?: string) {
    const t = new Set(targets(id));
    if (!t.size) return;
    checkpoint();
    pages = pages.filter((p) => !t.has(p.id));
    cuts = cuts.filter((c) => !t.has(c));
    selection = selection.filter((s) => !t.has(s));
    showToast(
      L(`${t.size} halaman dihapus. Ctrl+Z untuk membatalkan`, `${t.size} page${t.size > 1 ? "s" : ""} deleted. Ctrl+Z to undo`),
    );
  }

  function duplicate(id?: string) {
    const t = new Set(targets(id));
    if (!t.size) return;
    checkpoint();
    const out: PageItem[] = [];
    const copies: string[] = [];
    for (const p of pages) {
      out.push(p);
      if (t.has(p.id)) {
        // Sisipkan tepat setelah aslinya; id baru untuk halaman & setiap anotasi.
        const c = clonePage($state.snapshot(p) as PageItem);
        out.push(c);
        copies.push(c.id);
      }
    }
    pages = out;
    if (!id) selection = copies;
  }

  function addBlank() {
    checkpoint();
    const neighbor = pages.at(-1);
    pages = [...pages, blankPage(neighbor ? ($state.snapshot(neighbor) as PageItem) : undefined)];
  }

  function toggleCut(id: string) {
    checkpoint();
    cuts = cutSet.has(id) ? cuts.filter((c) => c !== id) : [...cuts, id];
  }

  function splitEvery() {
    checkpoint();
    cuts = pages.slice(0, -1).map((p) => p.id);
  }

  function clearCuts() {
    if (!cuts.length) return;
    checkpoint();
    cuts = [];
  }

  function moveSelection(dir: -1 | 1) {
    if (!selection.length) return;
    const next = shiftSelected(pages, selection, dir);
    if (next.every((p, i) => p === pages[i])) return;
    checkpoint();
    pages = next;
  }

  async function onsort(moving: string[], at: number) {
    checkpoint();
    // Sel sudah di tempatnya secara visual: matikan FLIP sementara supaya tidak meloncat.
    settling = true;
    pages = applySort(pages, moving, at);
    requestAnimationFrame(() => requestAnimationFrame(() => (settling = false)));
  }

  // ───────────────────────────── Seleksi ─────────────────────────────

  function toggleSelect(id: string) {
    selection = selectedSet.has(id) ? selection.filter((s) => s !== id) : [...selection, id];
  }

  function onCellClick(e: MouseEvent, id: string) {
    if (e.shiftKey && lastClicked && ids.includes(lastClicked)) {
      // Shift+klik = tambahkan rentang dari klik terakhir.
      const a = ids.indexOf(lastClicked);
      const b = ids.indexOf(id);
      const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
      selection = [...new Set([...selection, ...range])];
    } else {
      toggleSelect(id);
    }
    lastClicked = id;
  }

  function onCellKey(e: KeyboardEvent, id: string) {
    if (e.target !== e.currentTarget) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggleSelect(id);
      lastClicked = id;
    }
  }

  // ───────────────────────────── Simpan ─────────────────────────────

  async function save(selectedOnly = false) {
    if (saving) return;
    const list = selectedOnly ? [pages.filter((p) => selectedSet.has(p.id))] : groups;
    saving = selectedOnly ? "selected" : "all";
    error = "";
    try {
      const { exportPdfs } = await import("#lib/export.ts");
      const outputs = await exportPdfs(sources, $state.snapshot(list) as PageItem[][], $state.snapshot(stamp) as Stamp);
      const base = stem(sources[0]?.name ?? "dokumen");
      const fileNames = selectedOnly
        ? [`${base}-halaman-terpilih.pdf`]
        : outputs.length > 1
          ? outputs.map((_, i) => `${base}-bagian-${i + 1}.pdf`)
          : [`${base}-kelola.pdf`];
      results = outputs.map((bytes, i) => {
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
        return { name: fileNames[i], blob, url: URL.createObjectURL(blob) };
      });
    } catch (err) {
      error = messageFor(err);
    } finally {
      saving = false;
    }
  }

  function closeResults() {
    for (const r of results ?? []) URL.revokeObjectURL(r.url);
    results = null;
  }

  // ───────────────────────────── Mulai ulang & pembersihan ─────────────────────────────

  function releaseAll() {
    for (const url of Object.values(thumbs)) if (url) URL.revokeObjectURL(url);
    for (const doc of docs) void doc.destroy();
    for (const r of results ?? []) URL.revokeObjectURL(r.url);
  }

  function reset() {
    if (!confirmReset) {
      confirmReset = true;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => (confirmReset = false), 3000);
      return;
    }
    confirmReset = false;
    releaseAll();
    sources = [];
    docs = [];
    names = [];
    pages = [];
    thumbs = {};
    selection = [];
    cuts = [];
    past = [];
    future = [];
    results = null;
    error = notice = "";
    loading = { total: 0, done: 0 };
    stamp = structuredClone(DEFAULT_STAMP);
  }

  onMount(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    reduced = mq.matches;
    const on = () => (reduced = mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  });

  onDestroy(() => {
    destroyed = true;
    clearTimeout(toastTimer);
    clearTimeout(resetTimer);
    releaseAll();
  });

  // ───────────────────────────── Keyboard & jatuhkan file ─────────────────────────────

  function onKeydown(e: KeyboardEvent) {
    if (results || !workspace) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest("input, textarea, select, [contenteditable]")) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();

    if (mod && k === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (mod && (k === "y" || (k === "z" && e.shiftKey))) {
      e.preventDefault();
      redo();
    } else if (mod && k === "a") {
      e.preventDefault();
      selection = [...ids];
    } else if (mod && k === "s") {
      e.preventDefault();
      void save();
    } else if ((e.key === "Delete" || e.key === "Backspace") && selection.length) {
      e.preventDefault();
      remove();
    } else if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight") && selection.length) {
      e.preventDefault();
      moveSelection(e.key === "ArrowLeft" ? -1 : 1);
    } else if (e.key === "Escape" && selection.length) {
      selection = [];
    }
  }

  const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

  function onDragEnter(e: DragEvent) {
    if (!hasFiles(e) || busy) return;
    e.preventDefault();
    dragDepth++;
    fileDrag = true;
  }
  function onDragLeave(e: DragEvent) {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) fileDrag = false;
  }
  function onDragOver(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = busy ? "none" : "copy";
  }
  function onDrop(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    fileDrag = false;
    if (!busy) void addFiles(Array.from(e.dataTransfer!.files));
  }

  // ───────────────────────────── Opsi panel ─────────────────────────────

  const formatOptions = $derived<{ value: NumberFormat; label: string }[]>([
    { value: "n", label: "1, 2, 3" },
    { value: "n-of-total", label: "1 / N" },
    { value: "roman", label: "I, II, III" },
  ]);
  const positionOptions = $derived<{ value: NumberPosition; label: string }[]>([
    { value: "bottom-center", label: L("Bawah tengah", "Bottom center") },
    { value: "bottom-right", label: L("Bawah kanan", "Bottom right") },
    { value: "top-right", label: L("Atas kanan", "Top right") },
  ]);

  const anim = (ms: number) => (reduced ? 0 : ms);
</script>

<svelte:window
  onkeydown={onKeydown}
  ondragenter={onDragEnter}
  ondragleave={onDragLeave}
  ondragover={onDragOver}
  ondrop={onDrop}
/>

{#if !workspace}
  <!-- Tahap 1 & 2: kosong / membuka file pertama -->
  <div class="empty">
    {#if opening}
      <div class="opening" in:fade={{ duration: anim(160) }} role="status" aria-live="polite">
        <span class="opening-art"><LoaderMini size={34} /></span>
        <h2>{L("Membuka PDF", "Opening PDF")}</h2>
        <p>{L("Membaca halaman di perangkatmu…", "Reading pages on your device…")}</p>
      </div>
    {:else}
      <Dropzone variant="stage" dragging={fileDrag} onfiles={addFiles} />
      <ul class="features">
        <li><Icon name="layers" size={15} /> {L("Gabung", "Merge")}</li>
        <li><Icon name="split" size={15} /> {L("Pisah", "Split")}</li>
        <li><Icon name="rotate-cw" size={15} /> {L("Putar", "Rotate")}</li>
        <li><Icon name="grid" size={15} /> {L("Urutkan", "Reorder")}</li>
        <li><Icon name="trash" size={15} /> {L("Hapus", "Delete")}</li>
        <li><Icon name="copy" size={15} /> {L("Duplikat", "Duplicate")}</li>
        <li><Icon name="hash" size={15} /> {L("Nomor halaman", "Page numbers")}</li>
        <li><Icon name="droplet" size={15} /> Watermark</li>
      </ul>
    {/if}
    {#if error}<p class="alert" role="alert"><Icon name="alert" size={16} /> {error}</p>{/if}
    {#if notice}<p class="alert soft" role="alert">{notice}</p>{/if}
  </div>
{:else}
  <!-- Tahap 3: ruang kerja -->
  <div class="workspace" style="--thumb:{thumbSize}px">
    <div class="main">
      <div class="topbar" class:contextual={selection.length > 0}>
        {#if selection.length}
          <div class="bar" in:fly={{ y: -6, duration: anim(180) }}>
            <span class="count" aria-live="polite"><b>{selection.length}</b> <span class="hide-sm">{L("dipilih", "selected")}</span></span>
            <span class="sep"></span>
            <button class="icon-btn" onclick={() => rotate(-90)} title={L("Putar kiri", "Rotate left")} aria-label={L("Putar kiri", "Rotate left")}><Icon name="rotate-ccw" /></button>
            <button class="icon-btn" onclick={() => rotate(90)} title={L("Putar kanan", "Rotate right")} aria-label={L("Putar kanan", "Rotate right")}><Icon name="rotate-cw" /></button>
            <button class="icon-btn" onclick={() => duplicate()} title={L("Duplikat", "Duplicate")} aria-label={L("Duplikat", "Duplicate")}><Icon name="copy" /></button>
            <button class="icon-btn danger" onclick={() => remove()} title={L("Hapus (Del)", "Delete (Del)")} aria-label={L("Hapus", "Delete")}><Icon name="trash" /></button>
            <span class="sep"></span>
            <button class="btn btn-dark sm" onclick={() => save(true)} disabled={!!saving}>
              {#if saving === "selected"}<LoaderMini size={14} />{:else}<Icon name="file-out" size={16} />{/if}
              <span class="hide-sm">{L("Ambil halaman ini", "Extract these pages")}</span>
            </button>
            <button class="icon-btn push" onclick={() => (selection = [])} title={L("Batal pilih (Esc)", "Clear selection (Esc)")} aria-label={L("Batal pilih", "Clear selection")}><Icon name="x" /></button>
          </div>
        {:else}
          <div class="bar" in:fly={{ y: 6, duration: anim(180) }}>
            <Dropzone variant="compact" onfiles={addFiles} disabled={busy} />
            <span class="sep"></span>
            <button class="icon-btn" onclick={undo} disabled={!past.length} title={L("Urungkan (Ctrl+Z)", "Undo (Ctrl+Z)")} aria-label={L("Urungkan", "Undo")}><Icon name="undo" /></button>
            <button class="icon-btn" onclick={redo} disabled={!future.length} title={L("Ulangi (Ctrl+Y)", "Redo (Ctrl+Y)")} aria-label={L("Ulangi", "Redo")}><Icon name="redo" /></button>
            <button class="icon-btn" onclick={() => (selection = [...ids])} title={L("Pilih semua (Ctrl+A)", "Select all (Ctrl+A)")} aria-label={L("Pilih semua", "Select all")}><Icon name="select-all" /></button>
            <span class="status">
              {#if loading.total}
                <LoaderMini size={14} />
                {L(`Menyiapkan halaman ${loading.done}/${loading.total}`, `Preparing page ${loading.done}/${loading.total}`)}
              {:else}
                {L(`${pages.length} halaman`, `${pages.length} page${pages.length > 1 ? "s" : ""}`)}
                {#if names.length > 1}· {L(`${names.length} file`, `${names.length} files`)}{/if}
              {/if}
            </span>
            <label class="zoom push" title={L("Ukuran thumbnail", "Thumbnail size")}>
              <Icon name="grid" size={15} />
              <input type="range" min="110" max="260" step="10" bind:value={thumbSize} aria-label={L("Ukuran thumbnail", "Thumbnail size")} />
            </label>
          </div>
        {/if}
        {#if loading.total}
          <div class="progress" aria-hidden="true"><span style="width:{(loading.done / loading.total) * 100}%"></span></div>
        {/if}
      </div>

      <p class="hint hint-desktop">
        {L(
          "Klik untuk memilih (Shift untuk rentang), seret untuk mengurutkan (atau Alt+panah). Gunting di antara halaman untuk memisah file.",
          "Click to select (Shift for a range), drag to reorder (or Alt+arrows). Use the scissors between pages to split the file.",
        )}
      </p>
      <p class="hint hint-touch">
        {L("Ketuk untuk memilih, tahan lalu seret untuk mengurutkan.", "Tap to select, press and hold then drag to reorder.")}
      </p>

      {#if error}<p class="alert" role="alert"><Icon name="alert" size={16} /> {error}</p>{/if}
      {#if notice}<p class="alert soft" role="alert">{notice}</p>{/if}

      <div
        class="grid"
        class:sorting
        role="group"
        aria-label={L("Halaman dokumen", "Document pages")}
        use:sortable={{
          ids,
          selection,
          onsort,
          onstart: () => (sorting = true),
          onend: () => (sorting = false),
          disabled: busy,
        }}
      >
        {#each pages as page, i (page.id)}
          {@const vs = viewSize(page)}
          {@const key = `${page.source}:${page.index}`}
          {@const thumb = thumbs[key]}
          {@const swap = norm(page.rotate) % 180 !== 0}
          {@const place = placement.get(page.id) ?? { position: i, total: pages.length }}
          {@const selected = selectedSet.has(page.id)}
          {@const isCut = cutSet.has(page.id) && i < pages.length - 1}
          <div
            class="cell"
            class:selected
            class:cut={isCut}
            data-sort-id={page.id}
            role="button"
            tabindex="0"
            aria-pressed={selected}
            aria-label={L(`Halaman ${i + 1}`, `Page ${i + 1}`)}
            onclick={(e) => onCellClick(e, page.id)}
            onkeydown={(e) => onCellKey(e, page.id)}
            animate:flip={{ duration: settling || reduced ? 0 : 380, easing: cubicOut }}
            in:scale|global={{ start: 0.9, duration: anim(380), delay: reduced ? 0 : Math.min(i, 20) * 18, easing: cubicOut }}
          >
            <div class="frame">
              <div class="paper" style="--ar:{vs.w / vs.h}">
                {#if page.source < 0}
                  <!-- halaman kosong: kertas putih saja -->
                {:else if thumb}
                  <img
                    class="thumb"
                    class:swap
                    src={thumb}
                    alt=""
                    draggable="false"
                    style="transform: translate(-50%, -50%) rotate({page.rotate}deg)"
                  />
                {:else if thumb === ""}
                  <span class="nopreview">{L("Pratinjau tidak tersedia", "No preview")}</span>
                {:else}
                  <span class="shimmer" aria-hidden="true"></span>
                {/if}
                <PageOverlay {page} {stamp} position={place.position} total={place.total} />
              </div>

              <span class="tick" aria-hidden="true"><Icon name="check" size={14} stroke={3} /></span>
              {#if page.annotations.length}
                <span class="annot" title={L("Halaman ini punya anotasi", "This page has annotations")}><Icon name="pen" size={12} /></span>
              {/if}

              <div class="pill" data-no-drag>
                <button onclick={() => rotate(-90, page.id)} title={L("Putar kiri", "Rotate left")} aria-label={L(`Putar kiri halaman ${i + 1}`, `Rotate page ${i + 1} left`)}><Icon name="rotate-ccw" size={15} /></button>
                <button onclick={() => rotate(90, page.id)} title={L("Putar kanan", "Rotate right")} aria-label={L(`Putar kanan halaman ${i + 1}`, `Rotate page ${i + 1} right`)}><Icon name="rotate-cw" size={15} /></button>
                <button onclick={() => duplicate(page.id)} title={L("Duplikat", "Duplicate")} aria-label={L(`Duplikat halaman ${i + 1}`, `Duplicate page ${i + 1}`)}><Icon name="copy" size={15} /></button>
                <button class="del" onclick={() => remove(page.id)} title={L("Hapus", "Delete")} aria-label={L(`Hapus halaman ${i + 1}`, `Delete page ${i + 1}`)}><Icon name="trash" size={15} /></button>
              </div>
            </div>

            <div class="caption">
              <b>{i + 1}</b>
              <span title={page.source < 0 ? "" : names[page.source]}>
                {page.source < 0 ? L("Halaman kosong", "Blank page") : names[page.source]}
              </span>
            </div>

            {#if i < pages.length - 1}
              <button
                class="scissor"
                class:on={isCut}
                data-no-drag
                onclick={(e) => {
                  e.stopPropagation();
                  toggleCut(page.id);
                }}
                title={isCut ? L("Gabungkan kembali", "Join again") : L("Pisah file di sini", "Split the file here")}
                aria-label={isCut
                  ? L(`Hapus potongan setelah halaman ${i + 1}`, `Remove split after page ${i + 1}`)
                  : L(`Pisah setelah halaman ${i + 1}`, `Split after page ${i + 1}`)}
                aria-pressed={isCut}
              >
                <Icon name="scissors" size={14} />
              </button>
            {/if}
          </div>
        {/each}
        <div class="cell add">
          <button class="add-blank" onclick={addBlank}>
            <Icon name="plus" size={22} />
            <span>{L("Halaman kosong", "Blank page")}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Panel kanan -->
    <aside class="side">
      <div class="side-card">
        <PanelSection
          title={L("Nomor halaman", "Page numbers")}
          icon="hash"
          {reduced}
          bind:open={panels.numbers}
          bind:enabled={stamp.numbers.enabled}
        >
          <Segmented label={L("Format", "Format")} options={formatOptions} bind:value={stamp.numbers.format} />
          <Segmented label={L("Posisi", "Position")} options={positionOptions} bind:value={stamp.numbers.position}>
            {#snippet item(o, on)}
              <span class="pos-icon pos-{o.value}" class:on><i></i></span>
            {/snippet}
          </Segmented>
          <div class="row">
            <label class="field">
              <span>{L("Mulai dari", "Start at")}</span>
              <input
                type="number"
                min="1"
                max="9999"
                value={stamp.numbers.startAt}
                oninput={(e) => {
                  const v = Math.round(Number((e.currentTarget as HTMLInputElement).value));
                  if (Number.isFinite(v) && v >= 1) stamp.numbers.startAt = Math.min(v, 9999);
                }}
              />
            </label>
            <label class="check">
              <input type="checkbox" bind:checked={stamp.numbers.skipFirst} />
              <span>{L("Lewati sampul", "Skip cover")}</span>
            </label>
          </div>
          {#if !stamp.numbers.enabled}
            <p class="muted">{L("Nyalakan switch untuk menambahkan nomor.", "Turn on the switch to add numbers.")}</p>
          {/if}
        </PanelSection>

        <PanelSection title="Watermark" icon="droplet" {reduced} bind:open={panels.watermark} bind:enabled={stamp.watermark.enabled}>
          <label class="field">
            <span>{L("Teks", "Text")}</span>
            <input type="text" maxlength="40" bind:value={stamp.watermark.text} placeholder="SALINAN" />
          </label>
          <label class="field">
            <span>{L("Transparansi", "Opacity")} <output>{Math.round(stamp.watermark.opacity * 100)}%</output></span>
            <input type="range" min="0.05" max="0.6" step="0.01" bind:value={stamp.watermark.opacity} />
          </label>
          <label class="field">
            <span>{L("Kemiringan", "Angle")} <output>{stamp.watermark.rotation}°</output></span>
            <input type="range" min="0" max="90" step="1" bind:value={stamp.watermark.rotation} />
          </label>
        </PanelSection>

        <PanelSection
          title={L("Pisah file", "Split file")}
          icon="scissors"
          {reduced}
          bind:open={panels.split}
          badge={groups.length > 1 ? L(`${groups.length} file`, `${groups.length} files`) : undefined}
        >
          <p class="muted">
            {L(
              "Klik gunting di antara halaman untuk memotong. Setiap bagian disimpan sebagai file terpisah.",
              "Click the scissors between pages to cut. Each part is saved as a separate file.",
            )}
          </p>
          <div class="row">
            <button class="btn btn-ghost sm grow" onclick={splitEvery} disabled={pages.length < 2}>
              <Icon name="split" size={15} /> {L("Tiap halaman", "Every page")}
            </button>
            <button class="btn btn-ghost sm grow" onclick={clearCuts} disabled={!cuts.length}>
              <Icon name="x" size={15} /> {L("Hapus potongan", "Clear cuts")}
            </button>
          </div>
        </PanelSection>
      </div>

      <button class="btn btn-primary save" onclick={() => save()} disabled={!!saving || !pages.length}>
        {#if saving === "all"}
          <LoaderMini size={18} /> {L("Menyimpan…", "Saving…")}
        {:else}
          <Icon name="download" size={19} />
          {groups.length > 1 ? L(`Simpan ${groups.length} PDF`, `Save ${groups.length} PDFs`) : L("Simpan PDF", "Save PDF")}
        {/if}
      </button>
      <button class="btn reset" class:confirm={confirmReset} onclick={reset}>
        <Icon name="refresh" size={15} />
        {confirmReset ? L("Klik lagi untuk mulai ulang", "Click again to start over") : L("Mulai ulang", "Start over")}
      </button>
      <p class="privacy">
        <Icon name="shield" size={16} />
        <span>{L("Diproses di perangkatmu. File tidak pernah diunggah ke server.", "Processed on your device. Files are never uploaded to a server.")}</span>
      </p>
    </aside>
  </div>
{/if}

{#if fileDrag && workspace}
  <div class="drop-overlay" transition:fade={{ duration: anim(150) }} aria-hidden="true">
    <div><Icon name="file-plus" size={34} /> {L("Lepaskan untuk menambahkan PDF", "Drop to add PDFs")}</div>
  </div>
{/if}

{#if toast}
  {#key toast.id}
    <div class="toast" role="status" transition:fly={{ y: 20, duration: anim(320), easing: cubicOut }}>
      <span>{toast.text}</span>
      <button
        onclick={() => {
          undo();
          toast = null;
        }}>{L("Urungkan", "Undo")}</button
      >
    </div>
  {/key}
{/if}

{#if results}
  <ResultModal files={results} onclose={closeResults} />
{/if}

<style>
  /* ── Kosong ── */
  .empty {
    display: grid;
    gap: 1.25rem;
    max-width: 52rem;
    margin: 0 auto;
  }
  .opening {
    display: grid;
    place-items: center;
    gap: 0.5rem;
    min-height: 22rem;
    border-radius: 28px;
    background: var(--surface);
    text-align: center;
  }
  .opening-art {
    display: grid;
    place-items: center;
    width: 4.5rem;
    height: 4.5rem;
    margin-bottom: 0.5rem;
    border-radius: 999px;
    background: var(--makara);
    color: var(--on-makara);
  }
  .opening h2 {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    font-weight: 600;
  }
  .opening p {
    color: var(--muted);
  }
  .features {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
  .features li {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.8rem;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--muted);
  }

  .alert {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 16px;
    background: var(--danger-soft);
    color: var(--danger);
    font-size: 0.9rem;
    font-weight: 500;
  }
  .alert.soft {
    background: var(--makara-soft);
    color: #6b5a00;
  }

  /* ── Ruang kerja ── */
  .workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 1.5rem;
    align-items: start;
  }
  .main {
    min-width: 0;
    display: grid;
    gap: 0.9rem;
  }

  .topbar {
    position: sticky;
    top: 4.75rem;
    z-index: 20;
    border-radius: 24px;
    background: rgb(255 255 255 / 0.82);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--line);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.05);
    overflow: hidden;
    transition:
      background 0.2s,
      border-color 0.2s;
  }
  .topbar.contextual {
    background: rgb(253 245 196 / 0.92);
    border-color: var(--makara-deep);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 3.5rem;
    padding: 0.5rem 0.6rem;
  }
  .sep {
    width: 1px;
    height: 1.4rem;
    margin: 0 0.35rem;
    background: var(--line-strong);
  }
  .count {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding-left: 0.4rem;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .count b {
    display: grid;
    place-items: center;
    min-width: 1.75rem;
    height: 1.75rem;
    padding: 0 0.4rem;
    border-radius: 999px;
    background: var(--night);
    color: var(--on-night);
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
  }
  .icon-btn.danger:hover {
    background: var(--danger-soft);
    color: var(--danger);
  }
  .push {
    margin-left: auto;
  }
  .btn.sm {
    height: 2.25rem;
    padding: 0 0.85rem;
    font-size: 0.82rem;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin-left: 0.4rem;
    color: var(--muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .zoom {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--faint);
    padding-right: 0.4rem;
  }
  .zoom input {
    width: 6.5rem;
    accent-color: var(--night);
  }
  .progress {
    height: 3px;
    background: var(--sunken);
  }
  .progress span {
    display: block;
    height: 100%;
    background: var(--makara-deep);
    transition: width 0.25s var(--ease-out);
  }

  .hint {
    color: var(--faint);
    font-size: 0.82rem;
    padding: 0 0.5rem;
  }
  .hint-touch {
    display: none;
  }
  @media (hover: none) {
    .hint-desktop {
      display: none;
    }
    .hint-touch {
      display: block;
    }
  }

  /* ── Grid halaman ── */
  .grid {
    --gap: 1.6rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--thumb), 1fr));
    gap: 1.4rem var(--gap);
    padding: 0.5rem 0.25rem 2rem;
  }
  .cell {
    position: relative;
    display: grid;
    gap: 0.5rem;
    border-radius: 18px;
    outline: none;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
  }
  .cell.add {
    cursor: default;
  }
  .frame {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 3 / 4;
    padding: 10px;
    border-radius: 18px;
    background: var(--sunken);
    container-type: size;
    transition:
      background 0.2s,
      box-shadow 0.2s;
  }
  .cell:hover .frame {
    background: #e3e2dc;
  }
  .cell:focus-visible .frame {
    box-shadow: 0 0 0 2px var(--select);
  }
  .cell.selected .frame {
    background: var(--makara-soft);
    box-shadow: 0 0 0 2px var(--makara-deep);
  }
  .paper {
    position: relative;
    width: min(100cqw, 100cqh * var(--ar));
    aspect-ratio: var(--ar);
    background: #fff;
    border-radius: 3px;
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.08),
      0 6px 16px rgb(0 0 0 / 0.08);
    container-type: size;
    transition: --ar 0.55s var(--ease-spring);
  }
  .thumb {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 100cqw;
    height: 100cqh;
    max-width: none;
    border-radius: 3px;
    transition: transform 0.55s var(--ease-spring);
    pointer-events: none;
  }
  .thumb.swap {
    width: 100cqh;
    height: 100cqw;
  }
  .shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, #f4f3ef 30%, #e9e8e3 50%, #f4f3ef 70%);
    background-size: 250% 100%;
    animation: shimmer 1.2s linear infinite;
  }
  @keyframes shimmer {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: -100% 0;
    }
  }
  .nopreview {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 0.5rem;
    text-align: center;
    font-size: 0.72rem;
    color: var(--faint);
  }

  .tick {
    position: absolute;
    top: 14px;
    left: 14px;
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.92);
    border: 1.5px solid var(--line-strong);
    color: transparent;
    opacity: 0;
    transform: scale(0.8);
    transition:
      opacity 0.2s,
      transform 0.3s var(--ease-spring),
      background 0.2s,
      color 0.2s;
  }
  .cell:hover .tick,
  .cell:focus-visible .tick {
    opacity: 1;
    transform: scale(1);
  }
  .cell.selected .tick {
    opacity: 1;
    transform: scale(1.1);
    background: var(--night);
    border-color: var(--night);
    color: var(--makara);
  }
  .annot {
    position: absolute;
    top: 14px;
    right: 14px;
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    background: var(--makara);
    color: var(--on-makara);
  }

  .pill {
    position: absolute;
    left: 50%;
    bottom: 14px;
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    background: rgb(11 10 8 / 0.88);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
    opacity: 0;
    transform: translate(-50%, 8px);
    pointer-events: none;
    transition:
      opacity 0.25s,
      transform 0.35s var(--ease-out);
  }
  .pill button {
    display: grid;
    place-items: center;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 999px;
    color: var(--on-night);
    cursor: pointer;
    transition:
      background 0.15s,
      transform 0.15s;
  }
  .pill button:hover {
    background: rgb(255 255 255 / 0.14);
  }
  .pill button:active {
    transform: scale(0.9);
  }
  .pill button.del:hover {
    background: var(--danger);
  }
  .cell:hover .pill,
  .cell:focus-within .pill {
    opacity: 1;
    transform: translate(-50%, 0);
    pointer-events: auto;
  }

  .caption {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    min-width: 0;
    padding: 0 0.35rem;
    font-size: 0.78rem;
    color: var(--faint);
  }
  .caption b {
    color: var(--fg);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .caption span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Gunting di celah kanan kartu */
  .scissor {
    position: absolute;
    top: calc(50% - 1.25rem);
    right: calc(var(--gap) / -2);
    z-index: 2;
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    color: var(--muted);
    transform: translate(50%, -50%) scale(0.85);
    opacity: 0;
    cursor: pointer;
    transition:
      opacity 0.2s,
      transform 0.25s var(--ease-spring),
      background 0.15s,
      color 0.15s;
  }
  .cell:hover .scissor,
  .scissor:focus-visible {
    opacity: 1;
    transform: translate(50%, -50%) scale(1);
  }
  .scissor:hover {
    background: var(--night);
    color: var(--makara);
    border-color: var(--night);
  }
  .scissor.on {
    opacity: 1;
    transform: translate(50%, -50%) scale(1);
    background: var(--makara);
    border-color: var(--makara-deep);
    color: var(--on-makara);
  }
  .cell.cut::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 1.8rem;
    right: calc(var(--gap) / -2);
    border-right: 2px dashed var(--makara-deep);
    pointer-events: none;
  }

  /* Halaman kosong */
  .add-blank {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.4rem;
    aspect-ratio: 3 / 4;
    width: 100%;
    border-radius: 18px;
    border: 2px dashed var(--line-strong);
    color: var(--muted);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      border-color 0.2s,
      color 0.2s,
      background 0.2s;
  }
  .add-blank:hover {
    border-color: var(--fg);
    color: var(--fg);
    background: var(--surface);
  }

  /* Selama menyeret: grid tenang */
  .grid.sorting .pill,
  .grid.sorting .scissor,
  .grid.sorting .tick {
    opacity: 0 !important;
  }
  .cell:global(.sort-source) .frame {
    background: transparent;
    box-shadow: none;
    outline: 2px dashed var(--line-strong);
    outline-offset: -2px;
  }
  .cell:global(.sort-source) .frame > *,
  .cell:global(.sort-source) .caption {
    visibility: hidden;
  }
  .cell:global(.sort-landing) {
    visibility: hidden;
  }
  :global(.sort-ghost .sort-ghost-card) {
    filter: drop-shadow(0 18px 30px rgb(0 0 0 / 0.22));
  }
  :global(.sort-ghost .sort-ghost-card .pill),
  :global(.sort-ghost .sort-ghost-card .scissor) {
    display: none;
  }
  :global(.sort-ghost .sort-ghost-layer) {
    aspect-ratio: 3 / 4;
    border-radius: 18px;
    background: #d9d8d2;
    box-shadow: 0 6px 16px rgb(0 0 0 / 0.12);
  }
  :global(.sort-ghost .sort-ghost-badge) {
    position: absolute;
    top: -10px;
    right: -10px;
    z-index: 2;
    display: grid;
    place-items: center;
    min-width: 1.8rem;
    height: 1.8rem;
    padding: 0 0.45rem;
    border-radius: 999px;
    background: var(--makara);
    color: var(--on-makara);
    font-weight: 700;
    font-size: 0.85rem;
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
  }

  /* ── Panel kanan ── */
  .side {
    position: sticky;
    top: 4.75rem;
    display: grid;
    gap: 0.75rem;
  }
  .side-card {
    padding: 0.35rem 1rem;
    border-radius: 24px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .field {
    display: grid;
    gap: 0.4rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--muted);
  }
  .field > span {
    display: flex;
    justify-content: space-between;
  }
  .field output {
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .field input[type="text"],
  .field input[type="number"] {
    height: 2.5rem;
    padding: 0 0.8rem;
    border-radius: 12px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    font-size: 0.9rem;
    font-weight: 500;
  }
  .field input[type="range"] {
    accent-color: var(--night);
  }
  .row {
    display: flex;
    align-items: flex-end;
    gap: 0.6rem;
  }
  .row .field {
    width: 6.5rem;
  }
  .grow {
    flex: 1;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    height: 2.5rem;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
  }
  .check input {
    width: 1.05rem;
    height: 1.05rem;
    accent-color: var(--night);
  }
  .muted {
    color: var(--muted);
    font-size: 0.82rem;
  }

  /* Ikon posisi nomor halaman */
  .pos-icon {
    position: relative;
    display: block;
    width: 1.4rem;
    height: 1.8rem;
    border-radius: 3px;
    border: 1.5px solid currentColor;
    opacity: 0.6;
  }
  .pos-icon.on {
    opacity: 1;
  }
  .pos-icon i {
    position: absolute;
    width: 0.4rem;
    height: 0.2rem;
    border-radius: 2px;
    background: currentColor;
  }
  .pos-bottom-center i {
    bottom: 0.2rem;
    left: calc(50% - 0.2rem);
  }
  .pos-bottom-right i {
    bottom: 0.2rem;
    right: 0.15rem;
  }
  .pos-top-right i {
    top: 0.2rem;
    right: 0.15rem;
  }

  .save {
    height: 3.5rem;
    border-radius: 20px;
    font-size: 1.05rem;
    box-shadow: 0 8px 20px rgb(217 191 0 / 0.35);
  }
  .reset {
    height: 2.4rem;
    color: var(--muted);
    font-size: 0.85rem;
  }
  .reset:hover {
    color: var(--fg);
    background: var(--sunken);
  }
  .reset.confirm {
    background: var(--danger-soft);
    color: var(--danger);
  }
  .privacy {
    display: flex;
    gap: 0.6rem;
    padding: 0.8rem 1rem;
    border-radius: 18px;
    background: var(--sunken);
    color: var(--muted);
    font-size: 0.8rem;
    line-height: 1.4;
  }
  .privacy :global(svg) {
    flex: none;
    color: #1f7a3d;
  }

  /* ── Overlay jatuhkan file, toast ── */
  .drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: grid;
    place-items: center;
    padding: 1.5rem;
    background: rgb(246 219 0 / 0.18);
    backdrop-filter: blur(2px);
    pointer-events: none;
  }
  .drop-overlay div {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 1.2rem 1.8rem;
    border-radius: 24px;
    border: 2px dashed var(--fg);
    background: var(--surface);
    font-family: var(--font-serif);
    font-size: 1.3rem;
    font-weight: 600;
    box-shadow: 0 20px 50px rgb(0 0 0 / 0.15);
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(1.5rem + env(safe-area-inset-bottom));
    z-index: 85;
    display: flex;
    align-items: center;
    gap: 1rem;
    max-width: calc(100vw - 2rem);
    padding: 0.7rem 0.7rem 0.7rem 1.2rem;
    border-radius: 999px;
    background: var(--night);
    color: var(--on-night);
    font-size: 0.875rem;
    box-shadow: 0 12px 30px rgb(0 0 0 / 0.3);
    translate: -50% 0;
  }
  .toast button {
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    background: var(--makara);
    color: var(--on-makara);
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  /* ── Responsif ── */
  @media (max-width: 1023px) {
    .workspace {
      grid-template-columns: minmax(0, 1fr);
    }
    .side {
      position: static;
    }
  }
  @media (max-width: 640px) {
    .hide-sm {
      display: none;
    }
    .zoom {
      display: none;
    }
    .status {
      margin-left: auto;
    }
  }
  @media (max-width: 480px) {
    .grid {
      --gap: 1rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .bar {
      gap: 0;
      padding: 0.4rem;
    }
    .sep {
      margin: 0 0.15rem;
    }
  }
  /* Perangkat sentuh: tidak ada hover, jadi kontrol kartu selalu tampil. */
  @media (hover: none) {
    .pill {
      opacity: 1;
      transform: translate(-50%, 0);
      pointer-events: auto;
    }
    .tick {
      opacity: 1;
      transform: scale(1);
    }
    .scissor {
      opacity: 1;
      transform: translate(50%, -50%) scale(1);
    }
  }
</style>
