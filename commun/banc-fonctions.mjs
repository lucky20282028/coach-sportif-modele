/* Banc des fonctions Cloudflare (/api/retour, /api/actualiser), exécutées
   dans Node avec un faux stockage KV et un faux GitHub. */
import { onRequest as retour } from "../functions/api/retour.js";
import { onRequest as actualiser } from "../functions/api/actualiser.js";
import { onRequest as wDebut } from "../functions/api/withings/debut.js";
import { onRequestGet as wRetour } from "../functions/api/withings/retour.js";
import { onRequest as abonnement } from "../functions/api/abonnement.js";
import { onRequest as notifTest } from "../functions/api/notif-test.js";
import { onRequest as sDebut } from "../functions/api/strava/debut.js";
import { onRequestGet as sRetour } from "../functions/api/strava/retour.js";
import { onRequest as sante } from "../functions/api/sante.js";
import { jetonDe, jetonSante, sha256hex } from "./retour.mjs";

let ok = 0, ko = 0; const echecs = [];
const t = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? "  → " + String(d).slice(0, 200) : "")); } };

class FauxKV {
  constructor() { this.m = new Map(); }
  async get(k, type) { const v = this.m.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v; }
  async put(k, v) { this.m.set(k, v); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix }) { return { keys:[...this.m.keys()].filter(k => k.startsWith(prefix)).sort().map(name => ({ name })) }; }
}
const cle = "AbC-dEf_0123456789abcdefghijklmnopqrstuvwxyzABC";
const jeton = await jetonDe(cle);
const env = { RETOURS:new FauxKV(), EMPREINTE:await sha256hex(jeton) };
const req = (meth, j, corps, chemin = "/api/retour") => new Request("https://x.pages.dev" + chemin,
  { method:meth, headers:{ "X-Coach":j, "Content-Type":"application/json" }, body:corps == null ? undefined : JSON.stringify(corps) });

t("sans jeton : refusé", (await retour({ request:req("GET", "faux"), env })).status === 401);
const s = { type:"seance", d:"2026-10-06", t:"Aérobie faible 30 min", fait:"fait", sensation:7, douleur:"aucune", ecrit:"2026-10-06 08h12", admin:true };
let r = await retour({ request:req("POST", jeton, s), env });
t("un retour valide est enregistré", r.status === 200);
t("rangé sous r:", [...env.RETOURS.m.keys()].every(k => k.startsWith("r:")));
t("champ inconnu jeté", !("admin" in JSON.parse([...env.RETOURS.m.values()][0])));
t("un retour vide est refusé", (await retour({ request:req("POST", jeton, { type:"seance", d:"2026-10-06" }), env })).status === 400);
await retour({ request:req("POST", jeton, { type:"test", d:"2026-10-06", note:"x" }), env });
r = await retour({ request:req("GET", jeton), env });
const j = await r.json();
t("GET renvoie les retours en attente, sans les tests", j.retours.length === 1 && j.retours[0].sensation === 7, JSON.stringify(j));
t("pas de cache", r.headers.get("cache-control") === "no-store");

{
  /* Un message au coach lance une collecte (raison « note ») ; un retour ordinaire, non. */
  const vus = [], fetch0 = globalThis.fetch;
  globalThis.fetch = async (u, o) => { vus.push({ u, o }); return new Response(null, { status:204 }); };
  const envN = { RETOURS:new FauxKV(), EMPREINTE:env.EMPREINTE, JETON_GITHUB:"github_pat_TEST", DEPOT:"essai/coach" };
  await retour({ request:req("POST", jeton, s), env:envN });
  t("un retour de séance sans alerte ne lance rien", vus.length === 0);
  await retour({ request:req("POST", jeton, { type:"note", d:"2026-10-06", note:"J'ai une course le 18", ecrit:"2026-10-06 16h16" }), env:envN });
  t("un message au coach lance la collecte", vus.length === 1 && /collecte\.yml\/dispatches$/.test(vus[0].u) && JSON.parse(vus[0].o.body).inputs.raison === "note", JSON.stringify(vus));
  await retour({ request:req("POST", jeton, { type:"note", d:"2026-10-06", note:"Et une deuxième", ecrit:"2026-10-06 16h17" }), env:envN });
  t("deux messages dans la minute : une seule collecte", vus.length === 1);
  await retour({ request:req("POST", jeton, { type:"checkin", d:"2026-10-06", forme:3, alerte:"douleur", zone:"dos" }), env:Object.assign({}, envN, { RETOURS:new FauxKV() }) });
  t("une douleur au check-in aussi", vus.length === 2);
  globalThis.fetch = fetch0;
}
t("Actualiser sans jeton : refusé", (await actualiser({ request:req("POST", "faux", {}, "/api/actualiser"), env })).status === 401);
t("Actualiser sans jeton GitHub : 501", (await actualiser({ request:req("POST", jeton, {}, "/api/actualiser"), env })).status === 501);
const appels = [];
globalThis.fetch = async (u, o) => { appels.push({ u, o }); return new Response(null, { status:204 }); };
t("Actualiser sans dépôt connu : 501, rien n'est lancé", (await actualiser({ request:req("POST", jeton, {}, "/api/actualiser"), env:Object.assign({}, env, { JETON_GITHUB:"x" }) })).status === 501 && appels.length === 0);
const env2 = Object.assign({}, env, { JETON_GITHUB:"github_pat_TEST", DEPOT:"essai/coach" });
t("Actualiser lance la collecte", (await actualiser({ request:req("POST", jeton, {}, "/api/actualiser"), env:env2 })).status === 200);
t("sur le bon dépôt et le bon workflow", /repos\/essai\/coach\/actions\/workflows\/collecte\.yml\/dispatches$/.test(appels[0].u) && appels[0].o.headers.Authorization === "Bearer github_pat_TEST");
t("avec la raison « actualiser »", JSON.parse(appels[0].o.body).inputs.raison === "actualiser");
t("une deuxième demande dans les 5 minutes est refusée", (await actualiser({ request:req("POST", jeton, {}, "/api/actualiser"), env:env2 })).status === 429);
t("sans relancer GitHub", appels.length === 1);

/* Reconnecter Withings */
const envW = Object.assign({}, env, { WITHINGS_CLIENT_ID:"cid", WITHINGS_CLIENT_SECRET:"csec" });
t("Withings : début refusé sans jeton", (await wDebut({ request:req("POST", "faux", {}, "/api/withings/debut"), env:envW })).status === 401);
t("Withings : 501 sans identifiants", (await wDebut({ request:req("POST", jeton, {}, "/api/withings/debut"), env })).status === 501);
const d = await (await wDebut({ request:req("POST", jeton, {}, "/api/withings/debut"), env:envW })).json();
const au = new URL(d.url), st = au.searchParams.get("state");
t("Withings : adresse d'autorisation correcte", au.host === "account.withings.com" && au.searchParams.get("redirect_uri") === "https://x.pages.dev/api/withings/retour" && /^[0-9a-f]{32}$/.test(st), d.url);
t("Withings : state inconnu refusé", (await wRetour({ request:new Request("https://x.pages.dev/api/withings/retour?code=abc&state=" + "0".repeat(32)), env:envW })).status === 400);
const vus = [];
globalThis.fetch = async (u, o) => { vus.push({ u, o }); return /withings/.test(u) ? new Response(JSON.stringify({ status:0, body:{ refresh_token:"R-neuf", access_token:"A" } })) : new Response(null, { status:204 }); };
const rw = await wRetour({ request:new Request("https://x.pages.dev/api/withings/retour?code=abc&state=" + st), env:Object.assign({}, envW, { JETON_GITHUB:"g", DEPOT:"essai/coach" }) });
t("Withings : code échangé", rw.status === 200 && String(vus[0].o.body).indexOf("grant_type=authorization_code") >= 0);
t("Withings : jeton gardé pour la collecte", JSON.parse(await envW.RETOURS.get("withings:neuf")).refresh_token === "R-neuf");
t("Withings : collecte lancée aussitôt", vus.some(v => /collecte\.yml\/dispatches/.test(v.u)));
const re = await wRetour({ request:new Request("https://x.pages.dev/api/withings/retour?code=abc&state=" + st), env:envW });
t("Withings : un second passage redit le succès sans réutiliser le code", re.status === 200 && (await re.text()).indexOf("déjà fait") >= 0 && vus.filter(v => /withings/.test(v.u)).length === 1);
t("Withings : state inconnu toujours refusé", (await wRetour({ request:new Request("https://x.pages.dev/api/withings/retour?code=abc&state=" + "1".repeat(32)), env:envW })).status === 400);

/* Notifications : abonnement de l'iPhone, test */
const sub = { endpoint:"https://web.push.apple.com/QGuQyavXutnMx", keys:{ p256dh:"B" + "A".repeat(86), auth:"q1dXpw3UpT5VOmu_cf_v6g" } };
const envN = { RETOURS:new FauxKV(), EMPREINTE:env.EMPREINTE };
t("abonnement : refusé sans jeton", (await abonnement({ request:req("POST", "faux", { abonnement:sub }, "/api/abonnement"), env:envN })).status === 401);
t("abonnement : destination inconnue refusée", (await abonnement({ request:req("POST", jeton, { abonnement:Object.assign({}, sub, { endpoint:"https://pirate.example/x" }) }, "/api/abonnement"), env:envN })).status === 400);
t("abonnement : http refusé", (await abonnement({ request:req("POST", jeton, { abonnement:Object.assign({}, sub, { endpoint:"http://web.push.apple.com/x" }) }, "/api/abonnement"), env:envN })).status === 400);
const ra = await abonnement({ request:req("POST", jeton, { abonnement:sub, prefs:{ heure:20, coucher:false, pirate:1 } }, "/api/abonnement"), env:envN });
const ja = await ra.json();
const kva = [...envN.RETOURS.m.keys()];
t("abonnement : enregistré sous push:", ra.status === 200 && kva.length === 1 && /^push:[0-9a-f]{16}$/.test(kva[0]), JSON.stringify(kva));
t("abonnement : préférences nettoyées", JSON.stringify(ja.prefs) === JSON.stringify({ seance:true, heure:20, coucher:false, modif:true, montres:true }));
await abonnement({ request:req("POST", jeton, { abonnement:sub, prefs:{ heure:18 } }, "/api/abonnement"), env:envN });
t("abonnement : le même iPhone met à jour, sans doublon", envN.RETOURS.m.size === 1 && JSON.parse([...envN.RETOURS.m.values()][0]).prefs.heure === 18);
await abonnement({ request:req("DELETE", jeton, { endpoint:sub.endpoint }, "/api/abonnement"), env:envN });
t("abonnement : retiré", envN.RETOURS.m.size === 0);
const appelsN = [];
globalThis.fetch = async (u, o) => { appelsN.push({ u, o }); return new Response(null, { status:204 }); };
const envT = Object.assign({}, envN, { JETON_GITHUB:"g", DEPOT:"essai/coach" });
t("test de notification : lance notifier.yml en mode test", (await notifTest({ request:req("POST", jeton, {}, "/api/notif-test"), env:envT })).status === 200 &&
  /workflows\/notifier\.yml\/dispatches$/.test(appelsN[0].u) && JSON.parse(appelsN[0].o.body).inputs.type === "test");
t("test de notification : une demande par minute", (await notifTest({ request:req("POST", jeton, {}, "/api/notif-test"), env:envT })).status === 429);

/* Strava : connexion depuis la page */
{
  const envS = { RETOURS:new FauxKV(), EMPREINTE:env.EMPREINTE, STRAVA_CLIENT_ID:"123", STRAVA_CLIENT_SECRET:"sec" };
  t("Strava : début refusé sans jeton", (await sDebut({ request:req("POST", "faux", {}, "/api/strava/debut"), env:envS })).status === 401);
  t("Strava : 501 sans application", (await sDebut({ request:req("POST", jeton, {}, "/api/strava/debut"), env })).status === 501);
  const ds = await (await sDebut({ request:req("POST", jeton, {}, "/api/strava/debut"), env:envS })).json();
  const us = new URL(ds.url), sts = us.searchParams.get("state");
  t("Strava : adresse d'autorisation (lecture des activités privées, retour sur la page)", us.host === "www.strava.com" && us.searchParams.get("scope") === "read,activity:read_all" &&
    us.searchParams.get("redirect_uri") === "https://x.pages.dev/api/strava/retour" && /^[0-9a-f]{32}$/.test(sts), ds.url);
  t("Strava : state inconnu refusé", (await sRetour({ request:new Request("https://x.pages.dev/api/strava/retour?code=a&scope=read,activity:read_all&state=" + "0".repeat(32)), env:envS })).status === 400);
  t("Strava : autorisation partielle refusée, le state reste valable", (await sRetour({ request:new Request("https://x.pages.dev/api/strava/retour?code=a&scope=read&state=" + sts), env:envS })).status === 400 && !!(await envS.RETOURS.get("sstate:" + sts)));
  const vusS = [], f0 = globalThis.fetch;
  globalThis.fetch = async (u, o) => { vusS.push({ u, o }); return /strava/.test(u) ? new Response(JSON.stringify({ refresh_token:"RS", access_token:"AS" })) : new Response(null, { status:204 }); };
  const rs = await sRetour({ request:new Request("https://x.pages.dev/api/strava/retour?code=abc&scope=read,activity:read_all&state=" + sts), env:Object.assign({}, envS, { JETON_GITHUB:"g", DEPOT:"essai/coach" }) });
  t("Strava : connecté, jeton gardé pour la collecte, collecte lancée", rs.status === 200 && JSON.parse(await envS.RETOURS.get("strava:neuf")).refresh_token === "RS" &&
    vusS.some(v => /collecte\.yml\/dispatches$/.test(v.u)));
  t("Strava : le code est échangé avec l'application de l'athlète", new URLSearchParams(vusS[0].o.body).get("client_id") === "123");
  const rs2 = await sRetour({ request:new Request("https://x.pages.dev/api/strava/retour?code=abc&scope=read,activity:read_all&state=" + sts), env:envS });
  t("Strava : page rechargée après succès : toujours « connecté »", rs2.status === 200);
  globalThis.fetch = f0;
}

/* Apple Santé : envoi du raccourci */
{
  const js = await jetonSante(cle);
  const envH = { RETOURS:new FauxKV(), EMPREINTE:env.EMPREINTE, EMPREINTE_SANTE:await sha256hex(js) };
  const reqS = (j, corps) => new Request("https://x.pages.dev/api/sante", { method:"POST", headers:{ "X-Coach-Sante":j, "Content-Type":"application/json" }, body:JSON.stringify(corps) });
  t("Santé : jeton de la page refusé (le raccourci a son propre jeton)", (await sante({ request:reqS(jeton, { date:"2026-10-11", sommeil_min:400 }), env:envH })).status === 401);
  t("Santé : refusé tant que l'installation n'a pas posé l'empreinte", (await sante({ request:reqS(js, { date:"2026-10-11", sommeil_min:400 }), env })).status === 401);
  const rh = await sante({ request:reqS(js, { date:"2026-10-11", sommeil_min:"432", fc_repos:"52", vfc_ms:"48,5" }), env:envH });
  const kh = [...envH.RETOURS.m.keys()];
  t("Santé : un envoi valide est gardé sous sante:", rh.status === 200 && kh.length === 1 && /^sante:/.test(kh[0]), kh);
  t("Santé : nombres écrits en texte relus", JSON.parse(envH.RETOURS.m.get(kh[0])).jours[0].vfc_ms === 48.5);
  t("Santé : envoi sans date refusé", (await sante({ request:reqS(js, { sommeil_min:400 }), env:envH })).status === 400);
}

console.log("\n  " + ok + " réussis, " + ko + " échoués");
if (ko) { for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("  Fonctions validées.");
