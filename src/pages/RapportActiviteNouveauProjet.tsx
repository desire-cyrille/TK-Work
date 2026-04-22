import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import { creerProjetRapportActivite } from "../lib/rapportActiviteStorage";
import styles from "./RapportActiviteAccueil.module.css";

export function RapportActiviteNouveauProjet() {
  const navigate = useNavigate();
  const [titre, setTitre] = useState("");
  const [siteNom, setSiteNom] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = titre.trim();
    if (!t) {
      window.alert("Indiquez un titre pour le projet.");
      return;
    }
    const sn = siteNom.trim();
    creerProjetRapportActivite({
      titre: t,
      sitesNoms: sn ? [sn] : undefined,
    });
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
          Donnez un titre au projet. Vous pouvez préciser le nom du premier site ;
          sinon un site « Site principal » sera créé automatiquement.
        </p>
        <form
          onSubmit={onSubmit}
          className={styles.section}
          style={{ maxWidth: "28rem" }}
        >
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Titre du projet *</span>
            <input
              className={styles.textInput}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex. : Mission parking centre-ville"
              autoFocus
            />
          </label>
          <label className={styles.fieldBlock}>
            <span className={styles.fieldLabel}>Premier site (optionnel)</span>
            <input
              className={styles.textInput}
              value={siteNom}
              onChange={(e) => setSiteNom(e.target.value)}
              placeholder="Ex. : Zone nord"
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
