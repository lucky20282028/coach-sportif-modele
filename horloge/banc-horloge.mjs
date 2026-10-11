/* Banc de l'horloge : le Worker sonne, la fonction lance le bon workflow une fois par créneau.
     node horloge/banc-horloge.mjs */
import fs from "node:fs";
import { PROGRAMME, creneau } from "../commun/horloge.mjs";
import { sonner } from "./horloge.js";
const PAGE = "https://coach-essai.pages.dev";
import { onRequest } from "../functions/api/horloge.js";
let ok = 0, ko = 0; const echecs = [];
const t = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? " → " + d : "")); } };

const toml = fs.readFileSync(new URL("./wrangler.toml", import.meta.url), "utf8");
const crons = JSON.parse(toml.match(/crons = (\[.*\])/)[1]);
t("wrangler.toml et le programme disent la même chose", JSON.stringify(crons) === JSON.stringify(PROGRAMME.map(p => p.cron)));
t("4h45 UTC : collecte", creneau(new Date("2026-10-12T04:47:00Z")).p.workflow === "collecte.yml");
t("19h55 UTC : notifications", creneau(new Date("2026-10-12T19:55:00Z")).p.workflow === "notifier.yml");
t("12h00 UTC : rien", creneau(new Date("2026-10-12T12:00:00Z")) === null);
let vu = null;
await sonner(PAGE, async (u, o) => { vu = { u, o }; return { status:200 }; });
t("le Worker sonne à /api/horloge de sa page, sans secret", vu.u === PAGE + "/api/horloge" && vu.o.method === "POST" && !vu.o.headers);
vu = null;
t("sans adresse de page (déploiement incomplet) : il ne sonne nulle part", (await sonner(undefined, async u => { vu = u; return { status:200 }; })) === 0 && vu === null);
t("une adresse douteuse est refusée", (await sonner("http://pirate.example", async u => { vu = u; return { status:200 }; })) === 0 && vu === null);
t("wrangler.toml ne fige ni nom de page ni compte", !/pages\.dev|account_id/.test(toml));

class KV { constructor() { this.m = new Map(); } async get(k) { return this.m.get(k) || null; } async put(k, v) { this.m.set(k, v); } async delete(k) { this.m.delete(k); } }
const env = { RETOURS:new KV(), JETON_GITHUB:"github_pat_TEST", DEPOT:"essai/coach" };
const appels = [], f0 = globalThis.fetch, D0 = Date;
globalThis.fetch = async (u, o) => { appels.push({ u, o }); return new Response(null, { status:204 }); };
const a = heure => { globalThis.Date = class extends D0 { constructor(...x) { super(...(x.length ? x : [heure])); } static now() { return new D0(heure).getTime(); } }; };
const req = new Request("https://x/api/horloge", { method:"POST" });
a("2026-10-12T17:56:00Z");
let r = await (await onRequest({ request:req, env })).json();
t("à l'heure : le workflow est lancé", r.lance === "notifier.yml" && appels.length === 1 && JSON.parse(appels[0].o.body).inputs.type === "horaire", JSON.stringify(r));
t("sur le dépôt de l'installation", /\/repos\/essai\/coach\/actions\//.test(appels[0].u), appels[0].u);
r = await (await onRequest({ request:req, env })).json();
t("une seconde sonnerie dans le même créneau ne relance rien", r.rien === "déjà lancé" && appels.length === 1);
a("2026-10-12T12:00:00Z");
r = await (await onRequest({ request:req, env })).json();
t("hors créneau : rien (l'adresse publique ne sert à rien d'autre)", r.rien === "pas l'heure" && appels.length === 1);
t("GET refusé", (await onRequest({ request:new Request("https://x/api/horloge"), env })).status === 405);
globalThis.fetch = f0; globalThis.Date = D0;

console.log("\n  " + ok + " réussis, " + ko + " échoués");
if (ko) { for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("  Horloge validée.");
