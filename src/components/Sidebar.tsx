import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useThemeSettings } from "../context/ThemeSettingsContext";
import { ProfileDialog } from "./ProfileDialog";
import styles from "./Sidebar.module.css";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.navBtn} ${styles.navBtnActive}` : styles.navBtn;

export function Sidebar() {
  const { settings } = useThemeSettings();
  const { logout } = useAuth();
  const [profilOuvert, setProfilOuvert] = useState(false);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.topActions}>
        <NavLink to="/fonctions" className={styles.changerFonction}>
          Changer de fonction
        </NavLink>
        <button
          type="button"
          className={styles.profilBtn}
          onClick={() => setProfilOuvert(true)}
        >
          Profil
        </button>
      </div>
      <ProfileDialog
        open={profilOuvert}
        onClose={() => setProfilOuvert(false)}
      />

      <div className={styles.brand}>{settings.brandName || "TK Pro Gestion"}</div>
      <nav className={styles.nav}>
        <NavLink to="/biens" end className={navClass}>
          Page d&apos;accueil
        </NavLink>

        <NavLink to="/biens/logement" className={navClass}>
          Logement
        </NavLink>

        <NavLink to="/biens/bailleur" className={navClass}>
          Bailleur
        </NavLink>
        <NavLink to="/biens/locataire" className={navClass}>
          Locataire
        </NavLink>
        <NavLink to="/biens/location" className={navClass}>
          Location
        </NavLink>
        <NavLink to="/biens/airbnb" className={navClass}>
          Airbnb
        </NavLink>
        <NavLink to="/biens/finance" className={navClass}>
          Finance
        </NavLink>
        <NavLink to="/biens/reglages" className={navClass}>
          Réglages
        </NavLink>
      </nav>
      <div className={styles.footer}>
        <button type="button" className={styles.logout} onClick={logout}>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
