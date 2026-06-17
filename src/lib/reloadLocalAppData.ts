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

export function isEmbeddedFrame(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** URL à ouvrir en plein onglet (depuis tkpro.fr / iframe). */
export function appOpenInNewTabUrl(): string {
  return window.location.href;
}
