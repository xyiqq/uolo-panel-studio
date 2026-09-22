import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFile } from 'node:fs/promises';

// Serve the built template without Vite injecting its development client.
const offlineTemplate = {
  name: 'offline-template',
  configureServer(server) {
    server.middlewares.use('/__offline-template', async (req, res) => {
      try {
        const html = await readFile(new URL('./dist/index.html', import.meta.url));
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(html);
      } catch {
        res.statusCode = 404;
        res.end('Run npm run build to create the offline template.');
      }
    });
  },
};

export default defineConfig({
  plugins: [offlineTemplate, viteSingleFile()],
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
