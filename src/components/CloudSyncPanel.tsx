import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { applyCloudPullEntries, cloudPull, cloudPush } from "../lib/cloudSync";
import styles from "./CloudSyncPanel.module.css";

export function CloudSyncPanel() {
  const { isAuthenticated, profileEmail } = useAuth();
  const [busy, setBusy] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  async function onPull() {
    setCloudMsg(null);
    setBusy(true);
    const r = await cloudPull();
    setBusy(false);
    if (!r.ok) {
      setCloudMsg({ type: "err", text: r.error });
      return;
    }
    if (r.version === 0 || Object.keys(r.entries).length === 0) {
      setCloudMsg({
        type: "ok",
        text: "Aucune donnée sur le serveur pour ce compte — utilisez « Envoyer » depuis un appareil à jour.",
      });
      return;
    }
    if (
      !window.confirm(
        "Remplacer toutes les données TK Gestion sur CET appareil par la copie du serveur ? Vous restez connecté avec le même compte.",
      )
    ) {
      return;
    }
    const applied = applyCloudPullEntries(r.entries);
    if (!applied.ok) {
      setCloudMsg({ type: "err", text: applied.error });
      return;
    }
    window.location.reload();
  }

  async function onPush() {
    setCloudMsg(null);
    setBusy(true);
    const r = await cloudPush();
    setBusy(false);
    if (!r.ok) {
      setCloudMsg({ type: "err", text: r.error });
      return;
    }
    setCloudMsg({
      type: "ok",
      text: "Copie enregistrée sur le nuage partagé. Sur un autre appareil, tout compte peut « Récupérer » pour aligner les données.",
    });
  }

  return (
    <div className={styles.form}>
      {cloudMsg ? (
        <p
          className={
            cloudMsg.type === "err"
              ? styles.backupBannerErr
              : styles.backupBannerOk
          }
          role="status"
        >
          {cloudMsg.text}
        </p>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Synchronisation entre appareils</h2>
        <p className={styles.hint}>
          <strong>Le serveur est la référence.</strong> Biens, finances, Airbnb,
          thème, devis et rapports sont stockés sur le nuage partagé de
          l’organisation. À la <strong>connexion</strong> et à chaque ouverture
          de l’application (connecté), vos données sont <strong>téléchargées
          automatiquement</strong> si le serveur est plus récent. Chaque
          modification est <strong>envoyée automatiquement</strong> (quelques
          secondes après la saisie) ; à la <strong>déconnexion</strong>, un envoi
          final est aussi tenté.
        </p>
        <p className={styles.hint}>
          Le navigateur garde une copie locale pour travailler hors ligne, mais
          vous n’avez plus besoin d’exporter ou de « Récupérer » au quotidien.
          Les boutons ci-dessous servent en secours (autre appareil, dépannage).
        </p>
        {!isAuthenticated ? (
          <p className={styles.backupBannerErr} role="status">
            Connectez-vous depuis la page <strong>Connexion</strong> pour accéder
            à l’envoi et à la récupération manuels sur le serveur.
          </p>
        ) : (
          <>
            <p className={styles.hint}>
              Compte actuel : <strong>{profileEmail}</strong>
            </p>
            <div className={styles.cloudActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy}
                onClick={() => void onPush()}
              >
                Envoyer vers le serveur (données locales → nuage)
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busy}
                onClick={() => void onPull()}
              >
                Récupérer depuis le serveur (nuage → cet appareil)
              </button>
            </div>
            <p className={styles.hint} style={{ marginTop: "0.75rem" }}>
              Pour vous connecter avec un <strong>autre compte</strong>,
              déconnectez-vous via le menu, puis ouvrez à nouveau la page de
              connexion.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
