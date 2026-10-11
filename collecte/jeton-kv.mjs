/* Jeton neuf déposé par la page après une connexion (Strava, et tout service à
   autorisation OAuth sauf Withings, qui a son propre withings-kv.mjs).
     node collecte/jeton-kv.mjs strava prendre  → s'il y en a un, l'écrit dans etat/.strava-neuf.json (jamais commité)
     node collecte/jeton-kv.mjs strava effacer  → après une collecte réussie, l'efface de Cloudflare */
import fs from "node:fs";
import { kv } from "./cloudflare.mjs";

const [source, action] = process.argv.slice(2);
if (!/^[a-z]+$/.test(source || "") || !["prendre", "effacer"].includes(action)) { console.error("usage : node collecte/jeton-kv.mjs <source> prendre|effacer"); process.exit(2); }
if (!process.env.CLOUDFLARE_API_TOKEN) process.exit(0);
const F = "etat/." + source + "-neuf.json", CLE = source + ":neuf";
const store = await kv();
if (action === "prendre") {
  const v = await store.lire(CLE);
  if (v && v.refresh_token) { fs.mkdirSync("etat", { recursive:true }); fs.writeFileSync(F, JSON.stringify(v)); console.log("Jeton " + source + " neuf trouvé (connecté depuis la page)."); }
  else console.log("Pas de jeton " + source + " neuf.");
} else {
  if (!fs.existsSync(F)) process.exit(0);
  const pris = JSON.parse(fs.readFileSync(F, "utf8"));
  const v = await store.lire(CLE);
  if (v && v.refresh_token === pris.refresh_token) await store.effacer(CLE);
  fs.unlinkSync(F);
  console.log("Jeton " + source + " neuf consommé.");
}
