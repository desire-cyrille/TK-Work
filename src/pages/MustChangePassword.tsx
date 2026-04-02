import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./Connexion.module.css";

/**
 * Après un mot de passe provisoire défini par l’administrateur.
 */
export function MustChangePassword() {
  const { profileEmail, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    const res = await updatePassword("", newPassword, confirmNew);
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    navigate("/fonctions", { replace: true });
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <h1 className={styles.title}>Nouveau mot de passe obligatoire</h1>
        <p className={styles.hint}>
          Votre compte <strong>{profileEmail}</strong> utilise encore un mot de passe
          provisoire. Choisissez un mot de passe personnel (8 caractères minimum).
        </p>
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
          <label className={styles.label}>
            <span>Nouveau mot de passe</span>
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(ev) => setNewPassword(ev.target.value)}
            />
          </label>
          <label className={styles.label}>
            <span>Confirmer</span>
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={confirmNew}
              onChange={(ev) => setConfirmNew(ev.target.value)}
            />
          </label>
          {errorMsg ? <p className={styles.error}>{errorMsg}</p> : null}
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? "Enregistrement…" : "Enregistrer et continuer"}
          </button>
        </form>
      </div>
    </div>
  );
}
