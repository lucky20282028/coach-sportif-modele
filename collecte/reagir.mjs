/* Réveille le coach quand quelque chose d'important arrive entre deux tâches planifiées.
     node collecte/reagir.mjs            (collecte.yml, entre deux régénérations de la page)
   Lit : app/entrees/memoire.json (heure du mot, ce que le coach avait vu, ce qu'on voit
   maintenant), carnet.md, etat/reaction.json. Écrit etat/reaction.json (affiché sur la page).
   Déclenche la routine « Coach · Réagir » par l'API des routines Claude Code :
     COACH_REAGIR_JETON   jeton de la routine (secret GitHub, généré sur claude.ai/code/routines)
     COACH_REAGIR_ROUTINE identifiant de la routine (trig_…), pas secret
     RAISON               pourquoi la collecte a tourné : note, actualiser, ou vide
   Le texte envoyé à la routine dit ce qui a changé. Aucune donnée secrète n'y figure. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paris } from "./notifs.mjs";
import { createRequire } from "node:module";

/* Le prénom de l'athlète (reglages/athlete.json), pour les textes de la page et de la routine. */
const ATH = createRequire(import.meta.url)("../commun/athlete.cjs");
const prenomDu = racine => { try { return ATH.lireAthlete(racine).prenom || ""; } catch (e) { return ""; } };

/* Créneaux où une tâche planifiée va de toute façon relire tout (heure de Paris, minutes). */
export const CRENEAUX = [
  { de:6 * 60 + 30, a:7 * 60 + 45, nom:"le point du matin (7h27)" },
  { de:19 * 60 + 55, a:20 * 60 + 45, nom:"le débrief (20h23)" }
];
export const BILAN = { jour:0, de:17 * 60 + 30, a:18 * 60 + 30, nom:"le bilan du dimanche (17h54)" };
export const NUIT = { de:23 * 60 + 30, a:6 * 60 + 30, nom:"le point du matin (7h27)" };
export const MAX_PAR_JOUR = 8;
export const EN_COURS_MIN = 30;

const hhmm = m => Math.floor(m / 60) + "h" + String(m % 60).padStart(2, "0");
const court = (t, n) => t.length > n ? t.slice(0, n - 1) + "…" : t;

/* Heure de Paris (« AAAA-MM-JJ HHhMM ») d'un instant ISO, comparable aux lignes du carnet. */
export function horoParis(isoStr) {
  const d = new Date(isoStr);
  const p = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone:"Europe/Paris", year:"numeric", month:"2-digit",
    day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(d).map(x => [x.type, x.value]));
  return p.year + "-" + p.month + "-" + p.day + " " + p.hour + "h" + p.minute;
}

/* Ce qui a changé depuis le mot. Chaque élément : { cle, texte } (texte lisible par l'athlète). */
export function nouveautes({ memoire, carnet }) {
  const out = [];
  const vu = memoire && memoire.motVu ? horoParis(memoire.motVu) : null;
  const base = (memoire && memoire.motBase) || null, now = (memoire && memoire.empreinte) || null;
  /* Lignes du carnet écrites depuis la page après le mot. */
  for (const l of String(carnet || "").split("\n")) {
    const m = l.match(/^(\d{4}-\d{2}-\d{2} \d{2}h\d{2}) — \*\(([^)]*)\)\*\s*(.*)$/);
    if (!m || (vu && m[1] <= vu)) continue;
    if (!vu) continue;                                     /* sans heure de mot, on ne sait pas : rien */
    const quand = m[1].slice(11), genre = m[2], txt = m[3];
    if (genre === "écrit depuis la page") out.push({ cle:"note:" + m[1], texte:"ton message de " + quand + " : « " + court(txt, 140) + " »" });
    else if (genre === "check-in du matin" && /douleur|raideur|forme [12]\/5|lourdes/i.test(txt)) out.push({ cle:"checkin:" + m[1], texte:"ton check-in de " + quand + " : " + court(txt, 120) });
    else if (/^retour page/.test(genre) && /douleur : (légère|forte)|Pas faite|sensation [1-4]\/10/.test(txt)) out.push({ cle:"retour:" + m[1], texte:"ton retour de séance (" + quand + ") : " + court(txt, 120) });
  }
  if (base && now && base.d === now.d) {
    if (base.nuit == null && now.nuit != null) out.push({ cle:"nuit:" + now.d, texte:"ta nuit, mesurée après le mot (" + hhmm(now.nuit) + ")" });
    else if (base.nuit != null && now.nuit != null && Math.abs(now.nuit - base.nuit) >= 45) out.push({ cle:"nuit:" + now.d + ":" + now.nuit, texte:"ta nuit, corrigée par la montre (" + hhmm(now.nuit) + " au lieu de " + hhmm(base.nuit) + ")" });
  }
  if (base && now) {
    const neuves = (now.acts || []).filter(a => !(base.acts || []).includes(a));
    if (neuves.length) out.push({ cle:"acts:" + neuves.join(","), texte:neuves.length > 1 ? neuves.length + " nouvelles activités enregistrées par la montre" : "une nouvelle activité enregistrée par la montre" });
  }
  return out;
}

/* Le bilan du dimanche a-t-il déjà été fait ce jour-là (lancé à la main plus tôt) ? Alors
   la tâche de 17h54 s'arrête aussitôt (« Bilan déjà fait aujourd'hui ») : il ne faut pas
   l'attendre. Il laisse toujours une ligne « *(bilan du coach)* » datée dans le carnet. */
export function bilanFait(carnet, d) {
  return String(carnet || "").split("\n").some(l => l.startsWith(d + " ") && l.includes("*(bilan du coach)*"));
}

/* La prochaine tâche planifiée qui relira tout, dite comme sur la page. */
export function prochaineTache(instant, carnet) {
  const { d, min } = paris(instant);
  const dim = new Date(d + "T12:00:00Z").getUTCDay() === 0;
  if (min < 7 * 60 + 27) return "au point du matin de 7h27";
  if (dim && min < 17 * 60 + 54 && !bilanFait(carnet, d)) return "au bilan du dimanche, à 17h54";
  if (min < 20 * 60 + 23) return "au débrief de 20h23";
  return "au point du matin, à 7h27";
}

/* Faut-il réveiller le coach ? { lancer, raisons:[texte], attendre:null|texte, prochain } */
export function decider({ instant, raison, memoire, carnet, etat, jeton, prenom }) {
  const N = nouveautes({ memoire, carnet });
  const res = { lancer:false, raisons:N.map(x => x.texte), cles:N.map(x => x.cle), attendre:null, prochain:prochaineTache(instant, carnet) };
  if (raison !== "note" && raison !== "actualiser") { res.attendre = "collecte sans demande de " + (prenom || "ta part"); return res; }
  /* Actualiser, c'est l'athlète qui demande un mot à jour : on réveille même sans nouveauté
     détectée (mêmes garde-fous : créneaux des tâches, réveil en cours, 8 par jour). */
  if (!N.length && raison === "actualiser") {
    const p = paris(instant);
    N.push({ cle:"actualiser:" + p.d + ":" + p.min, texte:"tu as appuyé sur Actualiser (la collecte n'a rien vu de neuf : relis la journée)" });
    res.raisons = N.map(x => x.texte); res.cles = N.map(x => x.cle);
  }
  if (!N.length) { res.attendre = "rien de nouveau depuis le mot du coach"; return res; }
  const { d, min } = paris(instant);
  const jourSem = new Date(d + "T12:00:00Z").getUTCDay();
  /* On n'attend une tâche que si elle n'a pas encore écrit son mot : passé 7h27, un message
     de 7h34 doit réveiller le coach, le point du matin est déjà fait. */
  const mv = memoire && memoire.motVu ? paris(new Date(memoire.motVu)) : null;
  const faite = c => mv && mv.d === d && mv.min >= c.de && mv.min <= min;
  for (const c of CRENEAUX) if (min >= c.de && min < c.a && !faite(c)) { res.attendre = c.nom; return res; }
  if (jourSem === BILAN.jour && min >= BILAN.de && min < BILAN.a && !faite(BILAN) && !bilanFait(carnet, d)) { res.attendre = BILAN.nom; return res; }
  if (min >= NUIT.de || min < NUIT.a) { res.attendre = NUIT.nom; return res; }
  const e = etat || {};
  const lances = (e.historique || []).filter(t => t.slice(0, 10) === d);
  if (lances.length >= MAX_PAR_JOUR) { res.attendre = "le débrief : déjà " + MAX_PAR_JOUR + " réveils aujourd'hui"; return res; }
  /* Une réaction lancée après ce mot, il y a moins de 30 min : elle travaille encore. */
  const vu = memoire && memoire.motVu;
  if (e.lance && (!vu || e.lance > vu)) {
    const age = (instant - new Date(e.lance)) / 60000;
    const dejaVues = new Set(e.cles || []);
    if (age < EN_COURS_MIN || N.every(x => dejaVues.has(x.cle))) { res.attendre = age < EN_COURS_MIN ? "la réaction déjà en cours" : "le débrief (déjà signalé au coach)"; return res; }
  }
  if (!jeton) { res.attendre = "le prochain point du coach (réveil automatique pas encore activé)"; return res; }
  res.lancer = true;
  return res;
}

export function texteRoutine(raisons, raison, prenom) {
  const qui = prenom || "L'athlète";
  return "Réveil automatique (" + (raison === "note" ? qui + " vient d'écrire au coach depuis la page" : qui + " a appuyé sur Actualiser") +
    "). Depuis ton dernier mot :\n" + raisons.map(r => "- " + r).join("\n") +
    "\nSuis taches/reagir.md.";
}

async function principal() {
  const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const lire = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(RACINE, f), "utf8")); } catch (e) { return d; } };
  const ETAT = path.join(RACINE, "etat", "reaction.json");
  const etat = lire("etat/reaction.json", {});
  const memoire = lire("app/entrees/memoire.json", {});
  let carnet = ""; try { carnet = fs.readFileSync(path.join(RACINE, "carnet.md"), "utf8"); } catch (e) {}
  const raison = (process.env.RAISON || "").trim();
  /* L'identifiant de la routine vient de reglages/installation.json (pas secret) ; le jeton, du secret. */
  const inst = lire("reglages/installation.json", {});
  const jeton = process.env.COACH_REAGIR_JETON || "", routine = process.env.COACH_REAGIR_ROUTINE || inst.routine_reagir || "";
  const instant = new Date();
  /* Test de branchement (collecte lancée à la main avec raison=test) : le jeton est-il accepté ? */
  if (raison === "test") {
    let code = jeton && routine ? 0 : null, session = null;
    if (code === 0) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/claude_code/routines/" + encodeURIComponent(routine) + "/fire", {
          method:"POST",
          headers:{ "Authorization":"Bearer " + jeton, "anthropic-version":"2023-06-01", "Content-Type":"application/json" },
          body:JSON.stringify({ text:"TEST DE BRANCHEMENT, pas un vrai réveil : ne modifie rien, ne commite rien, ne pousse rien. Réponds seulement « Branchement OK »." })
        });
        code = r.status;
        try { const j = await r.json(); session = j.claude_code_session_url || null; } catch (e) {}
      } catch (e) { code = -1; }
    }
    const res = code == null ? "jeton absent" : code >= 200 && code < 300 ? "ok" : "refusé (HTTP " + code + ")";
    console.log("Test du réveil : " + res);
    fs.mkdirSync(path.dirname(ETAT), { recursive:true });
    fs.writeFileSync(ETAT, JSON.stringify(Object.assign({}, etat, { test:{ quand:instant.toISOString(), resultat:res, session } }), null, 1) + "\n");
    return;
  }
  const prenom = prenomDu(RACINE);
  const dec = decider({ instant, raison, memoire, carnet, etat, jeton:jeton && routine, prenom });
  const nouvel = Object.assign({}, etat, { motVu:memoire.motVu || null, raisons:dec.raisons, attendre:dec.attendre, prochain:dec.prochain });
  if (dec.lancer) {
    let code = 0, session = null;
    try {
      const r = await fetch("https://api.anthropic.com/v1/claude_code/routines/" + encodeURIComponent(routine) + "/fire", {
        method:"POST",
        headers:{ "Authorization":"Bearer " + jeton, "anthropic-version":"2023-06-01", "Content-Type":"application/json" },
        body:JSON.stringify({ text:texteRoutine(dec.raisons, raison, prenom) })
      });
      code = r.status;
      try { const j = await r.json(); session = j.claude_code_session_url || null; } catch (e) {}
    } catch (e) { code = -1; }
    if (code >= 200 && code < 300) {
      Object.assign(nouvel, { lance:instant.toISOString(), cles:dec.cles, session, echec:null, attendre:null,
        historique:(etat.historique || []).filter(t => (instant - new Date(t)) < 3 * 86400000).concat(instant.toISOString()) });
      console.log("Coach réveillé : " + dec.raisons.join(" ; "));
    } else {
      Object.assign(nouvel, { echec:{ code, quand:instant.toISOString() }, attendre:"le prochain point du coach (réveil refusé : " + code + ")" });
      console.log("Réveil du coach refusé : HTTP " + code);
    }
  } else console.log("Pas de réveil : " + dec.attendre + (dec.raisons.length ? " (" + dec.raisons.join(" ; ") + ")" : ""));
  fs.mkdirSync(path.dirname(ETAT), { recursive:true });
  fs.writeFileSync(ETAT, JSON.stringify(nouvel, null, 1) + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await principal();
