/* ==========================================================================
   BANC DES ANALYSES — lot 1 (7 octobre 2026)
   Sorties km par km, moteur, objectifs, échéance du tour de taille, règles
   du feu du jour et synthèse du coach. Séries synthétiques, horloge figée :
   chaque chiffre attendu se recalcule à la main.
   ========================================================================== */
const fs = require("fs");
const path = require("path");
const C = require("./core.js");
const A = require("./analyses.js");
const P = require("./depuis-plan.js");
/* Un athlète d'essai (fictif) qui a des objectifs de reprise et de tour de taille. */
const ATHL = require("../commun/athlete.cjs").fusion(require("../commun/athlete.cjs").DEFAUT, require("./fixture-athlete.json"));

let ok = 0, ko = 0; const echecs = [];
const t = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? "  → " + String(d).slice(0, 220) : "")); } };
const eq = (n, a, b) => t(n, a === b, "attendu " + JSON.stringify(b) + ", obtenu " + JSON.stringify(a));

/* Une sortie synthétique : un point toutes les 15 s, [t, distance, FC].
   v(t) : vitesse en m/s ; fc(t) : fréquence cardiaque. */
function serie(minutes, v, fc) {
  const out = []; let d = 0;
  for (let s = 0; s <= minutes * 60; s += 15) { out.push([s, Math.round(d), fc(s)]); d += v(s) * 15; }
  return out;
}

/* ---------- 1. allure à FC fixe ---------- */
const S1 = serie(40, () => 1000 / 345, s => s < 600 ? 120 + s / 20 : 150);
eq("allure à 150 : 5:45 tenue après l'échauffement → 345 s/km", A.allureA(S1, 150), 345);
eq("allure à 140 : jamais à 140 après l'échauffement → rien", A.allureA(S1, 140), null);
const S2 = serie(14, () => 1000 / 345, () => 150);
eq("trop courte (4 min utiles après l'échauffement) : pas de mesure", A.allureA(S2, 150), null);
const S3 = serie(40, s => s > 1500 && s < 1800 ? 1.2 : 1000 / 345, s => s < 600 ? 130 : 150);
eq("une marche au milieu n'entre pas dans l'allure", A.allureA(S3, 150), 345);
eq("les 10 premières minutes ne comptent jamais", A.allureA(serie(30, () => 3, s => s < 600 ? 150 : 170), 150), null);

/* ---------- 2. dérive cardiaque ---------- */
eq("allure et cœur constants : dérive nulle", A.derive(S1), 0);
const S4 = serie(50, () => 3, s => s < 600 ? 140 : s < 1800 ? 150 : 160);
const d4 = A.derive(S4);
t("cœur de 150 à 160 à allure égale : dérive ≈ 6 %", d4 >= 5.5 && d4 <= 6.5, d4);
eq("moins de 20 min après l'échauffement : pas de dérive", A.derive(serie(25, () => 3, () => 150)), null);

/* ---------- 3. plafond du plan ---------- */
eq("endurance plafond 145 → 145", A.plafondDe(C.LIB.endurance(10, 145)), 145);
eq("aérobie faible → 145 (borne haute du corps de séance)", A.plafondDe(C.LIB.facile(40)), 145);
eq("gainage : pas de plafond", A.plafondDe(C.LIB.gainage(3)), null);

/* ---------- 4. résumé d'une sortie ---------- */
const fiche = { id:42, date:"2026-08-22", debut:"2026-08-22 07:10:00", distance_m:10400, duree_s:3600, fc_moy:149, fc_max:158, deniv_pos:64,
  km:[{ n:1, m:1000, s:372, fc:131, dp:3 }, { n:2, m:1000, s:351, fc:146, dp:12 }, { n:3, m:1000, s:346, fc:155, dp:2 }, { n:4, m:400, s:140, fc:150, dp:0, partiel:true }],
  serie:serie(40, () => 1000 / 345, s => s < 600 ? 125 : s < 900 ? 155 : 149) };
const R = A.resumeSortie(fiche, 150);
eq("résumé : l'allure du km se calcule (372 s pour 1000 m)", R.km[0].p, 372);
eq("résumé : km partiel ramené au km (140 s pour 400 m = 350)", R.km[3].p, 350);
eq("résumé : le dénivelé du km suit", R.km[1].dp, 12);
eq("résumé : km sous le plafond (155 dépasse)", R.kmSous, 3);
const sous = fiche.serie.filter(p => p[2] <= 150).length, tous = fiche.serie.filter(p => p[2]).length;
eq("résumé : part du temps sous le plafond", R.pctSous, Math.round(sous / tous * 100));
eq("résumé : courbe allégée (un point sur deux)", R.serie.length, Math.ceil(fiche.serie.length / 2));
t("résumé : la courbe est en minutes", R.serie[R.serie.length - 1][0] === 40, JSON.stringify(R.serie.slice(-1)));
eq("résumé sans plafond : pas de verdict inventé", A.resumeSortie(fiche, null).pctSous, null);
eq("fiche en erreur : pas de résumé", A.resumeSortie({ erreur:"FIT illisible" }, 150), null);

/* ---------- 5. le moteur ---------- */
const M = A.moteur([Object.assign({}, fiche, { id:2, date:"2026-08-22", debut:"2026-08-22 07:10" }),
                    Object.assign({}, fiche, { id:1, date:"2026-02-16", debut:"2026-02-16 08:00", serie:serie(40, () => 1000 / 370, s => s < 600 ? 130 : 150) }),
                    { id:3, erreur:"pas de FIT" }]);
t("moteur : trié par date, une mesure par sortie", M.a150.length === 2 && M.a150[0][0] === "2026-02-16" && M.a150[0][1] === 370, JSON.stringify(M));

/* ---------- 6. objectifs ---------- */
const acts = [
  { id:1, type:"running", start_time:"2026-09-29 07:00:00", duration_seconds:720 },
  { id:2, type:"running", start_time:"2026-10-01 07:00:00", duration_seconds:480 },        /* 8 min : pas une course */
  { id:3, type:"strength_training", start_time:"2026-10-02 19:00:00", duration_seconds:360 },
  { id:4, type:"soccer", start_time:"2026-10-02 21:00:00", duration_seconds:3600 },
  { id:5, type:"running", start_time:"2026-10-06 07:00:00", duration_seconds:1800 },
  { id:6, type:"road_biking", start_time:"2026-05-02 09:00:00", duration_seconds:7200 }
];
const ret = [{ type:"seance", d:"2026-10-06", t:"Aérobie faible 30 min", fait:"fait" },           /* même course que la montre */
             { type:"seance", d:"2026-10-07", t:"Gainage circuit · 3 tours", fait:"fait" },
             { type:"seance", d:"2026-10-08", t:"Aérobie faible 30 min", fait:"pas fait" }];
const O = A.objectifs("2026-10-08", acts, ret, []);
eq("objectifs : 12 semaines au plus", O.semaines.length, 12);
const sem = O.semaines[O.semaines.length - 1], prec = O.semaines[O.semaines.length - 2];
eq("cette semaine : une course (montre et déclaration ne s'additionnent pas)", sem.course, 1);
eq("cette semaine : un gainage déclaré", sem.renfo, 1);
eq("semaine passée : 1 course (8 min ne compte pas)", prec.course, 1);
eq("semaine passée : gainage de 6 min compté", prec.renfo, 1);
eq("semaine passée : football", prec.foot, 1);
eq("dernière course", O.dernier.course, "2026-10-06");
eq("dernier vélo", O.dernier.velo, "2026-05-02");
eq("dernier gainage, déclaré compris", O.dernier.renfo, "2026-10-07");
eq("une séance « pas faite » ne compte pas", A.objectifs("2026-10-08", [], [ret[2]], []).semaines.slice(-1)[0].course, 0);

/* ---------- 7. tour de taille : mesure et échéance ---------- */
const MS = A.mesures([{ type:"mesure", d:"2026-09-20", tour_taille:85.2 }, { type:"note", d:"2026-09-21" }, { type:"mesure", d:"2026-09-06", tour_taille:86 }]);
t("mesures triées par date", MS.length === 2 && MS[0].d === "2026-09-06" && MS[1].cm === 85.2, JSON.stringify(MS));
const meta = { caps:[{ d:"2026-09-14", l:"Tour de taille à relever", attente:true }, { d:"2026-09-01", l:"Compte rendu", attente:true }] };
const E1 = P.echeances("2026-09-25", meta, MS);
t("une mesure après l'attente la lève", !E1.some(e => e.attente && /taille/i.test(e.l)), JSON.stringify(E1));
t("la suivante est prévue deux semaines après la dernière", E1.some(e => !e.attente && e.d === "2026-10-04" && /taille/i.test(e.l)), JSON.stringify(E1));
const E2 = P.echeances("2026-10-06", meta, MS);
t("deux semaines passées : le tour de taille revient en attente", E2.some(e => e.attente && e.d === "2026-10-04" && /taille/i.test(e.l)), JSON.stringify(E2));
t("sans mesure : l'attente du plan reste", P.echeances("2026-09-25", meta, []).some(e => e.attente && /taille/i.test(e.l)));

/* ---------- 8. règles du feu : check-in ---------- */
const Z = A.checkinDe(ATHL).zones;
const rc = ck => C.reglesCheckin(ck, Z);
eq("check-in tout va bien : aucun signal", rc({ forme:4, jambes:"fraîches", alerte:"rien" }).length, 0);
const dt = rc({ forme:4, jambes:"fraîches", alerte:"douleur", zone:"genou" });
t("douleur au genou : rouge, consulter", dt.length === 1 && dt[0].niveau === "rouge" && /genou droit/.test(dt[0].texte) && /examiner/.test(dt[0].texte), JSON.stringify(dt));
const rt = rc({ forme:4, jambes:"fraîches", alerte:"raideur", zone:"genou" });
t("raideur au genou : la consigne du profil", rt.length === 1 && rt[0].niveau === "orange" && /kiné du sport/.test(rt[0].texte), JSON.stringify(rt));
const rb = rc({ forme:2, jambes:"lourdes", alerte:"raideur", zone:"dos" });
t("raideur au dos + forme 2 + jambes lourdes : trois signaux orange", rb.length === 3 && rb.every(x => x.niveau === "orange") && /dos ou aux lombaires/.test(rb[0].texte), JSON.stringify(rb));
const gen = C.reglesCheckin({ alerte:"douleur", zone:"genou" });
t("sans zones fournies : texte générique, aucun mot de santé", gen.length === 1 && !/Genou|genou|dos/i.test(gen[0].texte), JSON.stringify(gen));

/* ---------- 9. règles du feu : retours de séance ---------- */
const rr = C.reglesRetours([
  { type:"seance", d:"2026-10-05", t:"Football · 1 h", douleur:"forte" },
  { type:"seance", d:"2026-10-06", t:"Gainage", sensation:3 },
  { type:"seance", d:"2026-10-03", t:"Vieux", douleur:"forte" },
  { type:"note", d:"2026-10-06", note:"rien" }], "2026-10-06");
t("douleur forte hier : rouge", rr.some(x => x.niveau === "rouge" && /Football/.test(x.texte) && /hier/.test(x.texte)), JSON.stringify(rr));
t("sensation 3/10 aujourd'hui : orange", rr.some(x => x.id === "retour_sensation" && /3\/10/.test(x.texte)));
t("un retour d'il y a trois jours ne compte plus", !rr.some(x => /Vieux/.test(x.texte)));
const rr2 = C.reglesRetours([{ type:"seance", d:"2026-10-06", t:"Gainage", douleur:"forte" }, { type:"seance", d:"2026-10-06", t:"Gainage", douleur:"aucune", sensation:7 }], "2026-10-06");
eq("le retour le plus récent d'une séance remplace l'ancien", rr2.length, 0);
t("séance écourtée pour douleur : orange", C.reglesRetours([{ type:"seance", d:"2026-10-06", t:"Footing", fait:"en partie", raison:"douleur" }], "2026-10-06")[0].niveau === "orange");

/* ---------- 10. synthèse du matin ---------- */
const jour = (d, sg, vfc) => ({ d, sg, sw:null, vfc, ch:1 });
const T = { jours:[jour("2026-09-30", 420, 60), jour("2026-10-01", 400, 62), jour("2026-10-02", 410, 61), jour("2026-10-03", 350, 60),
  jour("2026-10-04", 340, 52), jour("2026-10-05", 345, 50), jour("2026-10-06", 300, 49)], vfc:[48, 84] };
const garmin = [{ date:"2026-10-06", disponibilite:[{ score:22, level:"LOW", recovery_time_hours:30 }],
  statut:{ load_ratio:1.1, acute_load:300, chronic_load:270, acwr_status:"OPTIMAL", monthly_load_aerobic_low:30, monthly_load_aerobic_high:60, monthly_load_anaerobic:10 } }];
const plan = [{ d:"2026-10-06", t:"Aérobie faible 40 min", fam:"facile", etapes:C.LIB.facile(40).etapes }];
const meteo = { heures:{ "2026-10-06T07:00":[12.4, 11.2, 10, 8], "2026-10-06T19:00":[26.2, 27.4, 0, 12] } };
const syn = A.synthese({ athlete:ATHL, today:"2026-10-06", maintenant:new Date(2026, 9, 6, 6, 50), garmin, T, plan, meteo,
  retours:[{ type:"checkin", d:"2026-10-06", forme:3, jambes:"fraîches", alerte:"raideur", zone:"genou", ecrit:"2026-10-06 06h40" }],
  O:{ semaines:[{ l:"2026-10-06", course:0, renfo:0, foot:0 }] }, M:{ a150:[["2026-08-22", 344]], a140:[] }, sorties:[R] });
const regle = id => syn.regles.find(x => x.id === id);
t("nuit de 5h00 : sous 5h30, déclenchée", regle("nuit_courte").declenchee && /5h00/.test(regle("nuit_courte").texte));
t("4 nuits sous 6 h sur 5 : déclenchée", regle("nuits_courtes").declenchee && /4 nuits/.test(regle("nuits_courtes").texte), regle("nuits_courtes").texte);
eq("VFC : 3 dernières nuits (50,3) contre les 3 d'avant (61) : −17 %", syn.vfc.variation_pct, -17);
t("VFC en baisse de plus de 10 % : déclenchée, signe moins typographique", regle("vfc_baisse").declenchee && /−17 %/.test(regle("vfc_baisse").texte), regle("vfc_baisse").texte);
t("disponibilité 22/100 : déclenchée", regle("disponibilite").declenchee);
t("check-in raideur au genou : signal du profil", syn.regles.some(x => x.id === "checkin" && /kiné du sport/.test(x.texte)));
t("chaleur à 19 h avec une course : information, plafond 155", regle("chaleur") && regle("chaleur").niveau === "info" && /155/.test(regle("chaleur").texte));
eq("feu orange (aucune règle rouge)", syn.feu, "orange");
eq("part d'aérobie faible du mois", syn.charge.part_aerobie_faible_pct, 30);
eq("météo du soir lue à l'heure près", syn.meteo.soir_19h.ressenti, 27);
eq("dernière sortie : allure à 150 écrite pour le coach", syn.derniere_sortie.allure_a_150, "5:45");
eq("dernière sortie : plafond tenu, en %", syn.derniere_sortie.pct_temps_sous_plafond, R.pctSous);
const vide = A.synthese({ today:"2026-10-06", maintenant:new Date(2026, 9, 6, 6, 50), garmin:[], T:null, plan:[], retours:[], meteo:null, O:null, M:null, sorties:[] });
eq("sans aucune donnée : feu vert… mais rien de vérifié", vide.feu, "vert");
t("sans aucune donnée : chaque manque est nommé", vide.regles.filter(x => x.manque).length === 6, JSON.stringify(vide.regles.map(x => x.manque)));
/* FC de repos : 7 jours à 56 contre 7 jours à 50 → +6 bpm ; ratio 1,9 → au-dessus de 1,8. */
const fcrL = d => ({ date:d, fc_repos:{ allMetrics:{ metricsMap:{ WELLNESS_RESTING_HEART_RATE:[{ value:d >= "2026-09-30" ? 56 : 50 }] } } }, statut:{ load_ratio:1.9 } });
const G14 = Array.from({ length:14 }, (_, i) => fcrL("2026-09-" + String(23 + i).padStart(2, "0"))).map(l => l.date > "2026-09-30" ? Object.assign(l, { date:"2026-10-0" + (+l.date.slice(8) - 30) }) : l);
const syn2 = A.synthese({ today:"2026-10-06", maintenant:new Date(2026, 9, 6, 20, 30), garmin:G14, T:null, plan:[], retours:[], meteo:null, O:null, M:null, sorties:[] });
t("FC de repos : tendance sur 7 jours contre 7", syn2.fc_repos_tendance && syn2.fc_repos_tendance.ecart_bpm === 6, JSON.stringify(syn2.fc_repos_tendance));
t("FC de repos +6 bpm : déclenchée", syn2.regles.find(x => x.id === "fc_repos_hausse").declenchee && /\+6 par rapport/.test(syn2.regles.find(x => x.id === "fc_repos_hausse").texte), syn2.regles.find(x => x.id === "fc_repos_hausse").texte);
t("ratio 1,9 : déclenchée, virgule française", syn2.regles.find(x => x.id === "ratio_haut").declenchee && /1,9 : au-dessus de 1,8/.test(syn2.regles.find(x => x.id === "ratio_haut").texte));
eq("deux signaux orange : feu orange", syn2.feu, "orange");

/* ---------- 11. la page reçoit le feu, le check-in et l'objectif vélo ---------- */
const planTxt = 'PLAN_JSON_START {"meta":{"caps":[{"d":"2026-09-01","l":"Compte rendu du échographie : vélo bloqué","attente":true}]},"entries":[' +
  '{"d":"2026-10-06","t":"Aérobie faible 40 min · 6,3 km","s":"FC 130–145","km":"6,3 km","type":"course"},{"d":"2026-10-07","t":"Gainage circuit · 3 tours","type":"renfo"}]} PLAN_JSON_END';
const RP = P.construire(new Date(2026, 9, 6, 6, 50), { athlete:ATHL, planTxt, garmin, retours:syn && [{ type:"checkin", d:"2026-10-06", forme:2, jambes:"fraîches", alerte:"rien" }], meteo });
const F = RP.D.feu;
t("feu de la page : couleur et raisons identifiées", F && F.couleur === "orange" && F.raisons.every(r => r.id && r.niveau && r.texte), JSON.stringify(F));
t("feu de la page : le check-in est marqué comme tel (la page le recalcule)", F.raisons.some(r => r.id === "checkin" && /Forme 2\/5/.test(r.texte)));
t("feu de la page : ce qui manque est dit", Array.isArray(F.manque) && F.manque.indexOf("la nuit dernière") >= 0, JSON.stringify(F.manque));
t("la page reçoit les zones du check-in, chiffrées avec le reste", RP.D.checkin && RP.D.checkin.zones.length === 3);
t("objectif vélo : ce qui bloque, depuis quand", RP.D.objectifs.velo.attente === "Compte rendu du échographie : vélo bloqué" && RP.D.objectifs.velo.depuis === "2026-09-01", JSON.stringify(RP.D.objectifs.velo));
t("la raison complète du gainage voyage dans les données", /protège ton dos/.test(RP.D.plan.find(s => s.fam === "renfo").pourquoi));
t("synthèse pour le coach rendue", RP.synthese && RP.synthese.feu === "orange" && RP.synthese.checkin.forme === 2);

/* ---------- 11 bis. coucher et lever (lot 2) ---------- */
const HO = A.horaires([{ cou:597, lev:1120 }, { cou:660, lev:1140 }, { cou:780, lev:1180 }, { cou:null, lev:null }]);
eq("coucher moyen (21h57, 23h00, 1h00) → 23h19", HO.coucher_moyen, "23h19");
eq("nuits couchées avant 23 h (23 h pile compte)", HO.nuits_couche_avant_23h, 2);
eq("nuits mesurées seulement", HO.nuits_mesurees, 3);
eq("écart moyen au coucher moyen, en minutes", HO.ecart_coucher_min, Math.round((82 + 19 + 101) / 3));
eq("aucune nuit mesurée : rien d'inventé", A.horaires([{ cou:null }]).coucher_moyen, null);

/* ---------- 12. rien de sa santé dans le code publié en clair ---------- */
const ici = __dirname;
const code = (fs.readFileSync(path.join(ici, "core.js"), "utf8") + fs.readFileSync(path.join(ici, "app.js"), "utf8") + fs.readFileSync(path.join(ici, "head.html"), "utf8"))
  .replace(/\/\*[\s\S]*?\*\//g, "");
for (const mot of ["Genou", "échographie", "fracture", "fracture", "kiné", "protège ton dos", "entorse", "vapote"])
  t("code publié sans « " + mot + " »", code.toLowerCase().indexOf(mot.toLowerCase()) < 0, (code.match(new RegExp(".{40}" + mot + ".{20}", "i")) || [""])[0]);

console.log("\n  " + ok + " réussis, " + ko + " échoués");
if (ko) { for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("  Analyses validées.");
