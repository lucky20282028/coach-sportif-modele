/* ==========================================================================
   BANC D'ESSAI — formules de séance (v12)
   Node pur, aucune dépendance. node bench-formules.js
   ========================================================================== */
const C = require("./core.js");

let ok = 0, ko = 0; const echecs = [];
function t(nom, cond, detail) {
  if (cond) { ok++; return; }
  ko++; echecs.push(nom + (detail ? "  → " + detail : ""));
}
function eq(nom, a, b) { t(nom, a === b, "attendu " + JSON.stringify(b) + ", obtenu " + JSON.stringify(a)); }

/* ---------- 1. Le système de couleurs ---------- */

const fams = Object.keys(C.FAM);
{
  const n = C.nomSeance;
  t("noms clairs : aérobie faible → endurance fondamentale", n("Aérobie faible 30 min · 4,2 km") === "Endurance fondamentale 30 min · 4,2 km", n("Aérobie faible 30 min · 4,2 km"));
  t("lignes droites en toutes lettres", n("Aérobie faible + 4 LD 40 min") === "Endurance fondamentale + 4 lignes droites 40 min", n("Aérobie faible + 4 LD 40 min"));
  t("tempo → seuil, ancienne « Endurance » → sortie longue", n("Tempo 3×8 min") === "Seuil 3×8 min" && n("Endurance 1h15 · 13,4 km") === "Sortie longue 1h15 · 13,4 km");
  t("la course à dossard → compétition", n("Course · 15 km de Rouen") === "Compétition · 15 km de Rouen" && C.famFromTitle("Course · 15 km de Rouen", "course") === "compet");
  t("« Endurance fondamentale » reste une sortie facile", C.famFromTitle("Endurance fondamentale 30 min", "course") === "facile");
  t("le vélo n'est pas touché", n("Endurance vélo 1h30 · 35 km") === "Endurance vélo 1h30 · 35 km");
  t("sport et icône", C.nomSport("tempo") === "Course à pied" && C.nomSport("renfo") === "Renforcement" && /<svg/.test(C.icoSport("velo")));
}
t("13 familles définies (compétition comprise)", fams.length === 13, "il y en a " + fams.length);

for (const f of fams) {
  const F = C.FAM[f];
  t(f + " : a un libellé", !!F.l && F.l.length > 2);
  t(f + " : couleur a valide", /^#[0-9A-F]{6}$/i.test(F.a), F.a);
  t(f + " : couleur b valide", /^#[0-9A-F]{6}$/i.test(F.b), F.b);
  t(f + " : sport connu", !!C.TYPES[F.sp], F.sp);
}

/* Demande explicite de l'utilisateur le 22 août : pas de violet.
   On teste la teinte, pas le nom : un violet est un bleu-rouge dominant
   avec peu de vert. */
function hsl(hex) {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx-mn;
  let h = 0;
  if (d) { h = mx===r ? ((g-b)/d+6)%6 : mx===g ? (b-r)/d+2 : (r-g)/d+4; h *= 60; }
  return { h, s: mx ? d/mx : 0 };
}
for (const f of fams) {
  for (const k of ["a","b"]) {
    const c = hsl(C.FAM[f][k]);
    const violet = c.h >= 255 && c.h <= 320 && c.s > 0.25;
    t("pas de violet — " + f + "." + k, !violet, C.FAM[f][k] + " teinte " + Math.round(c.h));
  }
}

/* Deux familles ne doivent pas se confondre au premier regard. */
const vus = {};
for (const f of fams) {
  t("couleur unique — " + f, !vus[C.FAM[f].a], "déjà prise par " + vus[C.FAM[f].a]);
  vus[C.FAM[f].a] = f;
}

/* ---------- 2. Les allures de référence ---------- */

t("récup plus lente que facile", C.ALL.recup > C.ALL.facile);
t("facile plus lente qu'endurance", C.ALL.facile > C.ALL.endur);
t("endurance plus lente que tempo", C.ALL.endur > C.ALL.tempo);
t("tempo plus lent que VMA", C.ALL.tempo > C.ALL.vma);
t("VMA cohérente avec le profil (4:00–4:10)", C.ALL.vma >= 240 && C.ALL.vma <= 250, C.ALL.vma + " s");
t("seuil cohérent avec le profil (4:35–4:40)", C.ALL.tempo >= 275 && C.ALL.tempo <= 280, C.ALL.tempo + " s");
t("facile cohérente avec le réel du 21/08 (6:27)", C.ALL.facile >= 360 && C.ALL.facile <= 400, C.ALL.facile + " s");
t("endurance cohérente avec le réel du 22/08 (5:59)", C.ALL.endur >= 350 && C.ALL.endur <= 375, C.ALL.endur + " s");

/* ---------- 3. Chaque formule produit une séance valide ---------- */

const cas = [
  ["facile 35",     C.LIB.facile(35)],
  ["facile 50",     C.LIB.facile(50)],
  ["facileLD 45×5", C.LIB.facileLD(45, 5)],
  ["endurance 11",  C.LIB.endurance(11)],
  ["endurance 15",  C.LIB.endurance(15, 150)],
  ["recup 30",      C.LIB.recup(30)],
  ["tempo 3×8",     C.LIB.tempo(3, 8)],
  ["vma 8×400",     C.LIB.vma(8, 400)],
  ["gainage 3",     C.LIB.gainage(3)],
  ["foot",          C.LIB.foot()],
  ["repos",         C.LIB.repos()]
];

for (const [nom, s] of cas) {
  t(nom + " : famille connue", !!C.FAM[s.fam], s.fam);
  t(nom + " : titre non vide", !!s.t && s.t.length > 3, s.t);
  t(nom + " : titre sans double espace", !/\s\s/.test(s.t), s.t);
  t(nom + " : pourquoi présent", !!s.pourquoi && s.pourquoi.length > 30);
  t(nom + " : pourquoi finit par un point", /[.!?]$/.test(s.pourquoi), s.pourquoi.slice(-30));
  t(nom + " : étapes en tableau", Array.isArray(s.etapes));
  t(nom + " : famOf retrouve la famille", C.famOf(s) === s.fam, C.famOf(s));

  /* Aucun texte mojibaké ne doit sortir de la librairie. */
  const tout = JSON.stringify(s);
  t(nom + " : pas de mojibake", !/Ã|â€|Â/.test(tout));

  for (const b of s.etapes) {
    if (b.rep) {
      t(nom + " : bloc répété a des pas", Array.isArray(b.pas) && b.pas.length > 0);
      t(nom + " : répétitions plausibles", b.rep >= 2 && b.rep <= 20, "rep=" + b.rep);
      for (const p of b.pas) t(nom + " : pas titré", !!p.t && p.t.length > 2, JSON.stringify(p));
    } else {
      t(nom + " : étape titrée", !!b.t && b.t.length > 2, JSON.stringify(b));
      t(nom + " : rôle connu", ["echauf","corps","calme"].indexOf(b.r) >= 0, b.r);
    }
  }
}

/* ---------- 4. Règles de la charte ---------- */

/* Règle 2 : repos veut dire ne rien faire. */
const rep = C.LIB.repos();
eq("repos : aucune étape", rep.etapes.length, 0);
eq("repos : pas de distance", rep.km, "");
t("repos : aFormule est faux", C.aFormule(rep) === false);
t("repos : le mot dit bien de ne rien faire", /ne rien faire/i.test(rep.pourquoi));
/* Le test précédent interdisait le mot « gainage » dans toute la séance de repos.
   Il a viré rouge sur ma propre phrase « Pas de gainage, pas de petite sortie »,
   qui applique pourtant la règle au lieu de l'enfreindre. Ce n'était pas le texte
   qui avait tort, c'était le test. Ce qu'il faut interdire, c'est de PRESCRIRE du
   renforcement un jour de repos — pas d'en parler pour l'exclure. */
t("repos ne prescrit jamais de renforcement", !/gainage|renfor/i.test(JSON.stringify(rep.etapes)));
t("repos exclut explicitement le gainage", /pas de gainage/i.test(rep.pourquoi), rep.pourquoi);

/* Règle 7 : toujours la distance en face d'une durée, pour la course. */
for (const [nom, s] of cas) {
  const court = C.FAM[s.fam].sp === "course" && s.fam !== "repos";
  if (court) t(nom + " : distance affichée (règle 7)", !!s.km, "km vide");
  else t(nom + " : pas de distance parasite", s.km === "", s.km);
}

/* Règle 6 : les séances faciles se pilotent en FC, jamais en allure. */
for (const nom of ["facile 35", "facile 50", "facileLD 45×5", "endurance 11", "endurance 15", "recup 30"]) {
  const s = cas.find(c => c[0] === nom)[1];
  const corps = JSON.stringify(s.etapes.filter(e => e.r === "corps"));
  t(nom + " : corps piloté en FC (règle 6)", /FC/.test(corps), corps.slice(0, 90));
  t(nom + " : aucune allure imposée au corps", !/\d:\d\d\s*\/km/.test(corps), corps.slice(0, 90));
}

/* À l'inverse, les séances de qualité DOIVENT donner une allure chiffrée. */
for (const nom of ["tempo 3×8", "vma 8×400"]) {
  const s = cas.find(c => c[0] === nom)[1];
  t(nom + " : allure chiffrée présente", /\d:\d\d\s*\/km/.test(JSON.stringify(s.etapes)));
  t(nom + " : fourchette donnée", /Fourchette/.test(JSON.stringify(s.etapes)));
}

/* Règle 8 : ne jamais fabriquer un chiffre. Les distances doivent découler
   des allures de référence, pas d'un arrondi commode. */
eq("facile 50 → 7,9 km", C.LIB.facile(50).km, "7,9");
eq("facile 35 → 5,5 km", C.LIB.facile(35).km, "5,5");
eq("recup 30 → 4,5 km", C.LIB.recup(30).km, "4,5");
const e15 = C.LIB.endurance(15);
eq("endurance 15 → 15 km", e15.km, "15");
t("endurance 15 → durée autour de 1h30", /85 – 95/.test(e15.duree), e15.duree);

/* Cohérence interne : la durée annoncée par les étapes doit correspondre
   à la durée de la séance. C'est le test qui attrape une formule bancale. */
function minutesDuCorps(s) {
  let m = 0;
  for (const b of s.etapes) {
    if (b.rep) continue;
    const mm = /(\d+)\s*min/.exec(b.t);
    if (mm) m += Number(mm[1]);
  }
  return m;
}
for (const min of [30, 35, 45, 50, 60]) {
  eq("facile " + min + " : les étapes totalisent " + min + " min", minutesDuCorps(C.LIB.facile(min)), min);
}

/* ---------- 5. Reconnaissance des anciens titres ---------- */

const titres = [
  ["Aérobie faible 50 min · 9,1 km", "facile"],
  ["Aérobie faible + 5 LD 45 min", "facile"],
  ["Endurance 1h15 · 13,4 km", "endur"],
  ["Endurance 15 km · plafond 150", "endur"],
  ["Récupération 30 min · 5,5 km", "recup"],
  ["Tempo 3×8 min @ 4:35 · 10 km", "tempo"],
  ["Fractionné 8×400 @ 4:00 · 8 km", "vma"],
  ["Test contrôle 40 min FC 150", "facile"],
  ["Football · 1 h", "foot"],
  ["Gainage circuit · 3 tours", "renfo"],
  ["Endurance vélo 1h30 · 35 km", "velo"],
  ["Repos", "repos"],
  ["Footing 55 min", "facile"],
  ["Natation 800 m", "nage"],
  ["Marche 40 min", "marche"],
  ["Côtes 8×30 s", "cotes"]
];
for (const [titre, attendu] of titres) eq("famille de « " + titre + " »", C.famFromTitle(titre), attendu);

/* Le piège historique : « Footing » contient « foot ». */
t("Footing n'est PAS du football", C.famFromTitle("Footing 55 min") !== "foot");
t("Football est bien du football", C.famFromTitle("Football · 1 h") === "foot");

/* Une séance sans champ fam retombe sur le titre, jamais sur une valeur par défaut muette. */
eq("séance héritée sans fam", C.famOf({ t:"Endurance 1h15", type:"course" }), "endur");
eq("séance vide ne plante pas", C.famOf(null), "facile");

/* ---------- 6. Aplatissement pour l'affichage ---------- */

const v = C.etapesVue(C.LIB.vma(8, 400));
t("vma : 4 sections à l'écran", v.length === 4, "il y en a " + v.length);
t("vma : la 3e est un bloc répété", v[2].bloc === true);
eq("vma : le bloc annonce ×8", v[2].rep, 8);
eq("vma : le bloc a 2 pas", v[2].pas.length, 2);
/* 1 échauffement + 4×2 lignes droites + 8×2 répétitions + 1 retour au calme.
   Le retour au calme porte donc le n° 6 : la numérotation compte les blocs,
   pas leurs itérations. */
eq("vma : numérotation continue", v[3].n, 6);
eq("vma : nbPas compte les répétitions", C.nbPas(C.LIB.vma(8, 400)), 26);
/* 6 pas par tour : le circuit du plan (planche, latérale × 2, pont fessier,
   mountain climber, récupération), le même que la séance guidée sur la montre.
   Avant le 5 octobre la page affichait encore un « superman » sorti de nulle part. */
eq("gainage 3 tours : 18 pas", C.nbPas(C.LIB.gainage(3)), 18);
t("etapesVue tolère une séance vide", C.etapesVue(null).length === 0);
t("etapesVue tolère une séance sans étapes", C.etapesVue({ t:"x" }).length === 0);

/* ---------- 7. Titre complet, tel qu'il part sur la montre ---------- */

eq("titre complet course", C.titreComplet(C.LIB.facile(50)), "Aérobie faible 50 min · 7,9 km");
eq("titre complet renfo", C.titreComplet(C.LIB.gainage(3)), "Gainage circuit · 3 tours");
eq("titre complet foot", C.titreComplet(C.LIB.foot()), "Football · 1 h");
eq("titre vide si séance vide", C.titreComplet(null), "");
for (const [nom, s] of cas) {
  const tc = C.titreComplet(s);
  if (s.km) t(nom + " : séparateur « · » présent", tc.indexOf(" · ") > 0, tc);
  t(nom + " : titre sans tiret séparateur", !/ - /.test(tc), tc);
  t(nom + " : virgule française dans la distance", !/\d\.\d/.test(tc), tc);
}

/* ---------- 8. Robustesse ---------- */

t("facile(0) ne plante pas", (() => { try { C.LIB.facile(0); return true; } catch (e) { return false; } })());
t("vma(1,200) ne plante pas", (() => { try { C.LIB.vma(1, 200); return true; } catch (e) { return false; } })());
t("endurance(0) ne plante pas", (() => { try { C.LIB.endurance(0); return true; } catch (e) { return false; } })());
t("aFormule(undefined) = false", C.aFormule(undefined) === false);
t("nbPas(null) = 0", C.nbPas(null) === 0);
t("kmPour arrondit au dixième", C.kmPour(50, 380) === 7.9, String(C.kmPour(50, 380)));
eq("kmTxt formate en français", C.kmTxt(7.85), "7,9 km");

/* ---------- 9. Export Garmin ---------- */
/* Le DTO ci-dessous a été envoyé pour de vrai sur un compte Garmin le
   22 août, relu, comparé, puis supprimé. Les valeurs attendues ne sont pas des
   suppositions : c'est ce que Garmin a répondu. */

const dtoV = C.garminDTO(C.LIB.vma(8, 400));
const dtoE = C.garminDTO(C.LIB.endurance(11));
const dtoG = C.garminDTO(C.LIB.gainage(3));

t("repos ne part jamais sur la montre", C.garminDTO(C.LIB.repos()) === null);
t("football ne part jamais sur la montre", C.garminDTO(C.LIB.foot()) === null);
t("séance nulle ne part pas", C.garminDTO(null) === null);
t("séance sans étapes ne part pas", C.garminDTO({ t:"x", fam:"facile" }) === null);

eq("course → sportTypeId 1", dtoV.sportType.sportTypeId, 1);
eq("renfo → sportTypeId 5", dtoG.sportType.sportTypeId, 5);
eq("un seul segment", dtoV.workoutSegments.length, 1);

const pasV = dtoV.workoutSegments[0].workoutSteps;
eq("fractionné : 4 blocs de premier niveau", pasV.length, 4);
eq("échauffement en distance", pasV[0].endCondition.conditionTypeKey, "distance");
eq("échauffement 2000 m", pasV[0].endConditionValue, 2000);
eq("bloc LD répété 4 fois", pasV[1].numberOfIterations, 4);
eq("bloc principal répété 8 fois", pasV[2].numberOfIterations, 8);
eq("les 400 m sont en distance", pasV[2].workoutSteps[0].endConditionValue, 400);
eq("la récup est en temps", pasV[2].workoutSteps[1].endConditionValue, 60);
eq("la récup n'a pas de cible", pasV[2].workoutSteps[1].targetType.workoutTargetTypeKey, "no.target");

/* Le piège des vitesses : une allure RAPIDE donne une vitesse HAUTE.
   Garmin a renvoyé 4.0 – 4.166667 m/s pour 4:10 – 4:00 au kilomètre. */
const c400 = pasV[2].workoutSteps[0];
eq("cible allure = pace.zone", c400.targetType.workoutTargetTypeKey, "pace.zone");
eq("cible allure : id 6", c400.targetType.workoutTargetTypeId, 6);
eq("borne basse = 4:10/km en m/s", c400.targetValueOne, 4);
eq("borne haute = 4:00/km en m/s", c400.targetValueTwo, 4.166667);
t("targetValueOne est bien la vitesse la plus basse", c400.targetValueOne < c400.targetValueTwo);
eq("msDe(240) = 4:00/km", C.msDe(240), 4.166667);
eq("msDe(380) = 6:20/km", C.msDe(380), 2.631579);
t("plus l'allure est lente, plus la vitesse est basse", C.msDe(400) < C.msDe(240));

/* Fréquence cardiaque : plage réelle en battements, jamais un numéro de zone.
   Mettre 2 dans targetValueOne enverrait « zone 2 », qui plafonne à 140 chez lui
   et se trompe de séance — c'est précisément l'erreur documentée dans le profil. */
const corpsE = dtoE.workoutSegments[0].workoutSteps[1];
eq("cible FC = heart.rate.zone", corpsE.targetType.workoutTargetTypeKey, "heart.rate.zone");
eq("cible FC : id 4", corpsE.targetType.workoutTargetTypeId, 4);
eq("FC basse 135", corpsE.targetValueOne, 135);
eq("FC haute 150", corpsE.targetValueTwo, 150);
t("aucune cible FC ne ressemble à un numéro de zone", corpsE.targetValueOne > 90, String(corpsE.targetValueOne));

/* Toute cible FC de toute la librairie doit être en battements plausibles. */
function toutesCibles(dto) {
  const out = [];
  const marche = p => { if (p.workoutSteps) p.workoutSteps.forEach(marche); else out.push(p); };
  dto.workoutSegments[0].workoutSteps.forEach(marche);
  return out;
}
for (const [nom, s] of cas) {
  const d = C.garminDTO(s);
  if (!d) continue;
  for (const p of toutesCibles(d)) {
    if (p.targetType.workoutTargetTypeKey === "heart.rate.zone") {
      t(nom + " : FC basse plausible", p.targetValueOne >= 100 && p.targetValueOne <= 175, String(p.targetValueOne));
      t(nom + " : FC haute plausible", p.targetValueTwo >= 110 && p.targetValueTwo <= 185, String(p.targetValueTwo));
      t(nom + " : FC basse < FC haute", p.targetValueOne < p.targetValueTwo);
      t(nom + " : FC haute jamais au-dessus de 175", p.targetValueTwo <= 175, String(p.targetValueTwo));
    }
    if (p.targetType.workoutTargetTypeKey === "pace.zone") {
      t(nom + " : vitesse basse < haute", p.targetValueOne < p.targetValueTwo);
      t(nom + " : vitesse jamais absurde", p.targetValueTwo <= 5.5 && p.targetValueOne >= 2, JSON.stringify([p.targetValueOne, p.targetValueTwo]));
    }
    t(nom + " : chaque pas a une fin", !!p.endCondition && p.endConditionValue != null, JSON.stringify(p.endCondition));
  }
}

/* Les blocs répétés doivent porter conditionTypeId 7, sans quoi Garmin
   corrompt silencieusement le compteur de répétitions. */
for (const [nom, s] of cas) {
  const d = C.garminDTO(s);
  if (!d) continue;
  for (const p of d.workoutSegments[0].workoutSteps) {
    if (p.type === "RepeatGroupDTO") {
      eq(nom + " : bloc répété → conditionTypeId 7", p.endCondition.conditionTypeId, 7);
      eq(nom + " : bloc répété → clé iterations", p.endCondition.conditionTypeKey, "iterations");
      eq(nom + " : endConditionValue = nb de tours", p.endConditionValue, p.numberOfIterations);
      t(nom + " : bloc répété a des pas", p.workoutSteps.length > 0);
    }
  }
}

/* Numérotation : chaque stepOrder est unique. Un doublon fait sauter l'ordre
   des étapes sur la montre. */
for (const [nom, s] of cas) {
  const d = C.garminDTO(s);
  if (!d) continue;
  const vus = {}; let dbl = 0;
  const marche = p => { if (vus[p.stepOrder]) dbl++; vus[p.stepOrder] = 1; if (p.workoutSteps) p.workoutSteps.forEach(marche); };
  d.workoutSegments[0].workoutSteps.forEach(marche);
  eq(nom + " : aucun stepOrder en double", dbl, 0);
}

/* Le nom envoyé à Garmin est celui que l'athlète relit sur sa montre. */
for (const [nom, s] of cas) {
  const d = C.garminDTO(s);
  if (!d) continue;
  eq(nom + " : nom = titre complet", d.workoutName, C.titreComplet(s));
  t(nom + " : nom sous 80 caractères", d.workoutName.length <= 80, d.workoutName);
  t(nom + " : nom sans distance en double", (d.workoutName.match(/km/g) || []).length <= 1, d.workoutName);
}

/* ---------- 10. Durées lisibles ---------- */
eq("45 min", C.dureeTxt(45), "45 min");
eq("60 min → 1 h", C.dureeTxt(60), "1 h");
eq("66 min → 1h06", C.dureeTxt(66), "1h06");
eq("90 min → 1h30", C.dureeTxt(90), "1h30");
eq("127 min → 2h07", C.dureeTxt(127), "2h07");
t("jamais de durée en minutes au-delà d'une heure", !/^\d{2,} min/.test(C.dureeTxt(75)), C.dureeTxt(75));

/* Le bug du 22 août : « Endurance 11 km · 11 km ». */
eq("endurance 11 km", C.titreComplet(C.LIB.endurance(11)), "Endurance 1h06 · 11 km");
eq("distance jamais répétée", C.titreComplet({ t:"Endurance 15 km · plafond 150", km:"15" }), "Endurance 15 km · plafond 150");
eq("distance ajoutée si absente", C.titreComplet({ t:"Endurance 1h30", km:"15" }), "Endurance 1h30 · 15 km");

/* ---------- verdict ---------- */
console.log("\n  " + ok + " tests verts, " + ko + " rouges");
if (ko) { console.log("\n  ÉCHECS :"); echecs.forEach(e => console.log("  ✗ " + e)); process.exit(1); }
console.log("  Formules validées.\n");
