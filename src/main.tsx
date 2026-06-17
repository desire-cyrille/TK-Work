import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SentenceCapitalizeDom } from "./components/SentenceCapitalizeDom";
import { CloudAutoSync } from "./components/CloudAutoSync";
import { AutoBackupTwiceDaily } from "./components/AutoBackupTwiceDaily";
import { registerRapportImageCloudFlushListener } from "./lib/rapportActiviteImageDbCloud";
import { AuthProvider } from "./context/AuthContext";
import { BiensProvider } from "./context/BiensContext";
import { FinanceProvider } from "./context/FinanceContext";
import { ThemeSettingsProvider } from "./context/ThemeSettingsContext";
import {
  hydrateTkGestionOverflowFromIdb,
  installTkGestionStorageBridge,
} from "./lib/tkGestionStorageBridge";
import "./index.css";

registerRapportImageCloudFlushListener();

function renderApp() {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <SentenceCapitalizeDom />
        <AuthProvider>
          <CloudAutoSync />
          <AutoBackupTwiceDaily />
          <ThemeSettingsProvider>
            <BiensProvider>
              <FinanceProvider>
                <App />
              </FinanceProvider>
            </BiensProvider>
          </ThemeSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

async function boot() {
  try {
    installTkGestionStorageBridge();
    renderApp();
    void hydrateTkGestionOverflowFromIdb();
  } catch (e) {
    const rootEl = document.getElementById("root");
    const msg = e instanceof Error ? e.message : String(e);
    if (rootEl) {
      rootEl.innerHTML = `<div style="padding:2rem;font-family:sans-serif;max-width:32rem;margin:0 auto"><h1 style="color:#c2410c">Erreur au démarrage</h1><p>${msg}</p><p><a href="/connexion">Recharger la page de connexion</a></p></div>`;
    }
  }
}

void boot();
