import { defineConfig } from "vite";
import { resolve } from "node:path";

// /drops/ と /drops/<uuid>/ は静的ではない: リクエストのときに src/worker.ts が
// dl から組む。ここが作るのは、その周りの静的な頁だけ。
export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, "index.html") },
    },
  },
});
