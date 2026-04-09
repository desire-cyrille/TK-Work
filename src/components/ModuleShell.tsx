import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ProofreadDialogProvider, useProofreadDialog } from "../context/ProofreadDialogContext";
import { useThemeSettings } from "../context/ThemeSettingsContext";
import { BrandTitle } from "./BrandTitle";
import { ProfileDialog } from "./ProfileDialog";
import styles from "./ModuleShell.module.css";

function ModuleShellHeader() {
  const { settings } = useThemeSettings();
  const { logout } = useAuth();
  const { openProofreadDialog } = useProofreadDialog();
  const [profilOuvert, setProfilOuvert] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <NavLink to="/fonctions" className={styles.back}>
          Changer de fonction
        </NavLink>
        <div className={styles.headerAside}>
          <div className={styles.brand}>
            <BrandTitle name={settings.brandName} variant="module" />
          </div>
          <button
            type="button"
            className={styles.proofread}
            onClick={openProofreadDialog}
          >
            Orthographe
          </button>
          <button
            type="button"
            className={styles.profil}
            onClick={() => setProfilOuvert(true)}
          >
            Profil
          </button>
          <button
            type="button"
            className={styles.logout}
            onClick={() => void logout()}
          >
            Déconnexion
          </button>
        </div>
      </header>
      <ProfileDialog
        open={profilOuvert}
        onClose={() => setProfilOuvert(false)}
      />
    </>
  );
}

export function ModuleShell() {
  return (
    <ProofreadDialogProvider>
      <div className={styles.shell}>
        <ModuleShellHeader />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </ProofreadDialogProvider>
  );
}
