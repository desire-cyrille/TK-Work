import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  build: {
    /** Bundle principal ~1 Mo (jspdf, html2canvas) — évite le warning Vite en CI. */
    chunkSizeWarningLimit: 1100,
  },
  server: {
    proxy: {
      // API en local : `npm run dev:api` ou tout-en-un `npm run dev:full` (port 3000)
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
      /** Géocodage + itinéraire (dev sans `vercel dev`) — respecter l’usage raisonnable d’OSM. */
      "/geo/nominatim": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/geo\/nominatim/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("User-Agent", "TKProGestionDevis/1.0");
          });
        },
      },
      "/geo/osrm": {
        target: "https://router.project-osrm.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/geo\/osrm/, ""),
      },
    },
  },
});
