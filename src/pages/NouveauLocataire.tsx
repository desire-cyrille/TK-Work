import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import { useBiens } from "../context/BiensContext";
import {
  CATEGORIES_LOCATAIRE,
  TYPES_OCCUPANT_LOCATAIRE,
  type CategorieLocataire,
  type Locataire,
  type TypeOccupantLocataire,
} from "../types/domain";
import styles from "./NouveauLogement.module.css";

const emptyFields = (): Omit<Locataire, "id"> => ({
  categorie: "locataire",
  typeOccupant: "personne_physique",
  raisonSociale: "",
  siret: "",
  formeJuridique: "",
  representantCivilite: "",
  representantPrenom: "",
  representantNom: "",
  civilite: "",
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  telephoneSecondaire: "",
  dateNaissance: "",
  lieuNaissance: "",
  nationalite: "",
  profession: "",
  employeur: "",
  revenusMensuels: "",
  iban: "",
  notes: "",
  logementsAssociesIds: [],
  categorieParLogement: {},
});

export function NouveauLocataire() {
  const navigate = useNavigate();
  const { id: editingId } = useParams<{ id?: string }>();
  const isEditing = Boolean(editingId);
  const { logements, locataires, addLocataire, updateLocataire } = useBiens();
  const existing = isEditing
    ? locataires.find((l) => l.id === editingId)
    : undefined;

  const [fields, setFields] = useState(emptyFields);
  const locatairesRef = useRef(locataires);
  locatairesRef.current = locataires;

  useEffect(() => {
    if (!editingId) {
      setFields(emptyFields());
      return;
    }
    const loc = locatairesRef.current.find((l) => l.id === editingId);
    if (loc) {
      const { id: _id, ...rest } = loc;
      setFields(rest);
    }
  }, [editingId]);

  function set<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (fields.logementsAssociesIds.length === 0) return;

    if (fields.typeOccupant === "personne_morale") {
      if (!fields.raisonSociale.trim()) return;
    } else if (!fields.nom.trim() || !fields.prenom.trim()) {
      return;
    }

    const idsSorted = [...fields.logementsAssociesIds].sort();
    const cpl: Locataire["categorieParLogement"] = {};
    for (const id of idsSorted) {
      cpl[id] = fields.categorieParLogement[id] ?? fields.categorie;
    }

    const payload: Omit<Locataire, "id"> = {
      ...fields,
      raisonSociale: fields.raisonSociale.trim(),
      siret: fields.siret.trim().replace(/\s/g, ""),
      formeJuridique: fields.formeJuridique.trim(),
      representantPrenom: fields.representantPrenom.trim(),
      representantNom: fields.representantNom.trim(),
      prenom: fields.prenom.trim(),
      nom: fields.nom.trim(),
      email: fields.email.trim(),
      telephone: fields.telephone.trim(),
      telephoneSecondaire: fields.telephoneSecondaire.trim(),
      dateNaissance: fields.dateNaissance.trim(),
      lieuNaissance: fields.lieuNaissance.trim(),
      nationalite: fields.nationalite.trim(),
      profession: fields.profession.trim(),
      employeur: fields.employeur.trim(),
      revenusMensuels: fields.revenusMensuels.trim(),
      iban: fields.iban.trim().replace(/\s/g, ""),
      notes: fields.notes.trim(),
      logementsAssociesIds: idsSorted,
      categorieParLogement: cpl,
    };
    if (isEditing && existing) {
      updateLocataire(existing.id, payload);
    } else {
      addLocataire(payload);
    }
    navigate("/biens/locataire");
  }

  const logementsSorted = [...logements].sort((a, b) =>
    a.titre.localeCompare(b.titre, "fr", { sensitivity: "base" })
  );

  const estSociete = fields.typeOccupant === "personne_morale";

  if (isEditing && !existing) {
    return <Navigate to="/biens/locataire" replace />;
  }

  const pageTitle = isEditing ? "Modifier le locataire" : "Nouveau locataire";

  if (logements.length === 0 && !isEditing) {
    return (
      <PageFrame title={pageTitle}>
        <div className={styles.pageWide}>
          <p className={styles.hint}>
            Enregistrez d&apos;abord au moins un logement pour rattacher une
            fiche locataire.
          </p>
          <div className={styles.emptyActions}>
            <Link to="/biens/logement/nouveau" className={frameStyles.headerCta}>
              Nouveau logement
            </Link>
            <Link to="/biens/locataire" className={styles.secondaryLink}>
              Retour aux locataires
            </Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame title={pageTitle}>
      <div className={styles.pageWide}>
        <p className={styles.introText}>
          Fiche occupant : particulier ou société, coordonnées et un ou plusieurs
          biens sur lesquels ce contact peut figurer sur un bail. Les champs
          marqués <span className={styles.req}>*</span> sont obligatoires selon
          le type d&apos;occupant.
        </p>

        <form className={styles.form} onSubmit={onSubmit}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Catégorie</legend>
            <label className={styles.field}>
              <span className={styles.label}>
                Statut bail <span className={styles.req}>*</span>
              </span>
              <select
                className={styles.select}
                value={fields.categorie}
                onChange={(e) =>
                  set("categorie", e.target.value as CategorieLocataire)
                }
                required
              >
                {CATEGORIES_LOCATAIRE.map((c) => (
                  <option key={c} value={c}>
                    {c === "locataire" ? "Locataire" : "Sous-locataire"}
                  </option>
                ))}
              </select>
              <span className={styles.hintField}>
                Rôle par défaut lorsque vous cochez un nouveau bien ; vous pouvez
                fixer un rôle différent par bien dans la liste ci-dessous.
              </span>
            </label>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Type d&apos;occupant</legend>
            <label className={styles.field}>
              <span className={styles.label}>
                Nature <span className={styles.req}>*</span>
              </span>
              <select
                className={styles.select}
                value={fields.typeOccupant}
                onChange={(e) =>
                  set(
                    "typeOccupant",
                    e.target.value as TypeOccupantLocataire
                  )
                }
                required
              >
                {TYPES_OCCUPANT_LOCATAIRE.map((t) => (
                  <option key={t} value={t}>
                    {t === "personne_physique"
                      ? "Personne physique (particulier)"
                      : "Personne morale (société, association…)"}
                  </option>
                ))}
              </select>
              <span className={styles.hintField}>
                Une société peut être locataire ou sous-locataire au même titre
                qu&apos;un particulier.
              </span>
            </label>
          </fieldset>

          {estSociete ? (
            <>
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Identité de la structure</legend>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Dénomination / raison sociale{" "}
                    <span className={styles.req}>*</span>
                  </span>
                  <input
                    className={styles.input}
                    value={fields.raisonSociale}
                    onChange={(e) => set("raisonSociale", e.target.value)}
                    placeholder="Ex. SARL LES LILAS, Association Solidarité…"
                    required={estSociete}
                    autoComplete="organization"
                  />
                </label>
                <div className={styles.grid2}>
                  <label className={styles.field}>
                    <span className={styles.label}>Forme juridique</span>
                    <input
                      className={styles.input}
                      value={fields.formeJuridique}
                      onChange={(e) => set("formeJuridique", e.target.value)}
                      placeholder="SARL, SAS, SCI, association…"
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>SIRET</span>
                    <input
                      className={styles.input}
                      value={fields.siret}
                      onChange={(e) => set("siret", e.target.value)}
                      placeholder="14 chiffres (facultatif)"
                      inputMode="numeric"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>
                  Représentant ou contact principal
                </legend>
                <p
                  className={`${styles.hintField} ${styles.hintFieldTight}`}
                >
                  Personne habilitée à échanger sur le bail (dirigeant, mandataire…).
                  Facultatif mais recommandé.
                </p>
                <div className={styles.grid3}>
                  <label className={styles.field}>
                    <span className={styles.label}>Civilité</span>
                    <select
                      className={styles.select}
                      value={fields.representantCivilite}
                      onChange={(e) =>
                        set(
                          "representantCivilite",
                          e.target.value as Locataire["representantCivilite"]
                        )
                      }
                    >
                      <option value="">—</option>
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Prénom</span>
                    <input
                      className={styles.input}
                      value={fields.representantPrenom}
                      onChange={(e) =>
                        set("representantPrenom", e.target.value)
                      }
                      autoComplete="given-name"
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Nom</span>
                    <input
                      className={styles.input}
                      value={fields.representantNom}
                      onChange={(e) => set("representantNom", e.target.value)}
                      autoComplete="family-name"
                    />
                  </label>
                </div>
              </fieldset>
            </>
          ) : (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Identité</legend>
              <div className={styles.grid3}>
                <label className={styles.field}>
                  <span className={styles.label}>Civilité</span>
                  <select
                    className={styles.select}
                    value={fields.civilite}
                    onChange={(e) =>
                      set("civilite", e.target.value as Locataire["civilite"])
                    }
                  >
                    <option value="">—</option>
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                    <option value="Autre">Autre</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Prénom <span className={styles.req}>*</span>
                  </span>
                  <input
                    className={styles.input}
                    value={fields.prenom}
                    onChange={(e) => set("prenom", e.target.value)}
                    autoComplete="given-name"
                    required={!estSociete}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Nom <span className={styles.req}>*</span>
                  </span>
                  <input
                    className={styles.input}
                    value={fields.nom}
                    onChange={(e) => set("nom", e.target.value)}
                    autoComplete="family-name"
                    required={!estSociete}
                  />
                </label>
              </div>
              <div className={styles.grid2}>
                <label className={styles.field}>
                  <span className={styles.label}>Date de naissance</span>
                  <input
                    className={styles.input}
                    type="date"
                    value={fields.dateNaissance}
                    onChange={(e) => set("dateNaissance", e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Lieu de naissance</span>
                  <input
                    className={styles.input}
                    value={fields.lieuNaissance}
                    onChange={(e) => set("lieuNaissance", e.target.value)}
                    placeholder="Ville, pays…"
                  />
                </label>
              </div>
              <label className={styles.field}>
                <span className={styles.label}>Nationalité</span>
                <input
                  className={styles.input}
                  value={fields.nationalite}
                  onChange={(e) => set("nationalite", e.target.value)}
                />
              </label>
            </fieldset>
          )}

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Coordonnées</legend>
            <div className={styles.grid2}>
              <label className={styles.field}>
                <span className={styles.label}>E-mail</span>
                <input
                  className={styles.input}
                  type="email"
                  value={fields.email}
                  onChange={(e) => set("email", e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Téléphone</span>
                <input
                  className={styles.input}
                  type="tel"
                  value={fields.telephone}
                  onChange={(e) => set("telephone", e.target.value)}
                  autoComplete="tel"
                />
              </label>
            </div>
            <label className={styles.field}>
              <span className={styles.label}>Téléphone secondaire</span>
              <input
                className={styles.input}
                type="tel"
                value={fields.telephoneSecondaire}
                onChange={(e) =>
                  set("telephoneSecondaire", e.target.value)
                }
              />
            </label>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>
              {estSociete ? "Situation (facultatif)" : "Situation"}
            </legend>
            {!estSociete ? null : (
              <p
                className={`${styles.hintField} ${styles.hintFieldTight}`}
              >
                Champs plutôt destinés aux particuliers ; vous pouvez les laisser
                vides pour une société.
              </p>
            )}
            <div className={styles.grid2}>
              <label className={styles.field}>
                <span className={styles.label}>Profession</span>
                <input
                  className={styles.input}
                  value={fields.profession}
                  onChange={(e) => set("profession", e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Employeur</span>
                <input
                  className={styles.input}
                  value={fields.employeur}
                  onChange={(e) => set("employeur", e.target.value)}
                />
              </label>
            </div>
            <label className={styles.field}>
              <span className={styles.label}>
                {estSociete
                  ? "Capacité / commentaire financier (facultatif)"
                  : "Revenus mensuels nets (€)"}
              </span>
              <input
                className={styles.input}
                value={fields.revenusMensuels}
                onChange={(e) => set("revenusMensuels", e.target.value)}
                placeholder={
                  estSociete ? "ex. garanties, caution, observations…" : "ex. 2 400"
                }
                inputMode="decimal"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>IBAN (prélèvement / virement)</span>
              <input
                className={styles.input}
                value={fields.iban}
                onChange={(e) => set("iban", e.target.value)}
                placeholder="FR…"
                autoComplete="off"
              />
            </label>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Biens concernés</legend>
            <p className={styles.hintField}>
              Cochez chaque logement où ce contact peut être sélectionné comme
              occupant au bail. Sur chaque ligne, précisez s&apos;il s&apos;agit
              d&apos;un locataire au bail principal ou d&apos;un sous-locataire
              pour ce bien précis.
            </p>
            <div className={styles.locataireBiensList}>
              {logementsSorted.map((log) => {
                const checked = fields.logementsAssociesIds.includes(log.id);
                const roleOnLog =
                  fields.categorieParLogement[log.id] ?? fields.categorie;
                return (
                  <div key={log.id} className={styles.locataireBienRow}>
                    <label className={styles.locataireBienCheck}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setFields((f) => {
                            const ids = new Set(f.logementsAssociesIds);
                            const cpl = { ...f.categorieParLogement };
                            if (on) {
                              ids.add(log.id);
                              if (cpl[log.id] === undefined) {
                                cpl[log.id] = f.categorie;
                              }
                            } else {
                              ids.delete(log.id);
                              delete cpl[log.id];
                            }
                            return {
                              ...f,
                              logementsAssociesIds: [...ids],
                              categorieParLogement: cpl,
                            };
                          });
                        }}
                      />
                      <span>
                        {log.titre}{" "}
                        <span className={styles.locataireBienMeta}>
                          — {log.ville || "…"} ({log.codePostal || "—"})
                        </span>
                      </span>
                    </label>
                    {checked ? (
                      <select
                        className={styles.select}
                        value={roleOnLog}
                        onChange={(e) =>
                          setFields((f) => ({
                            ...f,
                            categorieParLogement: {
                              ...f.categorieParLogement,
                              [log.id]: e.target.value as CategorieLocataire,
                            },
                          }))
                        }
                        aria-label={`Rôle sur ${log.titre}`}
                      >
                        {CATEGORIES_LOCATAIRE.map((c) => (
                          <option key={c} value={c}>
                            {c === "locataire"
                              ? "Locataire (bail principal)"
                              : "Sous-locataire"}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <label className={styles.field}>
              <span className={styles.label}>Notes</span>
              <textarea
                className={styles.textarea}
                value={fields.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Garant, colocataire, animaux, particularités du bail…"
              />
            </label>
          </fieldset>

          <div className={styles.actions}>
            <button type="submit" className={styles.primaryBtn}>
              {isEditing
                ? "Enregistrer les modifications"
                : "Enregistrer le locataire"}
            </button>
            <Link to="/biens/locataire" className={styles.cancel}>
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </PageFrame>
  );
}
