import { useState } from "react";
import { Link } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import { useBiens } from "../context/BiensContext";
import { formatAdresseComplete } from "../lib/formatLogement";
import type { Logement } from "../types/domain";
import styles from "./Logements.module.css";

function CardMedia({
  imageUrl,
  titre,
}: {
  imageUrl: string;
  titre: string;
}) {
  const [showFallback, setShowFallback] = useState(
    () => !imageUrl.trim()
  );

  if (!imageUrl.trim() || showFallback) {
    return (
      <div className={styles.cardMediaPlaceholder} aria-hidden>
        <svg
          className={styles.cardMediaIcon}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 52V20l12-8 14 10 16-10v40H12z"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M22 32a4 4 0 108 0 4 4 0 00-8 0z"
            fill="currentColor"
            opacity="0.4"
          />
        </svg>
        <span className={styles.cardMediaHint}>Aucune image</span>
      </div>
    );
  }

  return (
    <img
      className={styles.cardImg}
      src={imageUrl}
      alt={titre}
      loading="lazy"
      onError={() => setShowFallback(true)}
    />
  );
}

function IconTrash() {
  return (
    <svg
      className={styles.trashIcon}
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type CardProps = {
  logement: Logement;
  bailleurNom: string;
  onDelete: (id: string) => void;
};

function LogementCard({ logement, bailleurNom, onDelete }: CardProps) {
  function handleDelete() {
    if (
      window.confirm(
        `Supprimer « ${logement.titre} » ? Cette action est définitive.`
      )
    ) {
      onDelete(logement.id);
    }
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardMedia}>
        <CardMedia
          imageUrl={logement.imageUrl}
          titre={logement.titre}
        />
      </div>
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>{logement.titre}</h2>
        <p className={styles.cardBailleur}>{bailleurNom}</p>
        <p className={styles.cardAddress}>{formatAdresseComplete(logement)}</p>
        <div className={styles.cardFooter}>
          <span
            className={
              logement.statut === "actif"
                ? styles.badgeActif
                : styles.badgeInactif
            }
          >
            {logement.statut === "actif" ? "actif" : "inactif"}
          </span>
          <div className={styles.cardActions}>
            <Link
              to={`/biens/logement/${logement.id}/modifier`}
              className={styles.btnEdit}
            >
              Modifier
            </Link>
            <button
              type="button"
              className={styles.btnDelete}
              onClick={handleDelete}
            >
              <IconTrash />
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function Logements() {
  const { logements, getBailleur, removeLogement } = useBiens();

  const sorted = [...logements].sort((a, b) =>
    a.titre.localeCompare(b.titre, "fr", { sensitivity: "base" })
  );

  return (
    <PageFrame
      title="Logements"
      actions={
        <Link to="/biens/logement/nouveau" className={frameStyles.headerCta}>
          <span className={frameStyles.headerCtaPlus} aria-hidden>
            +
          </span>
          Nouveau logement
        </Link>
      }
    >
      <div className={styles.pageInner}>
        {sorted.length === 0 ? (
          <p className={styles.empty}>
            Aucun logement enregistré. Créez d&apos;abord au moins un bailleur
            dans l&apos;onglet « Bailleur », puis cliquez sur « Nouveau
            logement ».
          </p>
        ) : (
          <div className={styles.grid}>
            {sorted.map((l) => (
              <LogementCard
                key={l.id}
                logement={l}
                bailleurNom={
                  getBailleur(l.bailleurId)?.nom ?? "Bailleur inconnu"
                }
                onDelete={removeLogement}
              />
            ))}
          </div>
        )}
      </div>
    </PageFrame>
  );
}
