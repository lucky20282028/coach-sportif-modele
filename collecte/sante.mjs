/* Recopie les données d'Apple Santé reçues par /api/sante (stockage KV) dans le dépôt.
     node collecte/sante.mjs lire     → donnees/sante/AAAA-MM.jsonl (une ligne par jour reçu),
                                        donnees/sante/activites.json (séances, format Garmin)
     node collecte/sante.mjs effacer  → une fois la collecte poussée, efface de Cloudflare
                                        ce qui a été recopié (etat/.sante-pris.json) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kv } from "./cloudflare.mjs";
import { fusionner } from "../commun/sante.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER = path.join(RACINE, "donnees", "sante");
const PRIS = path.join(RACINE, "etat", ".sante-pris.json");
if (!process.env.CLOUDFLARE_API_TOKEN) { console.log("Pas de jeton Cloudflare : Apple Santé ignoré."); process.exit(0); }
const store = await kv();

if (process.argv[2] === "lire") {
  const cles = await store.cles("sante:");
  const jours = [];
  for (const c of cles) { const v = await store.lire(c); if (v && Array.isArray(v.jours)) jours.push(...v.jours); }
  fs.mkdirSync(DOSSIER, { recursive:true });
  const fus = fusionner(jours);
  const collecte = new Date().toISOString();
  for (const j of fus) {
    const f = path.join(DOSSIER, j.date.slice(0, 7) + ".jsonl");
    fs.appendFileSync(f, JSON.stringify(Object.assign({ collecte }, j)) + "\n");
  }
  /* Les séances, au format des activités Garmin, pour l'agenda et les objectifs. */
  const fa = path.join(DOSSIER, "activites.json");
  let acts = {}; try { acts = JSON.parse(fs.readFileSync(fa, "utf8")); } catch (e) {}
  for (const j of fus) for (const s of j.seances || []) acts[s.id] = s;
  const limite = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
  acts = Object.fromEntries(Object.entries(acts).filter(([, s]) => String(s.start_time) >= limite));
  fs.writeFileSync(fa, JSON.stringify(acts, null, 1) + "\n");
  fs.mkdirSync(path.dirname(PRIS), { recursive:true });
  fs.writeFileSync(PRIS, JSON.stringify(cles));
  console.log("Apple Santé : " + cles.length + " envoi(s), " + fus.length + " jour(s) : " + fus.map(j => j.date).join(", "));
} else if (process.argv[2] === "effacer") {
  if (!fs.existsSync(PRIS)) process.exit(0);
  const cles = JSON.parse(fs.readFileSync(PRIS, "utf8"));
  for (const c of cles) await store.effacer(c);
  fs.unlinkSync(PRIS);
  console.log("Apple Santé : " + cles.length + " envoi(s) effacé(s) de Cloudflare.");
}
