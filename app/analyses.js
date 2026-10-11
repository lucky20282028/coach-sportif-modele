/* Analyses calculées par le code, jamais par le coach (7 octobre 2026).
   Un chiffre calculé ici est juste à chaque fois ; un chiffre recalculé de tête
   par une tâche, non. Le coach lit le résultat (donnees/synthese.json) et
   s'en sert pour écrire, il ne refait pas les calculs.

     - sorties : km par km, plafond tenu, allure à FC fixe, dérive cardiaque
     - moteur  : l'allure à 140 et à 150 bpm, sortie après sortie, sur 12 mois
     - objectifs : semaines à 2 courses + 1 gainage, tour de taille
     - synthèse du matin et feu du jour (règles d'allègement du coach) */
const C = require("./core.js");

const G_TYPE = {
  running:"course", trail_running:"course", treadmill_running:"course", track_running:"course", street_running:"course",
  virtual_run:"course", indoor_running:"course",
  strength_training:"renfo", hiit:"renfo", fitness_equipment:"renfo", indoor_cardio:"renfo", pilates:"renfo", yoga:"renfo",
  soccer:"foot", football:"foot",
  cycling:"velo", road_biking:"velo", mountain_biking:"velo", indoor_cycling:"velo", virtual_ride:"velo", gravel_cycling:"velo",
  lap_swimming:"nage", open_water_swimming:"nage", swimming:"nage",
  walking:"marche", hiking:"marche"
};
/* Famille d'un titre de séance → type de sport (pour compter ce qui est déclaré sans montre). */
const TYPE_FAM = { facile:"course", endur:"course", recup:"course", tempo:"course", vma:"course", cotes:"course",
                   renfo:"renfo", foot:"foot", velo:"velo", nage:"nage", marche:"marche" };
const typeDe = t => TYPE_FAM[C.famFromTitle(t || "")] || null;

/* Le check-in du matin : la question et les zones surveillées. Elles décrivent sa
   santé : elles vivent dans ses réglages (reglages/athlete.json), côté serveur, et
   n'arrivent sur la page que chiffrées (D.checkin). Le code publié n'en contient aucun mot. */
const ATH = require("../commun/athlete.cjs");
const checkinDe = a => ({ question:a.checkin.question, zones:a.checkin.zones });
const CHECKIN = checkinDe(ATH.DEFAUT);
/* « 2 courses + 1 gainage », d'après les cibles de la semaine. */
const texteCible = c => [c.course ? c.course + " course" + (c.course > 1 ? "s" : "") : null, c.renfo ? c.renfo + " gainage" + (c.renfo > 1 ? "s" : "") : null].filter(Boolean).join(" + ") || "aucune cible";
const semainePleine = (w, c) => w.course >= c.course && w.renfo >= c.renfo;
const decale = (k, n) => { const d = C.parse(k); d.setDate(d.getDate() + n); return C.iso(d); };
const median = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const moy = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
const hm = m => m == null ? "—" : Math.floor(m / 60) + "h" + String(Math.round(m % 60)).padStart(2, "0");
const allure = s => s == null ? null : Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");

/* ---------- 1. une sortie ---------- */
const ECHAUF_S = 600;   /* les 10 premières minutes : le cœur n'a pas encore rattrapé l'effort */
const FEN = 8;          /* fenêtres de 2 min (8 points de 15 s) */
const TOL = 4;          /* « à 150 » = entre 146 et 154 */
const MIN_FEN = 4;      /* au moins 4 fenêtres, soit 8 min autour de la valeur */

function fenetres(serie) {
  const out = [];
  for (let i = 0; i + FEN < serie.length; i += FEN / 2) {
    const [t0, d0] = serie[i], [t1, d1] = serie[i + FEN];
    if (t0 < ECHAUF_S || t1 <= t0) continue;
    const hs = serie.slice(i, i + FEN + 1).map(p => p[2]).filter(Boolean);
    if (hs.length < FEN / 2) continue;
    const v = (d1 - d0) / (t1 - t0);
    if (v < 1.6) continue;                  /* marche ou arrêt */
    out.push({ fc:hs.reduce((a, b) => a + b, 0) / hs.length, p:1000 / v });
  }
  return out;
}
/* Allure (s/km) quand le cœur est à `ref` : médiane des fenêtres de 2 min passées à ref ± 4. */
function allureA(serie, ref) {
  const w = fenetres(serie || []).filter(x => Math.abs(x.fc - ref) <= TOL).map(x => x.p);
  return w.length >= MIN_FEN ? Math.round(median(w)) : null;
}
/* Dérive cardiaque : de combien le rapport vitesse/FC baisse entre la 1re et la 2de moitié
   (après l'échauffement). Sous 5 % : l'endurance tient ; au-delà, le cœur s'emballe. */
function derive(serie) {
  const s = (serie || []).filter(p => p[0] >= ECHAUF_S && p[2]);
  if (s.length < 2 || s[s.length - 1][0] - s[0][0] < 1200) return null;
  const mil = (s[0][0] + s[s.length - 1][0]) / 2;
  const r = x => {
    if (x.length < 2) return null;
    const dt = x[x.length - 1][0] - x[0][0], dd = x[x.length - 1][1] - x[0][1], fc = moy(x.map(p => p[2]));
    return dt > 0 && fc ? dd / dt / fc : null;
  };
  const r1 = r(s.filter(p => p[0] <= mil)), r2 = r(s.filter(p => p[0] >= mil));
  return r1 && r2 ? Math.round((r1 - r2) / r1 * 1000) / 10 : null;
}
/* Plafond de FC d'une séance du plan : la borne haute de son corps de séance. */
function plafondDe(s) {
  let hi = null;
  const voir = p => { if (p && p.cible && p.cible.type === "fc" && p.k !== "warmup" && p.k !== "cooldown") hi = Math.max(hi || 0, p.cible.hi); };
  for (const b of (s && s.etapes) || []) { if (b.pas) b.pas.forEach(voir); else voir(b); }
  return hi;
}
/* a150 et a140 : allures aux deux fréquences de référence de l'athlète (fc_moteur, 150 et
   140 par défaut). Les noms des champs restent ceux d'origine. */
function resumeSortie(f, plafond, fc) {
  fc = fc || ATH.DEFAUT.fc_moteur;
  if (!f || f.erreur || !Array.isArray(f.km)) return null;
  const km = f.km.map(k => ({ n:k.n, m:k.m, p:k.m ? Math.round(k.s / (k.m / 1000)) : null, fc:k.fc, dp:k.dp || 0, partiel:!!k.partiel }));
  const pts = (f.serie || []).filter(p => p[2]);
  return {
    id:f.id, date:f.date, debut:f.debut, dist:f.distance_m, duree:f.duree_s, fc:f.fc_moy, fcmax:f.fc_max, dp:f.deniv_pos,
    plafond:plafond || null,
    pctSous:plafond && pts.length ? Math.round(pts.filter(p => p[2] <= plafond).length / pts.length * 100) : null,
    kmSous:plafond ? km.filter(k => k.fc != null && k.fc <= plafond).length : null,
    km, a140:allureA(f.serie, fc[1]), a150:allureA(f.serie, fc[0]), derive:derive(f.serie),
    /* la courbe de la page : un point toutes les 30 s, [minutes, FC] */
    serie:(f.serie || []).filter((p, i) => i % 2 === 0 && p[2]).map(p => [Math.round(p[0] / 6) / 10, p[2]])
  };
}

/* ---------- 2. le moteur sur 12 mois ---------- */
function moteur(fiches, fc) {
  fc = fc || ATH.DEFAUT.fc_moteur;
  const out = { a140:[], a150:[] };
  const tri = (fiches || []).filter(f => f && !f.erreur && f.serie).sort((a, b) => String(a.debut) < String(b.debut) ? -1 : 1);
  for (const f of tri) {
    const a1 = allureA(f.serie, fc[1]), a2 = allureA(f.serie, fc[0]);
    if (a1) out.a140.push([f.date, a1]);
    if (a2) out.a150.push([f.date, a2]);
  }
  return out;
}

/* ---------- 3. objectifs ---------- */
function objectifs(today, acts, retours, faits, nb, cible) {
  nb = nb || 12;
  cible = cible || ATH.DEFAUT.cible;
  const montre = {}, decl = {};
  let premier = null;
  for (const a of acts || []) {
    const type = G_TYPE[a.type], sec = a.duration_seconds || 0, d = String(a.start_time || "").slice(0, 10);
    if (!d) continue;
    if (!premier || d < premier) premier = d;
    if (!type || (type === "course" && sec < 600) || (type === "renfo" && sec < 300) || (type === "foot" && sec < 1200)) continue;
    const j = montre[d] = montre[d] || {};
    j[type] = (j[type] || 0) + 1;
  }
  const declarer = (d, type) => { if (!d || !type) return; const j = decl[d] = decl[d] || {}; j[type] = (j[type] || 0) + 1; };
  for (const r of retours || []) if (r && r.type === "seance" && (r.fait === "fait" || r.fait === "en partie")) declarer(r.d, typeDe(r.t));
  for (const f of faits || []) if (f && !f.auto) declarer(f.d, f.type && f.type !== "autre" ? f.type : typeDe(f.t));
  const semaines = [];
  for (let w = -(nb - 1); w <= 0; w++) {
    const js = C.weekDays(today, w);
    if (premier && js[6] < premier) continue;
    const n = { course:0, renfo:0, foot:0 };
    for (const d of js) for (const t of Object.keys(n))
      n[t] += Math.max((montre[d] || {})[t] || 0, (decl[d] || {})[t] || 0);   /* la même séance vue deux fois ne compte qu'une fois */
    semaines.push(Object.assign({ l:js[0] }, n));
  }
  /* Dernière séance de chaque objectif, toutes sources confondues. */
  const dernier = {};
  for (const src of [montre, decl]) for (const d of Object.keys(src)) for (const t of Object.keys(src[d]))
    if (d <= today && (!dernier[t] || d > dernier[t])) dernier[t] = d;
  return { semaines, cible:{ course:cible.course, renfo:cible.renfo }, dernier };
}
function mesures(retours) {
  return (retours || []).filter(r => r && r.type === "mesure" && r.tour_taille)
    .map(r => ({ d:r.d, cm:r.tour_taille })).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
}

/* ---------- 4. synthèse du matin et feu du jour ----------
   Les règles d'allègement du coach (taches/point-du-matin.md), appliquées par le code.
   Le coach garde la décision : il lit ces règles déjà évaluées au lieu de les recalculer. */
function derniereLigne(garmin, jour) {
  let l = null;
  for (const x of garmin || []) if (x && x.date === jour) l = x;
  return l;
}
function meteoA(meteo, jour, h) {
  const v = meteo && meteo.heures && meteo.heures[jour + "T" + String(h).padStart(2, "0") + ":00"];
  return v ? { t:Math.round(v[0]), ressenti:Math.round(v[1]), pluie:v[2], vent:Math.round(v[3]) } : null;
}
/* Coucher et lever sur des nuits (minutes depuis midi la veille, voir depuis-plan.js) :
   moyennes, nuits couchées avant 23 h, et régularité (écart moyen à la moyenne). */
const OBJECTIF_COUCHER = 660;                         /* 23 h */
const horloge = m => { if (m == null) return null; const t = Math.round(m + 720) % 1440; return Math.floor(t / 60) + "h" + String(t % 60).padStart(2, "0"); };
function horaires(nuits) {
  const c = (nuits || []).map(j => j && j.cou).filter(v => v != null), l = (nuits || []).map(j => j && j.lev).filter(v => v != null);
  if (!c.length) return { coucher_moyen:null, nuits_mesurees:0 };
  const mc = moy(c);
  return { coucher_moyen:horloge(mc), lever_moyen:horloge(moy(l)), nuits_mesurees:c.length,
           nuits_couche_avant_23h:c.filter(v => v <= OBJECTIF_COUCHER).length,
           ecart_coucher_min:Math.round(moy(c.map(v => Math.abs(v - mc)))) };
}
function synthese(x) {
  const { today, maintenant, garmin, sante, T, plan, retours, meteo, O, M, sorties } = x;
  const ath = x.athlete || ATH.DEFAUT, cible = (O && O.cible) || ath.cible;
  const g = derniereLigne(garmin, today) || {};
  const J = (T && T.jours) || [];
  const nuitDe = j => j ? (j.sg != null ? j.sg : j.sw) : null;
  const auj = J.find(j => j.d === today);
  const n7 = J.slice(-7).map(nuitDe), n7a = J.slice(-14, -7).map(nuitDe), n5 = J.slice(-5).map(nuitDe).filter(v => v != null);
  const v3 = moy(J.slice(-3).map(j => j.vfc)), v3a = moy(J.slice(-6, -3).map(j => j.vfc));
  const dispo = Array.isArray(g.disponibilite) ? g.disponibilite[0] : g.disponibilite && g.disponibilite.score != null ? g.disponibilite : null;
  const st = g.statut || {};
  const tot = (st.monthly_load_aerobic_low || 0) + (st.monthly_load_aerobic_high || 0) + (st.monthly_load_anaerobic || 0);
  let fcr = null;
  try { fcr = g.fc_repos.allMetrics.metricsMap.WELLNESS_RESTING_HEART_RATE[0].value; } catch (e) {}
  /* FC de repos : une valeur par jour (la dernière collecte du jour), 7 jours contre les 7 d'avant. */
  const fcrJour = {};
  for (const l of garmin || []) { try { const v = l.fc_repos.allMetrics.metricsMap.WELLNESS_RESTING_HEART_RATE[0].value; if (v && l.date) fcrJour[l.date] = v; } catch (e) {} }
  /* Apple Santé : FC de repos des jours que Garmin n'a pas mesurés. */
  for (const l of sante || []) if (l && l.date && l.fc_repos && fcrJour[l.date] == null) fcrJour[l.date] = l.fc_repos;
  if (fcr == null && fcrJour[today] != null) fcr = fcrJour[today];
  const fen = deb => [0, 1, 2, 3, 4, 5, 6].map(i => fcrJour[decale(today, -deb - i)]).filter(v => v != null);
  const f7 = fen(0), f7a = fen(7);
  const fcrTendance = f7.length >= 3 && f7a.length >= 3 ? { moyenne_7j:Math.round(moy(f7) * 10) / 10, moyenne_7j_avant:Math.round(moy(f7a) * 10) / 10,
    ecart_bpm:Math.round((moy(f7) - moy(f7a)) * 10) / 10, jours:f7.length + "+" + f7a.length } : null;
  const ck = (retours || []).filter(r => r && r.type === "checkin" && r.d === today).pop() || null;
  /* Retours des séances d'hier et d'aujourd'hui (même fenêtre que la règle de la page). */
  const recents = (retours || []).filter(r => r && r.type === "seance" && r.d >= decale(today, -1) && r.d <= today);
  const seances = (plan || []).filter(s => s.d === today && C.famOf(s) !== "repos");
  const derniere = (sorties || []).slice().sort((a, b) => String(a.debut) < String(b.debut) ? -1 : 1).pop() || null;
  const sem = O && O.semaines && O.semaines.length ? O.semaines[O.semaines.length - 1] : null;
  const il90 = decale(today, -90);
  const vieux = l => { const a = (l || []).filter(p => p[0] <= decale(il90, 30) && p[0] >= decale(il90, -30)).map(p => p[1]); return a.length ? Math.round(median(a)) : null; };

  const syn = {
    genere:maintenant.toISOString(), date:today,
    nuit:auj ? { garmin:hm(auj.sg), withings:auj.sw != null ? hm(auj.sw) : null, minutes:nuitDe(auj) } : null,
    sommeil:Object.assign({ moyenne_7_nuits:hm(moy(n7)), moyenne_7_nuits_avant:hm(moy(n7a)), nuits_sous_6h_sur_les_5_dernieres:n5.filter(v => v < 360).length }, horaires(J.slice(-7))),
    vfc:{ derniere:auj ? auj.vfc : null, zone_habituelle:T ? T.vfc : null, moyenne_3_nuits:v3 && Math.round(v3), moyenne_3_nuits_avant:v3a && Math.round(v3a),
          variation_pct:v3 && v3a ? Math.round((v3 - v3a) / v3a * 100) : null },
    disponibilite:dispo ? { score:dispo.score, niveau:dispo.level, recuperation_h:dispo.recovery_time_hours } : null,
    charge:{ ratio:st.load_ratio ?? null, aigue:st.acute_load ?? null, chronique:st.chronic_load ?? null, statut:st.acwr_status || null,
             part_aerobie_faible_pct:tot ? (x => x < 10 ? Math.round(x * 10) / 10 : Math.round(x))((st.monthly_load_aerobic_low || 0) / tot * 100) : null },
    fc_repos:fcr, fc_repos_tendance:fcrTendance,
    checkin:ck ? { forme:ck.forme, jambes:ck.jambes, alerte:ck.alerte, zone:ck.zone, ecrit:ck.ecrit } : null,
    retours_hier_et_aujourdhui:recents.map(r => ({ d:r.d, t:r.t, fait:r.fait, raison:r.raison, sensation:r.sensation, douleur:r.douleur, note:r.note })),
    seances_du_jour:seances.map(s => ({ t:s.t, famille:C.FA(C.famOf(s)).l, plafond:plafondDe(s), faite:!!s.fait })),
    derniere_sortie:derniere ? { date:derniere.date, km:Math.round(derniere.dist / 100) / 10, duree_min:Math.round(derniere.duree / 60), fc_moy:derniere.fc,
      plafond:derniere.plafond, pct_temps_sous_plafond:derniere.pctSous, km_sous_plafond:derniere.kmSous, km_total:derniere.km.length,
      allure_a_140:allure(derniere.a140), allure_a_150:allure(derniere.a150), derive_pct:derniere.derive } : null,
    moteur:M ? { allure_a_150_derniere:allure(M.a150.length ? M.a150[M.a150.length - 1][1] : null), allure_a_150_il_y_a_3_mois:allure(vieux(M.a150)),
                 allure_a_140_derniere:allure(M.a140.length ? M.a140[M.a140.length - 1][1] : null), sorties_mesurees_a_150:M.a150.length } : null,
    semaine:sem ? { courses:sem.course, gainages:sem.renfo, football:sem.foot, cible:texteCible(cible) } : null,
    semaines_completes_sur_12:O ? O.semaines.filter(w => semainePleine(w, cible)).length : null,
    meteo:{ matin_7h:meteoA(meteo, today, 7), soir_19h:meteoA(meteo, today, 19) }
  };

  /* Les règles, une par une, avec leur verdict. « manque » : la donnée n'existe pas,
     la règle n'a donc rien vérifié — ce n'est PAS un feu vert pour elle. */
  const regles = [];
  const r = (id, niveau, ok, texte, manque) => regles.push({ id, niveau, declenchee:!!ok, texte, manque:manque || null });
  const nuit = nuitDe(auj), sous6 = n5.filter(v => v < 360).length, vp = syn.vfc.variation_pct;
  r("nuit_courte", "orange", nuit != null && nuit < 330, nuit != null ? "Nuit de " + hm(nuit) + (nuit < 330 ? " : sous 5h30." : ".") : "Nuit non mesurée.",
    nuit == null ? "la nuit dernière" : null);
  r("nuits_courtes", "orange", sous6 >= 3, n5.length ? sous6 + " nuit" + (sous6 > 1 ? "s" : "") + " sous 6 h sur les " + n5.length + " dernières." : "Aucune nuit mesurée sur 5.",
    n5.length < 3 ? "les nuits des derniers jours" : null);
  r("vfc_baisse", "orange", vp != null && vp <= -10, vp != null ? "VFC sur 3 nuits : " + (vp > 0 ? "+" : vp < 0 ? "−" : "") + Math.abs(vp) + " %." : "VFC : pas assez de nuits mesurées.",
    vp == null ? "la VFC" : null);
  r("disponibilite", "orange", dispo && dispo.score != null && dispo.score < 25, dispo && dispo.score != null ? "Disponibilité Garmin : " + dispo.score + "/100." : "Disponibilité non mesurée.",
    !(dispo && dispo.score != null) ? "la disponibilité Garmin" : null);
  const ft = fcrTendance, virg = x => String(x).replace(".", ",");
  r("fc_repos_hausse", "orange", ft && ft.ecart_bpm >= 5, ft ? "FC de repos sur 7 jours : " + virg(ft.moyenne_7j) + " bpm, " + (ft.ecart_bpm > 0 ? "+" : ft.ecart_bpm < 0 ? "−" : "") +
    virg(Math.abs(ft.ecart_bpm)) + " par rapport à la semaine d'avant." : "FC de repos : pas assez de jours mesurés.", ft ? null : "la FC de repos sur deux semaines");
  const ratio = st.load_ratio;
  r("ratio_haut", "orange", ratio != null && ratio > 1.8, ratio != null ? "Ratio de charge : " + virg(ratio) + (ratio > 1.8 ? " : au-dessus de 1,8." : ".") : "Ratio de charge non mesuré.",
    ratio == null ? "le ratio de charge" : null);
  for (const x of C.reglesCheckin(ck, ath.checkin.zones)) regles.push({ id:"checkin", niveau:x.niveau, declenchee:true, texte:x.texte, manque:null });
  for (const x of C.reglesRetours(retours, today)) regles.push({ id:x.id, niveau:x.niveau, declenchee:true, texte:x.texte, manque:null });
  const soir = syn.meteo.soir_19h;
  if (soir && soir.ressenti >= 25 && seances.some(s => C.FA(C.famOf(s)).sp === "course"))
    r("chaleur", "info", true, "Il fera " + soir.ressenti + "° ressentis à 19 h : si tu cours le soir, plafond " + ath.plafond_chaleur + ".");
  const actives = regles.filter(x => x.declenchee && x.niveau !== "info");
  syn.regles = regles;
  syn.feu = actives.some(x => x.niveau === "rouge") ? "rouge" : actives.some(x => x.niveau === "orange") ? "orange" : "vert";
  return syn;
}

module.exports = { G_TYPE, TYPE_FAM, CHECKIN, checkinDe, texteCible, semainePleine, horaires, horloge, OBJECTIF_COUCHER, typeDe, allureA, derive, plafondDe, resumeSortie, moteur, objectifs, mesures, synthese, meteoA };
