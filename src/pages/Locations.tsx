import { useState } from "react";
import { PageFrame } from "../components/PageFrame";
import { CreerLocationDialog } from "../components/CreerLocationDialog";
import frameStyles from "../components/PageFrame.module.css";
import { useBiens } from "../context/BiensContext";
import { nomCompletLocataire } from "../lib/locataireUi";
import type { ContratLocation } from "../types/domain";
import styles from "./Locations.module.css";

const eur = (raw: string) => {
  const n = Number(raw.replace(",", ".").replace(/\s/g, ""));
  if (!Number.isFinite(n)) return raw || "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
};

function formatDate(iso: string) {
  if (!iso.trim()) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

export function Locations() {
  const {
    contratsLocation,
    getLogement,
    locataires,
    removeContratLocation,
  } = useBiens();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contratIdAEditer, setContratIdAEditer] = useState<string | null>(
    null
  );
  const [chainWizard, setChainWizard] = useState(false);

  function openCreerLocation() {
    setChainWizard(false);
    setContratIdAEditer(null);
    setDialogOpen(true);
  }

  function openCreerChaineLocation() {
    setChainWizard(true);
    setContratIdAEditer(null);
    setDialogOpen(true);
  }

  function openModifierLocation(id: string) {
    setChainWizard(false);
    setContratIdAEditer(id);
    setDialogOpen(true);
  }

  function closeLocationDialog() {
    setDialogOpen(false);
    setContratIdAEditer(null);
    setChainWizard(false);
  }

  const sorted = [...contratsLocation].sort((a, b) =>
    (a.dateDebut || "").localeCompare(b.dateDebut || "")
  );

  function handleDelete(c: ContratLocation) {
    const loc = locataires.find((l) => l.id === c.locataireId);
    const lib = loc ? nomCompletLocataire(loc) : "locataire inconnu";
    const bien = getLogement(c.logementId)?.titre ?? "bien inconnu";
    if (
      window.confirm(
        `Supprimer cette location ?\n\nBien : ${bien}\nOccupant au bail : ${lib}\n\nCette action est définitive.`
      )
    ) {
      removeContratLocation(c.id);
    }
  }

  return (
    <PageFrame
      title="Locations"
      actions={
        <>
          <button
            type="button"
            className={frameStyles.headerCtaSecondary}
            onClick={openCreerChaineLocation}
          >
            Créer une chaîne de location
          </button>
          <button
            type="button"
            className={frameStyles.headerCta}
            onClick={openCreerLocation}
          >
            <span className={frameStyles.headerCtaPlus} aria-hidden>
              +
            </span>
            Créer une location
          </button>
        </>
      }
    >
      <div className={styles.pageInner}>
        <p className={styles.intro}>
          Gère les baux depuis la boîte de dialogue (onglets bien, compléments,
          quittances, garants, assurances, documents — dont état des lieux à
          remplir ou référence de fichier). « Créer une chaîne de location » crée
          le bail principal puis la sous-location : à la fin de chaque étape, des
          PDF projet (bail + EDL) sont proposés au téléchargement. La paire est
          aussi enregistrée pour la vue groupée du menu <strong>Finance</strong>.
        </p>

        {sorted.length === 0 ? (
          <p className={styles.empty}>
            Aucune location enregistrée. Utilisez « Créer une location » ou «
            Créer une chaîne de location » pour ouvrir le formulaire par
            intercalaires.
          </p>
        ) : (
          <ul className={styles.list}>
            {sorted.map((c) => {
              const logement = getLogement(c.logementId);
              const loc = locataires.find((l) => l.id === c.locataireId);
              const sousBailleur = c.locataireSousBailleurId.trim()
                ? locataires.find((l) => l.id === c.locataireSousBailleurId)
                : undefined;
              const estSousLocation = Boolean(c.locataireSousBailleurId.trim());
              return (
                <li key={c.id} className={styles.card}>
                  <div className={styles.cardMain}>
                    <h2 className={styles.cardTitle}>
                      {logement?.titre ?? "Bien inconnu"}
                      {estSousLocation ? (
                        <span className={styles.badgeSousLoc}>
                          Sous-location
                        </span>
                      ) : null}
                    </h2>
                    {c.libelleExploitation.trim() ? (
                      <p className={styles.cardLibelle}>
                        Libellé d’exploitation :{" "}
                        <strong>{c.libelleExploitation.trim()}</strong>
                      </p>
                    ) : null}
                    {estSousLocation && sousBailleur ? (
                      <p className={styles.cardMeta}>
                        Sous-bailleur (locataire principal) :{" "}
                        <strong>{nomCompletLocataire(sousBailleur)}</strong>
                      </p>
                    ) : null}
                    <p className={styles.cardMeta}>
                      {estSousLocation ? "Sous-locataire" : "Locataire"} :{" "}
                      <strong>
                        {loc ? nomCompletLocataire(loc) : "—"}
                      </strong>
                    </p>
                    <p className={styles.cardMeta}>
                      Du {formatDate(c.dateDebut)}
                      {c.dateFin.trim()
                        ? ` au ${formatDate(c.dateFin)}`
                        : ""}
                      {c.loyerHc.trim()
                        ? ` · Loyer HC ${eur(c.loyerHc)}`
                        : null}
                    </p>
                    {c.numeroContratInterne.trim() ? (
                      <p className={styles.cardRef}>
                        Réf. {c.numeroContratInterne}
                      </p>
                    ) : null}
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.btnEdit}
                      onClick={() => openModifierLocation(c.id)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className={styles.btnDelete}
                      onClick={() => handleDelete(c)}
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CreerLocationDialog
        open={dialogOpen}
        onClose={closeLocationDialog}
        contratIdAEditer={contratIdAEditer}
        chainWizard={chainWizard}
      />
    </PageFrame>
  );
}
