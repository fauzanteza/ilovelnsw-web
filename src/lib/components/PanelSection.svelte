<script lang="ts">
  // Bagian akordion di panel samping, dengan switch opsional di kepala bagian.
  import type { Snippet } from "svelte";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import Icon, { type IconName } from "./Icon.svelte";

  let {
    title,
    icon,
    open = $bindable(false),
    enabled = $bindable<boolean | undefined>(undefined),
    badge,
    reduced = false,
    children,
  }: {
    title: string;
    icon: IconName;
    open?: boolean;
    /** Kalau diisi, kepala bagian menampilkan switch (role="switch"). */
    enabled?: boolean;
    badge?: string;
    reduced?: boolean;
    children: Snippet;
  } = $props();

  const id = $props.id();

  function onSwitch(e: Event) {
    enabled = (e.currentTarget as HTMLInputElement).checked;
    if (enabled) open = true; // menyalakan langsung menampilkan pengaturannya
  }
</script>

<section class="ps" class:open class:on={enabled}>
  <div class="head">
    <button
      type="button"
      class="toggle"
      aria-expanded={open}
      aria-controls={id}
      onclick={() => (open = !open)}
    >
      <span class="ico"><Icon name={icon} size={17} /></span>
      <span class="title">{title}</span>
      {#if badge}<span class="badge">{badge}</span>{/if}
      <span class="chev"><Icon name="chevron-down" size={16} /></span>
    </button>
    {#if enabled !== undefined}
      <input
        type="checkbox"
        role="switch"
        class="switch"
        checked={enabled}
        aria-checked={enabled}
        aria-label={title}
        onchange={onSwitch}
      />
    {/if}
  </div>
  {#if open}
    <div {id} class="body" transition:slide={{ duration: reduced ? 0 : 250, easing: cubicOut }}>
      <div class="inner">
        {@render children()}
      </div>
    </div>
  {/if}
</section>

<style>
  .ps {
    border-top: 1px solid var(--line);
  }
  .ps:first-child {
    border-top: 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-right: 0.25rem;
  }
  .toggle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
    padding: 0.9rem 0.25rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .ico {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    flex: none;
    border-radius: 10px;
    background: var(--sunken);
    transition:
      background 0.2s,
      color 0.2s;
  }
  .on .ico {
    background: var(--makara);
    color: var(--on-makara);
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge {
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: var(--night);
    color: var(--on-night);
    font-size: 0.72rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .chev {
    margin-left: auto;
    color: var(--faint);
    transition: transform 0.25s var(--ease-out);
  }
  .open .chev {
    transform: rotate(180deg);
  }
  .inner {
    padding: 0 0.25rem 1.1rem;
    display: grid;
    gap: 0.9rem;
  }
</style>
