/** Définition d’un domaine de rapport (libellé + aide, identifiant stable). */
export type RapportDomaineDef = {
  id: string;
  label: string;
  hint: string;
};

/** Domaines par défaut à la création d’un projet (modifiables dans les paramètres). */
export const DOMAINES_DEFAUT_MISSION: RapportDomaineDef[] = [
  {
    id: "def-technique",
    label: "Technique",
    hint: "Études, dimensionnement, choix d’équipements, essais, mise en service.",
  },
  {
    id: "def-management",
    label: "Management",
    hint: "Pilotage, planning, coordination des équipes et parties prenantes.",
  },
  {
    id: "def-commercial",
    label: "Commercial",
    hint: "Propositions, négociation, suivi contractuel, relation client.",
  },
  {
    id: "def-infrastructure",
    label: "Infrastructure",
    hint: "Travaux, réseaux, aménagements, sécurité des accès et du site.",
  },
  {
    id: "def-procedure",
    label: "Procédure",
    hint: "Demandes administratives, normes, dossiers, validations, conformité.",
  },
];

/** Anciennes clés (avant domaines par projet) → id stable par défaut. */
export const LEGACY_AXE_KEY_TO_DEF_ID: Record<string, string> = {
  technique: "def-technique",
  managerial: "def-management",
  commercial: "def-commercial",
  infrastructure: "def-infrastructure",
  procedural: "def-procedure",
};

export function cloneDomainesDefaut(): RapportDomaineDef[] {
  return DOMAINES_DEFAUT_MISSION.map((d) => ({ ...d }));
}

export function axesVidesPourDomaines(
  domaines: RapportDomaineDef[],
): Record<string, string> {
  return Object.fromEntries(domaines.map((d) => [d.id, ""])) as Record<
    string,
    string
  >;
}

export function axesContenuVidesPourDomaines(
  domaines: RapportDomaineDef[],
): Record<string, AxeContenu> {
  return Object.fromEntries(
    domaines.map((d) => [d.id, { texte: "" }]),
  ) as Record<string, AxeContenu>;
}

/** Résout une clé stockée (ancienne slug ou id de domaine) vers l’id canonique du domaine. */
export function resoudreIdDomaine(
  cleStockage: string,
  domaines: RapportDomaineDef[],
): string | null {
  const mapped = LEGACY_AXE_KEY_TO_DEF_ID[cleStockage];
  if (mapped && domaines.some((d) => d.id === mapped)) return mapped;
  if (domaines.some((d) => d.id === cleStockage)) return cleStockage;
  return null;
}

/** Contenu d’un domaine (texte et photo(s) optionnelles pour le rapport / PDF). */
export type AxeContenu = {
  texte: string;
  /** Première image ; conservé pour rétrocompatibilité et exports simples. */
  photoDataUrl?: string;
  /** Plusieurs clichés par domaine (même site). */
  photosDataUrls?: string[];
};

/** @deprecated préférer les ids string par projet */
export type CleDomaine = string;

/** Liste des data URLs image valides pour un axe (legacy `photoDataUrl` + tableau). */
export function photosAxeContenu(ax: AxeContenu | undefined): string[] {
  if (!ax) return [];
  const fromArr = ax.photosDataUrls?.filter(
    (u) => typeof u === "string" && u.startsWith("data:"),
  );
  if (fromArr?.length) return fromArr;
  const one = ax.photoDataUrl?.trim();
  return one && one.startsWith("data:") && one.length > 40 ? [one] : [];
}

export function axeContenuNonVide(b: AxeContenu | undefined): boolean {
  if (!b) return false;
  if (photosAxeContenu(b).length > 0) return true;
  return Boolean(b.texte?.trim());
}
