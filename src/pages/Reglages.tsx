import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
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
import {
  applyCloudPullEntries,
  clearCloudSession,
  cloudPull,
  cloudPush,
  cloudSignin,
  cloudSignup,
  getCloudEmail,
  getCloudToken,
} from "../lib/cloudSync";
import { nomCompletLocataire } from "../lib/locataireUi";
import {
  DEFAULT_EMETTEUR_DOCUMENTS_PDF,
  DEFAULT_THEME,
  LOGO_DOCUMENTS_MAX_FILE_BYTES,
  type ThemeSettings,
} from "../context/themeSettingsStorage";
import styles from "./Reglages.module.css";

type TabId = "parametres" | "finances" | "profil" | "sauvegarde" | "nuage";

function CloudSyncPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linked, setLinked] = useState(() => Boolean(getCloudToken()));
  const [linkedEmail, setLinkedEmail] = useState<string | null>(() =>
    getCloudEmail(),
  );
  const [busy, setBusy] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  function refreshLinkedState() {
    setLinked(Boolean(getCloudToken()));
    setLinkedEmail(getCloudEmail());
  }

  async function onSignup(e: FormEvent) {
    e.preventDefault();
    setCloudMsg(null);
    if (!email.trim() || password.length < 8) {
      setCloudMsg({
        type: "err",
        text: "E-mail requis et mot de passe d’au moins 8 caractères.",
      });
      return;
    }
    setBusy(true);
    const r = await cloudSignup(email.trim(), password);
    setBusy(false);
    if (!r.ok) {
      setCloudMsg({ type: "err", text: r.error });
      return;
    }
    setPassword("");
    refreshLinkedState();
    setCloudMsg({
      type: "ok",
      text: "Compte nuage créé. Utilisez « Envoyer vers le nuage » pour publier vos données.",
    });
  }

  async function onSigninCloud(e: FormEvent) {
    e.preventDefault();
    setCloudMsg(null);
    if (!email.trim() || !password) {
      setCloudMsg({ type: "err", text: "Renseignez l’e-mail et le mot de passe nuage." });
      return;
    }
    setBusy(true);
    const r = await cloudSignin(email.trim(), password);
    setBusy(false);
    if (!r.ok) {
      setCloudMsg({ type: "err", text: r.error });
      return;
    }
    setPassword("");
    refreshLinkedState();
    setCloudMsg({ type: "ok", text: "Connecté au nuage." });
  }

  async function onPull() {
    setCloudMsg(null);
    setBusy(true);
    const r = await cloudPull();
    setBusy(false);
    if (!r.ok) {
      setCloudMsg({ type: "err", text: r.error });
      return;
    }
    if (r.version === 0 || Object.keys(r.entries).length === 0) {
      setCloudMsg({
        type: "ok",
        text: "Aucune donnée sur le nuage — envoyez d’abord depuis un appareil (PC ou autre).",
      });
      return;
    }
    if (
      !window.confirm(
        "Remplacer toutes les données TK Gestion sur CET appareil par la copie stockée dans le nuage ? Votre session de connexion locale (écran de connexion) sera conservée.",
      )
    ) {
      return;
    }
    const applied = applyCloudPullEntries(r.entries);
    if (!applied.ok) {
      setCloudMsg({ type: "err", text: applied.error });
      return;
    }
    window.location.reload();
  }

  async function onPush() {
    setCloudMsg(null);
    setBusy(true);
    const r = await cloudPush();
    setBusy(false);
    if (!r.ok) {
      setCloudMsg({ type: "err", text: r.error });
      return;
    }
    setCloudMsg({
      type: "ok",
      text: "Copie envoyée. Sur un autre appareil, connectez-vous au même compte nuage puis « Récupérer depuis le nuage ».",
    });
  }

  function onDisconnectCloud() {
    clearCloudSession();
    refreshLinkedState();
    setCloudMsg({
      type: "ok",
      text: "Déconnecté du nuage (les données locales ne sont pas modifiées).",
    });
  }

  return (
    <div className={styles.form}>
      {cloudMsg ? (
        <p
          className={
            cloudMsg.type === "err"
              ? styles.backupBannerErr
              : styles.backupBannerOk
          }
          role="status"
        >
          {cloudMsg.text}
        </p>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Synchronisation entre appareils</h2>
        <p className={styles.hint}>
          Compte <strong>nuage</strong> distinct du couple e-mail / mot de passe
          de la page <strong>Connexion</strong> (accès à l’app sur cet appareil).
          Même e-mail possible, mais le mot de passe nuage est celui défini
          ici pour Neon. Dernière copie envoyée gagne (pas de fusion ligne à ligne).
          Les données « Rapports » (souvent lourdes à cause des photos) sont incluses ;
          si le total dépasse la limite par envoi, plusieurs envois sont enchaînés
          automatiquement. Si un message d’erreur de taille apparaît, allégez les images
          ou passez par une sauvegarde fichier.
        </p>
        {linked && linkedEmail ? (
          <p className={styles.hint}>
            Connecté en tant que <strong>{linkedEmail}</strong>
          </p>
        ) : null}

        {!linked ? (
          <>
            <form className={styles.field} onSubmit={onSignup}>
              <h3 className={styles.subsectionTitle}>Créer un compte nuage</h3>
              <label className={styles.field}>
                <span className={styles.label}>E-mail</span>
                <input
                  className={styles.textInput}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Mot de passe (8 caractères min.)</span>
                <input
                  className={styles.textInput}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                />
              </label>
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={busy}
              >
                Créer le compte
              </button>
            </form>
            <form
              className={styles.field}
              style={{ marginTop: "1.25rem" }}
              onSubmit={onSigninCloud}
            >
              <h3 className={styles.subsectionTitle}>Se connecter (compte existant)</h3>
              <label className={styles.field}>
                <span className={styles.label}>E-mail</span>
                <input
                  className={styles.textInput}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Mot de passe</span>
                <input
                  className={styles.textInput}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                />
              </label>
              <button
                type="submit"
                className={styles.secondaryBtn}
                disabled={busy}
              >
                Connexion nuage
              </button>
            </form>
          </>
        ) : (
          <div className={styles.cloudActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy}
              onClick={() => void onPush()}
            >
              Envoyer vers le nuage (PC → serveur)
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy}
              onClick={() => void onPull()}
            >
              Récupérer depuis le nuage (serveur → cet appareil)
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={busy}
              onClick={onDisconnectCloud}
            >
              Se déconnecter du nuage
            </button>
          </div>
        )}
      </section>
    </div>
  );
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
  const { settings, setSettings, updateSettings, resetSettings } =
    useThemeSettings();
  const finance = useFinance();
  const { locataires } = useBiens();
  const [tab, setTab] = useState<TabId>("parametres");
  const [draft, setDraft] = useState<ThemeSettings>(() => ({ ...settings }));
  const [backupMsg, setBackupMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);

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
          <button
            type="button"
            role="tab"
            aria-selected={tab === "nuage"}
            className={`${styles.tab} ${tab === "nuage" ? styles.tabActive : ""}`}
            onClick={() => {
              setBackupMsg(null);
              setTab("nuage");
            }}
          >
            Nuage
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
                  Dégradé marque (orange → rose)
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

        {tab === "nuage" ? <CloudSyncPanel /> : null}
      </div>
    </PageFrame>
  );
}

function pickerHex(value: string, fallback: string): string {
  const t = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) return t;
  return fallback;
}
