import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./Connexion.module.css";

export function Connexion() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(false);
    if (!email.trim() || !password) {
      setError(true);
      return;
    }
    if (login(email, password)) {
      navigate("/fonctions", { replace: true });
      return;
    }
    setError(true);
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <h1 className={styles.title}>Connexion</h1>
        <p className={styles.hint}>
          Compte administrateur local unique. Première connexion par défaut :
          <strong> admin@local</strong> / <strong>admin</strong> (modifiable
          depuis le profil après connexion). Vous accéderez au choix de
          l&apos;activité.
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
            <span>Mot de passe</span>
            <input
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </label>
          {error ? (
            <p className={styles.error}>
              Renseignez l&apos;e-mail et le mot de passe, ou vérifiez qu’ils
              correspondent au profil enregistré sur cet appareil.
            </p>
          ) : null}
          <button type="submit" className={styles.submit}>
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
