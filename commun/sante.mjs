/* Données d'Apple Santé envoyées par l'iPhone (raccourci quotidien, ou l'app
   « Health Auto Export ») : Apple Watch, Oura, Whoop, Polar, Coros… tout ce qui
   écrit dans Santé. Ce module les VALIDE et les NORMALISE ; il tourne dans la fonction
   Cloudflare (/api/sante) et dans la collecte (Node). Testé par : node commun/banc-sante.mjs

   Format simple (celui du raccourci), une journée :
     { "date":"2026-10-11", "sommeil_min":432, "coucher":"2026-10-10T23:05:00+02:00",
       "lever":"2026-10-11T06:47:00+02:00", "fc_repos":52, "vfc_ms":48,
       "seances":[{ "type":"course", "debut":"2026-10-10T18:30:00+02:00", "duree_s":1800,
                    "distance_m":5000, "fc_moy":145 }] }
   Les nombres peuvent arriver en texte (« 432 », « 7,2 ») : un raccourci écrit souvent ainsi.
   Format « Health Auto Export » (JSON, export REST) : { data:{ metrics:[…], workouts:[…] } },
   lu au mieux : sleep_analysis, resting_heart_rate, heart_rate_variability, workouts.

   Sortie normalisée : liste de jours
     { date, sommeil_min, coucher, lever, fc_repos, vfc_ms, seances:[{ id, type, start_time,
       duration_seconds, distance_meters, avg_hr_bpm }] }   (séances au format Garmin) */

const nombre = v => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") { const n = parseFloat(v.replace(",", ".").replace(/[^\d.+-]/g, "")); return Number.isFinite(n) ? n : null; }
  if (v && typeof v === "object" && "qty" in v) return nombre(v.qty);
  return null;
};
const borne = (v, min, max) => v != null && v >= min && v <= max ? v : null;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
/* Une date ISO ou « 2026-10-11 06:47:00 +0200 » (Health Auto Export) → ISO lisible par Date. */
function instant(v) {
  if (typeof v !== "string" || v.length > 40) return null;
  let s = v.trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(:\d{2})?)\s*([+-]\d{2}):?(\d{2})$/, "$1T$2$4:$5");
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString();
}
/* Types de séance de Santé (ou du raccourci) → types Garmin (analyses.js : G_TYPE). */
const TYPES = [
  [/course|run|running|jogging/i, "running"], [/v[ée]lo|cycl|bike|ride/i, "cycling"],
  [/nata|swim|piscine/i, "lap_swimming"], [/renfo|strength|muscu|gainage|core|functional|hiit|cross/i, "strength_training"],
  [/yoga/i, "yoga"], [/pilates/i, "pilates"], [/foot|soccer/i, "soccer"],
  [/marche|walk/i, "walking"], [/rando|hik/i, "hiking"], [/rame|rowing/i, "indoor_rowing"]
];
const typeDe = t => { for (const [re, g] of TYPES) if (re.test(String(t || ""))) return g; return "other"; };
const heureLocale = iso => {
  /* « AAAA-MM-JJ HH:MM:SS » à l'heure de Paris, comme les activités Garmin. */
  const d = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone:"Europe/Paris", year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23" }).formatToParts(d).map(x => [x.type, x.value]));
  return p.year + "-" + p.month + "-" + p.day + " " + p.hour + ":" + p.minute + ":" + p.second;
};

function seance(x) {
  if (!x || typeof x !== "object") return null;
  const debut = instant(x.debut || x.start || x.startDate);
  const fin = instant(x.fin || x.end || x.endDate);
  let duree = nombre(x.duree_s != null ? x.duree_s : x.duration);
  if (duree == null && debut && fin) duree = (new Date(fin) - new Date(debut)) / 1000;
  if (!debut || duree == null) return null;
  let dist = nombre(x.distance_m);
  if (dist == null && x.distance != null) {
    const q = nombre(x.distance), u = String((x.distance && x.distance.units) || x.distance_unite || "km").toLowerCase();
    dist = q == null ? null : u.startsWith("mi") ? q * 1609.34 : u === "m" ? q : q * 1000;
  }
  const fc = nombre(x.fc_moy != null ? x.fc_moy : x.avgHeartRate != null ? x.avgHeartRate : x.heartRate && x.heartRate.avg);
  const debutLocal = heureLocale(debut);
  return {
    id:"a" + debut.replace(/\D/g, "").slice(0, 12), type:typeDe(x.type || x.name), start_time:debutLocal,
    duration_seconds:borne(Math.round(duree), 60, 86400), distance_meters:borne(dist, 0, 500000) || 0,
    avg_hr_bpm:borne(fc, 30, 240), source:"apple_sante"
  };
}

/* Format simple → un jour normalisé (ou null si rien d'exploitable). */
function jourSimple(b) {
  const date = typeof b.date === "string" && JOUR.test(b.date) ? b.date : null;
  if (!date) return null;
  const j = {
    date,
    sommeil_min:borne(nombre(b.sommeil_min != null ? b.sommeil_min : b.sommeil_h != null ? nombre(b.sommeil_h) * 60 : null), 0, 1440),
    coucher:instant(b.coucher), lever:instant(b.lever),
    fc_repos:borne(nombre(b.fc_repos), 25, 140), vfc_ms:borne(nombre(b.vfc_ms), 5, 300),
    seances:(Array.isArray(b.seances) ? b.seances : []).slice(0, 20).map(seance).filter(x => x && x.duration_seconds)
  };
  if (j.sommeil_min != null) j.sommeil_min = Math.round(j.sommeil_min);
  return j.sommeil_min != null || j.fc_repos != null || j.vfc_ms != null || j.seances.length ? j : null;
}

/* Format Health Auto Export → jours normalisés. */
function joursHAE(b) {
  const jours = {};
  const J = d => jours[d] = jours[d] || { date:d, sommeil_min:null, coucher:null, lever:null, fc_repos:null, vfc_ms:null, seances:[] };
  const dateDe = v => { const i = instant(v); return i ? heureLocale(i).slice(0, 10) : null; };
  for (const m of (b.data && b.data.metrics) || []) {
    for (const p of (m && m.data) || []) {
      if (m.name === "sleep_analysis") {
        const fin = instant(p.sleepEnd || p.inBedEnd), d = fin ? heureLocale(fin).slice(0, 10) : dateDe(p.date);
        if (!d) continue;
        const h = nombre(p.totalSleep != null ? p.totalSleep : p.asleep);
        if (h != null) J(d).sommeil_min = borne(Math.round(String(m.units || "hr").startsWith("min") ? h : h * 60), 0, 1440);
        J(d).coucher = instant(p.sleepStart || p.inBedStart); J(d).lever = fin;
      } else if (m.name === "resting_heart_rate") { const d = dateDe(p.date); if (d) J(d).fc_repos = borne(nombre(p.qty), 25, 140); }
      else if (m.name === "heart_rate_variability") { const d = dateDe(p.date); if (d) J(d).vfc_ms = borne(nombre(p.qty), 5, 300); }
    }
  }
  for (const w of (b.data && b.data.workouts) || []) {
    const s = seance(w);
    if (s && s.duration_seconds) J(s.start_time.slice(0, 10)).seances.push(s);
  }
  return Object.values(jours);
}

/* Valide un envoi : { ok, jours } ou { ok:false, err }. */
export function lireEnvoi(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return { ok:false, err:"json attendu" };
  let jours;
  if (b.data && (Array.isArray(b.data.metrics) || Array.isArray(b.data.workouts))) jours = joursHAE(b);
  else if (Array.isArray(b.jours)) jours = b.jours.slice(0, 60).map(jourSimple).filter(Boolean);
  else jours = [jourSimple(b)].filter(Boolean);
  jours = jours.filter(j => j && JOUR.test(j.date)).slice(0, 60);
  if (!jours.length) return { ok:false, err:"aucune donnée exploitable (date au format AAAA-MM-JJ ?)" };
  return { ok:true, jours };
}

/* Plusieurs envois pour un même jour : les valeurs les plus récentes gagnent, les
   séances s'additionnent (dédoublonnées par début). */
export function fusionner(jours) {
  const out = {};
  for (const j of jours) {
    const o = out[j.date] = out[j.date] || { date:j.date, sommeil_min:null, coucher:null, lever:null, fc_repos:null, vfc_ms:null, seances:[] };
    for (const k of ["sommeil_min", "coucher", "lever", "fc_repos", "vfc_ms"]) if (j[k] != null) o[k] = j[k];
    for (const s of j.seances || []) if (!o.seances.some(x => x.id === s.id)) o.seances.push(s);
  }
  return Object.values(out).sort((a, b) => a.date < b.date ? -1 : 1);
}
