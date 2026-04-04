import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import {
  enregistrerParametresDevisDefaut,
  lireParametresDevisDefaut,
} from "../lib/devisDefaultsStorage";
import {
  type DevisClientFiche,
  type DevisParametresGlobaux,
  type TarifsZone,
  PIED_PAGE_PDF_DEFAUT,
  newId,
} from "../lib/devisTypes";
import styles from "./DevisEditeur.module.css";

const LOGO_MAX_BYTES = Math.round(1.5 * 1024 * 1024);

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
    {
      k: "prixPetitDejeunerDefaut",
      lib: "Prix petit-déjeuner par défaut (€)",
    },
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

function ficheVide(): DevisClientFiche {
  return {
    id: newId(),
    raisonOuNom: "",
    estSociete: false,
    adresse: "",
    siren: "",
    tva: "",
    contact: "",
  };
}

export function DevisParametresGlobaux() {
  const initial = useMemo(() => lireParametresDevisDefaut(), []);
  const [idf, setIdf] = useState<TarifsZone>(initial.idf);
  const [hors, setHors] = useState<TarifsZone>(initial.horsIdf);
  const [piedPagePdf, setPiedPagePdf] = useState(
    initial.piedPagePdf || PIED_PAGE_PDF_DEFAUT,
  );
  const [logoPdfDataUrl, setLogoPdfDataUrl] = useState(
    initial.logoPdfDataUrl ?? "",
  );
  const [clientsFiches, setClientsFiches] = useState<DevisClientFiche[]>(
    () => initial.clientsFiches ?? [],
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [errLogo, setErrLogo] = useState<string | null>(null);

  function majFiche(id: string, patch: Partial<DevisClientFiche>) {
    setClientsFiches((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function supprimerFiche(id: string) {
    setClientsFiches((prev) => prev.filter((c) => c.id !== id));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const data: DevisParametresGlobaux = {
      idf,
      horsIdf: hors,
      piedPagePdf: piedPagePdf.trim() || PIED_PAGE_PDF_DEFAUT,
      logoPdfDataUrl: logoPdfDataUrl.trim() || undefined,
      clientsFiches: clientsFiches.filter((c) => c.raisonOuNom.trim().length > 0),
    };
    enregistrerParametresDevisDefaut(data);
    setMsg("Paramètres enregistrés.");
    window.setTimeout(() => setMsg(null), 2500);
  }

  function onLogoFile(f: File | null) {
    setErrLogo(null);
    if (!f) return;
    if (!/^image\/(png|jpeg|jpg)$/i.test(f.type)) {
      setErrLogo("Utilisez une image PNG ou JPEG.");
      return;
    }
    if (f.size > LOGO_MAX_BYTES) {
      setErrLogo(
        `Fichier trop volumineux (max. ${Math.round(LOGO_MAX_BYTES / (1024 * 1024))} Mo).`,
      );
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const res = r.result;
      if (typeof res === "string") setLogoPdfDataUrl(res);
    };
    r.readAsDataURL(f);
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
          Tarifs par défaut pour les calculs selon la zone. Le{" "}
          <strong>logo</strong> et le <strong>pied de page</strong> s’appliquent
          à <strong>toutes les pages</strong> des PDF devis (y compris les annexes
          comptabilité).
        </p>
        <TarifsForm label="Île-de-France" value={idf} onChange={setIdf} />
        <TarifsForm
          label="Hors Île-de-France"
          value={hors}
          onChange={setHors}
        />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Clients enregistrés</legend>
          <p className={styles.hint}>
            Utilisés dans la boîte <strong>Nouveau devis</strong> : suggestions
            lisibles et préremplissage de l’onglet <strong>Projet &amp; client</strong>{" "}
            (adresse, SIREN, TVA, contact). Les fiches vides ne sont pas enregistrées.
          </p>
          <div className={styles.clientsList}>
            {clientsFiches.map((c) => (
              <div key={c.id} className={styles.clientCard}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={c.estSociete}
                    onChange={(e) =>
                      majFiche(c.id, { estSociete: e.target.checked })
                    }
                  />{" "}
                  Société
                </label>
                <label className={styles.label}>
                  {c.estSociete ? "Raison sociale" : "Nom du client"}
                  <input
                    className={styles.input}
                    value={c.raisonOuNom}
                    onChange={(e) =>
                      majFiche(c.id, { raisonOuNom: e.target.value })
                    }
                    placeholder={
                      c.estSociete ? "Ex. Facility Park SAS" : "Ex. Dupont Jean"
                    }
                  />
                </label>
                {c.estSociete ? (
                  <label className={styles.label}>
                    Contact (optionnel)
                    <input
                      className={styles.input}
                      value={c.contact}
                      onChange={(e) =>
                        majFiche(c.id, { contact: e.target.value })
                      }
                      placeholder="Nom du contact"
                    />
                  </label>
                ) : null}
                <label className={styles.label}>
                  Adresse
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    value={c.adresse}
                    onChange={(e) =>
                      majFiche(c.id, { adresse: e.target.value })
                    }
                    placeholder="Adresse postale complète"
                  />
                </label>
                <div className={styles.grid2}>
                  <label className={styles.label}>
                    SIREN
                    <input
                      className={styles.input}
                      value={c.siren}
                      onChange={(e) =>
                        majFiche(c.id, { siren: e.target.value })
                      }
                      placeholder="9 chiffres"
                    />
                  </label>
                  <label className={styles.label}>
                    N° TVA
                    <input
                      className={styles.input}
                      value={c.tva}
                      onChange={(e) => majFiche(c.id, { tva: e.target.value })}
                      placeholder="Ex. FR12…"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => supprimerFiche(c.id)}
                >
                  Retirer ce client
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setClientsFiches((p) => [...p, ficheVide()])}
          >
            Ajouter un client
          </button>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>PDF — logo (haut gauche)</legend>
          <p className={styles.hint}>
            PNG ou JPEG, recommandé fond transparent ou lisible sur blanc. Max.{" "}
            {Math.round(LOGO_MAX_BYTES / (1024 * 1024))} Mo.
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
          />
          {errLogo ? <p className={styles.errMsg}>{errLogo}</p> : null}
          {logoPdfDataUrl ? (
            <div style={{ marginTop: "0.75rem" }}>
              <img
                src={logoPdfDataUrl}
                alt="Aperçu logo"
                style={{ maxHeight: "56px", maxWidth: "200px", objectFit: "contain" }}
              />
              <div>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => {
                    setLogoPdfDataUrl("");
                    setErrLogo(null);
                  }}
                >
                  Retirer le logo
                </button>
              </div>
            </div>
          ) : null}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>PDF — pied de page</legend>
          <p className={styles.hint}>
            Une ligne par ligne (centrées). Caractères accentués simples recommandés.
          </p>
          <label className={styles.label}>
            Texte
            <textarea
              className={styles.textarea}
              rows={6}
              value={piedPagePdf}
              onChange={(e) => setPiedPagePdf(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setPiedPagePdf(PIED_PAGE_PDF_DEFAUT)}
          >
            Rétablir le texte par défaut
          </button>
        </fieldset>

        {msg ? <p className={styles.okMsg}>{msg}</p> : null}
        <button type="submit" className={styles.btnPrimary}>
          Enregistrer les paramètres
        </button>
      </form>
    </PageFrame>
  );
}
