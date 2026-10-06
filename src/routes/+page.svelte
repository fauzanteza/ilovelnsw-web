<script lang="ts">
  import { L } from "#lib/i18n.svelte.ts";
  import Icon from "#lib/components/Icon.svelte";
  import type { IconName } from "#lib/components/Icon.svelte";
  import { reveal } from "#lib/actions/reveal.ts";

  // Parallax lembut: orb di hero mengikuti posisi kursor.
  let mx = $state(0);
  let my = $state(0);
  function onHeroMove(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width - 0.5;
    my = (e.clientY - r.top) / r.height - 0.5;
  }

  // Angka statistik menghitung naik saat terlihat.
  function countUp(node: HTMLElement, value: string) {
    const m = value.match(/^(\d+)(.*)$/);
    if (!m) return;
    const target = Number(m[1]);
    const suffix = m[2];
    node.textContent = `0${suffix}`;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1400;
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        node.textContent = `${Math.round(target * eased)}${suffix}`;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }

  type Tool = {
    href: string;
    icon: IconName;
    name: string;
    desc: string;
    color: string;
    bg: string;
    ready: boolean;
  };

  const tools: Tool[] = [
    {
      href: "/kelola-pdf",
      icon: "layers",
      name: L("Kelola PDF", "Manage PDF"),
      desc: L(
        "Gabung, pisah, putar, urutkan, hapus, duplikat, ambil halaman, nomor halaman, dan watermark.",
        "Merge, split, rotate, reorder, delete, duplicate, extract pages, page numbers, and watermark."
      ),
      color: "#2B55C7",
      bg: "#E8EEFB",
      ready: true,
    },
    {
      href: "/kelola-pdf",
      icon: "merge",
      name: L("Gabung PDF", "Merge PDF"),
      desc: L(
        "Gabungkan beberapa file PDF menjadi satu dokumen dengan cepat dan mudah.",
        "Combine multiple PDF files into one single document quickly and easily."
      ),
      color: "#E8A830",
      bg: "#FDF5DC",
      ready: true,
    },
    {
      href: "/kelola-pdf",
      icon: "scissors",
      name: L("Pisah PDF", "Split PDF"),
      desc: L(
        "Pisahkan file PDF menjadi beberapa bagian berdasarkan halaman yang kamu tentukan.",
        "Split a PDF file into separate parts based on pages you define."
      ),
      color: "#00B894",
      bg: "#E0F9F0",
      ready: true,
    },
    {
      href: "/kelola-pdf",
      icon: "rotate-cw",
      name: L("Putar PDF", "Rotate PDF"),
      desc: L(
        "Putar halaman PDF ke arah yang benar. Pilih satu atau beberapa halaman sekaligus.",
        "Rotate PDF pages to the correct orientation. Select one or multiple pages."
      ),
      color: "#6C5CE7",
      bg: "#EEECFB",
      ready: true,
    },
    {
      href: "#",
      icon: "compress",
      name: L("Kompres PDF", "Compress PDF"),
      desc: L(
        "Kurangi ukuran file PDF tanpa kehilangan kualitas yang berarti.",
        "Reduce PDF file size without significant quality loss."
      ),
      color: "#D63031",
      bg: "#FDE8E8",
      ready: false,
    },
    {
      href: "#",
      icon: "file-text",
      name: L("PDF ke Word", "PDF to Word"),
      desc: L(
        "Konversi file PDF ke dokumen Word (.docx) yang bisa diedit dengan mudah.",
        "Convert PDF files to editable Word (.docx) documents easily."
      ),
      color: "#0984E3",
      bg: "#E3F2FD",
      ready: false,
    },
    {
      href: "#",
      icon: "image",
      name: L("PDF ke Gambar", "PDF to Image"),
      desc: L(
        "Ubah setiap halaman PDF menjadi gambar berkualitas tinggi (JPG/PNG).",
        "Convert each PDF page to high-quality images (JPG/PNG)."
      ),
      color: "#00CEC9",
      bg: "#E0FFFE",
      ready: false,
    },
    {
      href: "#",
      icon: "upload",
      name: L("Gambar ke PDF", "Image to PDF"),
      desc: L(
        "Konversi gambar JPG, PNG, atau lainnya menjadi file PDF dengan mudah.",
        "Convert JPG, PNG, or other images to PDF files easily."
      ),
      color: "#E17055",
      bg: "#FDE8E0",
      ready: false,
    },
    {
      href: "/kelola-pdf",
      icon: "hash",
      name: L("Nomor Halaman", "Page Numbers"),
      desc: L(
        "Tambahkan nomor halaman ke PDF dengan berbagai format dan posisi.",
        "Add page numbers to PDF with various formats and positions."
      ),
      color: "#636E72",
      bg: "#ECEFF1",
      ready: true,
    },
    {
      href: "/kelola-pdf",
      icon: "droplet",
      name: L("Watermark", "Watermark"),
      desc: L(
        "Tambahkan watermark teks ke PDF untuk melindungi dokumen kamu.",
        "Add text watermark to PDF to protect your documents."
      ),
      color: "#2B55C7",
      bg: "#E8EEFB",
      ready: true,
    },
    {
      href: "/kelola-pdf",
      icon: "pen",
      name: L("Edit PDF", "Edit PDF"),
      desc: L(
        "Tambahkan teks, gambar, tanda tangan, bentuk, dan anotasi ke PDF.",
        "Add text, images, signatures, shapes, and annotations to PDF."
      ),
      color: "#E8A830",
      bg: "#FDF5DC",
      ready: true,
    },
    {
      href: "#",
      icon: "lock",
      name: L("Proteksi PDF", "Protect PDF"),
      desc: L(
        "Lindungi file PDF dengan password untuk keamanan dokumen.",
        "Protect PDF files with password for document security."
      ),
      color: "#D63031",
      bg: "#FDE8E8",
      ready: false,
    },
  ];

  const features = [
    {
      icon: "shield" as IconName,
      title: L("100% Privasi", "100% Privacy"),
      desc: L(
        "Semua diproses di browser kamu. File tidak pernah diunggah ke server mana pun.",
        "Everything is processed in your browser. Files are never uploaded to any server."
      ),
    },
    {
      icon: "zap" as IconName,
      title: L("Super Cepat", "Lightning Fast"),
      desc: L(
        "Tidak perlu menunggu antrean server. Langsung proses di perangkat kamu.",
        "No need to wait in server queues. Process directly on your device."
      ),
    },
    {
      icon: "globe" as IconName,
      title: L("Gratis Selamanya", "Free Forever"),
      desc: L(
        "Semua alat PDF tersedia gratis tanpa batas penggunaan. Tanpa biaya tersembunyi.",
        "All PDF tools available for free with no usage limits. No hidden costs."
      ),
    },
    {
      icon: "lock" as IconName,
      title: L("Aman & Offline", "Safe & Offline"),
      desc: L(
        "Bisa dipakai tanpa koneksi internet. Data kamu tetap aman di perangkat.",
        "Can be used without internet. Your data stays safe on your device."
      ),
    },
  ];

  const stats = [
    { value: "100%", label: L("Di Browser", "In-Browser") },
    { value: "0", label: L("File Diunggah", "Files Uploaded") },
    { value: "12+", label: L("Alat PDF", "PDF Tools") },
    { value: "∞", label: L("Tanpa Batas", "Unlimited") },
  ];
</script>

<svelte:head>
  <title>I love LNSW — {L("Alat PDF Gratis di Browser", "Free PDF Tools in Your Browser")}</title>
  <meta name="description" content={L(
    "Kelola PDF langsung di browser: gabung, pisah, putar, kompres, konversi, nomor halaman, watermark. 100% gratis, privasi terjamin.",
    "Manage PDFs in your browser: merge, split, rotate, compress, convert, page numbers, watermark. 100% free, privacy guaranteed."
  )} />
</svelte:head>

<!-- ═══ Hero Section ═══ -->
<section class="hero" role="region" aria-label="Hero" onpointermove={onHeroMove} style="--mx: {mx}; --my: {my}">
  <div class="hero-bg" aria-hidden="true">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div class="grid-pattern"></div>
  </div>
  <div class="hero-content">
    <div class="hero-badge">
      <span class="badge-icon"><Icon name="zap" size={14} /></span>
      <span>{L("100% di browser — tanpa unggah file", "100% in-browser — no file uploads")}</span>
    </div>
    <h1>
      {L("Semua Alat PDF yang Kamu ", "Every PDF Tool You ")}
      <em class="text-gradient">{L("Butuhkan", "Need")}</em>
    </h1>
    <p class="hero-sub">
      {L(
        "Gabung, pisah, putar, kompres, dan kelola PDF langsung di browser. Gratis, cepat, dan privasi terjamin — tanpa file yang keluar dari perangkatmu.",
        "Merge, split, rotate, compress, and manage PDFs right in your browser. Free, fast, and private — no files ever leave your device.",
      )}
    </p>
    <div class="hero-actions">
      <a href="/kelola-pdf" class="btn btn-primary btn-lg">
        <Icon name="layers" size={18} />
        {L("Mulai Kelola PDF", "Start Managing PDF")}
      </a>
      <a href="#tools" class="btn btn-ghost btn-lg">
        <Icon name="grid" size={18} />
        {L("Lihat Semua Alat", "See All Tools")}
      </a>
    </div>
    <div class="hero-trust">
      <Icon name="shield" size={14} stroke={2.4} />
      <span>{L("File tidak pernah meninggalkan perangkatmu", "Files never leave your device")}</span>
    </div>
  </div>
</section>

<!-- ═══ Stats Bar ═══ -->
<section class="stats-bar">
  <div class="stats-inner" use:reveal={{ from: "zoom" }}>
    {#each stats as stat}
      <div class="stat">
        <span class="stat-val" use:countUp={stat.value}>{stat.value}</span>
        <span class="stat-label">{stat.label}</span>
      </div>
    {/each}
  </div>
</section>

<!-- ═══ Tools Grid ═══ -->
<section class="section" id="tools">
  <div class="section-inner">
    <div class="section-header" use:reveal>
      <span class="section-badge">{L("Alat PDF", "PDF Tools")}</span>
      <h2>{L("Semua yang kamu butuhkan, ", "Everything you need, ")}<em class="text-gradient">{L("di satu tempat", "in one place")}</em></h2>
      <p>{L(
        "Pilih alat yang kamu butuhkan dan mulai kelola PDF langsung di browser.",
        "Pick the tool you need and start managing PDFs right in your browser.",
      )}</p>
    </div>

    <ul class="tools-grid">
      {#each tools as tool, i}
        <li use:reveal={{ delay: (i % 4) * 90 }}>
          <a class="tool-card" href={tool.href} class:coming-soon={!tool.ready}>
            <div class="tool-icon" style="background: {tool.bg}; color: {tool.color};">
              <Icon name={tool.icon} size={24} stroke={1.8} />
            </div>
            <span class="tool-name">{tool.name}</span>
            <span class="tool-desc">{tool.desc}</span>
            {#if tool.ready}
              <span class="tool-go">
                {L("Buka", "Open")} <Icon name="arrow-right" size={14} />
              </span>
            {:else}
              <span class="tool-soon">{L("Segera Hadir", "Coming Soon")}</span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  </div>
</section>

<!-- ═══ Features ═══ -->
<section class="section features-section" id="features">
  <div class="section-inner">
    <div class="section-header" use:reveal>
      <span class="section-badge">{L("Keunggulan", "Features")}</span>
      <h2>{L("Kenapa memilih ", "Why choose ")}<em class="text-gradient">I love LNSW</em>?</h2>
      <p>{L(
        "Dirancang untuk kemudahan, kecepatan, dan keamanan tanpa kompromi.",
        "Designed for ease, speed, and uncompromised security.",
      )}</p>
    </div>

    <div class="features-grid">
      {#each features as feat, i}
        <div use:reveal={{ delay: i * 110, from: i % 2 ? "right" : "left" }}>
          <div class="feature-card">
            <div class="feature-icon-wrap">
              <div class="feature-icon">
                <Icon name={feat.icon} size={24} stroke={1.8} />
              </div>
            </div>
            <h3>{feat.title}</h3>
            <p>{feat.desc}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- ═══ CTA Section ═══ -->
<section class="cta-section">
  <div class="cta-inner" use:reveal={{ from: "zoom" }}>
    <div class="cta-bg" aria-hidden="true">
      <div class="cta-orb cta-orb-1"></div>
      <div class="cta-orb cta-orb-2"></div>
    </div>
    <div class="cta-content">
      <h2>{L("Siap mengelola PDF?", "Ready to manage PDFs?")}</h2>
      <p>{L(
        "Mulai sekarang — gratis, tanpa daftar, tanpa install.",
        "Start now — free, no sign-up, no installation.",
      )}</p>
      <a href="/kelola-pdf" class="btn btn-gold btn-lg cta-btn">
        <Icon name="layers" size={18} />
        {L("Mulai Sekarang", "Get Started")}
      </a>
    </div>
  </div>
</section>

<style>
  /* ═══════════ HERO ═══════════ */
  .hero {
    position: relative;
    overflow: hidden;
    padding: 6rem 1.5rem 5rem;
    text-align: center;
  }
  .hero-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.3;
    translate: calc(var(--mx, 0) * var(--depth, 40px)) calc(var(--my, 0) * var(--depth, 40px));
    transition: translate 0.8s var(--ease-out);
  }
  .orb-1 {
    --depth: -60px;
    width: 500px;
    height: 500px;
    background: var(--brand-blue);
    top: -120px;
    right: -100px;
    animation: float 8s ease-in-out infinite;
  }
  .orb-2 {
    --depth: 50px;
    width: 400px;
    height: 400px;
    background: var(--makara);
    bottom: -80px;
    left: -80px;
    animation: float 10s ease-in-out infinite reverse;
  }
  .orb-3 {
    --depth: 90px;
    width: 300px;
    height: 300px;
    background: #6C5CE7;
    top: 50%;
    left: 50%;
    margin: -150px 0 0 -150px;
    opacity: 0.1;
    animation: float 12s ease-in-out infinite;
  }
  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(43, 85, 199, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(43, 85, 199, 0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 70%);
    animation: grid-drift 20s linear infinite;
  }
  @keyframes grid-drift {
    to {
      background-position: 60px 60px;
    }
  }
  .hero-content {
    position: relative;
    max-width: 52rem;
    margin: 0 auto;
  }
  /* Hero muncul berurutan */
  .hero-content > * {
    animation: fadeInUp 0.8s var(--ease-out) backwards;
  }
  .hero-content > :nth-child(1) { animation-delay: 0.1s; }
  .hero-content > :nth-child(2) { animation-delay: 0.22s; }
  .hero-content > :nth-child(3) { animation-delay: 0.36s; }
  .hero-content > :nth-child(4) { animation-delay: 0.5s; }
  .hero-content > :nth-child(5) { animation-delay: 0.64s; }
  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 1rem;
    border-radius: 999px;
    background: var(--brand-blue-soft);
    color: var(--brand-blue);
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
    border: 1px solid rgba(43, 85, 199, 0.15);
    transition: transform 0.3s var(--ease-spring), box-shadow 0.3s;
  }
  .hero-badge:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(43, 85, 199, 0.15);
  }
  .badge-icon {
    display: inline-grid;
    color: var(--makara-deep);
    animation: zap-flash 2.4s ease-in-out infinite;
  }
  @keyframes zap-flash {
    0%, 80%, 100% { transform: scale(1) rotate(0); }
    85% { transform: scale(1.35) rotate(-12deg); }
    90% { transform: scale(0.9) rotate(8deg); }
  }
  h1 {
    font-family: var(--font-serif);
    font-size: clamp(2.4rem, 6vw, 4rem);
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: -0.03em;
    color: var(--fg);
    margin: 0;
  }
  h1 em {
    font-style: italic;
  }
  .hero-sub {
    max-width: 38rem;
    margin: 1.25rem auto 0;
    color: var(--muted);
    font-size: 1.1rem;
    line-height: 1.6;
  }
  .hero-actions {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 2.25rem;
    flex-wrap: wrap;
  }
  .btn-lg {
    height: 3.25rem;
    padding: 0 1.75rem;
    font-size: 0.95rem;
    border-radius: 16px;
  }
  .btn-lg:hover :global(svg) {
    animation: wiggle 0.5s ease-in-out;
  }
  /* Kilau menyapu tombol utama */
  .hero-actions .btn-primary::after,
  .cta-btn::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(110deg, transparent 30%, rgba(255, 255, 255, 0.45) 50%, transparent 70%);
    transform: translateX(-120%);
    animation: shine 3.5s ease-in-out infinite;
    pointer-events: none;
  }
  .hero-actions .btn-primary,
  .cta-btn {
    position: relative;
    overflow: hidden;
  }
  @keyframes shine {
    0%, 60% { transform: translateX(-120%); }
    100% { transform: translateX(120%); }
  }
  .hero-trust {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 1.75rem;
    font-size: 0.8rem;
    color: var(--faint);
    font-weight: 500;
  }

  /* ═══════════ STATS BAR ═══════════ */
  .stats-bar {
    position: relative;
    z-index: 2;
    margin: -1.5rem auto 0;
    max-width: 54rem;
    padding: 0 1.5rem;
  }
  .stats-inner {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: var(--line);
    border-radius: 20px;
    overflow: hidden;
    box-shadow:
      0 4px 24px rgba(15, 23, 41, 0.08),
      0 1px 3px rgba(15, 23, 41, 0.06);
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 1.5rem 1rem;
    background: var(--surface);
    transition: background 0.3s;
  }
  .stat:hover {
    background: var(--brand-blue-soft);
  }
  .stat:hover .stat-val {
    transform: scale(1.12);
  }
  .stat-val {
    font-family: var(--font-serif);
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--brand-blue);
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    transition: transform 0.35s var(--ease-spring);
  }
  .stat-label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ═══════════ SECTION ═══════════ */
  .section {
    padding: 5rem 1.5rem;
  }
  .section-inner {
    max-width: 74rem;
    margin: 0 auto;
  }
  .section-header {
    text-align: center;
    margin-bottom: 3rem;
  }
  .section-badge {
    display: inline-block;
    padding: 0.35rem 0.9rem;
    border-radius: 999px;
    background: var(--brand-blue-soft);
    color: var(--brand-blue);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 1rem;
  }
  .section-header h2 {
    font-family: var(--font-serif);
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    font-weight: 700;
    line-height: 1.18;
    letter-spacing: -0.025em;
    margin: 0;
  }
  .section-header h2 em {
    font-style: italic;
  }
  .section-header p {
    margin: 0.75rem auto 0;
    max-width: 36rem;
    color: var(--muted);
    font-size: 1rem;
    line-height: 1.6;
  }

  /* ═══════════ TOOLS GRID ═══════════ */
  .tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
    gap: 1rem;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .tools-grid li {
    display: flex;
  }
  .tool-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    height: 100%;
    padding: 1.5rem;
    border-radius: 20px;
    background: var(--surface);
    border: 1.5px solid var(--line);
    text-decoration: none;
    color: var(--fg);
    transition:
      transform 0.35s var(--ease-spring),
      box-shadow 0.35s,
      border-color 0.25s;
    position: relative;
    overflow: hidden;
  }
  .tool-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 35%, rgba(43, 85, 199, 0.08) 50%, transparent 65%);
    transform: translateX(-100%);
    pointer-events: none;
  }
  .tool-card:hover {
    transform: translateY(-6px);
    border-color: var(--brand-blue-light);
    box-shadow:
      0 16px 36px rgba(43, 85, 199, 0.14),
      0 2px 6px rgba(15, 23, 41, 0.04);
  }
  .tool-card:hover::before {
    transition: transform 0.8s var(--ease-out);
    transform: translateX(100%);
  }
  .tool-card:active {
    transform: translateY(-2px) scale(0.98);
    transition-duration: 0.1s;
  }
  .tool-card.coming-soon {
    opacity: 0.65;
    pointer-events: auto;
    cursor: default;
  }
  .tool-card.coming-soon:hover {
    transform: none;
    box-shadow: none;
    border-color: var(--line);
  }
  .tool-card.coming-soon:active {
    animation: shake 0.4s ease-in-out;
  }
  .tool-icon {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 14px;
    transition: transform 0.35s var(--ease-spring);
  }
  .tool-card:hover .tool-icon {
    transform: scale(1.12) rotate(-6deg);
  }
  .tool-name {
    font-family: var(--font-serif);
    font-size: 1.15rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .tool-desc {
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.55;
    flex: 1;
  }
  .tool-go {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 0.35rem;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--brand-blue);
    transition: gap 0.25s var(--ease-spring);
  }
  .tool-card:hover .tool-go {
    gap: 0.6rem;
  }
  .tool-soon {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 0.35rem;
    padding: 0.3rem 0.7rem;
    border-radius: 8px;
    background: var(--sunken);
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--faint);
    width: fit-content;
  }

  /* ═══════════ FEATURES ═══════════ */
  .features-section {
    background: var(--surface);
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1.5rem;
  }
  .features-grid > div {
    display: flex;
  }
  .feature-card {
    flex: 1;
    text-align: center;
    padding: 2.25rem 1.5rem;
    border-radius: 20px;
    background: var(--bg);
    border: 1.5px solid var(--line);
    transition:
      transform 0.35s var(--ease-spring),
      box-shadow 0.35s,
      border-color 0.3s;
  }
  .feature-card:hover {
    transform: translateY(-6px);
    border-color: var(--brand-blue-light);
    box-shadow: 0 16px 36px rgba(43, 85, 199, 0.12);
  }
  .feature-icon-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 1.25rem;
  }
  .feature-icon {
    display: grid;
    place-items: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 16px;
    background: var(--brand-blue-soft);
    color: var(--brand-blue);
    transition: transform 0.45s var(--ease-spring), background 0.3s, color 0.3s, box-shadow 0.3s;
  }
  .feature-card:hover .feature-icon {
    transform: scale(1.1) rotate(-8deg);
    background: var(--brand-blue);
    color: white;
    box-shadow: 0 8px 20px rgba(43, 85, 199, 0.35);
  }
  .feature-card h3 {
    font-family: var(--font-serif);
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    letter-spacing: -0.01em;
  }
  .feature-card p {
    color: var(--muted);
    font-size: 0.88rem;
    line-height: 1.55;
    margin: 0;
  }

  /* ═══════════ CTA ═══════════ */
  .cta-section {
    padding: 0 1.5rem;
    margin-top: -1rem;
  }
  .cta-inner {
    position: relative;
    max-width: 64rem;
    margin: 0 auto;
    border-radius: 28px;
    overflow: hidden;
    background: var(--night);
    padding: 4rem 2rem;
    text-align: center;
  }
  .cta-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .cta-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
  }
  .cta-orb-1 {
    width: 400px;
    height: 400px;
    background: var(--brand-blue);
    top: -160px;
    right: -100px;
    opacity: 0.3;
    animation: float 9s ease-in-out infinite;
  }
  .cta-orb-2 {
    width: 350px;
    height: 350px;
    background: var(--makara);
    bottom: -140px;
    left: -80px;
    opacity: 0.2;
    animation: float 11s ease-in-out infinite reverse;
  }
  .cta-btn {
    animation: glow-pulse 2.6s ease-in-out infinite;
  }
  @keyframes glow-pulse {
    0%, 100% { box-shadow: 0 2px 8px rgba(232, 168, 48, 0.25), 0 0 0 0 rgba(232, 168, 48, 0.45); }
    50% { box-shadow: 0 4px 16px rgba(232, 168, 48, 0.35), 0 0 0 12px rgba(232, 168, 48, 0); }
  }
  .cta-content {
    position: relative;
    z-index: 1;
  }
  .cta-content h2 {
    font-family: var(--font-serif);
    font-size: clamp(1.6rem, 4vw, 2.4rem);
    font-weight: 700;
    color: var(--on-night);
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }
  .cta-content p {
    color: var(--on-night-muted);
    font-size: 1rem;
    margin: 0 0 2rem;
  }

  /* ═══════════ RESPONSIVE ═══════════ */
  @media (max-width: 640px) {
    .hero {
      padding: 4rem 1.25rem 3.5rem;
    }
    .hero-sub {
      font-size: 0.95rem;
    }
    .hero-actions {
      flex-direction: column;
      align-items: center;
    }
    .btn-lg {
      width: 100%;
      max-width: 20rem;
      justify-content: center;
    }
    .stats-inner {
      grid-template-columns: repeat(2, 1fr);
    }
    .stat-val {
      font-size: 1.5rem;
    }
    .tools-grid {
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .tool-card {
      padding: 1.15rem;
      border-radius: 16px;
    }
    .tool-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 12px;
    }
    .tool-name {
      font-size: 0.95rem;
    }
    .tool-desc {
      font-size: 0.78rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .cta-inner {
      padding: 3rem 1.5rem;
      border-radius: 20px;
    }
    .features-grid {
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .feature-card {
      padding: 1.5rem 1rem;
    }
  }

  @media (max-width: 380px) {
    .tools-grid {
      grid-template-columns: 1fr;
    }
    .features-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
