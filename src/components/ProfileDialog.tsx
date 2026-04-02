import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import styles from "./ProfileDialog.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ProfileDialog({ open, onClose }: Props) {
  const { profileEmail, mustChangePassword, updatePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNew("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await updatePassword(
      currentPassword,
      newPassword,
      confirmNew,
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profil-titre"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id="profil-titre" className={styles.title}>
          Votre compte
        </h2>
        <p className={styles.subtitle}>
          Compte serveur : même identifiant que la connexion et la synchronisation
          (page Fonctions → Nuage). Les données métier sont partagées entre utilisateurs
          après synchro. L’e-mail n’est pas modifiable ici.
        </p>
        <p className={styles.emailLine}>
          <strong>E-mail :</strong> {profileEmail}
        </p>
        {mustChangePassword ? (
          <p className={styles.warn}>
            Mot de passe provisoire : définissez votre mot de passe personnel
            ci-dessous (le champ « actuel » n’apparaît pas dans ce cas).
          </p>
        ) : null}
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
          {mustChangePassword ? null : (
            <label className={styles.label}>
              <span>Mot de passe actuel</span>
              <input
                className={styles.input}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(ev) => setCurrentPassword(ev.target.value)}
              />
            </label>
          )}
          <label className={styles.label}>
            <span>Nouveau mot de passe (8 caractères min.)</span>
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(ev) => setNewPassword(ev.target.value)}
            />
          </label>
          <label className={styles.label}>
            <span>Confirmer le nouveau mot de passe</span>
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={confirmNew}
              onChange={(ev) => setConfirmNew(ev.target.value)}
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={busy}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={busy}
            >
              {busy ? "Enregistrement…" : "Mettre à jour le mot de passe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
