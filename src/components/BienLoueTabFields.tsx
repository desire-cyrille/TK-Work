import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type {
  ContratLocation,
  LigneAutrePaiement,
  TypeBailLocation,
} from "../types/domain";
import { PERIODICITES_LOYER, TYPES_BAIL_LOCATION } from "../types/domain";
import type { PeriodiciteLoyer } from "../types/domain";
import type { Logement } from "../types/domain";
import type { Locataire } from "../types/domain";
import {
  fetchLatestIrlObservation,
  formatTrimestreIrl,
  formatValeurIrlFr,
} from "../lib/irlInsee";
import { nomCompletLocataire } from "../lib/locataireUi";
import { parseEuro } from "../lib/money";
import { ratioProrataTemporisMoisCivils } from "../lib/prorataLoyer";
import formStyles from "../pages/NouveauLogement.module.css";
import styles from "./CreerLocationDialog.module.css";

const LIBELLE_TYPE_BAIL: Record<Exclude<TypeBailLocation, "">, string> = {
  bail_habitation_vide: "Bail d'habitation vide",
  bail_habitation_meuble: "Bail d'habitation meublé",
  bail_mobilite: "Bail mobilité",
  bail_commercial: "Bail commercial",
  bail_professionnel: "Bail professionnel",
  bail_saisonnier: "Bail saisonnier",
  bail_mixte: "Bail mixte",
  autre: "Autre",
};

const JOURS_MOIS = Array.from({ length: 31 }, (_, i) => String(i + 1));

export type BienLoueContext =
  | "standard"
  | "chaine_bail_principal"
  | "chaine_sous_location";

type Props = {
  draft: Omit<ContratLocation, "id">;
  set: <K extends keyof Omit<ContratLocation, "id">>(
    key: K,
    value: Omit<ContratLocation, "id">[K]
  ) => void;
  setDraft: Dispatch<SetStateAction<Omit<ContratLocation, "id">>>;
  fs: typeof formStyles;
  logementsSorted: Logement[];
  locatairesPourBien: Locataire[];
  /** Assistant chaîne de locations — adapte libellés et champs */
  bienLoueContext?: BienLoueContext;
  /** Affiché en sous-location : nom du locataire principal (sous-bailleur) */
  chaineSousBailleurNom?: string;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className={styles.bienSectionTitle}>{children}</h3>;
}

export function BienLoueTabFields({
  draft,
  set,
  setDraft,
  fs,
  logementsSorted,
  locatairesPourBien,
  bienLoueContext = "standard",
  chaineSousBailleurNom = "",
}: Props) {
  const logementVerrouille =
    bienLoueContext === "chaine_bail_principal" ||
    bienLoueContext === "chaine_sous_location";
  const estSousLocation = bienLoueContext === "chaine_sous_location";
  const [irlLoading, setIrlLoading] = useState(false);
  const [irlFeedback, setIrlFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  async function handleActualiserIrl() {
    setIrlLoading(true);
    setIrlFeedback(null);
    try {
      const latest = await fetchLatestIrlObservation();
      if (!latest) {
        setIrlFeedback({
          type: "err",
          text:
            "Données IRL indisponibles. Développement : lancez « npm run dev » (proxy INSEE). Build : exécutez « npm run update-irl » puis reconstruisez, ou saisissez la valeur manuellement.",
        });
        return;
      }
      set("modeRevisionLoyer", "irl");
      set("indiceRevisionLibelle", "IRL");
      set(
        "trimestreIndiceRevision",
        formatTrimestreIrl(latest.year, latest.quarter)
      );
      set("valeurIndiceRevision", formatValeurIrlFr(latest.value));
      const src =
        latest.source === "insee"
          ? "INSEE (données en direct)"
          : "fichier public/data/irl-latest.json";
      setIrlFeedback({
        type: "ok",
        text: `IRL mis à jour : ${formatTrimestreIrl(latest.year, latest.quarter)}, valeur ${formatValeurIrlFr(latest.value)} (${src}).`,
      });
    } catch {
      setIrlFeedback({
        type: "err",
        text: "Erreur lors de la récupération de l’indice.",
      });
    } finally {
      setIrlLoading(false);
    }
  }

  const dureeCalculee = useMemo(() => {
    if (!draft.dateDebut?.trim() || !draft.dateFin?.trim()) return "";
    const a = new Date(draft.dateDebut + "T12:00:00");
    const b = new Date(draft.dateFin + "T12:00:00");
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a)
      return "";
    let months =
      (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) months -= 1;
    return months >= 0 ? String(months) : "";
  }, [draft.dateDebut, draft.dateFin]);

  function addAutrePaiement() {
    setDraft((d) => ({
      ...d,
      autresPaiements: [
        ...d.autresPaiements,
        {
          id: crypto.randomUUID(),
          montant: "",
          tva: "",
          categorie: "Charges locatives",
          description: "",
        },
      ],
    }));
  }

  function removeAutrePaiement(id: string) {
    setDraft((d) => ({
      ...d,
      autresPaiements: d.autresPaiements.filter((r) => r.id !== id),
    }));
  }

  function patchAutrePaiement(
    id: string,
    patch: Partial<
      Pick<LigneAutrePaiement, "montant" | "tva" | "categorie" | "description">
    >
  ) {
    setDraft((d) => ({
      ...d,
      autresPaiements: d.autresPaiements.map((row) =>
        row.id === id ? { ...row, ...patch } : row
      ),
    }));
  }

  function calculerProrata() {
    const debut = draft.dateDebut?.trim() ?? "";
    const fin = draft.dateFinPeriodePremiereQuittance?.trim() ?? "";
    if (!debut || !fin) return;

    const ratio = ratioProrataTemporisMoisCivils(debut, fin);
    if (ratio === null) return;

    const hc = parseEuro(draft.loyerHc);
    const ch = parseEuro(draft.charges);
    const hcCalc = hc > 0 ? (hc * ratio).toFixed(2) : "";
    const chCalc = ch > 0 ? (ch * ratio).toFixed(2) : "";
    setDraft((d) => ({
      ...d,
      premierLoyerHcCalcule: hcCalc,
      premierLoyerChargesCalcule: chCalc,
    }));
  }

  useEffect(() => {
    if (draft.premierLoyerProrata !== "oui") return;
    const debut = draft.dateDebut?.trim() ?? "";
    const fin = draft.dateFinPeriodePremiereQuittance?.trim() ?? "";
    if (!debut || !fin) return;
    const ratio = ratioProrataTemporisMoisCivils(debut, fin);
    if (ratio === null) return;
    const hc = parseEuro(draft.loyerHc);
    const ch = parseEuro(draft.charges);
    const hcCalc = hc > 0 ? (hc * ratio).toFixed(2) : "";
    const chCalc = ch > 0 ? (ch * ratio).toFixed(2) : "";
    setDraft((d) => {
      if (
        d.premierLoyerHcCalcule === hcCalc &&
        d.premierLoyerChargesCalcule === chCalc
      ) {
        return d;
      }
      return {
        ...d,
        premierLoyerHcCalcule: hcCalc,
        premierLoyerChargesCalcule: chCalc,
      };
    });
  }, [
    draft.premierLoyerProrata,
    draft.dateDebut,
    draft.dateFinPeriodePremiereQuittance,
    draft.loyerHc,
    draft.charges,
    setDraft,
  ]);

  const colocatables =
    bienLoueContext === "standard"
      ? locatairesPourBien.filter((l) => l.id !== draft.locataireId)
      : [];

  function toggleColoc(id: string, checked: boolean) {
    setDraft((d) => ({
      ...d,
      colocataireIds: checked
        ? [...d.colocataireIds, id]
        : d.colocataireIds.filter((x) => x !== id),
    }));
  }

  return (
    <>
      <p className={styles.hint}>
        {estSousLocation
          ? "Sous-location sur le même logement physique que le bail principal. Le sous-bailleur est le locataire au premier bail ; le sous-locataire est la partie au présent contrat."
          : bienLoueContext === "chaine_bail_principal"
            ? "Bail entre le bailleur (propriétaire du bien) et le locataire principal. Ensuite, vous pourrez saisir la sous-location au profit d’un sous-locataire."
            : "Fiche détaillée du bail : type, usage, loyers, paiements, dépôt, révision, encadrement et locataires (inspirée des formulaires professionnels)."}
      </p>

      {estSousLocation && chaineSousBailleurNom ? (
        <div className={styles.chaineNotice} role="status">
          <strong>Sous-bailleur (locataire principal)</strong> :{" "}
          {chaineSousBailleurNom}. Le bailleur reste le propriétaire figurant sur
          la fiche logement ; le présent acte lie ce sous-bailleur au
          sous-locataire ci-dessous.
        </div>
      ) : null}

      <SectionTitle>Bien loué</SectionTitle>
      <label className={fs.field}>
        <span className={fs.label}>
          Bien (logement) <span className={fs.req}>*</span>
        </span>
        <select
          className={fs.select}
          value={draft.logementId}
          onChange={(e) => set("logementId", e.target.value)}
          disabled={logementVerrouille}
        >
          <option value="">Choisir un bien…</option>
          {logementsSorted.map((l) => (
            <option key={l.id} value={l.id}>
              {l.titre} — {l.ville} ({l.codePostal})
            </option>
          ))}
        </select>
      </label>

      {estSousLocation ? (
        <label className={fs.field}>
          <span className={fs.label}>
            Libellé d’exploitation (enseigne, nom commercial du local)
          </span>
          <input
            className={fs.input}
            value={draft.libelleExploitation}
            onChange={(e) => set("libelleExploitation", e.target.value)}
            placeholder="ex. Salon « Au beau linge », Boutique Carrefour City…"
          />
          <span className={fs.hintField}>
            Peut différer du titre du logement dans vos listes ; utile pour le
            bail de sous-location commerciale ou l’affichage sur les actes.
          </span>
        </label>
      ) : null}

      <SectionTitle>Type</SectionTitle>
      <label className={fs.field}>
        <span className={fs.label}>
          Type de bail <span className={fs.req}>*</span>
        </span>
        <select
          className={fs.select}
          value={draft.typeBail}
          onChange={(e) => set("typeBail", e.target.value as TypeBailLocation)}
        >
          <option value="">Choisir…</option>
          {TYPES_BAIL_LOCATION.map((t) => (
            <option key={t} value={t}>
              {LIBELLE_TYPE_BAIL[t]}
            </option>
          ))}
        </select>
      </label>
      <div className={fs.field}>
        <span className={fs.label}>Utilisation</span>
        <div className={styles.radioCol}>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="usage"
              checked={draft.usageLogement === "residence_principale"}
              onChange={() => set("usageLogement", "residence_principale")}
            />
            Résidence principale du locataire
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="usage"
              checked={draft.usageLogement === "residence_secondaire"}
              onChange={() => set("usageLogement", "residence_secondaire")}
            />
            Résidence secondaire du locataire
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="usage"
              checked={draft.usageLogement === "activite_pro_sans_commerce"}
              onChange={() => set("usageLogement", "activite_pro_sans_commerce")}
            />
            Activité professionnelle (hors commerce / artisanat / industrie)
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="usage"
              checked={draft.usageLogement === ""}
              onChange={() => set("usageLogement", "")}
            />
            Non renseigné
          </label>
        </div>
      </div>

      <SectionTitle>Identifiant / référence</SectionTitle>
      <label className={fs.field}>
        <span className={fs.label}>Identifiant</span>
        <input
          className={fs.input}
          value={draft.identifiantBail}
          onChange={(e) => set("identifiantBail", e.target.value)}
          placeholder="Ex. Nouvelle location, réf. interne…"
        />
        <span className={fs.hintField}>
          Référence ou numéro unique (libre). Distinct du N° contrat dans
          l’onglet « Informations complémentaires ».
        </span>
      </label>

      <SectionTitle>Durée</SectionTitle>
      <div className={fs.grid2}>
        <label className={fs.field}>
          <span className={fs.label}>
            Début du bail <span className={fs.req}>*</span>
          </span>
          <input
            className={fs.input}
            type="date"
            value={draft.dateDebut}
            onChange={(e) => set("dateDebut", e.target.value)}
          />
        </label>
        <label className={fs.field}>
          <span className={fs.label}>Fin du bail</span>
          <input
            className={fs.input}
            type="date"
            value={draft.dateFin}
            onChange={(e) => set("dateFin", e.target.value)}
          />
        </label>
      </div>
      <label className={fs.field}>
        <span className={fs.label}>Durée du bail (mois)</span>
        <input
          className={fs.input}
          inputMode="numeric"
          value={draft.dureeMois}
          onChange={(e) => set("dureeMois", e.target.value)}
          placeholder="ex. 36"
        />
        {dureeCalculee ? (
          <span className={fs.hintField}>
            Durée approximative selon les dates : {dureeCalculee} mois
          </span>
        ) : null}
      </label>
      <label className={`${styles.toggleRow} ${fs.field}`}>
        <input
          type="checkbox"
          checked={draft.renouvellementTacite === "oui"}
          onChange={(e) =>
            set("renouvellementTacite", e.target.checked ? "oui" : "non")
          }
        />
        <span>
          <strong>Renouvellement</strong> (tacite) — si activé, les loyers pourront
          être suivis au-delà de la date de fin prévue.
        </span>
      </label>

      <SectionTitle>Paiement</SectionTitle>
      <label className={fs.field}>
        <span className={fs.label}>
          Périodicité du paiement <span className={fs.req}>*</span>
        </span>
        <select
          className={fs.select}
          value={draft.periodicite}
          onChange={(e) =>
            set("periodicite", e.target.value as PeriodiciteLoyer)
          }
        >
          <option value="">Choisir…</option>
          {PERIODICITES_LOYER.map((p) => (
            <option key={p} value={p}>
              {p === "mensuel" ? "Mensuel" : "Trimestriel"}
            </option>
          ))}
        </select>
      </label>
      <div className={fs.field}>
        <span className={fs.label}>Échéance</span>
        <div className={styles.radioCol}>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="echoir"
              checked={draft.paiementEchoirOuEchu === "a_echoir"}
              onChange={() => set("paiementEchoirOuEchu", "a_echoir")}
            />
            Paiement à échoir
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="echoir"
              checked={draft.paiementEchoirOuEchu === "terme_echu"}
              onChange={() => set("paiementEchoirOuEchu", "terme_echu")}
            />
            Paiement à terme échu
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="echoir"
              checked={draft.paiementEchoirOuEchu === ""}
              onChange={() => set("paiementEchoirOuEchu", "")}
            />
            Non renseigné
          </label>
        </div>
      </div>
      <label className={fs.field}>
        <span className={fs.label}>Moyen de paiement</span>
        <select
          className={fs.select}
          value={draft.moyenPaiement}
          onChange={(e) => set("moyenPaiement", e.target.value)}
        >
          <option value="">Choisir…</option>
          <option value="virement">Virement</option>
          <option value="prelevement">Prélèvement automatique</option>
          <option value="cheque">Chèque</option>
          <option value="especes">Espèces</option>
          <option value="carte">Carte bancaire</option>
          <option value="autre">Autre</option>
        </select>
        <span className={fs.hintField}>
          En cas de prélèvement, vous pourrez suivre les encaissements dans la
          partie Finance lorsque cette fonction sera reliée.
        </span>
      </label>

      <SectionTitle>Dates du loyer</SectionTitle>
      <div className={fs.grid2}>
        <label className={fs.field}>
          <span className={fs.label}>Date de paiement (jour du mois)</span>
          <select
            className={fs.select}
            value={draft.jourPaiement}
            onChange={(e) => set("jourPaiement", e.target.value)}
          >
            <option value="">—</option>
            {JOURS_MOIS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
          <span className={fs.hintField}>
            Jour prévu dans le bail (affiché sur la quittance).
          </span>
        </label>
        <label className={fs.field}>
          <span className={fs.label}>Date de quittancement / périodicité</span>
          <select
            className={fs.select}
            value={draft.jourQuittancement}
            onChange={(e) => set("jourQuittancement", e.target.value)}
          >
            <option value="">—</option>
            {JOURS_MOIS.map((j) => (
              <option key={`q${j}`} value={j}>
                {j}
              </option>
            ))}
          </select>
          <span className={fs.hintField}>
            Jour de début de période pour les quittances (ex. du 15 au 14).
          </span>
        </label>
      </div>
      <label className={fs.field}>
        <span className={fs.label}>Génération du loyer / échéance</span>
        <select
          className={fs.select}
          value={draft.generationLoyerRelatif}
          onChange={(e) => set("generationLoyerRelatif", e.target.value)}
        >
          <option value="">Choisir…</option>
          <option value="meme_quittance">Même que date de quittancement</option>
          <option value="j_moins_5">J − 5 (ex. généré 5 jours avant)</option>
          <option value="j_moins_10">J − 10</option>
          <option value="j_moins_15">J − 15</option>
        </select>
      </label>

      <SectionTitle>Loyer</SectionTitle>
      <div className={fs.grid2}>
        <label className={fs.field}>
          <span className={fs.label}>
            Loyer hors charges (€) <span className={fs.req}>*</span>
          </span>
          <input
            className={fs.input}
            inputMode="decimal"
            value={draft.loyerHc}
            onChange={(e) => set("loyerHc", e.target.value)}
          />
        </label>
        <label className={fs.field}>
          <span className={fs.label}>% TVA (loyer HC)</span>
          <input
            className={fs.input}
            inputMode="decimal"
            value={draft.loyerHcTva}
            onChange={(e) => set("loyerHcTva", e.target.value)}
            placeholder="ex. 0"
          />
        </label>
      </div>
      <div className={fs.grid2}>
        <label className={fs.field}>
          <span className={fs.label}>Charges locatives (€)</span>
          <input
            className={fs.input}
            inputMode="decimal"
            value={draft.charges}
            onChange={(e) => set("charges", e.target.value)}
          />
        </label>
        <label className={fs.field}>
          <span className={fs.label}>% TVA (charges)</span>
          <input
            className={fs.input}
            inputMode="decimal"
            value={draft.chargesTva}
            onChange={(e) => set("chargesTva", e.target.value)}
            placeholder="ex. 0"
          />
        </label>
      </div>
      <div className={fs.field}>
        <span className={fs.label}>Nature des charges</span>
        <div className={styles.radioCol}>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="typeCharges"
              checked={draft.typeChargesLoyer === "provision"}
              onChange={() => set("typeChargesLoyer", "provision")}
            />
            Provision pour charges
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="typeCharges"
              checked={draft.typeChargesLoyer === "forfait"}
              onChange={() => set("typeChargesLoyer", "forfait")}
            />
            Forfait de charges
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="typeCharges"
              checked={draft.typeChargesLoyer === ""}
              onChange={() => set("typeChargesLoyer", "")}
            />
            Non renseigné
          </label>
        </div>
      </div>
      <label className={fs.field}>
        <span className={fs.label}>
          Loyer charges comprises (€) <span className={fs.req}>*</span>
        </span>
        <input
          className={fs.input}
          inputMode="decimal"
          value={draft.loyerChargesComprises}
          onChange={(e) => set("loyerChargesComprises", e.target.value)}
        />
      </label>

      <SectionTitle>Autres paiements</SectionTitle>
      <p className={styles.hintTiny}>
        Autres éléments récurrents (parking, ménage…). Ils pourront figurer sur
        les quittances.
      </p>
      {draft.autresPaiements.map((row) => (
        <div key={row.id} className={styles.autrePaiementCard}>
          <div className={fs.grid2}>
            <label className={fs.field}>
              <span className={fs.label}>Montant (€)</span>
              <input
                className={fs.input}
                inputMode="decimal"
                value={row.montant}
                onChange={(e) =>
                  patchAutrePaiement(row.id, { montant: e.target.value })
                }
              />
            </label>
            <label className={fs.field}>
              <span className={fs.label}>% TVA</span>
              <input
                className={fs.input}
                inputMode="decimal"
                value={row.tva}
                onChange={(e) =>
                  patchAutrePaiement(row.id, { tva: e.target.value })
                }
              />
            </label>
          </div>
          <div className={fs.grid2}>
            <label className={fs.field}>
              <span className={fs.label}>Catégorie</span>
              <input
                className={fs.input}
                value={row.categorie}
                onChange={(e) =>
                  patchAutrePaiement(row.id, { categorie: e.target.value })
                }
              />
            </label>
            <label className={fs.field}>
              <span className={fs.label}>Description</span>
              <input
                className={fs.input}
                value={row.description}
                onChange={(e) =>
                  patchAutrePaiement(row.id, { description: e.target.value })
                }
              />
            </label>
          </div>
          <button
            type="button"
            className={styles.btnRemoveRow}
            onClick={() => removeAutrePaiement(row.id)}
          >
            Retirer cette ligne
          </button>
        </div>
      ))}
      <button type="button" className={styles.btnAddRow} onClick={addAutrePaiement}>
        + Ajouter un autre élément
      </button>

      <SectionTitle>Première quittance</SectionTitle>
      <label className={`${styles.toggleRow} ${fs.field}`}>
        <input
          type="checkbox"
          checked={draft.premierLoyerProrata === "oui"}
          onChange={(e) =>
            set("premierLoyerProrata", e.target.checked ? "oui" : "non")
          }
        />
        <span>Premier loyer au prorata temporis</span>
      </label>
      <label className={fs.field}>
        <span className={fs.label}>Date fin de période (1re quittance)</span>
        <input
          className={fs.input}
          type="date"
          value={draft.dateFinPeriodePremiereQuittance}
          onChange={(e) =>
            set("dateFinPeriodePremiereQuittance", e.target.value)
          }
        />
        <span className={fs.hintField}>
          Pour chaque mois civil concerné :{" "}
          <em>jours occupés dans le mois ÷ jours du mois</em> ; les fractions
          sont additionnées puis multipliées par le loyer HC et les charges
          mensuels. Si la première période couvre plusieurs mois, le total peut
          dépasser un mois de loyer.
        </span>
      </label>
      <button type="button" className={styles.btnCalc} onClick={calculerProrata}>
        Calculer les montants (prorata temporis)
      </button>
      <div className={fs.grid2}>
        <label className={fs.field}>
          <span className={fs.label}>Loyer HC calculé (€)</span>
          <input
            className={fs.input}
            readOnly
            value={draft.premierLoyerHcCalcule}
            placeholder="—"
          />
        </label>
        <label className={fs.field}>
          <span className={fs.label}>Charges calculées (€)</span>
          <input
            className={fs.input}
            readOnly
            value={draft.premierLoyerChargesCalcule}
            placeholder="—"
          />
        </label>
      </div>

      <SectionTitle>Dépôt de garantie</SectionTitle>
      <label className={fs.field}>
        <span className={fs.label}>
          Dépôt de garantie (€) <span className={fs.req}>*</span>
        </span>
        <input
          className={fs.input}
          inputMode="decimal"
          value={draft.depotGarantie}
          onChange={(e) => set("depotGarantie", e.target.value)}
        />
        <span className={fs.hintField}>
          Obligatoire si un dépôt est prévu ; sinon saisissez 0.
        </span>
      </label>
      <label className={fs.field}>
        <span className={fs.label}>Type / détention</span>
        <select
          className={fs.select}
          value={draft.depotGarantieType}
          onChange={(e) => set("depotGarantieType", e.target.value)}
        >
          <option value="">Choisir…</option>
          <option value="encaisse_bailleur">Encaissé par le bailleur</option>
          <option value="tiers">Détenu par un tiers / séquestre</option>
          <option value="non_encaisse">Non encaissé / autre</option>
        </select>
      </label>
      <label className={fs.field}>
        <span className={fs.label}>Document (URL ou référence)</span>
        <input
          className={fs.input}
          value={draft.depotGarantieDocumentNote}
          onChange={(e) => set("depotGarantieDocumentNote", e.target.value)}
          placeholder="Lien cloud, hash, ou mention « à joindre »"
        />
        <span className={fs.hintField}>
          Pas d’upload direct : PDF / images hébergés ailleurs (max. conseillé
          15 Mo hors ligne).
        </span>
      </label>
      <label className={fs.field}>
        <span className={fs.label}>Date de versement</span>
        <input
          className={fs.input}
          type="date"
          value={draft.depotGarantieDateVersement}
          onChange={(e) => set("depotGarantieDateVersement", e.target.value)}
        />
      </label>

      <SectionTitle>Révision de loyer</SectionTitle>
      <div className={fs.field}>
        <span className={fs.label}>Réviser le loyer selon</span>
        <div className={styles.radioCol}>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="revision"
              checked={draft.modeRevisionLoyer === "irl"}
              onChange={() => set("modeRevisionLoyer", "irl")}
            />
            Un indice de référence (IRL, etc.)
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="revision"
              checked={draft.modeRevisionLoyer === "aucune"}
              onChange={() => set("modeRevisionLoyer", "aucune")}
            />
            Ne pas réviser le loyer
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="revision"
              checked={draft.modeRevisionLoyer === "pourcentage"}
              onChange={() => set("modeRevisionLoyer", "pourcentage")}
            />
            Pourcentage convenu à la hausse
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="revision"
              checked={draft.modeRevisionLoyer === ""}
              onChange={() => set("modeRevisionLoyer", "")}
            />
            Non renseigné
          </label>
        </div>
      </div>
      <div className={fs.grid3}>
        <label className={fs.field}>
          <span className={fs.label}>Indice</span>
          <input
            className={fs.input}
            value={draft.indiceRevisionLibelle}
            onChange={(e) => set("indiceRevisionLibelle", e.target.value)}
            placeholder="ex. IRL"
          />
        </label>
        <label className={fs.field}>
          <span className={fs.label}>Trimestre / période</span>
          <input
            className={fs.input}
            value={draft.trimestreIndiceRevision}
            onChange={(e) => set("trimestreIndiceRevision", e.target.value)}
            placeholder="ex. T4 2025"
          />
        </label>
        <label className={fs.field}>
          <span className={fs.label}>Valeur indice</span>
          <input
            className={fs.input}
            value={draft.valeurIndiceRevision}
            onChange={(e) => set("valeurIndiceRevision", e.target.value)}
            placeholder="ex. 145,78"
          />
        </label>
      </div>
      <div className={styles.irlUpdateBlock}>
        <button
          type="button"
          className={styles.btnIrl}
          onClick={handleActualiserIrl}
          disabled={irlLoading}
        >
          {irlLoading
            ? "Chargement…"
            : "Actualiser l’IRL (dernier trimestre INSEE)"}
        </button>
        <p className={fs.hintField}>
          Renseigne l’indice « IRL », le trimestre (ex. T4 2025) et la valeur
          publiée par l’INSEE. En développement, les données viennent du site
          INSEE via le proxy Vite ; une fois l’application compilée, utilisez
          « npm run update-irl » pour mettre à jour{" "}
          <code className={styles.codeInline}>public/data/irl-latest.json</code>.
        </p>
        {irlFeedback ? (
          <p
            className={
              irlFeedback.type === "ok" ? styles.irlOkMsg : styles.irlErrMsg
            }
          >
            {irlFeedback.text}
          </p>
        ) : null}
      </div>
      <label className={`${styles.toggleRow} ${fs.field}`}>
        <input
          type="checkbox"
          checked={draft.revisionAutomatique === "oui"}
          onChange={(e) =>
            set("revisionAutomatique", e.target.checked ? "oui" : "non")
          }
        />
        <span>Révision automatique (rappel / suivi à votre initiative)</span>
      </label>
      <div className={fs.grid2}>
        <label className={fs.field}>
          <span className={fs.label}>Révision sur</span>
          <select
            className={fs.select}
            value={draft.revisionSur}
            onChange={(e) =>
              set(
                "revisionSur",
                e.target.value as ContratLocation["revisionSur"]
              )
            }
          >
            <option value="">—</option>
            <option value="loyer_hc">Loyer hors charges</option>
            <option value="loyer_cc">Loyer charges comprises</option>
          </select>
        </label>
        <label className={fs.field}>
          <span className={fs.label}>Période</span>
          <select
            className={fs.select}
            value={draft.periodeRevision}
            onChange={(e) => set("periodeRevision", e.target.value)}
          >
            <option value="">—</option>
            <option value="1_an">1 an</option>
            <option value="3_ans">3 ans</option>
            <option value="autre">Autre</option>
          </select>
        </label>
      </div>
      <div className={fs.field}>
        <span className={styles.labelMuted}>Date de révision</span>
        <div className={styles.radioCol}>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="daterev"
              checked={draft.dateRevisionMode === "anniversaire"}
              onChange={() => set("dateRevisionMode", "anniversaire")}
            />
            À la date anniversaire du bail
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="daterev"
              checked={draft.dateRevisionMode === "date_fixe"}
              onChange={() => set("dateRevisionMode", "date_fixe")}
            />
            À une date spécifique
          </label>
        </div>
      </div>
      {draft.dateRevisionMode === "date_fixe" ? (
        <label className={fs.field}>
          <span className={fs.label}>Date fixe</span>
          <input
            className={fs.input}
            type="date"
            value={draft.dateRevisionFixe}
            onChange={(e) => set("dateRevisionFixe", e.target.value)}
          />
        </label>
      ) : null}

      <SectionTitle>Encadrement des loyers</SectionTitle>
      <div className={fs.field}>
        <span className={fs.label}>
          Loyer soumis au loyer de référence majoré (arrêté préfectoral) ?
        </span>
        <div className={styles.radioInline}>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc1"
              checked={draft.encadrementRefMajore === "oui"}
              onChange={() => set("encadrementRefMajore", "oui")}
            />
            Oui
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc1"
              checked={draft.encadrementRefMajore === "non"}
              onChange={() => set("encadrementRefMajore", "non")}
            />
            Non
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc1"
              checked={draft.encadrementRefMajore === ""}
              onChange={() => set("encadrementRefMajore", "")}
            />
            N/R
          </label>
        </div>
      </div>
      <div className={fs.field}>
        <span className={fs.label}>
          Zone où l’évolution du loyer est plafonnée à l’IRL ?
        </span>
        <div className={styles.radioInline}>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc2"
              checked={draft.encadrementZoneIrl === "oui"}
              onChange={() => set("encadrementZoneIrl", "oui")}
            />
            Oui
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc2"
              checked={draft.encadrementZoneIrl === "non"}
              onChange={() => set("encadrementZoneIrl", "non")}
            />
            Non
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc2"
              checked={draft.encadrementZoneIrl === ""}
              onChange={() => set("encadrementZoneIrl", "")}
            />
            N/R
          </label>
        </div>
      </div>
      <div className={fs.grid2}>
        <label className={fs.field}>
          <span className={fs.label}>Loyer de référence (€/m²)</span>
          <input
            className={fs.input}
            inputMode="decimal"
            value={draft.loyerReferenceM2}
            onChange={(e) => set("loyerReferenceM2", e.target.value)}
          />
        </label>
        <label className={fs.field}>
          <span className={fs.label}>Loyer majoré (€/m²)</span>
          <input
            className={fs.input}
            inputMode="decimal"
            value={draft.loyerMajoreM2}
            onChange={(e) => set("loyerMajoreM2", e.target.value)}
          />
        </label>
      </div>
      <label className={fs.field}>
        <span className={fs.label}>Complément de loyer (€)</span>
        <input
          className={fs.input}
          inputMode="decimal"
          value={draft.complementLoyerMontant}
          onChange={(e) => set("complementLoyerMontant", e.target.value)}
        />
      </label>
      <label className={fs.field}>
        <span className={fs.label}>Justification du complément</span>
        <textarea
          className={fs.textarea}
          rows={3}
          value={draft.complementLoyerDescription}
          onChange={(e) =>
            set("complementLoyerDescription", e.target.value)
          }
        />
      </label>
      <div className={fs.field}>
        <span className={fs.label}>
          Bail du précédent locataire terminé depuis &gt; 18 mois ?
        </span>
        <div className={styles.radioInline}>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc3"
              checked={draft.bailPrecedent18Mois === "oui"}
              onChange={() => set("bailPrecedent18Mois", "oui")}
            />
            Oui
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc3"
              checked={draft.bailPrecedent18Mois === "non"}
              onChange={() => set("bailPrecedent18Mois", "non")}
            />
            Non
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc3"
              checked={draft.bailPrecedent18Mois === ""}
              onChange={() => set("bailPrecedent18Mois", "")}
            />
            N/R
          </label>
        </div>
      </div>
      <div className={fs.grid2}>
        <label className={fs.field}>
          <span className={fs.label}>Dernier loyer appliqué (€)</span>
          <input
            className={fs.input}
            inputMode="decimal"
            value={draft.dernierLoyerApplique}
            onChange={(e) => set("dernierLoyerApplique", e.target.value)}
          />
        </label>
        <label className={fs.field}>
          <span className={fs.label}>Date de versement (dernier loyer)</span>
          <input
            className={fs.input}
            type="date"
            value={draft.dernierLoyerDateVersement}
            onChange={(e) => set("dernierLoyerDateVersement", e.target.value)}
          />
        </label>
      </div>
      <label className={fs.field}>
        <span className={fs.label}>Dernière révision (date)</span>
        <input
          className={fs.input}
          type="date"
          value={draft.derniereRevisionDate}
          onChange={(e) => set("derniereRevisionDate", e.target.value)}
        />
      </label>
      <div className={fs.field}>
        <span className={fs.label}>Réévaluation du loyer ?</span>
        <div className={styles.radioInline}>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc4"
              checked={draft.loyerReevaluation === "oui"}
              onChange={() => set("loyerReevaluation", "oui")}
            />
            Oui
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc4"
              checked={draft.loyerReevaluation === "non"}
              onChange={() => set("loyerReevaluation", "non")}
            />
            Non
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="enc4"
              checked={draft.loyerReevaluation === ""}
              onChange={() => set("loyerReevaluation", "")}
            />
            N/R
          </label>
        </div>
      </div>

      <SectionTitle>Locataires</SectionTitle>
      <label className={fs.field}>
        <span className={fs.label}>
          {estSousLocation ? (
            <>
              Sous-locataire (contrat de sous-location){" "}
              <span className={fs.req}>*</span>
            </>
          ) : (
            <>
              Locataire principal <span className={fs.req}>*</span>
            </>
          )}
        </span>
        <select
          className={fs.select}
          value={draft.locataireId}
          onChange={(e) => set("locataireId", e.target.value)}
          disabled={!draft.logementId}
        >
          <option value="">
            {draft.logementId
              ? estSousLocation
                ? "Choisir un sous-locataire…"
                : "Choisir…"
              : "Sélectionnez d’abord un logement"}
          </option>
          {locatairesPourBien.map((l) => (
            <option key={l.id} value={l.id}>
              {nomCompletLocataire(l)}
            </option>
          ))}
        </select>
      </label>
      {draft.logementId && locatairesPourBien.length === 0 ? (
        <p className={styles.hint}>
          {estSousLocation
            ? "Aucune fiche « sous-locataire » sur ce bien — créez-la dans Locataires (catégorie sous-locataire, même logement)."
            : "Aucun locataire sur ce bien — créez des fiches dans l’onglet « Locataire »."}
        </p>
      ) : null}
      {colocatables.length > 0 ? (
        <div className={fs.field}>
          <span className={fs.label}>Co-locataires (plusieurs choix)</span>
          <div className={styles.radioCol}>
            {colocatables.map((l) => (
              <label key={l.id} className={styles.radioRow}>
                <input
                  type="checkbox"
                  checked={draft.colocataireIds.includes(l.id)}
                  onChange={(e) => toggleColoc(l.id, e.target.checked)}
                />
                {nomCompletLocataire(l)}
              </label>
            ))}
          </div>
          <span className={fs.hintField}>
            Cochez les occupants supplémentaires rattachés au même logement.
          </span>
        </div>
      ) : null}
    </>
  );
}
