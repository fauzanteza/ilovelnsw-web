// Seret untuk mengurutkan berbasis Pointer Events (bukan HTML5 Drag & Drop):
// - ghost yang hidup (miring mengikuti gerak, tumpukan untuk multi-pilih)
// - jalan di layar sentuh (tahan 260 ms lalu seret)
// - DOM tidak diubah selama menyeret; sel digeser dengan transform saja (tanpa reflow)

import { tick } from "svelte";

export type SortableOptions = {
  /** Urutan id saat ini. */
  ids: string[];
  /** Id terpilih; menyeret item terpilih memindahkan seluruh seleksi. */
  selection: string[];
  /** `moving` dalam urutan dokumen, disisipkan di indeks `at` dari sisa item. */
  onsort: (moving: string[], at: number) => void | Promise<void>;
  onstart?: () => void;
  onend?: () => void;
  disabled?: boolean;
};

type Slot = { x: number; y: number; w: number; h: number };

const IGNORE = "button, input, a, textarea, select, label, [data-no-drag]";
const MOUSE_THRESHOLD = 6;
const TOUCH_HOLD_MS = 260;
const TOUCH_SLOP = 10;
const EDGE = 90;
const EDGE_SPEED = 22;
const SHIFT_MS = 320;
const LAND_MS = 220;
const LIFT_MS = 160;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function sortable(node: HTMLElement, options: SortableOptions) {
  let opts = options;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dur = (ms: number) => (reduced() ? 0 : ms);

  // ── tahap "menunggu" (sebelum ambang/long-press terpenuhi) ──
  let pending: {
    id: string;
    el: HTMLElement;
    pointerId: number;
    type: string;
    x0: number;
    y0: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null = null;

  // ── tahap menyeret ──
  let drag: {
    grabbed: string;
    moving: string[];
    order: string[];
    els: Map<string, HTMLElement>;
    slots: Slot[]; // slot posisional (indeks dalam `order`), koordinat dokumen
    home: Map<string, number>; // indeks awal tiap id
    ghost: HTMLElement;
    inner: HTMLElement;
    offX: number;
    offY: number;
    w: number;
    h: number;
    x: number;
    y: number;
    lastX: number;
    tilt: number;
    target: number;
    next: string[];
    raf: number;
  } | null = null;

  const items = () => Array.from(node.querySelectorAll<HTMLElement>(":scope > [data-sort-id]"));

  function onPointerDown(e: PointerEvent) {
    if (opts.disabled || drag || pending) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(IGNORE)) return;
    const el = target.closest<HTMLElement>("[data-sort-id]");
    if (!el || el.parentElement !== node) return;

    pending = {
      id: el.dataset.sortId!,
      el,
      pointerId: e.pointerId,
      type: e.pointerType,
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      timer: null,
    };
    if (e.pointerType !== "mouse") {
      // Sentuh/pena: tahan dulu. Kalau jari bergerak lebih dulu, itu scroll biasa.
      pending.timer = setTimeout(() => {
        if (pending) begin(pending.x, pending.y);
      }, TOUCH_HOLD_MS);
    }
    window.addEventListener("pointermove", onPendingMove, { passive: true });
    window.addEventListener("pointerup", clearPending);
    window.addEventListener("pointercancel", clearPending);
  }

  function onPendingMove(e: PointerEvent) {
    if (!pending || e.pointerId !== pending.pointerId) return;
    pending.x = e.clientX;
    pending.y = e.clientY;
    const d = Math.hypot(e.clientX - pending.x0, e.clientY - pending.y0);
    if (pending.type === "mouse") {
      if (d > MOUSE_THRESHOLD) begin(e.clientX, e.clientY);
    } else if (d > TOUCH_SLOP) {
      clearPending();
    }
  }

  function clearPending() {
    if (pending?.timer) clearTimeout(pending.timer);
    pending = null;
    window.removeEventListener("pointermove", onPendingMove);
    window.removeEventListener("pointerup", clearPending);
    window.removeEventListener("pointercancel", clearPending);
  }

  // Cegah menu konteks long-press di HP saat sedang menahan kartu.
  function onContextMenu(e: Event) {
    if (pending && pending.type !== "mouse") e.preventDefault();
    if (drag) e.preventDefault();
  }

  function begin(x: number, y: number) {
    if (!pending) return;
    const { id, el } = pending;
    clearPending();

    const els = new Map(items().map((n) => [n.dataset.sortId!, n]));
    const order = opts.ids.filter((i) => els.has(i));
    if (!order.includes(id)) return;
    const sel = new Set(opts.selection);
    const moving = sel.has(id) ? order.filter((i) => sel.has(i)) : [id];

    // Ukur slot sekali di awal (koordinat dokumen).
    const slots = order.map((i) => {
      const r = els.get(i)!.getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
    });
    const home = new Map(order.map((i, k) => [i, k]));
    const rect = el.getBoundingClientRect();

    // Ghost: klon kartu yang mengikuti pointer.
    const ghost = document.createElement("div");
    ghost.className = "sort-ghost";
    Object.assign(ghost.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      pointerEvents: "none",
      zIndex: "1000",
      willChange: "transform",
    });
    const inner = document.createElement("div");
    Object.assign(inner.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      transition: `transform ${dur(LIFT_MS)}ms ${EASE}`,
      transformOrigin: "50% 40%",
    });
    if (moving.length > 1) {
      // Maksimal 2 lapisan "tumpukan" di belakang.
      for (let k = Math.min(2, moving.length - 1); k >= 1; k--) {
        const layer = document.createElement("div");
        layer.className = "sort-ghost-layer";
        Object.assign(layer.style, {
          position: "absolute",
          top: "0",
          left: "0",
          right: "0",
          transform: `translate(${k * 6}px, ${k * 6}px) rotate(${k * 2.5}deg)`,
        });
        inner.appendChild(layer);
      }
    }
    const clone = el.cloneNode(true) as HTMLElement;
    clone.removeAttribute("data-sort-id");
    clone.removeAttribute("id");
    clone.classList.remove("sort-source", "sort-landing");
    clone.classList.add("sort-ghost-card");
    clone.setAttribute("aria-hidden", "true");
    clone.setAttribute("inert", "");
    Object.assign(clone.style, { position: "relative", width: "100%", height: "100%", margin: "0", transform: "" });
    inner.appendChild(clone);
    if (moving.length > 1) {
      const badge = document.createElement("span");
      badge.className = "sort-ghost-badge";
      badge.textContent = String(moving.length);
      inner.appendChild(badge);
    }
    ghost.appendChild(inner);
    document.body.appendChild(ghost);

    drag = {
      grabbed: id,
      moving,
      order,
      els,
      slots,
      home,
      ghost,
      inner,
      offX: x - rect.left,
      offY: y - rect.top,
      w: rect.width,
      h: rect.height,
      x,
      y,
      lastX: x,
      tilt: 0,
      target: -1,
      next: order,
      raf: 0,
    };

    for (const m of moving) els.get(m)?.classList.add("sort-source");
    for (const n of els.values()) {
      n.style.transition = `transform ${dur(SHIFT_MS)}ms ${EASE}`;
      n.style.willChange = "transform";
    }
    document.documentElement.classList.add("is-sorting");
    navigator.vibrate?.(8);

    ghost.style.transform = `translate(${x - drag.offX}px, ${y - drag.offY}px)`;
    requestAnimationFrame(() => {
      if (drag) drag.inner.style.transform = "scale(1.04)";
    });

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", preventTouch, { passive: false });

    opts.onstart?.();
    computeTarget();
  }

  function preventTouch(e: TouchEvent) {
    if (drag) e.preventDefault();
  }

  function onMove(e: PointerEvent) {
    if (!drag) return;
    e.preventDefault();
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.raf) drag.raf = requestAnimationFrame(frame);
  }

  function frame() {
    if (!drag) return;
    drag.raf = 0;
    const { x, y } = drag;

    // Miring mengikuti kecepatan horizontal, dibatasi ±4°, dihaluskan.
    const vx = x - drag.lastX;
    drag.lastX = x;
    const want = Math.max(-4, Math.min(4, vx * 0.6));
    drag.tilt += (want - drag.tilt) * 0.25;
    drag.ghost.style.transform = `translate(${x - drag.offX}px, ${y - drag.offY}px)`;
    drag.inner.style.transition = "none";
    drag.inner.style.transform = `rotate(${drag.tilt.toFixed(2)}deg) scale(1.04)`;

    // Auto-scroll di tepi viewport (kecepatan kuadratik).
    let scrolled = false;
    if (y < EDGE) {
      window.scrollBy(0, -(((EDGE - y) / EDGE) ** 2) * EDGE_SPEED);
      scrolled = true;
    } else if (y > innerHeight - EDGE) {
      window.scrollBy(0, ((y - (innerHeight - EDGE)) / EDGE) ** 2 * EDGE_SPEED);
      scrolled = true;
    }

    computeTarget();
    // Tetap jalan selama di zona tepi (scroll) atau tilt belum kembali ke 0.
    if (scrolled || Math.abs(drag.tilt) > 0.05) drag.raf = requestAnimationFrame(frame);
  }

  function computeTarget() {
    if (!drag) return;
    const { slots, order, moving } = drag;
    // Titik tengah ghost dalam koordinat dokumen.
    const cx = drag.x - drag.offX + drag.w / 2 + scrollX;
    const cy = drag.y - drag.offY + drag.h / 2 + scrollY;

    // Slot terdekat; sumbu vertikal diberi bobot lebih supaya pindah baris terasa disengaja.
    let nearest = 0;
    let best = Infinity;
    slots.forEach((s, i) => {
      const dx = s.x + s.w / 2 - cx;
      const dy = (s.y + s.h / 2 - cy) * 1.4;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        nearest = i;
      }
    });

    const rest = order.filter((i) => !moving.includes(i));
    const target = Math.max(0, Math.min(rest.length, nearest - moving.indexOf(drag.grabbed)));
    if (target === drag.target) return;
    drag.target = target;
    drag.next = [...rest.slice(0, target), ...moving, ...rest.slice(target)];
    layout(drag, drag.next);
  }

  /** Geser setiap sel dari slot lamanya ke slot barunya (hanya transform). */
  function layout(d: NonNullable<typeof drag>, next: string[]) {
    next.forEach((id, i) => {
      const el = d.els.get(id);
      if (!el) return;
      const from = d.slots[d.home.get(id)!];
      const to = d.slots[i];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      el.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : "";
    });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  }

  function swallowClick() {
    const stop = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 60);
  }

  function detach() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("touchmove", preventTouch);
  }

  /** Animasikan ghost mendarat di slot ke-`index`, lalu bersihkan. */
  function land(d: NonNullable<typeof drag>, index: number, after: () => void | Promise<void>) {
    if (d.raf) cancelAnimationFrame(d.raf);
    const slot = d.slots[index];
    const ms = dur(LAND_MS);
    d.ghost.style.transition = `transform ${ms}ms ${EASE}`;
    d.inner.style.transition = `transform ${ms}ms ${EASE}`;
    d.ghost.style.transform = `translate(${slot.x - scrollX}px, ${slot.y - scrollY}px)`;
    d.inner.style.transform = "none";
    const done = async () => {
      await after();
      d.ghost.remove();
      for (const el of d.els.values()) el.classList.remove("sort-landing");
      document.documentElement.classList.remove("is-sorting");
      opts.onend?.();
    };
    if (ms) setTimeout(done, ms);
    else void done();
  }

  async function onUp() {
    if (!drag) return;
    const d = drag;
    drag = null;
    detach();
    swallowClick();

    const changed = d.next.some((id, i) => id !== d.order[i]);
    const landingIndex = d.next.indexOf(d.grabbed);
    for (const m of d.moving) d.els.get(m)?.classList.remove("sort-source");
    d.els.get(d.grabbed)?.classList.add("sort-landing");

    land(d, landingIndex, () => {
      d.els.get(d.grabbed)?.classList.remove("sort-landing");
    });

    if (changed) {
      await opts.onsort(d.moving, d.target);
      await tick();
      // DOM sudah berurutan baru: posisi nyata = posisi visual, lepas transform tanpa transisi.
      for (const el of d.els.values()) {
        el.style.transition = "none";
        el.style.transform = "";
      }
      void node.offsetWidth;
    }
    for (const el of d.els.values()) {
      el.style.transition = "";
      el.style.willChange = "";
      if (!changed) el.style.transform = "";
    }
  }

  function onCancel() {
    if (!drag) return;
    const d = drag;
    detach();
    // Semua kembali ke posisi awal.
    d.next = d.order;
    layout(d, d.order);
    for (const m of d.moving) d.els.get(m)?.classList.remove("sort-source");
    d.els.get(d.grabbed)?.classList.add("sort-landing");
    land(d, d.home.get(d.grabbed)!, () => {
      for (const el of d.els.values()) {
        el.style.transition = "";
        el.style.transform = "";
        el.style.willChange = "";
      }
    });
    drag = null;
    swallowClick();
  }

  // Gambar/teks bawaan browser tidak boleh memulai HTML5 drag.
  const onDragStart = (e: DragEvent) => e.preventDefault();

  node.addEventListener("pointerdown", onPointerDown);
  node.addEventListener("contextmenu", onContextMenu);
  node.addEventListener("dragstart", onDragStart);

  return {
    update(next: SortableOptions) {
      opts = next;
    },
    destroy() {
      clearPending();
      detach();
      if (drag) {
        drag.ghost.remove();
        document.documentElement.classList.remove("is-sorting");
        drag = null;
      }
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("contextmenu", onContextMenu);
      node.removeEventListener("dragstart", onDragStart);
    },
  };
}
