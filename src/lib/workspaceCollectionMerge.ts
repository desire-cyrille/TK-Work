import { DEVIS_FILE_STORAGE_KEY, mergeDevisFileJson } from "./devisFileMerge";

/**
 * Fusionne les listes partagées (devis) : les autres clés restent en
 * dernier-écriture-gagne. `incoming` écrase les clés non fusionnées.
 */
export function mergeWorkspaceEntryMaps(
  current: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...current, ...incoming };
  if (current[DEVIS_FILE_STORAGE_KEY] || incoming[DEVIS_FILE_STORAGE_KEY]) {
    out[DEVIS_FILE_STORAGE_KEY] = mergeDevisFileJson(
      current[DEVIS_FILE_STORAGE_KEY],
      incoming[DEVIS_FILE_STORAGE_KEY],
    );
  }
  return out;
}

export function mergeDevisEntryWithLocals(
  remoteEntries: Record<string, string>,
  localEntries: Record<string, string>,
  extraDevisJson?: string | null,
): Record<string, string> {
  const out: Record<string, string> = { ...remoteEntries };
  let devis = mergeDevisFileJson(
    localEntries[DEVIS_FILE_STORAGE_KEY],
    remoteEntries[DEVIS_FILE_STORAGE_KEY],
  );
  if (extraDevisJson) {
    devis = mergeDevisFileJson(devis, extraDevisJson);
  }
  if (
    localEntries[DEVIS_FILE_STORAGE_KEY] ||
    remoteEntries[DEVIS_FILE_STORAGE_KEY] ||
    extraDevisJson
  ) {
    out[DEVIS_FILE_STORAGE_KEY] = devis;
  }
  return out;
}
