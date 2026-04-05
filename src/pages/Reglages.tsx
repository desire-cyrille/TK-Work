import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { PageFrame } from "../components/PageFrame";
import { useBiens } from "../context/BiensContext";
import { useFinance } from "../context/FinanceContext";
import { useThemeSettings } from "../context/ThemeSettingsContext";
import {
  applyTkGestionBackupV1,
  downloadTkGestionBackup,
  estimateTkGestionBackupWriteBytes,
  parseTkGestionBackupJson,
} from "../lib/appDataBackup";
import { nomCompletLocataire } from "../lib/locataireUi";
import {
  DEFAULT_EMETTEUR_DOCUMENTS_PDF,
  DEFAULT_THEME,
  LOGO_DOCUMENTS_MAX_FILE_BYTES,
  type ThemeSettings,
} from "../context/themeSettingsStorage";
import styles from "./Reglages.module.css";

type TabId = "parametres" | "finances" | "profil" | "sauvegarde";

const TAB_IDS: TabId[] = ["parametres", "finances", "profil", "sauvegarde"];

function tabFromSearchParams(sp: URLSearchParams): TabId | null {
  const t = sp.get("tab");
  if (t && (TAB_IDS as string[]).includes(t)) return t as TabId;
  return null;
}

function ServerHealthCard() {
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [errDetail, setErrDetail] = useState("");

  const check = useCallback(async () => {
    setState("loading");
    setErrDetail("");
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      let data: { ok?: boolean; db?: boolean; error?: string } = {};
      try {
        data = (await r.json()) as typeof data;
      } catch {
        /* ignore */
      }
      if (r.ok && data.ok === true && data.db === true) {
        setState("ok");
        return;
      }
      setState("err");
      setErrDetail(
        data.error ??
          (r.status === 404
            ? "Route /api/health introuvable (déployez sur Vercel ou lancez vercel dev)."
            : `Réponse HTTP ${r.status}.`)
      );
    } catch (e) {
      setState("err");
      setErrDetail(
        e instanceof TypeError
          ? "Connexion refusée ou réseau. En développement : terminal 1 `npm run dev:api` (vercel dev), terminal 2 `npm run dev` — puis rechargez cette page."
          : e instanceof Error
            ? e.message
            : "Erreur inconnue."
      );
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <section className={styles.section} style={{ marginTop: "1.25rem" }}>
      <h2 className={styles.sectionTitle}>Base de données (Neon)</h2>
      <p className={styles.hint}>
        Vérifie la route <code className={styles.codeInline}>/api/health</code>{" "}
        côté Vercel. Première utilisation : dans le dossier du projet, avec un{" "}
        <code className={styles.codeInline}>DATABASE_URL</code> rempli dans{" "}
        <code className={styles.codeInline}>.env</code>, exécutez{" "}
        <code className={styles.codeInline}>npm run db:deploy</code> puis
        déployez sur Vercel.
      </p>
      <div className={styles.healthRow}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => void check()}
          disabled={state === "loading"}
        >
          {state === "loading" ? "Vérification…" : "Vérifier à nouveau"}
        </button>
        {state === "ok" ? (
          <p className={styles.healthOk}>Connecté — la base répond correctement.</p>
        ) : null}
        {state === "err" ? (
          <p className={styles.healthErr}>{errDetail || "Échec du test."}</p>
        ) : null}
        {state === "loading" ? (
          <p className={styles.healthMuted}>Test en cours…</p>
        ) : null}
      </div>
    </section>
  );
}

export function Reglages() {
  const [searchParams] = useSearchParams();
  const { settings, setSettings, updateSettings, resetSettings } =
    useThemeSettings();
  const finance = useFinance();
  const { locataires } = useBiens();
  const [tab, setTab] = useState<TabId>(
    () => tabFromSearchParams(searchParams) ?? "parametres",
  );
  const [draft, setDraft] = useState<ThemeSettings>(() => ({ ...settings }));
  const [backupMsg, setBackupMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = tabFromSearchParams(searchParams);
    if (t) setTab(t);
  }, [searchParams]);

  function syncDraftFromContext() {
    setDraft({ ...settings });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSettings({
      ...draft,
      emetteurDocumentsPdf: settings.emetteurDocumentsPdf,
    });
  }

  function onReset() {
    if (
      window.confirm(
        "Réinitialiser tous les réglages d’affichage aux valeurs par défaut ?"
      )
    ) {
      resetSettings();
      setDraft({ ...DEFAULT_THEME });
    }
  }

  if (searchParams.get("tab") === "nuage") {
    return <Navigate to="/fonctions" replace />;
  }

  return (
    <PageFrame title="Réglages">
      <div className={styles.page}>
        <div className={styles.tabs} role="tablist" aria-label="Réglages">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "parametres"}
            className={`${styles.tab} ${tab === "parametres" ? styles.tabActive : ""}`}
            onClick={() => {
              syncDraftFromContext();
              setTab("parametres");
            }}
          >
            Paramètres
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "finances"}
            className={`${styles.tab} ${tab === "finances" ? styles.tabActive : ""}`}
            onClick={() => setTab("finances")}
          >
            Finances
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "profil"}
            className={`${styles.tab} ${tab === "profil" ? styles.tabActive : ""}`}
            onClick={() => setTab("profil")}
          >
            Profil société
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sauvegarde"}
            className={`${styles.tab} ${tab === "sauvegarde" ? styles.tabActive : ""}`}
            onClick={() => {
              setBackupMsg(null);
              setTab("sauvegarde");
            }}
          >
            Sauvegarde
          </button>
        </div>

        {tab === "parametres" ? (
          <>
          <form className={styles.form} onSubmit={onSubmit}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Nom affiché (menu)</h2>
              <p className={styles.hint}>
                Texte en haut à gauche, au-dessus des liens de navigation.
              </p>
              <label className={styles.field}>
                <span className={styles.label}>Nom de la marque</span>
                <input
                  className={styles.textInput}
                  value={draft.brandName}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, brandName: e.target.value }))
                  }
                  placeholder="TK Pro Gestion"
                />
              </label>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                Couleur d’accent (bandeaux, onglets modules)
              </h2>
              <p className={styles.hint}>
                S’applique à la barre latérale du bandeau de page, aux onglets
                actifs (ex. Rapport), aux boutons principaux et au dégradé global
                de l’application. La couleur secondaire termine le dégradé ; laissez
                le champ vide pour un ton automatiquement plus foncé.
              </p>
              <label className={styles.fieldRow}>
                <span className={styles.label}>Couleur principale</span>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={pickerHex(draft.accentPrimary, "#e53935")}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, accentPrimary: e.target.value }))
                  }
                />
                <input
                  className={styles.hexInput}
                  value={draft.accentPrimary}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, accentPrimary: e.target.value }))
                  }
                  placeholder="#e53935"
                />
              </label>
              <label className={styles.fieldRow}>
                <span className={styles.label}>Couleur secondaire (dégradé)</span>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={pickerHex(
                    draft.accentSecondary.trim() || "#c62828",
                    "#c62828",
                  )}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, accentSecondary: e.target.value }))
                  }
                />
                <input
                  className={styles.hexInput}
                  value={draft.accentSecondary}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, accentSecondary: e.target.value }))
                  }
                  placeholder="vide = automatique"
                />
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() =>
                    setDraft((d) => ({ ...d, accentSecondary: "" }))
                  }
                >
                  Auto (plus foncé)
                </button>
              </label>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Colonne menu (gauche)</h2>
              <p className={styles.hint}>
                Laissez vide pour retrouver le dégradé bleu nuit par défaut.
              </p>
              <label className={styles.fieldRow}>
                <span className={styles.label}>Couleur de fond</span>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={pickerHex(draft.sidebarBg, "#11104d")}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, sidebarBg: e.target.value }))
                  }
                />
                <input
                  className={styles.hexInput}
                  value={draft.sidebarBg}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, sidebarBg: e.target.value }))
                  }
                  placeholder="vide = défaut"
                />
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() =>
                    setDraft((d) => ({ ...d, sidebarBg: "" }))
                  }
                >
                  Effacer (défaut)
                </button>
              </label>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Onglets du menu</h2>
              <label className={styles.fieldRow}>
                <span className={styles.label}>Fond — inactif</span>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={pickerHex(draft.navInactiveBg, "#3d3d3d")}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      navInactiveBg: e.target.value,
                    }))
                  }
                />
                <input
                  className={styles.hexInput}
                  value={draft.navInactiveBg}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      navInactiveBg: e.target.value,
                    }))
                  }
                  placeholder="vide = translucide défaut"
                />
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() =>
                    setDraft((d) => ({ ...d, navInactiveBg: "" }))
                  }
                >
                  Effacer (défaut)
                </button>
              </label>

              <fieldset className={styles.radioSet}>
                <legend className={styles.legend}>Onglet actif</legend>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="navActive"
                    checked={draft.navActiveMode === "gradient"}
                    onChange={() =>
                      setDraft((d) => ({ ...d, navActiveMode: "gradient" }))
                    }
                  />
                  Dégradé (couleurs d’accent ci-dessus)
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="navActive"
                    checked={draft.navActiveMode === "solid"}
                    onChange={() =>
                      setDraft((d) => ({ ...d, navActiveMode: "solid" }))
                    }
                  />
                  Couleur unie
                </label>
                {draft.navActiveMode === "solid" ? (
                  <label className={styles.fieldRow}>
                    <input
                      type="color"
                      className={styles.colorInput}
                      value={draft.navActiveSolid}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          navActiveSolid: e.target.value,
                        }))
                      }
                    />
                    <input
                      className={styles.hexInput}
                      value={draft.navActiveSolid}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          navActiveSolid: e.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
              </fieldset>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                Fond — zone de droite (contenu)
              </h2>
              <fieldset className={styles.radioSet}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="wsMode"
                    checked={draft.workspaceMode === "color"}
                    onChange={() =>
                      setDraft((d) => ({ ...d, workspaceMode: "color" }))
                    }
                  />
                  Couleur
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="wsMode"
                    checked={draft.workspaceMode === "image"}
                    onChange={() =>
                      setDraft((d) => ({ ...d, workspaceMode: "image" }))
                    }
                  />
                  Image (URL)
                </label>
              </fieldset>

              <label className={styles.fieldRow}>
                <span className={styles.label}>Couleur de fond</span>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={draft.workspaceColor}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      workspaceColor: e.target.value,
                    }))
                  }
                />
                <input
                  className={styles.hexInput}
                  value={draft.workspaceColor}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      workspaceColor: e.target.value,
                    }))
                  }
                />
              </label>

              {draft.workspaceMode === "image" ? (
                <label className={styles.field}>
                  <span className={styles.label}>
                    URL de l&apos;image (https://…)
                  </span>
                  <input
                    className={styles.textInput}
                    type="url"
                    value={draft.workspaceImage}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        workspaceImage: e.target.value,
                      }))
                    }
                    placeholder="https://exemple.com/fond.jpg"
                  />
                  <span className={styles.hint}>
                    L&apos;image remplit la zone sous le bandeau. La couleur
                    ci-dessus sert de repli si l&apos;image ne charge pas.
                  </span>
                </label>
              ) : null}
            </section>

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryBtn}>
                Appliquer
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={syncDraftFromContext}
              >
                Annuler les modifications
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={onReset}
              >
                Tout réinitialiser
              </button>
            </div>
          </form>
          <ServerHealthCard />
          </>
        ) : null}

        {tab === "finances" ? (
          <div className={styles.form}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Types de frais</h2>
              <p className={styles.hint}>
                Libellés proposés lors de l’ajout de frais sur une échéance
                (menu Finance). Ajoute ou retire des lignes ; les modifications
                sont enregistrées tout de suite.
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {finance.typesFrais.map((t) => (
                  <li
                    key={t}
                    className={styles.fieldRow}
                    style={{ marginBottom: "0.45rem" }}
                  >
                    <span style={{ flex: 1 }}>{t}</span>
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      onClick={() => finance.removeTypeFrais(t)}
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className={styles.fieldRow}
                style={{ marginTop: "0.75rem", gap: "0.5rem" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const v = String(fd.get("nouveauType") ?? "").trim();
                  if (v) finance.addTypeFrais(v);
                  e.currentTarget.reset();
                }}
              >
                <input
                  name="nouveauType"
                  className={styles.textInput}
                  placeholder="Nouveau type (ex. Eau, Syndic…)"
                />
                <button type="submit" className={styles.primaryBtn}>
                  Ajouter
                </button>
              </form>
            </section>
          </div>
        ) : null}

        {tab === "profil" ? (
          <div className={styles.form}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Émetteur des documents PDF</h2>
              <p className={styles.hint}>
                Mention en pied de page des quittances, avis d’échéance, avis de
                solde, et des PDF générés depuis les baux (« Document généré
                par … »).
              </p>
              <label className={styles.field}>
                <span className={styles.label}>Nom de l’émetteur</span>
                <input
                  className={styles.textInput}
                  value={settings.emetteurDocumentsPdf}
                  onChange={(e) =>
                    updateSettings({ emetteurDocumentsPdf: e.target.value })
                  }
                  placeholder={DEFAULT_EMETTEUR_DOCUMENTS_PDF}
                />
              </label>

              <div className={styles.field} style={{ marginTop: "1.1rem" }}>
                <span className={styles.label}>Logo des PDF (PNG ou JPEG)</span>
                <p className={styles.hint} style={{ marginBottom: "0.65rem" }}>
                  Affiché en haut à gauche des quittances, avis et des PDF
                  générés depuis les baux. Image nette, idéalement horizontale ;
                  taille max. fichier{" "}
                  {Math.round(LOGO_DOCUMENTS_MAX_FILE_BYTES / 1000)} Ko.
                </p>
                <div className={styles.logoRow}>
                  {settings.logoDocumentsPdf ? (
                    <img
                      src={settings.logoDocumentsPdf}
                      alt="Aperçu du logo PDF"
                      className={styles.logoPreview}
                    />
                  ) : null}
                  <div className={styles.logoActions}>
                    <label
                      className={`${styles.secondaryBtn} ${styles.filePickLabel}`}
                    >
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className={styles.fileInputHidden}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          if (!/^image\/(png|jpeg)$/i.test(file.type)) {
                            window.alert(
                              "Formats acceptés : PNG ou JPEG uniquement."
                            );
                            return;
                          }
                          if (file.size > LOGO_DOCUMENTS_MAX_FILE_BYTES) {
                            window.alert(
                              `Fichier trop volumineux (maximum ${Math.round(
                                LOGO_DOCUMENTS_MAX_FILE_BYTES / 1000
                              )} Ko). Réduisez la taille de l’image.`
                            );
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            const data = String(reader.result ?? "");
                            if (data.length > 2_500_000) {
                              window.alert(
                                "Image trop lourde une fois enregistrée. Choisissez un fichier plus petit."
                              );
                              return;
                            }
                            updateSettings({ logoDocumentsPdf: data });
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      Choisir un fichier…
                    </label>
                    {settings.logoDocumentsPdf ? (
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() =>
                          updateSettings({ logoDocumentsPdf: "" })
                        }
                      >
                        Retirer le logo
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Locataire de référence (bénéfice)</h2>
              <p className={styles.hint}>
                Choisis le locataire qui sert de point d’ancrage pour le bloc «
                bénéfice » (locataire au bail principal ou sous-locataire ; même
                réglage que sur la page Finance).
              </p>
              <label className={styles.field}>
                <span className={styles.label}>Locataire</span>
                <select
                  className={styles.textInput}
                  value={finance.locataireReferenceBeneficeId}
                  onChange={(e) =>
                    finance.setLocataireReferenceBeneficeId(e.target.value)
                  }
                >
                  <option value="">— Choisir —</option>
                  {locataires.map((l) => (
                    <option key={l.id} value={l.id}>
                      {nomCompletLocataire(l)}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          </div>
        ) : null}

        {tab === "sauvegarde" ? (
          <div className={styles.form}>
            {backupMsg ? (
              <p
                className={
                  backupMsg.type === "err"
                    ? styles.backupBannerErr
                    : styles.backupBannerOk
                }
                role="status"
              >
                {backupMsg.text}
              </p>
            ) : null}

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Télécharger une sauvegarde</h2>
              <p className={styles.hint}>
                Enregistre dans un fichier JSON <strong>toutes</strong> les clés
                locales de l’application (préfixes <code>tk-gestion-</code> et{" "}
                <code>tk_gestion_</code>) : biens, baux, locataires, finances,
                Airbnb, <strong>rapports d’activité et projets associés</strong>,
                thème, session / profil. Utile pour copier vos données vers un autre ordinateur
                ou vers la <strong>version en ligne</strong> (navigateur ouvert
                sur votre déploiement), ou pour archiver.
              </p>
              <p className={styles.hint}>
                <strong>Confidentialité</strong> : le fichier peut contenir des
                données personnelles et le mot de passe du profil de connexion
                (stocké localement). Conservez-le dans un endroit sûr.
              </p>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  setBackupMsg(null);
                  const n = downloadTkGestionBackup();
                  setBackupMsg({
                    type: "ok",
                    text: `Fichier téléchargé (${n} bloc(s) de données exportés).`,
                  });
                }}
              >
                Télécharger le fichier de sauvegarde
              </button>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Restaurer une sauvegarde</h2>
              <p className={styles.hint}>
                Remplace <strong>toutes</strong> les données TK Gestion
                stockées dans ce navigateur par le contenu du fichier. Les pages
                ouvertes ne verront le changement qu’après rechargement : la
                restauration redémarrera l’application automatiquement. Si les{" "}
                <strong>rapports</strong> ne réapparaissent pas, ouvrez le fichier{" "}
                <code>.json</code> et vérifiez la présence de{" "}
                <code>tk-gestion-rapports-projets-v1</code> et{" "}
                <code>tk-gestion-rapports-chain-v1</code> sous « entries » — et
                surveillez un message d’erreur de quota (photos trop lourdes).
              </p>
              <input
                ref={backupFileRef}
                type="file"
                accept="application/json,.json"
                className={styles.fileInputHidden}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setBackupMsg(null);
                  const reader = new FileReader();
                  reader.onload = () => {
                    const text = String(reader.result ?? "");
                    const parsed = parseTkGestionBackupJson(text);
                    if (!parsed.ok) {
                      setBackupMsg({ type: "err", text: parsed.error });
                      return;
                    }
                    const n = Object.keys(parsed.data.entries).length;
                    const bytes = estimateTkGestionBackupWriteBytes(parsed.data);
                    const mb = bytes / (1024 * 1024);
                    const hasRapportProjets =
                      "tk-gestion-rapports-projets-v1" in parsed.data.entries;
                    const hasRapportChain =
                      "tk-gestion-rapports-chain-v1" in parsed.data.entries;
                    const msg = [
                      `Fichier du ${new Date(parsed.data.exportedAt).toLocaleString("fr-FR")} — ${n} bloc(s) à restaurer.`,
                      `Rapports : projets ${hasRapportProjets ? "oui" : "non"}, chaîne ${hasRapportChain ? "oui" : "non"}.`,
                      mb >= 3
                        ? `Taille indicative ~${mb.toFixed(1)} Mo — risque de refus par le navigateur (quota).`
                        : "",
                    ]
                      .filter(Boolean)
                      .join("\n");
                    if (
                      !window.confirm(
                        `${msg}\n\nConfirmer la restauration ? Les données actuelles sur ce navigateur pour TK Gestion seront effacées.`,
                      )
                    ) {
                      return;
                    }
                    const applied = applyTkGestionBackupV1(parsed.data);
                    if (!applied.ok) {
                      setBackupMsg({ type: "err", text: applied.error });
                      return;
                    }
                    window.location.reload();
                  };
                  reader.onerror = () => {
                    setBackupMsg({
                      type: "err",
                      text: "Impossible de lire le fichier.",
                    });
                  };
                  reader.readAsText(file, "UTF-8");
                }}
              />
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => backupFileRef.current?.click()}
              >
                Choisir un fichier à restaurer…
              </button>
            </section>
          </div>
        ) : null}

      </div>
    </PageFrame>
  );
}

function pickerHex(value: string, fallback: string): string {
  const t = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) return t;
  return fallback;
}
