/* Jeton Withings neuf déposé par le bouton « Reconnecter Withings ».
     node collecte/withings-kv.mjs prendre  → s'il y en a un, l'écrit dans etat/.withings-neuf.json (jamais commité)
     node collecte/withings-kv.mjs effacer  → après une collecte Withings réussie, l'efface de Cloudflare */
import fs from "node:fs";
import { kv } from "./cloudflare.mjs";

const F = "etat/.withings-neuf.json";
if (!process.env.CLOUDFLARE_API_TOKEN) process.exit(0);
const store = await kv();
if (process.argv[2] === "prendre") {
  const v = await store.lire("withings:neuf");
  if (v && v.refresh_token) { fs.mkdirSync("etat", { recursive:true }); fs.writeFileSync(F, JSON.stringify(v)); console.log("Jeton Withings neuf trouvé (reconnecté depuis la page)."); }
  else console.log("Pas de jeton Withings neuf.");
} else if (process.argv[2] === "effacer") {
  if (!fs.existsSync(F)) process.exit(0);
  const pris = JSON.parse(fs.readFileSync(F, "utf8"));
  const v = await store.lire("withings:neuf");
  if (v && v.refresh_token === pris.refresh_token) await store.effacer("withings:neuf");
  fs.unlinkSync(F);
  console.log("Jeton Withings neuf consommé.");
}
