/**
 * Serveur d'API local pour le développement (remplace `vercel dev`).
 *
 * `vercel dev` nécessite une authentification Vercel (login/lien projet), ce qui
 * n'est pas possible dans un environnement automatisé. Ce petit serveur reproduit
 * le routage des fonctions serverless (`api/**.ts`) attendu par le proxy Vite
 * (`/api` -> http://127.0.0.1:3000), en fournissant des objets req/res compatibles
 * avec la signature `@vercel/node`.
 *
 * Usage : `npm run dev:api:local` (ou `tsx scripts/dev-api-server.ts`).
 * Variables lues depuis `.env` (DATABASE_URL, JWT_SECRET, ...).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const API_DIR = resolve(ROOT, "api");
const PORT = Number(process.env.API_PORT ?? 3000);

// Charge .env (sans dépendance externe) pour DATABASE_URL / JWT_SECRET, etc.
const envPath = resolve(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.replace(/^export\s+/i, "").match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

type Handler = (req: unknown, res: unknown) => unknown;

/**
 * Résout un chemin d'URL (`/api/...`) vers un fichier de handler et extrait les
 * paramètres dynamiques (`[op]`, `[action]`). Retourne le module + les params.
 */
function resolveRoute(
  pathname: string,
): { file: string; params: Record<string, string> } | null {
  const rel = pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  const segments = rel.length ? rel.split("/") : [];
  const params: Record<string, string> = {};

  // 1) Correspondance exacte : api/<segments>.ts
  const exact = resolve(API_DIR, `${segments.join("/")}.ts`);
  if (segments.length && existsSync(exact)) return { file: exact, params };

  // 2) index.ts d'un dossier
  const indexFile = resolve(API_DIR, segments.join("/"), "index.ts");
  if (existsSync(indexFile)) return { file: indexFile, params };

  // 3) Segment dynamique en dernière position : api/<dir>/[x].ts
  if (segments.length) {
    const dir = resolve(API_DIR, segments.slice(0, -1).join("/"));
    const last = segments[segments.length - 1];
    if (existsSync(dir)) {
      const dyn = readdirSync(dir).find((f) => /^\[[^\]]+\]\.ts$/.test(f));
      if (dyn) {
        const name = dyn.slice(1, dyn.indexOf("]"));
        params[name] = last;
        return { file: resolve(dir, dyn), params };
      }
    }
  }
  return null;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => res(Buffer.concat(chunks).toString("utf8")));
    req.on("error", rej);
  });
}

/** Ajoute les méthodes façon Vercel (`status`, `json`, `send`) à la réponse Node. */
function decorateRes(res: ServerResponse) {
  const r = res as ServerResponse & {
    status: (code: number) => typeof r;
    json: (body: unknown) => void;
    send: (body: unknown) => void;
  };
  r.status = (code: number) => {
    r.statusCode = code;
    return r;
  };
  r.json = (body: unknown) => {
    if (!r.getHeader("Content-Type")) {
      r.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    r.end(JSON.stringify(body));
  };
  r.send = (body: unknown) => {
    if (body == null) return r.end();
    if (typeof body === "object") return r.json(body);
    r.end(String(body));
  };
  return r;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const decorated = decorateRes(res);

  const route = resolveRoute(url.pathname);
  if (!route) {
    decorated.status(404).json({ error: `Route introuvable: ${url.pathname}` });
    return;
  }

  const query: Record<string, string> = { ...route.params };
  for (const [k, v] of url.searchParams.entries()) query[k] = v;

  const rawBody = await readBody(req);
  (req as unknown as { query: Record<string, string> }).query = query;
  (req as unknown as { body: string }).body = rawBody;

  try {
    const mod = (await import(pathToFileURL(route.file).href)) as {
      default?: Handler;
    };
    const handler = mod.default;
    if (typeof handler !== "function") {
      decorated.status(500).json({ error: "Handler invalide." });
      return;
    }
    await handler(req, decorated);
    if (!res.writableEnded) res.end();
  } catch (e) {
    console.error(`[api] ${req.method} ${url.pathname}`, e);
    if (!res.headersSent) {
      decorated.status(500).json({
        error: e instanceof Error ? e.message : "Erreur serveur interne.",
      });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[api] Serveur d'API local prêt sur http://127.0.0.1:${PORT}/api`);
});
