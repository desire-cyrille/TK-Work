import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useThemeSettings } from "../context/ThemeSettingsContext";
import { BrandTitle } from "./BrandTitle";
import { ProfileDialog } from "./ProfileDialog";
import styles from "./ModuleShell.module.css";

export function ModuleShell() {
  const { settings } = useThemeSettings();
  const { logout } = useAuth();
  const [profilOuvert, setProfilOuvert] = useState(false);

  return (
    <div className={styles.shell}>
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
            className={styles.profil}
            onClick={() => setProfilOuvert(true)}
          >
            Profil
          </button>
          <button type="button" className={styles.logout} onClick={logout}>
            Déconnexion
          </button>
        </div>
      </header>
      <ProfileDialog
        open={profilOuvert}
        onClose={() => setProfilOuvert(false)}
      />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
