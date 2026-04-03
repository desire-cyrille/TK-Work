import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspaceLock } from "../hooks/useWorkspaceLock";
import { LockBanner } from "./LockBanner";
import lockStyles from "./LockBanner.module.css";

type Props = {
  /** ex. biens:immobilier — doit correspondre à api/_lib/workspaceLocks BIENS_LOCK_SECTIONS */
  resourceKey: string;
  /** Libellé affiché dans le bandeau (Immobilier, Airbnb, Réglages) */
  sectionLabel: string;
};

export function BiensSectionLockLayout({ resourceKey, sectionLabel }: Props) {
  const { isAuthenticated } = useAuth();
  const lock = useWorkspaceLock(isAuthenticated ? resourceKey : null);
  const block =
    isAuthenticated && lock.ready && !lock.canEdit && Boolean(lock.lockedByLabel);

  return (
    <div className={lockStyles.wrap}>
      {block && lock.lockedByLabel ? (
        <LockBanner
          message={`Onglet « ${sectionLabel} » en lecture seule : ${lock.lockedByLabel} modifie cette section.`}
        />
      ) : null}
      <div className={lockStyles.body}>
        <Outlet />
        {block ? <div className={lockStyles.overlay} aria-hidden /> : null}
      </div>
    </div>
  );
}
