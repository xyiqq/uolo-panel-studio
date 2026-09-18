import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    target: "es2022",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js", "tests/**/*.test.ts"],
  },
});
