import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProofreadDialog } from "../context/ProofreadDialogContext";
import { useThemeSettings } from "../context/ThemeSettingsContext";
import { BrandTitle } from "./BrandTitle";
import { ProfileDialog } from "./ProfileDialog";
import styles from "./Sidebar.module.css";

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.navBtn} ${styles.navBtnActive}` : styles.navBtn;

const navSubClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? `${styles.navBtnSub} ${styles.navBtnSubActive}`
    : styles.navBtnSub;

const IMMOBILIER_PREFIXES = [
  "/biens/logement",
  "/biens/bailleur",
  "/biens/locataire",
  "/biens/location",
  "/biens/finance",
] as const;

function estCheminImmobilier(pathname: string) {
  return IMMOBILIER_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function Sidebar() {
  const location = useLocation();
  const { settings } = useThemeSettings();
  const { logout } = useAuth();
  const { openProofreadDialog } = useProofreadDialog();
  const [profilOuvert, setProfilOuvert] = useState(false);
  const immobilierActif = estCheminImmobilier(location.pathname);
  const [immobilierOuvert, setImmobilierOuvert] = useState(immobilierActif);

  useEffect(() => {
    if (immobilierActif) setImmobilierOuvert(true);
  }, [immobilierActif]);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.topActions}>
        <NavLink to="/fonctions" className={styles.changerFonction}>
          Changer de fonction
        </NavLink>
        <button
          type="button"
          className={styles.proofreadBtn}
          onClick={openProofreadDialog}
        >
          Orthographe & grammaire
        </button>
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

      <div className={styles.brand}>
        <BrandTitle name={settings.brandName} variant="sidebar" />
      </div>
      <nav className={styles.nav}>
        <NavLink to="/biens" end className={navClass}>
          Page d&apos;accueil
        </NavLink>

        <div className={styles.navGroup}>
          <button
            type="button"
            className={[
              styles.navGroupToggle,
              immobilierOuvert ? styles.navGroupToggleOpen : "",
              immobilierActif ? styles.navGroupToggleActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-expanded={immobilierOuvert}
            aria-controls="sidebar-immobilier-sous-menu"
            id="sidebar-immobilier-toggle"
            onClick={() => setImmobilierOuvert((o) => !o)}
          >
            <span>Immobilier</span>
            <svg
              className={[
                styles.navGroupChevron,
                immobilierOuvert ? styles.navGroupChevronExpanded : "",
              ]
                .filter(Boolean)
                .join(" ")}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          {immobilierOuvert ? (
            <div
              id="sidebar-immobilier-sous-menu"
              role="group"
              aria-labelledby="sidebar-immobilier-toggle"
              className={styles.navSubList}
            >
              <NavLink to="/biens/logement" className={navSubClass}>
                Logement
              </NavLink>
              <NavLink to="/biens/bailleur" className={navSubClass}>
                Bailleur
              </NavLink>
              <NavLink to="/biens/locataire" className={navSubClass}>
                Locataire
              </NavLink>
              <NavLink to="/biens/location" className={navSubClass}>
                Location
              </NavLink>
              <NavLink to="/biens/finance" className={navSubClass}>
                Finance
              </NavLink>
            </div>
          ) : null}
        </div>

        <NavLink to="/biens/airbnb" className={navClass}>
          Airbnb
        </NavLink>
        <NavLink to="/biens/reglages" className={navClass}>
          Réglages
        </NavLink>
      </nav>
      <div className={styles.footer}>
          <button
            type="button"
            className={styles.logout}
            onClick={() => void logout()}
          >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
