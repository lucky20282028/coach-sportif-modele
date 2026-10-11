/* =====================================================================
   NOYAU — logique pure, sans DOM. Testé hors navigateur par bench.js.
   Tout ce qui décide « quoi afficher » vit ici ; le rendu se contente
   de traduire ces objets en HTML.
   ===================================================================== */

/* ---------- types de séance ---------- */
const SVG = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
  'stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';

const TYPES = {
  course: { c:"#FF4B21", s:"#FFEFEA", l:"Course",
    i:'<svg viewBox="0 0 24 24" fill="none"><circle cx="16.2" cy="4.6" r="2.4" fill="currentColor"/>' +
      '<g stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M15 8.4L11.6 14.2"/><path d="M14.9 9.2L15.8 12.4L18.8 11.4"/>' +
      '<path d="M14.4 9.6L11.2 11.6L8.6 10.6"/><path d="M11.6 14.2L15.4 14.8L14.6 19.4"/>' +
      '<path d="M11.6 14.2L8.6 16.8L6 19.8"/></g></svg>' },
  foot:  { c:"#7C5CFF", s:"#F0EDFF", l:"Football",
    i:SVG('<circle cx="12" cy="12" r="8.6"/><path d="M12 7.1l3.6 2.6-1.4 4.3H9.8L8.4 9.7z"/><path d="M12 3.4v3.7M19.9 9.5l-4.3.2M17 19.3l-2.8-5M7 19.3l2.8-5M4.1 9.5l4.3.2"/>') },
  velo:  { c:"#2D8FE0", s:"#E9F3FC", l:"Vélo",
    i:SVG('<circle cx="5.5" cy="17" r="3.6"/><circle cx="18.5" cy="17" r="3.6"/><path d="M5.5 17l4.2-9.3h3.9L10.4 17h8.1"/><path d="M13.6 7.7h3.2"/>') },
  renfo: { c:"#0D9E9E", s:"#E2F5F5", l:"Renforcement",
    i:SVG('<path d="M3.5 9.5v5M6.8 6.8v10.4M17.2 6.8v10.4M20.5 9.5v5M6.8 12h10.4"/>') },
  nage:  { c:"#35B8C7", s:"#E6F7F9", l:"Natation",
    i:SVG('<circle cx="17.2" cy="6.6" r="2"/><path d="M3 12.6l5.4-3.2 4.4 2.6"/><path d="M2 18.4c2 0 2-1.4 4-1.4s2 1.4 4 1.4 2-1.4 4-1.4 2 1.4 4 1.4 2-1.4 4-1.4"/>') },
  marche:{ c:"#8A9A5B", s:"#EFF3E4", l:"Marche",
    i:SVG('<circle cx="13.4" cy="4.4" r="2"/><path d="M12.6 8.2L10 13.4l3.4 2.2.8 4.6"/><path d="M10 13.4L7.4 16l-.8 4"/><path d="M12.9 9.4l3.1 1.8 1.8-1.2"/>') },
  autre: { c:"#7B7168", s:"#F1EEEA", l:"Autre sport",
    i:SVG('<circle cx="12" cy="12" r="8.4"/><path d="M12 8.6v3.6l2.4 1.4"/>') },
  repos: { c:"#B9B0A5", s:"#F4F0EA", l:"Repos",
    i:SVG('<path d="M20.2 14.8A8.6 8.6 0 0 1 9.2 3.8a8.6 8.6 0 1 0 11 11z"/>') }
};
const TY = t => TYPES[t] || TYPES.autre;

/* Strava sport_type → type de séance. Tout ce qui n'est pas listé devient
   « autre » : jamais « course », sinon un match de padel s'affiche en running. */
const SPORT = {
  Run:"course", TrailRun:"course", VirtualRun:"course",
  Soccer:"foot",
  Ride:"velo", VirtualRide:"velo", GravelRide:"velo", MountainBikeRide:"velo", EBikeRide:"velo",
  WeightTraining:"renfo", Workout:"renfo", Crossfit:"renfo", HighIntensityIntervalTraining:"renfo",
  Swim:"nage",
  Walk:"marche", Hike:"marche",
  Yoga:"autre", Pilates:"autre", Elliptical:"autre", StairStepper:"autre", Rowing:"autre",
  Tennis:"autre", Badminton:"autre", Squash:"autre", Racquetball:"autre", Pickleball:"autre",
  TableTennis:"autre", Golf:"autre", Skateboard:"autre", RockClimbing:"autre",
  AlpineSki:"autre", BackcountrySki:"autre", NordicSki:"autre", Snowboard:"autre",
  Kayaking:"autre", Canoeing:"autre", StandUpPaddling:"autre", Surfing:"autre",
  IceSkate:"autre", InlineSkate:"autre", Handcycle:"autre", Velomobile:"autre", Wheelchair:"autre"
};
const kindOf = st => SPORT[st] || "autre";

/* Devine le type depuis un titre — uniquement pour l'ancien format tableau.
   Piège historique : « Footing » contient « foot ». Le football exige le mot entier. */
function typeFromTitle(t, sub) {
  const s = String(t || ""), both = String(sub || "") + " " + s;
  if (/^repos/i.test(s)) return /gainage|renfor|muscu|abdo/i.test(both) ? "renfo" : "repos";
  if (/gainage|renfor|muscu|abdo|core\b/i.test(s)) return "renfo";
  if (/football|\bfoot\b|\bmatch\b/i.test(s)) return "foot";
  if (/v[ée]lo|cyclis|\bride\b|\bbike\b|home ?trainer/i.test(s)) return "velo";
  if (/natation|\bnage\b|\bswim\b|piscine|crawl/i.test(s)) return "nage";
  if (/marche|\bwalk\b|randonn/i.test(s)) return "marche";
  if (/footing|course|running|fractionn|tempo|seuil|a[ée]robie|endurance|sortie longue|\brun\b|\bLD\b/i.test(s)) return "course";
  return "autre";
}

/* ---------- normalisation d'une séance ---------- */
function normSession(e) {
  if (!e) return null;
  if (Array.isArray(e)) {
    const t = String(e[1] || ""), ty = typeFromTitle(t, e[2]);
    return { d:e[0], t: (ty === "renfo" && /^repos/i.test(t)) ? "Renforcement" : t,
             s:e[2] || "", km:e[3] || "", type:ty, x:e[4] || [], prov:!!e[5] };
  }
  const ty = e.type && TYPES[e.type] ? e.type : typeFromTitle(e.t, e.s);
  return { d:e.d, t:e.t || "", s:e.s || "", km:e.km || "", type:ty, x:e.x || [], prov:!!e.prov };
}

/* FILET DE SÉCURITÉ — un plan mal formé peut fusionner deux sports dans un
   seul titre : « Footing 55 min + Gainage circuit · 3 tours ». On le scinde,
   mais UNIQUEMENT si les deux moitiés désignent chacune un sport connu et
   qu'elles diffèrent. « Aérobie faible + 5 LD 45 min » reste une seule séance :
   « 5 LD 45 min » ne désigne aucun sport, c'est un contenu de séance. */
const SPORTS_SURS = ["course", "foot", "velo", "renfo", "nage", "marche"];
function splitFusion(s) {
  if (!s || !s.t || s.t.indexOf(" + ") < 0) return [s];
  const parts = s.t.split(" + ");
  if (parts.length !== 2) return [s];
  const a = typeFromTitle(parts[0]), b = typeFromTitle(parts[1]);
  if (a === b) return [s];
  if (SPORTS_SURS.indexOf(a) < 0 || SPORTS_SURS.indexOf(b) < 0) return [s];
  return [
    { d:s.d, t:parts[0].trim(), s:s.s, km:s.km, type:a, x:s.x, prov:s.prov },
    { d:s.d, t:parts[1].trim(), s:"", km:"", type:b, x:[], prov:s.prov }
  ];
}

/* Plusieurs séances peuvent partager une date : le plan est une liste plate,
   on la regroupe par jour. C'est ce qui permet foot + renfo le même mardi. */
function buildPlan(entries) {
  const map = {};
  (entries || []).forEach(e => {
    const s0 = normSession(e);
    if (!s0 || !s0.d) return;
    splitFusion(s0).forEach(s => (map[s.d] = map[s.d] || []).push(s));
  });
  /* un jour ne peut pas être « repos » ET contenir une séance */
  Object.keys(map).forEach(k => {
    const real = map[k].filter(s => s.type !== "repos");
    if (real.length) map[k] = real;
  });
  return map;
}

/* ---------- activités enregistrées ---------- */
function buildActs(list) {
  const map = {};
  (list || []).forEach(x => {
    if (!x || !x.summary || !(x.summary.moving_time > 300)) return;
    const k = String(x.start_local || "").slice(0, 10);
    if (!k) return;
    const a = Object.assign({}, x, { kind: kindOf(x.sport_type) });
    (map[k] = map[k] || []).push(a);
  });
  Object.keys(map).forEach(k => map[k].sort((a, b) => b.summary.moving_time - a.summary.moving_time));
  return map;
}

/* Associe chaque séance prévue à l'activité enregistrée qui lui correspond.
   Priorité au même sport ; sinon la séance reste non réalisée et l'activité
   part en « hors plan ». Une seule activité par séance. */
function matchDay(sessions, activities) {
  const acts = (activities || []).slice();
  const used = new Set();
  const pairs = (sessions || []).map(s => {
    let idx = acts.findIndex((a, i) => !used.has(i) && a.kind === s.type);
    if (idx < 0 && s.type === "repos") idx = -1;
    if (idx >= 0) used.add(idx);
    return { plan:s, act: idx >= 0 ? acts[idx] : null };
  });
  const extra = acts.filter((_, i) => !used.has(i));
  return { pairs, extra };
}

/* ---------- clés de validation manuelle ---------- */
const doneKey = (k, i) => (i ? k + "#" + i : k);

function dayRows(k, planMap, actMap, doneMap, today, actFrom) {
  const sessions = planMap[k] || [];
  const acts = actMap[k] || [];
  const { pairs, extra } = matchDay(sessions, acts);
  const rows = [];
  pairs.forEach((p, i) => {
    const key = doneKey(k, i);
    const manual = doneMap[key];
    const done = manual === true || (manual !== false && !!p.act);
    rows.push({ k, i, key, plan:p.plan, act:p.act, done,
                type:p.plan.type, rest:p.plan.type === "repos", ghost:false });
  });
  extra.forEach((a, j) => {
    rows.push({ k, i: pairs.length + j, key: doneKey(k, pairs.length + j),
                plan: { d:k, t:(a.name || "Séance").replace(/^.*? - /, ""), s:"",
                        km: a.summary.distance > 50 ? fmt1(a.summary.distance / 1000) + " km" : "",
                        type:a.kind, x:["Séance enregistrée hors plan"] },
                act:a, done:true, type:a.kind, rest:false, ghost:true });
  });
  if (!rows.length) {
    /* aucun plan et rien d'enregistré */
    const past = k < today;
    const known = !actFrom || k >= actFrom;   /* hors fenêtre : on ne juge pas */
    rows.push({ k, i:0, key:doneKey(k, 0), act:null, done:false, rest:true, empty:true,
                unknown: past && !known, type:"repos",
                plan: { d:k, t: past ? "Repos" : "Pas encore planifié", s:"", km:"", type:"repos", x:[] } });
  }
  return rows;
}

/* ---------- sous-titre d'une ligne ---------- */
/* Titre = ce qui était prévu. Sous-titre = ce qui s'est réellement passé.
   `actsLoaded` dit si les activités sont revenues du serveur : tant qu'elles
   ne sont pas là, on n'accuse personne d'avoir sauté une séance. */
function subLine(row, today, actFrom, actsLoaded) {
  const a = row.act;
  if (a) {
    const sm = a.summary;
    if (sm.distance > 50 && (row.type === "course" || row.type === "velo" || row.type === "marche")) {
      const pace = sm.moving_time / (sm.distance / 1000);
      return { cls:"real", txt: fmt1(sm.distance / 1000) + " km · " +
               (row.type === "velo" ? fmt1(sm.distance / 1000 / (sm.moving_time / 3600)) + " km/h"
                                    : paceTxt(pace) + " /km"),
               fast: row.type === "course" && pace < PACE.fast };
    }
    return { cls:"real", txt: Math.round(sm.moving_time / 60) + " min" +
             (sm.average_heartrate ? " · FC " + Math.round(sm.average_heartrate) : "") };
  }
  if (row.rest && row.empty) return null;
  /* validée à la main : ne JAMAIS la contredire par un « Non réalisé » */
  if (row.done) return { cls:"real", txt:"Validée à la main" };
  if (row.k < today) {
    if (!actsLoaded) return row.plan.s ? { cls:"", txt: row.plan.s } : null;
    if (actFrom && row.k < actFrom) return { cls:"vieux", txt:"Hors de la période suivie" };
    if (row.rest) return { cls:"rien", txt:"Rien d'enregistré" };
    return { cls:"rien miss", txt:"Non réalisé" };
  }
  if (row.plan.s) return { cls:"", txt: row.plan.s };
  return null;
}

/* ---------- semaine ---------- */
function weekDays(today, off) {
  const t = parse(today);
  const m = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7) + 7 * (off || 0));
  return Array.from({ length:7 }, (_, i) => {
    const d = new Date(m.getFullYear(), m.getMonth(), m.getDate() + i);
    return iso(d);
  });
}

/* La semaine se compte en SÉANCES tous sports confondus : un match de foot
   et un footing ne se comparent pas au kilomètre. Les km de course sont
   suivis à part, à titre indicatif. */
function weekStats(today, off, planMap, actMap, doneMap, actFrom) {
  const w = weekDays(today, off);
  let prevu = 0, fait = 0, horsPlan = 0, kmPlan = 0, kmReel = 0;
  w.forEach(k => {
    dayRows(k, planMap, actMap, doneMap, today, actFrom).forEach(r => {
      if (r.empty) return;
      if (r.ghost) { horsPlan++; }
      else if (!r.rest) { prevu++; if (r.done) fait++; if (r.plan.km) kmPlan += kmOf(r.plan.km); }
      if (r.act && r.act.summary.distance > 50 && r.type === "course") kmReel += r.act.summary.distance / 1000;
      else if (!r.act && r.done && !r.rest && r.type === "course" && r.plan.km) kmReel += kmOf(r.plan.km);
    });
  });
  return { prevu, fait, horsPlan, kmPlan, kmReel, w,
           pct: prevu ? Math.min(100, Math.round(fait / prevu * 100)) : 0 };
}

/* ---------- héros ---------- */
/* Le bandeau ne parle que d'aujourd'hui. Il met en avant la prochaine séance
   non faite ; s'il y en a plusieurs, les autres sont listées en dessous. */
/* Une consigne du matin devient FAUSSE si le plan a été ajusté après elle :
   « pars vraiment lentement » n'a plus de sens sur une sortie annulée.
   On tolère une demi-heure — c'est le délai normal entre la publication du
   point et un ajustement fait dans la même exécution. */
function consigneStale(consigneTs, planTs) {
  if (!consigneTs || !planTs) return false;
  const a = Date.parse(consigneTs), b = Date.parse(planTs);
  if (isNaN(a) || isNaN(b)) return false;
  return (b - a) > 30 * 60 * 1000;
}

function heroModel(today, planMap, actMap, doneMap, consigne, actFrom, stale) {
  const rows = dayRows(today, planMap, actMap, doneMap, today, actFrom);
  const real = rows.filter(r => !r.rest && !r.empty);
  const main = real.find(r => !r.done) || real[0] || rows[0];
  const others = real.filter(r => r !== main);
  const allDone = real.length > 0 && real.every(r => r.done);
  const m = { multi: others.map(r => ({ t:r.plan.t, type:r.type, done:r.done })),
              type: main.type, done: !!main.done, rest: !!main.rest, empty: !!main.empty,
              title: main.plan.t, tags: [], state:"", say:"" };
  m.state = main.rest || main.empty ? "Repos" : (allDone ? "Tout est fait" : (main.done ? "Fait" : "À faire"));
  if (main.act) {
    const sm = main.act.summary;
    if (sm.distance > 50) {
      m.tags.push(fmt1(sm.distance / 1000) + " km");
      if (main.type === "course") m.tags.push(paceTxt(sm.moving_time / (sm.distance / 1000)) + " /km");
    }
    m.tags.push(Math.round(sm.moving_time / 60) + " min");
    if (sm.average_heartrate) m.tags.push("FC " + Math.round(sm.average_heartrate));
  } else if (!main.empty) {
    if (main.plan.s) m.tags.push(main.plan.s);
    if (main.plan.km) m.tags.push("prévoir " + main.plan.km);
  }
  /* Sur un jour sans séance, la note du plan explique POURQUOI (« sortie
     décalée : pluie ») — elle vaut mieux qu'une consigne d'entraînement. */
  m.say = stale ? "" : (consigne[today] || "");
  const note = (main.plan.x && main.plan.x.length) ? main.plan.x[0] : "";
  if ((main.rest || main.empty) && note && (stale || !m.say)) m.say = note;
  if (!m.say && main.empty) m.say = "Le prochain plan arrive dimanche à 18 h.";
  else if (!m.say && main.rest) m.say = "Journée sans séance. C'est là que le travail des jours précédents se transforme en progrès.";
  else if (!m.say && allDone) m.say = "C'est plié pour aujourd'hui. Note ta sensation dans le carnet — c'est ce que les capteurs ne voient pas.";
  else if (!m.say && note) m.say = note;
  return m;
}

/* ---------- ce qui fait revenir : la série et le cap ---------- */
/* Compte les semaines PLEINES consécutives à 3 séances ou plus, en
   remontant depuis la semaine dernière. Basé sur ce qui a été réellement
   enregistré : une série qu'on ne peut pas gonfler à la main. */
function streakModel(today, actMap, seuil) {
  const S = seuil || 3;
  const cnt = off => weekDays(today, off).reduce((n, k) => n + ((actMap[k] || []).length), 0);
  let weeks = 0;
  for (let i = 1; i <= 8; i++) { if (cnt(-i) >= S) weeks++; else break; }
  const now = cnt(0), reste = Math.max(0, S - now);
  const sea = n => n + (n > 1 ? " séances" : " séance");
  let phrase;
  if (now >= S && weeks > 0) phrase = (weeks + 1) + " semaines d'affilée à " + S + " séances ou plus. Ne casse pas ça.";
  else if (now >= S) phrase = "Objectif de la semaine atteint. La série commence maintenant.";
  else if (weeks >= 2) phrase = weeks + " semaines d'affilée tenues. Il t'en manque " + sea(reste) + " pour garder la série.";
  else if (weeks === 1) phrase = "La semaine dernière était bonne. Encore " + sea(reste) + " pour enchaîner.";
  else if (now > 0) phrase = sea(now) + " cette semaine. Encore " + sea(reste) + " pour lancer une série.";
  else phrase = "Aucune séance cette semaine. La série se relance à la première.";
  return { weeks, now, need: Math.max(0, S - now), seuil: S, phrase };
}

/* Prochaine échéance : test de contrôle, examen médical, objectif daté. */
function capModel(today, meta) {
  const list = [];
  if (meta && meta.next_test) list.push({ d: meta.next_test, l: "Test de contrôle" });
  if (meta && Array.isArray(meta.caps)) meta.caps.forEach(c => { if (c && c.d) list.push({ d: c.d, l: c.l || "Échéance" }); });
  const futurs = list.filter(c => c.d >= today).sort((a, b) => a.d < b.d ? -1 : 1);
  if (!futurs.length) return null;
  const c = futurs[0];
  const j = Math.round((parse(c.d) - parse(today)) / 864e5);
  return { label: c.l, date: c.d, jours: j,
           txt: j === 0 ? "aujourd'hui" : (j === 1 ? "demain" : "dans " + j + " jours") };
}

/* ---------- où tu en es ---------- */
const PACE = { fast:315, slow:365 };   /* 5:15 et 6:05 — une seule source de vérité */

/* Trois chiffres nus, sans littérature : les phrases sont le métier du
   coach, elles vivent dans son mot. Ici on donne l'état, c'est tout.

   ⚠️ On n'utilise PLUS le pourcentage de temps en zones 1-2 de Garmin.
   Ces zones sont estimées sur l'âge (Z2 plafonne à 140) et sous-évaluent
   nettement le seuil réel des coureurs entraînés : une sortie de 15 km tenue à 150 de
   moyenne, trouvée facile, ressortait à « 9 % en zone facile,
   trop rapide ». L'indicateur accusait alors un athlète qui avait fait exactement
   ce qui était demandé. On lui substitue la part d'aérobie faible dans la
   charge du mois, qui ne dépend d'aucune zone estimée. */
function etatModel(S) {
  const rows = [];

  const r = S.ratio;
  if (r == null) rows.push({ k:"Charge", v:"—", u:"", c:"none" });
  else rows.push({ k:"Charge", v:vir(Math.round(r * 10) / 10), u:acwrMot(r), c:acwrCoul(r) });

  const h = S.sleep;
  if (h == null) rows.push({ k:"Sommeil", v:"—", u:"", c:"none" });
  else rows.push({ k:"Sommeil", v:hT(h),
                   u: S.sleepAvg != null ? "moy. " + hT(S.sleepAvg) : "",
                   c: h >= 7 ? "ok" : (h >= 6.5 ? "warn" : "bad") });

  const p = basePct(S);
  if (p == null) rows.push({ k:"Base aérobie", v:"—", u:"", c:"none" });
  else rows.push({ k:"Base aérobie", v:Math.round(p) + " %", u:"de ta charge",
                   c: p >= 45 ? "ok" : (p >= 25 ? "warn" : "bad") });

  return rows;
}

function acwrMot(r) {
  if (r >= 1.5) return "trop élevée";
  if (r >= 1.3) return "élevée";
  if (r < 0.8) return "basse";
  return "optimale";
}
function acwrCoul(r) {
  if (r >= 1.5) return "bad";
  if (r >= 1.3 || r < 0.8) return "warn";
  return "ok";
}
/* Part d'aérobie faible dans la charge du mois. Indépendante des zones
   estimées : c'est Garmin qui classe chaque minute d'effort. */
function basePct(S) {
  const lo = S.low, hi = S.high, an = S.ana;
  if (lo == null || hi == null) return null;
  const tot = lo + hi + (an || 0);
  return tot > 0 ? lo / tot * 100 : null;
}

/* Une seule ligne de trajectoire, celle qui a le plus bougé cette semaine.
   Trois chips en même temps, c'était trois fois trop. */
function trajectoire(S) {
  const c = [];
  if (S.ratio != null && S.ratio7 != null && Math.abs(S.ratio7 - S.ratio) >= 0.3)
    c.push({ poids: Math.abs(S.ratio7 - S.ratio) * 3,
             txt: "Charge : " + vir(S.ratio7) + " il y a une semaine, " + vir(Math.round(S.ratio*10)/10) + " aujourd'hui",
             c: Math.abs(S.ratio - 1.05) < Math.abs(S.ratio7 - 1.05) ? "ok" : "bad" });
  const p = basePct(S), p7 = basePct({ low:S.low7, high:S.high7, ana:S.ana7 });
  if (p != null && p7 != null && Math.abs(p - p7) >= 4)
    c.push({ poids: Math.abs(p - p7) / 4,
             txt: "Base aérobie : " + Math.round(p7) + " % → " + Math.round(p) + " % en une semaine",
             c: p > p7 ? "ok" : "bad" });
  if (S.sleepAvg != null && S.sleepAvgPrev != null && Math.abs(S.sleepAvg - S.sleepAvgPrev) >= 0.25)
    c.push({ poids: Math.abs(S.sleepAvg - S.sleepAvgPrev) * 2,
             txt: "Sommeil moyen : " + hT(S.sleepAvgPrev) + " → " + hT(S.sleepAvg),
             c: S.sleepAvg > S.sleepAvgPrev ? "ok" : "bad" });
  if (!c.length) return null;
  c.sort((a, b) => b.poids - a.poids);
  return c[0];
}

/* ---------- extraction des blocs Drive ---------- */

/* Google Docs DEVINE l'encodage quand on lui envoie du texte brut. Sur un
   document court, il manque de signal, choisit Latin-1, et lit l'UTF-8 de
   travers : « protéines » devient « protÃ©ines », « — » devient « â€" ».
   Les tâches déclarent maintenant charset=utf-8, mais les documents publiés
   avant cette correction restent abîmés : on les répare à la lecture.
   Le décodage strict sert de garde-fou — un texte français sain n'est pas
   de l'UTF-8 valide une fois relu octet par octet, donc il lève et on le
   rend intact. */
/* Google lit en Windows-1252, PAS en Latin-1 : les octets 0x80 à 0x9F y
   deviennent des caractères AU-DESSUS de U+00FF — un « — » cassé donne
   « â€\u201d », dont le « € » vaut U+20AC. Sans cette table, la réparation
   abandonne précisément sur les tirets et les apostrophes typographiques. */
const CP1252 = {
  0x20AC:0x80, 0x201A:0x82, 0x0192:0x83, 0x201E:0x84, 0x2026:0x85, 0x2020:0x86,
  0x2021:0x87, 0x02C6:0x88, 0x2030:0x89, 0x0160:0x8A, 0x2039:0x8B, 0x0152:0x8C,
  0x017D:0x8E, 0x2018:0x91, 0x2019:0x92, 0x201C:0x93, 0x201D:0x94, 0x2022:0x95,
  0x2013:0x96, 0x2014:0x97, 0x02DC:0x98, 0x2122:0x99, 0x0161:0x9A, 0x203A:0x9B,
  0x0153:0x9C, 0x017E:0x9E, 0x0178:0x9F };

const MOJI = /\u00c3[\u0080-\u00bf]|\u00e2\u20ac|\u00c2[\u00a0-\u00bf]/;

function demojibake(s) {
  const t = String(s);
  if (!MOJI.test(t)) return t;
  try {
    const b = new Uint8Array(t.length);
    for (let i = 0; i < t.length; i++) {
      let c = t.charCodeAt(i);
      if (c > 255) c = CP1252[c];
      if (c == null) return t;     /* vrai caractère non latin : on ne touche à rien */
      b[i] = c;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch (e) { return t }
}

const unmd = s => String(s).replace(/\\([\\`*_{}\[\]()#+\-.!<>|~"'])/g, "$1");
const unsmart = s => unmd(s).replace(/[""„]/g, '"').replace(/['']/g, "'");
function between(txt, a, b) {
  const t = unmd(txt), i = t.indexOf(a);
  if (i < 0) return null;
  const j = t.indexOf(b, i + a.length);
  if (j < 0) return null;
  return t.slice(i + a.length, j);
}
/* La synthèse du matin. Ancien format : on récupère le premier paragraphe
   du bloc POINT_HTML, débarrassé de ses balises. */
function synthese(txt) {
  const direct = between(txt, "SYNTHESE_START", "SYNTHESE_END");
  if (direct && direct.trim()) return direct.replace(/\s+/g, " ").trim();
  const html = between(txt, "POINT_HTML_START", "POINT_HTML_END");
  if (!html) return null;
  const first = (html.match(/<p>([\s\S]*?)<\/p>/) || [])[1];
  if (!first) return null;
  const plain = first.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (plain.length <= 190) return plain;
  /* on coupe à une fin de PHRASE, jamais au milieu d'un mot : « Il… » en
     bout de ligne donne l'impression que l'application est cassée. */
  const stop = plain.slice(0, 190).lastIndexOf(". ");
  if (stop > 60) return plain.slice(0, stop + 1);
  return plain.slice(0, 187).replace(/[\s,;:—-]+\S*$/, "") + "…";
}

/* ---------- utilitaires ---------- */
function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function parse(s) { const p = String(s).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function fmt1(v) { return (Math.round(v * 10) / 10).toFixed(1).replace(".", ","); }
function vir(v) { return String(v).replace(".", ","); }
function paceTxt(s) { return Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0"); }
function hT(h) { return h != null ? Math.floor(h) + "h" + String(Math.round((h % 1) * 60)).padStart(2, "0") : "–"; }
function kmOf(s) { return parseFloat(String(s || "").replace(",", ".")) || 0; }


/* ==========================================================================
   FORMULES DE SÉANCE — v12
   Une séance n'est plus un titre : c'est une suite d'étapes exécutables.
   Le même objet sert trois consommateurs : l'écran de détail, l'export
   Garmin, et le calendrier (qui n'en lit que l'en-tête).
   ========================================================================== */

/* Familles — la couleur vient de la famille, pas du sport.
   Aucun violet : demande explicite de l'utilisateur, 22 août. */
const FAM = {
  facile:   { l:"Endurance fondamentale", a:"#22C55E", b:"#86EFAC", sp:"course" },
  endur:    { l:"Sortie longue",  a:"#0EA5E9", b:"#38BDF8", sp:"course" },
  recup:    { l:"Récupération",   a:"#2DD4BF", b:"#5EEAD4", sp:"course" },
  tempo:    { l:"Seuil",          a:"#F59E0B", b:"#FBBF24", sp:"course" },
  vma:      { l:"Fractionné",     a:"#EA580C", b:"#FB923C", sp:"course" },
  cotes:    { l:"Côtes",          a:"#B45309", b:"#D97706", sp:"course" },
  compet:   { l:"Compétition",    a:"#F97316", b:"#FDBA74", sp:"course" },
  foot:     { l:"Football",       a:"#0F766E", b:"#14B8A6", sp:"foot"   },
  renfo:    { l:"Renforcement",   a:"#475569", b:"#64748B", sp:"renfo"  },
  velo:     { l:"Vélo",           a:"#0E7490", b:"#06B6D4", sp:"velo"   },
  nage:     { l:"Natation",       a:"#0284C7", b:"#7DD3FC", sp:"nage"   },
  marche:   { l:"Marche",         a:"#65803B", b:"#A3A375", sp:"marche" },
  repos:    { l:"Repos",          a:"#39414C", b:"#4B5563", sp:"repos"  }
};
const FA = f => FAM[f] || FAM.facile;

/* Le sport, comme sur Strava : un nom, une icône (dessinée pour l'application). */
const NOM_SPORT = {
  course:{ l:"Course à pied" }, velo:{ l:"Vélo" }, nage:{ l:"Natation" }, renfo:{ l:"Renforcement" },
  foot:{ l:"Football" }, marche:{ l:"Marche" }, repos:{ l:"Repos" }
};
const ICO_SPORT = {
  course:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="14.5" cy="4.2" r="1.9"/><path d="M7.5 21l3-5.2 3.2 2.4V22"/><path d="M5 11.2l3.4-3.1 4.3.4 2.3 3.2 3.3 1"/><path d="M12.7 8.5l-2.2 7.3"/></svg>',
  velo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="16.5" r="3.7"/><circle cx="18.5" cy="16.5" r="3.7"/><path d="M5.5 16.5l4-7.5h6.2l2.8 7.5M9.5 9l3 7.5h-7M8.3 6.4h3"/></svg>',
  nage:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="17.5" cy="7" r="1.9"/><path d="M4 11.5l5.5-2.6 3.2 2.8M2.5 16.5c1.6 0 1.6-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3 1.2M2.5 20.5c1.6 0 1.6-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3 1.2"/></svg>',
  renfo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12h10"/><rect x="3.5" y="8" width="3.5" height="8" rx="1"/><rect x="17" y="8" width="3.5" height="8" rx="1"/><path d="M2 10.5v3M22 10.5v3"/></svg>',
  foot:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.6l3.7 2.7-1.4 4.4H9.7l-1.4-4.4z"/><path d="M12 7.6V3.2M15.7 10.3l4.2-1.4M14.3 14.7l2.6 3.6M9.7 14.7l-2.6 3.6M8.3 10.3L4.1 8.9"/></svg>',
  marche:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4.2" r="1.9"/><path d="M9.5 22l2-6.5 2.5 2.5V22"/><path d="M8.5 12.5l1.8-4.3h3.2l1.8 3.6 2.2.8"/><path d="M11.5 15.5l1.6-7"/></svg>',
  repos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z"/></svg>'
};
const sportDe = f => FA(f).sp;
const icoSport = f => ICO_SPORT[sportDe(f)] || ICO_SPORT.course;
const nomSport = f => (NOM_SPORT[sportDe(f)] || NOM_SPORT.course).l;
/* Un nom de séance que tout le monde comprend (« Endurance fondamentale », pas « Aérobie
   faible »). Le titre écrit dans le plan reste la clé des retours : on ne l'affiche que traduit. */
function nomSeance(t) {
  const brut = String(t || "");
  if (/v[ée]lo|natation|\bnage\b/i.test(brut)) return brut;      /* vélo et natation : déjà nommés par discipline */
  return brut
    .replace(/a[ée]robie faible/gi, "Endurance fondamentale")
    .replace(/^tempo\b/i, "Seuil")
    .replace(/^endurance(?!\s+fondamentale)(?=\s)/i, "Sortie longue")
    .replace(/^course\s*·\s*/i, "Compétition · ")
    .replace(/(\d+)\s*LD\b/g, (m, n) => n + " ligne" + (+n > 1 ? "s" : "") + " droite" + (+n > 1 ? "s" : ""));
}

/* Allures de référence, en secondes par kilomètre : celles de l'athlète, OBSERVÉES sur
   ses sorties (reglages/athlete.json, « allures »), posées au démarrage par
   reglerAllures(). Les valeurs ci-dessous ne servent que si rien n'est réglé.
   Une seule source de vérité : ne jamais réécrire une allure en dur ailleurs. */
const ALL = { recup:400, facile:380, endur:360, tempo:277, vma:245 };
function reglerAllures(a) {
  if (!a || typeof a !== "object") return;
  for (const k of Object.keys(ALL)) if (Number.isFinite(a[k]) && a[k] >= 150 && a[k] <= 720) ALL[k] = a[k];
  if (Number.isFinite(a.rapide) && a.rapide >= 150 && a.rapide <= 720) PACE.fast = a.rapide;
}

/* Distance d'une séance en durée. Toujours affichée : « il raisonne en
   kilomètres » (profil). Arrondie au dixième, virgule française. */
/* Durée lisible : 45 → « 45 min », 66 → « 1h06 ». Jamais « 66 min » au-delà
   d'une heure, il lit ça sur une montre en courant. */
function dureeTxt(min) {
  min = Math.round(min);
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60), m = min % 60;
  return m ? h + "h" + String(m).padStart(2, "0") : h + " h";
}

function kmPour(minutes, secParKm) { return Math.round(minutes * 60 / secParKm * 10) / 10; }
function kmTxt(km) { return String(Math.round(km * 10) / 10).replace(".", ",") + " km"; }

/* Une étape porte deux couches :
   - la couche humaine : t (titre) et c (consigne), lues sur l'écran de détail ;
   - la couche machine : k (nature), fin (condition d'arrêt), cible (consigne
     chiffrée), lues par la montre.
   Elles ne se déduisent JAMAIS l'une de l'autre : analyser « 70 min, FC 135–150 »
   à coups d'expressions régulières, c'est la garantie d'envoyer un jour une séance
   fausse sur sa montre. */

const ECH = "echauf", COR = "corps", CAL = "calme";
const tps = v => ({ type:"temps", v });          /* secondes */
const dist = v => ({ type:"distance", v });      /* mètres   */
const fc = (lo, hi) => ({ type:"fc", lo, hi });  /* battements par minute */
const all = (lo, hi) => ({ type:"allure", lo, hi }); /* secondes par kilomètre */

const LIB = {

  facile(min, opt) {
    opt = opt || {};
    const km = kmPour(min, ALL.facile);
    return {
      fam:"facile", t:"Aérobie faible " + min + " min", km:String(km).replace(".", ","),
      duree:min + " min",
      pourquoi: opt.pourquoi || "La séance qui construit le moteur. Elle ne se juge pas à l'allure : si le cardio reste bas, elle est réussie, même lente.",
      etapes:[
        { r:ECH, k:"warmup", t:"5 min très lent", c:"Laisse le cardio monter tout seul.", fin:tps(300) },
        { r:COR, k:"interval", t:(min - 10) + " min, FC 130–145", c:"Plafond 145. Si ça monte, tu marches. L'allure ne compte pas.", fin:tps((min - 10) * 60), cible:fc(130, 145) },
        { r:CAL, k:"cooldown", t:"5 min marche", c:"", fin:tps(300) }
      ]
    };
  },

  facileLD(min, n) {
    const km = kmPour(min, ALL.facile);
    return {
      fam:"facile", t:"Aérobie faible + " + n + " LD " + min + " min",
      km:String(km).replace(".", ","), duree:min + " min",
      pourquoi:"Le corps de séance reste facile. Les lignes droites réveillent la foulée sans coûter de fatigue — c'est de la technique, pas de l'intensité.",
      etapes:[
        { r:ECH, k:"warmup", t:"5 min très lent", c:"", fin:tps(300) },
        { r:COR, k:"interval", t:(min - 10) + " min, FC 130–145", c:"Plafond 145.", fin:tps((min - 10) * 60), cible:fc(130, 145) },
        { r:COR, rep:n, pas:[
          { k:"interval", t:"20 s en accélération", c:"Vite mais relâché. Tu ne cherches pas un chrono.", fin:tps(20), cible:all(240, 250) },
          { k:"recovery", t:"40 s marche", c:"", fin:tps(40) }
        ]},
        { r:CAL, k:"cooldown", t:"5 min marche", c:"", fin:tps(300) }
      ]
    };
  },

  endurance(km, plafond) {
    plafond = plafond || 150;
    const min = Math.round(km * ALL.endur / 60);
    return {
      fam:"endur", t:"Endurance " + dureeTxt(min),
      km:String(km).replace(".", ","),
      duree:(min - 5) + " – " + (min + 5) + " min",
      pourquoi:"La sortie qui fait la différence sur la durée. " + plafond + " est un plafond, pas une cible : tu n'as pas de dossard à préparer, rien ne justifie d'aller plus vite.",
      etapes:[
        { r:ECH, k:"warmup", t:"10 min très lent", c:"Laisse le cardio monter tout seul. Ne force sur rien.", fin:tps(600) },
        { r:COR, k:"interval", t:(min - 20) + " min, FC 135–" + plafond, c:plafond + " est un plafond, pas une cible. Si ça monte, tu marches.", fin:tps((min - 20) * 60), cible:fc(135, plafond) },
        { r:CAL, k:"cooldown", t:"10 min marche", c:"Puis mange dans l'heure. Protéines.", fin:tps(600) }
      ]
    };
  },

  recup(min) {
    const km = kmPour(min, ALL.recup);
    return {
      fam:"recup", t:"Récupération " + min + " min", km:String(km).replace(".", ","),
      duree:min + " min",
      pourquoi:"Elle n'entraîne rien et c'est le but : faire circuler sans ajouter de charge. Trop vite, elle devient une séance et perd son intérêt.",
      etapes:[ { r:COR, k:"interval", t:min + " min, FC sous 135", c:"Volontairement lent. Si tu doutes, ralentis.", fin:tps(min * 60), cible:fc(110, 135) } ]
    };
  },

  tempo(n, min) {
    const kmBloc = n * min * 60 / ALL.tempo;
    const km = Math.round((kmBloc + 4.5) * 10) / 10;
    return {
      fam:"tempo", t:"Tempo " + n + "×" + min + " min", km:String(km).replace(".", ","),
      duree:(n * min + n * 2 + 25) + " min environ",
      pourquoi:"Le seuil, c'est l'allure que tu tiendrais une heure en course. Confortablement dur, jamais au bord de la rupture. Si tu finis cassé, c'était trop vite.",
      etapes:[
        { r:ECH, k:"warmup", t:"2 km très lent", c:"Pas plus vite que 6:00 /km", fin:dist(2000) },
        { r:COR, rep:n, pas:[
          { k:"interval", t:min + " min à 4:37 /km", c:"Fourchette 4:35 – 4:40. Régulier du début à la fin.", fin:tps(min * 60), cible:all(275, 280) },
          { k:"recovery", t:"2 min trot très lent", c:"", fin:tps(120) }
        ]},
        { r:CAL, k:"cooldown", t:"2 km très lent", c:"Ou plus lent encore.", fin:dist(2000) }
      ]
    };
  },

  vma(n, m) {
    const km = Math.round((n * m / 1000 + n * 0.15 + 3.5) * 10) / 10;
    const tour = Math.round(m * ALL.vma / 1000);
    return {
      fam:"vma", t:"Fractionné " + n + "×" + m + " m", km:String(km).replace(".", ","),
      duree:(40 + Math.round(n * 1.2)) + " min environ",
      pourquoi:"4:05 vient de ta VMA estimée, pas d'un barème. Si le milieu de séance part en vrille, tu t'arrêtes avant la fin : c'est la qualité qui compte, pas le compte.",
      etapes:[
        { r:ECH, k:"warmup", t:"2 km très lent", c:"Pas plus vite que 6:00 /km", fin:dist(2000) },
        { r:ECH, rep:4, pas:[
          { k:"interval", t:"20 s ligne droite", c:"Réveiller la foulée.", fin:tps(20), cible:all(240, 250) },
          { k:"recovery", t:"40 s marche", c:"", fin:tps(40) }
        ]},
        { r:COR, rep:n, pas:[
          { k:"interval", t:m + " m à 4:05 /km", c:"Fourchette 4:00 – 4:10. Soit " + Math.floor(tour / 60) + ":" + String(tour % 60).padStart(2, "0") + " par répétition.", fin:dist(m), cible:all(240, 250) },
          { k:"recovery", t:"60 s marche", c:"Marche, pas trot. La récup doit être vraie.", fin:tps(60) }
        ]},
        { r:CAL, k:"cooldown", t:"1,5 km très lent", c:"Ou plus lent encore.", fin:dist(1500) }
      ]
    };
  },

  gainage(tours) {
    return {
      fam:"renfo", t:"Gainage circuit · " + tours + " tours", km:"",
      duree:(tours * 4 + 1) + " min", sport:"renfo",
      pourquoi:"Sangle abdominale : c'est ton objectif n°2. Court, mais non négociable.",
      etapes:[
        { r:COR, rep:tours, pas:[
          { k:"interval", t:"Planche coudes 45 s", c:"Bassin bas, fessiers serrés.", fin:tps(45) },
          { k:"interval", t:"Planche latérale droite 30 s", c:"", fin:tps(30) },
          { k:"interval", t:"Planche latérale gauche 30 s", c:"", fin:tps(30) },
          { k:"interval", t:"Pont fessier × 12", c:"Montée en 1 s, 2 s en haut.", fin:{ type:"reps", v:12 } },
          { k:"interval", t:"Mountain climber × 20", c:"Bassin stable, pas de rebond.", fin:{ type:"reps", v:20 } },
          { k:"rest", t:"40 s de récupération", c:"", fin:tps(40) }
        ]}
      ]
    };
  },

  foot() {
    return {
      fam:"foot", t:"Football · 1 h", km:"", duree:"1 h", sport:"foot", pasDeMontre:true,
      pourquoi:"Ça compte comme une séance à part entière : accélérations, changements d'appui, une heure de cardio en dents de scie. Le lendemain est un jour facile, pas un jour de plus.",
      etapes:[ { r:COR, k:"interval", t:"Match", c:"Échauffe-toi avant. Les claquages arrivent aux gens qui entrent froid.", fin:tps(3600) } ]
    };
  },

  repos(note) {
    return {
      fam:"repos", t:"Repos", km:"", duree:"", sport:"repos", pasDeMontre:true,
      pourquoi: note || "Repos veut dire ne rien faire. Pas de gainage, pas de « petite sortie ». C'est là que le corps encaisse le travail de la semaine.",
      etapes:[]
    };
  }
};

/* ==========================================================================
   EXPORT GARMIN
   Traduction mécanique d'une formule vers le DTO que Garmin Connect accepte.
   Rien n'est deviné depuis le texte : on ne lit que la couche machine.
   ========================================================================== */

const G_SPORT = { course:{ id:1, k:"running" }, renfo:{ id:5, k:"strength_training" },
                  velo:{ id:2, k:"cycling" }, marche:{ id:11, k:"walking" } };
const G_PAS   = { warmup:1, cooldown:2, interval:3, recovery:4, rest:5, repeat:6 };
const G_FIN   = { temps:{ id:2, k:"time" }, distance:{ id:3, k:"distance" },
                  iterations:{ id:7, k:"iterations" }, bouton:{ id:1, k:"lap.button" },
                  reps:{ id:10, k:"reps" } };

/* Allure en secondes par kilomètre → vitesse en mètres par seconde.
   Garmin range les vitesses de la plus lente à la plus rapide : une allure
   BASSE (rapide) donne la vitesse HAUTE. L'inversion est le piège classique. */
const msDe = secParKm => Math.round(1000 / secParKm * 1e6) / 1e6;

function cibleDTO(c) {
  if (!c) return { targetType:{ workoutTargetTypeId:1, workoutTargetTypeKey:"no.target" } };
  if (c.type === "fc") {
    return { targetType:{ workoutTargetTypeId:4, workoutTargetTypeKey:"heart.rate.zone" },
             targetValueOne:c.lo, targetValueTwo:c.hi };
  }
  if (c.type === "allure") {
    /* lo et hi sont des allures : lo est la plus RAPIDE, donc la vitesse la plus haute. */
    return { targetType:{ workoutTargetTypeId:6, workoutTargetTypeKey:"pace.zone" },
             targetValueOne:msDe(c.hi), targetValueTwo:msDe(c.lo) };
  }
  return { targetType:{ workoutTargetTypeId:1, workoutTargetTypeKey:"no.target" } };
}

function finDTO(f) {
  const g = G_FIN[(f && f.type) || "bouton"] || G_FIN.bouton;
  return { endCondition:{ conditionTypeId:g.id, conditionTypeKey:g.k },
           endConditionValue:(f && f.v != null) ? f.v : null };
}

function pasDTO(p, ordre) {
  return Object.assign({
    type:"ExecutableStepDTO", stepOrder:ordre,
    stepType:{ stepTypeId:G_PAS[p.k] || 3, stepTypeKey:p.k || "interval" }
  }, finDTO(p.fin), cibleDTO(p.cible));
}

/* Une séance → un objet prêt pour upload_workout.
   Renvoie null si la séance n'a rien à envoyer sur la montre : repos, football.
   Ne jamais forcer : une séance vide envoyée à Garmin crée un déchet à supprimer. */
function garminDTO(s) {
  if (!s || s.pasDeMontre || !aFormule(s)) return null;
  const sp = G_SPORT[s.sport || FA(famOf(s)).sp] || G_SPORT.course;
  const pas = [];
  let n = 0;
  for (const b of s.etapes) {
    if (b.rep && b.pas) {
      const dedans = b.pas.map(p => pasDTO(p, ++n));
      pas.push({ type:"RepeatGroupDTO", stepOrder:++n,
                 stepType:{ stepTypeId:6, stepTypeKey:"repeat" },
                 numberOfIterations:b.rep, smartRepeat:false,
                 endCondition:{ conditionTypeId:7, conditionTypeKey:"iterations" },
                 endConditionValue:b.rep, workoutSteps:dedans });
    } else {
      pas.push(pasDTO(b, ++n));
    }
  }
  return {
    workoutName: titreComplet(s),
    sportType:{ sportTypeId:sp.id, sportTypeKey:sp.k },
    workoutSegments:[ { segmentOrder:1, sportType:{ sportTypeId:sp.id, sportTypeKey:sp.k },
                        workoutSteps:pas } ]
  };
}

/* ---------- lecture ---------- */

/* Devine la famille d'une séance qui n'en déclare pas — plans d'avant la v12.
   Le titre reste la seule source : on ne devine jamais depuis le résultat. */
function famFromTitle(t, type) {
  const s = String(t || "");
  if (/^repos/i.test(s)) return "repos";
  if (/gainage|renfor|muscu|abdo|core\b/i.test(s)) return "renfo";
  if (/football|\bfoot\b|\bmatch\b/i.test(s)) return "foot";
  if (/v[ée]lo|cyclis|home ?trainer/i.test(s)) return "velo";
  if (/natation|\bnage\b|piscine|crawl/i.test(s)) return "nage";
  if (/marche|randonn/i.test(s)) return "marche";
  if (/comp[ée]tition|dossard|^course\s*·/i.test(s)) return "compet";
  if (/fractionn|\bvma\b|\d+\s*[x×]\s*\d+\s*m\b/i.test(s)) return "vma";
  if (/tempo|seuil/i.test(s)) return "tempo";
  if (/c[ôo]tes?\b/i.test(s)) return "cotes";
  if (/r[ée]cup/i.test(s)) return "recup";
  if (/fondamentale/i.test(s)) return "facile";
  if (/endurance|sortie longue/i.test(s)) return "endur";
  if (/a[ée]robie|footing|course|running/i.test(s)) return "facile";
  if (type && FAM[type]) return type;
  return "facile";
}

/* Check-in du matin → signaux pour le feu du jour. Partagé par la page (réaction
   immédiate) et par la synthèse du coach (analyses.js) : une seule règle, deux usages.
   Les zones surveillées (et leur consigne propre) arrivent en paramètre : elles
   décrivent sa santé, elles voyagent chiffrées dans D.checkin, jamais en clair ici. */
function reglesCheckin(ck, zones) {
  const out = [];
  if (!ck) return out;
  const z = (zones || []).find(x => x.v === ck.zone) || {};
  const ou = z.nom ? " " + z.nom : "";
  if (ck.alerte === "douleur")
    out.push({ niveau:"rouge", source:"checkin", texte:"Douleur" + (ou || " signalée") + " ce matin : pas de séance aujourd'hui, fais-toi examiner." });
  else if (ck.alerte === "raideur")
    out.push({ niveau:"orange", source:"checkin", texte:z.raideur || "Raideur" + (ou || " signalée") + " ce matin : échauffement long, et tu t'arrêtes au moindre doute." });
  if (ck.forme && ck.forme <= 2) out.push({ niveau:"orange", source:"checkin", texte:"Forme " + ck.forme + "/5 ce matin : version allégée." });
  if (ck.jambes === "lourdes") out.push({ niveau:"orange", source:"checkin", texte:"Jambes lourdes ce matin : version allégée." });
  return out;
}

/* Retours de séance d'hier et d'aujourd'hui → signaux pour le feu du jour.
   Même partage que reglesCheckin : la page réagit tout de suite, la synthèse
   du coach applique exactement la même règle. Le retour le plus récent d'une
   séance remplace les précédents. */
function reglesRetours(retours, today) {
  const h = parse(today); h.setDate(h.getDate() - 1);
  const hier = iso(h), der = {};
  for (const r of retours || []) if (r && r.type === "seance" && r.d >= hier && r.d <= today) der[r.d + "|" + (r.t || "")] = r;
  const out = [];
  for (const r of Object.values(der)) {
    const q = "« " + (r.t || "ta séance") + " »" + (r.d === today ? "" : " hier");
    if (r.douleur === "forte") out.push({ id:"retour_douleur", niveau:"rouge", texte:"Douleur forte après " + q + " : pas de séance avant d'avoir consulté." });
    else if (r.raison === "douleur") out.push({ id:"retour_douleur", niveau:"orange", texte:"Séance " + q + " écourtée ou annulée pour douleur : si elle est encore là, pas de séance." });
    else if (r.douleur === "légère") out.push({ id:"retour_douleur", niveau:"orange", texte:"Douleur légère après " + q + " : échauffement long, et arrêt si elle revient à l'effort." });
    if (r.sensation && r.sensation <= 4) out.push({ id:"retour_sensation", niveau:"orange", texte:"Sensation " + r.sensation + "/10 après " + q + " : version allégée." });
  }
  return out;
}

function famOf(s) {
  if (!s) return "facile";
  if (s.fam && FAM[s.fam]) return s.fam;
  return famFromTitle(s.t, s.type);
}

/* Aplatit les étapes pour l'affichage : un bloc répété devient une section
   portant son compteur. Renvoie toujours un tableau, jamais null. */
function etapesVue(s) {
  const e = (s && s.etapes) || [];
  const out = [];
  let n = 0;
  for (const b of e) {
    if (b.rep && b.pas) {
      out.push({ bloc:true, r:b.r || COR, rep:b.rep,
                 pas:b.pas.map(p => ({ n:++n, t:p.t, c:p.c || "" })) });
    } else {
      out.push({ bloc:false, r:b.r || COR, n:++n, t:b.t, c:b.c || "" });
    }
  }
  return out;
}

/* Une séance a-t-elle une formule exploitable ? Les anciennes n'en ont pas :
   l'écran de détail doit alors se rabattre sur le titre et la consigne,
   sans jamais inventer d'étapes. */
function aFormule(s) { return !!(s && Array.isArray(s.etapes) && s.etapes.length); }

/* Nombre total de répétitions effectives — sert au contrôle de cohérence. */
function nbPas(s) {
  return ((s && s.etapes) || []).reduce((n, b) => n + (b.rep && b.pas ? b.rep * b.pas.length : 1), 0);
}

/* Titre complet, tel qu'il part sur la montre et sur Strava.
   Convention du profil : <Travail> <volume> · <distance>. Le séparateur
   est « · », jamais un tiret. Sans distance (renfo, foot), on s'arrête au volume. */
function titreComplet(s) {
  if (!s || !s.t) return "";
  if (!s.km) return s.t;
  const d = String(s.km).replace(".", ",");
  /* Filet : si le titre porte déjà la distance, ne pas la répéter.
     « Endurance 11 km · 11 km » est passé en production une fois. Plus jamais. */
  if (new RegExp("\\b" + d.replace(",", "[.,]") + "\\s*km\\b").test(s.t)) return s.t;
  return s.t + " · " + d + " km";
}

if (typeof module !== "undefined") module.exports = {
  TYPES, TY, SPORT, kindOf, typeFromTitle, normSession, buildPlan, buildActs, matchDay, splitFusion,
  dayRows, subLine, weekDays, weekStats, heroModel, etatModel, trajectoire, basePct, doneKey,
  streakModel, capModel, consigneStale,
  between, synthese, unmd, unsmart, demojibake, iso, parse, fmt1, paceTxt, hT, kmOf, PACE,
  FAM, FA, NOM_SPORT, ICO_SPORT, sportDe, icoSport, nomSport, nomSeance, ALL, reglerAllures, LIB, kmPour, kmTxt, famFromTitle, famOf, etapesVue, aFormule, nbPas, titreComplet,
  garminDTO, msDe, dureeTxt, G_SPORT, G_PAS, G_FIN, tps, dist, fc, all, reglesCheckin, reglesRetours
};
