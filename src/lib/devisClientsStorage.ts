export const DEVIS_CLIENTS_STORAGE_KEY = "tk-gestion-devis-clients-v1";

export type DevisClientEnregistre = {
  id: string;
  nom: string;
  estSociete: boolean;
};

type File = { clients: DevisClientEnregistre[] };

function loadRaw(): File {
  try {
    const s = localStorage.getItem(DEVIS_CLIENTS_STORAGE_KEY);
    if (!s) return { clients: [] };
    const p = JSON.parse(s) as unknown;
    if (!p || typeof p !== "object" || !Array.isArray((p as File).clients)) {
      return { clients: [] };
    }
    return {
      clients: (p as File).clients.filter(
        (c): c is DevisClientEnregistre =>
          !!c &&
          typeof c === "object" &&
          typeof (c as DevisClientEnregistre).id === "string" &&
          typeof (c as DevisClientEnregistre).nom === "string",
      ),
    };
  } catch {
    return { clients: [] };
  }
}

function saveRaw(f: File) {
  localStorage.setItem(DEVIS_CLIENTS_STORAGE_KEY, JSON.stringify(f));
}

export function listerClientsDevis(): DevisClientEnregistre[] {
  return loadRaw().clients.sort((a, b) =>
    a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }),
  );
}

/** Mémorise le client s’il n’existe pas déjà (comparaison insensible à la casse sur le nom). */
export function memoriserClientDevis(nom: string, estSociete: boolean): void {
  const n = nom.trim();
  if (!n) return;
  const f = loadRaw();
  const exists = f.clients.some(
    (c) => c.nom.trim().toLowerCase() === n.toLowerCase(),
  );
  if (exists) return;
  f.clients.push({
    id: crypto.randomUUID(),
    nom: n,
    estSociete,
  });
  saveRaw(f);
}

export function supprimerClientDevis(id: string): void {
  const f = loadRaw();
  f.clients = f.clients.filter((c) => c.id !== id);
  saveRaw(f);
}
