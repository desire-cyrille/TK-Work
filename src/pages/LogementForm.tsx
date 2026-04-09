import { FormEvent, type ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import frameStyles from "../components/PageFrame.module.css";
import { useBiens } from "../context/BiensContext";
import {
  TYPES_BIEN,
  type Logement,
  type StatutLogement,
  type TypeBien,
} from "../types/domain";
import { FR_TEXTAREA_PROPS } from "../lib/frTextFieldProps";
import styles from "./NouveauLogement.module.css";

export function emptyLogementFields(): Omit<Logement, "id" | "bailleurId"> {
  return {
    titre: "",
    typeBien: "Appartement",
    imageUrl: "",
    statut: "actif",
    adresse: "",
    complementAdresse: "",
    codePostal: "",
    ville: "",
    surfaceM2: "",
    nombrePieces: "",
    etage: "",
    meuble: "",
    referenceInterne: "",
    copropriete: "",
    notes: "",
  };
}

type Props = {
  editingId?: string;
  initialBailleurId: string;
  initialFields: Omit<Logement, "id" | "bailleurId">;
  introText: ReactNode;
  submitLabel: string;
};

export function LogementForm({
  editingId,
  initialBailleurId,
  initialFields,
  introText,
  submitLabel,
}: Props) {
  const navigate = useNavigate();
  const { bailleurs, addLogement, updateLogement } = useBiens();
  const [bailleurId, setBailleurId] = useState(initialBailleurId);
  const [fields, setFields] = useState(initialFields);

  function set<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (
      !bailleurId.trim() ||
      !fields.titre.trim() ||
      !fields.adresse.trim() ||
      !fields.codePostal.trim() ||
      !fields.ville.trim()
    ) {
      return;
    }

    const payload = {
      ...fields,
      titre: fields.titre.trim(),
      imageUrl: fields.imageUrl.trim(),
      adresse: fields.adresse.trim(),
      complementAdresse: fields.complementAdresse.trim(),
      codePostal: fields.codePostal.trim(),
      ville: fields.ville.trim(),
      surfaceM2: fields.surfaceM2.trim(),
      nombrePieces: fields.nombrePieces.trim(),
      etage: fields.etage.trim(),
      referenceInterne: fields.referenceInterne.trim(),
      notes: fields.notes.trim(),
      bailleurId,
    };

    if (editingId) {
      updateLogement(editingId, payload);
    } else {
      addLogement(payload);
    }
    navigate("/biens/logement");
  }

  if (bailleurs.length === 0) {
    return (
      <div className={styles.pageWide}>
        <p className={styles.hint}>
          Ajoutez d&apos;abord au moins un bailleur pour pouvoir enregistrer un
          logement.
        </p>
        <div className={styles.emptyActions}>
          <Link to="/biens/bailleur" className={frameStyles.headerCta}>
            Aller aux bailleurs
          </Link>
          <Link to="/biens/logement" className={styles.secondaryLink}>
            Retour aux logements
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWide}>
      <p className={styles.introText}>{introText}</p>

      <form className={styles.form} onSubmit={onSubmit}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Identité du bien</legend>
          <div className={styles.grid2}>
            <label className={styles.field}>
              <span className={styles.label}>
                Titre du bien <span className={styles.req}>*</span>
              </span>
              <input
                className={styles.input}
                value={fields.titre}
                onChange={(e) => set("titre", e.target.value)}
                placeholder="Ex. T2 lumineux — quartier gare"
                required
              />
              <span className={styles.hintField}>
                Nom interne pour retrouver vite le bien dans vos listes.
              </span>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>
                Type de bien <span className={styles.req}>*</span>
              </span>
              <select
                className={styles.select}
                value={fields.typeBien}
                onChange={(e) => set("typeBien", e.target.value as TypeBien)}
                required
              >
                {TYPES_BIEN.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Référence interne</span>
            <input
              className={styles.input}
              value={fields.referenceInterne}
              onChange={(e) => set("referenceInterne", e.target.value)}
              placeholder="Ex. REF-2024-014 (votre codification)"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Photo du bien (URL)</span>
            <input
              className={styles.input}
              type="url"
              value={fields.imageUrl}
              onChange={(e) => set("imageUrl", e.target.value)}
              placeholder="https://… (optionnel, affichée sur la grille)"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Statut</span>
            <select
              className={styles.select}
              value={fields.statut}
              onChange={(e) =>
                set("statut", e.target.value as StatutLogement)
              }
            >
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
            </select>
          </label>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Adresse</legend>
          <label className={styles.field}>
            <span className={styles.label}>
              Numéro et rue <span className={styles.req}>*</span>
            </span>
            <input
              className={styles.input}
              value={fields.adresse}
              onChange={(e) => set("adresse", e.target.value)}
              placeholder="12 rue des Lilas"
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Complément</span>
            <input
              className={styles.input}
              value={fields.complementAdresse}
              onChange={(e) => set("complementAdresse", e.target.value)}
              placeholder="Bât. B, étage, boîte postale…"
            />
          </label>
          <div className={styles.grid2}>
            <label className={styles.field}>
              <span className={styles.label}>
                Code postal <span className={styles.req}>*</span>
              </span>
              <input
                className={styles.input}
                value={fields.codePostal}
                onChange={(e) => set("codePostal", e.target.value)}
                placeholder="75000"
                required
                autoComplete="postal-code"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>
                Ville <span className={styles.req}>*</span>
              </span>
              <input
                className={styles.input}
                value={fields.ville}
                onChange={(e) => set("ville", e.target.value)}
                placeholder="Paris"
                required
              />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Descriptif (gestion du bien)</legend>
          <div className={styles.grid3}>
            <label className={styles.field}>
              <span className={styles.label}>Surface (m²)</span>
              <input
                className={styles.input}
                inputMode="decimal"
                value={fields.surfaceM2}
                onChange={(e) => set("surfaceM2", e.target.value)}
                placeholder="45"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Nombre de pièces</span>
              <input
                className={styles.input}
                inputMode="decimal"
                value={fields.nombrePieces}
                onChange={(e) => set("nombrePieces", e.target.value)}
                placeholder="3"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Étage</span>
              <input
                className={styles.input}
                value={fields.etage}
                onChange={(e) => set("etage", e.target.value)}
                placeholder="2e sans ascenseur"
              />
            </label>
          </div>
          <div className={styles.grid2}>
            <label className={styles.field}>
              <span className={styles.label}>Meublé</span>
              <select
                className={styles.select}
                value={fields.meuble}
                onChange={(e) =>
                  set("meuble", e.target.value as Logement["meuble"])
                }
              >
                <option value="">— Non renseigné —</option>
                <option value="oui">Meublé</option>
                <option value="non">Non meublé</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Copropriété</span>
              <select
                className={styles.select}
                value={fields.copropriete}
                onChange={(e) =>
                  set("copropriete", e.target.value as Logement["copropriete"])
                }
              >
                <option value="">— Non renseigné —</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </label>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Notes / équipements</span>
            <textarea
              className={styles.textarea}
              {...FR_TEXTAREA_PROPS}
              value={fields.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Cave, parking, chauffage collectif, année de construction, DPE si utile…"
              rows={4}
            />
          </label>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Lien bailleur</legend>
          <label className={styles.field}>
            <span className={styles.label}>
              Bailleur <span className={styles.req}>*</span>
            </span>
            <select
              className={styles.select}
              value={bailleurId}
              onChange={(e) => setBailleurId(e.target.value)}
              required
            >
              <option value="">— Choisir —</option>
              {bailleurs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <div className={styles.actions}>
          <button type="submit" className={styles.primaryBtn}>
            {submitLabel}
          </button>
          <Link to="/biens/logement" className={styles.cancel}>
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
