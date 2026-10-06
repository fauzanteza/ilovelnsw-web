// Pindahkan node ke <body> (modal/overlay), supaya tidak terpotong overflow/stacking induk.
export function portal(node: HTMLElement, target: HTMLElement | string = "body") {
  const host = typeof target === "string" ? document.querySelector<HTMLElement>(target)! : target;
  host.appendChild(node);
  return {
    destroy() {
      node.remove();
    },
  };
}
