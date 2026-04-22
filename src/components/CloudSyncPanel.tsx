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
          <strong>Nuage unique pour l’organisation.</strong> Tous les utilisateurs
          partagent la même copie des données sur le serveur : biens, finances,
          Airbnb, thème, <strong>devis</strong>. La synchronisation s’authentifie avec{" "}
          <strong>votre compte personnel</strong>, mais envoie et récupère le
          même contenu pour tous. Dernière copie envoyée gagne (pas de fusion
          détaillée). En cas d’erreur de taille, réduisez la quantité de données
          ou utilisez une sauvegarde fichier.
        </p>
        <p className={styles.hint}>
          À la <strong>connexion</strong>, une récupération automatique est faite
          si le serveur contient des données. À la <strong>déconnexion</strong>,
          vos données locales sont envoyées vers le nuage (si la connexion
          réseau le permet).
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
