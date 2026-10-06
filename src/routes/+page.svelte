<script lang="ts">
  import { L } from "#lib/i18n.svelte.ts";
  import Icon from "#lib/components/Icon.svelte";
</script>

<svelte:head>
  <title>I love LNSW — {L("Alat PDF di browser", "PDF tools in your browser")}</title>
  <meta name="description" content="Kelola PDF langsung di browser: gabung, pisah, putar, urutkan, nomor halaman, watermark." />
</svelte:head>

<section class="hero">
  <h1>{L("Alat PDF yang ", "PDF tools that ")}<em>{L("tetap di perangkatmu", "stay on your device")}</em></h1>
  <p>
    {L(
      "Semua diproses di browser. Tanpa unggah, tanpa antre, aman untuk dokumen pribadi.",
      "Everything runs in your browser. No uploads, no queues, safe for private documents.",
    )}
  </p>
</section>

<ul class="tools">
  <li>
    <a class="tool" href="/kelola-pdf">
      <span class="ico"><Icon name="layers" size={26} stroke={1.8} /></span>
      <span class="name">{L("Kelola PDF", "Manage PDF")}</span>
      <span class="desc">
        {L(
          "Gabung, pisah, putar, urutkan, hapus, duplikat, ambil halaman, nomor halaman, dan watermark dalam satu layar.",
          "Merge, split, rotate, reorder, delete, duplicate, extract pages, page numbers, and watermark on one screen.",
        )}
      </span>
      <span class="go">{L("Buka alat", "Open tool")} <Icon name="arrow-right" size={16} /></span>
    </a>
  </li>
</ul>

<style>
  .hero {
    max-width: 44rem;
    margin: 2.5rem auto;
    text-align: center;
  }
  h1 {
    font-family: var(--font-serif);
    font-size: clamp(2rem, 5vw, 3.4rem);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.02em;
  }
  h1 em {
    font-style: italic;
    background: linear-gradient(transparent 62%, var(--makara) 62%);
  }
  .hero p {
    margin-top: 1rem;
    color: var(--muted);
    font-size: 1.05rem;
  }
  .tools {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    gap: 1rem;
    max-width: 60rem;
    margin: 0 auto;
  }
  .tool {
    display: grid;
    gap: 0.6rem;
    height: 100%;
    padding: 1.5rem;
    border-radius: 24px;
    background: var(--surface);
    border: 1px solid var(--line);
    transition:
      transform 0.3s var(--ease-spring),
      box-shadow 0.3s,
      border-color 0.2s;
  }
  .tool:hover {
    transform: translateY(-3px);
    border-color: var(--line-strong);
    box-shadow: 0 14px 34px rgb(0 0 0 / 0.08);
  }
  .ico {
    display: grid;
    place-items: center;
    width: 3.2rem;
    height: 3.2rem;
    border-radius: 16px;
    background: var(--makara);
    color: var(--on-makara);
  }
  .name {
    margin-top: 0.4rem;
    font-family: var(--font-serif);
    font-size: 1.35rem;
    font-weight: 600;
  }
  .desc {
    color: var(--muted);
    font-size: 0.92rem;
    line-height: 1.5;
  }
  .go {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.4rem;
    font-weight: 700;
    font-size: 0.9rem;
  }
</style>
