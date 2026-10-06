// Efek riak (ripple) saat diklik/ditekan, dipasang global sekali di layout.
// Berlaku untuk .btn, .tool-card, .icon-btn, dan elemen ber-atribut [data-ripple].
const SELECTOR = ".btn, .tool-card, .icon-btn, [data-ripple]";

export function installRipple(root: HTMLElement | Document = document) {
  function onDown(ev: Event) {
    const e = ev as PointerEvent;
    if (e.button !== 0) return;
    const target = (e.target as Element | null)?.closest<HTMLElement>(SELECTOR);
    if (!target || (target as HTMLButtonElement).disabled) return;

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const dot = document.createElement("span");
    dot.className = "ripple-dot";
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${e.clientX - rect.left - size / 2}px`;
    dot.style.top = `${e.clientY - rect.top - size / 2}px`;
    if (getComputedStyle(target).position === "static") target.style.position = "relative";
    target.classList.add("has-ripple");
    target.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove(), { once: true });
  }
  root.addEventListener("pointerdown", onDown, { passive: true });
  return () => root.removeEventListener("pointerdown", onDown);
}
