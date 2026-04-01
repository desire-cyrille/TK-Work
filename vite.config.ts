import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Contourne CORS pour l’ajax INSEE (IRL) en développement
      "/proxy-insee": {
        target: "https://www.insee.fr",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-insee/, ""),
      },
    },
  },
});
