import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleApi } from "./server/api.mjs";

function editorApi() {
  const attach = (server) => {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/")) {
        next();
        return;
      }
      try {
        const handled = await handleApi(req, res);
        if (!handled) next();
      } catch (error) {
        next(error);
      }
    });
  };
  return {
    name: "nigora-editor",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  base: "/nigora_website/",
  plugins: [react(), editorApi()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
  },
});
