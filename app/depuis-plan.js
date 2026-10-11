/* Construit les données de la page à partir des sources BRUTES.
   Écrit le 30 septembre : jusque-là chaque tâche devait réécrire donnees.js
   à la main (200 lignes, formules comprises). C'était trop lourd, elles
   sautaient l'étape, et la page est restée figée du 21 au 30 septembre.

   Ce que la tâche fait maintenant, et rien d'autre :
     1. copier le fileContent du document Drive « Plan coach » le plus récent,
        TEL QUEL, dans entrees/plan.txt (antislashs de Google compris) ;
     2. écrire entrees/jour.json (le mot, les chiffres, les séances faites) ;
     3. lancer : node depuis-plan.js
   La date vient de l'horloge du Mac, jamais du modèle. */
const fs = require("fs");
const path = require("path");
const C = require("./core.js");
const A = require("./analyses.js");
const ATH = require("../commun/athlete.cjs");
/* Réglages de l'athlète en cours (construire() les pose ; par défaut, ceux d'une installation neuve). */
let ATHLETE = ATH.DEFAUT;

const ici = __dirname;
const E = p => path.join(ici, "entrees", p);
const lire = (p, def) => { try { return JSON.parse(fs.readFileSync(E(p), "utf8")); } catch (e) { return def; } };

/* ---------- 1. le plan ---------- */
function extrairePlan(brut) {
  const t = C.demojibake(String(brut));
  const a = t.indexOf("PLAN"), deb = t.search(/PLAN\\?_JSON\\?_START/), fin = t.search(/PLAN\\?_JSON\\?_END/);
  if (a < 0 || deb < 0 || fin < 0) throw new Error("marqueurs PLAN_JSON_START / PLAN_JSON_END introuvables");
  const corps = t.slice(t.indexOf("{", deb), fin);
  /* Google échappe []_*#… avec un antislash, mais un \" dans une chaîne JSON
     est un vrai échappement : on ne retire que les antislashs de mise en forme. */
  const essais = [
    corps,
    corps.replace(/\\([\[\]_*#+\-.!<>|~`{}()])/g, "$1"),
    C.unsmart(corps)
  ];
  for (const e of essais) { try { return JSON.parse(e.slice(0, e.lastIndexOf("}") + 1)); } catch (x) {} }
  throw new Error("le JSON du plan est illisible");
}

/* ---------- 2. une entrée Drive -> une séance exécutable ---------- */
const nb = s => parseFloat(String(s).replace(",", "."));
function minutesDe(txt) {
  let m = /(\d+)\s*h\s*(\d{2})/i.exec(txt);
  if (m) return +m[1] * 60 + +m[2];
  m = /(\d+)\s*h\b/i.exec(txt);
  if (m) return +m[1] * 60;
  m = /(\d+)\s*min/i.exec(txt);
  return m ? +m[1] : null;
}
function plageFC(txt) {
  const m = /FC\s*(\d{3})\s*[–\-à]\s*(\d{3})/i.exec(txt);
  if (m) return { lo:+m[1], hi:+m[2] };
  const p = /plafond\s*(\d{3})/i.exec(txt);
  return p ? { lo:null, hi:+p[1] } : null;
}

function seance(e) {
  const n = C.normSession(e);
  const tout = [n.t, n.s].concat(n.x || []).join(" · ");
  const fam = C.famFromTitle(n.t, n.type);
  let s = null;

  if (n.type === "repos") s = C.LIB.repos(n.x && n.x.length ? n.x.join(". ") + "." : null);
  else if (n.type === "foot") s = C.LIB.foot();
  else if (n.type === "renfo") {
    const tours = /(\d+)\s*tours?/i.exec(n.t);
    s = C.LIB.gainage(tours ? +tours[1] : 3);
    /* La raison complète parle de sa santé : elle voyage chiffrée dans D, pas dans
       la librairie (core.js est publié en clair avec la page). */
    s.pourquoi = ATHLETE.renfo_pourquoi;
  } else if (n.type === "course") {
    const min = minutesDe(n.t) || minutesDe(n.s);
    let r;
    if (fam === "vma" && (r = /(\d+)\s*[x×]\s*(\d+)\s*m\b/i.exec(n.t))) s = C.LIB.vma(+r[1], +r[2]);
    else if (fam === "tempo" && (r = /(\d+)\s*[x×]\s*(\d+)\s*min/i.exec(n.t))) s = C.LIB.tempo(+r[1], +r[2]);
    else if (fam === "endur" && nb(n.km)) s = C.LIB.endurance(nb(n.km), (plageFC(tout) || {}).hi || 150);
    else if (fam === "recup" && min) s = C.LIB.recup(min);
    else if (min && (r = /(\d+)\s*(?:LD\b|lignes?\s+droites?)/i.exec(n.t))) s = C.LIB.facileLD(min, +r[1]);
    else if (min) s = C.LIB.facile(min);
  }
  /* Pas de formule connue (vélo, marche, tennis…) : on affiche sans inventer d'étapes. */
  if (!s) s = { fam, sport:n.type, t:n.t, km:"", duree:n.s || "", pasDeMontre:true, etapes:[] };

  /* LE PLAN GAGNE sur la librairie : titre, distance, consigne, notes. */
  const fc = plageFC(tout);
  if (fc) for (const b of s.etapes || []) {
    if (b.cible && b.cible.type === "fc") {
      if (fc.lo) b.cible.lo = fc.lo;
      b.cible.hi = fc.hi;
      b.t = b.t.replace(/FC [\d–]+/, "FC " + b.cible.lo + "–" + b.cible.hi);
      b.c = b.c.replace(/Plafond \d{3}/, "Plafond " + b.cible.hi);
    }
  }
  s.d = n.d;
  if (e.prov) s.prov = true;           /* semaines 2 à 4 du plan : esquissées, revues chaque dimanche */
  s.t = n.t.replace(/\s*·\s*[\d,.]+\s*km\s*$/i, "");
  if (n.km) s.km = String(n.km).replace(/\s*km\s*$/i, "");
  if (n.s && n.type !== "course") s.duree = n.s;
  if (n.x && n.x.length && n.type !== "repos") { s.pourquoi = n.x[0]; s.x = n.x.slice(1); }
  return s;
}

/* ---------- 3. ce qui a été fait ---------- */
function marquer(plan, faits) {
  for (const f of faits || []) {
    const cible = plan.find(s => s.d === f.d && !s.fait && C.famOf(s) !== "repos" &&
                                 (f.type ? (s.sport || C.normSession(s).type) === f.type : true));
    const s = cible || (() => {
      const n = { fam:C.famFromTitle(f.t, f.type), sport:f.type || "autre", t:f.t || "Séance", km:"",
                  duree:f.duree || "", pasDeMontre:true, pourquoi:f.pourquoi || "Hors plan.", etapes:[], d:f.d, horsPlan:true };
      plan.push(n); return n;
    })();
    s.fait = true;
    if (f.auto) s.auto = true;
    if (f.gid) s.gid = f.gid;
    s.reel = f.reel || [];
    if (f.pourquoi && cible) s.x = [f.pourquoi].concat(s.x || []);
    const d = s.reel.find(r => /DISTANCE/i.test(r.l));
    if (d) s.kmFait = String(d.v).replace(/\s*km/, "");
  }
}

/* ---------- 3 bis. séances faites, lues sur la montre ----------
   Avant le 6 octobre, une séance n'était cochée que quand le coach l'écrivait
   dans jour.json : un footing du matin restait « à faire » jusqu'au débrief du
   soir. Désormais chaque collecte Garmin coche ce que la montre a enregistré.
   Ce que le coach écrit dans jour.json garde la priorité. */
const G_TYPE = A.G_TYPE;
const NOM_TYPE = { course:"Course", renfo:"Renforcement", foot:"Football", velo:"Vélo", nage:"Natation", marche:"Marche", autre:"Séance" };
const duree = sec => {
  sec = Math.round(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") : m + ":" + String(s).padStart(2, "0");
};
const dureeCourte = sec => { const m = Math.round(sec / 60); return m >= 60 ? Math.floor(m / 60) + " h" + (m % 60 ? " " + String(m % 60).padStart(2, "0") : "") : m + " min"; };
/* Toutes les activités connues : l'historique (donnees/garmin/activites.json, 12 mois)
   complété par les listes des 7 derniers jours de chaque collecte. */
function activites(garmin, historique) {
  const vues = new Map();
  for (const x of historique || []) if (x && x.id != null && x.start_time) vues.set(x.id, x);
  for (const l of garmin || []) {
    const a = l && l.activites_7j;
    for (const x of (a && a.activities) || []) if (x && x.id != null && x.start_time) vues.set(x.id, x);
  }
  /* Plusieurs sources (Garmin, Strava, Apple Santé) peuvent voir la même séance : à
     moins de 5 minutes d'écart et du même sport, on n'en garde qu'une, Garmin d'abord. */
  const rang = x => x.source === "strava" ? 1 : x.source === "apple_sante" ? 2 : 0;
  const tri = [...vues.values()].sort((a, b) => rang(a) - rang(b) || (a.start_time < b.start_time ? -1 : 1));
  const gardees = [];
  const t = x => Date.parse(String(x.start_time).replace(" ", "T"));
  for (const x of tri) {
    const sp = G_TYPE[x.type] || "autre";
    if (gardees.some(y => (G_TYPE[y.type] || "autre") === sp && Math.abs(t(y) - t(x)) < 5 * 60000)) continue;
    gardees.push(x);
  }
  return gardees.sort((a, b) => a.start_time < b.start_time ? -1 : 1);
}
function faitsAuto(acts, debut) {
  const out = [];
  for (const a of acts) {
    const d = String(a.start_time).slice(0, 10);
    if (d < debut) continue;
    const type = G_TYPE[a.type] || "autre";
    const sec = a.duration_seconds || 0;
    /* Une marche ou une activité de moins de 10 min n'est pas une séance. */
    if (sec < 600 || (type === "marche" && sec < 1800)) continue;
    const reel = [];
    if (a.distance_meters >= 200 && type !== "renfo") reel.push({ l:"DISTANCE", v:C.fmt1(a.distance_meters / 1000) + " km" });
    reel.push({ l:"DURÉE", v:duree(sec) });
    if (type === "course" && a.distance_meters > 500) {
      const p = sec / (a.distance_meters / 1000);
      reel.push({ l:"ALLURE", v:Math.floor(p / 60) + ":" + String(Math.round(p % 60)).padStart(2, "0") + " /km" });
    }
    if (a.avg_hr_bpm) reel.push({ l:"FC MOY.", v:String(Math.round(a.avg_hr_bpm)) });
    out.push({ d, type, t:NOM_TYPE[type] + " · " + dureeCourte(sec), reel, auto:true, gid:a.id,
               pourquoi:"Enregistrée par ta montre, hors du plan." });
  }
  return out;
}

/* Volume par semaine (lundi → dimanche), d'après la montre : séances, minutes,
   kilomètres de course. Les semaines antérieures aux premières collectes
   sont omises plutôt que montrées à zéro. */
function hebdo(today, garmin, nb, historique) {
  nb = nb || 8;
  const dates = (garmin || []).map(l => l && l.date).filter(Boolean).sort();
  if (!dates.length && !(historique && historique.length)) return [];
  /* Couverture : depuis l'historique rattrapé s'il existe, sinon depuis la première collecte. */
  let couvert;
  if (historique && historique.length) couvert = String(historique.map(a => a.start_time).sort()[0]).slice(0, 10);
  else { const d0 = C.parse(dates[0]); d0.setDate(d0.getDate() - 6); couvert = C.iso(d0); }
  const acts = activites(garmin, historique), out = [];
  for (let w = -(nb - 1); w <= 0; w++) {
    const js = C.weekDays(today, w), l = js[0], fin = js[6];
    if (fin < couvert) continue;
    let km = 0, n = 0, min = 0;
    for (const a of acts) {
      const d = String(a.start_time).slice(0, 10);
      if (d < l || d > fin) continue;
      const type = G_TYPE[a.type] || "autre", sec = a.duration_seconds || 0;
      if (sec < 600 || (type === "marche" && sec < 1800)) continue;
      n++; min += sec / 60;
      if (type === "course") km += (a.distance_meters || 0) / 1000;
    }
    out.push({ l, km:Math.round(km * 10) / 10, n, min:Math.round(min), partiel:l < couvert });
  }
  return out;
}

/* ---------- 4. tendances : les 14 dernières nuits ----------
   Lues directement dans donnees/ (collecte cloud), jamais recopiées par la
   tâche : un chiffre que personne ne réécrit ne peut pas être mal recopié. */
const jourParis = sec => new Date(sec * 1000).toLocaleDateString("sv-SE", { timeZone:"Europe/Paris" });
/* Heure de Paris d'un instant, en minutes depuis MIDI la veille : 21h57 → 597, 6h40 → 1120.
   Un coucher après minuit reste ainsi après un coucher de 23 h, et lever et coucher
   se comparent sur un même axe. */
const minNuit = ms => {
  const [h, m] = new Date(ms).toLocaleTimeString("fr-FR", { timeZone:"Europe/Paris", hour:"2-digit", minute:"2-digit", hour12:false }).split(":").map(Number);
  const t = (h % 24) * 60 + m;
  return t >= 720 ? t - 720 : t + 720;
};
const heureParis = sec => +new Date(sec * 1000).toLocaleTimeString("fr-FR", { timeZone:"Europe/Paris", hour:"2-digit", hour12:false }).slice(0, 2);
function tendances(today, garmin, withings, n, sante) {
  n = n || 14;
  const jours = [];
  for (let i = n - 1; i >= 0; i--) { const d = C.parse(today); d.setDate(d.getDate() - i); jours.push(C.iso(d)); }
  /* Garmin : la dernière collecte d'un jour remplace les précédentes. */
  const G = {};
  for (const l of garmin || []) if (l && l.date) G[l.date] = l;
  /* Withings : une nuit = les séries qui se terminent ce matin-là (avant 14 h),
     additionnées (une nuit coupée en deux fait deux séries). Dédoublonnées par id. */
  const W = {}, WC = {}, vus = new Set();
  for (const l of withings || []) {
    const series = (l && l.sommeil && l.sommeil.series) || [];
    for (const s of series) {
      if (!s || !s.enddate || !s.data || vus.has(s.id)) continue;
      vus.add(s.id);
      if (heureParis(s.enddate) >= 14) continue;
      const d = jourParis(s.enddate);
      W[d] = (W[d] || 0) + (s.data.total_sleep_time || 0);
      /* coucher = début de la première série, lever = fin de la dernière */
      const c = WC[d] = WC[d] || { deb:s.startdate, fin:s.enddate };
      if (s.startdate && s.startdate < c.deb) c.deb = s.startdate;
      if (s.enddate > c.fin) c.fin = s.enddate;
    }
  }
  /* Apple Santé (raccourci de l'iPhone) : le dernier envoi d'un jour fait foi. Prend le
     relais de Withings pour la nuit, de Garmin pour la VFC et les heures de coucher. */
  const S = {};
  for (const l of sante || []) if (l && l.date) S[l.date] = Object.assign({}, S[l.date], Object.fromEntries(Object.entries(l).filter(([, v]) => v != null)));
  const msDe = iso => { const t = Date.parse(iso || ""); return isNaN(t) ? null : t; };
  const lignes = jours.map(d => {
    const g = G[d] || {}, so = g.sommeil || {}, v = g.vfc || {}, st = g.statut || {}, sa = S[d] || {};
    const vfcG = v.last_night_avg_hrv_ms != null ? v.last_night_avg_hrv_ms : so.avg_overnight_hrv;
    const vfc = vfcG != null ? vfcG : sa.vfc_ms;
    return {
      d,
      /* sommeil en minutes tronquées, comme Garmin Connect l'affiche (31 113 s = 8h38) */
      sg: so.sleep_seconds ? Math.floor(so.sleep_seconds / 60) : so.sleep_hours != null ? Math.round(so.sleep_hours * 60) : null,
      sw: W[d] ? Math.floor(W[d] / 60) : sa.sommeil_min != null ? Math.round(sa.sommeil_min) : null,
      vfc: vfc == null ? null : Math.round(vfc),
      ch: st.load_ratio == null ? null : st.load_ratio,
      /* coucher et lever (minutes depuis midi la veille), Garmin d'abord, capteur de nuit sinon */
      cou: so.sleep_start ? minNuit(so.sleep_start) : WC[d] && WC[d].deb ? minNuit(WC[d].deb * 1000) : msDe(sa.coucher) != null ? minNuit(msDe(sa.coucher)) : null,
      lev: so.sleep_end ? minNuit(so.sleep_end) : WC[d] && WC[d].fin ? minNuit(WC[d].fin * 1000) : msDe(sa.lever) != null ? minNuit(msDe(sa.lever)) : null
    };
  });
  if (!lignes.some(l => l.sg != null || l.sw != null || l.vfc != null || l.ch != null)) return null;
  /* Zone « équilibrée » de la VFC : celle que Garmin calcule pour lui, la plus récente. */
  let zone = null;
  for (const d of jours.slice().reverse()) {
    const v = (G[d] || {}).vfc || {};
    if (v.baseline_balanced_low_ms && v.baseline_balanced_upper_ms) { zone = [v.baseline_balanced_low_ms, v.baseline_balanced_upper_ms]; break; }
  }
  return { jours:lignes, vfc:zone };
}

/* Ce qui est programmé sur la Forerunner, d'après la dernière collecte. */
function surMontre(garmin) {
  for (let i = (garmin || []).length - 1; i >= 0; i--) {
    const p = garmin[i] && garmin[i].seances_programmees;
    if (p && Array.isArray(p.scheduled_workouts)) return p.scheduled_workouts.map(w => ({ d:w.date, n:w.name }));
  }
  return [];
}

/* ---------- 5. échéances ----------
   meta.caps du plan : { d, l, attente }. « attente:true » = quelque chose que
   l'athlète doit récupérer ou faire et qui traîne depuis d (le scanner du 1er
   septembre, sans compte rendu un mois plus tard). Le reste = rendez-vous à venir. */
function echeances(today, meta, mesures) {
  const out = [], vus = new Set();
  const ecart = d => Math.round((C.parse(d) - C.parse(today)) / 86400000);
  /* Tour de taille : relevé dans la page, il se redemande tout seul toutes les deux semaines.
     Une attente du plan est levée dès qu'une mesure est arrivée après elle. */
  const derniere = (mesures || []).slice(-1)[0];
  const caps = ((meta && meta.caps) || []).filter(c => !(c && /tour de taille/i.test(c.l || "") && derniere && derniere.d >= c.d));
  if (derniere) {
    const pro = C.parse(derniere.d); pro.setDate(pro.getDate() + 14);
    const k = C.iso(pro);
    caps.push(k <= today ? { d:k, l:"Tour de taille à relever (toutes les deux semaines)", attente:true } : { d:k, l:"Tour de taille à relever" });
  }
  if (meta && meta.next_test && !caps.some(c => c.d === meta.next_test && /test/i.test(c.l || "")))
    caps.push({ d:meta.next_test, l:"Test de contrôle" });
  for (const c of caps) {
    if (!c || !c.d || !c.l || vus.has(c.d + c.l)) continue;
    vus.add(c.d + c.l);
    const j = ecart(c.d);
    if (c.attente) out.push({ d:c.d, l:c.l, attente:true, j:-j });
    else if (j >= 0) out.push(Object.assign({ d:c.d, l:c.l, j }, c.k === "course" ? { k:"course" } : {}));
  }
  /* L'attente la plus ancienne d'abord, puis le rendez-vous le plus proche. */
  return out.sort((a, b) => (b.attente ? 1 : 0) - (a.attente ? 1 : 0) || (a.attente ? b.j - a.j : a.j - b.j));
}

/* ---------- 6. assemblage ---------- */
function construire(maintenant, src) {
  ATHLETE = src.athlete || ATH.DEFAUT;
  C.reglerAllures(ATHLETE.allures);
  const today = C.iso(maintenant);
  const J = src.jour || {};
  const avant = src.memoire || {};             /* dernières valeurs connues */
  const soucis = [];

  let planDoc = null;
  try { if (src.planTxt == null) throw new Error("entrees/plan.txt absent"); planDoc = extrairePlan(src.planTxt); }
  catch (e) { soucis.push("Plan illisible (" + e.message + ") : je montre le dernier plan connu."); }

  /* Historique : chaque plan remplace les jours qu'il couvre, les autres restent.
     C'est ce qui garde la semaine écoulée visible dans le calendrier. */
  const histo = Object.assign({}, src.histo || {});
  if (planDoc) {
    const parJour = {};
    for (const e of planDoc.entries || []) (parJour[e.d] = parJour[e.d] || []).push(e);
    Object.assign(histo, parJour);
  }
  /* L'agenda garde quatre semaines d'historique. */
  const debut = C.weekDays(today, -4)[0];
  for (const k of Object.keys(histo)) if (k < debut) delete histo[k];

  const plan = [];
  for (const k of Object.keys(histo).sort()) for (const e of histo[k]) plan.push(seance(e));
  /* Ce que le coach a écrit d'abord, puis ce que la montre a vu et qu'il n'a pas encore écrit. */
  const ecrits = J.faits || [];
  const acts = activites(src.garmin, src.activites);
  const auto = faitsAuto(acts, debut).filter(a => !ecrits.some(f => f.d === a.d && (!f.type || f.type === a.type)));
  marquer(plan, ecrits.concat(auto));

  /* Chaque course faite reçoit son analyse km par km (fichier FIT de la montre),
     avec le plafond de FC que le plan lui fixait. */
  const fiches = src.sorties || {};
  const sorties = {}, plafonds = {};
  for (const s of plan) {
    if (!s.fait || C.FA(C.famOf(s)).sp !== "course") continue;
    if (!s.gid) {
      const a = acts.find(x => String(x.start_time).slice(0, 10) === s.d && G_TYPE[x.type] === "course" && !plan.some(p => p !== s && p.gid === x.id));
      if (a) s.gid = a.id;
    }
    if (s.gid && fiches[s.gid]) {
      plafonds[s.gid] = A.plafondDe(s);
      const r = A.resumeSortie(fiches[s.gid], plafonds[s.gid], ATHLETE.fc_moteur);
      if (r) sorties[s.gid] = r;
    }
  }
  const resumes = Object.values(fiches).filter(f => f && !f.erreur && String(f.date) >= C.iso(new Date(maintenant.getTime() - 60 * 86400000)))
    .map(f => sorties[f.id] || A.resumeSortie(f, plafonds[f.id], ATHLETE.fc_moteur)).filter(Boolean);
  const mesures = A.mesures(src.retours);
  const objectifs = A.objectifs(today, acts, src.retours, ecrits, 12, ATHLETE.cible);
  const mot = A.moteur(Object.values(fiches), ATHLETE.fc_moteur);

  const semaine = C.weekDays(today, 0);
  if (!semaine.some(k => histo[k])) soucis.push("Aucun plan publié pour cette semaine : le bilan du dimanche n'a pas tourné. Demande-le dans l'onglet Parler.");
  else if (!histo[today]) soucis.push("Rien de prévu dans le plan pour aujourd'hui.");
  /* La date du mot n'est plus un souci : la page l'affiche à côté du mot (motDate). */
  if (J.souci) soucis.push(J.souci);
  /* Un chiffre repris d'un autre jour doit le dire : ne jamais faire passer
     la charge du 21 pour celle d'aujourd'hui. */
  const dates = Object.assign({}, avant.dates || {});
  for (const k of ["n3", "serie", "pred", "rec"]) if (J[k] !== undefined) dates[k] = J.date || today;
  const vieux = ["n3", "serie"].filter(k => J[k] === undefined && dates[k] && dates[k] !== today);
  if (vieux.length) soucis.push("Les chiffres de forme datent du " + dates[vieux[0]].slice(8) + "/" + dates[vieux[0]].slice(5, 7) + " : pas de mise à jour depuis.");

  const garde = k => J[k] !== undefined ? J[k] : avant[k];
  const D = {
    plan, today,
    genere: maintenant.getDate() + " " + ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"][maintenant.getMonth()] +
            " à " + String(maintenant.getHours()).padStart(2, "0") + ":" + String(maintenant.getMinutes()).padStart(2, "0"),
    semaines: 2,
    parler: "https://claude.ai/project/01a02952-0b0a-7110-b754-aea8db34859c",
    mot: garde("mot") || "",
    n3: garde("n3") || [], serie: garde("serie") || [], pred: garde("pred") || [], rec: garde("rec") || [],
    souci: soucis.join(" "),
    sources: garde("sources") || "",
    tendances: tendances(today, src.garmin, src.withings, 14, src.sante),
    hebdo: hebdo(today, src.garmin, 12, src.activites),
    motDate: J.date || null,
    retours: (src.retours || []).filter(r => r && r.d >= C.weekDays(today, -2)[0]).slice(-80),
    montre: surMontre(src.garmin),
    version: maintenant.toISOString(),
    /* État de la dernière collecte : la page propose de reconnecter Withings quand il échoue. */
    sourcesEtat: src.etatCollecte ? { quand:src.etatCollecte.collecte, garmin:src.etatCollecte.garmin, withings:src.etatCollecte.withings, strava:src.etatCollecte.strava, sante:src.etatCollecte.sante } : null,
    echeances: echeances(today, planDoc ? planDoc.meta : avant.meta, mesures),
    retour: "/api/retour",
    sorties, moteur:mot, objectifs, mesures,
    checkin: A.checkinDe(ATHLETE),
    reglages: ATH.pourLaPage(ATHLETE)
  };
  /* Objectif de reprise d'un sport (le vélo, par exemple) : ce qui la bloque, tel que le
     plan l'écrit dans ses attentes. Le champ garde son nom d'origine, « velo ». */
  const RP = ATHLETE.objectifs.reprise;
  if (RP) {
    const motif = new RegExp(RP.motif || RP.sport, "i");
    const bloque = D.echeances.find(e => e.attente && motif.test(e.l));
    objectifs.velo = { attente:bloque ? bloque.l : null, depuis:bloque ? bloque.d : null, dernier:objectifs.dernier[RP.sport] || null };
  }
  const syn = A.synthese({ today, maintenant, garmin:src.garmin, sante:src.sante, T:D.tendances, plan, retours:src.retours, meteo:src.meteo,
                           O:objectifs, M:mot, sorties:resumes, athlete:ATHLETE });
  /* Le feu du jour, pour la page : couleur, signaux déclenchés, ce qui a été vérifié
     sans rien trouver, ce qui n'a pas pu l'être, et la météo du créneau. La page
     recalcule elle-même les signaux du check-in et des retours (même règle, core.js). */
  D.feu = { couleur:syn.feu, raisons:syn.regles.filter(r => r.declenchee).map(r => ({ id:r.id, niveau:r.niveau, texte:r.texte })),
            ok:syn.regles.filter(r => !r.declenchee && !r.manque).map(r => r.texte),
            manque:syn.regles.filter(r => r.manque).map(r => r.manque), meteo:syn.meteo };
  /* Ce que le coach avait sous les yeux quand il a écrit son mot (première régénération
     qui le voit). La collecte compare à cette empreinte pour savoir si quelque chose
     d'important est arrivé depuis, et réveille le coach (collecte/reagir.mjs). */
  const hier = C.iso(new Date(C.parse(today).getTime() - 86400000));
  const empreinte = { d:today, nuit:syn.nuit && syn.nuit.minutes != null ? syn.nuit.minutes : null,
    acts:acts.filter(a => String(a.start_time).slice(0, 10) >= hier).map(a => String(a.id)),
    checkin:(syn.checkin && syn.checkin.ecrit) || null };
  const motNeuf = !!D.mot && (D.mot !== avant.mot || !avant.motVu);
  D.motVu = motNeuf ? maintenant.toISOString() : (avant.motVu || null);
  D.n3Date = dates.n3 || null;            /* la page n'affiche les chiffres du coach que le jour où il les a donnés */
  D.reaction = src.reaction || null;
  return { D, synthese:syn, histo, memoire: { meta:planDoc ? planDoc.meta : avant.meta, mot:D.mot, n3:D.n3, serie:D.serie, pred:D.pred, rec:D.rec, sources:D.sources, dates,
    motVu:D.motVu, motBase:motNeuf ? empreinte : (avant.motBase || null), empreinte } };
}

if (require.main === module) {
  let planTxt = null;
  try { planTxt = fs.readFileSync(E("plan.txt"), "utf8"); } catch (e) {}
  /* Les deux derniers mois suffisent pour 14 jours. */
  const jsonl = dossier => {
    const rep = path.join(ici, "..", "donnees", dossier);
    let f = []; try { f = fs.readdirSync(rep).filter(x => /^\d{4}-\d{2}\.jsonl$/.test(x)).sort().slice(-2); } catch (e) {}
    const out = [];
    for (const x of f) for (const l of fs.readFileSync(path.join(rep, x), "utf8").split("\n")) {
      if (!l.trim()) continue;
      try { out.push(JSON.parse(l)); } catch (e) {}
    }
    return out;
  };
  const lignes = f => { try { return fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; } };
  const json = f => { try { return JSON.parse(fs.readFileSync(path.join(ici, "..", f), "utf8")); } catch (e) { return null; } };
  const fiches = {};
  for (const src of ["garmin", "strava"]) try {
    const rep = path.join(ici, "..", "donnees", src, "sorties");
    for (const f of fs.readdirSync(rep)) if (f.endsWith(".json")) { try { const x = JSON.parse(fs.readFileSync(path.join(rep, f), "utf8")); fiches[x.id] = x; } catch (e) {} }
  } catch (e) {}
  const { D, synthese, histo, memoire } = construire(new Date(), {
    planTxt, jour: lire("jour.json", {}), memoire: lire("memoire.json", {}), histo: lire("historique.json", {}),
    etatCollecte: (() => { try { return JSON.parse(fs.readFileSync(path.join(ici, "..", "etat", "derniere-collecte.json"), "utf8")); } catch (e) { return null; } })(),
    garmin: jsonl("garmin"), withings: jsonl("withings"), sante: jsonl("sante"), retours: lignes(path.join(ici, "..", "donnees", "retours.jsonl")),
    /* Les séances de toutes les sources (sans doublon : voir activites()). */
    activites: ["garmin", "strava", "sante"].flatMap(s => Object.values(json("donnees/" + s + "/activites.json") || {})), sorties: fiches, meteo: json("donnees/meteo.json"),
    reaction: json("etat/reaction.json"),
    athlete: ATH.lireAthlete(path.join(ici, ".."))
  });
  /* Pour le coach : tout ce qu'il faut savoir ce matin, déjà calculé. */
  fs.writeFileSync(path.join(ici, "..", "donnees", "synthese.json"), JSON.stringify(synthese, null, 1) + "\n");
  fs.writeFileSync(E("historique.json"), JSON.stringify(histo, null, 1));
  fs.writeFileSync(E("memoire.json"), JSON.stringify(memoire, null, 1));
  fs.writeFileSync(path.join(ici, "donnees.js"),
    "/* GÉNÉRÉ par depuis-plan.js le " + D.genere + " — ne pas modifier à la main. */\nmodule.exports = " + JSON.stringify(D, null, 1) + ";\n");
  console.log("donnees.js : " + D.today + " · " + D.plan.length + " séances" + (D.souci ? " · SOUCI : " + D.souci : ""));
}

module.exports = { extrairePlan, seance, marquer, construire, tendances, echeances, activites, faitsAuto, surMontre, hebdo };
/* Les analyses (sorties, moteur, objectifs, synthèse) vivent dans analyses.js. */
