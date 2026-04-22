import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import { creerProjetRapportActivite } from "../lib/rapportActiviteStorage";
import styles from "./RapportActiviteAccueil.module.css";

export function RapportActiviteNouveauProjet() {
  const navigate = useNavigate();
  const [titre, setTitre] = useState("");
  const [nombreSites, setNombreSites] = useState("1");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = titre.trim();
    if (!t) {
      window.alert("Indiquez le nom du projet.");
      return;
    }
    const n = Number.parseInt(nombreSites, 10);
    if (!Number.isFinite(n) || n < 1 || n > 50) {
      window.alert("Le nombre de sites doit être compris entre 1 et 50.");
      return;
    }
    creerProjetRapportActivite({ titre: t, nombreSites: n });
    navigate("/rapport-activite/accueil", { replace: true });
  }

  return (
    <PageFrame
      title="Nouveau projet"
      actions={
        <button
          type="button"
          className={frameStyles.headerCtaSecondary}
          onClick={() => navigate("/rapport-activite/accueil")}
        >
          Annuler
        </button>
      }
    >
      <div className={styles.page}>
        <p className={styles.intro}>
          Indiquez le <strong>nom du projet</strong> et le <strong>nombre de sites</strong> à
          gérer. Les sites seront nommés « Site 1 », « Site 2 », etc. (modifiables plus tard
          dans la rédaction si besoin).
        </p>
        <form
          onSubmit={onSubmit}
          className={styles.section}
          style={{ maxWidth: "28rem" }}
        >
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Nom du projet *</span>
            <input
              className={styles.textInput}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex. : Mission parking centre-ville"
              autoFocus
            />
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Nombre de sites à gérer *</span>
            <input
              className={styles.textInput}
              type="number"
              min={1}
              max={50}
              value={nombreSites}
              onChange={(e) => setNombreSites(e.target.value)}
            />
          </label>
          <div className={styles.ctaRow} style={{ marginTop: "0.25rem" }}>
            <button type="submit" className={styles.btnPrimary}>
              Créer le projet
            </button>
          </div>
        </form>
      </div>
    </PageFrame>
  );
}
