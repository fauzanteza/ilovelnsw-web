<script lang="ts">
  import { L } from "#lib/i18n.svelte.ts";
  import PdfEditor from "#lib/components/tools/PdfEditor.svelte";
</script>

<svelte:head>
  <title>{L("Kelola PDF", "Manage PDF")} — I love LNSW</title>
  <meta
    name="description"
    content="Gabung, pisah, putar, urutkan, hapus, duplikat halaman, tambah nomor halaman & watermark. Semua diproses di browser."
  />
</svelte:head>

<header class="tool-head">
  <h1>{L("Kelola PDF", "Manage PDF")}</h1>
  <p>
    {L(
      "Gabung, pisah, putar, urutkan, dan beri nomor halaman — semuanya di satu layar, langsung di perangkatmu.",
      "Merge, split, rotate, reorder, and number pages — all on one screen, right on your device.",
    )}
  </p>
</header>

<PdfEditor />

<style>
  .tool-head {
    margin: 0.5rem 0 1.5rem;
    text-align: center;
  }
  h1 {
    font-family: var(--font-serif);
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  p {
    max-width: 38rem;
    margin: 0.4rem auto 0;
    color: var(--muted);
  }
</style>
