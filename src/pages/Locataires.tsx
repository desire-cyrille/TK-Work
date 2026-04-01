import { Link } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import { useBiens } from "../context/BiensContext";
import {
  libelleBiensLocataire,
  libelleRolesLocataire,
  ligneRepresentantLocataire,
  nomCompletLocataire,
  varianteBadgeRolesLocataire,
} from "../lib/locataireUi";
import {
  categorieLocataireSurLogement,
  type CategorieLocataire,
  type Locataire,
} from "../types/domain";
import styles from "./Locataires.module.css";

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

function sortLocataires(list: Locataire[]) {
  return [...list].sort((a, b) =>
    nomCompletLocataire(a).localeCompare(nomCompletLocataire(b), "fr", {
      sensitivity: "base",
    })
  );
}

type CardProps = {
  locataire: Locataire;
  logementTitre: string;
  onDelete: (id: string) => void;
};

function LocataireCard({ locataire, logementTitre, onDelete }: CardProps) {
  function handleDelete() {
    if (
      window.confirm(
        `Supprimer la fiche de « ${nomCompletLocataire(locataire)} » ?`
      )
    ) {
      onDelete(locataire.id);
    }
  }

  const contact = [locataire.email, locataire.telephone]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ") || "—";

  const representant = ligneRepresentantLocataire(locataire);
  const badgeRole = varianteBadgeRolesLocataire(locataire);

  return (
    <article className={styles.card}>
      <div className={styles.cardMain}>
        <div className={styles.nameRow}>
          <h2 className={styles.name}>{nomCompletLocataire(locataire)}</h2>
          {locataire.typeOccupant === "personne_morale" ? (
            <span className={`${styles.badge} ${styles.badgeSociete}`}>
              Société
            </span>
          ) : null}
          <span
            className={
              badgeRole === "sous-locataire"
                ? `${styles.badge} ${styles.badgeSous}`
                : badgeRole === "mixte"
                  ? `${styles.badge} ${styles.badgeMixte}`
                  : styles.badge
            }
          >
            {libelleRolesLocataire(locataire)}
          </span>
        </div>
        {representant ? (
          <p className={styles.representantLine}>
            Représentant / contact : {representant}
          </p>
        ) : null}
        <p className={styles.meta}>{contact}</p>
        <p className={styles.logementLine}>
          Biens :{" "}
          <span className={styles.logementStrong}>{logementTitre}</span>
        </p>
      </div>
      <div className={styles.actions}>
        <Link
          to={`/biens/locataire/${locataire.id}/modifier`}
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
    </article>
  );
}

function SectionListe({
  titre,
  categorie,
  locataires,
  getLogement,
  onDelete,
}: {
  titre: string;
  categorie: CategorieLocataire;
  locataires: Locataire[];
  getLogement: (id: string) => { titre: string } | undefined;
  onDelete: (id: string) => void;
}) {
  const subset = locataires.filter((l) => {
    if (!l.logementsAssociesIds.length) return l.categorie === categorie;
    return l.logementsAssociesIds.some(
      (id) => categorieLocataireSurLogement(l, id) === categorie
    );
  });
  const sorted = sortLocataires(subset);

  return (
    <section className={styles.section} aria-labelledby={`sec-${categorie}`}>
      <h2 className={styles.sectionTitle} id={`sec-${categorie}`}>
        {titre}
        <span className={styles.count}>({sorted.length})</span>
      </h2>
      {sorted.length === 0 ? (
        <p className={styles.emptySection}>Aucune fiche dans cette catégorie.</p>
      ) : (
        <div className={styles.list}>
          {sorted.map((l) => (
            <LocataireCard
              key={l.id}
              locataire={l}
              logementTitre={libelleBiensLocataire(l, getLogement)}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function Locataires() {
  const { locataires, getLogement, removeLocataire } = useBiens();

  return (
    <PageFrame
      title="Locataires"
      actions={
        <Link to="/biens/locataire/nouveau" className={frameStyles.headerCta}>
          <span className={frameStyles.headerCtaPlus} aria-hidden>
            +
          </span>
          Nouveau locataire
        </Link>
      }
    >
      <div className={styles.pageInner}>
        <p className={styles.intro}>
          Liste des occupants : une même fiche peut être liée à plusieurs
          biens, avec un rôle locataire ou sous-locataire propre à chaque bien.
        </p>

        {locataires.length === 0 ? (
          <>
            <p className={styles.pageEmpty}>
              Aucun locataire enregistré. Créez une fiche pour suivre les
              occupants et leurs coordonnées.
            </p>
            <div className={styles.emptyCta}>
              <Link to="/biens/locataire/nouveau" className={frameStyles.headerCta}>
                <span className={frameStyles.headerCtaPlus} aria-hidden>
                  +
                </span>
                Nouveau locataire
              </Link>
            </div>
          </>
        ) : (
          <>
            <SectionListe
              titre="Locataires"
              categorie="locataire"
              locataires={locataires}
              getLogement={getLogement}
              onDelete={removeLocataire}
            />
            <SectionListe
              titre="Sous-locataires"
              categorie="sous-locataire"
              locataires={locataires}
              getLogement={getLogement}
              onDelete={removeLocataire}
            />
          </>
        )}
      </div>
    </PageFrame>
  );
}
