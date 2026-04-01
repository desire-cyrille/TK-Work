import { FormEvent, useState } from "react";
import type { Bailleur, TypeOccupantLocataire } from "../types/domain";
import {
  lignesAdresseBailleur,
  ligneRepresentantLegalBailleur,
  TYPES_OCCUPANT_LOCATAIRE,
} from "../types/domain";
import { PageFrame } from "../components/PageFrame";
import { useBiens } from "../context/BiensContext";
import styles from "./Bailleurs.module.css";

export function Bailleurs() {
  const { bailleurs, logements, addBailleur, updateBailleur, removeBailleur } =
    useBiens();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeOccupant, setTypeOccupant] =
    useState<TypeOccupantLocataire>("personne_physique");
  const [nom, setNom] = useState("");
  const [formeJuridique, setFormeJuridique] = useState("");
  const [siret, setSiret] = useState("");
  const [representantCivilite, setRepresentantCivilite] = useState<
    Bailleur["representantCivilite"]
  >("");
  const [representantPrenom, setRepresentantPrenom] = useState("");
  const [representantNom, setRepresentantNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [complementAdresse, setComplementAdresse] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [ville, setVille] = useState("");

  const estSociete = typeOccupant === "personne_morale";

  function startEdit(p: Bailleur) {
    setEditingId(p.id);
    setTypeOccupant(p.typeOccupant);
    setNom(p.nom);
    setFormeJuridique(p.formeJuridique);
    setSiret(p.siret);
    setRepresentantCivilite(p.representantCivilite);
    setRepresentantPrenom(p.representantPrenom);
    setRepresentantNom(p.representantNom);
    setEmail(p.email);
    setTelephone(p.telephone);
    setAdresse(p.adresse);
    setComplementAdresse(p.complementAdresse);
    setCodePostal(p.codePostal);
    setVille(p.ville);
  }

  function cancelEdit() {
    setEditingId(null);
    setTypeOccupant("personne_physique");
    setNom("");
    setFormeJuridique("");
    setSiret("");
    setRepresentantCivilite("");
    setRepresentantPrenom("");
    setRepresentantNom("");
    setEmail("");
    setTelephone("");
    setAdresse("");
    setComplementAdresse("");
    setCodePostal("");
    setVille("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    const payload = {
      typeOccupant,
      nom: nom.trim(),
      formeJuridique: estSociete ? formeJuridique.trim() : "",
      siret: estSociete ? siret.trim().replace(/\s/g, "") : "",
      representantCivilite: estSociete ? representantCivilite : "",
      representantPrenom: estSociete ? representantPrenom.trim() : "",
      representantNom: estSociete ? representantNom.trim() : "",
      email: email.trim(),
      telephone: telephone.trim(),
      adresse: adresse.trim(),
      complementAdresse: complementAdresse.trim(),
      codePostal: codePostal.trim(),
      ville: ville.trim(),
    };
    if (editingId) {
      updateBailleur(editingId, payload);
      cancelEdit();
    } else {
      addBailleur(payload);
      cancelEdit();
    }
  }

  const sorted = [...bailleurs].sort((a, b) =>
    a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" })
  );

  function handleDelete(p: Bailleur) {
    const attaches = logements.filter((l) => l.bailleurId === p.id);
    if (attaches.length > 0) {
      window.alert(
        `Impossible de supprimer « ${p.nom} » : ${attaches.length} logement${attaches.length > 1 ? "s sont" : " est"} encore rattaché${attaches.length > 1 ? "s" : ""}. Supprimez ou réaffectez d’abord ces biens dans Logements.`
      );
      return;
    }
    if (
      window.confirm(
        `Supprimer le bailleur « ${p.nom} » ? Cette action est définitive.`
      )
    ) {
      if (editingId === p.id) cancelEdit();
      removeBailleur(p.id);
    }
  }

  return (
    <PageFrame title="Bailleurs">
      <div className={styles.page}>
        <p className={styles.subtitle}>
          Gérez les bailleurs avant d&apos;associer des logements. La suppression
          n&apos;est possible que si aucun logement n&apos;est encore lié à la
          fiche.
        </p>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            {editingId ? "Modifier le bailleur" : "Ajouter un bailleur"}
          </h2>
          <form className={styles.form} onSubmit={onSubmit}>
            <label className={styles.field}>
              <span className={styles.label}>Nature du bailleur</span>
              <select
                className={styles.input}
                value={typeOccupant}
                onChange={(e) => {
                  const v = e.target.value as TypeOccupantLocataire;
                  setTypeOccupant(v);
                  if (v === "personne_physique") {
                    setFormeJuridique("");
                    setSiret("");
                    setRepresentantCivilite("");
                    setRepresentantPrenom("");
                    setRepresentantNom("");
                  }
                }}
              >
                {TYPES_OCCUPANT_LOCATAIRE.map((t) => (
                  <option key={t} value={t}>
                    {t === "personne_physique"
                      ? "Particulier (personne physique)"
                      : "Société ou personne morale"}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>
                {estSociete
                  ? "Dénomination / raison sociale"
                  : "Nom complet"}{" "}
                <span className={styles.req}>*</span>
              </span>
              <input
                className={styles.input}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder={
                  estSociete
                    ? "Ex. SCI LES LILAS, SARL DUPONT…"
                    : "Prénom et nom du propriétaire"
                }
                required
                autoComplete={estSociete ? "organization" : "name"}
              />
            </label>

            {estSociete ? (
              <>
                <fieldset className={styles.addressFieldset}>
                  <legend className={styles.addressLegend}>
                    Identité de la structure
                  </legend>
                  <div className={styles.row}>
                    <label className={styles.field}>
                      <span className={styles.label}>Forme juridique</span>
                      <input
                        className={styles.input}
                        value={formeJuridique}
                        onChange={(e) => setFormeJuridique(e.target.value)}
                        placeholder="SARL, SAS, SCI, association…"
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>SIRET</span>
                      <input
                        className={styles.input}
                        value={siret}
                        onChange={(e) => setSiret(e.target.value)}
                        placeholder="14 chiffres (facultatif)"
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                </fieldset>
                <fieldset className={styles.addressFieldset}>
                  <legend className={styles.addressLegend}>
                    Représentant légal ou contact principal
                  </legend>
                  <p className={styles.fieldHint}>
                    Dirigeant ou personne habilitée (facultatif, utile sur les
                    documents).
                  </p>
                  <div className={styles.row3}>
                    <label className={styles.field}>
                      <span className={styles.label}>Civilité</span>
                      <select
                        className={styles.input}
                        value={representantCivilite}
                        onChange={(e) =>
                          setRepresentantCivilite(
                            e.target.value as Bailleur["representantCivilite"]
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
                        value={representantPrenom}
                        onChange={(e) => setRepresentantPrenom(e.target.value)}
                        autoComplete="given-name"
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Nom</span>
                      <input
                        className={styles.input}
                        value={representantNom}
                        onChange={(e) => setRepresentantNom(e.target.value)}
                        autoComplete="family-name"
                      />
                    </label>
                  </div>
                </fieldset>
              </>
            ) : null}

            <fieldset className={styles.addressFieldset}>
              <legend className={styles.addressLegend}>Adresse postale</legend>
              <label className={styles.field}>
                <span className={styles.label}>Rue, n°</span>
                <input
                  className={styles.input}
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  placeholder="optionnel"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Complément</span>
                <input
                  className={styles.input}
                  value={complementAdresse}
                  onChange={(e) => setComplementAdresse(e.target.value)}
                  placeholder="bât., escalier, BP… (optionnel)"
                />
              </label>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span className={styles.label}>Code postal</span>
                  <input
                    className={styles.input}
                    value={codePostal}
                    onChange={(e) => setCodePostal(e.target.value)}
                    placeholder="optionnel"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Ville</span>
                  <input
                    className={styles.input}
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    placeholder="optionnel"
                  />
                </label>
              </div>
            </fieldset>
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>E-mail</span>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="optionnel"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Téléphone</span>
                <input
                  className={styles.input}
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="optionnel"
                />
              </label>
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn}>
                {editingId
                  ? "Enregistrer les modifications"
                  : "Enregistrer le bailleur"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={cancelEdit}
                >
                  Annuler
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className={styles.listSection}>
          <h2 className={styles.listTitle}>Liste ({sorted.length})</h2>
          {sorted.length === 0 ? (
            <p className={styles.empty}>Aucun bailleur pour le moment.</p>
          ) : (
            <ul className={styles.list}>
              {sorted.map((p) => {
                const repLegal = ligneRepresentantLegalBailleur(p);
                const metaSociete =
                  p.typeOccupant === "personne_morale" &&
                  (p.formeJuridique.trim() || p.siret.trim() || repLegal)
                    ? [
                        p.formeJuridique.trim(),
                        p.siret.trim() ? `SIRET ${p.siret.trim()}` : "",
                        repLegal ? `Représentant : ${repLegal}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : null;
                return (
                  <li key={p.id} className={styles.listItem}>
                    <div className={styles.listItemText}>
                      <span className={styles.listName}>
                        {p.nom}
                        {p.typeOccupant === "personne_morale" ? (
                          <span className={styles.badgeMorale}>Société</span>
                        ) : null}
                      </span>
                      {metaSociete ? (
                        <span className={styles.listMeta}>{metaSociete}</span>
                      ) : null}
                      <span className={styles.listMeta}>
                        {[
                          lignesAdresseBailleur(p).join(" · "),
                          [p.email, p.telephone].filter(Boolean).join(" · "),
                        ]
                          .filter(Boolean)
                          .join(" — ") || "—"}
                      </span>
                    </div>
                    <div className={styles.listActions}>
                      <button
                        type="button"
                        className={styles.btnModify}
                        onClick={() => startEdit(p)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className={styles.btnDelete}
                        onClick={() => handleDelete(p)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
