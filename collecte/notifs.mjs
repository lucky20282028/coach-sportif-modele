/* Quelles notifications envoyer, et quand — logique pure, sans réseau.
   Utilisée par notifier.mjs (GitHub Actions), testée par banc-notifs.mjs.

   Cinq notifications, chacune réglable depuis la page (réglages, L) :
     coach   : le nouveau mot du coach (point du matin, débrief, programme, réponse à un message)
     seance  : « ton footing n'est pas fait », à l'heure choisie (17 h à 21 h)
     coucher : « au lit » vers 23 h, après une nuit courte
     modif   : le coach a modifié ta séance d'aujourd'hui ou de demain
     montres : Garmin ou Withings ne répond plus (deux collectes de suite)
   Jamais de rappel de séance un jour de feu rouge (douleur, consulter). */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("../app/core.js");

export const PREFS_DEFAUT = { coach:true, seance:true, heure:19, coucher:true, modif:true, montres:true };
export const HEURES = [17, 18, 19, 20, 21];

/* Préférences reçues de la page : tout ce qui n'est pas prévu est jeté. */
export function prefsValides(p) {
  p = p && typeof p === "object" ? p : {};
  const b = (v, d) => typeof v === "boolean" ? v : d;
  return { coach:b(p.coach, true), seance:b(p.seance, true), heure:HEURES.includes(p.heure) ? p.heure : 19, coucher:b(p.coucher, true), modif:b(p.modif, true), montres:b(p.montres, true) };
}

/* Heure de Paris d'un instant : { d:"AAAA-MM-JJ", min: minutes depuis minuit }. */
export function paris(instant) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone:"Europe/Paris", year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(instant).map(x => [x.type, x.value]));
  return { d:p.year + "-" + p.month + "-" + p.day, min:+p.hour * 60 + +p.minute };
}
const demainDe = d => { const x = C.parse(d); x.setDate(x.getDate() + 1); return C.iso(x); };

/* Sports qu'un rappel concerne, et ce que la montre doit avoir vu pour les compter faits. */
const SPORT = { course:{ types:/running/, min:600, nom:"footing" }, renfo:{ types:/strength|hiit|fitness|pilates|yoga|indoor_cardio/, min:300, nom:"gainage" } };
const sportDe = s => C.FA(C.famOf(s)).sp;
const hm = m => Math.floor(m / 60) + "h" + String(Math.round(m % 60)).padStart(2, "0");

/* 1. Séance pas faite, à l'heure choisie (fenêtre d'une heure centrée sur elle). */
export function rappelSeance({ ici, prefs, plan, retours, activites, feu }) {
  if (!prefs.seance) return null;
  if (ici.min < prefs.heure * 60 - 30 || ici.min >= prefs.heure * 60 + 30) return null;
  if (feu === "rouge") return null;
  const faitRetour = s => (retours || []).some(r => r && r.type === "seance" && r.d === ici.d && r.t === s.t && (r.fait === "fait" || r.fait === "en partie"));
  const faitMontre = sp => (activites || []).some(a => a && String(a.start_time || "").slice(0, 10) === ici.d && SPORT[sp].types.test(a.type || "") && (a.duration_seconds || 0) >= SPORT[sp].min);
  const restent = (plan || []).filter(s => s.d === ici.d && SPORT[sportDe(s)] && !s.fait && !faitRetour(s) && !faitMontre(sportDe(s)));
  if (!restent.length) return null;
  const s = restent[0], sp = sportDe(s), titre = C.titreComplet ? C.titreComplet(s) : s.t;
  if (restent.length > 1) return { titre:"Deux séances pas encore faites", corps:restent.map(x => x.t).join(" · ") + ". Il te reste la soirée.", tag:"seance-" + ici.d };
  return { titre:"Ton " + SPORT[sp].nom + " n'est pas fait", tag:"seance-" + ici.d,
           corps:titre + (sp === "renfo" ? ". Le gainage guidé de la page te prend en main." : ". Il te reste la soirée.") };
}

/* 2. Au lit, vers 23 h, après une nuit courte (synthèse du matin, jamais de chiffre inventé). */
export function rappelCoucher({ ici, prefs, synthese, plan }) {
  if (!prefs.coucher || ici.min < 22 * 60 + 30 || ici.min >= 23 * 60 + 30) return null;
  if (!synthese || synthese.date !== ici.d) return null;
  const nuit = synthese.nuit && synthese.nuit.minutes;
  const courtes = (synthese.regles || []).some(r => r.id === "nuits_courtes" && r.declenchee);
  if (!(nuit != null && nuit < 360) && !courtes) return null;
  const demain = (plan || []).filter(s => s.d === demainDe(ici.d) && C.famOf(s) !== "repos").map(s => s.t);
  return { titre:nuit != null && nuit < 360 ? "Nuit courte hier (" + hm(nuit) + ")" : "Plusieurs nuits courtes cette semaine",
           corps:"Au lit maintenant : c'est ton premier levier." + (demain.length ? " Demain : " + demain.join(" et ") + "." : ""), tag:"coucher-" + ici.d };
}

/* 3. Le coach a modifié la séance d'aujourd'hui ou de demain.
   `avant` : ce qui était enregistré au précédent passage ; `apres` : le plan publié.
   Les changements du point de 7h27 ne sont pas signalés : sa notification le dit déjà. */
export function signature(entrees, d) {
  const dd = [d, demainDe(d)];
  return JSON.stringify((entrees || []).filter(e => dd.includes(e.d)).map(e => [e.d, e.t, e.s || "", e.km || "", e.type || ""]));
}
export function rappelModif({ ici, prefs, avant, apres }) {
  if (!avant || avant.d !== ici.d || avant.sig === apres.sig) return null;
  if (!prefs.modif || ici.min < 9 * 60) return null;
  const A = JSON.parse(avant.sig), B = JSON.parse(apres.sig);
  const jour = d => d === ici.d ? "Aujourd'hui" : "Demain";
  const lignes = [];
  for (const d of [ici.d, demainDe(ici.d)]) {
    const a = A.filter(x => x[0] === d).map(x => x[1]), b = B.filter(x => x[0] === d).map(x => x[1]);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    lignes.push(jour(d) + " : " + (b.join(" et ") || "rien") + (a.length ? " (au lieu de " + a.join(" et ") + ")" : ""));
  }
  if (!lignes.length) return null;
  return { titre:"Le coach a modifié ta séance", corps:lignes.join(". ") + ".", tag:"modif-" + ici.d };
}

/* 5. Le nouveau mot du coach, envoyé par la page dès sa publication : c'est LA notification
   du coach (point du matin, débrief, programme du dimanche, réponse à un message). Une seule
   fois par mot (motVu), jamais la nuit (23 h – 7 h : la page le montre au réveil), jamais
   un mot de plus de 12 heures. Le texte : la consigne (le gras du mot), sinon sa première phrase. */
const texte = h => String(h || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const couper = (t, n) => t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t;
export function notifMot({ ici, prefs, mot, motVu, deja, maintenant }) {
  if (!prefs.coach || !mot || !motVu || deja === motVu) return null;
  if (ici.min < 7 * 60 || ici.min >= 23 * 60) return null;
  if (maintenant - Date.parse(motVu) > 12 * 3600000) return null;
  const gras = [...String(mot).matchAll(/<b>([\s\S]*?)<\/b>/gi)].map(m => texte(m[1])).filter(Boolean);
  const corps = couper(gras.length ? gras.join(" ") : (texte(mot).match(/^.*?[.!?](\s|$)/) || [texte(mot)])[0].trim(), 230);
  if (!corps) return null;
  const dim = new Date(ici.d + "T12:00:00Z").getUTCDay() === 0;
  const titre = ici.min < 11 * 60 ? "Le point du matin" : dim && ici.min >= 17 * 60 && ici.min < 20 * 60 ? "Ton programme de la semaine"
    : ici.min >= 19 * 60 + 45 ? "Le débrief du soir" : "Le mot du coach";
  return { titre, corps, tag:"mot-" + motVu };
}

/* 4. Une montre ne répond plus : seulement à la deuxième collecte en échec, une seule fois. */
export function suiviMontre(etatPrecedent, resultat) {
  const e = Object.assign({ echecs:0, notifie:false }, etatPrecedent || {});
  if (resultat === "success") return { etat:null, alerter:false };
  if (resultat !== "failure") return { etat:e, alerter:false };
  e.echecs++;
  const alerter = e.echecs >= 2 && !e.notifie;
  if (alerter) e.notifie = true;
  return { etat:e, alerter };
}
export const MESSAGE_MONTRE = {
  withings:{ titre:"Withings ne répond plus", corps:"Reconnecte-le depuis la page : réglages (L), puis « Reconnecter Withings »." },
  garmin:{ titre:"Garmin ne répond plus", corps:"Deux collectes de suite sans Garmin. Les jetons ont peut-être expiré : demande au coach, la marche à suivre est dans le README." },
  strava:{ titre:"Strava ne répond plus", corps:"Reconnecte-le depuis la page : réglages (L), « Montres et données », puis « Connecter Strava »." },
  sante:{ titre:"Apple Santé ne passe plus", corps:"Deux collectes de suite sans pouvoir lire tes données Santé : demande au coach de regarder le diagnostic." }
};

/* Entretien : un jeton qui expire dans moins d'un mois. Une fois par semaine, en fin
   d'après-midi, avec les alertes de montre (même préférence). */
export function rappelEntretien({ ici, prefs, expirations }) {
  if (!prefs.montres || ici.min < 17 * 60 || ici.min >= 20 * 60) return null;
  const jours = d => Math.round((C.parse(d) - C.parse(ici.d)) / 86400000);
  const e = (expirations || []).filter(x => x && x.d && jours(x.d) <= 30).sort((a, b) => a.d < b.d ? -1 : 1)[0];
  if (!e) return null;
  const j = jours(e.d), semaine = C.iso(C.parse(ici.d)).slice(0, 4) + "-" + Math.floor((C.parse(ici.d) - C.parse(ici.d.slice(0, 4) + "-01-01")) / 604800000);
  return { titre:e.l + (j < 0 ? " : expiré" : " : expire " + (e.vers ? "vers le " : "le ") + e.d.slice(8) + "/" + e.d.slice(5, 7)),
           corps:(j < 0 ? "La collecte risque d'échouer. " : "Dans " + j + " jour" + (j > 1 ? "s" : "") + ". ") + e.quoi, tag:"entretien-" + e.id + "-" + semaine };
}
