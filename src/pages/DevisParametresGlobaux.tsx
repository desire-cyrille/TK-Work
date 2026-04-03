import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import {
  enregistrerParametresDevisDefaut,
  lireParametresDevisDefaut,
} from "../lib/devisDefaultsStorage";
import type { TarifsZone } from "../lib/devisTypes";
import styles from "./DevisEditeur.module.css";

function TarifsForm({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TarifsZone;
  onChange: (z: TarifsZone) => void;
}) {
  const fields: { k: keyof TarifsZone; lib: string }[] = [
    { k: "tarifKm", lib: "Tarif au km (€)" },
    { k: "prixRepasDefaut", lib: "Prix repas par défaut (€)" },
    { k: "tarifHeure", lib: "Tarif horaire (€)" },
    { k: "tarifJour", lib: "Tarif jour (€)" },
    { k: "tarifSemaine", lib: "Tarif semaine (€)" },
    { k: "tarifMois", lib: "Tarif mois (€)" },
  ];
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.grid2}>
        {fields.map(({ k, lib }) => (
          <label key={k} className={styles.label}>
            {lib}
            <input
              type="number"
              step="0.01"
              className={styles.input}
              value={Number.isFinite(value[k]) ? value[k] : 0}
              onChange={(e) =>
                onChange({ ...value, [k]: Number(e.target.value) || 0 })
              }
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DevisParametresGlobaux() {
  const initial = useMemo(() => lireParametresDevisDefaut(), []);
  const [idf, setIdf] = useState<TarifsZone>(initial.idf);
  const [hors, setHors] = useState<TarifsZone>(initial.horsIdf);
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    enregistrerParametresDevisDefaut({ idf, horsIdf: hors });
    setMsg("Paramètres enregistrés.");
    window.setTimeout(() => setMsg(null), 2500);
  }

  return (
    <PageFrame
      title="Paramètres des devis"
      actions={
        <Link
          to="/devis"
          className={frameStyles.headerCtaSecondary}
          style={{ textDecoration: "none" }}
        >
          Retour aux devis
        </Link>
      }
    >
      <form className={styles.editorWrap} onSubmit={onSubmit}>
        <p className={styles.hint}>
          Tarifs par défaut appliqués aux <strong>nouveaux</strong> calculs
          selon la zone Île-de-France ou hors Île-de-France. Vous pouvez toujours
          ajuster les montants ligne par ligne dans chaque devis.
        </p>
        <TarifsForm label="Île-de-France" value={idf} onChange={setIdf} />
        <TarifsForm
          label="Hors Île-de-France"
          value={hors}
          onChange={setHors}
        />
        {msg ? <p className={styles.okMsg}>{msg}</p> : null}
        <button type="submit" className={styles.btnPrimary}>
          Enregistrer les paramètres
        </button>
      </form>
    </PageFrame>
  );
}
