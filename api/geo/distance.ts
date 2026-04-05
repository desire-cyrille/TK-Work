import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cors, readJsonBody } from "../_lib/http";

const USER_AGENT = "TKProGestionDevis/1.0 (devis; contact via site)";

/** Géocodage France — fiable depuis Vercel (pas de blocage datacenter comme Nominatim). */
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

async function geocodeNominatim(
  q: string,
): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { lat?: string; lon?: string }[];
  const first = data[0];
  if (!first?.lat || !first?.lon) return null;
  return { lat: parseFloat(first.lat), lon: parseFloat(first.lon) };
}

async function geocodeServer(q: string): Promise<{ lat: number; lon: number } | null> {
  const fr = await geocodeBanDataGouv(q);
  if (fr) return fr;
  return geocodeNominatim(q);
}

async function routeDrivingKmServer(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const c = cors(req);
  if (c) {
    for (const [k, v] of Object.entries(c)) res.setHeader(k, v);
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed", message: "Méthode non autorisée." });
    return;
  }

  const body = readJsonBody(req) as { depart?: unknown; arrivee?: unknown } | null;
  const depart = typeof body?.depart === "string" ? body.depart.trim() : "";
  const arrivee = typeof body?.arrivee === "string" ? body.arrivee.trim() : "";
  if (!depart || !arrivee) {
    res.status(400).json({
      error: "missing_addresses",
      message: "Indiquez une adresse de départ et d’arrivée.",
    });
    return;
  }

  try {
    const p1 = await geocodeServer(depart);
    const p2 = await geocodeServer(arrivee);
    if (!p1 || !p2) {
      res.status(422).json({
        error: "geocode_failed",
        message:
          "Adresse introuvable (essayez « ville, code postal » ou une adresse complète).",
      });
      return;
    }
    const km = await routeDrivingKmServer(p1.lon, p1.lat, p2.lon, p2.lat);
    if (km == null || !Number.isFinite(km)) {
      res.status(422).json({
        error: "route_failed",
        message: "Itinéraire introuvable. Saisissez la distance manuellement.",
      });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      distanceKm: Math.round(km * 100) / 100,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: "server_error",
      message: "Erreur serveur lors du calcul. Réessayez ou saisissez la distance à la main.",
    });
  }
}
