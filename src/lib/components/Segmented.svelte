<script lang="ts" generics="T extends string">
  // Grup pilihan tunggal (role="radiogroup") dengan navigasi panah.
  import type { Snippet } from "svelte";

  let {
    label,
    options,
    value = $bindable(),
    item,
  }: {
    label: string;
    options: { value: T; label: string }[];
    value: T;
    /** Isi kustom per opsi; default = teks label. */
    item?: Snippet<[{ value: T; label: string }, boolean]>;
  } = $props();

  let group: HTMLDivElement;
  const id = $props.id();

  function onkeydown(e: KeyboardEvent) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length];
    value = next.value;
    queueMicrotask(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  }
</script>

<div class="field">
  <span class="lbl" {id}>{label}</span>
  <div bind:this={group} class="seg" role="radiogroup" aria-labelledby={id} tabindex="-1" {onkeydown}>
    {#each options as o (o.value)}
      {@const on = o.value === value}
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={o.label}
        tabindex={on ? 0 : -1}
        class:on
        onclick={() => (value = o.value)}
      >
        {#if item}{@render item(o, on)}{:else}{o.label}{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .field {
    display: grid;
    gap: 0.4rem;
  }
  .lbl {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--muted);
  }
  .seg {
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    background: var(--sunken);
  }
  button {
    display: grid;
    place-items: center;
    min-height: 2.25rem;
    padding: 0.35rem 0.4rem;
    border-radius: 10px;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--muted);
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s,
      box-shadow 0.15s;
  }
  button:hover {
    color: var(--fg);
  }
  button.on {
    background: var(--surface);
    color: var(--fg);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
  }
</style>
