/** Recharge les contextes React après un pull nuage, sans recharger la page. */
export const TK_GESTION_RELOAD_LOCAL_DATA_EVENT =
  "tk-gestion-reload-local-data";

export function notifyLocalAppDataReload(): void {
  try {
    window.dispatchEvent(new Event(TK_GESTION_RELOAD_LOCAL_DATA_EVENT));
  } catch {
    /* ignore */
  }
}

/** Ouvre l’app en plein onglet si elle est intégrée dans tkpro.fr (évite les boucles Chrome). */
export function escapeEmbeddedFrameIfNeeded(): boolean {
  try {
    if (window.self === window.top) return false;
    window.top!.location.href = window.location.href;
    return true;
  } catch {
    return false;
  }
}
