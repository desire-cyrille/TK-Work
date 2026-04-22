import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import { telechargerRapportActivitePdf } from "../lib/exportRapportActivitePdf";
import {
  appliquerPrefillType,
  enregistrerRapportValide,
  getProjetRapportActivite,
  listerRapportsPourProjet,
  sauvegarderBrouillonProjet,
  sauvegarderProjetRapportActivite,
  supprimerRapportFiche,
} from "../lib/rapportActiviteStorage";
import {
  COL_ETAT_ID,
  contenuSiteVide,
  enrichirBrouillonDomaines,
  type RapportActiviteProjet,
  type RapportBrouillonState,
  type RapportColonneTableau,
  type RapportDomaineDef,
  nouvelleLigneTableau,
} from "../lib/rapportActiviteTypes";
import styles from "./RapportActiviteRedaction.module.css";

type TabMain = "redaction" | "rapports" | "reglages";
type SubRedac = "meta" | "visuels" | "domaines" | "tableau" | "synthese";

const MAX_PHOTOS = 4;

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

async function fichierVersDataUrl(f: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!f.type.startsWith("image/")) {
      resolve(null);
      return;
    }
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(f);
  });
}

function brouillonDepuisProjet(p: RapportActiviteProjet): RapportBrouillonState {
  return alignerParSite(clone(p.brouillon), p);
}

function alignerParSite(
  draft: RapportBrouillonState,
  projet: RapportActiviteProjet,
): RapportBrouillonState {
  const parSite = { ...draft.parSite };
  for (const s of projet.sites) {
    if (!parSite[s.id]) {
      parSite[s.id] = contenuSiteVide(projet.domaines);
    }
  }
  const photosParSite = { ...draft.visuels.photosParSite };
  for (const s of projet.sites) {
    if (!photosParSite[s.id]) photosParSite[s.id] = [];
  }
  let siteActifId = draft.siteActifId;
  if (!projet.sites.some((s) => s.id === siteActifId)) {
    siteActifId = projet.sites[0]?.id ?? siteActifId;
  }
  return {
    ...draft,
    siteActifId,
    parSite,
    visuels: { ...draft.visuels, photosParSite },
  };
}

export function RapportActiviteRedaction() {
  const { id } = useParams<{ id: string }>();
  const projetId = (id ?? "").trim();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const projet = useMemo(
    () => (projetId ? getProjetRapportActivite(projetId) : undefined),
    [projetId, tick],
  );

  const [tabMain, setTabMain] = useState<TabMain>("redaction");
  const [subRedac, setSubRedac] = useState<SubRedac>("meta");
  const [draft, setDraft] = useState<RapportBrouillonState | null>(() => {
    if (!projetId) return null;
    const p = getProjetRapportActivite(projetId);
    return p ? brouillonDepuisProjet(p) : null;
  });
  const [clientNom, setClientNom] = useState("");
  const [piedPage, setPiedPage] = useState("");
  const [msgFin, setMsgFin] = useState("");
  const [domEd, setDomEd] = useState<RapportDomaineDef[]>([]);
  const [colEd, setColEd] = useState<RapportColonneTableau[]>([]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projetId) {
      setDraft(null);
      return;
    }
    const p = getProjetRapportActivite(projetId);
    if (!p) {
      setDraft(null);
      return;
    }
    setDraft(brouillonDepuisProjet(p));
    setClientNom(p.clientNom);
    setPiedPage(p.piedPagePdf);
    setMsgFin(p.dernierePageMessage);
    setDomEd(p.domaines.map((d) => ({ ...d })));
    setColEd(p.colonnesTableau.map((c) => ({ ...c })));
  }, [projetId, projet?.updatedAt]);

  const debouncedSaveBrouillon = useCallback(
    (projetId: string, b: RapportBrouillonState) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        sauvegarderBrouillonProjet(projetId, b);
      }, 450);
    },
    [],
  );

  useEffect(() => {
    if (!projet || !draft) return;
    debouncedSaveBrouillon(projet.id, draft);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [projet, draft, debouncedSaveBrouillon]);

  if (!projetId) return <Navigate to="/rapport-activite/accueil" replace />;
  if (!projet) {
    return <Navigate to="/rapport-activite/accueil" replace />;
  }
  if (!draft) {
    return (
      <PageFrame title="Chargement…">
        <p className={styles.hint}>Préparation de l’éditeur…</p>
      </PageFrame>
    );
  }

  const projetCourant = projet;

  const siteBloc =
    draft.parSite[draft.siteActifId] ??
    contenuSiteVide(projetCourant.domaines);
  const rapportsListe = listerRapportsPourProjet(projetCourant.id);

  function majDraft(fn: (d: RapportBrouillonState) => RapportBrouillonState) {
    setDraft((cur) =>
      cur ? fn(alignerParSite(clone(cur), projetCourant)) : cur,
    );
  }

  function onFusion() {
    if (!projet || !draft) return;
    if (
      !window.confirm(
        "Recalculer le contenu à partir des rapports enregistrés (selon le type et les dates) ? Le brouillon actuel sera remplacé.",
      )
    ) {
      return;
    }
    const next = appliquerPrefillType(projet.id, {
      typeRapport: draft.typeRapport,
      dateRapport: draft.dateRapport,
      moisCle: draft.moisCle ?? draft.dateRapport.slice(0, 7),
      titreDocument: draft.titreDocument,
    });
    if (next) {
      setDraft(alignerParSite(next, projet));
      refresh();
    }
  }

  function onValiderPdf() {
    if (!projet || !draft) return;
    const p = getProjetRapportActivite(projet.id);
    if (!p) return;
    enregistrerRapportValide(projet.id, draft);
    telechargerRapportActivitePdf(p, draft, draft.titreDocument);
    refresh();
    setTabMain("rapports");
  }

  function saveReglages(e: FormEvent) {
    e.preventDefault();
    if (!projet || !draft) return;
    const domaines = domEd
      .map((d) => ({
        id: d.id.trim() || crypto.randomUUID(),
        label: d.label.trim() || "Domaine",
      }))
      .filter((d) => d.id);
    const colonnes = colEd
      .map((c) => ({
        id: c.id.trim() || `col_${crypto.randomUUID().slice(0, 8)}`,
        label: c.label.trim() || "Colonne",
      }))
      .filter((c) => c.id);
    const nextDraft = enrichirBrouillonDomaines(draft, domaines);
    const projetMisAJour: RapportActiviteProjet = {
      ...projet,
      domaines,
      colonnesTableau: colonnes,
      clientNom: clientNom.trim(),
      piedPagePdf: piedPage.trim(),
      dernierePageMessage: msgFin.trim(),
      brouillon: nextDraft,
    };
    sauvegarderProjetRapportActivite(projetMisAJour);
    setDraft(alignerParSite(nextDraft, projetMisAJour));
    refresh();
    window.alert("Réglages enregistrés.");
  }

  return (
    <PageFrame
      title={projet.titre}
      actions={
        <>
          <Link
            to="/rapport-activite/accueil"
            className={frameStyles.headerCtaSecondary}
            style={{ textDecoration: "none" }}
          >
            Accueil
          </Link>
          <button
            type="button"
            className={frameStyles.headerCtaSecondary}
            onClick={() => onValiderPdf()}
          >
            Valider le rapport (PDF)
          </button>
        </>
      }
    >
      <div className={styles.page}>
        <div className={styles.tabsMain} role="tablist">
          <button
            type="button"
            className={tabMain === "redaction" ? styles.tabMainActive : styles.tabMain}
            onClick={() => setTabMain("redaction")}
          >
            Rédaction
          </button>
          <button
            type="button"
            className={tabMain === "rapports" ? styles.tabMainActive : styles.tabMain}
            onClick={() => setTabMain("rapports")}
          >
            Rapports
          </button>
          <button
            type="button"
            className={tabMain === "reglages" ? styles.tabMainActive : styles.tabMain}
            onClick={() => setTabMain("reglages")}
          >
            Réglages du projet
          </button>
        </div>

        {tabMain === "redaction" ? (
          <>
            <div className={styles.panel}>
              <div className={styles.subTabs}>
                {(
                  [
                    ["meta", "Type & en-tête"],
                    ["visuels", "Visuels"],
                    ["domaines", "Domaines"],
                    ["tableau", "Tableau de suivi"],
                    ["synthese", "Synthèse"],
                  ] as const
                ).map(([k, lab]) => (
                  <button
                    key={k}
                    type="button"
                    className={subRedac === k ? styles.subTabActive : styles.subTab}
                    onClick={() => setSubRedac(k)}
                  >
                    {lab}
                  </button>
                ))}
              </div>

              {subRedac === "meta" ? (
                <>
                  <div className={styles.fieldRow}>
                    <label className={styles.label}>
                      Type de rapport
                      <select
                        className={styles.select}
                        value={draft.typeRapport}
                        onChange={(e) => {
                          const typeRapport = e.target.value as RapportBrouillonState["typeRapport"];
                          majDraft((d) => ({ ...d, typeRapport }));
                        }}
                      >
                        <option value="simple">Rapport simple</option>
                        <option value="quotidien">Rapport quotidien</option>
                        <option value="mensuel">Rapport mensuel</option>
                        <option value="fin_mission">Rapport de fin de mission</option>
                      </select>
                    </label>
                    <label className={styles.label}>
                      Titre du document
                      <input
                        className={styles.input}
                        value={draft.titreDocument}
                        onChange={(e) =>
                          majDraft((d) => ({ ...d, titreDocument: e.target.value }))
                        }
                      />
                    </label>
                    <label className={styles.label}>
                      Date du rapport
                      <input
                        type="date"
                        className={styles.input}
                        value={draft.dateRapport.slice(0, 10)}
                        onChange={(e) =>
                          majDraft((d) => ({
                            ...d,
                            dateRapport: e.target.value,
                            moisCle: e.target.value.slice(0, 7),
                          }))
                        }
                      />
                    </label>
                    {draft.typeRapport === "mensuel" ? (
                      <label className={styles.label}>
                        Mois (mensuel)
                        <input
                          type="month"
                          className={styles.input}
                          value={(draft.moisCle ?? draft.dateRapport.slice(0, 7)).slice(0, 7)}
                          onChange={(e) =>
                            majDraft((d) => ({
                              ...d,
                              moisCle: e.target.value,
                              dateRapport: `${e.target.value}-01`,
                            }))
                          }
                        />
                      </label>
                    ) : null}
                  </div>
                  <p className={styles.hint}>
                    Quotidien : préremplissage depuis le dernier rapport quotidien
                    enregistré avant la date choisie. Mensuel : fusion des quotidiens du
                    mois. Fin de mission : mensuels si présents, sinon tous les
                    quotidiens.
                  </p>
                  <div className={styles.btnRow}>
                    <button type="button" className={styles.btn} onClick={() => onFusion()}>
                      Appliquer la fusion (préremplissage)
                    </button>
                  </div>
                </>
              ) : null}

              {subRedac !== "meta" ? (
                <div className={styles.subBar}>
                  <span className={styles.hint} style={{ margin: 0 }}>
                    Site actif :
                  </span>
                  <div className={styles.sitePills}>
                    {projet.sites.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={
                          draft.siteActifId === s.id
                            ? styles.sitePillActive
                            : styles.sitePill
                        }
                        onClick={() => majDraft((d) => ({ ...d, siteActifId: s.id }))}
                      >
                        {s.nom}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {subRedac === "visuels" ? (
                <div className={styles.panel} style={{ marginBottom: 0 }}>
                  <p className={styles.hint}>
                    Logos et couverture apparaissent sur le PDF (page de garde et dernière
                    page).
                  </p>
                  <div className={styles.fieldRow}>
                    <label className={styles.label}>
                      Logo principal (haut gauche)
                      <input
                        type="file"
                        accept="image/*"
                        className={styles.input}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          const u = await fichierVersDataUrl(f);
                          if (u) majDraft((d) => ({ ...d, visuels: { ...d.visuels, logoPrincipal: u } }));
                        }}
                      />
                    </label>
                    <label className={styles.label}>
                      Logo client (haut droite)
                      <input
                        type="file"
                        accept="image/*"
                        className={styles.input}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          const u = await fichierVersDataUrl(f);
                          if (u) majDraft((d) => ({ ...d, visuels: { ...d.visuels, logoClient: u } }));
                        }}
                      />
                    </label>
                    <label className={styles.label}>
                      Photo de couverture
                      <input
                        type="file"
                        accept="image/*"
                        className={styles.input}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          const u = await fichierVersDataUrl(f);
                          if (u) majDraft((d) => ({ ...d, visuels: { ...d.visuels, couverture: u } }));
                        }}
                      />
                    </label>
                  </div>
                  <p className={styles.hint}>Photos du site « {projet.sites.find((s) => s.id === draft.siteActifId)?.nom} »</p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className={styles.input}
                    onChange={async (e) => {
                      const files = [...(e.target.files ?? [])];
                      e.target.value = "";
                      const sid = draft.siteActifId;
                      const cur = [...(draft.visuels.photosParSite[sid] ?? [])];
                      for (const f of files) {
                        if (cur.length >= 6) break;
                        const u = await fichierVersDataUrl(f);
                        if (u) cur.push(u);
                      }
                      majDraft((d) => ({
                        ...d,
                        visuels: {
                          ...d.visuels,
                          photosParSite: { ...d.visuels.photosParSite, [sid]: cur },
                        },
                      }));
                    }}
                  />
                </div>
              ) : null}

              {subRedac === "domaines" ? (
                <div className={styles.panel} style={{ marginBottom: 0 }}>
                  {projet.domaines.map((dom) => {
                    const bloc = siteBloc.domainesTexte[dom.id] ?? {
                      texte: "",
                      photos: [],
                    };
                    return (
                      <div key={dom.id} style={{ marginBottom: "1.25rem" }}>
                        <strong>{dom.label}</strong>
                        <textarea
                          className={styles.textarea}
                          style={{ width: "100%", marginTop: "0.35rem" }}
                          value={bloc.texte}
                          onChange={(e) => {
                            const v = e.target.value;
                            majDraft((d) => {
                              const ps = { ...d.parSite };
                              const sc = { ...ps[d.siteActifId]! };
                              sc.domainesTexte = {
                                ...sc.domainesTexte,
                                [dom.id]: { ...sc.domainesTexte[dom.id]!, texte: v },
                              };
                              ps[d.siteActifId] = sc;
                              return { ...d, parSite: ps };
                            });
                          }}
                        />
                        <div className={styles.btnRow}>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className={styles.input}
                            onChange={async (e) => {
                              const files = [...(e.target.files ?? [])];
                              e.target.value = "";
                              const sid = draft.siteActifId;
                              const domId = dom.id;
                              let photos = [
                                ...(siteBloc.domainesTexte[domId]?.photos ?? []),
                              ];
                              for (const f of files) {
                                if (photos.length >= MAX_PHOTOS) break;
                                const u = await fichierVersDataUrl(f);
                                if (u) photos.push(u);
                              }
                              photos = photos.slice(0, MAX_PHOTOS);
                              majDraft((d) => {
                                const ps = { ...d.parSite };
                                const sc = { ...ps[sid]! };
                                sc.domainesTexte = {
                                  ...sc.domainesTexte,
                                  [domId]: {
                                    texte: sc.domainesTexte[domId]?.texte ?? "",
                                    photos,
                                  },
                                };
                                ps[sid] = sc;
                                return { ...d, parSite: ps };
                              });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {subRedac === "tableau" ? (
                <div className={styles.panel} style={{ marginBottom: 0 }}>
                  <div className={styles.btnRow}>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() =>
                        majDraft((d) => {
                          const ps = { ...d.parSite };
                          const sc = { ...ps[d.siteActifId]! };
                          sc.tableauLignes = [
                            ...sc.tableauLignes,
                            nouvelleLigneTableau(projet.domaines),
                          ];
                          ps[d.siteActifId] = sc;
                          return { ...d, parSite: ps };
                        })
                      }
                    >
                      Ajouter une ligne
                    </button>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          {projet.colonnesTableau.map((c) => (
                            <th key={c.id}>{c.label}</th>
                          ))}
                          <th> </th>
                        </tr>
                      </thead>
                      <tbody>
                        {siteBloc.tableauLignes.map((ligne, idx) => (
                          <tr key={ligne.id}>
                            {projet.colonnesTableau.map((c) => (
                              <td key={c.id}>
                                {c.id === "domaine" ? (
                                  <select
                                    className={styles.select}
                                    style={{ width: "100%" }}
                                    value={ligne.domaineId}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      majDraft((d) => {
                                        const ps = { ...d.parSite };
                                        const sc = { ...ps[d.siteActifId]! };
                                        const lines = [...sc.tableauLignes];
                                        lines[idx] = { ...lines[idx]!, domaineId: v };
                                        sc.tableauLignes = lines;
                                        ps[d.siteActifId] = sc;
                                        return { ...d, parSite: ps };
                                      });
                                    }}
                                  >
                                    {projet.domaines.map((dom) => (
                                      <option key={dom.id} value={dom.id}>
                                        {dom.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : c.id === COL_ETAT_ID ? (
                                  <div className={styles.etatRow}>
                                    {(["vert", "bleu", "orange", "noir"] as const).map(
                                      (ev) => (
                                        <button
                                          key={ev}
                                          type="button"
                                          className={styles.etatSq}
                                          title={ev}
                                          style={{
                                            background:
                                              ev === "vert"
                                                ? "#2e7d32"
                                                : ev === "bleu"
                                                  ? "#1565c0"
                                                  : ev === "orange"
                                                    ? "#ef6c00"
                                                    : "#212121",
                                            outline:
                                              ligne.etat === ev
                                                ? "2px solid #fff"
                                                : undefined,
                                          }}
                                          onClick={() =>
                                            majDraft((d) => {
                                              const ps = { ...d.parSite };
                                              const sc = { ...ps[d.siteActifId]! };
                                              const lines = [...sc.tableauLignes];
                                              lines[idx] = {
                                                ...lines[idx]!,
                                                etat: ligne.etat === ev ? "" : ev,
                                              };
                                              sc.tableauLignes = lines;
                                              ps[d.siteActifId] = sc;
                                              return { ...d, parSite: ps };
                                            })
                                          }
                                        />
                                      ),
                                    )}
                                  </div>
                                ) : (
                                  <input
                                    className={styles.input}
                                    style={{ width: "100%" }}
                                    value={
                                      c.id === "sujet"
                                        ? ligne.sujet
                                        : c.id === "responsable"
                                          ? ligne.responsable
                                          : c.id === "observation"
                                            ? ligne.observation
                                            : c.id === "relances"
                                              ? ligne.relances
                                              : ligne.extra[c.id] ?? ""
                                    }
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      majDraft((d) => {
                                        const ps = { ...d.parSite };
                                        const sc = { ...ps[d.siteActifId]! };
                                        const lines = [...sc.tableauLignes];
                                        const L = { ...lines[idx]! };
                                        if (c.id === "sujet") L.sujet = v;
                                        else if (c.id === "responsable") L.responsable = v;
                                        else if (c.id === "observation") L.observation = v;
                                        else if (c.id === "relances") L.relances = v;
                                        else L.extra = { ...L.extra, [c.id]: v };
                                        lines[idx] = L;
                                        sc.tableauLignes = lines;
                                        ps[d.siteActifId] = sc;
                                        return { ...d, parSite: ps };
                                      });
                                    }}
                                  />
                                )}
                              </td>
                            ))}
                            <td>
                              <button
                                type="button"
                                className={styles.btnDanger}
                                onClick={() =>
                                  majDraft((d) => {
                                    const ps = { ...d.parSite };
                                    const sc = { ...ps[d.siteActifId]! };
                                    sc.tableauLignes = sc.tableauLignes.filter(
                                      (_, i) => i !== idx,
                                    );
                                    if (sc.tableauLignes.length === 0) {
                                      sc.tableauLignes = [
                                        nouvelleLigneTableau(projet.domaines),
                                      ];
                                    }
                                    ps[d.siteActifId] = sc;
                                    return { ...d, parSite: ps };
                                  })
                                }
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {subRedac === "synthese" ? (
                <div className={styles.panel} style={{ marginBottom: 0 }}>
                  <textarea
                    className={styles.textarea}
                    style={{ width: "100%" }}
                    value={draft.syntheseGlobale}
                    onChange={(e) =>
                      majDraft((d) => ({ ...d, syntheseGlobale: e.target.value }))
                    }
                    placeholder="Synthèse globale du rapport…"
                  />
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {tabMain === "rapports" ? (
          <div className={styles.panel}>
            <p className={styles.hint}>
              Rapports validés (enregistrés). Vous pouvez supprimer une fiche ou régénérer le PDF.
            </p>
            <ul className={styles.listRapports}>
              {rapportsListe.length === 0 ? (
                <li>Aucun rapport validé pour ce projet.</li>
              ) : (
                rapportsListe.map((r) => (
                  <li key={r.id}>
                    <span>
                      {r.titreDocument} — {r.dateRapport} ({r.typeRapport})
                    </span>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => {
                        const p = getProjetRapportActivite(projet.id);
                        if (p) telechargerRapportActivitePdf(p, r.payload, r.titreDocument);
                      }}
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      className={styles.btnDanger}
                      onClick={() => {
                        if (window.confirm("Supprimer ce rapport enregistré ?")) {
                          supprimerRapportFiche(r.id);
                          refresh();
                        }
                      }}
                    >
                      Supprimer
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}

        {tabMain === "reglages" ? (
          <form className={styles.panel} onSubmit={saveReglages}>
            <label className={styles.label}>
              Nom du client (en-tête PDF)
              <input
                className={styles.input}
                value={clientNom}
                onChange={(e) => setClientNom(e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Pied de page (PDF)
              <textarea
                className={styles.textarea}
                value={piedPage}
                onChange={(e) => setPiedPage(e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Message dernière page
              <textarea
                className={styles.textarea}
                value={msgFin}
                onChange={(e) => setMsgFin(e.target.value)}
              />
            </label>
            <p className={styles.hint}>
              Domaines d’activité (rédaction par domaine) et colonnes du tableau de suivi.
              La colonne « État » utilise les quatre couleurs dans la rédaction.
            </p>
            <strong>Domaines</strong>
            <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 1rem" }}>
              {domEd.map((d, i) => (
                <li key={d.id} className={styles.fieldRow} style={{ alignItems: "flex-end" }}>
                  <label className={styles.label}>
                    Id
                    <input
                      className={styles.input}
                      value={d.id}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDomEd((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, id: v } : x)),
                        );
                      }}
                    />
                  </label>
                  <label className={styles.label}>
                    Libellé
                    <input
                      className={styles.input}
                      value={d.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDomEd((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, label: v } : x)),
                        );
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    disabled={domEd.length <= 1}
                    onClick={() =>
                      setDomEd((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={styles.btn}
              onClick={() =>
                setDomEd((prev) => [
                  ...prev,
                  { id: `dom_${crypto.randomUUID().slice(0, 8)}`, label: "Nouveau domaine" },
                ])
              }
            >
              Ajouter un domaine
            </button>

            <strong style={{ display: "block", marginTop: "1.25rem" }}>Colonnes du tableau</strong>
            <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 1rem" }}>
              {colEd.map((c, i) => (
                <li key={c.id} className={styles.fieldRow} style={{ alignItems: "flex-end" }}>
                  <label className={styles.label}>
                    Id
                    <input
                      className={styles.input}
                      value={c.id}
                      disabled={c.id === COL_ETAT_ID}
                      onChange={(e) => {
                        const v = e.target.value;
                        setColEd((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, id: v } : x)),
                        );
                      }}
                    />
                  </label>
                  <label className={styles.label}>
                    Libellé
                    <input
                      className={styles.input}
                      value={c.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setColEd((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, label: v } : x)),
                        );
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    disabled={c.id === COL_ETAT_ID || colEd.length <= 2}
                    onClick={() =>
                      setColEd((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={styles.btn}
              onClick={() =>
                setColEd((prev) => [
                  ...prev,
                  {
                    id: `col_${crypto.randomUUID().slice(0, 8)}`,
                    label: "Nouvelle colonne",
                  },
                ])
              }
            >
              Ajouter une colonne
            </button>

            <div className={styles.btnRow} style={{ marginTop: "1.25rem" }}>
              <button type="submit" className={styles.btnPrimary}>
                Enregistrer les réglages du projet
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </PageFrame>
  );
}
