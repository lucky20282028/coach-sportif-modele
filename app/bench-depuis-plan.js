/* Banc du convertisseur plan Drive -> données de la page.
   Jeu figé, horloge figée : ne dépend jamais des données du jour. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { creerDocument } = require("./dom.js");
const P = require("./depuis-plan.js");

let ok = 0, ko = 0; const echecs = [];
const t = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? "  → " + String(d).slice(0, 200) : "")); } };
const eq = (n, a, b) => t(n, a === b, "attendu " + JSON.stringify(b) + ", obtenu " + JSON.stringify(a));

/* Un document tel que Google le renvoie : antislashs devant _ et [ ], guillemet cité échappé. */
const BS = "\\";
const doc = "PLAN" + BS + "_JSON" + BS + "_START\n\n" +
  '{"updated":"2026-09-21","entries":' + BS + "[\n" + [
  '{"d":"2026-09-21","t":"Gainage circuit · 2 tours","s":"10 min","km":"","type":"renfo","x":' + BS + '["Priorité de la semaine","Ce soir"' + BS + ']}',
  '{"d":"2026-09-22","t":"Aérobie faible 35 min · 5,2 km","s":"FC 120–140","km":"5,2 km","type":"course","x":' + BS + '["Il a dit ' + BS + '"lentement' + BS + '"."' + BS + ']}',
  '{"d":"2026-09-22","t":"Football","s":"1 h","km":"","type":"foot","x":' + BS + "[" + BS + "]}",
  '{"d":"2026-09-23","t":"Repos","s":"","km":"","type":"repos","x":' + BS + '["Aucun sport"' + BS + ']}',
  '{"d":"2026-09-24","t":"Fractionné 8×400 m","s":"","km":"7 km","type":"course","x":' + BS + "[" + BS + "]}",
  '{"d":"2026-09-25","t":"Endurance 10 km","s":"plafond 145","km":"10 km","type":"course","x":' + BS + "[" + BS + "]}",
  '{"d":"2026-09-26","t":"Vélo 1h30","s":"1h30","km":"","type":"velo","x":' + BS + "[" + BS + "]}",
  '{"d":"2026-09-27","t":"Aérobie faible + 4 LD 45 min","s":"","km":"","type":"course","x":' + BS + "[" + BS + "]}"
].join(",\n") + "\n" + BS + "]}\n\nPLAN" + BS + "_JSON" + BS + "_END\n";

/* ---------- 1. lecture ---------- */
let plan;
try { plan = P.extrairePlan(doc); } catch (e) { plan = null; t("le document Google se lit", false, e.message); }
t("le document Google se lit, guillemet cité compris", plan && plan.entries.length === 8);
t("le guillemet cité survit", plan && /"lentement"/.test(plan.entries[1].x[0]));
let err = null; try { P.extrairePlan("rien ici"); } catch (e) { err = e.message; }
t("sans marqueurs : erreur explicite, pas un plan vide", err && /marqueurs/.test(err), err);

/* ---------- 2. formules ---------- */
const S = plan.entries.map(P.seance);
eq("gainage : les tours du titre", S[0].etapes[0].rep, 2);
eq("gainage : la durée du plan", S[0].duree, "10 min");
eq("gainage : la première note devient le pourquoi", S[0].pourquoi, "Priorité de la semaine");
eq("course : distance sans « km »", S[1].km, "5,2");
eq("course : titre sans distance répétée", S[1].t, "Aérobie faible 35 min");
const cib = S[1].etapes.find(b => b.cible).cible;
t("course : le plafond du plan gagne sur la librairie (120–140, pas 130–145)", cib.lo === 120 && cib.hi === 140, JSON.stringify(cib));
t("course : le texte de l'étape suit la cible", /FC 120–140/.test(S[1].etapes[1].t), S[1].etapes[1].t);
eq("foot : formule foot", S[2].fam, "foot");
eq("foot : pas envoyé sur la montre", S[2].pasDeMontre, true);
eq("repos : aucune étape", S[3].etapes.length, 0);
eq("fractionné : famille vma", S[4].fam, "vma");
eq("fractionné : 8 répétitions", S[4].etapes.find(b => b.r === "corps").rep, 8);
eq("endurance : famille", S[5].fam, "endur");
eq("endurance : plafond 145 du plan", S[5].etapes.find(b => b.cible).cible.hi, 145);
eq("vélo : pas de formule inventée", S[6].etapes.length, 0);
eq("vélo : sport conservé", S[6].sport, "velo");
eq("lignes droites : 4 LD", S[7].etapes.find(b => b.rep).rep, 4);
t("chaque séance porte sa date", S.every((s, i) => s.d === plan.entries[i].d));

/* ---------- 3. assemblage ---------- */
const jour = { date:"2026-09-22", mot:"Bien <b>joué</b>.",
  faits:[ { d:"2026-09-22", type:"course", reel:[{l:"DISTANCE",v:"5,4 km"},{l:"FC MOY.",v:"138"}] },
          { d:"2026-09-21", type:"autre", t:"Tennis · 1 h", reel:[{l:"DURÉE",v:"1 h"}] } ] };
const memoire = { pred:[{l:"5 KM",v:"22:13",g:""}], n3:[{l:"CHARGE",v:"0,4",d:"",c:"#FBBF24"}] };
const R = P.construire(new Date(2026, 8, 22, 7, 5), { planTxt:doc, jour, memoire, histo:{ "2026-09-14":[{d:"2026-09-14",t:"Repos",type:"repos"}], "2026-08-01":[{d:"2026-08-01",t:"Repos",type:"repos"}] } });
const D = R.D;
eq("la date vient de l'horloge", D.today, "2026-09-22");
eq("heure de génération", D.genere, "22 septembre à 07:05");
t("la semaine écoulée reste visible", D.plan.some(s => s.d === "2026-09-14"));
t("l'historique ancien est purgé", !D.plan.some(s => s.d === "2026-08-01"));
const c22 = D.plan.find(s => s.d === "2026-09-22" && s.fam === "facile");
t("la course faite est cochée", c22 && c22.fait === true);
eq("le réalisé est repris", c22 && c22.kmFait, "5,4");
t("le foot du même jour n'est pas coché à tort", !D.plan.find(s => s.d === "2026-09-22" && s.fam === "foot").fait);
t("une séance hors plan est ajoutée", D.plan.some(s => s.d === "2026-09-21" && s.t === "Tennis · 1 h" && s.fait));
eq("les prédictions manquantes reprennent la dernière valeur", D.pred[0].v, "22:13");
eq("aucun souci quand tout est là", D.souci, "");
const R4 = P.construire(new Date(2026, 8, 30, 8, 0), { planTxt:doc, jour:{ date:"2026-09-30" }, memoire:{ n3:memoire.n3, dates:{ n3:"2026-09-21" } } });
t("chiffres repris d'un autre jour : on le dit", /datent du 21\/09/.test(R4.D.souci), R4.D.souci);
eq("chiffres repris : la valeur reste affichée", R4.D.n3[0].v, "0,4");

const R2 = P.construire(new Date(2026, 8, 30, 8, 0), { planTxt:doc, jour, memoire:{} });
t("semaine sans plan : on le dit", /Aucun plan publié/.test(R2.D.souci), R2.D.souci);
/* v2 : la date du mot n'est plus un bandeau d'erreur, la page l'affiche à côté du mot. */
eq("mot d'un autre jour : sa date suit le mot", R2.D.motDate, "2026-09-22");
t("mot d'un autre jour : plus de bandeau rouge pour ça", !/date du 2026-09-22/.test(R2.D.souci), R2.D.souci);
const R3 = P.construire(new Date(2026, 8, 22, 8, 0), { planTxt:"illisible", jour:{}, memoire:{}, histo:{ "2026-09-22":[{d:"2026-09-22",t:"Aérobie faible 30 min",type:"course"}] } });
t("plan illisible : dernier plan connu + souci", R3.D.plan.length === 1 && /illisible/.test(R3.D.souci), R3.D.souci);

/* ---------- 4. rendu réel de la page ---------- */
const ici = __dirname;
const core = fs.readFileSync(path.join(ici, "core.js"), "utf8").replace(/\nif \(typeof module[\s\S]*$/, "\n");
const app  = fs.readFileSync(path.join(ici, "app.js"), "utf8");
const head = fs.readFileSync(path.join(ici, "head.html"), "utf8");
const RealDate = Date;
class DateFigee extends RealDate { constructor(...a) { if (a.length) super(...a); else super(2026, 8, 22, 9, 0); } static now() { return new RealDate(2026, 8, 22, 9, 0).getTime(); } }
const { doc: dd, racine } = creerDocument(head);
const win = { addEventListener() {}, scrollTo() {} };
const ctx = { D: JSON.parse(JSON.stringify(D)), document: dd, window: win, history:{ pushState() {} }, location:{ href:"" },
  console, JSON, Math, String, Number, Array, Object, Date: DateFigee, RegExp, parseFloat, parseInt };
win.location = ctx.location;
let plante = null;
try { vm.createContext(ctx); vm.runInContext(core + "\n" + app, ctx); } catch (e) { plante = e.stack; }
t("la page se rend sans erreur", !plante, plante);
if (!plante) {
  const sj = dd.querySelectorAll("#sem .sj");
  eq("mardi 22 : deux pastilles (course + foot)", sj[1].querySelectorAll(".pt").length, 2);
  eq("mercredi 23 : repos, aucune pastille", sj[2].querySelectorAll(".pt").length, 0);
  eq("deux séances à l'écran du jour", dd.querySelector("#vJour").querySelectorAll(".carte").length, 2);
  t("pas de bandeau de fraîcheur le bon jour", !/Ces données datent/.test(racine.outerHTML));
}

/* ---------- tendances et échéances (5 octobre) ---------- */
/* Deux collectes Garmin le même jour : la dernière gagne. Une nuit Withings
   coupée en deux séries s'additionne ; une sieste l'après-midi ne compte pas. */
const sec = s => Math.floor(new Date(s).getTime() / 1000);
const G = [
  { date:"2026-10-04", sommeil:{ sleep_seconds:20000 }, vfc:{ last_night_avg_hrv_ms:50 }, statut:{ load_ratio:1.4 } },
  { date:"2026-10-05", sommeil:{ sleep_seconds:25000 }, vfc:{}, statut:{} },
  { date:"2026-10-05", sommeil:{ sleep_seconds:31113, avg_overnight_hrv:61 }, vfc:{ last_night_avg_hrv_ms:62, baseline_balanced_low_ms:48, baseline_balanced_upper_ms:84 }, statut:{ load_ratio:1.1 } }
];
const W = [
  { sommeil:{ series:[
    { id:1, enddate:sec("2026-10-05T03:00:00+02:00"), data:{ total_sleep_time:7200 } },
    { id:2, enddate:sec("2026-10-05T07:00:00+02:00"), data:{ total_sleep_time:10800 } },
    { id:3, enddate:sec("2026-10-04T16:00:00+02:00"), data:{ total_sleep_time:3600 } } ] } },
  { sommeil:{ series:[ { id:2, enddate:sec("2026-10-05T07:00:00+02:00"), data:{ total_sleep_time:10800 } } ] } }
];
const T = P.tendances("2026-10-05", G, W);
eq("quatorze jours de tendances", T.jours.length, 14);
eq("le dernier jour est aujourd'hui", T.jours[13].d, "2026-10-05");
eq("la dernière collecte Garmin gagne (8h38, comme Garmin)", T.jours[13].sg, 518);
eq("VFC de la nuit", T.jours[13].vfc, 62);
eq("Withings : nuit coupée additionnée, doublon ignoré", T.jours[13].sw, 300);
eq("Withings : la sieste de l'après-midi ne compte pas", T.jours[12].sw, null);
eq("charge de la veille", T.jours[12].ch, 1.4);
t("zone VFC reprise de Garmin", T.vfc && T.vfc[0] === 48 && T.vfc[1] === 84, JSON.stringify(T.vfc));
eq("jour sans donnée : vide, pas zéro", T.jours[0].sg, null);
/* Coucher et lever (lot 2) : minutes depuis midi la veille, heure de Paris. */
const GS = [{ date:"2026-10-05", sommeil:{ sleep_seconds:31113, sleep_start:Date.UTC(2026, 9, 4, 19, 57), sleep_end:Date.UTC(2026, 9, 5, 4, 40) } }];
const TS = P.tendances("2026-10-05", GS, W);
eq("Garmin : couché à 21h57 (heure de Paris) → 597", TS.jours[13].cou, 597);
eq("Garmin : levé à 6h40 → 1120", TS.jours[13].lev, 1120);
const WS = [{ sommeil:{ series:[
  { id:7, startdate:sec("2026-10-05T00:40:00+02:00"), enddate:sec("2026-10-05T03:00:00+02:00"), data:{ total_sleep_time:7200 } },
  { id:8, startdate:sec("2026-10-05T03:20:00+02:00"), enddate:sec("2026-10-05T07:00:00+02:00"), data:{ total_sleep_time:10800 } } ] } }];
const TW = P.tendances("2026-10-05", [], WS);
eq("sans Garmin, la ScanWatch : début de la première série (0h40 → 760)", TW.jours[13].cou, 760);
eq("et fin de la dernière (7 h → 1140)", TW.jours[13].lev, 1140);
eq("aucune donnée : pas de bloc", P.tendances("2026-10-05", [], []), null);

const E = P.echeances("2026-10-05", { next_test:"2026-10-17", caps:[
  { d:"2026-10-17", l:"Test de contrôle · 40 min" },
  { d:"2026-09-14", l:"Tour de taille", attente:true },
  { d:"2026-09-01", l:"Compte rendu du échographie", attente:true },
  { d:"2026-09-30", l:"Rendez-vous passé" },
  { d:"2026-10-09", l:"Kiné" } ] });
eq("attente la plus ancienne en tête", E[0].l, "Compte rendu du échographie");
eq("depuis 34 jours", E[0].j, 34);
eq("puis le tour de taille", E[1].l, "Tour de taille");
eq("puis le rendez-vous le plus proche", E[2].l, "Kiné");
t("le test n'est pas compté deux fois", E.filter(e => /test/i.test(e.l)).length === 1, JSON.stringify(E));
t("un rendez-vous passé disparaît", !E.some(e => e.l === "Rendez-vous passé"));

const RX = P.construire(new Date(2026, 9, 5, 7, 30), { planTxt:'PLAN_JSON_START {"meta":{"caps":[{"d":"2026-09-01","l":"Échographie","attente":true}]},"entries":[{"d":"2026-10-05","t":"Repos","type":"repos"}]} PLAN_JSON_END', garmin:G, withings:W });
t("les échéances arrivent dans la page", RX.D.echeances.length === 1 && RX.D.echeances[0].attente);
t("les tendances arrivent dans la page", RX.D.tendances && RX.D.tendances.jours.length === 14);
t("les échéances survivent à un plan illisible (mémoire)", RX.memoire.meta && RX.memoire.meta.caps.length === 1);
const RY = P.construire(new Date(2026, 9, 6, 7, 30), { planTxt:"illisible", memoire:RX.memoire });
eq("plan illisible : échéances reprises de la veille", RY.D.echeances.length, 1);
t("le bouton Parler ouvre le projet Coach", /claude\.ai\/project\//.test(RX.D.parler), RX.D.parler);

/* ---------- séances cochées par la montre (6 octobre) ---------- */
const GA = [{ date:"2026-10-06", activites_7j:{ activities:[
  { id:1, type:"running", start_time:"2026-10-06 07:12:00", distance_meters:4310, duration_seconds:1872, avg_hr_bpm:137.6 },
  { id:2, type:"walking", start_time:"2026-10-06 12:00:00", distance_meters:1200, duration_seconds:900 },
  { id:3, type:"soccer", start_time:"2026-10-06 21:00:00", distance_meters:3000, duration_seconds:3600, avg_hr_bpm:155 },
  { id:4, type:"strength_training", start_time:"2026-10-05 19:00:00", duration_seconds:300 } ] },
  seances_programmees:{ scheduled_workouts:[{ date:"2026-10-08", name:"Gainage circuit · 3 tours" }] } },
  { date:"2026-10-06", activites_7j:{ activities:[{ id:1, type:"running", start_time:"2026-10-06 07:12:00", distance_meters:4310, duration_seconds:1872, avg_hr_bpm:137.6 }] } }];
const ACT = P.activites(GA);
eq("activités dédoublonnées entre collectes", ACT.length, 4);
const FA_ = P.faitsAuto(ACT, "2026-09-28");
eq("une marche de 15 min et un gainage de 5 min ne sont pas des séances", FA_.length, 2);
const cour = FA_.find(f => f.type === "course");
t("la course porte distance, durée, allure, FC", JSON.stringify(cour.reel) === JSON.stringify([{l:"DISTANCE",v:"4,3 km"},{l:"DURÉE",v:"31:12"},{l:"ALLURE",v:"7:14 /km"},{l:"FC MOY.",v:"138"}]), JSON.stringify(cour.reel));
const planA = 'PLAN_JSON_START {"entries":[{"d":"2026-10-06","t":"Aérobie faible 30 min · 4,2 km","s":"FC 120–140","km":"4,2 km","type":"course"},{"d":"2026-10-08","t":"Gainage circuit · 3 tours","s":"13 min","type":"renfo"}]} PLAN_JSON_END';
const RA = P.construire(new Date(2026, 9, 6, 22, 0), { planTxt:planA, garmin:GA });
const footing = RA.D.plan.find(x => x.d === "2026-10-06" && /Aérobie/.test(x.t));
t("le footing du plan est coché par la montre", footing.fait && footing.auto, JSON.stringify(footing));
eq("son kilométrage réel est repris", footing.kmFait, "4,3");
const hp = RA.D.plan.find(x => x.d === "2026-10-06" && x.horsPlan);
t("le football hors plan apparaît, coché", hp && hp.fait && /Football/.test(hp.t), JSON.stringify(hp));
const RB = P.construire(new Date(2026, 9, 6, 22, 0), { planTxt:planA, garmin:GA, jour:{ date:"2026-10-06", faits:[{ d:"2026-10-06", type:"course", t:"x", reel:[{ l:"DISTANCE", v:"4,4 km" }] }] } });
eq("ce que le coach a écrit passe avant la montre", RB.D.plan.find(x => x.d === "2026-10-06" && /Aérobie/.test(x.t)).kmFait, "4,4");
eq("ce qui est sur la montre est connu de la page", RA.D.montre[0].d, "2026-10-08");
const RC = P.construire(new Date(2026, 9, 6, 22, 0), { planTxt:planA, retours:[{ type:"seance", d:"2026-10-06", t:"Aérobie faible 30 min", fait:"fait", sensation:7 }, { type:"note", d:"2026-08-01", note:"vieux" }] });
eq("les retours récents passent dans la page, pas les vieux", RC.D.retours.length, 1);

/* L'heure du mot et ce que le coach avait vu : la collecte s'en sert pour le réveiller. */
{
  const planC = 'PLAN_JSON_START {"meta":{"caps":[{"d":"2026-10-18","l":"15 km de Rouen","k":"course"}]},"entries":[{"d":"2026-10-06","t":"Football · 1 h","type":"foot"}]} PLAN_JSON_END';
  const M1 = P.construire(new Date("2026-10-06T07:27:00"), { planTxt:planC, jour:{ date:"2026-10-06", mot:"Mot A" }, memoire:{ mot:"Ancien" } });
  t("mot nouveau : son heure est notée", M1.D.motVu === new Date("2026-10-06T07:27:00").toISOString() && M1.memoire.motVu === M1.D.motVu);
  t("et l'empreinte de ce qu'il a vu (nuit pas encore mesurée)", M1.memoire.motBase && M1.memoire.motBase.d === "2026-10-06" && M1.memoire.motBase.nuit === null);
  const M2 = P.construire(new Date("2026-10-06T16:17:00"), { planTxt:planC, jour:{ date:"2026-10-06", mot:"Mot A" }, memoire:M1.memoire });
  t("même mot plus tard : heure et empreinte gardées", M2.D.motVu === M1.D.motVu && JSON.stringify(M2.memoire.motBase) === JSON.stringify(M1.memoire.motBase));
  t("l'empreinte du moment, elle, avance", M2.memoire.empreinte && M2.memoire.empreinte.d === "2026-10-06");
  const ech = M2.D.echeances.find(e => /Rouen/.test(e.l));
  t("une course à dossard garde sa nature", ech && ech.k === "course" && ech.j === 12, JSON.stringify(M2.D.echeances));
  t("l'état du réveil passe à la page", P.construire(new Date("2026-10-06T19:00:00"), { planTxt:planC, jour:{ mot:"x" }, memoire:{}, reaction:{ raisons:["a"] } }).D.reaction.raisons[0] === "a");
}

{
  /* Plusieurs sources : la même séance vue par Garmin et Strava ne compte qu'une fois. */
  const acts = P.activites([], [
    { id:1, type:"running", start_time:"2026-10-11 18:57:22", duration_seconds:3216, source:undefined },
    { id:"s9", type:"running", start_time:"2026-10-11 18:58:00", duration_seconds:3200, source:"strava" },
    { id:"s10", type:"strength_training", start_time:"2026-10-11 19:00:00", duration_seconds:900, source:"strava" },
    { id:"a2", type:"running", start_time:"2026-10-12 07:00:00", duration_seconds:1800, source:"apple_sante" } ]);
  t("sources multiples : doublon Garmin/Strava retiré, Garmin gardé", acts.length === 3 && acts[0].id === 1 && acts.some(a => a.id === "s10") && acts.some(a => a.id === "a2"), JSON.stringify(acts.map(a => a.id)));
  /* Apple Santé seule : la nuit, la VFC et les heures de coucher viennent de l'iPhone. */
  const TS = P.tendances("2026-10-11", [], [], 3, [{ date:"2026-10-11", sommeil_min:432, coucher:"2026-10-10T21:05:00.000Z", lever:"2026-10-11T04:47:00.000Z", vfc_ms:48.5 }]);
  const js = TS && TS.jours[2];
  t("Apple Santé : nuit de 7h12, VFC 49, coucher 23h05 (heure de Paris)", js && js.sw === 432 && js.vfc === 49 && js.cou === 665 && js.sg === null, JSON.stringify(js));
  t("Apple Santé : sans aucune donnée, pas de tendances (rien d'inventé)", P.tendances("2026-10-11", [], [], 3, []) === null);
}

console.log("\n  " + ok + " réussis, " + ko + " échoués");
if (ko) { for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("  Convertisseur validé.");
