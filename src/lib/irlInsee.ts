/** Données officielles IRL (France métropolitaine), série INSEE 001515333 */

export type IrlObservation = {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  value: number;
};

export type IrlFetchResult = IrlObservation & {
  source: "insee" | "local";
};

function parseQuarterCell(text: string): 1 | 2 | 3 | 4 | null {
  const m = text.trim().match(/^T([1-4])$/i);
  if (!m) return null;
  return Number(m[1]) as 1 | 2 | 3 | 4;
}

/** Extrait les lignes du tableau HTML renvoyé par l’ajax INSEE */
export function parseIrlTableHtml(html: string): IrlObservation[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: IrlObservation[] = [];
  for (const tr of doc.querySelectorAll("table tr")) {
    const cells = tr.querySelectorAll("td");
    if (cells.length < 3) continue;
    const year = Number.parseInt(cells[0].textContent?.trim() ?? "", 10);
    const q = parseQuarterCell(cells[1].textContent ?? "");
    const valRaw = cells[2].textContent?.trim().replace(/\s/g, "").replace(",", ".") ?? "";
    const value = Number.parseFloat(valRaw);
    if (!Number.isFinite(year) || year < 1990 || year > 2100) continue;
    if (!q || !Number.isFinite(value)) continue;
    out.push({ year, quarter: q, value });
  }
  return out;
}

function latestObservation(obs: IrlObservation[]): IrlObservation | null {
  if (!obs.length) return null;
  return [...obs].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.quarter - a.quarter;
  })[0];
}

type InseeAjaxPayload = { html?: string };

type LocalIrlFile = {
  observations?: IrlObservation[];
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
  value?: number;
};

function normalizeLocalJson(data: LocalIrlFile): IrlObservation[] {
  if (Array.isArray(data.observations) && data.observations.length) {
    return data.observations.filter(
      (o) =>
        typeof o.year === "number" &&
        [1, 2, 3, 4].includes(o.quarter) &&
        typeof o.value === "number"
    );
  }
  if (
    typeof data.year === "number" &&
    typeof data.quarter === "number" &&
    typeof data.value === "number" &&
    [1, 2, 3, 4].includes(data.quarter)
  ) {
    return [{ year: data.year, quarter: data.quarter, value: data.value }];
  }
  return [];
}

const INSEE_AJAX_PATH = "/fr/statistiques/serie/ajax/001515333";

async function fetchInseeViaProxy(): Promise<IrlObservation[] | null> {
  const url = `/proxy-insee${INSEE_AJAX_PATH}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as InseeAjaxPayload;
  if (!data.html) return null;
  const obs = parseIrlTableHtml(data.html);
  return obs.length ? obs : null;
}

async function fetchInseeDirect(): Promise<IrlObservation[] | null> {
  const url = `https://www.insee.fr${INSEE_AJAX_PATH}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as InseeAjaxPayload;
  if (!data.html) return null;
  const obs = parseIrlTableHtml(data.html);
  return obs.length ? obs : null;
}

async function fetchLocalBundle(): Promise<IrlObservation[] | null> {
  const res = await fetch("/data/irl-latest.json");
  if (!res.ok) return null;
  const data = (await res.json()) as LocalIrlFile;
  const obs = normalizeLocalJson(data);
  return obs.length ? obs : null;
}

/**
 * Dernière valeur IRL publiée.
 * - En développement : proxy Vite vers insee.fr (à jour).
 * - En production : fichier /data/irl-latest.json, puis tentative directe INSEE (souvent bloquée par CORS).
 */
export async function fetchLatestIrlObservation(): Promise<IrlFetchResult | null> {
  const attempts: { label: "insee" | "local"; fn: () => Promise<IrlObservation[] | null> }[] =
    import.meta.env.DEV
      ? [
          { label: "insee", fn: fetchInseeViaProxy },
          { label: "local", fn: fetchLocalBundle },
        ]
      : [
          { label: "local", fn: fetchLocalBundle },
          { label: "insee", fn: fetchInseeDirect },
        ];

  for (const { label, fn } of attempts) {
    try {
      const obs = await fn();
      const last = latestObservation(obs ?? []);
      if (last) {
        return { ...last, source: label === "insee" ? "insee" : "local" };
      }
    } catch {
      /* suivant */
    }
  }
  return null;
}

export function formatTrimestreIrl(year: number, quarter: number): string {
  return `T${quarter} ${year}`;
}

export function formatValeurIrlFr(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
