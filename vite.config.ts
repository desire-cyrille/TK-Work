import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // API Vercel en local : lancer `npx vercel dev` (port 3000 par défaut)
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      // Contourne CORS pour l’ajax INSEE (IRL) en développement
      "/proxy-insee": {
        target: "https://www.insee.fr",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-insee/, ""),
      },
    },
  },
});
