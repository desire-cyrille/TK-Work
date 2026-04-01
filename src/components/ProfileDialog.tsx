import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import styles from "./ProfileDialog.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ProfileDialog({ open, onClose }: Props) {
  const { profileEmail, updateProfileCredentials } = useAuth();
  const [email, setEmail] = useState(profileEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(profileEmail);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNew("");
      setError(null);
    }
  }, [open, profileEmail]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = updateProfileCredentials(
      email,
      currentPassword,
      newPassword,
      confirmNew,
    );
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
          Profil administrateur
        </h2>
        <p className={styles.subtitle}>
          Compte unique (application locale). Modifiez l’e-mail et, si vous le
          souhaitez, le mot de passe.
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label}>
            <span>E-mail</span>
            <input
              className={styles.input}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </label>
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
          <label className={styles.label}>
            <span>Nouveau mot de passe (optionnel)</span>
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
            >
              Annuler
            </button>
            <button type="submit" className={styles.btnPrimary}>
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
