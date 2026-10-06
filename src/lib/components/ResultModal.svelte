<script lang="ts" module>
  export type ResultFile = { name: string; blob: Blob; url: string };
</script>

<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { portal } from "#lib/actions/portal.ts";
  import { formatBytes } from "#lib/pdf.ts";
  import { L } from "#lib/i18n.svelte.ts";
  import Icon from "./Icon.svelte";

  let { files, onclose }: { files: ResultFile[]; onclose: () => void } = $props();

  let dialog: HTMLDivElement;
  let downloading = $state(false);
  const total = $derived(files.reduce((n, f) => n + f.blob.size, 0));

  function clickLink(f: ResultFile) {
    const a = document.createElement("a");
    a.href = f.url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Jeda 300 ms antarfile supaya browser tidak memblokir unduhan beruntun.
  async function downloadAll() {
    downloading = true;
    for (let i = 0; i < files.length; i++) {
      clickLink(files[i]);
      if (i < files.length - 1) await new Promise((r) => setTimeout(r, 300));
    }
    downloading = false;
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
    }
  }

  $effect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => prev?.focus?.();
  });
</script>

<svelte:window {onkeydown} />

<div use:portal class="backdrop" transition:fade={{ duration: 180 }} onclick={onclose} role="presentation">
  <div
    bind:this={dialog}
    class="card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="result-title"
    tabindex="-1"
    transition:fly={{ y: 24, duration: 320, easing: cubicOut }}
    onclick={(e) => e.stopPropagation()}
    onkeydown={() => {}}
  >
    <div class="head">
      <span class="ok"><Icon name="check" size={22} stroke={2.6} /></span>
      <div>
        <h2 id="result-title">{L("PDF siap", "Your PDF is ready")}</h2>
        <p>
          {files.length > 1
            ? L(`${files.length} file · ${formatBytes(total)}`, `${files.length} files · ${formatBytes(total)}`)
            : formatBytes(total)}
        </p>
      </div>
      <button class="icon-btn close" onclick={onclose} title={L("Tutup", "Close")} aria-label={L("Tutup", "Close")}>
        <Icon name="x" />
      </button>
    </div>

    <ul class="files">
      {#each files as f (f.name)}
        <li>
          <span class="fi"><Icon name="file" size={18} /></span>
          <span class="meta">
            <span class="name" title={f.name}>{f.name}</span>
            <span class="size">{formatBytes(f.blob.size)}</span>
          </span>
          <a class="icon-btn" href={f.url} download={f.name} title={L("Unduh", "Download")} aria-label={`${L("Unduh", "Download")} ${f.name}`}>
            <Icon name="download" />
          </a>
        </li>
      {/each}
    </ul>

    <div class="actions">
      <button class="btn btn-primary big" data-autofocus onclick={downloadAll} disabled={downloading}>
        <Icon name="download" size={18} />
        {files.length > 1 ? L(`Unduh ${files.length} file`, `Download ${files.length} files`) : L("Unduh", "Download")}
      </button>
      <button class="btn btn-ghost big" onclick={onclose}>{L("Lanjut mengedit", "Keep editing")}</button>
    </div>
    <p class="note"><Icon name="shield" size={14} /> {L("Dibuat di perangkatmu. Tidak ada file yang diunggah.", "Made on your device. Nothing was uploaded.")}</p>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgb(11 10 8 / 0.45);
    backdrop-filter: blur(4px);
  }
  .card {
    width: min(100%, 30rem);
    max-height: calc(100dvh - 2rem);
    overflow: auto;
    padding: 1.5rem;
    border-radius: 28px;
    background: var(--surface);
    box-shadow: 0 30px 80px rgb(0 0 0 / 0.25);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }
  .ok {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    flex: none;
    border-radius: 999px;
    background: var(--makara);
    color: var(--on-makara);
    animation: pop 0.5s var(--ease-spring);
  }
  @keyframes pop {
    from {
      transform: scale(0.4);
    }
  }
  h2 {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.1;
  }
  .head p {
    color: var(--muted);
    font-size: 0.875rem;
  }
  .close {
    margin-left: auto;
    align-self: flex-start;
  }
  .files {
    margin: 1.25rem 0;
    display: grid;
    gap: 0.5rem;
  }
  .files li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.6rem 0.6rem 0.8rem;
    border-radius: 16px;
    background: var(--sunken);
  }
  .fi {
    color: var(--danger);
  }
  .meta {
    display: grid;
    min-width: 0;
    flex: 1;
  }
  .name {
    font-weight: 600;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .size {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .actions {
    display: grid;
    gap: 0.5rem;
  }
  .big {
    height: 3rem;
    font-size: 0.95rem;
  }
  .note {
    margin-top: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    color: var(--muted);
    font-size: 0.78rem;
  }
</style>
