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
    <span class="btn btn-dark cta"><Icon name="upload" size={16} /> {L("Pilih file", "Choose files")}</span>
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
    border-radius: 28px;
    border: 2px dashed var(--line-strong);
    background: var(--surface);
    text-align: center;
    cursor: pointer;
    transition:
      border-color 0.2s,
      background 0.2s,
      transform 0.3s var(--ease-spring);
  }
  .stage:hover,
  .stage.dragging {
    border-color: var(--fg);
  }
  .stage.dragging {
    background: var(--makara-soft);
    transform: scale(1.01);
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
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.08);
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
    background: var(--makara);
    border-color: var(--makara-deep);
    color: var(--on-makara);
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
  .title {
    font-family: var(--font-serif);
    font-size: 1.6rem;
    font-weight: 600;
    letter-spacing: -0.01em;
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
