// Animasi muncul saat elemen masuk viewport (scroll reveal).
// Pakai: <div use:reveal> atau <div use:reveal={{ delay: 120, from: "left" }}>
export type RevealOptions = {
  delay?: number;
  from?: "up" | "down" | "left" | "right" | "zoom";
  once?: boolean;
};

let observer: IntersectionObserver | null = null;
const opts = new WeakMap<Element, RevealOptions>();

function getObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const o = opts.get(e.target) ?? {};
        if (e.isIntersecting) {
          e.target.classList.add("is-revealed");
          if (o.once !== false) observer!.unobserve(e.target);
        } else if (o.once === false) {
          e.target.classList.remove("is-revealed");
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );
  return observer;
}

export function reveal(node: HTMLElement, options: RevealOptions = {}) {
  const apply = (o: RevealOptions) => {
    opts.set(node, o);
    node.dataset.reveal = o.from ?? "up";
    node.style.setProperty("--reveal-delay", `${o.delay ?? 0}ms`);
  };
  apply(options);
  getObserver().observe(node);
  return {
    update: apply,
    destroy() {
      observer?.unobserve(node);
    },
  };
}
