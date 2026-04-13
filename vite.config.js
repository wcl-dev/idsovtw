import { defineConfig } from "vite";
import { resolve } from "node:path";
import { viteSingleFile } from "vite-plugin-singlefile";

// 前端位於 site/；build 產物輸出至 dist/
// 使用 vite-plugin-singlefile 把 CSS 與 JS 內嵌進單一 HTML
// 資料以 ES module import 進 bundle，避免 file:// 下的 CORS 限制
export default defineConfig({
  root: "site",
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000, // 全部資源內嵌
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
