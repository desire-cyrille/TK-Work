import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./Connexion.module.css";

type Mode = "login" | "signup";

export function Connexion() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg("Renseignez l’e-mail et le mot de passe.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setErrorMsg("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setLoading(true);
    const res =
      mode === "signup"
        ? await signup(email.trim(), password)
        : await login(email.trim(), password);
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
        <h1 className={styles.title}>
          {mode === "login" ? "Connexion" : "Créer un compte"}
        </h1>
        <p className={styles.hint}>
          Chaque compte dispose de <strong>ses propres données</strong> sur le
          serveur (biens, finances, rapports, etc.). La même connexion sert à
          ouvrir l’application et à synchroniser entre vos appareils (Réglages
          → Nuage).
        </p>
        <div className={styles.modeRow}>
          <button
            type="button"
            className={
              mode === "login" ? styles.modeBtnActive : styles.modeBtn
            }
            onClick={() => {
              setMode("login");
              setErrorMsg(null);
            }}
          >
            J’ai un compte
          </button>
          <button
            type="button"
            className={
              mode === "signup" ? styles.modeBtnActive : styles.modeBtn
            }
            onClick={() => {
              setMode("signup");
              setErrorMsg(null);
            }}
          >
            Première utilisation
          </button>
        </div>
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
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
            <span>Mot de passe {mode === "signup" ? "(8 caractères min.)" : ""}</span>
            <input
              className={styles.input}
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </label>
          {errorMsg ? <p className={styles.error}>{errorMsg}</p> : null}
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading
              ? "Patientez…"
              : mode === "signup"
                ? "Créer le compte et se connecter"
                : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
