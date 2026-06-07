import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em dev, o frontend roda no Vite (5173) e as chamadas /api são encaminhadas
// para o FastAPI (8000). Em produção o FastAPI serve o dist diretamente.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist",
  },
});
