import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      // Situs statis penuh: semua pemrosesan PDF terjadi di browser, tanpa server Node.
      adapter: adapter({ fallback: undefined }),
    }),
  ],
  worker: { format: "es" }, // worker pdf.js adalah modul ES
  optimizeDeps: { include: ["pdf-lib"] }, // pdf-lib CJS → di-prebundle
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
