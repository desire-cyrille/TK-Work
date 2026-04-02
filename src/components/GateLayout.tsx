import { useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useThemeSettings } from "../context/ThemeSettingsContext";
import { BrandTitle } from "./BrandTitle";
import { ProfileDialog } from "./ProfileDialog";
import styles from "./GateLayout.module.css";

type Props = {
  children: ReactNode;
};

export function GateLayout({ children }: Props) {
  const { logout } = useAuth();
  const { settings } = useThemeSettings();
  const [profilOuvert, setProfilOuvert] = useState(false);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <BrandTitle name={settings.brandName} variant="gate" />
        </div>
        <div className={styles.headerAside}>
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
      <div className={styles.body}>{children}</div>
    </div>
  );
}
