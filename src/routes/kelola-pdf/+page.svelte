<script lang="ts">
  import { L } from "#lib/i18n.svelte.ts";
  import Icon from "#lib/components/Icon.svelte";
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
  <div class="tool-icon-wrap">
    <div class="tool-icon">
      <Icon name="layers" size={28} stroke={1.8} />
    </div>
  </div>
  <h1><span class="text-gradient">{L("Kelola PDF", "Manage PDF")}</span></h1>
  <p>
    {L(
      "Gabung, pisah, putar, urutkan, dan beri nomor halaman — semuanya di satu layar, langsung di perangkatmu.",
      "Merge, split, rotate, reorder, and number pages — all on one screen, right on your device.",
    )}
  </p>
  <div class="tool-badges">
    <span class="badge"><Icon name="shield" size={13} /> {L("Privasi 100%", "100% Private")}</span>
    <span class="badge"><Icon name="zap" size={13} /> {L("Proses Instan", "Instant Processing")}</span>
    <span class="badge"><Icon name="globe" size={13} /> {L("Gratis", "Free")}</span>
  </div>
</header>

<PdfEditor />

<style>
  .tool-head {
    margin: 1rem 0 2rem;
    text-align: center;
  }
  .tool-head > * {
    animation: fadeInUp 0.6s var(--ease-out) both;
  }
  .tool-head > :nth-child(2) { animation-delay: 0.08s; }
  .tool-head > :nth-child(3) { animation-delay: 0.16s; }
  .tool-head > :nth-child(4) { animation-delay: 0.24s; }
  .tool-icon-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }
  .tool-icon {
    display: grid;
    place-items: center;
    width: 4rem;
    height: 4rem;
    border-radius: 18px;
    background: var(--brand-blue-soft);
    color: var(--brand-blue);
    animation: float 4s ease-in-out infinite;
    transition: background 0.3s, color 0.3s, box-shadow 0.3s;
  }
  .tool-icon:hover {
    background: var(--brand-blue);
    color: #fff;
    box-shadow: 0 10px 24px rgba(43, 85, 199, 0.35);
  }
  h1 {
    font-family: var(--font-serif);
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 700;
    font-style: italic;
    line-height: 1.2;
    letter-spacing: -0.02em;
    margin: 0;
  }
  p {
    max-width: 38rem;
    margin: 0.5rem auto 0;
    color: var(--muted);
    font-size: 1rem;
    line-height: 1.6;
  }
  .tool-badges {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.7rem;
    border-radius: 8px;
    background: var(--sunken);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
    border: 1px solid var(--line);
    animation: pop 0.5s var(--ease-spring) backwards;
    transition: transform 0.25s var(--ease-spring), color 0.2s, border-color 0.2s, background 0.2s;
  }
  .badge:nth-child(1) { animation-delay: 0.35s; }
  .badge:nth-child(2) { animation-delay: 0.45s; }
  .badge:nth-child(3) { animation-delay: 0.55s; }
  .badge:hover {
    transform: translateY(-2px);
    color: var(--brand-blue);
    border-color: var(--brand-blue-light);
    background: var(--brand-blue-soft);
  }
</style>
