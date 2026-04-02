import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspaceLock } from "../hooks/useWorkspaceLock";
import { LockBanner } from "./LockBanner";
import lockStyles from "./LockBanner.module.css";
import { Sidebar } from "./Sidebar";
import styles from "./Layout.module.css";

export function Layout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const biensLock = useWorkspaceLock(isAuthenticated ? "biens" : null);
  const reglagesBypass = location.pathname.endsWith("/reglages");
  const blockMain =
    isAuthenticated &&
    biensLock.ready &&
    !biensLock.canEdit &&
    !reglagesBypass;

  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        {blockMain && biensLock.lockedByLabel ? (
          <LockBanner
            message={`Gestion de biens en lecture seule : ${biensLock.lockedByLabel} est en train de modifier les données.`}
          />
        ) : null}
        <div className={styles.mainOutletWrap}>
          <Outlet />
          {blockMain ? (
            <div className={lockStyles.overlay} aria-hidden />
          ) : null}
        </div>
      </main>
    </div>
  );
}
