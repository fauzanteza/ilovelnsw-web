<script lang="ts">
  import Icon from "./Icon.svelte";
  import { L } from "#lib/i18n.svelte.ts";

  let {
    variant = "stage",
    accept = "application/pdf,.pdf",
    multiple = true,
    dragging = false,
    disabled = false,
    onfiles,
  }: {
    variant?: "stage" | "compact";
    accept?: string;
    multiple?: boolean;
    /** Ada file yang sedang diseret di atas jendela (dikelola induk). */
    dragging?: boolean;
    disabled?: boolean;
    onfiles: (files: File[]) => void;
  } = $props();

  let input: HTMLInputElement;

  function pick() {
    if (!disabled) input.click();
  }

  function onchange() {
    const files = Array.from(input.files ?? []);
    input.value = ""; // supaya file yang sama bisa dipilih lagi
    if (files.length) onfiles(files);
  }
</script>

<input bind:this={input} type="file" {accept} {multiple} class="sr-only" tabindex="-1" aria-hidden="true" {onchange} />

{#if variant === "stage"}
  <button type="button" class="stage" class:dragging onclick={pick} {disabled}>
    <span class="art" aria-hidden="true">
      <span class="sheet s1"></span>
      <span class="sheet s2"></span>
      <span class="sheet s3"><Icon name="layers" size={30} stroke={1.8} /></span>
    </span>
    <span class="title">
      {dragging ? L("Lepaskan untuk membuka", "Drop to open") : L("Pilih file PDF", "Choose PDF files")}
    </span>
    <span class="sub">
      {L("atau seret & jatuhkan ke mana saja di halaman ini. Bisa beberapa file sekaligus.", "or drag & drop anywhere on this page. Multiple files are fine.")}
    </span>
    <span class="btn btn-primary cta"><Icon name="upload" size={16} /> {L("Pilih file", "Choose files")}</span>
  </button>
{:else}
  <button type="button" class="btn btn-ghost compact" onclick={pick} {disabled} title={L("Tambah PDF", "Add PDF")}>
    <Icon name="file-plus" size={16} />
    <span class="label">{L("Tambah PDF", "Add PDF")}</span>
  </button>
{/if}

<style>
  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    min-height: 22rem;
    padding: 3rem 1.5rem;
    border-radius: 24px;
    border: 2px dashed var(--line-strong);
    background: var(--surface);
    text-align: center;
    cursor: pointer;
    transition:
      border-color 0.25s,
      background 0.25s,
      transform 0.35s var(--ease-spring),
      box-shadow 0.35s;
  }
  .stage:hover,
  .stage.dragging {
    border-color: var(--brand-blue);
    box-shadow: 0 0 0 4px var(--brand-blue-glow);
  }
  .stage:active:not(:disabled) {
    transform: scale(0.99);
  }
  .stage.dragging {
    background: var(--brand-blue-soft);
    transform: scale(1.01);
    animation: drag-glow 1.2s ease-in-out infinite;
  }
  @keyframes drag-glow {
    0%, 100% { box-shadow: 0 0 0 4px var(--brand-blue-glow); }
    50% { box-shadow: 0 0 0 10px rgba(43, 85, 199, 0.08); }
  }
  .art {
    position: relative;
    width: 7rem;
    height: 6rem;
    margin-bottom: 0.5rem;
  }
  .sheet {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 3.75rem;
    height: 4.9rem;
    margin: -2.45rem 0 0 -1.875rem;
    border-radius: 12px;
    background: var(--surface);
    border: 1.5px solid var(--line-strong);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
    transition: transform 0.45s var(--ease-spring);
  }
  .s1 {
    transform: rotate(-12deg) translateX(-22px);
  }
  .s2 {
    transform: rotate(10deg) translateX(22px);
  }
  .s3 {
    display: grid;
    place-items: center;
    background: var(--brand-blue);
    border-color: var(--brand-blue-deep);
    color: white;
    animation: sheet-float 3s ease-in-out infinite;
  }
  @keyframes sheet-float {
    0%, 100% { translate: 0 0; }
    50% { translate: 0 -5px; }
  }
  .stage:hover .s1,
  .stage.dragging .s1 {
    transform: rotate(-18deg) translateX(-34px);
  }
  .stage:hover .s2,
  .stage.dragging .s2 {
    transform: rotate(16deg) translateX(34px);
  }
  .stage:hover .s3,
  .stage.dragging .s3 {
    transform: translateY(-6px);
  }
  .stage.dragging .s3 {
    animation: drop-bounce 0.7s ease-in-out infinite;
  }
  @keyframes drop-bounce {
    0%, 100% { translate: 0 0; }
    50% { translate: 0 8px; }
  }
  .stage:hover .cta {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(43, 85, 199, 0.35);
  }
  .title {
    font-family: var(--font-serif);
    font-size: 1.6rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--fg);
  }
  .sub {
    max-width: 26rem;
    color: var(--muted);
    font-size: 0.95rem;
  }
  .cta {
    margin-top: 0.75rem;
    pointer-events: none;
  }
  @media (max-width: 480px) {
    .compact .label {
      display: none;
    }
    .compact {
      padding: 0 0.7rem;
    }
  }
</style>
