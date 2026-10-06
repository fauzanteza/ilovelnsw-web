<script lang="ts">
  import "../app.css";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { fly, fade, scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import { onNavigate } from "$app/navigation";
  import { i18n, setLang, L } from "#lib/i18n.svelte.ts";
  import Icon from "#lib/components/Icon.svelte";
  import { installRipple } from "#lib/actions/ripple.ts";
  import { reveal } from "#lib/actions/reveal.ts";

  let { children }: { children: Snippet } = $props();

  let scrolled = $state(false);
  let mobileMenuOpen = $state(false);
  let progress = $state(0);
  let showTop = $state(false);

  onMount(() => {
    document.documentElement.lang = i18n.lang;
    const handleScroll = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrolled = y > 10;
      showTop = y > 600;
      progress = max > 0 ? Math.min(1, y / max) : 0;
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    const removeRipple = installRipple();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      removeRipple();
    };
  });

  // Animasi transisi antar halaman (jika browser mendukung View Transitions).
  onNavigate((navigation) => {
    mobileMenuOpen = false;
    if (!document.startViewTransition) return;
    if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function toTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

<div class="scroll-progress" style="transform: scaleX({progress})" aria-hidden="true"></div>

<header class="site" class:scrolled>
  <div class="inner">
    <a class="brand" href="/" aria-label="I love LNSW">
      <img class="logo-img" src="/logo.png" alt="I love LNSW" width="159" height="36" />
    </a>

    <nav class="nav" aria-label={L("Navigasi utama", "Main navigation")}>
      <a href="/kelola-pdf">
        <Icon name="layers" size={15} />
        {L("Kelola PDF", "Manage PDF")}
      </a>
      <a href="/#tools">
        <Icon name="grid" size={15} />
        {L("Semua Alat", "All Tools")}
      </a>
    </nav>

    <div class="right">
      <div class="lang" class:en={i18n.lang === "en"} role="group" aria-label={L("Bahasa", "Language")}>
        <span class="lang-pill" aria-hidden="true"></span>
        <button aria-pressed={i18n.lang === "id"} onclick={() => setLang("id")}>ID</button>
        <button aria-pressed={i18n.lang === "en"} onclick={() => setLang("en")}>EN</button>
      </div>

      <button class="mobile-toggle" class:open={mobileMenuOpen} onclick={toggleMobileMenu} aria-label="Menu" aria-expanded={mobileMenuOpen}>
        {#key mobileMenuOpen}
          <span class="toggle-icon" in:scale={{ duration: 250, start: 0.5, easing: backOut }}>
            <Icon name={mobileMenuOpen ? "x" : "menu"} size={22} />
          </span>
        {/key}
      </button>
    </div>
  </div>
</header>

{#if mobileMenuOpen}
  <div class="mobile-backdrop" transition:fade={{ duration: 200 }} onclick={() => (mobileMenuOpen = false)} role="presentation"></div>
  <div class="mobile-nav" role="navigation" transition:fly={{ y: -16, duration: 300, easing: cubicOut }}>
    <a href="/kelola-pdf" onclick={() => (mobileMenuOpen = false)} in:fly={{ x: -20, delay: 60, duration: 300 }}>
      <Icon name="layers" size={18} />
      {L("Kelola PDF", "Manage PDF")}
    </a>
    <a href="/#tools" onclick={() => (mobileMenuOpen = false)} in:fly={{ x: -20, delay: 120, duration: 300 }}>
      <Icon name="grid" size={18} />
      {L("Semua Alat", "All Tools")}
    </a>
  </div>
{/if}

<main>
  {@render children()}
</main>

{#if showTop}
  <button class="to-top" onclick={toTop} aria-label={L("Kembali ke atas", "Back to top")} transition:scale={{ duration: 300, start: 0.4, easing: backOut }}>
    <Icon name="arrow-up" size={20} stroke={2.4} />
  </button>
{/if}

<footer class="site-footer">
  <div class="footer-inner" use:reveal>
    <a class="footer-brand" href="/" aria-label="I love LNSW">
      <img src="/logo.png" alt="I love LNSW" width="195" height="44" />
    </a>
    <p class="footer-tagline">{L("Alat PDF gratis, langsung di browser kamu.", "Free PDF tools, right in your browser.")}</p>
    <div class="footer-links">
      <a href="/kelola-pdf">{L("Kelola PDF", "Manage PDF")}</a>
      <span class="dot">·</span>
      <a href="/#features">{L("Fitur", "Features")}</a>
      <span class="dot">·</span>
      <a href="/#tools">{L("Alat", "Tools")}</a>
    </div>
    <div class="footer-bottom">
      <p>© 2026 I love LNSW. {L("Semua hak dilindungi.", "All rights reserved.")}</p>
      <div class="footer-badges">
        <span class="badge"><Icon name="shield" size={13} /> {L("Privasi Terjamin", "Privacy Secure")}</span>
        <span class="badge"><Icon name="zap" size={13} /> {L("Tanpa Upload", "No Upload")}</span>
      </div>
    </div>
  </div>
</footer>

<style>
  /* ─── Scroll progress ─── */
  .scroll-progress {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    z-index: 60;
    transform-origin: 0 50%;
    background: linear-gradient(90deg, var(--brand-blue), var(--brand-blue-light), var(--makara));
    box-shadow: 0 0 10px rgba(43, 85, 199, 0.4);
    pointer-events: none;
    transition: transform 0.1s linear;
  }

  /* ─── Back to top ─── */
  .to-top {
    position: fixed;
    right: max(1.25rem, env(safe-area-inset-right));
    bottom: max(1.25rem, env(safe-area-inset-bottom));
    z-index: 45;
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border: none;
    border-radius: 16px;
    background: var(--brand-blue);
    color: #fff;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(43, 85, 199, 0.35);
    transition: transform 0.3s var(--ease-spring), background 0.2s, box-shadow 0.3s;
  }
  .to-top:hover {
    background: var(--brand-blue-deep);
    transform: translateY(-3px);
    box-shadow: 0 12px 28px rgba(43, 85, 199, 0.45);
  }
  .to-top:hover :global(svg) {
    animation: bounce-y 0.8s ease-in-out infinite;
  }
  .to-top:active {
    transform: scale(0.92);
  }

  /* ─── Header ─── */
  main {
    view-transition-name: main;
  }
  .site {
    position: sticky;
    top: 0;
    z-index: 50;
    height: 4rem;
    background: rgba(245, 247, 251, 0.7);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border-bottom: 1px solid transparent;
    transition: border-color 0.3s, background 0.3s, box-shadow 0.3s, height 0.3s;
    animation: header-in 0.6s var(--ease-out) both;
  }
  @keyframes header-in {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
  }
  .site.scrolled {
    border-bottom-color: var(--line);
    background: rgba(245, 247, 251, 0.92);
    box-shadow: 0 1px 12px rgba(15, 23, 41, 0.06);
  }
  .inner {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    height: 100%;
    max-width: 80rem;
    margin: 0 auto;
    padding: 0 max(1.25rem, env(safe-area-inset-left));
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-decoration: none;
    color: var(--fg);
  }
  .logo-img {
    display: block;
    height: 36px;
    width: auto;
    transition: transform 0.3s var(--ease-spring), filter 0.3s;
  }
  .brand:hover .logo-img {
    animation: heartbeat 1.1s ease-in-out;
    filter: drop-shadow(0 4px 10px rgba(43, 85, 199, 0.25));
  }
  .brand:active .logo-img {
    transform: scale(0.94);
  }
  .nav {
    display: flex;
    gap: 0.25rem;
  }
  .nav a {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--muted);
    text-decoration: none;
    transition:
      background 0.2s,
      color 0.2s,
      transform 0.2s;
  }
  .nav a::after {
    content: "";
    position: absolute;
    left: 0.9rem;
    right: 0.9rem;
    bottom: 0.3rem;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--brand-blue), var(--makara));
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.3s var(--ease-out);
  }
  .nav a:hover::after {
    transform: scaleX(1);
  }
  .nav a:hover :global(svg) {
    animation: wiggle 0.5s ease-in-out;
  }
  .nav a:hover {
    background: var(--brand-blue-soft);
    color: var(--brand-blue);
    transform: translateY(-1px);
  }
  .nav a:active {
    transform: scale(0.96);
  }

  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .lang {
    position: relative;
    display: flex;
    padding: 3px;
    border-radius: 10px;
    background: var(--sunken);
    border: 1px solid var(--line);
  }
  .lang-pill {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc(50% - 3px);
    border-radius: 8px;
    background: var(--brand-blue);
    box-shadow: 0 2px 6px rgba(43, 85, 199, 0.25);
    transition: transform 0.4s var(--ease-spring);
  }
  .lang.en .lang-pill {
    transform: translateX(100%);
  }
  .lang button {
    position: relative;
    z-index: 1;
    flex: 1;
    padding: 0.3rem 0.65rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--muted);
    cursor: pointer;
    transition: color 0.3s;
    border: none;
    background: transparent;
  }
  .lang button:active {
    transform: scale(0.9);
  }
  .lang button[aria-pressed="true"] {
    color: white;
  }
  .mobile-toggle {
    display: none;
    background: none;
    border: none;
    color: var(--fg);
    cursor: pointer;
    padding: 0.35rem;
    border-radius: 8px;
  }
  .mobile-toggle:hover {
    background: var(--sunken);
  }
  .toggle-icon {
    display: grid;
    place-items: center;
  }
  .mobile-backdrop {
    position: fixed;
    inset: 4rem 0 0;
    z-index: 48;
    background: rgba(15, 23, 41, 0.25);
    backdrop-filter: blur(2px);
  }

  /* ─── Mobile Nav ─── */
  .mobile-nav {
    position: fixed;
    top: 4rem;
    left: 0;
    right: 0;
    z-index: 49;
    background: rgba(245, 247, 251, 0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--line);
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .mobile-nav a {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-radius: 14px;
    font-weight: 600;
    color: var(--fg);
    text-decoration: none;
    transition: background 0.2s;
  }
  .mobile-nav a:hover {
    background: var(--brand-blue-soft);
    color: var(--brand-blue);
  }

  /* ─── Footer ─── */
  .site-footer {
    background: var(--night);
    color: var(--on-night);
    margin-top: 4rem;
  }
  .footer-inner {
    max-width: 80rem;
    margin: 0 auto;
    padding: 3.5rem max(1.25rem, env(safe-area-inset-left)) 2rem;
    text-align: center;
  }
  .footer-brand {
    display: inline-flex;
    align-items: center;
    padding: 0.85rem 1.5rem;
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
    margin-bottom: 0.5rem;
    transition: transform 0.3s var(--ease-spring);
  }
  .footer-brand:hover {
    transform: translateY(-2px) scale(1.03);
  }
  .footer-brand img {
    display: block;
    height: 44px;
    width: auto;
  }
  .footer-tagline {
    color: var(--on-night-muted);
    font-size: 0.9rem;
    margin: 0.5rem 0 1.5rem;
  }
  .footer-links {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 2rem;
  }
  .footer-links a {
    color: var(--on-night-muted);
    text-decoration: none;
    font-size: 0.85rem;
    font-weight: 500;
    transition: color 0.2s;
  }
  .footer-links a:hover {
    color: var(--makara);
  }
  .dot {
    color: rgba(255,255,255,0.2);
    font-size: 0.75rem;
  }
  .footer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--night-line);
  }
  .footer-bottom p {
    color: var(--on-night-muted);
    font-size: 0.8rem;
    margin: 0;
  }
  .footer-badges {
    display: flex;
    gap: 0.75rem;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem;
    border-radius: 8px;
    background: rgba(255,255,255,0.06);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--on-night-muted);
  }

  /* ─── Responsive ─── */
  @media (max-width: 640px) {
    .nav {
      display: none;
    }
    .logo-img {
      height: 30px;
    }
    .mobile-toggle {
      display: grid;
      place-items: center;
    }
    .footer-bottom {
      flex-direction: column;
      text-align: center;
    }
  }
</style>
