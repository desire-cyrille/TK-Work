import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  hardNavigateToFonctionsAfterCloudPull,
  syncCloudPullAfterLogin,
} from "../lib/cloudSync";
import { decodeAuthTokenClaims, getAuthToken } from "../lib/authToken";
import styles from "./Connexion.module.css";

type Mode = "login" | "signup";

export function Connexion() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("login");
  const [publicSignup, setPublicSignup] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/auth/capabilities", { cache: "no-store" });
        const data = (await r.json().catch(() => ({}))) as {
          publicSignup?: boolean;
        };
        if (!cancelled && r.ok && typeof data.publicSignup === "boolean") {
          setPublicSignup(data.publicSignup);
          if (!data.publicSignup) setMode("login");
        }
      } catch {
        /* serveur local sans API : garder l’UI par défaut */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!res.ok) {
      setLoading(false);
      setErrorMsg(res.error);
      return;
    }
    const tok = getAuthToken();
    const must =
      tok && decodeAuthTokenClaims(tok)?.mustChangePassword === true;
    if (must) {
      setLoading(false);
      navigate("/changement-mot-de-passe", { replace: true });
      return;
    }
    const sync = await syncCloudPullAfterLogin();
    setLoading(false);
    if (sync.pullError || sync.applyError) {
      console.warn("Nuage après connexion :", sync.pullError ?? sync.applyError);
    }
    if (sync.shouldHardNavigate) {
      hardNavigateToFonctionsAfterCloudPull();
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
          Chaque personne a <strong>ses identifiants</strong> ; les données
          métier (biens, devis, rapports d’activité) sont <strong>communes</strong> sur le
          serveur : une récupération depuis le nuage est tentée à chaque connexion ;
          les réglages manuels sont sur la page <strong>Fonctions</strong> (section
          Nuage).
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
          {publicSignup ? (
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
          ) : null}
        </div>
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
          <label className={styles.label}>
            <span>E-mail</span>
            <input
              className={styles.input}
              type="text"
              inputMode="email"
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
              ? "Synchronisation…"
              : mode === "signup"
                ? "Créer le compte et se connecter"
                : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
