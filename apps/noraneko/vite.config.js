import { defineConfig } from "vite";
import { resolve } from "node:path";
import { globSync } from "node:fs";

// /drops/ and /drops/<uuid>/ are written by scripts/drops.rb (from the registry's main). Run `npm run pull` first.
const pages = ["index.html", ...globSync("drops/**/index.html", { cwd: import.meta.dirname })];

export default defineConfig({
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p.replace(/\/?index\.html$/, "") || "main", resolve(import.meta.dirname, p)])),
    },
  },
});
