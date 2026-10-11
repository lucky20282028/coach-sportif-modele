/* =====================================================================
   BANC D'ESSAI — Marc, 31 ans, multisport, personnage fictif.
   Il joue au foot le mardi soir, court 2 fois, fait du renforcement,
   marche le dimanche, et a un passé d'activités antérieur à la fenêtre
   de synchronisation. Chaque scénario reproduit un cas qui a déjà cassé
   l'affichage ou qui peut le casser.
   ===================================================================== */
const C = require("./core.js");

let pass = 0, fail = 0;
const T = (name, cond, detail) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "\n         → " + detail : "")); }
};
const H = t => console.log("\n\x1b[1m" + t + "\x1b[0m");

const TODAY = "2026-08-19";      /* mercredi */
const ACT_FROM = "2026-07-30";   /* fenêtre Strava : 20 jours */

/* ---------- le plan de Marc ---------- */
const PLAN = [
  { d:"2026-08-17", t:"Aérobie faible 50 min · 9,1 km", s:"5:30–5:50 /km", km:"9,1 km", type:"course", x:["Zones 1-2"] },
  /* mardi : DEUX séances le même jour — le bug signalé */
  { d:"2026-08-18", t:"Football · 1 h", s:"Soirée", km:"", type:"foot", x:["Échauffement long"] },
  { d:"2026-08-18", t:"Gainage circuit · 3 tours", s:"13 min", km:"", type:"renfo", x:["Planche", "Pont fessier"] },
  /* mercredi : aujourd'hui, deux séances aussi */
  { d:"2026-08-19", t:"Aérobie faible 55 min · 10 km", s:"5:35–5:55 /km", km:"10 km", type:"course", x:["Plafond 155"] },
  { d:"2026-08-19", t:"Gainage circuit · 3 tours", s:"13 min", km:"", type:"renfo", x:["Planche"] },
  { d:"2026-08-20", t:"Repos", s:"", km:"", type:"repos", x:[] },
  { d:"2026-08-21", t:"Aérobie faible + 5 LD 45 min · 9,8 km", s:"5:35–5:55 /km", km:"9,8 km", type:"course", x:["5 lignes droites"] },
  { d:"2026-08-22", t:"Endurance 55 min · 9,8 km", s:"5:35–5:55 /km", km:"9,8 km", type:"course", x:[] },
  { d:"2026-08-23", t:"Repos", s:"", km:"", type:"repos", x:["Dimanche : rien"] },
  /* format ancien, en tableau — doit rester lisible */
  ["2026-08-10", "Footing 50 min", "5:35 /km", "9,1 km", ["Ne pas accélérer"]],
  ["2026-08-11", "Repos", "gainage 3 tours", "", []],
  ["2026-08-12", "Match de foot", "", "", []]
];

/* ---------- ce que Marc a réellement enregistré ---------- */
const ACTS = [
  { start_local:"2026-08-17T07:12:00", sport_type:"Run", name:"Morning Run",
    summary:{ moving_time:2940, distance:8700, average_heartrate:148, elevation_gain:31 } },
  /* mardi : il a joué au foot mais sauté le gainage */
  { start_local:"2026-08-18T20:05:00", sport_type:"Soccer", name:"Match",
    summary:{ moving_time:3600, distance:6100, average_heartrate:161 } },
  /* dimanche 16 : une marche non planifiée */
  { start_local:"2026-08-16T15:00:00", sport_type:"Walk", name:"Balade",
    summary:{ moving_time:2700, distance:3400 } },
  /* samedi 15 : un sport inconnu du référentiel */
  { start_local:"2026-08-15T18:00:00", sport_type:"Padel", name:"Padel entre amis",
    summary:{ moving_time:3900 } },
  /* une activité trop courte : doit être ignorée */
  { start_local:"2026-08-14T12:00:00", sport_type:"Run", name:"Aller-retour",
    summary:{ moving_time:180, distance:600 } }
];

const planMap = C.buildPlan(PLAN);
const actMap = C.buildActs(ACTS);
const doneMap = {};

/* ============================ 1. MODÈLE ============================ */
H("1. Deux sports le même jour");
{
  const r = C.dayRows("2026-08-18", planMap, actMap, doneMap, TODAY, ACT_FROM);
  T("le mardi produit 2 lignes", r.length === 2, r.length + " ligne(s)");
  T("chaque ligne a son propre type", r[0].type === "foot" && r[1].type === "renfo",
    r.map(x => x.type).join(", "));
  T("les icônes diffèrent", C.TY(r[0].type).i !== C.TY(r[1].type).i);
  T("le foot est associé au match enregistré", !!r[0].act && r[0].act.sport_type === "Soccer");
  T("le gainage sauté reste non fait", r[1].done === false);
  const s0 = C.subLine(r[0], TODAY, ACT_FROM, true), s1 = C.subLine(r[1], TODAY, ACT_FROM, true);
  T("le foot affiche durée et FC", /60 min · FC 161/.test(s0.txt), s0.txt);
  T("le gainage manqué est signalé", s1.cls.includes("miss") && s1.txt === "Non réalisé", JSON.stringify(s1));
}

H("2. Aujourd'hui : deux séances, aucune faite");
{
  const r = C.dayRows(TODAY, planMap, actMap, doneMap, TODAY, ACT_FROM);
  T("2 lignes", r.length === 2);
  T("aucune n'est cochée", r.every(x => !x.done));
  const s = C.subLine(r[0], TODAY, ACT_FROM, true);
  T("le sous-titre montre l'allure prévue, pas une alerte", s.txt === "5:35–5:55 /km" && !s.cls, JSON.stringify(s));
}

H("3. Héros avec plusieurs séances");
{
  const h = C.heroModel(TODAY, planMap, actMap, doneMap, {}, ACT_FROM);
  T("titre = la première séance non faite", h.title.startsWith("Aérobie faible 55"), h.title);
  T("la seconde séance est listée", h.multi.length === 1 && h.multi[0].type === "renfo",
    JSON.stringify(h.multi));
  T("état À faire", h.state === "À faire", h.state);
  T("consigne de repli tirée du plan", h.say === "Plafond 155", h.say);
  const h2 = C.heroModel(TODAY, planMap, actMap, doneMap, { [TODAY]:"Pars lentement." }, ACT_FROM);
  T("la consigne du coach prend le dessus", h2.say === "Pars lentement.");
}

H("4. Activité hors plan");
{
  const r = C.dayRows("2026-08-15", planMap, actMap, doneMap, TODAY, ACT_FROM);
  T("le padel apparaît", r.length === 1 && r[0].ghost === true);
  T("il est typé « autre », jamais « course »", r[0].type === "autre", r[0].type);
  T("il est compté comme fait", r[0].done === true);
}

H("5. Marche sur un jour sans plan");
{
  const r = C.dayRows("2026-08-16", planMap, actMap, doneMap, TODAY, ACT_FROM);
  T("la marche est typée marche", r[0].type === "marche", r[0].type);
  T("elle n'est pas typée repos", r[0].type !== "repos");
}

H("6. Activité trop courte ignorée");
T("les 3 minutes du 14/08 ne créent rien", !actMap["2026-08-14"]);

H("7. Jour passé sans rien, dans la fenêtre");
{
  const r = C.dayRows("2026-08-13", planMap, actMap, doneMap, TODAY, ACT_FROM);
  T("une seule ligne vide", r.length === 1 && r[0].empty === true);
  T("pas de sous-titre alarmant", C.subLine(r[0], TODAY, ACT_FROM, true) === null);
}

H("8. Jour passé HORS de la fenêtre de synchronisation");
{
  const r = C.dayRows("2026-07-01", planMap, actMap, doneMap, TODAY, ACT_FROM);
  T("marqué inconnu, pas manqué", r[0].unknown === true);
  const s = C.subLine(r[0], TODAY, ACT_FROM, true);
  T("aucun « Non réalisé » mensonger", s === null || !String(s.cls).includes("miss"), JSON.stringify(s));
}

H("9. Jour futur sans plan");
{
  const r = C.dayRows("2026-09-30", planMap, actMap, doneMap, TODAY, ACT_FROM);
  T("libellé « Pas encore planifié »", r[0].plan.t === "Pas encore planifié", r[0].plan.t);
  T("aucune alerte", C.subLine(r[0], TODAY, ACT_FROM, true) === null);
}

/* ==================== 10. FORMAT ANCIEN ==================== */
H("10. Plan au format tableau (ancien)");
{
  const a = C.dayRows("2026-08-10", planMap, actMap, doneMap, TODAY, ACT_FROM)[0];
  T("« Footing » est bien de la COURSE, pas du football", a.type === "course", a.type);
  const b = C.dayRows("2026-08-11", planMap, actMap, doneMap, TODAY, ACT_FROM)[0];
  T("« Repos » + gainage devient du renforcement", b.type === "renfo", b.type);
  T("et son titre est corrigé", b.plan.t === "Renforcement", b.plan.t);
  const c = C.dayRows("2026-08-12", planMap, actMap, doneMap, TODAY, ACT_FROM)[0];
  T("« Match de foot » est du football", c.type === "foot", c.type);
}

H("11. Déduction de type depuis un titre");
{
  const cases = {
    "Footing 50 min":"course", "Aérobie faible 55 min · 10 km":"course",
    "Endurance 1h15":"course", "Fractionné 8×400":"course", "Tempo 3×8 min":"course",
    "Football · 1 h":"foot", "Match amical":"foot",
    "Gainage circuit · 3 tours":"renfo", "Renforcement bas du corps":"renfo",
    "Endurance vélo 1h30 · 35 km":"velo", "Home trainer 45 min":"velo",
    "Natation 800 m":"nage", "Marche active 40 min":"marche",
    "Repos":"repos", "Padel":"autre", "Yoga du soir":"autre"
  };
  Object.keys(cases).forEach(k => T('"' + k + '" → ' + cases[k],
    C.typeFromTitle(k) === cases[k], "obtenu : " + C.typeFromTitle(k)));
}

H("12. Types Strava");
{
  T("TrailRun → course", C.kindOf("TrailRun") === "course");
  T("GravelRide → vélo", C.kindOf("GravelRide") === "velo");
  T("Crossfit → renforcement", C.kindOf("Crossfit") === "renfo");
  T("Hike → marche", C.kindOf("Hike") === "marche");
  T("Sport inconnu → autre (jamais course)", C.kindOf("Kitesurf") === "autre");
  T("undefined → autre", C.kindOf(undefined) === "autre");
}

/* ==================== 13. SEMAINE ==================== */
H("13. Comptage de la semaine");
{
  const s = C.weekStats(TODAY, 0, planMap, actMap, doneMap, ACT_FROM);
  /* lun 1 course · mar foot+renfo · mer course+renfo · jeu repos · ven 1 · sam 1 · dim repos */
  T("7 séances prévues", s.prevu === 7, "prevu=" + s.prevu);
  T("2 faites (course lundi + foot mardi)", s.fait === 2, "fait=" + s.fait);
  T("pourcentage cohérent", s.pct === Math.round(2 / 7 * 100), "pct=" + s.pct);
  T("les km de course ne comptent que la course", Math.abs(s.kmReel - 8.7) < 0.01, "kmReel=" + s.kmReel);
  T("les 6,1 km du match sont exclus", s.kmReel < 9);
}

H("14. Semaine précédente : hors plan compté à part");
{
  const s = C.weekStats(TODAY, -1, planMap, actMap, doneMap, ACT_FROM);
  T("2 activités hors plan (padel + marche)", s.horsPlan === 2, "horsPlan=" + s.horsPlan);
  T("3 séances prévues au format ancien", s.prevu === 3, "prevu=" + s.prevu);
}

H("15. Validation manuelle par séance");
{
  const d = {};
  d[C.doneKey("2026-08-19", 1)] = true;     /* je coche le gainage du mercredi */
  const r = C.dayRows(TODAY, planMap, actMap, d, TODAY, ACT_FROM);
  T("la 2e séance est cochée", r[1].done === true);
  T("la 1re ne l'est pas", r[0].done === false);
  const d2 = {}; d2["2026-08-17"] = false;   /* je décoche une séance auto-validée */
  const r2 = C.dayRows("2026-08-17", planMap, actMap, d2, TODAY, ACT_FROM);
  T("décocher prime sur la détection automatique", r2[0].done === false);
}

/* ==================== 16. INDICATEURS ==================== */
H("16. Les trois chiffres d'état");
{
  const vide = C.etatModel({});
  T("trois chiffres même sans données", vide.length === 3);
  T("aucun chiffre inventé", vide.every(x => x.v === "—" && x.c === "none"),
    JSON.stringify(vide.map(x => x.v)));
  T("plus aucune phrase littéraire", vide.every(x => !x.s),
    "les phrases sont le métier du coach, pas des cases");

  const plein = C.etatModel({ ratio:1.2, sleep:6.75, sleepAvg:5.52,
                              low:425, high:697, ana:176 });
  T("charge affichée avec son verdict", plein[0].v === "1,2" && plein[0].u === "optimale",
    JSON.stringify(plein[0]));
  T("sommeil avec sa moyenne", plein[1].v === "6h45" && /5h31/.test(plein[1].u),
    JSON.stringify(plein[1]));
  T("base aérobie en pourcentage de la charge", plein[2].v === "33 %", plein[2].v);

  T("ratio 1,6 → trop élevée, rouge",
    C.etatModel({ratio:1.6})[0].u === "trop élevée" && C.etatModel({ratio:1.6})[0].c === "bad");
  T("ratio 0,6 → basse, orange",
    C.etatModel({ratio:0.6})[0].u === "basse" && C.etatModel({ratio:0.6})[0].c === "warn");
  T("sommeil 7h30 → vert", C.etatModel({sleep:7.5})[1].c === "ok");
  T("sommeil 5h58 → rouge", C.etatModel({sleep:5.97})[1].c === "bad");
}

H("16 bis. La base aérobie ne dépend plus des zones estimées");
{
  /* Le 22 août, l'athlète court 15 km à 150 de moyenne, tient le plafond qu'il
     s'est fixé, et se sent capable d'une heure de plus. L'ancien indicateur
     annonçait « Trop rapide, 9 % en zone facile » : la zone 2 de Garmin
     plafonne à 140, très en dessous de son seuil réel. */
  const p = C.basePct({ low:425, high:697, ana:176 });
  T("la part d'aérobie faible se calcule sur la charge", Math.round(p) === 33, p);
  T("elle ne dépend d'aucun pourcentage de zone", !/zone/i.test(String(C.basePct)));
  T("sans données, pas de valeur", C.basePct({}) === null);
  T("une charge nulle ne divise pas par zéro", C.basePct({low:0,high:0,ana:0}) === null);
}

/* ==================== 17. LECTURE DRIVE ==================== */
H("17. Extraction des blocs Drive");
{
  const nouveau = "SYNTHESE_START\n\nHuit heures de sommeil, ton record. Ratio à 1,1.\n\nSYNTHESE_END";
  T("nouveau format", C.synthese(nouveau) === "Huit heures de sommeil, ton record. Ratio à 1,1.",
    C.synthese(nouveau));
  const ancien = "POINT\\_HTML\\_START\n\n\\<p\\>\\<strong\\>8h48\\</strong\\> cette nuit, ton record.\\</p\\>\n\\<p\\>Autre chose.\\</p\\>\n\nPOINT\\_HTML\\_END";
  T("ancien format : balises retirées", C.synthese(ancien) === "8h48 cette nuit, ton record.",
    C.synthese(ancien));
  T("bloc absent → null", C.synthese("rien du tout") === null);
  const long = "SYNTHESE_START\n" + "mot ".repeat(120) + "\nSYNTHESE_END";
  T("une synthèse longue n'est pas tronquée par erreur", C.synthese(long).length > 200);
  const p = "PLAN\\_JSON\\_START\n\n{\"entries\":\\[\\]}\n\nPLAN\\_JSON\\_END";
  T("échappement Google neutralisé", C.between(p, "PLAN_JSON_START", "PLAN_JSON_END").trim() === '{"entries":[]}',
    C.between(p, "PLAN_JSON_START", "PLAN_JSON_END"));
}

/* ==================== 18. CAS DÉGRADÉS ==================== */
H("18. Cas dégradés");
{
  T("plan vide ne casse rien", C.buildPlan([]) && Object.keys(C.buildPlan([])).length === 0);
  T("plan null ne casse rien", Object.keys(C.buildPlan(null)).length === 0);
  T("activités nulles", Object.keys(C.buildActs(null)).length === 0);
  const vide = C.dayRows(TODAY, {}, {}, {}, TODAY, ACT_FROM);
  T("journée sans plan ni activité", vide.length === 1 && vide[0].empty === true);
  const h = C.heroModel(TODAY, {}, {}, {}, {}, ACT_FROM);
  T("héros sans plan reste lisible", h.title === "Pas encore planifié" || h.title === "Repos", h.title);
  T("et propose une phrase", h.say.length > 10);
  const s = C.weekStats(TODAY, 0, {}, {}, {}, ACT_FROM);
  T("semaine vide : 0 %", s.pct === 0 && s.prevu === 0);
  T("aucune division par zéro", isFinite(s.pct));
  /* activité sans distance ni FC */
  const am = C.buildActs([{ start_local:"2026-08-19T10:00:00", sport_type:"Yoga", name:"Yoga",
    summary:{ moving_time:1800 } }]);
  const r = C.dayRows(TODAY, planMap, am, {}, TODAY, ACT_FROM);
  T("le yoga n'écrase pas les séances prévues", r.length === 3, r.length + " lignes");
  T("il arrive en dernier, hors plan", r[2].ghost === true);
}

H("19. Un jour ne peut pas être « repos » et contenir une séance");
{
  const p = C.buildPlan([
    { d:"2026-08-25", t:"Repos", type:"repos" },
    { d:"2026-08-25", t:"Gainage circuit · 3 tours", type:"renfo" }
  ]);
  T("le repos est écarté", p["2026-08-25"].length === 1 && p["2026-08-25"][0].type === "renfo",
    JSON.stringify(p["2026-08-25"].map(x => x.type)));
}

H("20. Cohérence des seuils d'allure");
{
  T("5:15 est rapide", C.PACE.fast === 315);
  T("6:05 est la borne lente", C.PACE.slow === 365);
  const row = { act:{ summary:{ moving_time:2400, distance:8000 } }, type:"course", k:"2026-08-17" };
  const s = C.subLine(row, TODAY, ACT_FROM, true);
  T("5:00 /km signalé comme trop rapide", s.fast === true, JSON.stringify(s));
  const row2 = { act:{ summary:{ moving_time:2940, distance:8700 } }, type:"course", k:"2026-08-17" };
  T("5:38 /km n'est pas signalé", C.subLine(row2, TODAY, ACT_FROM, true).fast === false);
}

H("21. Vélo : vitesse et non allure");
{
  const row = { act:{ summary:{ moving_time:3600, distance:30000 } }, type:"velo", k:"2026-08-17" };
  const s = C.subLine(row, TODAY, ACT_FROM, true);
  T("affiché en km/h", /km\/h/.test(s.txt), s.txt);
  T("30,0 km à 30 km/h", s.txt === "30,0 km · 30,0 km/h", s.txt);
}


H("22. Titres fusionnés par une tâche mal formée");
{
  const p = C.buildPlan([["2026-08-20","Footing 55 min + Gainage circuit · 3 tours","5:35-5:55 /km","10,0 km",["Décalé"]]]);
  const r = p["2026-08-20"];
  T("le titre fusionné est scindé en 2 séances", r.length === 2, r.length + " séance(s)");
  T("la première est de la course", r[0].type === "course", r[0].type);
  T("la seconde est du renforcement", r[1].type === "renfo", r[1].type);
  T("les km restent sur la course", r[0].km === "10,0 km" && r[1].km === "");
  T("les titres sont propres", r[0].t === "Footing 55 min" && r[1].t === "Gainage circuit · 3 tours",
    r.map(x=>x.t).join(" | "));
  /* ce qui ne doit SURTOUT pas être scindé */
  const q = C.buildPlan([{d:"2026-08-21",t:"Aérobie faible + 5 LD 45 min · 9,8 km",type:"course",km:"9,8 km"}]);
  T("« Aérobie faible + 5 LD » reste UNE seule séance", q["2026-08-21"].length === 1,
    q["2026-08-21"].map(x=>x.t).join(" | "));
  const r2 = C.buildPlan([{d:"2026-08-22",t:"Tempo 3×8 min + retour au calme",type:"course"}]);
  T("« + retour au calme » ne crée pas de séance", r2["2026-08-22"].length === 1);
  const r3 = C.buildPlan([["2026-08-23","Endurance vélo 1h30 + Natation 800 m","","",[]]]);
  T("vélo + natation sont bien deux séances", r3["2026-08-23"].length === 2,
    r3["2026-08-23"].map(x=>x.type).join(", "));
  const r4 = C.buildPlan([["2026-08-24","Footing 30 min + Footing 20 min","","",[]]]);
  T("deux fois le même sport ne sont pas scindés", r4["2026-08-24"].length === 1);
}


H("23. Coche verte et « Non réalisé » ne peuvent PAS coexister");
{
  const d = {}; d["2026-08-13"] = true;           /* validée à la main, aucune activité */
  const plan = C.buildPlan([{d:"2026-08-13",t:"Gainage circuit · 3 tours",type:"renfo"}]);
  const r = C.dayRows("2026-08-13", plan, {}, d, TODAY, ACT_FROM);
  T("la séance est cochée", r[0].done === true);
  const s = C.subLine(r[0], TODAY, ACT_FROM, true);
  T("le sous-titre ne dit PAS « Non réalisé »", s.txt !== "Non réalisé", s.txt);
  T("il confirme la validation manuelle", s.txt === "Validée à la main" && s.cls === "real", JSON.stringify(s));
}

H("24. Strava muet : on n'accuse personne");
{
  const plan = C.buildPlan([{d:"2026-08-17",t:"Aérobie faible 50 min",s:"5:35–5:55 /km",type:"course"}]);
  const r = C.dayRows("2026-08-17", plan, {}, {}, TODAY, ACT_FROM);
  const muet = C.subLine(r[0], TODAY, ACT_FROM, false);
  T("sans activités chargées, aucune accusation", !muet || !String(muet.cls).includes("miss"),
    JSON.stringify(muet));
  T("on montre l'allure prévue à la place", muet && muet.txt === "5:35–5:55 /km", JSON.stringify(muet));
  const charge = C.subLine(r[0], TODAY, ACT_FROM, true);
  T("une fois chargées, le manque est signalé", charge.cls.includes("miss"), JSON.stringify(charge));
}

H("25. Consigne périmée après un ajustement du plan");
{
  T("plan republié 3 h après le point → consigne périmée",
    C.consigneStale("2026-08-19T07:32:00Z", "2026-08-19T10:35:00Z") === true);
  T("plan publié dans la foulée du point → consigne valable",
    C.consigneStale("2026-08-19T07:32:00Z", "2026-08-19T07:33:10Z") === false);
  T("sans horodatage, on ne présume rien", C.consigneStale(null, "2026-08-19T10:00:00Z") === false);
  /* le cas réel : sortie annulée pour cause de pluie */
  const plan = C.buildPlan([{d:TODAY,t:"Repos",type:"repos",x:["Sortie décalée à demain : pluie"]}]);
  const cg = {}; cg[TODAY] = "Pars vraiment lentement, plafond 155 de fréquence cardiaque.";
  const perime = C.heroModel(TODAY, plan, {}, {}, cg, ACT_FROM, true);
  T("un jour de repos n'affiche pas une consigne de course",
    !/plafond 155/.test(perime.say), perime.say);
  T("il affiche la raison du plan", /pluie/.test(perime.say), perime.say);
  const valide = C.heroModel(TODAY, plan, {}, {}, cg, ACT_FROM, false);
  T("une consigne encore valable est conservée", /plafond 155/.test(valide.say) || /pluie/.test(valide.say),
    valide.say);
}

H("26. Une seule trajectoire, la plus parlante");
{
  const t = C.trajectoire({ ratio:1.2, ratio7:2.5, low:425, high:697, ana:176,
                            low7:0, high7:697, ana7:176,
                            sleepAvg:5.52, sleepAvgPrev:6.58 });
  T("une seule ligne, pas trois", t && typeof t.txt === "string");
  T("c'est la plus grosse variation qui gagne", /Base aérobie/.test(t.txt), t.txt);
  T("elle est verte car elle progresse", t.c === "ok");

  const s2 = C.trajectoire({ sleepAvg:5.5, sleepAvgPrev:6.6 });
  T("un sommeil en baisse s'affiche en ROUGE", s2.c === "bad", JSON.stringify(s2));
  const c2 = C.trajectoire({ ratio:2.4, ratio7:1.2 });
  T("une charge qui s'éloigne de la cible → rouge", c2.c === "bad", JSON.stringify(c2));
  const c3 = C.trajectoire({ ratio:1.1, ratio7:3.3 });
  T("une charge qui revient vers la cible → vert", c3.c === "ok");
  T("rien à signaler → rien affiché", C.trajectoire({}) === null);
  T("variation négligeable ignorée", C.trajectoire({ratio:1.2,ratio7:1.3}) === null);
}

H("27. Synthèse tronquée proprement");
{
  const long = "POINT_HTML_START<p>Première phrase courte. Deuxième phrase qui développe un point important sur ta charge. Troisième phrase qui n'a pas la place et doit disparaître entièrement sans laisser de moignon.</p>POINT_HTML_END";
  const s = C.synthese(long);
  T("la coupe tombe en fin de phrase", /\.$/.test(s), "…" + s.slice(-40));
  T("aucun mot orphelin du type « Il… »", !/\b\S{1,3}…$/.test(s), "…" + s.slice(-25));
  T("longueur raisonnable", s.length <= 195, s.length + " caractères");
}

H("28. Série : ce qui fait revenir");
{
  const A = {};
  const mk = (k,n) => { A[k] = []; for(let i=0;i<n;i++) A[k].push({kind:"course",summary:{distance:8000,moving_time:2400}}) };
  /* 3 semaines pleines à 3 séances, et 1 séance cette semaine */
  [ ["2026-08-10",1],["2026-08-11",1],["2026-08-12",1],
    ["2026-08-03",2],["2026-08-05",1],
    ["2026-07-27",1],["2026-07-29",1],["2026-07-31",1],
    ["2026-08-17",1] ].forEach(([k,n]) => mk(k,n));
  const st = C.streakModel(TODAY, A, 3);
  T("3 semaines pleines d'affilée", st.weeks === 3, "weeks=" + st.weeks);
  T("1 séance cette semaine", st.now === 1, "now=" + st.now);
  T("il en manque 2", st.need === 2);
  T("la phrase pousse à finir la semaine", /manque 2/.test(st.phrase), st.phrase);
  const vide = C.streakModel(TODAY, {}, 3);
  T("aucune activité : série à 0", vide.weeks === 0 && vide.now === 0);
  T("et un message qui relance", /relance/.test(vide.phrase), vide.phrase);
  const A2 = Object.assign({}, A); mk("2026-08-18",1); mk("2026-08-19",1); A2["2026-08-18"]=A["2026-08-18"]; A2["2026-08-19"]=A["2026-08-19"];
  const st2 = C.streakModel(TODAY, A, 3);
  T("semaine en cours validée → la série s'incrémente", st2.weeks === 3 && st2.now === 3, st2.phrase);
  T("le message félicite sans être creux", /Ne casse pas/.test(st2.phrase), st2.phrase);
}

H("29. Prochain cap");
{
  const c = C.capModel(TODAY, {next_test:"2026-09-03"});
  T("le test de contrôle est repéré", c && c.label === "Test de contrôle");
  T("compte à rebours exact", c.jours === 15, "jours=" + c.jours);
  T("formulation naturelle", c.txt === "dans 15 jours", c.txt);
  const d = C.capModel(TODAY, {next_test:"2026-08-20", caps:[{d:"2026-09-01",l:"Échographie du dos"}]});
  T("la plus proche échéance gagne", d.label === "Test de contrôle" && d.jours === 1, JSON.stringify(d));
  T("« demain » plutôt que « dans 1 jour »", d.txt === "demain", d.txt);
  T("échéance passée ignorée", C.capModel(TODAY, {next_test:"2026-08-01"}) === null);
  T("sans meta, pas de cap", C.capModel(TODAY, {}) === null && C.capModel(TODAY, null) === null);
  const e = C.capModel(TODAY, {caps:[{d:"2026-09-01",l:"Échographie du dos"}]});
  T("une échéance libre est acceptée", e && e.label === "Échographie du dos");
}


H("30. Encodage cassé par Google Docs");
{
  /* ce que l'application recevait réellement le 20 août */
  const casse = "Mange dans l'heure, des prot\u00c3\u00a9ines. Ce n'est plus la fatigue qui t'en emp\u00c3\u00aache \u00e2\u20ac\u201d c'est l'habitude.";
  const repare = C.demojibake(casse);
  T("les accents sont rétablis", /protéines/.test(repare), repare.slice(0, 45));
  T("les circonflexes aussi", /empêche/.test(repare), repare.slice(45, 90));
  T("le tiret cadratin aussi", /—/.test(repare), repare.slice(-30));
  T("plus aucune séquence parasite", !/Ã|â€/.test(repare));

  /* un texte français SAIN ne doit surtout pas être touché */
  const sain = "Aérobie faible 55 min · 10 km — être à l'heure, ça coûte cher.";
  T("un texte sain traverse intact", C.demojibake(sain) === sain, C.demojibake(sain));
  T("un texte sans accent traverse intact", C.demojibake("Repos") === "Repos");
  T("une chaîne vide ne casse pas", C.demojibake("") === "");

  /* cas limites */
  T("caractères non latins préservés", C.demojibake("séance 東京") === "séance 東京");
  const json = '{"t":"A\u00c3\u00a9robie faible","km":"9,1 km"}';
  T("un JSON abîmé est réparé avant analyse",
    JSON.parse(C.demojibake(json)).t === "Aérobie faible", C.demojibake(json));
  T("une réparation impossible rend le texte d'origine",
    C.demojibake("Ã\u00ff\u00ff") === "Ã\u00ff\u00ff");
}

console.log("\n" + "─".repeat(52));
console.log(pass + " réussis, " + fail + " échoués");
process.exit(fail ? 1 : 0);
