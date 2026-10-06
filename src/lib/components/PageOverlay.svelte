<script lang="ts">
  // Lapisan SVG di atas gambar halaman: anotasi + watermark + nomor halaman.
  // Memakai rumus koordinat yang sama dengan ekspor, jadi pratinjau = hasil.
  import {
    ARROW_SPREAD,
    CSS_FONTS,
    LINE_HEIGHT,
    MARK_PATHS,
    MARK_STROKE,
    NUMBER_BASELINE_BOTTOM,
    NUMBER_BASELINE_TOP,
    NUMBER_MARGIN_X,
    NUMBER_SIZE,
    TEXT_ASCENT,
    arrowHead,
    groupTransform,
    numberLabel,
    viewRot,
    viewSize,
    watermarkSize,
    type LineAnn,
    type PageItem,
    type Stamp,
  } from "#lib/editor.ts";

  let {
    page,
    stamp,
    position,
    total,
  }: {
    page: PageItem;
    stamp: Stamp;
    /** posisi halaman di file keluarannya (0-based) */
    position: number;
    /** jumlah halaman di file keluarannya */
    total: number;
  } = $props();

  const size = $derived(viewSize(page));
  const r = $derived(viewRot(page));

  const label = $derived(stamp.numbers.enabled ? numberLabel(stamp.numbers, position, total) : null);
  const numberPos = $derived.by(() => {
    const { w: W, h: H } = size;
    switch (stamp.numbers.position) {
      case "bottom-right":
        return { x: W - NUMBER_MARGIN_X, y: H - NUMBER_BASELINE_BOTTOM, anchor: "end" };
      case "top-right":
        return { x: W - NUMBER_MARGIN_X, y: NUMBER_BASELINE_TOP, anchor: "end" };
      default:
        return { x: W / 2, y: H - NUMBER_BASELINE_BOTTOM, anchor: "middle" };
    }
  });

  const wmText = $derived(stamp.watermark.enabled ? stamp.watermark.text.trim() : "");
  const wmSize = $derived(watermarkSize(wmText, size.w, size.h));

  function arrowPoints(a: LineAnn) {
    const len = arrowHead(a.width);
    const ang = Math.atan2(a.y1 - a.y2, a.x1 - a.x2);
    return [-1, 1].map((sign) => {
      const t = ang + (sign * ARROW_SPREAD * Math.PI) / 180;
      return [a.x2 + Math.cos(t) * len, a.y2 + Math.sin(t) * len];
    });
  }
</script>

<svg
  class="overlay"
  viewBox="0 0 {size.w} {size.h}"
  preserveAspectRatio="none"
  aria-hidden="true"
  focusable="false"
>
  {#if page.annotations.length}
    <g transform={groupTransform(r, page.w, page.h)}>
      {#each page.annotations as a (a.id)}
        {#if a.kind === "text"}
          <g transform="translate({a.x} {a.y}) rotate({-a.angle})">
            <text
              font-family={CSS_FONTS[a.font ?? "helv"]}
              font-size={a.size}
              font-weight={a.bold ? 700 : 400}
              font-style={a.italic ? "italic" : "normal"}
              fill={a.color}
              xml:space="preserve"
            >
              {#each a.text.split("\n") as line, i}
                <tspan x="0" y={a.size * TEXT_ASCENT + i * a.size * LINE_HEIGHT}>{line}</tspan>
              {/each}
            </text>
          </g>
        {:else if a.kind === "rect"}
          <g transform="translate({a.x} {a.y}) rotate({-a.angle})">
            {#if a.mode === "ellipse"}
              <ellipse cx={a.w / 2} cy={a.h / 2} rx={a.w / 2} ry={a.h / 2} fill="none" stroke={a.color} stroke-width={a.stroke} />
            {:else if a.mode === "box"}
              <rect width={a.w} height={a.h} fill="none" stroke={a.color} stroke-width={a.stroke} />
            {:else if a.mode === "highlight"}
              <rect width={a.w} height={a.h} fill={a.color} opacity="0.4" style="mix-blend-mode: multiply" />
            {:else}
              <rect width={a.w} height={a.h} fill={a.color} />
            {/if}
          </g>
        {:else if a.kind === "line"}
          <g stroke={a.color} stroke-width={a.width} stroke-linecap="round" fill="none">
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />
            {#if a.arrow}
              {#each arrowPoints(a) as [x, y]}
                <line x1={a.x2} y1={a.y2} x2={x} y2={y} />
              {/each}
            {/if}
          </g>
        {:else if a.kind === "ink"}
          <polyline
            points={a.points.join(" ")}
            fill="none"
            stroke={a.color}
            stroke-width={a.width}
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        {:else if a.kind === "mark"}
          <g transform="translate({a.x} {a.y}) rotate({-a.angle}) scale({a.size / 24})">
            <path d={MARK_PATHS[a.symbol]} fill="none" stroke={a.color} stroke-width={MARK_STROKE} stroke-linecap="round" />
          </g>
        {:else if a.kind === "image"}
          <g transform="translate({a.x} {a.y}) rotate({-a.angle})">
            <image href={a.src} width={a.w} height={a.h} preserveAspectRatio="none" />
          </g>
        {/if}
      {/each}
    </g>
  {/if}

  {#if wmText}
    <text
      class="wm"
      x={size.w / 2}
      y={size.h / 2}
      text-anchor="middle"
      dominant-baseline="central"
      font-size={wmSize}
      fill="rgb(115 115 128)"
      opacity={stamp.watermark.opacity}
      transform="rotate({-stamp.watermark.rotation} {size.w / 2} {size.h / 2})">{wmText}</text
    >
  {/if}

  {#if label}
    <text
      class="num"
      x={numberPos.x}
      y={numberPos.y}
      text-anchor={numberPos.anchor}
      font-size={NUMBER_SIZE}
      fill="rgb(51 51 64)">{label}</text
    >
  {/if}
</svg>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
  }
  .wm {
    font-family: Helvetica, Arial, "Liberation Sans", sans-serif;
    font-weight: 700;
    white-space: pre;
  }
  .num {
    font-family: Helvetica, Arial, "Liberation Sans", sans-serif;
    font-variant-numeric: tabular-nums;
  }
</style>
