import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { LockBanner } from "../components/LockBanner";
import lockStyles from "../components/LockBanner.module.css";
import { PageFrame } from "../components/PageFrame";
import frameStyles from "../components/PageFrame.module.css";
import { useAuth } from "../context/AuthContext";
import { useWorkspaceLock } from "../hooks/useWorkspaceLock";
import { RapportPhotoImport } from "../components/RapportPhotoImport";
import {
  buildRapportPdfBlob,
  telechargerRapportPdfDepuisBlob,
  type ExportRapportPdfInput,
} from "../lib/exportRapportStructurePdf";
import {
  bornesJourPourInputDate,
  libelleDateLongFr,
  libellePeriodeMoisFr,
  moisClePour,
} from "../lib/rapportActiviteData";
import {
  alignerContenuAvecProjetSites,
  chargerRapportsEnregistres,
  collecterPhotosQuotidiensPourMensuel,
  fusionnerContenuParSiteDepuisRapports,
  fusionnerObservationsDepuisRapports,
  libelleJourFr,
  libelleMoisCleFr,
  listerMensuelsPourPeriodeMission,
  listerQuotidiensPourMoisCle,
  sauvegarderRapport,
  supprimerRapportEnregistre,
  type ContenuSiteRapport,
  type ModeRapportChain,
  type RapportEnregistre,
} from "../lib/rapportChainStorage";
import {
  axesContenuVidesPourDomaines,
  type RapportDomaineDef,
} from "../data/rapportParkingDomains";
import {
  getDomainesRapportProjet,
  getProjetById,
  mettreAJourProjetComplet,
  type RapportSiteProjet,
} from "../lib/rapportProjetStorage";
import styles from "./RapportActivite.module.css";

const MOIS_CHOIX = [
  { v: 1, l: "Janvier" },
  { v: 2, l: "Février" },
  { v: 3, l: "Mars" },
  { v: 4, l: "Avril" },
  { v: 5, l: "Mai" },
  { v: 6, l: "Juin" },
  { v: 7, l: "Juillet" },
  { v: 8, l: "Août" },
  { v: 9, l: "Septembre" },
  { v: 10, l: "Octobre" },
  { v: 11, l: "Novembre" },
  { v: 12, l: "Décembre" },
];

function formatDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function anneesOptions(): number[] {
  const y = new Date().getFullYear();
  const out: number[] = [];
  for (let a = y - 3; a <= y + 5; a++) out.push(a);
  return out;
}

function fmtCourt(d: string): string {
  const t = d.trim();
  if (!t) return "—";
  const x = new Date(t);
  if (Number.isNaN(x.getTime())) return t;
  return x.toLocaleDateString("fr-FR");
}

function debutMissionDefaut(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  d.setDate(1);
  return formatDateInput(d);
}

const RAPPEL_MODULES_INDEPENDANTS =
  "Les fonctions « Gestion de biens », « Devis » et « Rapport » sont sans lien métier entre elles. Ce document ne reprend aucune donnée locative ni financière issues du module Biens.";

const MAX_IMAGE_OCTETS = 2 * 1024 * 1024;

function lireImageVersDataUrl(f: File):
  Promise<{ ok: true; dataUrl: string } | { ok: false; raison: string }> {
  if (!f.type.startsWith("image/")) {
    return Promise.resolve({ ok: false, raison: "Choisissez un fichier image." });
  }
  if (f.size > MAX_IMAGE_OCTETS) {
    return Promise.resolve({
      ok: false,
      raison: "Image trop volumineuse (max. 2 Mo).",
    });
  }
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () =>
      resolve(
        typeof r.result === "string"
          ? { ok: true, dataUrl: r.result }
          : { ok: false, raison: "Lecture impossible." },
      );
    r.onerror = () => resolve({ ok: false, raison: "Lecture impossible." });
    r.readAsDataURL(f);
  });
}

function contenuVidePourProjetSites(
  sites: { id: string }[],
  domaines: RapportDomaineDef[],
): ContenuSiteRapport[] {
  const axes = axesContenuVidesPourDomaines(domaines);
  return sites.map((s) => ({ siteId: s.id, axes: { ...axes } }));
}

export function RapportActivite() {
  const { projetId: projetIdParam } = useParams<{ projetId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pidBrut = projetIdParam?.trim() ?? "";
  const [projetNonce, setProjetNonce] = useState(0);
  const projetCourant = useMemo(
    () => (pidBrut ? getProjetById(pidBrut) : undefined),
    [pidBrut, projetNonce],
  );
  const { isAuthenticated } = useAuth();
  const projetLock = useWorkspaceLock(
    isAuthenticated && pidBrut ? `projet:${pidBrut}` : null,
  );

  const [vueEdition, setVueEdition] = useState<"redaction" | "parametres">(
    "redaction",
  );
  const [siteOngletId, setSiteOngletId] = useState<string | null>(null);
  const [contenuParSite, setContenuParSite] = useState<ContenuSiteRapport[]>([]);
  const [apercuPdfUrl, setApercuPdfUrl] = useState<string | null>(null);
  const [paramMsg, setParamMsg] = useState<string | null>(null);

  const now = new Date();
  const [mode, setMode] = useState<ModeRapportChain>("quotidien");

  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());
  const [jourDate, setJourDate] = useState(() => formatDateInput(now));

  const [clientNom, setClientNom] = useState("");
  const [referenceMission, setReferenceMission] = useState("");
  const [missionDebut, setMissionDebut] = useState(debutMissionDefaut);
  const [missionFin, setMissionFin] = useState(() => formatDateInput(now));

  const [titre, setTitre] = useState("Rapport d’activité");
  const [observations, setObservations] = useState("");
  const [rapportEditeId, setRapportEditeId] = useState<string | null>(null);
  const [listeVersion, setListeVersion] = useState(0);
  const [provenanceSynthese, setProvenanceSynthese] = useState<string | null>(null);
  const [sourceIdsSynthese, setSourceIdsSynthese] = useState<string[] | undefined>(undefined);
  /** `null` = inclure toutes les photos quotidiennes du mois. */
  const [mensuelPhotoKeysIncluded, setMensuelPhotoKeysIncluded] = useState<
    string[] | null
  >(null);

  useEffect(() => {
    if (!pidBrut) return;
    const p = getProjetById(pidBrut);
    if (!p) return;
    const dom = getDomainesRapportProjet(p);
    setContenuParSite(contenuVidePourProjetSites(p.sites, dom));
    setSiteOngletId(p.sites[0]?.id ?? null);
    setRapportEditeId(null);
    setObservations("");
    setProvenanceSynthese(null);
    setSourceIdsSynthese(undefined);
    setMensuelPhotoKeysIncluded(null);
  }, [pidBrut]);

  function preparerNouveauMode(m: ModeRapportChain) {
    setMode(m);
    setRapportEditeId(null);
    setProvenanceSynthese(null);
    setSourceIdsSynthese(undefined);
    setMensuelPhotoKeysIncluded(null);
    if (projetCourant) {
      setContenuParSite(
        contenuVidePourProjetSites(
          projetCourant.sites,
          getDomainesRapportProjet(projetCourant),
        ),
      );
      setSiteOngletId(projetCourant.sites[0]?.id ?? null);
    }
  }

  function refreshProjet() {
    setProjetNonce((n) => n + 1);
  }

  function majSitesProjetEtContenu(sites: RapportSiteProjet[]) {
    if (!projetCourant) return;
    mettreAJourProjetComplet(projetCourant.id, { sites });
    const dom = getDomainesRapportProjet(projetCourant);
    setContenuParSite((prev) =>
      alignerContenuAvecProjetSites(prev, sites, dom),
    );
    setSiteOngletId((cur) =>
      cur && sites.some((s) => s.id === cur) ? cur : (sites[0]?.id ?? null),
    );
    refreshProjet();
  }

  const bornesQuotidien = useMemo(() => {
    return (
      bornesJourPourInputDate(jourDate) ??
      bornesJourPourInputDate(formatDateInput(new Date()))!
    );
  }, [jourDate]);

  const bornesMissionBrutes = useMemo(() => {
    const a = bornesJourPourInputDate(missionDebut);
    const b = bornesJourPourInputDate(missionFin);
    return { a, b };
  }, [missionDebut, missionFin]);

  const bornesMission = useMemo(() => {
    if (!bornesMissionBrutes.a || !bornesMissionBrutes.b) return null;
    if (bornesMissionBrutes.a.debut > bornesMissionBrutes.b.debut) return null;
    return {
      debut: bornesMissionBrutes.a.debut,
      fin: bornesMissionBrutes.b.fin,
    };
  }, [bornesMissionBrutes]);

  const missionOrdreOk = bornesMission !== null;

  const periodeLibelle =
    mode === "quotidien"
      ? libelleDateLongFr(bornesQuotidien.debut)
      : mode === "fin_mission" && bornesMission
        ? `du ${fmtCourt(missionDebut)} au ${fmtCourt(missionFin)}`
        : libellePeriodeMoisFr(mois, annee);

  const moisCleMensuel = moisClePour(annee, mois);

  const stockCourant = useMemo(() => {
    const all = chargerRapportsEnregistres();
    if (!projetCourant) return [];
    return all.filter((r) => r.projetId === projetCourant.id);
  }, [listeVersion, projetCourant]);

  const quotidiensPourMois = useMemo(() => {
    if (!projetCourant) return [];
    return listerQuotidiensPourMoisCle(moisCleMensuel, projetCourant.id);
  }, [listeVersion, moisCleMensuel, projetCourant]);

  const photosMensuelItems = useMemo(() => {
    if (!projetCourant) return [];
    return collecterPhotosQuotidiensPourMensuel(
      quotidiensPourMois,
      projetCourant.sites,
      getDomainesRapportProjet(projetCourant),
    );
  }, [quotidiensPourMois, projetCourant]);

  const mensuelsPourMission = useMemo(() => {
    if (!missionOrdreOk || !projetCourant) return [];
    return listerMensuelsPourPeriodeMission(
      missionDebut,
      missionFin,
      projetCourant.id,
    );
  }, [listeVersion, missionOrdreOk, missionDebut, missionFin, projetCourant]);

  const stockTrie = useMemo(
    () =>
      [...stockCourant].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [stockCourant],
  );

  function synthetiserDepuisQuotidiens() {
    if (!projetCourant || quotidiensPourMois.length === 0) {
      setProvenanceSynthese(
        "Aucun rapport quotidien enregistré pour ce mois — enregistrez d’abord des journées avec le même mois calendaire.",
      );
      return;
    }
    const ordre = projetCourant.sites.map((s) => s.id);
    setContenuParSite(
      fusionnerContenuParSiteDepuisRapports(
        quotidiensPourMois,
        (r) => libelleJourFr(r.jourDate ?? ""),
        ordre,
        getDomainesRapportProjet(projetCourant),
      ),
    );
    setObservations(
      fusionnerObservationsDepuisRapports(quotidiensPourMois, (r) =>
        libelleJourFr(r.jourDate ?? ""),
      ),
    );
    setSourceIdsSynthese(quotidiensPourMois.map((r) => r.id));
    setMensuelPhotoKeysIncluded(null);
    setProvenanceSynthese(
      `Synthèse chaînée : ${quotidiensPourMois.length} rapport(s) quotidien(s) — ${libellePeriodeMoisFr(mois, annee)}. Texte fusionné par domaine ; photos du mois toutes incluses par défaut (modifiable ci-dessous). À relire avant envoi.`,
    );
  }

  function synthetiserDepuisMensuels() {
    if (!projetCourant || mensuelsPourMission.length === 0) {
      setProvenanceSynthese(
        "Aucun rapport mensuel enregistré sur la période — enregistrez des mensuels ou vérifiez les dates de mission.",
      );
      return;
    }
    const ordre = projetCourant.sites.map((s) => s.id);
    setContenuParSite(
      fusionnerContenuParSiteDepuisRapports(
        mensuelsPourMission,
        (r) => libelleMoisCleFr(r.moisCle ?? ""),
        ordre,
        getDomainesRapportProjet(projetCourant),
      ),
    );
    setObservations(
      fusionnerObservationsDepuisRapports(mensuelsPourMission, (r) =>
        libelleMoisCleFr(r.moisCle ?? ""),
      ),
    );
    setSourceIdsSynthese(mensuelsPourMission.map((r) => r.id));
    setProvenanceSynthese(
      `Synthèse chaînée : ${mensuelsPourMission.length} rapport(s) mensuel(s) sur la mission. Texte fusionné ; relire avant remise client.`,
    );
  }

  function enregistrerDansLaChaine() {
    if (!projetCourant) return;
    if (mode === "fin_mission" && !missionOrdreOk) return;
    const row = sauvegarderRapport({
      id: rapportEditeId ?? undefined,
      projetId: projetCourant.id,
      mode,
      titre: titre.trim() || "Rapport",
      jourDate: mode === "quotidien" ? jourDate : undefined,
      moisCle: mode === "mensuel" ? moisCleMensuel : undefined,
      missionDebut: mode === "fin_mission" ? missionDebut : undefined,
      missionFin: mode === "fin_mission" ? missionFin : undefined,
      clientNom: mode === "fin_mission" ? clientNom : undefined,
      referenceMission: mode === "fin_mission" ? referenceMission : undefined,
      contenuParSite,
      observations,
      sourceIds: sourceIdsSynthese,
      photosMensuelSelection:
        mode === "mensuel"
          ? mensuelPhotoKeysIncluded === null
            ? undefined
            : [...mensuelPhotoKeysIncluded]
          : undefined,
    });
    setRapportEditeId(row.id);
    setListeVersion((v) => v + 1);
    setProvenanceSynthese(
      "Brouillon enregistré sur cet appareil — rechargez-le depuis « Chaîne de rapports ». Pour le voir sur un autre téléphone ou ordinateur : même compte, puis page Fonctions → Nuage (envoyer ici, récupérer ailleurs).",
    );
  }

  function chargerEnregistre(r: RapportEnregistre) {
    if (!projetCourant) return;
    setMode(r.mode);
    setTitre(r.titre);
    setContenuParSite(
      alignerContenuAvecProjetSites(
        r.contenuParSite,
        projetCourant.sites,
        getDomainesRapportProjet(projetCourant),
      ),
    );
    setSiteOngletId(projetCourant.sites[0]?.id ?? null);
    setObservations(r.observations);
    setSourceIdsSynthese(r.sourceIds);
    setRapportEditeId(r.id);
    if (r.mode === "quotidien" && r.jourDate) setJourDate(r.jourDate);
    if (r.mode === "mensuel" && r.moisCle) {
      const parts = r.moisCle.split("-").map(Number);
      if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
        setAnnee(parts[0]);
        setMois(parts[1]);
      }
    }
    if (r.mode === "fin_mission") {
      if (r.missionDebut) setMissionDebut(r.missionDebut);
      if (r.missionFin) setMissionFin(r.missionFin);
      setClientNom(r.clientNom ?? "");
      setReferenceMission(r.referenceMission ?? "");
    }
    if (r.mode === "mensuel") {
      setMensuelPhotoKeysIncluded(
        Array.isArray(r.photosMensuelSelection)
          ? [...r.photosMensuelSelection]
          : null,
      );
    } else {
      setMensuelPhotoKeysIncluded(null);
    }
    setProvenanceSynthese(
      r.sourceIds?.length
        ? `Fiche chargée — construite à partir de ${r.sourceIds.length} rapport(s) source.`
        : "Fiche chargée.",
    );
  }

  function supprimerEnregistre(id: string) {
    supprimerRapportEnregistre(id);
    if (rapportEditeId === id) {
      setRapportEditeId(null);
      if (projetCourant) {
        setContenuParSite(
          contenuVidePourProjetSites(
            projetCourant.sites,
            getDomainesRapportProjet(projetCourant),
          ),
        );
      }
      setObservations("");
      setProvenanceSynthese(null);
      setSourceIdsSynthese(undefined);
      setMensuelPhotoKeysIncluded(null);
    }
    setListeVersion((v) => v + 1);
  }

  function mensuelTogglePhotoCle(cle: string) {
    setMensuelPhotoKeysIncluded((prev) => {
      const all = photosMensuelItems.map((i) => i.cle);
      const cur = prev === null ? new Set(all) : new Set(prev);
      if (cur.has(cle)) cur.delete(cle);
      else cur.add(cle);
      if (cur.size === all.length) return null;
      return [...cur];
    });
  }

  function mensuelSetDomainePhotosAll(domainId: string, include: boolean) {
    setMensuelPhotoKeysIncluded((prev) => {
      const all = photosMensuelItems.map((i) => i.cle);
      const keysDom = photosMensuelItems
        .filter((i) => i.domainId === domainId)
        .map((i) => i.cle);
      const cur = prev === null ? new Set(all) : new Set(prev);
      for (const k of keysDom) {
        if (include) cur.add(k);
        else cur.delete(k);
      }
      if (cur.size === all.length) return null;
      return [...cur];
    });
  }

  function libelleStock(r: RapportEnregistre): string {
    if (r.mode === "quotidien" && r.jourDate)
      return `Quotidien — ${libelleJourFr(r.jourDate)}`;
    if (r.mode === "mensuel" && r.moisCle)
      return `Mensuel — ${libelleMoisCleFr(r.moisCle)}`;
    return `Fin de mission — ${fmtCourt(r.missionDebut ?? "")} → ${fmtCourt(r.missionFin ?? "")}`;
  }

  const nomFichierPrefix =
    mode === "quotidien"
      ? "rapport_quotidien_"
      : mode === "fin_mission"
        ? "rapport_fin_mission_"
        : "rapport_mensuel_";

  const typeRapportCourt =
    mode === "quotidien"
      ? "Quotidien"
      : mode === "mensuel"
        ? "Mensuel"
        : "Fin de mission";

  function construireInputPdf(): ExportRapportPdfInput | null {
    if (!projetCourant) return null;
    if (mode === "fin_mission" && !missionOrdreOk) return null;

    const doms = getDomainesRapportProjet(projetCourant);
    const photoUrlsParSiteDomain = new Map<string, string[]>();
    if (mode === "mensuel") {
      const items = collecterPhotosQuotidiensPourMensuel(
        quotidiensPourMois,
        projetCourant.sites,
        doms,
      );
      const cleIncluse = (cle: string) =>
        mensuelPhotoKeysIncluded === null
          ? true
          : mensuelPhotoKeysIncluded.includes(cle);
      for (const it of items) {
        if (!cleIncluse(it.cle)) continue;
        const mk = `${it.siteId}\t${it.domainId}`;
        const arr = photoUrlsParSiteDomain.get(mk) ?? [];
        arr.push(it.photoDataUrl);
        photoUrlsParSiteDomain.set(mk, arr);
      }
    }

    const sections = projetCourant.sites
      .map((site) => {
        const bloc = contenuParSite.find((c) => c.siteId === site.id);
        const domainesPdf = doms
          .map((d) => {
            const ax = bloc?.axes[d.id];
            const fromQuotidiens =
              photoUrlsParSiteDomain.get(`${site.id}\t${d.id}`) ?? [];
            const phAx = ax?.photoDataUrl?.trim();
            const manuelle =
              mode === "mensuel" && phAx && phAx.length > 40 ? [phAx] : [];
            const seuleAxe =
              mode !== "mensuel" && phAx && phAx.length > 40 ? [phAx] : [];
            const photoDataUrls = [
              ...fromQuotidiens,
              ...manuelle,
              ...seuleAxe,
            ];
            const hasPhotos = photoDataUrls.length > 0;
            const hasText = Boolean((ax?.texte ?? "").trim());
            if (!hasText && !hasPhotos) return null;
            return {
              titre: d.label,
              texte: ax?.texte ?? "",
              photoDataUrls: hasPhotos ? photoDataUrls : undefined,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        return {
          siteNom: site.nom,
          sitePhotoDataUrl: site.photoDataUrl,
          domaines: domainesPdf,
        };
      })
      .filter((s) => s.domaines.length > 0 || Boolean(s.sitePhotoDataUrl));

    return {
      projetTitre: projetCourant.titre,
      couvertureDataUrl: projetCourant.couvertureDataUrl,
      logoDataUrl: projetCourant.logoDataUrl,
      logoClientDataUrl: projetCourant.logoClientDataUrl,
      titreBandeau: `${projetCourant.titre} — Rapport d’activité`,
      typeRapportLibelle: typeRapportCourt,
      titreDocument: titre.trim() || "Rapport d’activité",
      periodeLibelle,
      genereLeLibelle: `Document généré le ${new Date().toLocaleString("fr-FR")}`,
      sitesNomsListe: projetCourant.sites.map((s) => s.nom),
      coordonneesEmetteur: projetCourant.coordonneesEmetteur,
      clientRaisonSociale: projetCourant.clientRaisonSociale,
      clientCoordonnees: projetCourant.clientCoordonnees,
      missionLignes:
        mode === "fin_mission"
          ? [
              clientNom.trim() ? `Client (mission) : ${clientNom.trim()}` : "",
              referenceMission.trim()
                ? `Mission : ${referenceMission.trim()}`
                : "",
              `Période : du ${fmtCourt(missionDebut)} au ${fmtCourt(missionFin)}`,
            ].filter(Boolean)
          : undefined,
      sectionsParSite: sections,
      synthese: observations,
      piedDePage:
        projetCourant.piedDePageRapport?.trim() ||
        "Document généré depuis le module Rapport — données locales.",
      nomFichierPrefix,
    };
  }

  function ouvrirApercuValidation() {
    const input = construireInputPdf();
    if (!input) return;
    setApercuPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(buildRapportPdfBlob(input));
    });
  }

  function telechargerPdfExport() {
    const input = construireInputPdf();
    if (!input) return;
    const blob = buildRapportPdfBlob(input);
    telechargerRapportPdfDepuisBlob(input, blob);
  }

  function setAxeTexte(siteId: string, key: string, texte: string) {
    setContenuParSite((prev) =>
      prev.map((c) =>
        c.siteId !== siteId
          ? c
          : {
              ...c,
              axes: {
                ...c.axes,
                [key]: { ...(c.axes[key] ?? { texte: "" }), texte },
              },
            },
      ),
    );
  }

  function setAxePhotoDataUrl(
    siteId: string,
    key: string,
    photoDataUrl: string | undefined,
  ) {
    setContenuParSite((prev) =>
      prev.map((c) =>
        c.siteId !== siteId
          ? c
          : {
              ...c,
              axes: {
                ...c.axes,
                [key]: {
                  ...(c.axes[key] ?? { texte: "" }),
                  photoDataUrl,
                },
              },
            },
      ),
    );
  }

  function majDomainesEtContenu(next: RapportDomaineDef[]) {
    if (!projetCourant) return;
    if (next.length === 0) return;
    mettreAJourProjetComplet(projetCourant.id, { domainesRapport: next });
    refreshProjet();
    const p2 = getProjetById(projetCourant.id);
    if (p2) {
      setContenuParSite((prev) =>
        alignerContenuAvecProjetSites(
          prev,
          p2.sites,
          getDomainesRapportProjet(p2),
        ),
      );
    }
  }

  async function appliquerPhotoDomaine(
    sid: string,
    key: string,
    file: File,
  ) {
    if (!sid) return;
    const r = await lireImageVersDataUrl(file);
    if (!r.ok) {
      setProvenanceSynthese(r.raison);
      return;
    }
    setAxePhotoDataUrl(sid, key, r.dataUrl);
    setProvenanceSynthese(null);
  }

  useEffect(() => {
    return () => {
      if (apercuPdfUrl) URL.revokeObjectURL(apercuPdfUrl);
    };
  }, [apercuPdfUrl]);

  const idChargerUrl = searchParams.get("charger")?.trim() ?? "";

  useEffect(() => {
    if (!projetCourant || !idChargerUrl) return;
    const r = chargerRapportsEnregistres().find(
      (x) => x.id === idChargerUrl && x.projetId === projetCourant.id,
    );
    if (r) {
      chargerEnregistre(r);
      setVueEdition("redaction");
    }
    setSearchParams(
      (prev) => {
        const q = new URLSearchParams(prev);
        if (!q.has("charger")) return prev;
        q.delete("charger");
        return q;
      },
      { replace: true },
    );
  }, [projetCourant, idChargerUrl, setSearchParams]);

  const syntheseTitre =
    mode === "quotidien"
      ? `Synthèse — ${bornesQuotidien.debut.toLocaleDateString("fr-FR")}`
      : mode === "fin_mission"
        ? `Synthèse — mission (${fmtCourt(missionDebut)} – ${fmtCourt(missionFin)})`
        : `Synthèse — ${libellePeriodeMoisFr(mois, annee)}`;

  const placeholderObs =
    mode === "quotidien"
      ? "Ex. : visites, courriers, relances, décisions prises dans la journée…"
      : mode === "fin_mission"
        ? "Ex. : livrables remis au client, points restant ouverts, recommandations…"
        : "Ex. : bilan du mois, objectifs suivants…";

  if (!pidBrut || !projetCourant) {
    return <Navigate to="/rapport-activite/projets" replace />;
  }

  const siteIdActifStrip =
    siteOngletId ?? projetCourant.sites[0]?.id ?? "";
  const siteActifStrip = projetCourant.sites.find(
    (s) => s.id === siteIdActifStrip,
  );

  const blockRapport =
    isAuthenticated && projetLock.ready && !projetLock.canEdit;

  const redactionActionsDisabled =
    blockRapport ||
    vueEdition === "parametres" ||
    (mode === "fin_mission" && !missionOrdreOk);

  return (
    <div className={lockStyles.wrap}>
      {blockRapport && projetLock.lockedByLabel ? (
        <LockBanner
          message={`Ce projet est en cours de modification par ${projetLock.lockedByLabel}. Lecture seule.`}
        />
      ) : null}
      <div className={lockStyles.body}>
        <PageFrame
      title={`Rapports — ${projetCourant.titre}`}
      actions={
        <>
          <button
            type="button"
            className={frameStyles.headerCtaSecondary}
            onClick={() => navigate("/rapport-activite/projets")}
          >
            Projets
          </button>
          <button
            type="button"
            className={frameStyles.headerCtaSecondary}
            onClick={() =>
              navigate(`/rapport-activite/projet/${projetCourant.id}/rapports`)
            }
          >
            Liste des rapports
          </button>
          <button
            type="button"
            className={frameStyles.headerCtaSecondary}
            onClick={ouvrirApercuValidation}
            disabled={redactionActionsDisabled}
          >
            Aperçu du rapport
          </button>
          <button
            type="button"
            className={frameStyles.headerCta}
            onClick={telechargerPdfExport}
            disabled={redactionActionsDisabled}
          >
            Télécharger le PDF
          </button>
        </>
      }
    >
      <div className={styles.page}>
        {projetCourant.archived ? (
          <p className={styles.intro}>
            <strong>Projet archivé.</strong> Vous pouvez consulter et modifier les
            rapports ici. Pour remettre le projet dans la liste principale, ouvrez{" "}
            <Link to="/rapport-activite/archive">Archive</Link> puis « Restaurer
            ».
          </p>
        ) : null}
        <p className={styles.syncHint}>
          <strong>Autres appareils :</strong> projets et rapports (textes et
          photos) font partie de la{" "}
          <strong>copie nuage partagée</strong>. Ouvrez{" "}
          <Link className={styles.syncHintLink} to="/fonctions#nuage">
            Fonctions → Nuage
          </Link>{" "}
          (fonction Biens) : envoyez depuis l’appareil où vous travaillez,
          récupérez sur mobile ou un autre poste avec n’importe quel compte.
        </p>
        <div className={styles.editionTopTabs}>
          <button
            type="button"
            className={
              vueEdition === "redaction"
                ? styles.editionTabOn
                : styles.editionTabOff
            }
            onClick={() => setVueEdition("redaction")}
          >
            Rédaction du rapport
          </button>
          <button
            type="button"
            className={
              vueEdition === "parametres"
                ? styles.editionTabOn
                : styles.editionTabOff
            }
            onClick={() => {
              setVueEdition("parametres");
              setParamMsg(null);
            }}
          >
            Paramètres du projet
          </button>
        </div>

        {vueEdition === "parametres" && projetCourant ? (
          <div className={styles.paramCard}>
            <h2 className={styles.paramTitle}>Présentation PDF et jeu de sites</h2>
            <p className={styles.paramIntro}>
              <strong>Logos</strong> : principal à gauche, client à droite sur le bandeau
              (page de garde et en-têtes des sections site). Couverture, coordonnées,
              client, pied de page et <strong>sites</strong> (nom + photo optionnelle).
              Ces réglages s’appliquent aux aperçus et exports de ce projet.
            </p>
            {paramMsg ? <p className={styles.paramMsg}>{paramMsg}</p> : null}

            <div className={styles.paramGrid}>
              <div className={styles.field}>
                <span>Logo principal (haut à gauche du rapport)</span>
                <RapportPhotoImport
                  inputId={`param-logo-prin-${projetCourant.id}`}
                  previewSrc={projetCourant.logoDataUrl}
                  previewAlt="Aperçu logo principal"
                  onClearPreview={
                    projetCourant.logoDataUrl
                      ? () => {
                          mettreAJourProjetComplet(projetCourant.id, {
                            logoDataUrl: "",
                          });
                          refreshProjet();
                        }
                      : undefined
                  }
                  clearPreviewLabel="Retirer le logo principal"
                  onPick={async (f) => {
                    const r = await lireImageVersDataUrl(f);
                    if (!r.ok) {
                      setParamMsg(r.raison);
                      return;
                    }
                    mettreAJourProjetComplet(projetCourant.id, {
                      logoDataUrl: r.dataUrl,
                    });
                    refreshProjet();
                    setParamMsg(null);
                  }}
                />
              </div>
              <div className={styles.field}>
                <span>Logo client (haut à droite du rapport)</span>
                <RapportPhotoImport
                  inputId={`param-logo-cli-${projetCourant.id}`}
                  previewSrc={projetCourant.logoClientDataUrl}
                  previewAlt="Aperçu logo client"
                  onClearPreview={
                    projetCourant.logoClientDataUrl
                      ? () => {
                          mettreAJourProjetComplet(projetCourant.id, {
                            logoClientDataUrl: "",
                          });
                          refreshProjet();
                        }
                      : undefined
                  }
                  clearPreviewLabel="Retirer le logo client"
                  onPick={async (f) => {
                    const r = await lireImageVersDataUrl(f);
                    if (!r.ok) {
                      setParamMsg(r.raison);
                      return;
                    }
                    mettreAJourProjetComplet(projetCourant.id, {
                      logoClientDataUrl: r.dataUrl,
                    });
                    refreshProjet();
                    setParamMsg(null);
                  }}
                />
              </div>
              <div className={styles.field}>
                <span>Photo de couverture (page de garde)</span>
                <RapportPhotoImport
                  inputId={`param-couv-${projetCourant.id}`}
                  previewVariant="cover"
                  previewSrc={projetCourant.couvertureDataUrl}
                  previewAlt="Aperçu couverture"
                  onClearPreview={
                    projetCourant.couvertureDataUrl
                      ? () => {
                          mettreAJourProjetComplet(projetCourant.id, {
                            couvertureDataUrl: "",
                          });
                          refreshProjet();
                        }
                      : undefined
                  }
                  clearPreviewLabel="Retirer la photo de couverture"
                  onPick={async (f) => {
                    const r = await lireImageVersDataUrl(f);
                    if (!r.ok) {
                      setParamMsg(r.raison);
                      return;
                    }
                    mettreAJourProjetComplet(projetCourant.id, {
                      couvertureDataUrl: r.dataUrl,
                    });
                    refreshProjet();
                    setParamMsg(null);
                  }}
                />
              </div>
            </div>

            <label className={styles.field}>
              <span>Coordonnées émetteur (plumeau, adresse, SIRET…)</span>
              <textarea
                className={styles.paramTextarea}
                rows={4}
                defaultValue={projetCourant.coordonneesEmetteur ?? ""}
                key={`emi-${projetCourant.updatedAt}`}
                onBlur={(e) => {
                  mettreAJourProjetComplet(projetCourant.id, {
                    coordonneesEmetteur: e.target.value,
                  });
                  refreshProjet();
                }}
              />
            </label>

            <div className={styles.paramGrid}>
              <label className={styles.field}>
                <span>Client — raison sociale ou nom</span>
                <input
                  className={styles.paramInput}
                  defaultValue={projetCourant.clientRaisonSociale ?? ""}
                  key={`cr-${projetCourant.updatedAt}`}
                  onBlur={(e) => {
                    mettreAJourProjetComplet(projetCourant.id, {
                      clientRaisonSociale: e.target.value,
                    });
                    refreshProjet();
                  }}
                />
              </label>
              <label className={styles.field}>
                <span>Client — coordonnées (adresse, contacts…)</span>
                <textarea
                  className={styles.paramTextarea}
                  rows={3}
                  defaultValue={projetCourant.clientCoordonnees ?? ""}
                  key={`cc-${projetCourant.updatedAt}`}
                  onBlur={(e) => {
                    mettreAJourProjetComplet(projetCourant.id, {
                      clientCoordonnees: e.target.value,
                    });
                    refreshProjet();
                  }}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Indications de pied de page (sur chaque page du PDF)</span>
              <textarea
                className={styles.paramTextarea}
                rows={2}
                defaultValue={projetCourant.piedDePageRapport ?? ""}
                key={`pp-${projetCourant.updatedAt}`}
                onBlur={(e) => {
                  mettreAJourProjetComplet(projetCourant.id, {
                    piedDePageRapport: e.target.value,
                  });
                  refreshProjet();
                }}
              />
            </label>

            <h3 className={styles.paramSitesTitle}>Domaines du rapport</h3>
            <p className={styles.paramDomainesIntro}>
              Libellés et textes d’aide pour chaque bloc (rédaction et PDF). Valeurs par
              défaut modifiables ; au moins un domaine.
            </p>
            <ul className={styles.paramDomainesList}>
              {projetCourant.domainesRapport.map((d, idx) => (
                <li key={d.id} className={styles.paramDomaineRow}>
                  <input
                    className={styles.paramInput}
                    defaultValue={d.label}
                    aria-label={`Libellé domaine ${idx + 1}`}
                    key={`dl-${d.id}-${projetCourant.updatedAt}`}
                    onBlur={(e) => {
                      const label = e.target.value.trim() || d.label;
                      const next = projetCourant.domainesRapport.map((x) =>
                        x.id === d.id ? { ...x, label } : x,
                      );
                      majDomainesEtContenu(next);
                    }}
                  />
                  <textarea
                    className={styles.paramTextarea}
                    rows={2}
                    placeholder="Texte d’aide sous le titre"
                    defaultValue={d.hint}
                    key={`dh-${d.id}-${projetCourant.updatedAt}`}
                    onBlur={(e) => {
                      const hint = e.target.value;
                      const next = projetCourant.domainesRapport.map((x) =>
                        x.id === d.id ? { ...x, hint } : x,
                      );
                      majDomainesEtContenu(next);
                    }}
                  />
                  <button
                    type="button"
                    className={styles.paramDelSite}
                    disabled={projetCourant.domainesRapport.length <= 1}
                    onClick={() => {
                      if (projetCourant.domainesRapport.length <= 1) return;
                      majDomainesEtContenu(
                        projetCourant.domainesRapport.filter((x) => x.id !== d.id),
                      );
                    }}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={frameStyles.headerCtaSecondary}
              onClick={() => {
                const id = crypto.randomUUID();
                majDomainesEtContenu([
                  ...projetCourant.domainesRapport,
                  { id, label: "Nouveau domaine", hint: "" },
                ]);
              }}
            >
              Ajouter un domaine
            </button>

            <h3 className={styles.paramSitesTitle}>Sites du projet</h3>
            <ul className={styles.paramSitesList}>
              {projetCourant.sites.map((site, idx) => (
                <li key={site.id} className={styles.paramSiteRow}>
                  <input
                    className={styles.paramInput}
                    defaultValue={site.nom}
                    aria-label={`Nom site ${idx + 1}`}
                    onBlur={(e) => {
                      const nom = e.target.value.trim() || site.nom;
                      const next = projetCourant.sites.map((s, i) =>
                        i === idx ? { ...s, nom } : s,
                      );
                      majSitesProjetEtContenu(next);
                    }}
                  />
                  <div className={styles.paramSitePhotoCol}>
                    <span className={styles.paramSitePhotoLabel}>Photo du site</span>
                    <RapportPhotoImport
                      compact
                      previewVariant="compact"
                      previewSrc={site.photoDataUrl}
                      previewAlt={`Aperçu photo ${site.nom}`}
                      onClearPreview={
                        site.photoDataUrl
                          ? () => {
                              const next = projetCourant.sites.map((s, i) =>
                                i === idx ? { ...s, photoDataUrl: undefined } : s,
                              );
                              majSitesProjetEtContenu(next);
                            }
                          : undefined
                      }
                      clearPreviewLabel="Retirer la photo"
                      inputId={`param-site-photo-${site.id}`}
                      onPick={async (f) => {
                        const r = await lireImageVersDataUrl(f);
                        if (!r.ok) {
                          setParamMsg(r.raison);
                          return;
                        }
                        const next = projetCourant.sites.map((s, i) =>
                          i === idx ? { ...s, photoDataUrl: r.dataUrl } : s,
                        );
                        majSitesProjetEtContenu(next);
                        setParamMsg(null);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.paramDelSite}
                    disabled={projetCourant.sites.length <= 1}
                    onClick={() => {
                      if (projetCourant.sites.length <= 1) return;
                      const next = projetCourant.sites.filter((_, i) => i !== idx);
                      majSitesProjetEtContenu(next);
                    }}
                  >
                    Supprimer le site
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={frameStyles.headerCtaSecondary}
              onClick={() => {
                const id = crypto.randomUUID();
                const next: RapportSiteProjet[] = [
                  ...projetCourant.sites,
                  { id, nom: `Site ${projetCourant.sites.length + 1}` },
                ];
                majSitesProjetEtContenu(next);
              }}
            >
              Ajouter un site
            </button>
          </div>
        ) : null}

        {vueEdition === "redaction" ? (
          <>
            <p className={styles.intro}>
              <strong>{RAPPEL_MODULES_INDEPENDANTS}</strong> Présentation du rapport
              façon intercalaires par site : chaque domaine vide est omis dans le PDF.
            </p>
            {provenanceSynthese ? (
              <div className={styles.provenanceBanner}>
                <p className={styles.provenanceText}>{provenanceSynthese}</p>
                <button
                  type="button"
                  className={styles.provenanceClose}
                  onClick={() => setProvenanceSynthese(null)}
                >
                  Fermer
                </button>
              </div>
            ) : null}

            <div className={styles.formCard}>
          <div className={styles.modeRow}>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === "quotidien" ? styles.modeBtnActive : ""}`}
              onClick={() => preparerNouveauMode("quotidien")}
            >
              Quotidien
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === "fin_mission" ? styles.modeBtnActive : ""}`}
              onClick={() => preparerNouveauMode("fin_mission")}
            >
              Fin de mission
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === "mensuel" ? styles.modeBtnActive : ""}`}
              onClick={() => preparerNouveauMode("mensuel")}
            >
              Mensuel
            </button>
          </div>

          {mode === "fin_mission" && !missionOrdreOk ? (
            <p className={styles.hintWarn}>
              La date de début de mission doit précéder (ou égaler) la date de
              fin. Corrigez les dates pour activer l’aperçu et l’export.
            </p>
          ) : null}

          <div className={styles.formRow}>
            <div className={styles.field} style={{ flex: "2 1 16rem" }}>
              <label htmlFor="rapport-titre">Titre du document</label>
              <input
                id="rapport-titre"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
              />
            </div>

            {mode === "quotidien" ? (
              <div className={styles.field}>
                <label htmlFor="rapport-jour">Jour du rapport</label>
                <input
                  id="rapport-jour"
                  type="date"
                  value={jourDate}
                  onChange={(e) => setJourDate(e.target.value)}
                />
              </div>
            ) : null}

            {mode === "mensuel" ? (
              <>
                <div className={styles.field}>
                  <label htmlFor="rapport-mois">Mois</label>
                  <select
                    id="rapport-mois"
                    value={mois}
                    onChange={(e) => {
                      setMois(Number(e.target.value));
                      setMensuelPhotoKeysIncluded(null);
                    }}
                  >
                    {MOIS_CHOIX.map((m) => (
                      <option key={m.v} value={m.v}>
                        {m.l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="rapport-annee">Année</label>
                  <select
                    id="rapport-annee"
                    value={annee}
                    onChange={(e) => {
                      setAnnee(Number(e.target.value));
                      setMensuelPhotoKeysIncluded(null);
                    }}
                  >
                    {anneesOptions().map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
          </div>

          {mode === "mensuel" ? (
            <div className={styles.chainBar}>
              <p className={styles.chainBarText}>
                <strong>{quotidiensPourMois.length}</strong> rapport(s) quotidien(s)
                enregistré(s) pour {libellePeriodeMoisFr(mois, annee)}.
              </p>
              <button
                type="button"
                className={frameStyles.headerCtaSecondary}
                onClick={synthetiserDepuisQuotidiens}
              >
                Synthétiser depuis les quotidiens du mois
              </button>
            </div>
          ) : null}

          {mode === "mensuel" && photosMensuelItems.length > 0 ? (
            <div className={styles.mensuelPhotosCard}>
              <h3 className={styles.mensuelPhotosTitle}>
                Photos des quotidiens (PDF mensuel)
              </h3>
              <p className={styles.mensuelPhotosIntro}>
                Par domaine, choisissez les clichés à inclure dans le rapport. Par défaut,
                elles sont toutes incluses (ou après « Synthétiser »). « Enregistrer » mémorise
                votre sélection avec le brouillon mensuel.
              </p>
              <div className={styles.mensuelPhotosGlobalActions}>
                <button
                  type="button"
                  className={frameStyles.headerCtaSecondary}
                  onClick={() => setMensuelPhotoKeysIncluded(null)}
                >
                  Tout inclure (mois)
                </button>
              </div>
              {getDomainesRapportProjet(projetCourant).map((d) => {
                const items = photosMensuelItems.filter((i) => i.domainId === d.id);
                if (!items.length) return null;
                return (
                  <div key={d.id} className={styles.mensuelPhotosDomain}>
                    <div className={styles.mensuelPhotosDomainHead}>
                      <h4 className={styles.mensuelPhotosDomainTitle}>{d.label}</h4>
                      <div className={styles.mensuelPhotosDomainActions}>
                        <button
                          type="button"
                          className={styles.mensuelPhotosDomainBtn}
                          onClick={() => mensuelSetDomainePhotosAll(d.id, true)}
                        >
                          Tout inclure
                        </button>
                        <button
                          type="button"
                          className={styles.mensuelPhotosDomainBtn}
                          onClick={() => mensuelSetDomainePhotosAll(d.id, false)}
                        >
                          Tout exclure
                        </button>
                      </div>
                    </div>
                    <ul className={styles.mensuelPhotosGrid}>
                      {items.map((it) => {
                        const checked =
                          mensuelPhotoKeysIncluded === null ||
                          mensuelPhotoKeysIncluded.includes(it.cle);
                        return (
                          <li key={it.cle} className={styles.mensuelPhotosItem}>
                            <label className={styles.mensuelPhotosLabel}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => mensuelTogglePhotoCle(it.cle)}
                              />
                              <span className={styles.mensuelPhotosThumbWrap}>
                                <img
                                  src={it.photoDataUrl}
                                  alt=""
                                  className={styles.mensuelPhotosThumb}
                                />
                              </span>
                              <span className={styles.mensuelPhotosMeta}>
                                {libelleJourFr(it.jourDate ?? "")} — {it.siteNom}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : null}

          {mode === "fin_mission" ? (
            <>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label htmlFor="rapport-client">Client</label>
                  <input
                    id="rapport-client"
                    value={clientNom}
                    onChange={(e) => setClientNom(e.target.value)}
                    placeholder="Nom ou organisme"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="rapport-ref">Réf. mission / dossier</label>
                  <input
                    id="rapport-ref"
                    value={referenceMission}
                    onChange={(e) => setReferenceMission(e.target.value)}
                    placeholder="Optionnel"
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label htmlFor="mission-debut">Début de mission</label>
                  <input
                    id="mission-debut"
                    type="date"
                    value={missionDebut}
                    onChange={(e) => setMissionDebut(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="mission-fin">Fin de mission</label>
                  <input
                    id="mission-fin"
                    type="date"
                    value={missionFin}
                    onChange={(e) => setMissionFin(e.target.value)}
                  />
                </div>
              </div>
              {missionOrdreOk ? (
                <div className={styles.chainBar}>
                  <p className={styles.chainBarText}>
                    <strong>{mensuelsPourMission.length}</strong> rapport(s)
                    mensuel(s) enregistré(s) entre {fmtCourt(missionDebut)} et{" "}
                    {fmtCourt(missionFin)}.
                  </p>
                  <button
                    type="button"
                    className={frameStyles.headerCtaSecondary}
                    onClick={synthetiserDepuisMensuels}
                  >
                    Synthétiser depuis les mensuels de la mission
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

              <p className={styles.titreGeneralLigne}>
                <strong>{projetCourant.titre}</strong> — Rapport d’activité —{" "}
                <strong>{typeRapportCourt}</strong>
              </p>

              <div className={styles.rapportVisuelStrip} aria-label="Aperçu logos et visuels du PDF">
                <p className={styles.rapportVisuelStripIntro}>
                  Aperçu des visuels du projet (identique au bandeau / garde du PDF)
                </p>
                <div className={styles.rapportVisuelStripGrid}>
                  {[
                    {
                      key: "logo",
                      label: "Logo principal",
                      src: projetCourant.logoDataUrl,
                      tall: false,
                    },
                    {
                      key: "logoCli",
                      label: "Logo client",
                      src: projetCourant.logoClientDataUrl,
                      tall: false,
                    },
                    {
                      key: "couv",
                      label: "Couverture",
                      src: projetCourant.couvertureDataUrl,
                      tall: true,
                    },
                    {
                      key: "site",
                      label: siteActifStrip
                        ? `Photo site — ${siteActifStrip.nom}`
                        : "Photo du site",
                      src: siteActifStrip?.photoDataUrl,
                      tall: false,
                    },
                  ].map((cell) => (
                    <div key={cell.key} className={styles.rapportVisuelCell}>
                      <span className={styles.rapportVisuelLabel}>{cell.label}</span>
                      {cell.src ? (
                        <div
                          className={
                            cell.tall
                              ? styles.rapportVisuelFrameCover
                              : styles.rapportVisuelFrame
                          }
                        >
                          <img
                            src={cell.src}
                            alt=""
                            className={styles.rapportVisuelImg}
                          />
                        </div>
                      ) : (
                        <span className={styles.rapportVisuelPlaceholder}>
                          — Aucune image — Paramètres du projet
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.redactionTopActions}>
                <p className={styles.redactionTopActionsHint}>
                  <strong>Aperçu du rapport</strong> : visualisez le PDF complet (mise en page
                  finale). Raccourci identique en haut de page et sous la synthèse.
                </p>
                <button
                  type="button"
                  className={frameStyles.headerCta}
                  onClick={ouvrirApercuValidation}
                  disabled={mode === "fin_mission" && !missionOrdreOk}
                >
                  Aperçu du rapport
                </button>
              </div>

              <div className={styles.siteTabs}>
                {projetCourant.sites.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={
                      (siteOngletId ?? projetCourant.sites[0]?.id) === s.id
                        ? styles.siteTabActive
                        : styles.siteTab
                    }
                    onClick={() => setSiteOngletId(s.id)}
                  >
                    {s.nom}
                  </button>
                ))}
              </div>

              <p className={styles.axesIntro}>
                <strong>Domaines pour ce site</strong> — texte et photo optionnelle
                par bloc (<strong>glisser-déposer</strong> ou « Parcourir »). Les
                blocs sans texte ni image sont absents du PDF.
              </p>
              <div className={styles.axesGrid}>
                {(() => {
                  const sid =
                    siteOngletId ??
                    projetCourant.sites[0]?.id ??
                    "";
                  const bloc = contenuParSite.find((c) => c.siteId === sid);
                  return getDomainesRapportProjet(projetCourant).map((d) => {
                    const inputId = `axe-file-${sid}-${d.id}`;
                    return (
                      <div key={d.id} className={`${styles.field} ${styles.axeField}`}>
                        <label htmlFor={`axe-${sid}-${d.id}`}>
                          {d.label}
                          <span className={styles.axeHint}>{d.hint}</span>
                        </label>
                        <div className={styles.axePhotoLabel}>Photo du domaine</div>
                        <RapportPhotoImport
                          inputId={inputId}
                          disabled={!sid}
                          previewSrc={bloc?.axes[d.id]?.photoDataUrl}
                          onClearPreview={
                            bloc?.axes[d.id]?.photoDataUrl
                              ? () => setAxePhotoDataUrl(sid, d.id, undefined)
                              : undefined
                          }
                          clearPreviewLabel="Retirer la photo"
                          onPick={(f) => void appliquerPhotoDomaine(sid, d.id, f)}
                        />
                        <textarea
                          id={`axe-${sid}-${d.id}`}
                          value={bloc?.axes[d.id]?.texte ?? ""}
                          onChange={(e) => setAxeTexte(sid, d.id, e.target.value)}
                          placeholder="—"
                        />
                      </div>
                    );
                  });
                })()}
              </div>

              <div className={styles.field}>
                <label htmlFor="rapport-obs">
                  Synthèse et notes complémentaires (conclusions, risques, suite)
                </label>
                <textarea
                  id="rapport-obs"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder={placeholderObs}
                />
              </div>
              <p className={styles.exportNote}>
                <strong>Enregistrer</strong> sauvegarde le brouillon localement ; à droite,{" "}
                <strong>Valider</strong> ouvre l’édition / aperçu PDF du rapport (raccourcis « Aperçu
                du rapport » en haut de page et sous les visuels). <strong>Télécharger le PDF</strong>{" "}
                est en haut à droite. Seuls les domaines et photos renseignés sont exportés.
              </p>
              <div className={styles.redactionBottomActions}>
                <button
                  type="button"
                  className={frameStyles.headerCtaSecondary}
                  onClick={enregistrerDansLaChaine}
                  disabled={mode === "fin_mission" && !missionOrdreOk}
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  className={frameStyles.headerCta}
                  onClick={ouvrirApercuValidation}
                  disabled={mode === "fin_mission" && !missionOrdreOk}
                >
                  Valider
                </button>
              </div>
            </div>

            <div className={styles.chainListCard}>
          <h2 className={styles.chainListTitle}>Chaîne de rapports enregistrés</h2>
          <p className={styles.chainListIntro}>
            Données stockées dans ce navigateur. Même date de jour = mise à jour
            du même brouillon quotidien ; même mois = mensuel unique ; même mission
            (client + dates) = fin de mission unique.
          </p>
          {rapportEditeId ? (
            <p className={styles.chainEditNote}>
              Édition liée à l’enregistrement :{" "}
              <code className={styles.chainCode}>{rapportEditeId.slice(0, 8)}…</code>
            </p>
          ) : null}
          {stockTrie.length === 0 ? (
            <p className={styles.emptyTable}>Aucun rapport enregistré pour l’instant.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Période</th>
                    <th>Titre</th>
                    <th>Sources</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stockTrie.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.mode === "quotidien"
                          ? "Quotidien"
                          : r.mode === "mensuel"
                            ? "Mensuel"
                            : "Fin de mission"}
                      </td>
                      <td>{libelleStock(r)}</td>
                      <td>{r.titre}</td>
                      <td>
                        {r.sourceIds?.length ? r.sourceIds.length : "—"}
                      </td>
                      <td className={styles.chainActions}>
                        <button
                          type="button"
                          className={styles.chainLinkBtn}
                          onClick={() => chargerEnregistre(r)}
                        >
                          Charger
                        </button>
                        <button
                          type="button"
                          className={styles.chainDelBtn}
                          onClick={() => supprimerEnregistre(r.id)}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

            <h2 className={styles.tableTitle}>{syntheseTitre}</h2>
            <div className={styles.independencePanel}>
              <p className={styles.independencePanelText}>
                Aucune donnée de l’autre fonction n’est affichée ici. La chaîne
                d’enregistrements (tableau ci-dessus) relie uniquement vos rapports
                <strong> parking</strong> entre eux.
              </p>
            </div>
          </>
        ) : null}

        {apercuPdfUrl ? (
          <div
            className={styles.apercuBackdrop}
            role="dialog"
            aria-modal="true"
            aria-label="Aperçu du rapport PDF"
          >
            <div className={styles.apercuBox}>
              <div className={styles.apercubar}>
                <span className={styles.apercuTitle}>Aperçu du rapport</span>
                <button
                  type="button"
                  className={styles.apercuFermer}
                  onClick={() => {
                    setApercuPdfUrl((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return null;
                    });
                  }}
                >
                  Fermer
                </button>
                <button
                  type="button"
                  className={frameStyles.headerCta}
                  onClick={() => {
                    const input = construireInputPdf();
                    if (!input) return;
                    telechargerRapportPdfDepuisBlob(
                      input,
                      buildRapportPdfBlob(input),
                    );
                  }}
                >
                  Télécharger ce PDF
                </button>
              </div>
              <iframe
                title="Aperçu PDF"
                className={styles.apercuIframe}
                src={apercuPdfUrl}
              />
            </div>
          </div>
        ) : null}
      </div>
    </PageFrame>
        {blockRapport ? (
          <div className={lockStyles.overlay} aria-hidden />
        ) : null}
      </div>
    </div>
  );
}
