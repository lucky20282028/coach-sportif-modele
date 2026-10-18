/* Envoie les notifications de la page (GitHub Actions). Aucune ne passe par Claude.
     node collecte/notifier.mjs horaire [--besoin]   (workflow notifier.yml, toutes les heures en fin d'après-midi)
     node collecte/notifier.mjs modif                (après chaque publication de la page)
     node collecte/notifier.mjs montre               (après chaque collecte)
     node collecte/notifier.mjs test                 (bouton « Envoyer un test » de la page)
   Abonnements : KV « push:<id> » {abonnement, prefs}, écrits par /api/abonnement.
   Anti-doublon : KV « envoye:<tag>:<id> » (48 h). Clés VAPID dérivées de PAGE_KEY. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { kv } from "./cloudflare.mjs";
import { clesVapid, envoyer } from "./webpush.mjs";
import { prefsValides, paris, rappelSeance, rappelCoucher, rappelModif, signature, suiviMontre, MESSAGE_MONTRE, rappelEntretien, notifMot } from "./notifs.mjs";

const require = createRequire(import.meta.url);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lireJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(RACINE, f), "utf8")); } catch (e) { return d; } };
/* Journal de l'envoi : aussi publié en annotation, lisible par l'API (les journaux bruts ne le sont pas). */
const JOURNAL = [];
const log = (...a) => { const t = a.join(" "); JOURNAL.push(t.trim()); console.log(t); };
const sortie = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, k + "=" + v + "\n"); };
/* Les sources de l'athlète : seule une montre Garmin se lit en direct (activités du jour). */
const SOURCES = (() => { try { return require(path.join(RACINE, "commun", "athlete.cjs")).lireAthlete(RACINE).sources; } catch (e) { return { garmin:true, withings:true }; } })();

async function abonnements(K) {
  const out = [];
  for (const cle of await K.cles("push:")) {
    const v = await K.lire(cle);
    if (v && v.abonnement && v.abonnement.endpoint) out.push({ cle, id:cle.slice(5), abonnement:v.abonnement, prefs:prefsValides(v.prefs) });
  }
  return out;
}

/* Envoi à un abonné, une seule fois par tag ; abonnement mort (404/410) effacé. */
async function remettre(K, abo, msg, cles) {
  const garde = "envoye:" + msg.tag + ":" + abo.id;
  if (msg.tag && await K.lire(garde)) { log("  déjà envoyé : " + msg.tag); return; }
  const code = await envoyer(abo.abonnement, msg, cles);
  log("  « " + msg.titre + " » → " + code + (envoyer.raison ? " " + String(envoyer.raison).slice(0, 120) : ""));
  if (code === 404 || code === 410) { await K.effacer(abo.cle); log("  abonnement expiré, effacé"); return; }
  if (code >= 200 && code < 300 && msg.tag) await K.ecrire(garde, { t:Date.now() }, 48 * 3600);
  return code;
}

async function principal() {
  const type = process.argv[2] || "horaire", besoin = process.argv.includes("--besoin");
  const K = await kv();
  const abos = await abonnements(K);
  const ici = paris(new Date());
  if (!abos.length) { log("Aucun abonnement : rien à envoyer."); sortie("garmin", "0"); if (type !== "modif") return; }
  const D = (() => { try { return require(path.join(RACINE, "app", "donnees.js")); } catch (e) { return {}; } })();
  const cles = besoin ? null : clesVapid(process.env.PAGE_KEY);

  if (type === "test") {
    /* Avec un tag (comme les vraies notifications) : le test passe par le même chemin. */
    for (const a of abos) await remettre(K, a, { titre:"Les notifications du coach marchent", corps:"Tu les recevras selon tes réglages (bouton L de la page).", tag:"test-" + Date.now() }, cles);
    return;
  }

  if (type === "horaire") {
    /* Retours tapés sur la page et pas encore recopiés dans le carnet. */
    const enAttente = [];
    for (const c of await K.cles("r:")) { const r = await K.lire(c); if (r) enAttente.push(r); }
    const retours = (D.retours || []).concat(enAttente);
    /* Activités du jour lues à l'instant sur Garmin (étape précédente), sinon la dernière collecte. */
    let activites = null;
    try { if (process.env.ACTIVITES_FICHIER) activites = JSON.parse(fs.readFileSync(process.env.ACTIVITES_FICHIER, "utf8")); } catch (e) {}
    if (!Array.isArray(activites)) activites = [];
    /* Sans Garmin : les séances du jour reçues par la dernière collecte (Strava, Apple Santé). */
    if (!SOURCES.garmin) for (const s of ["strava", "sante"]) activites.push(...Object.values(lireJson("donnees/" + s + "/activites.json", {})).filter(a => String(a.start_time).startsWith(ici.d)));
    const C = require(path.join(RACINE, "app", "core.js"));
    const ck = retours.filter(r => r.type === "checkin" && r.d === ici.d).pop();
    const rouge = (D.today === ici.d && D.feu && D.feu.couleur === "rouge") || C.reglesCheckin(ck, (D.checkin || {}).zones).some(x => x.niveau === "rouge") ||
      C.reglesRetours(retours, ici.d).some(x => x.niveau === "rouge");
    const synthese = lireJson("donnees/synthese.json", null);
    let garmin = false;
    for (const a of abos) {
      const s = rappelSeance({ ici, prefs:a.prefs, plan:D.plan, retours, activites, feu:rouge ? "rouge" : "vert" });
      if (besoin) { if (s) garmin = true; continue; }
      if (s) await remettre(K, a, s, cles);
      const c = rappelCoucher({ ici, prefs:a.prefs, synthese, plan:D.plan });
      if (c) await remettre(K, a, c, cles);
      const en = rappelEntretien({ ici, prefs:a.prefs, expirations:lireJson("etat/expirations.json", []) });
      if (en) await remettre(K, a, en, cles);
      if (!s && !c) log("  rien à signaler à " + Math.floor(ici.min / 60) + "h" + String(ici.min % 60).padStart(2, "0"));
    }
    if (besoin) { sortie("garmin", garmin && SOURCES.garmin ? "1" : "0"); log(garmin ? "Une séance semble pas faite : on regarde la montre." : "Pas de rappel de séance à cette heure."); }
    return;
  }

  /* Le nouveau mot du coach, après chaque publication de la page. */
  if (type === "mot" || type === "mot-force") {
    /* « mot-force » : renvoie le mot actuel même s'il est déjà parti (dépannage). */
    const deja = type === "mot-force" ? null : await K.lire("etat:mot-notifie");
    let envoye = false;
    for (const a of abos) {
      const m = notifMot({ ici, prefs:a.prefs, mot:D.mot, motVu:D.motVu, deja:deja && deja.motVu, maintenant:type === "mot-force" ? Date.parse(D.motVu) : Date.now() });
      if (m && type === "mot-force") m.tag += "-" + Date.now();
      if (m) { const c = await remettre(K, a, m, cles); if (c >= 200 && c < 300) envoye = true; }
    }
    if (D.motVu && (!deja || deja.motVu !== D.motVu) && (envoye || !abos.length)) await K.ecrire("etat:mot-notifie", { motVu:D.motVu });
    log(envoye ? "Mot du coach envoyé." : "Pas de nouveau mot à envoyer (déjà envoyé, la nuit, trop ancien ou désactivé).");
    return;
  }

  if (type === "modif") {
    const P = require(path.join(RACINE, "app", "depuis-plan.js"));
    let entrees = [];
    try { entrees = P.extrairePlan(fs.readFileSync(path.join(RACINE, "app", "entrees", "plan.txt"), "utf8")).entries || []; } catch (e) { log("Plan illisible : rien à comparer."); return; }
    const apres = { d:ici.d, sig:signature(entrees, ici.d) };
    const avant = await K.lire("etat:plan-notifie");
    for (const a of abos) { const m = rappelModif({ ici, prefs:a.prefs, avant, apres }); if (m) await remettre(K, a, m, cles); }
    if (!avant || avant.sig !== apres.sig || avant.d !== apres.d) await K.ecrire("etat:plan-notifie", apres);
    log(avant && avant.d === apres.d && avant.sig !== apres.sig ? "Séance du jour ou du lendemain modifiée." : "Plan du jour enregistré.");
    return;
  }

  if (type === "montre") {
    const e = lireJson("etat/derniere-collecte.json", {});
    for (const src of ["garmin", "withings", "strava", "sante"]) {
      if (!e[src] || e[src] === "ignoré" || e[src] === "skipped") continue;
      const { etat, alerter } = suiviMontre(await K.lire("etat:montre:" + src), e[src]);
      if (etat) await K.ecrire("etat:montre:" + src, etat); else await K.effacer("etat:montre:" + src);
      if (alerter) for (const a of abos) if (a.prefs.montres) await remettre(K, a, Object.assign({ tag:"montre-" + src + "-" + ici.d }, MESSAGE_MONTRE[src]), cles);
      log(src + " : " + e[src] + (alerter ? " → alerte envoyée" : ""));
    }
    return;
  }
  throw new Error("type inconnu : " + type);
}

principal().then(() => { if (process.env.GITHUB_ACTIONS && JOURNAL.length) console.log("::notice title=Notifications (" + (process.argv[2] || "horaire") + ")::" + JOURNAL.join(" | ").replace(/%/g, "%25").slice(0, 900)); })
  .catch(e => { console.error("Notifications : " + e.message); console.log("::error title=Notifications::" + String(e.message).replace(/%/g, "%25")); process.exit(1); });
