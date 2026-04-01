import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { BiensProvider } from "./context/BiensContext";
import { FinanceProvider } from "./context/FinanceContext";
import { ThemeSettingsProvider } from "./context/ThemeSettingsContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeSettingsProvider>
          <BiensProvider>
            <FinanceProvider>
              <App />
            </FinanceProvider>
          </BiensProvider>
        </ThemeSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
