import { NavLink } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import styles from "./PageFonctions.module.css";

const items = [
  {
    num: 1,
    title: "Gestion de biens",
    description:
      "Logements, bailleurs, locataires, locations, Airbnb et finances liées au patrimoine.",
    to: "/biens",
    cta: "Ouvrir le tableau de bord",
  },
  {
    num: 2,
    title: "Gestion des devis",
    description:
      "Préparation, suivi et validation des devis (module à compléter).",
    to: "/devis",
    cta: "Accéder aux devis",
  },
  {
    num: 3,
    title: "Rapport d’activité",
    description:
      "Rapports quotidiens, mensuels et fin de mission pour vos clients (synthèse + PDF).",
    to: "/rapport-activite",
    cta: "Ouvrir les rapports",
  },
] as const;

export function PageFonctions() {
  return (
    <PageFrame title="Fonctions">
      <div className={styles.page}>
        <p className={styles.subtitle}>
          Choisissez l’activité sur laquelle vous souhaitez travailler.
        </p>
        <p className={styles.independenceNote}>
          Chaque fonction est indépendante : les données de biens, devis et
          rapports ne sont pas reliées entre elles ; changez de fonction pour
          accéder à un autre périmètre.
        </p>
        <div className={styles.grid}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/biens"}
              className={styles.cardLink}
            >
              <span className={styles.cardNum}>{item.num}</span>
              <h2 className={styles.cardTitle}>{item.title}</h2>
              <p className={styles.cardDesc}>{item.description}</p>
              <span className={styles.cardCta}>{item.cta} →</span>
            </NavLink>
          ))}
        </div>
      </div>
    </PageFrame>
  );
}
