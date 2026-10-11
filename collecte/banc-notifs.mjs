/* Banc des notifications : qui reçoit quoi, et quand.  node collecte/banc-notifs.mjs */
import { prefsValides, paris, rappelSeance, rappelCoucher, rappelModif, signature, suiviMontre, PREFS_DEFAUT, rappelEntretien } from "./notifs.mjs";

let ok = 0, ko = 0; const echecs = [];
const t = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? " → " + d : "")); } };
const P = Object.assign({}, PREFS_DEFAUT);
const ici = (d, h, m) => ({ d, min:h * 60 + (m || 0) });

/* Préférences et heure de Paris */
t("préférences inconnues jetées, heure hors liste ramenée à 19 h", JSON.stringify(prefsValides({ heure:3, pirate:1, coucher:false })) === JSON.stringify({ seance:true, heure:19, coucher:false, modif:true, montres:true }));
t("heure d'été : 16h55 UTC = 18h55 à Paris", paris(new Date("2026-10-06T16:55:00Z")).min === 18 * 60 + 55);
t("heure d'hiver : 16h55 UTC = 17h55 à Paris", paris(new Date("2026-11-03T16:55:00Z")).min === 17 * 60 + 55);

/* 1. Séance pas faite */
const plan = [{ d:"2026-10-08", t:"Gainage circuit · 3 tours", fam:"renfo" }, { d:"2026-10-08", t:"Aérobie faible 35 min", fam:"facile", km:"4,9" },
              { d:"2026-10-09", t:"Repos", fam:"repos" }];
const R = x => rappelSeance(Object.assign({ ici:ici("2026-10-08", 18, 55), prefs:P, plan, retours:[], activites:[], feu:"vert" }, x));
const r1 = R({});
t("19 h, deux séances pas faites : un seul rappel qui cite les deux", r1 && /Deux séances/.test(r1.titre) && /Gainage/.test(r1.corps) && /Aérobie/.test(r1.corps), JSON.stringify(r1));
const r2 = R({ activites:[{ type:"running", start_time:"2026-10-08 12:10:00", duration_seconds:1900 }] });
t("course vue par la montre : reste le gainage", r2 && r2.titre === "Ton gainage n'est pas fait" && /guidé/.test(r2.corps), JSON.stringify(r2));
const r3 = R({ activites:[{ type:"running", start_time:"2026-10-08 12:10:00", duration_seconds:1900 }],
               retours:[{ type:"seance", d:"2026-10-08", t:"Gainage circuit · 3 tours", fait:"fait" }] });
t("gainage déclaré sur la page : plus rien à rappeler", r3 === null);
t("une marche de 8 min n'est pas un footing", R({ activites:[{ type:"running", start_time:"2026-10-08 07:00:00", duration_seconds:480 }],
  retours:[{ type:"seance", d:"2026-10-08", t:"Gainage circuit · 3 tours", fait:"fait" }] }).titre === "Ton footing n'est pas fait");
t("footing seul : distance dans le message", /4,9 km/.test(R({ retours:[{ type:"seance", d:"2026-10-08", t:"Gainage circuit · 3 tours", fait:"en partie" }] }).corps));
t("hors de l'heure choisie (17h55 pour 19 h) : rien", R({ ici:ici("2026-10-08", 17, 55) }) === null);
t("à l'heure choisie 18 h : rappel", R({ ici:ici("2026-10-08", 17, 55), prefs:Object.assign({}, P, { heure:18 }) }) !== null);
t("feu rouge (douleur) : jamais de rappel", R({ feu:"rouge" }) === null);
t("rappel désactivé : rien", R({ prefs:Object.assign({}, P, { seance:false }) }) === null);
t("jour de repos : rien", R({ ici:ici("2026-10-09", 18, 55) }) === null);
t("séance déjà cochée par la collecte : rien", R({ plan:plan.map(s => Object.assign({}, s, { fait:true })) }) === null);

/* 2. Coucher */
const syn = (min, courtes) => ({ date:"2026-10-08", nuit:{ minutes:min }, regles:[{ id:"nuits_courtes", declenchee:!!courtes }] });
const C1 = rappelCoucher({ ici:ici("2026-10-08", 22, 55), prefs:P, synthese:syn(312), plan });
t("nuit de 5h12 : « au lit » vers 23 h", C1 && C1.titre === "Nuit courte hier (5h12)", JSON.stringify(C1));
t("et la séance du lendemain n'est pas citée un jour de repos", !/Demain/.test(C1.corps));
const C2 = rappelCoucher({ ici:ici("2026-10-07", 22, 55), prefs:P, synthese:Object.assign(syn(330), { date:"2026-10-07" }), plan });
t("veille d'une séance : elle est citée", /Demain : Gainage circuit · 3 tours et Aérobie faible 35 min/.test(C2.corps), C2.corps);
t("bonne nuit et pas de série de nuits courtes : rien", rappelCoucher({ ici:ici("2026-10-08", 22, 55), prefs:P, synthese:syn(450), plan }) === null);
t("3 nuits courtes sur 5 même si la dernière était bonne : rappel", /Plusieurs nuits courtes/.test(rappelCoucher({ ici:ici("2026-10-08", 22, 55), prefs:P, synthese:syn(450, true), plan }).titre));
t("nuit non mesurée : rien (pas de chiffre inventé)", rappelCoucher({ ici:ici("2026-10-08", 22, 55), prefs:P, synthese:syn(null), plan }) === null);
t("synthèse d'un autre jour : rien", rappelCoucher({ ici:ici("2026-10-09", 22, 55), prefs:P, synthese:syn(300), plan }) === null);
t("à 21h55 : trop tôt", rappelCoucher({ ici:ici("2026-10-08", 21, 55), prefs:P, synthese:syn(300), plan }) === null);

/* 3. Séance modifiée par le coach */
const E1 = [{ d:"2026-10-08", t:"Aérobie faible 35 min · 4,9 km", type:"course" }, { d:"2026-10-09", t:"Repos", type:"repos" }];
const E2 = [{ d:"2026-10-08", t:"Récupération 25 min · 3,8 km", type:"course" }, { d:"2026-10-09", t:"Repos", type:"repos" }];
const av = { d:"2026-10-08", sig:signature(E1, "2026-10-08") }, ap = { d:"2026-10-08", sig:signature(E2, "2026-10-08") };
const M1 = rappelModif({ ici:ici("2026-10-08", 14, 10), prefs:P, avant:av, apres:ap });
t("séance du jour allégée l'après-midi : signalée, avec l'ancienne", M1 && /Aujourd'hui : Récupération 25 min · 3,8 km \(au lieu de Aérobie faible 35 min · 4,9 km\)/.test(M1.corps), JSON.stringify(M1));
t("changement fait par le point de 7h27 : pas de doublon", rappelModif({ ici:ici("2026-10-08", 7, 35), prefs:P, avant:av, apres:ap }) === null);
t("rien de changé : rien", rappelModif({ ici:ici("2026-10-08", 14, 10), prefs:P, avant:av, apres:av }) === null);
t("nouveau jour (référence de la veille) : rien", rappelModif({ ici:ici("2026-10-08", 14, 10), prefs:P, avant:{ d:"2026-10-07", sig:"[]" }, apres:ap }) === null);
t("une semaine réécrite au-delà de demain : rien", rappelModif({ ici:ici("2026-10-08", 18, 0), prefs:P, avant:av,
  apres:{ d:"2026-10-08", sig:signature(E1.concat([{ d:"2026-10-12", t:"Tempo", type:"course" }]), "2026-10-08") } }) === null);

/* 4. Montre déconnectée */
let e = suiviMontre(null, "failure");
t("un premier échec : pas d'alerte (souvent passager)", !e.alerter && e.etat.echecs === 1);
e = suiviMontre(e.etat, "failure");
t("deux de suite : alerte", e.alerter);
e = suiviMontre(e.etat, "failure");
t("trois : pas de seconde alerte", !e.alerter);
t("revenue : l'état s'efface", suiviMontre(e.etat, "success").etat === null);

/* Entretien : jetons qui expirent */
{
  const X = [{ id:"garmin", l:"Jetons Garmin", d:"2027-02-01", vers:true, quoi:"Refaire l'authentification." }, { id:"github", l:"Jeton GitHub", d:"2027-10-06", quoi:"Le recréer." }];
  t("loin de l'échéance : rien", rappelEntretien({ ici:ici("2026-12-01", 18, 55), prefs:P, expirations:X }) === null);
  const e = rappelEntretien({ ici:ici("2027-01-10", 18, 55), prefs:P, expirations:X });
  t("moins d'un mois : rappel, avec quoi faire", e && /Jetons Garmin : expire vers le 01\/02/.test(e.titre) && /22 jours/.test(e.corps) && /authentification/.test(e.corps), JSON.stringify(e));
  t("une fois par semaine (le tag change chaque semaine)", e.tag !== rappelEntretien({ ici:ici("2027-01-18", 18, 55), prefs:P, expirations:X }).tag && e.tag === rappelEntretien({ ici:ici("2027-01-11", 18, 55), prefs:P, expirations:X }).tag);
  t("en fin d'après-midi seulement", rappelEntretien({ ici:ici("2027-01-10", 22, 55), prefs:P, expirations:X }) === null);
  t("alertes de montre coupées : rien", rappelEntretien({ ici:ici("2027-01-10", 18, 55), prefs:Object.assign({}, P, { montres:false }), expirations:X }) === null);
  t("expiré : on le dit", /expiré/.test(rappelEntretien({ ici:ici("2027-02-03", 18, 55), prefs:P, expirations:X }).titre));
}
console.log("\n  " + ok + " réussis, " + ko + " échoués");
if (ko) { echecs.forEach(x => console.log("  ✗ " + x)); process.exit(1); }
console.log("  Notifications validées.");
