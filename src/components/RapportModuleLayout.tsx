import { NavLink, Outlet } from "react-router-dom";
import styles from "./RapportModuleLayout.module.css";

const tabs = [
  { to: "/rapport-activite/accueil", label: "Accueil", end: false },
  { to: "/rapport-activite/projets", label: "Projets", end: false },
  { to: "/rapport-activite/archive", label: "Archive", end: false },
] as const;

export function RapportModuleLayout() {
  return (
    <div className={styles.wrap}>
      <nav className={styles.tabs} aria-label="Sections Rapport">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `${styles.tab} ${isActive ? styles.tabActive : ""}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.outlet}>
        <Outlet />
      </div>
    </div>
  );
}
