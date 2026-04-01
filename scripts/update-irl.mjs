#!/usr/bin/env node
/**
 * Met à jour public/data/irl-latest.json depuis l’ajax officiel INSEE.
 * Usage : node scripts/update-irl.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "data", "irl-latest.json");
const URL = "https://www.insee.fr/fr/statistiques/serie/ajax/001515333";

function parseTable(html) {
  const rows = [];
  const re =
    /<tr[^>]*>[\s\S]*?<td[^>]*>(\d{4})<\/td>[\s\S]*?<td[^>]*>T([1-4])<\/td>[\s\S]*?<td[^>]*>([\d\s,]+)<\/td>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const year = Number(m[1]);
    const quarter = Number(m[2]);
    const value = Number.parseFloat(m[3].replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(year) && Number.isFinite(value) && quarter >= 1 && quarter <= 4) {
      rows.push({ year, quarter, value });
    }
  }
  return rows;
}

const res = await fetch(URL);
if (!res.ok) throw new Error(`INSEE ${res.status}`);
const json = await res.json();
if (!json.html) throw new Error("Réponse INSEE sans champ html");
const observations = parseTable(json.html);
if (!observations.length) throw new Error("Aucune observation parsée");

observations.sort((a, b) => {
  if (a.year !== b.year) return b.year - a.year;
  return b.quarter - a.quarter;
});

const payload = {
  observations: observations.slice(0, 24),
  asOf: new Date().toISOString().slice(0, 10),
  source: "INSEE série 001515333 (script update-irl)",
};

writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`Écrit ${observations.length} point(s), dernier T${observations[0].quarter} ${observations[0].year} = ${observations[0].value}`);
console.log(OUT);
