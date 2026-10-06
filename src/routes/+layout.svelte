<script lang="ts">
  import "../app.css";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { i18n, setLang, L } from "#lib/i18n.svelte.ts";
  import Icon from "#lib/components/Icon.svelte";

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    document.documentElement.lang = i18n.lang;
  });
</script>

<header class="site">
  <div class="inner">
    <a class="brand" href="/" aria-label="I love LNSW">
      <span class="logo"><Icon name="heart" size={16} stroke={2.4} /></span>
      <span class="word">I <em>love</em> LNSW</span>
    </a>
    <nav class="nav" aria-label={L("Navigasi utama", "Main navigation")}>
      <a href="/kelola-pdf">{L("Kelola PDF", "Manage PDF")}</a>
    </nav>
    <div class="lang" role="group" aria-label={L("Bahasa", "Language")}>
      <button aria-pressed={i18n.lang === "id"} onclick={() => setLang("id")}>ID</button>
      <button aria-pressed={i18n.lang === "en"} onclick={() => setLang("en")}>EN</button>
    </div>
  </div>
</header>

<main class="page">
  {@render children()}
</main>

<style>
  .site {
    position: sticky;
    top: 0;
    z-index: 30;
    height: 4rem;
    background: rgb(243 242 238 / 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .inner {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    height: 100%;
    max-width: 90rem;
    margin: 0 auto;
    padding: 0 max(1rem, env(safe-area-inset-left));
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .logo {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 10px;
    background: var(--night);
    color: var(--makara);
  }
  .word {
    font-size: 1.05rem;
  }
  .word em {
    font-family: var(--font-serif);
    font-weight: 600;
    font-style: italic;
  }
  .nav {
    display: flex;
    gap: 0.25rem;
  }
  .nav a {
    padding: 0.45rem 0.85rem;
    border-radius: 999px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--muted);
    transition:
      background 0.15s,
      color 0.15s;
  }
  .nav a:hover {
    background: var(--sunken);
    color: var(--fg);
  }
  .lang {
    margin-left: auto;
    display: flex;
    padding: 3px;
    border-radius: 999px;
    background: var(--sunken);
  }
  .lang button {
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--muted);
    cursor: pointer;
  }
  .lang button[aria-pressed="true"] {
    background: var(--surface);
    color: var(--fg);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
  }
  .page {
    max-width: 90rem;
    margin: 0 auto;
    padding: 1.5rem max(1rem, env(safe-area-inset-left)) 4rem;
  }
  @media (max-width: 480px) {
    .nav {
      display: none;
    }
  }
</style>
