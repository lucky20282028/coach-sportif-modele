/* Recopie les retours de la page (stockage KV Cloudflare) dans carnet.md.
     node collecte/retours.mjs lire     → ajoute au carnet (et à donnees/retours.jsonl) ce qui est nouveau
     node collecte/retours.mjs effacer  → efface de Cloudflare ce qui est déjà
                                          dans le carnet (à lancer APRÈS le push)
   etat/retours-vus.json garde les clés déjà recopiées : si le push échoue,
   rien n'est effacé, et au passage suivant rien n'est recopié deux fois. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kv } from "./cloudflare.mjs";
import { createRequire } from "node:module";
import { ligneCarnet, ajouterAuCarnet, signatureRetour } from "../commun/retour.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECKIN = createRequire(import.meta.url)("../commun/athlete.cjs").lireAthlete(RACINE).checkin;
const VUS = path.join(RACINE, "etat", "retours-vus.json");
const CARNET = path.join(RACINE, "carnet.md");

if (!process.env.CLOUDFLARE_API_TOKEN) { console.log("CLOUDFLARE_API_TOKEN absent : retours ignorés."); process.exit(0); }
const store = await kv();
const lireVus = () => { try { return JSON.parse(fs.readFileSync(VUS, "utf8")); } catch (e) { return []; } };
const cles = await store.cles("r:");

if (process.argv[2] === "effacer") {
  const vus = new Set(lireVus());
  let n = 0;
  for (const k of cles) if (vus.has(k)) { await store.effacer(k); n++; }
  console.log("Retours effacés de Cloudflare : " + n);
} else {
  const vus = lireVus().filter(k => cles.includes(k));   /* ceux déjà effacés sortent de la liste */
  const nouveaux = [];
  let tests = 0, doublons = 0;
  /* Une saisie renvoyée par la page (réponse perdue) n'entre qu'une fois au carnet. */
  const J = path.join(RACINE, "donnees", "retours.jsonl");
  const deja = new Set();
  try { for (const l of fs.readFileSync(J, "utf8").split("\n")) if (l.trim()) { try { deja.add(signatureRetour(JSON.parse(l))); } catch (e) {} } } catch (e) {}
  for (const k of cles) {
    if (vus.includes(k)) continue;
    const r = await store.lire(k);
    vus.push(k);
    if (!r) continue;
    if (r.type === "test") { tests++; continue; }      /* vérification technique : jamais dans le carnet */
    const sig = signatureRetour(r);
    if (deja.has(sig)) { doublons++; continue; }
    deja.add(sig);
    nouveaux.push({ ligne:ligneCarnet(r, r.recu, CHECKIN), r });
  }
  nouveaux.sort((a, b) => a.ligne < b.ligne ? -1 : 1);
  if (nouveaux.length) {
    fs.writeFileSync(CARNET, ajouterAuCarnet(fs.readFileSync(CARNET, "utf8"), nouveaux));
    /* Version structurée pour la page : elle coche la séance et affiche la sensation. */
    fs.mkdirSync(path.dirname(J), { recursive:true });
    fs.appendFileSync(J, nouveaux.map(n => JSON.stringify(n.r)).join("\n") + "\n");
  }
  fs.mkdirSync(path.dirname(VUS), { recursive:true });
  fs.writeFileSync(VUS, JSON.stringify(vus, null, 1) + "\n");
  console.log("Retours recopiés dans le carnet : " + nouveaux.length + (tests ? " (+ " + tests + " test)" : "") + (doublons ? " (" + doublons + " doublon" + (doublons > 1 ? "s" : "") + " écarté" + (doublons > 1 ? "s" : "") + ")" : ""));
  for (const n of nouveaux) console.log("  " + n.ligne.slice(0, 60) + "…");
}
