<script lang="ts" module>
  // Ikon garis 24×24 (gaya lucide), digambar dengan stroke currentColor.
  const PATHS = {
    "rotate-ccw": "M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5",
    "rotate-cw": "M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5",
    copy: "M9 9h11v11H9z M5 15H4V4h11v1",
    trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6",
    pen: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
    plus: "M12 5v14 M5 12h14",
    scissors:
      "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M20 4 8.1 15.9 M14.5 14.5 20 20 M8.1 8.1 12 12",
    undo: "M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
    redo: "M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
    x: "M18 6 6 18 M6 6l12 12",
    check: "M20 6 9 17l-5-5",
    file: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M14 3v6h6",
    "file-plus": "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M14 3v6h6 M12 18v-6 M9 15h6",
    "file-out": "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M14 3v6h6 M9 15h6 M13 12l3 3-3 3",
    download: "M12 3v12 M7 10l5 5 5-5 M5 21h14",
    upload: "M12 21V9 M7 14l5-5 5 5 M5 3h14",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
    hash: "M4 9h16 M4 15h16 M10 3 8 21 M16 3l-2 18",
    droplet: "M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0z",
    split: "M16 3h5v5 M8 3H3v5 M12 22v-8.3a4 4 0 0 0-1.2-2.8L3 3 M15 9l6-6",
    "select-all": "M5 3a2 2 0 0 0-2 2 M19 3a2 2 0 0 1 2 2 M21 19a2 2 0 0 1-2 2 M5 21a2 2 0 0 1-2-2 M9 3h1 M14 3h1 M9 21h1 M14 21h1 M3 9v1 M21 9v1 M3 14v1 M21 14v1 M8 12l3 3 5-6",
    refresh: "M3 12a9 9 0 0 1 15-6.7L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15 6.7L3 16 M3 21v-5h5",
    "chevron-down": "m6 9 6 6 6-6",
    "chevron-right": "m9 18 6-6-6-6",
    "arrow-left": "M19 12H5 M12 19l-7-7 7-7",
    "arrow-right": "M5 12h14 M12 5l7 7-7 7",
    "arrow-up": "M12 19V5 M5 12l7-7 7 7",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
    heart: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z",
    zap: "M13 2 3 14h9l-1 8 10-12h-9z",
    lock: "M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4",
    layers: "m12 2 10 5-10 5L2 7z M2 17l10 5 10-5 M2 12l10 5 10-5",
    alert: "M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    merge: "M8 6l4 6-4 6 M12 12h9 M3 6v12",
    compress: "M4 14h6v6H4z M14 4h6v6h-6z M14 14h6v6h-6z M4 4h6v6H4z M7 10v4 M17 10v4",
    image: "M3 3h18v18H3z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M21 15l-5-5L5 21",
    type: "M4 7V4h16v3 M9 20h6 M12 4v16",
    stamp: "M12 3v2 M5.5 16.5h13a2 2 0 0 0 0-4h-1A3.5 3.5 0 0 1 14 9V5a2 2 0 0 0-4 0v4a3.5 3.5 0 0 1-3.5 3.5h-1a2 2 0 0 0 0 4z M5 21h14 M5 17v4 M19 17v4",
    "file-text": "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M14 3v6h6 M16 13H8 M16 17H8 M10 9H8",
    globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
    users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    star: "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    "bar-chart": "M12 20V10 M18 20V4 M6 20v-4",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
    settings: "M12 22a2 2 0 0 0 2-2 2 2 0 0 0-2-2 2 2 0 0 0-2 2 2 2 0 0 0 2 2z M12 14a2 2 0 0 0 2-2 2 2 0 0 0-2-2 2 2 0 0 0-2 2 2 2 0 0 0 2 2z M12 6a2 2 0 0 0 2-2 2 2 0 0 0-2-2 2 2 0 0 0-2 2 2 2 0 0 0 2 2z",
    menu: "M3 12h18 M3 6h18 M3 18h18",
    "external-link": "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14 21 3",
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 18, stroke = 2, class: cls = "" }: { name: IconName; size?: number; stroke?: number; class?: string } =
    $props();
</script>

<svg
  class={cls}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <path d={PATHS[name]} />
</svg>
