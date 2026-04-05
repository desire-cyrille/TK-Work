/**
 * Distance routière (km) entre deux adresses.
 * 1) POST /api/geo/distance (Vercel)
 * 2) Repli navigateur : Base Adresse Nationale (FR) + OSRM (CORS public)
 * 3) En dev : proxy Vite /geo/* (Nominatim) si le repli échoue
 */

const OSRM_PUBLIC = "https://router.project-osrm.org";

async function geocodeBanDataGouv(
  q: string,
): Promise<{ lat: number; lon: number } | null> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const data = (await r.json()) as {
    features?: { geometry?: { coordinates?: [number, number] } }[];
  };
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lon, lat] = coords;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { lon, lat };
}

async function geocode(
  query: string,
  nominatimBase: string,
): Promise<{ lat: number; lon: number } | null> {
  const url = `${nominatimBase}/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const data = (await r.json()) as { lat?: string; lon?: string }[];
  const first = data[0];
  if (!first?.lat || !first?.lon) return null;
  return { lat: parseFloat(first.lat), lon: parseFloat(first.lon) };
}

async function routeDrivingKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  osrmBase: string,
): Promise<number | null> {
  const url = `${osrmBase}/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const j = (await r.json()) as {
    code?: string;
    routes?: { distance?: number }[];
  };
  if (j.code !== "Ok" || !j.routes?.[0] || typeof j.routes[0].distance !== "number") {
    return null;
  }
  return j.routes[0].distance / 1000;
}

/** Repli sans backend : BAN + OSRM (adapté à la France, CORS autorisé). */
async function distanceViaBanAndOsrmPublic(
  depart: string,
  arrivee: string,
): Promise<number> {
  const p1 = await geocodeBanDataGouv(depart);
  const p2 = await geocodeBanDataGouv(arrivee);
  if (!p1 || !p2) {
    throw new Error(
      "Adresse introuvable (essayez « ville, code postal »). Hors France : utilisez le site déployé avec l’API ou saisissez la distance à la main.",
    );
  }
  const km = await routeDrivingKm(p1.lon, p1.lat, p2.lon, p2.lat, OSRM_PUBLIC);
  if (km == null || !Number.isFinite(km)) {
    throw new Error("Itinéraire introuvable. Saisissez la distance manuellement.");
  }
  return Math.round(km * 100) / 100;
}

async function distanceViaDevProxy(depart: string, arrivee: string): Promise<number> {
  const nominatimBase = "/geo/nominatim";
  const osrmBase = "/geo/osrm";
  const p1 = await geocode(depart, nominatimBase);
  const p2 = await geocode(arrivee, nominatimBase);
  if (!p1 || !p2) {
    throw new Error(
      "Adresse introuvable. Précisez la ville ou l’adresse complète, ou saisissez la distance à la main.",
    );
  }
  const km = await routeDrivingKm(p1.lon, p1.lat, p2.lon, p2.lat, osrmBase);
  if (km == null || !Number.isFinite(km)) {
    throw new Error("Itinéraire introuvable. Saisissez la distance manuellement.");
  }
  return Math.round(km * 100) / 100;
}

async function distanceFromApi(depart: string, arrivee: string): Promise<number | null> {
  try {
    const api = await fetch("/api/geo/distance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depart, arrivee }),
    });
    const j = (await api.json().catch(() => null)) as {
      distanceKm?: number;
      message?: string;
    } | null;
    if (
      api.ok &&
      j &&
      typeof j.distanceKm === "number" &&
      Number.isFinite(j.distanceKm)
    ) {
      return Math.round(j.distanceKm * 100) / 100;
    }
    if (!api.ok && j?.message) {
      throw new Error(j.message);
    }
    return null;
  } catch (e) {
    if (e instanceof Error && e.message !== "Failed to fetch") {
      throw e;
    }
    return null;
  }
}

/**
 * @throws Error si calcul impossible (réseau, géocodage, etc.)
 */
export async function computeRouteDistanceKm(
  depart: string,
  arrivee: string,
): Promise<number> {
  const d = depart.trim();
  const a = arrivee.trim();
  if (!d || !a) {
    throw new Error("Indiquez une adresse de départ et d’arrivée.");
  }

  let fromApi: number | null = null;
  try {
    fromApi = await distanceFromApi(d, a);
  } catch (e) {
    if (e instanceof Error && e.message !== "Failed to fetch") {
      try {
        return await distanceViaBanAndOsrmPublic(d, a);
      } catch {
        throw e;
      }
    }
    fromApi = null;
  }

  if (fromApi !== null) return fromApi;

  try {
    return await distanceViaBanAndOsrmPublic(d, a);
  } catch (banErr) {
    if (import.meta.env.DEV) {
      try {
        return await distanceViaDevProxy(d, a);
      } catch {
        throw banErr instanceof Error
          ? banErr
          : new Error("Calcul de distance indisponible.");
      }
    }
    throw banErr instanceof Error
      ? banErr
      : new Error(
          "Calcul de distance indisponible. Saisissez la distance manuellement.",
        );
  }
}
