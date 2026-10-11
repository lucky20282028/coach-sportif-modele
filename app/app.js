/* ==========================================================================
   COACH v2 — rendu
   Les données arrivent toutes cuites dans D (régénérées à chaque collecte et
   à chaque passage du coach). La page ajoute trois choses vivantes :
     - les retours et messages tapés ici, visibles tout de suite ;
     - la détection d'une nouvelle version publiée, qui recharge la page ;
     - le bouton « Actualiser », qui demande une collecte à GitHub.
   Tout ce qui touche au réseau ou au stockage est gardé par typeof : le banc
   d'essai exécute ce fichier sans navigateur.
   ========================================================================== */

const $ = s => document.querySelector(s);
/* Typographie française : espace insécable avant « : ; ? ! % » et après « « », pour
   qu'une ligne ne commence jamais par deux-points sur l'iPhone. */
const fine = h => String(h).replace(/ ([:;?!»%])/g, " $1").replace(/« /g, "« ");
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = fine(h); return e; };
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const avecReseau = typeof fetch !== "undefined";

const JOURS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const JC = ["DIM","LUN","MAR","MER","JEU","VEN","SAM"];
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
/* « 1er septembre », jamais « 1 septembre ». */
const jourN = d => d.getDate() === 1 ? "1er" : String(d.getDate());
function jourLong(k) { const d = parse(k); return JOURS[d.getDay()] + " " + jourN(d) + " " + MOIS[d.getMonth()]; }
const MC = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
function jourCourt(k) { const d = parse(k); return jourN(d) + " " + MC[d.getMonth()]; }
const ecartJ = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const decale = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return iso(d); };

/* L'heure du téléphone, sauf dans le banc d'essai qui la fige. */
const maintenant = () => D.__now ? new Date(D.__now) : new Date();
const AUJ = iso(maintenant());

const I = {
  drapeau:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
  chk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M8 12.3l2.8 2.8L16.2 9.5"/></svg>',
  croix:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9.2"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  rond:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9.2"/></svg>',
  hor:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3 1.8"/></svg>',
  rte:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19c0-3.3 3-3.3 3-6.6S4 9.1 4 5.8"/><path d="M20 5c0 3.3-3 3.3-3 6.6s3 3.3 3 6.6"/></svg>',
  coeur:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  fle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  rep:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  mtr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6V3.5h6V6M9 18v2.5h6V18"/></svg>',
  ferme:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  maj:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  plume:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  jouer:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
  suiv:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 6.2v11.6a.9.9 0 0 0 1.4.75L15 12.8V17a1 1 0 0 0 2 0V7a1 1 0 0 0-2 0v4.2L6.4 5.45A.9.9 0 0 0 5 6.2z"/></svg>',
  prec:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.2v11.6a.9.9 0 0 1-1.4.75L9 12.8V17a1 1 0 0 1-2 0V7a1 1 0 0 1 2 0v4.2l8.6-5.75A.9.9 0 0 1 19 6.2z"/></svg>',
  son:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.3 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  muet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  regle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6.5 8v3M10.5 8v4M14.5 8v3M18.5 8v4"/></svg>'
};

/* ==========================================================================
   1. Stockage local et retours
   ========================================================================== */
const stock = {
  lire(k, d) { try { return typeof localStorage === "undefined" ? d : JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } },
  ecrire(k, v) { try { if (typeof localStorage !== "undefined") localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* Les retours viennent de trois endroits : déjà dans le carnet (D.retours),
   reçus par Netlify mais pas encore recopiés (ATTENTE), et pas encore partis
   faute de réseau (file locale). La page les fusionne pour cocher les séances
   tout de suite. */
let ATTENTE = [];
/* La même saisie vue par deux chemins (carnet, serveur, file locale) n'est comptée
   qu'une fois. Deux saisies différentes dans la même minute (un check-in corrigé
   aussitôt) restent deux saisies : la clé porte aussi leur contenu. */
const cleR = r => [r.type, r.d, r.t || "", r.ecrit || r.recu || "", (r.note || "").slice(0, 40),
  r.fait || "", r.sensation || "", r.douleur || "", r.forme || "", r.jambes || "", r.alerte || "", r.zone || "", r.tour_taille || ""].join("|");
function tousRetours() {
  const vus = new Set(), out = [];
  const pousser = (r, statut) => { if (!r || !r.d) return; const k = cleR(r); if (vus.has(k)) return; vus.add(k); out.push(Object.assign({ statut }, r)); };
  for (const r of D.retours || []) pousser(r, "carnet");
  for (const r of ATTENTE) pousser(r, "recu");
  for (const r of stock.lire("coach-file", [])) pousser(r, "file");
  for (const r of ENVOI) pousser(r, "envoi");
  /* Tri stable : à minute égale, l'ordre d'arrivée décide (le plus récent en dernier). */
  const h = r => String(r.ecrit || r.recu || "");
  return out.sort((a, b) => h(a) < h(b) ? -1 : h(a) > h(b) ? 1 : 0);
}
function retourDe(s) {
  let r = null;
  for (const x of tousRetours()) if (x.type === "seance" && x.d === s.d && x.t === s.t) r = x;
  return r;
}
/* État d'une séance, du point de vue de l'athlète. */
function etatDe(s) {
  if (famOf(s) === "repos") return "repos";
  const r = retourDe(s);
  if (s.fait || (r && r.fait === "fait")) return "fait";
  if (r && r.fait === "en partie") return "partiel";
  if (r && r.fait === "pas fait") return "manque";
  if (s.d < AUJ) return "manque";
  return "afaire";
}

/* ==========================================================================
   2. Profil de séance : la forme de l'effort en barres
   ========================================================================== */
function segments(s) {
  const fam = famOf(s), out = [];
  const allure = fam === "vma" ? 270 : fam === "tempo" ? 320 : 390;
  const ajouter = p => {
    const f = p.fin || {};
    const sec = f.type === "temps" ? f.v : f.type === "distance" ? f.v / 1000 * allure : f.type === "reps" ? f.v * 3 : 45;
    let i;
    if (p.k === "warmup" || p.k === "cooldown") i = .34;
    else if (p.k === "rest" || p.k === "recovery") i = .18;
    else if (p.cible && p.cible.type === "fc") i = Math.min(1, Math.max(.4, (p.cible.hi - 95) / 90));
    else if (p.cible && p.cible.type === "allure") i = .92;
    else i = fam === "renfo" ? .74 : .62;
    out.push({ sec:Math.max(sec || 0, 5), i, fort:i >= .5 });
  };
  for (const b of s.etapes || []) {
    if (b.rep && b.pas) { for (let r = 0; r < b.rep; r++) b.pas.forEach(ajouter); }
    else ajouter(b);
  }
  return out;
}
function profil(s, blanc) {
  const seg = segments(s);
  /* Un seul bloc (un match, une marche) n'a pas de « forme » : on ne dessine rien. */
  if (seg.length < 2) return "";
  const F = FA(famOf(s)), L = 320, H = 60, tot = seg.reduce((a, x) => a + x.sec, 0);
  const gap = seg.length > 24 ? 1 : 2;
  /* L'effort le plus fort touche le haut : c'est la forme qui compte, pas l'échelle. */
  const max = Math.max.apply(null, seg.map(p => p.i));
  let x = 0, g = "";
  for (const p of seg) {
    const w = Math.max(1, p.sec / tot * L - gap), h = Math.max(6, p.i / max * H);
    const c = blanc ? "#FFFFFF" : (p.fort ? F.a : F.b);
    g += '<rect x="' + x.toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) +
         '" rx="2" fill="' + c + '" opacity="' + (p.fort ? 1 : (blanc ? .45 : .55)) + '"/>';
    x += p.sec / tot * L;
  }
  return '<svg class="prof" viewBox="0 0 ' + L + " " + H + '" preserveAspectRatio="none" aria-hidden="true">' + g + "</svg>";
}

/* ==========================================================================
   3. Index du plan, jour choisi
   ========================================================================== */
let PARJOUR = {};
function indexer() {
  PARJOUR = {};
  for (const s of (D.plan || [])) (PARJOUR[s.d] = PARJOUR[s.d] || []).push(s);
}
const duJour = k => PARJOUR[k] || [];
const JOURS_PLAN = () => Object.keys(PARJOUR).sort();
/* Le jour d'ouverture : aujourd'hui pour le téléphone, sauf si la page est
   si vieille qu'elle ne connaît pas ce jour (alors celui des données). */
let SEL = null;
function jourInitial() {
  const k = JOURS_PLAN();
  return k.length && AUJ >= k[0] && AUJ <= decale(k[k.length - 1], 1) ? AUJ : (D.today || AUJ);
}
let VUE = "vJour";

const metaSeance = s => {
  const m = [];
  if (s.duree) m.push('<span>' + I.hor + esc(s.duree) + "</span>");
  if (s.km) m.push('<span>' + I.rte + esc(s.km) + " km</span>");
  const fc = (s.etapes || []).map(b => b.cible || (b.pas || []).map(p => p.cible).find(Boolean)).find(c => c && c.type === "fc");
  if (fc) m.push('<span>' + I.coeur + (fc.lo ? fc.lo + "–" : "≤ ") + fc.hi + "</span>");
  return m.join("");
};
const surMontre = s => (D.montre || []).some(w => w.d === s.d && String(w.n || "").indexOf(s.t) === 0);

/* Allure en secondes par km → « 5:44 ». Arrondie AVANT d'être découpée : jamais « 5:60 ». */
const allureTxt = p => { if (p == null) return "—"; const r = Math.round(p); return Math.floor(r / 60) + ":" + String(r % 60).padStart(2, "0"); };
/* Réglages de l'athlète (reglages/athlete.json, transmis chiffrés) : cibles de la semaine,
   fréquences de référence du moteur (FH, FB : 150 et 140 par défaut), objectifs, appareils. */
const RG = D.reglages || {};
const CIB = Object.assign({ course:2, renfo:1 }, RG.cible), OBJ = RG.objectifs || {}, MAT = RG.materiel || { montre:"ta montre" };
const FH = (RG.fc || [150, 140])[0], FB = (RG.fc || [150, 140])[1];
const pl = (n, mot) => n + " " + mot + (n > 1 ? "s" : "");
const TITRE_REG = "Courir " + CIB.course + " fois par semaine";
const REPRISE = OBJ.reprise || null;
reglerAllures(RG.allures);
/* Les sources de données de l'athlète. Sans réglage (anciennes données) : Garmin et Withings. */
const SRC = RG.sources || { garmin:true, withings:true, strava:"connecteur", apple_sante:false };
const NUIT1 = SRC.garmin ? "Garmin" : null, NUIT2 = SRC.withings ? "Withings" : SRC.apple_sante ? "Apple Santé" : null;
const NOMS_SOURCES = [SRC.garmin && "Garmin", SRC.withings && "Withings", SRC.strava === "api" && "Strava", SRC.apple_sante && "Apple Santé"].filter(Boolean);
/* L'analyse km par km d'une course faite (fichier de la montre), s'il y en a une. */
const analyseDe = s => s && s.gid != null && D.sorties ? D.sorties[s.gid] || null : null;
function ligneAnalyse(a) {
  const b = [];
  if (a.plafond && a.pctSous != null) b.push("Plafond " + a.plafond + " tenu " + a.pctSous + " % du temps");
  if (a.a150) b.push("à " + FH + " bpm : " + allureTxt(a.a150) + " /km");
  else if (a.a140) b.push("à " + FB + " bpm : " + allureTxt(a.a140) + " /km");
  return b.length ? cap(b.join(" · ")) : "";
}
function elAnalyse(s) {
  const a = analyseDe(s), t = a ? ligneAnalyse(a) : "";
  if (!t) return null;
  return el("div", "ana" + (a.plafond && a.pctSous != null ? (a.pctSous >= 90 ? " ok" : " warn") : ""), esc(t));
}
/* Le gainage guidé : pour une séance de renforcement qui a des étapes et n'est pas déjà faite. */
const guidable = s => famOf(s) === "renfo" && aFormule(s) && etatDe(s) !== "fait";

function puceEtat(s, e) {
  if (e === "fait") return '<span class="etat ok">' + I.chk + "Faite</span>";
  if (e === "partiel") return '<span class="etat ok">' + I.chk + "En partie</span>";
  if (e === "manque") return '<span class="etat ko">' + I.croix + (s.d < AUJ ? "Pas faite" : "Annulée") + "</span>";
  if (surMontre(s)) return '<span class="etat mtr">' + I.mtr + "Sur ta montre</span>";
  return "";
}

/* ---------- carte de séance ---------- */
function carte(s) {
  const fam = famOf(s), F = FA(fam), e = etatDe(s);
  if (fam === "repos") {
    const c = el("div", "carte repos");
    c.appendChild(el("div", "ctit", "Repos"));
    if (s.pourquoi) c.appendChild(el("p", "", esc(s.pourquoi)));
    return c;
  }
  const c = el("div", "carte");
  c.style.setProperty("--fa", F.a);
  c.appendChild(el("div", "ctop", '<span class="pill sport">' + icoSport(fam) + esc(nomSport(fam)) + (s.horsPlan ? " · hors plan" : "") + "</span>" + (s.prov ? '<span class="etat prov">À confirmer</span>' : puceEtat(s, e))));
  c.appendChild(el("div", "ctit", esc(nomSeance(s.t))));
  const m = metaSeance(s);
  if (m) c.appendChild(el("div", "cmeta", m));
  if (e !== "fait" || !(s.reel && s.reel.length)) { const p = profil(s); if (p) c.appendChild(el("div", "", p)); }
  if (s.reel && s.reel.length) {
    const r = el("div", "reel");
    for (const x of s.reel.slice(0, 3)) r.appendChild(el("div", "", '<div class="rl">' + esc(cap(String(x.l).toLowerCase())) + '</div><div class="rv">' + esc(x.v) + "</div>"));
    c.appendChild(r);
  }
  const an = elAnalyse(s);
  if (an) c.appendChild(an);
  const rt = retourDe(s);
  if (rt) c.appendChild(el("div", "sens", esc(resumeRetour(rt))));
  /* Aujourd'hui, le gainage se lance d'un geste depuis sa carte. */
  if (s.d === AUJ && guidable(s)) {
    const g = el("button", "lancer", I.jouer + "Lancer le gainage guidé");
    g.onclick = ev => { if (ev && ev.stopPropagation) ev.stopPropagation(); lancerGainage(s); };
    c.appendChild(g);
  }
  c.onclick = () => ouvrir(s);
  return c;
}
function resumeRetour(r) {
  const b = [];
  if (r.fait === "pas fait") b.push("Pas faite" + (r.raison ? " : " + r.raison : ""));
  if (r.fait === "en partie") b.push("En partie" + (r.raison ? " : " + r.raison : ""));
  if (r.sensation) b.push("sensation " + r.sensation + "/10");
  if (r.douleur) b.push(r.douleur === "aucune" ? "aucune douleur" : "douleur " + r.douleur);
  let t = "Ton retour : " + (b.join(", ") || "envoyé");
  if (r.note) t += ". « " + r.note.slice(0, 90) + (r.note.length > 90 ? "…" : "") + " »";
  return t;
}

/* ==========================================================================
   4. Bandeau de la semaine
   ========================================================================== */
function lundiDe(k) { return weekDays(k, 0)[0]; }
function bandeau() {
  const c = $("#sem"); c.innerHTML = "";
  const jours = weekDays(SEL, 0);
  $("#semT").textContent = jourCourt(jours[0]) + " – " + jourCourt(jours[6]);
  /* Les flèches vont aussi au-delà du plan écrit : rendez-vous, course, semaines à venir. */
  const { deb, fin } = bornesAgenda();
  $("#semG").disabled = jours[0] <= deb;
  $("#semD").disabled = jours[6] >= fin;
  for (const j of jours) {
    const d = parse(j);
    const b = el("button", "sj" + (j === SEL ? " sel" : "") + (j === AUJ ? " auj" : ""));
    b.setAttribute("aria-label", jourLong(j));
    b.innerHTML = '<span class="sjn">' + JC[d.getDay()] + '</span><span class="sjd">' + d.getDate() + "</span>";
    const p = el("span", "pts");
    for (const s of duJour(j).slice(0, 3)) {
      if (famOf(s) === "repos") continue;
      const e = etatDe(s);
      const pt = el("i", "pt" + (e === "afaire" ? " afaire" : e === "manque" ? " manque" : ""));
      pt.style.background = FA(famOf(s)).a;
      p.appendChild(pt);
    }
    b.appendChild(p);
    b.onclick = () => choisir(j);
    c.appendChild(b);
  }
}
function choisir(k) {
  SEL = k;
  if (VUE !== "vJour") onglet("vJour"); else { bandeau(); vueJour(); }
  if (typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
}

/* ==========================================================================
   5. Vue Jour
   ========================================================================== */
function fraicheur() {
  const j = ecartJ(D.today, AUJ);
  if (j <= 0) return null;
  if (j === 1 && maintenant().getHours() < 9) return null;   /* la nuit et le matin, c'est normal */
  return j === 1
    ? "La page n'a pas été régénérée depuis hier. Appuie sur l'heure en haut à droite pour l'actualiser."
    : "Ces données datent du " + jourLong(D.today) + ", il y a " + j + " jours. Appuie sur l'heure en haut à droite pour actualiser, ou passe par Parler.";
}

/* Tours de taille connus : ceux du carnet (D.mesures) et ceux saisis ici, pas encore recopiés. */
function mesuresToutes() {
  const m = {};
  for (const x of D.mesures || []) m[x.d] = x.cm;
  for (const r of tousRetours()) if (r.type === "mesure" && r.tour_taille) m[r.d] = r.tour_taille;
  return Object.keys(m).sort().map(d => ({ d, cm:m[d] }));
}
/* Ce qui attend une action (compte rendu à récupérer, mesure à relever) : une seule ligne,
   le détail et ses boutons au toucher. Les rendez-vous sont dans l'agenda, la course dans
   la carte de la semaine. */
let ATT_OUVERT = false;
function attentesActives() {
  const derMesure = (mesuresToutes().slice(-1)[0] || {}).d;
  return (D.echeances || []).filter(e => e.attente && !(/tour de taille/i.test(e.l) && derMesure && derMesure >= e.d));
}
function blocEcheances(v) {
  const A = attentesActives();
  if (!A.length) return;
  const vieille = Math.max(...A.map(e => ecartJ(e.d, AUJ)));
  const w = el("div", "aregler" + (vieille > 14 ? " ko" : ""));
  const h = el("button", "arh", '<span class="arn">' + A.length + '</span><span class="art"><b>À régler</b> · ' + esc(A[0].l.split(" : ")[0]) +
    (A.length > 1 ? " et " + (A.length - 1) + " autre" + (A.length > 2 ? "s" : "") : "") + '</span><b class="chev">' + (ATT_OUVERT ? "⌃" : "›") + "</b>");
  h.onclick = () => { ATT_OUVERT = !ATT_OUVERT; vueJour(); };
  w.appendChild(h);
  if (ATT_OUVERT) for (const e of A) {
    const taille = /tour de taille/i.test(e.l);
    const j = Math.max(0, ecartJ(e.d, AUJ));
    const a = el("div", "att" + (j > 14 ? " ko" : ""),
      '<div class="atth">' + (j ? "En attente depuis " + j + " jour" + (j > 1 ? "s" : "") : "À faire aujourd'hui") + '</div><div class="attx">' + esc(e.l) + "</div>");
    const b = el("button", "attb", taille ? I.regle + "Relever maintenant" : I.plume + "C'est réglé : le dire au coach");
    b.onclick = taille ? () => releverTaille() : () => ecrireAuCoach(AUJ, "À propos de « " + e.l + " » : ");
    a.appendChild(b);
    w.appendChild(a);
  }
  v.appendChild(w);
}

/* Heure locale « 19h05 ». */
const hhmm = d => String(d.getHours()).padStart(2, "0").replace(/^0(?=\d)/, "") + "h" + String(d.getMinutes()).padStart(2, "0");
/* Ce qui est arrivé après le mot (collecte/reagir.mjs) : le coach relit, ou le reprendra
   à sa prochaine tâche. Sans rien de neuf, on ne dit rien. */
function suiteDuMot() {
  const R = D.reaction;
  if (!R || !R.raisons || !R.raisons.length || (R.motVu && D.motVu && R.motVu !== D.motVu)) return null;
  const liste = esc(R.raisons.join(" ; "));
  const lance = R.lance && (!D.motVu || R.lance > D.motVu) ? new Date(R.lance) : null;
  if (lance && maintenant() - lance < 30 * 60000)
    return el("div", "motr en", "<i></i><span><b>Le coach relit</b> depuis " + hhmm(lance) + " : " + liste + ". Son nouveau mot arrive dans quelques minutes.</span>");
  return el("div", "motr", "<span><b>Arrivé après ce mot</b> : " + liste + ". Le coach en tiendra compte " + esc(R.prochain || "à sa prochaine tâche") + ".</span>");
}
/* Un message est « lu » quand le coach a écrit un mot après lui. */
function luParLeCoach(m) {
  if (!D.motVu || !m.ecrit) return false;
  const v = new Date(D.motVu);
  return m.ecrit <= iso(v) + " " + String(v.getHours()).padStart(2, "0") + "h" + String(v.getMinutes()).padStart(2, "0");
}

function titreJour(k) {
  const j = ecartJ(AUJ, k);
  return j === 0 ? "Aujourd'hui" : j === 1 ? "Demain" : j === -1 ? "Hier" : cap(JOURS[parse(k).getDay()]) + " " + parse(k).getDate();
}

/* Chaque bloc de la page Jour : (conteneur, jour choisi, séances, est-ce aujourd'hui).
   Ordre par défaut, du plus utile au moins utile en ouvrant la page : la séance, la forme,
   la consigne du coach, la semaine, ce qui reste à régler, les messages. */
const RENDU_JOUR = {
  seances:(v, k, ses) => {
    if (!ses.length) v.appendChild(el("div", "vide", k > (JOURS_PLAN().slice(-1)[0] || k) ? "Le programme de ce jour n'est pas encore écrit. Il arrive avec le bilan du dimanche." : "Rien de prévu ce jour-là."));
    for (const s of ses) v.appendChild(carte(s));
  },
  forme:(v, k, ses, auj) => { if (auj) carteMatin(v); },
  /* Le coach : sa consigne d'abord (la partie en gras), le reste à la demande. */
  mot:(v, k, ses, auj) => {
    const md = D.motDate || D.today;
    if (!D.mot || !(k === md || (auj && ecartJ(md, AUJ) === 1))) return;
    const vu = D.motVu ? new Date(D.motVu) : null;
    const quand = (md === AUJ ? "Le mot du coach" : md === decale(AUJ, -1) ? "Le mot du coach, hier soir" : "Le mot du coach, " + jourLong(md)) +
      (vu && md === AUJ && iso(vu) === AUJ ? " · " + hhmm(vu) : "");
    const g = /<b>([\s\S]*?)<\/b>/.exec(D.mot);
    const m = el("div", "mot", '<div class="motd">' + esc(quand) + "</div>");
    if (g && g[1].trim()) {
      m.appendChild(el("div", "mcons", g[1]));
      const reste = D.mot.replace(g[0], "").trim();
      if (reste) {
        const t = el("div", "mtx cache", reste);
        const l = el("button", "lien", "Lire tout le mot");
        l.onclick = () => { t.classList.toggle("cache"); l.textContent = t.classList.contains("cache") ? "Lire tout le mot" : "Replier"; };
        m.appendChild(t); m.appendChild(l);
      }
    } else m.appendChild(el("div", "mtx", D.mot));
    if (auj) { const r = suiteDuMot(); if (r) m.appendChild(r); }
    v.appendChild(m);
  },
  /* La semaine en une carte : où tu en es, la prochaine séance, la course qui vient. */
  semaine:(v, k, ses, auj) => {
    if (!auj) return;
    const l = lundiDe(AUJ), st = statsSemaine(l);
    const pro = JOURS_PLAN().filter(j => j > AUJ).map(j => duJour(j).find(s => famOf(s) !== "repos")).find(Boolean);
    const course = (D.echeances || []).find(e => e.k === "course" && !e.attente && ecartJ(AUJ, e.d) >= 0);
    if (!st.n && !pro && !course) return;
    const c = el("button", "sem7");
    if (st.n) {
      const km = x => fmt1(x).replace(",0", "");
      c.appendChild(el("div", "s7h", "<span>Cette semaine</span><span><b>" + st.f + "</b> sur " + st.n + " séance" + (st.n > 1 ? "s" : "") +
        (st.kmP ? " · <b>" + km(st.kmF) + "</b> sur " + km(st.kmP) + " km" : "") + "</span>"));
      c.appendChild(el("div", "barre", '<i style="width:' + Math.round(st.f / st.n * 100) + '%"></i>'));
    }
    if (pro) c.appendChild(el("div", "s7l", '<span class="s7p" style="background:' + FA(famOf(pro)).a + '"></span><span>Ensuite · <b>' +
      esc(titreJour(pro.d)) + "</b> · " + esc(nomSeance(pro.t)) + (pro.prov ? " <em>à confirmer</em>" : "") + "</span>"));
    if (course) {
      const j = ecartJ(AUJ, course.d);
      c.appendChild(el("div", "s7l s7c", I.drapeau + "<span><b>" + esc(course.l.split(" · ")[0]) + "</b> · " +
        (j === 0 ? "aujourd'hui" : j === 1 ? "demain" : "dans " + j + " jours") + "</span>"));
    }
    c.onclick = () => onglet("vPlan");
    v.appendChild(c);
  },
  /* Ce qui attend une action de ta part : une ligne, le détail au toucher. */
  attentes:(v, k, ses, auj) => { if (auj) blocEcheances(v); },
  /* Messages au coach écrits ce jour-là, et de quoi lui en écrire un. */
  messages:(v, k) => {
    const msgs = tousRetours().filter(r => r.type === "note" && r.d === k);
    if (msgs.length) {
      v.appendChild(el("h2", "", "Tes messages au coach"));
      for (const m of msgs) v.appendChild(el("div", "msg", '<div class="msgt">' + esc(m.note) + '</div><div class="msgs">' +
        esc((m.ecrit || "").slice(11)) + " · " + (m.statut === "carnet" ? (luParLeCoach(m) ? "lu par le coach" : "dans ton carnet, pas encore lu par le coach") : m.statut === "recu" ? "reçu, le coach le lira au prochain point" : m.statut === "envoi" ? "envoi…" : "en attente de réseau") + "</div>"));
    }
    const b = el("button", "btn creux", I.plume + "Écrire au coach");
    b.id = "bNote";
    b.onclick = () => ecrireAuCoach(k);
    v.appendChild(b);
  }
};

function vueJour() {
  const v = $("#vJour"); v.innerHTML = "";
  const k = SEL, ses = duJour(k);
  const estAuj = k === AUJ;

  v.appendChild(el("h1", "", esc(titreJour(k))));
  const n = ses.filter(s => famOf(s) !== "repos").length;
  v.appendChild(el("div", "sousT", esc(cap(jourLong(k))) + (n ? " · " + n + " séance" + (n > 1 ? "s" : "") : "")));
  if (!estAuj) {
    const r = el("button", "retour", I.fle + "Revenir à aujourd'hui");
    r.onclick = () => choisir(AUJ);
    v.appendChild(r);
  }

  if (estAuj) {
    const vieux = fraicheur();
    if (vieux) v.appendChild(el("div", "err", esc(vieux)));
    if (D.souci) v.appendChild(el("div", "err", esc(D.souci)));
  }
  /* Le reste suit l'ordre et les choix de Réglages → Personnaliser → Page Jour. */
  for (const b of blocsVisibles("jour")) RENDU_JOUR[b.id](v, k, ses, estAuj);
  v.appendChild(el("footer", "", "Page générée " + esc(D.genere || "—")));
}

/* ==========================================================================
   5 bis. Le matin : check-in en 3 touches, et feu du jour.
   Le feu applique les règles d'allègement du coach aux données de la collecte
   (calculées par analyses.js, jamais de tête). Les signaux du check-in et des
   retours de séance sont recalculés ici avec la même règle (core.js) : la page
   réagit dès la saisie, sans attendre la prochaine collecte.
   ========================================================================== */
let CK = null;                                   /* check-in en cours de saisie */
const ZONES = () => (D.checkin && D.checkin.zones) || [];
const ckDu = k => { let c = null; for (const r of tousRetours()) if (r.type === "checkin" && r.d === k) c = r; return c; };
function resumeCheckin(c) {
  const b = [];
  if (c.forme) b.push("forme " + c.forme + "/5");
  if (c.jambes) b.push("jambes " + c.jambes);
  if (c.alerte === "rien") b.push("rien à signaler");
  else if (c.alerte) { const z = ZONES().find(x => x.v === c.zone); b.push(c.alerte + (z && z.nom ? " " + z.nom : "")); }
  return cap(b.join(", "));
}
function feuDuJour() {
  const frais = !!D.feu && D.today === AUJ;
  const base = frais ? (D.feu.raisons || []).filter(r => r.id !== "checkin" && !/^retour_/.test(r.id || "")) : [];
  const raisons = base
    .concat(reglesCheckin(ckDu(AUJ), ZONES()).map(x => ({ id:"checkin", niveau:x.niveau, texte:x.texte })))
    .concat(reglesRetours(tousRetours(), AUJ));
  const act = raisons.filter(r => r.niveau !== "info");
  const couleur = act.some(r => r.niveau === "rouge") ? "rouge" : act.length ? "orange" : "vert";
  /* Sans les données du jour, jamais de feu vert : on ne sait pas. */
  if (!frais && couleur === "vert") return null;
  return { couleur, raisons, act, frais, ok:frais ? D.feu.ok || [] : [], manque:frais ? D.feu.manque || [] : [], meteo:frais ? D.feu.meteo || {} : {} };
}
const FEU = { vert:"Feu vert", orange:"Prudence", rouge:"Stop" };
function meteoTxt(m) {
  const b = [];
  const un = (h, x) => {
    if (!x) return;
    let t = h + " " + x.t + "°";
    if (Math.abs(x.ressenti - x.t) >= 2) t += " (ressenti " + x.ressenti + "°)";
    if (x.pluie >= 40) t += ", pluie " + x.pluie + " %";
    if (x.vent >= 30) t += ", vent " + x.vent + " km/h";
    b.push(t);
  };
  if (maintenant().getHours() < 10) un("7 h", m && m.matin_7h);
  un("19 h", m && m.soir_19h);
  return b.length ? "Météo · " + b.join(" · ") : "";
}
/* Les chiffres du matin : ceux que le coach a choisis aujourd'hui, sinon ceux de la
   dernière collecte (nuit, VFC, charge). */
function chiffresForme() {
  let L = [];
  if (D.n3 && D.n3.length && (D.n3Date || D.today) === AUJ) L = D.n3.slice(0, 3).map(c => ({ l:cap(String(c.l).toLowerCase()), v:c.v, c:c.c }));
  else {
    const J = (D.tendances && D.tendances.jours) || [], j = J.find(x => x.d === AUJ);
    if (j) {
      const n = j.sg != null ? j.sg : j.sw;
      if (n != null) L.push({ l:"Sommeil", v:hm(n) });
      if (j.vfc != null) L.push({ l:"VFC", v:j.vfc + " ms" });
    }
    const dc = dernier(J, "ch");
    if (dc && dc.ch != null) L.push({ l:"Charge", v:fmt1(dc.ch) });
  }
  if (!L.length) return null;
  const g = el("div", "n3");
  for (const c of L) g.appendChild(el("div", "", '<div class="n3l">' + esc(c.l) + '</div><div class="n3v"' + (c.c ? ' style="color:' + c.c + '"' : "") + ">" + esc(c.v) + "</div>"));
  return g;
}
function carteMatin(v) {
  const reste = duJour(AUJ).filter(s => famOf(s) !== "repos" && etatDe(s) === "afaire").length;
  const f = feuDuJour();
  const c = el("div", "matin");
  /* Le feu n'a de sens que s'il reste une séance à faire, ou s'il dit stop/prudence. */
  const feu = f && (reste || f.couleur !== "vert");
  if (feu) {
    c.classList.add(f.couleur);
    c.appendChild(el("div", "feu", "<i></i><span>" + FEU[f.couleur] + "</span>"));
  } else c.appendChild(el("div", "fhd", "Ta forme"));
  const ch = chiffresForme();
  if (ch) c.appendChild(ch);
  if (feu) {
    if (f.couleur !== "vert") {
      c.appendChild(el("div", "feus", f.couleur === "rouge" ? "Pas de séance aujourd'hui :" : f.act.length > 1 ? "Plusieurs signaux demandent d'alléger :" : "Un signal demande d'alléger :"));
      if (f.act.length) { const u = el("ul", "feul"); for (const r of f.act) u.appendChild(el("li", r.niveau, esc(r.texte))); c.appendChild(u); }
    }
    for (const r of f.raisons.filter(x => x.niveau === "info")) c.appendChild(el("div", "feui", esc(r.texte)));
    const m = meteoTxt(f.meteo);
    if (m && reste) c.appendChild(el("div", "feum", esc(m)));
    /* Le détail (ce qui a été vérifié, ce qui manque) reste replié. */
    const det = [];
    if (f.manque.length) det.push("Pas mesuré : " + esc(f.manque.join(", ")) + ". Le feu ne peut pas en tenir compte.");
    if (f.ok.length) det.push("Vérifié, rien à signaler : " + esc(f.ok.join(" ")) + " Règles du coach, appliquées à la dernière collecte ; c'est lui qui décide au point de 7h27.");
    if (det.length) {
      const z = el("div", "feuv cache", det.join(" "));
      const d = el("button", "lien", "Le détail");
      d.onclick = () => z.classList.toggle("cache");
      c.appendChild(d); c.appendChild(z);
    }
  }
  blocCheckin(c);
  v.appendChild(c);
}
function blocCheckin(c) {
  const ck = ckDu(AUJ);
  if (ck && !CK) {
    const l = el("div", "ckres", '<div><div class="ckt">Ton check-in</div><div class="ckv">' + esc(resumeCheckin(ck)) + "</div></div>");
    const m = el("button", "lien", "Modifier");
    m.onclick = () => { CK = { forme:ck.forme, jambes:ck.jambes, alerte:ck.alerte, zone:ck.zone }; vueJour(); };
    l.appendChild(m);
    c.appendChild(l);
    return;
  }
  /* Le brouillon n'existe qu'à la première touche : un check-in arrivé du serveur
     entre-temps (saisi sur un autre appareil) s'affiche alors normalement. */
  /* Passé 11 h, un check-in pas fait tient en une ligne. */
  if (!CK && !ck && maintenant().getHours() >= 11) {
    const l = el("div", "ckres", '<div><div class="ckt">Check-in</div><div class="ckv">Pas fait aujourd\'hui</div></div>');
    const m = el("button", "lien", "Le faire");
    m.onclick = () => { CK = { forme:null, jambes:null, alerte:null, zone:null }; vueJour(); };
    l.appendChild(m); c.appendChild(l);
    return;
  }
  const x = CK || { forme:null, jambes:null, alerte:null, zone:null };
  const w = el("div", "ck");
  w.appendChild(el("div", "ckt", "Comment tu te sens ce matin ?"));
  const rang = (lab, cle, opts, aide) => {
    const r = el("div", "ckl");
    r.appendChild(el("div", "ckq", esc(lab)));
    const ch = el("div", "chips" + (opts.length >= 5 ? " serre" : ""));
    for (const o of opts) {
      const b = el("button", "chip" + (x[cle] === o.v ? " on" : ""), esc(o.l));
      b.type = "button";
      b.dataset.v = String(o.v);
      b.onclick = () => { CK = x; CK[cle] = o.v; if (cle === "alerte" && o.v === "rien") CK.zone = null; apresCK(); };
      ch.appendChild(b);
    }
    r.appendChild(ch);
    if (aide) r.appendChild(el("div", "cka", esc(aide)));
    w.appendChild(r);
  };
  rang("Forme", "forme", [1, 2, 3, 4, 5].map(n => ({ l:String(n), v:n })), "1 = vidé · 5 = au top");
  rang("Jambes", "jambes", [{ l:"Fraîches", v:"fraîches" }, { l:"Lourdes", v:"lourdes" }]);
  rang((D.checkin && D.checkin.question) || "Douleur ou raideur", "alerte", [{ l:"Rien", v:"rien" }, { l:"Raideur", v:"raideur" }, { l:"Douleur", v:"douleur" }]);
  if (x.alerte && x.alerte !== "rien" && ZONES().length) rang("Où ?", "zone", ZONES().map(z => ({ l:z.l, v:z.v })));
  w.appendChild(el("div", "cka", "Envoyé au coach dès la dernière touche."));
  if (ck) { const a = el("button", "lien", "Garder mon check-in"); a.onclick = () => { CK = null; vueJour(); }; w.appendChild(a); }
  c.appendChild(w);
}
const ckComplet = x => !!(x && x.forme && x.jambes && x.alerte && (x.alerte === "rien" || x.zone || !ZONES().length));
function apresCK() { if (ckComplet(CK)) envoyerCheckin(); else vueJour(); }
async function envoyerCheckin() {
  const x = CK; CK = null;
  const p = envoyer({ type:"checkin", d:AUJ, forme:x.forme, jambes:x.jambes, alerte:x.alerte, zone:x.alerte !== "rien" ? x.zone || null : null, ecrit:horo() });
  rafraichir();                                  /* le résumé et le feu réagissent tout de suite */
  const res = await p;
  toast(res === "ok" ? "Check-in envoyé au coach" : "Pas de réseau : ton check-in partira tout seul");
  rafraichir();
}

/* Glisser à gauche ou à droite sur la vue Jour change de jour. */
function glisser() {
  const v = $("#vJour");
  if (!v || !v.addEventListener) return;
  let x0 = null, y0 = null;
  v.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive:true });
  v.addEventListener("touchend", e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) choisir(decale(SEL, dx < 0 ? 1 : -1));
  }, { passive:true });
}

/* ==========================================================================
   6. Agenda : le mois, le jour choisi, ou la liste de toutes les semaines.
   Toucher un événement ouvre un aperçu par-dessus l'agenda, sans le quitter.
   ========================================================================== */
const AG = { mois:null, jour:null, mode:"liste" };
const moisDe = k => k.slice(0, 7);
const decaleMois = (m, n) => { const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
const NOM_MOIS = m => cap(MOIS[+m.slice(5, 7) - 1]) + " " + m.slice(0, 4);
/* Rendez-vous datés du plan (test de contrôle…) : ce sont aussi des événements. */
const echeancesDu = k => (D.echeances || []).filter(e => !e.attente && e.d === k);
/* Une course déjà inscrite au programme ce jour-là n'est pas répétée en rendez-vous. */
const evenementsDu = k => { const ses = duJour(k).filter(s => famOf(s) !== "repos");
  return ses.map(s => ({ s })).concat(echeancesDu(k).filter(e => !(e.k === "course" && ses.some(s => FA(famOf(s)).sp === "course"))).map(e => ({ e }))); };
function bornesAgenda() {
  const k = JOURS_PLAN(), ech = (D.echeances || []).filter(e => !e.attente).map(e => e.d).sort();
  const deb = [k[0], AUJ].filter(Boolean).sort()[0];
  const fin = [k[k.length - 1], ech[ech.length - 1], decale(AUJ, 35)].filter(Boolean).sort().pop();
  return { deb, fin };
}
function statsSemaine(l) {
  let n = 0, f = 0, kmP = 0, kmF = 0;
  for (const j of weekDays(l, 0)) for (const s of duJour(j)) {
    const course = FA(famOf(s)).sp === "course" && (s.sport || "course") === "course";
    const e = etatDe(s);
    if (course && e === "fait") kmF += parseFloat(String(s.kmFait || s.km || "0").replace(",", ".")) || 0;
    if (famOf(s) === "repos" || s.horsPlan) continue;
    n++;
    if (e === "fait" || e === "partiel") f++;
    if (course) kmP += parseFloat(String(s.km || "0").replace(",", ".")) || 0;
  }
  return { n, f, kmP, kmF };
}
function blocSemaine(l, compact) {
  const st = statsSemaine(l), ici = lundiDe(AUJ), js = weekDays(l, 0);
  const w = el("div", "wks-c");
  const nom = l === ici ? "Cette semaine" : l === decale(ici, 7) ? "La semaine prochaine" : l === decale(ici, -7) ? "La semaine dernière" : "Semaine du " + jourCourt(l);
  w.appendChild(el("div", "wkh", '<div class="wkn">' + nom + '</div><div class="wkd">' + jourCourt(js[0]) + " – " + jourCourt(js[6]) + "</div>"));
  if (st.n || st.kmF) {
    w.appendChild(el("div", "barre", '<i style="width:' + (st.n ? Math.round(st.f / st.n * 100) : 0) + '%"></i>'));
    w.appendChild(el("div", "wks", st.f + " sur " + st.n + " séance" + (st.n > 1 ? "s" : "") +
      (st.kmP || st.kmF ? " · " + fmt1(st.kmF).replace(",0", "") + " sur " + fmt1(st.kmP).replace(",0", "") + " km de course" : "")));
  } else if (!compact) w.appendChild(el("div", "wks", l > ici ? "Plan pas encore écrit : il arrive avec le bilan du dimanche." : "Aucune séance prévue."));
  return w;
}
function ligneEvenement(x) {
  const r = el("button", "ev");
  if (x.e) {
    const j = ecartJ(AUJ, x.e.d);
    r.innerHTML = '<span class="evb ech' + (x.e.k === "course" ? " dossard" : "") + '"></span><span class="evc"><span class="evn">' + esc(x.e.l) + '</span><span class="evs">' + (x.e.k === "course" ? "Ta course" : "Rendez-vous") + ' · ' +
      (j === 0 ? "aujourd'hui" : j > 0 ? "dans " + j + " jour" + (j > 1 ? "s" : "") : "passé") + "</span></span>";
  } else {
    const s = x.s, e = etatDe(s);
    const dessous = e === "fait" && s.reel && s.reel.length ? s.reel.slice(0, 2).map(v => v.v).join(" · ")
      : e === "manque" ? (s.d < AUJ ? "Pas faite" : "Annulée") : [s.prov ? "À confirmer" : "", s.duree, s.km ? s.km + " km" : ""].filter(Boolean).join(" · ");
    r.innerHTML = '<span class="evb" style="background:' + FA(famOf(s)).a + '"></span><span class="evc"><span class="evn"><span class="evi" style="color:' + FA(famOf(s)).a + '">' + icoSport(famOf(s)) + "</span>" + esc(nomSeance(s.t)) +
      '</span><span class="evs' + (e === "fait" ? " ok" : e === "manque" ? " ko" : "") + '">' + esc(dessous) + "</span></span>" +
      '<span class="ico ' + (e === "fait" || e === "partiel" ? "ok" : e === "manque" ? "ko" : "af") + '">' +
      (e === "fait" || e === "partiel" ? I.chk : e === "manque" ? I.croix : I.rond) + "</span>";
  }
  r.onclick = () => apercu(x);
  return r;
}
function grilleMois(v) {
  const m = AG.mois, { deb, fin } = bornesAgenda();
  const nav = el("div", "agnav");
  const g = el("button", "", I.fle), d = el("button", "", I.fle);
  g.setAttribute("aria-label", "Mois précédent"); d.setAttribute("aria-label", "Mois suivant");
  d.style.transform = "scaleX(-1)";
  g.disabled = m <= moisDe(deb); d.disabled = m >= moisDe(fin);
  g.onclick = () => { AG.mois = decaleMois(m, -1); vuePlan(); };
  d.onclick = () => { AG.mois = decaleMois(m, 1); vuePlan(); };
  nav.appendChild(g); nav.appendChild(el("div", "agm", esc(NOM_MOIS(m)))); nav.appendChild(d);
  v.appendChild(nav);
  const grille = el("div", "mois");
  for (const j of ["L", "M", "M", "J", "V", "S", "D"]) grille.appendChild(el("div", "mjn", j));
  const premier = m + "-01";
  for (let k = lundiDe(premier); moisDe(k) <= m || parse(k).getDay() !== 1; k = decale(k, 1)) {
    const c = el("button", "mc" + (moisDe(k) !== m ? " hors" : "") + (k === AUJ ? " auj" : "") + (k === AG.jour ? " sel" : ""));
    c.setAttribute("aria-label", jourLong(k));
    c.innerHTML = '<span class="mcd">' + parse(k).getDate() + "</span>";
    const p = el("span", "pts");
    for (const x of evenementsDu(k).slice(0, 3)) {
      if (x.e) { p.appendChild(el("i", "pt ech")); continue; }
      const e = etatDe(x.s);
      const pt = el("i", "pt" + (e === "afaire" ? " afaire" : e === "manque" ? " manque" : ""));
      pt.style.background = FA(famOf(x.s)).a;
      p.appendChild(pt);
    }
    c.appendChild(p);
    c.onclick = () => { AG.jour = k; vuePlan(); };
    grille.appendChild(c);
  }
  v.appendChild(grille);
}
function panneauJour(v) {
  const k = AG.jour;
  const p = el("div", "agjour");
  p.appendChild(el("div", "agjt", esc(cap(jourLong(k))) + (k === AUJ ? " · aujourd'hui" : "")));
  const evs = evenementsDu(k);
  if (!evs.length) p.appendChild(el("div", "jrv", duJour(k).some(s => famOf(s) === "repos") ? "Repos" : k > (JOURS_PLAN().slice(-1)[0] || k) ? "Pas encore planifié" : "Rien de prévu"));
  for (const x of evs) p.appendChild(ligneEvenement(x));
  v.appendChild(p);
  v.appendChild(blocSemaine(lundiDe(k)));
}
/* La liste, façon carnet d'entraînement : un bloc par semaine (dates, repère, total),
   une ligne par jour, une carte par séance, bordée de la couleur de son sport. */
function enteteSemaine(l) {
  const st = statsSemaine(l), ici = lundiDe(AUJ), js = weekDays(l, 0);
  const a = parse(js[0]), b = parse(js[6]);
  const titre = "Du " + (a.getMonth() === b.getMonth() ? jourN(a) : jourCourt(js[0])) + " au " + jourCourt(js[6]);
  const badge = l === ici ? "Cette semaine" : l === decale(ici, 7) ? "La semaine prochaine" : l === decale(ici, -7) ? "La semaine dernière" : "";
  const h = el("div", "wkh2", '<div class="wkt">' + esc(titre) + "</div>" + (badge ? '<span class="wkb">' + badge + "</span>" : ""));
  const w = el("div", "wkhaut");
  w.appendChild(h);
  const km = x => fmt1(x).replace(",0", "");
  if (!st.n && !st.kmF) w.appendChild(el("div", "wks", l > ici ? "Plan pas encore écrit : il arrive avec le bilan du dimanche." : "Aucune séance prévue."));
  else if (!st.n) w.appendChild(el("div", "wks", "Hors programme : <b>" + km(st.kmF) + " km</b> de course"));
  else if (l > ici) w.appendChild(el("div", "wks", "Total : <b>" + (st.kmP ? km(st.kmP) + " km</b> de course · " : st.n + "</b> ") +
    (st.kmP ? st.n + " séance" + (st.n > 1 ? "s" : "") : "séance" + (st.n > 1 ? "s" : ""))));
  else {
    w.appendChild(el("div", "wks", st.f + " sur " + st.n + " séance" + (st.n > 1 ? "s" : "") +
      (st.kmP || st.kmF ? " · " + km(st.kmF) + " sur " + km(st.kmP) + " km de course" : "")));
    w.appendChild(el("div", "barre", '<i style="width:' + (st.n ? Math.round(st.f / st.n * 100) : 0) + '%"></i>'));
  }
  return w;
}
function listeSemaines(v) {
  const { deb, fin } = bornesAgenda(), ici = lundiDe(AUJ);
  let cible = null;
  for (let l = lundiDe(deb); l <= fin; l = decale(l, 7)) {
    const w = el("div", "wk" + (l === ici ? " ici" : ""));
    w.appendChild(enteteSemaine(l));
    const ecrite = weekDays(l, 0).some(j => duJour(j).length);
    /* Au-delà de la semaine prochaine, une semaine vide n'apprend rien : on la saute. */
    if (!ecrite && l > decale(ici, 7) && !weekDays(l, 0).some(j => evenementsDu(j).length)) continue;
    for (const j of weekDays(l, 0)) {
      const d = parse(j), evs = evenementsDu(j);
      if (!ecrite && !evs.length) continue;           /* semaine pas encore écrite : seulement ses rendez-vous */
      const r = el("div", "jr" + (j === AUJ ? " auj" : ""));
      r.appendChild(el("div", "jrd", '<div class="jrn">' + JC[d.getDay()] + '</div><div class="jrc">' + d.getDate() + "</div>"));
      const z = el("div", "jrs");
      if (!evs.length) z.appendChild(el("div", "jrv", duJour(j).some(s => famOf(s) === "repos") ? "Repos" : "—"));
      for (const x of evs) z.appendChild(ligneEvenement(x));
      r.appendChild(z);
      w.appendChild(r);
    }
    v.appendChild(w);
    if (l === ici) cible = w;
  }
  /* On ouvre la liste sur la semaine en cours, l'historique au-dessus. */
  if (cible && cible.scrollIntoView && typeof setTimeout !== "undefined") setTimeout(() => {
    defilAuto = horloge() + 500;                      /* ce saut-là ne doit pas cacher le bandeau */
    cible.scrollIntoView({ block:"start" });
  }, 30);
}
function vuePlan() {
  const v = $("#vPlan"); v.innerHTML = "";
  if (!AG.mois) { AG.jour = AUJ; AG.mois = moisDe(AUJ); }
  const h = el("div", "aghaut");
  h.id = "agHaut";
  h.appendChild(el("h1", "", "Agenda"));
  const seg = el("div", "seg petit");
  for (const [m, l] of [["mois", "Mois"], ["liste", "Liste"]]) {
    const b = el("button", AG.mode === m ? "on" : "", l);
    b.dataset.m = m;
    b.onclick = () => { AG.mode = m; vuePlan(); };
    seg.appendChild(b);
  }
  h.appendChild(seg);
  v.appendChild(h);
  if (!JOURS_PLAN().length) { v.appendChild(el("div", "vide", "Aucun plan publié pour l'instant.")); return; }
  if (AG.mode === "mois") { grilleMois(v); panneauJour(v); }
  else listeSemaines(v);
  v.appendChild(el("footer", "", "Pour déplacer une séance, passe par Parler ou écris au coach."));
}

/* Aperçu d'un événement, par-dessus l'agenda. */
function apercu(x) {
  if (x.e) {
    const j = ecartJ(AUJ, x.e.d);
    ouvrirFeuille(cap(jourLong(x.e.d)), f => {
      f.appendChild(el("div", "ctop", '<span class="pill" style="--fa:var(--t2)"><i></i>Rendez-vous</span>'));
      f.appendChild(el("div", "ctit", esc(x.e.l)));
      f.appendChild(el("div", "cmeta", "<span>" + (j === 0 ? "Aujourd'hui" : j > 0 ? "Dans " + j + " jour" + (j > 1 ? "s" : "") : "Il y a " + -j + " jours") + "</span>"));
    });
    return;
  }
  const s = x.s, fam = famOf(s), F = FA(fam), e = etatDe(s);
  ouvrirFeuille(cap(jourLong(s.d)), f => {
    const top = el("div", "ctop", '<span class="pill sport">' + icoSport(fam) + esc(nomSport(fam)) + (s.horsPlan ? " · hors plan" : "") + "</span>" + (s.prov ? '<span class="etat prov">À confirmer</span>' : puceEtat(s, e)));
    top.style.setProperty("--fa", F.a);
    f.appendChild(top);
    f.appendChild(el("div", "ctit", esc(nomSeance(s.t))));
    const m = metaSeance(s);
    if (m) f.appendChild(el("div", "cmeta", m));
    const p = profil(s); if (p) f.appendChild(el("div", "", p));
    if (s.reel && s.reel.length) {
      const r = el("div", "reel");
      for (const y of s.reel.slice(0, 4)) r.appendChild(el("div", "", '<div class="rl">' + esc(cap(String(y.l).toLowerCase())) + '</div><div class="rv">' + esc(y.v) + "</div>"));
      f.appendChild(r);
    }
    const an = elAnalyse(s);
    if (an) f.appendChild(an);
    const rt = retourDe(s);
    if (rt) f.appendChild(el("div", "sens", esc(resumeRetour(rt))));
    if (s.pourquoi) f.appendChild(el("div", "mtx", esc(s.pourquoi))).style.marginTop = "12px";
    if (guidable(s) && s.d >= decale(AUJ, -1) && s.d <= decale(AUJ, 1)) {
      const g = el("button", "btn", I.jouer + "Lancer le gainage guidé");
      g.onclick = () => { fermerFeuille(); lancerGainage(s); };
      f.appendChild(g);
    }
    const b = el("button", "btn" + (guidable(s) && s.d >= decale(AUJ, -1) && s.d <= decale(AUJ, 1) ? " creux" : ""),
      an ? "Voir l'analyse kilomètre par kilomètre" : s.d <= AUJ && !rt && e !== "fait" ? "Voir la séance et donner mon retour" : "Voir la séance en détail");
    b.onclick = () => { fermerFeuille(); ouvrir(s); };
    f.appendChild(b);
  });
}

/* ==========================================================================
   7. Vue Progrès : des cartes qu'on touche, des graphiques qu'on lit.
   Chaque graphique : un titre, une phrase qui dit ce qu'il faut en retenir,
   des axes chiffrés, et un jour sélectionnable au doigt (le détail s'affiche
   sous le graphique). Le « ? » explique la mesure.
   ========================================================================== */
const hm = m => m == null ? "—" : Math.floor(m / 60) + "h" + String(Math.round(m % 60)).padStart(2, "0");
const dernier = (J, k) => { for (let i = J.length - 1; i >= 0; i--) if (J[i][k] != null) return J[i]; return null; };
const moyenne = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
const jcourt = k => { const d = parse(k); return JC[d.getDay()].charAt(0) + JC[d.getDay()].slice(1).toLowerCase() + " " + d.getDate(); };

/* Graphique : barres ou ligne, une série principale (+ une série d'appoint).
   cfg : { x:[clés], s:[valeurs], s2?:[valeurs], type, c, c2?, min, max, ticks:[], fmt, zone?, repere?, lib(i),
           inverse? (le haut = la valeur la plus BASSE : une allure plus rapide monte),
           xpos? ([0..1] : abscisses proportionnelles au temps), xticks? ([{f, l}]),
           relier? (relier les points par-dessus les trous), points? (false : courbe dense sans pastilles), h? } */
function graphe(cfg) {
  const W = 320, H = cfg.h || 150, gL = 34, gB = 20, gT = 8, n = cfg.x.length;
  const lo = cfg.min, hi = cfg.max;
  const X = cfg.xpos ? i => gL + 8 + cfg.xpos[i] * (W - gL - 16) : i => gL + (i + .5) * (W - gL) / n;
  const Y = y => { const f = (Math.max(lo, Math.min(hi, y)) - lo) / (hi - lo); return gT + (H - gT - gB) * (cfg.inverse ? f : 1 - f); };
  const box = el("div", "graphe");
  const lire = el("div", "lire");
  let svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(cfg.titre || "") + '">';
  if (cfg.zone) {
    const a = Y(cfg.zone[0]), b = Y(cfg.zone[1]);
    svg += '<rect x="' + gL + '" y="' + Math.min(a, b).toFixed(1) + '" width="' + (W - gL) + '" height="' + Math.abs(a - b).toFixed(1) + '" fill="' + (cfg.cz || cfg.c) + '" opacity=".1"/>';
  }
  for (const t of cfg.ticks) {
    svg += '<line x1="' + gL + '" x2="' + W + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>' +
      '<text x="' + (gL - 6) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end" class="tk">' + esc(cfg.fmtAxe ? cfg.fmtAxe(t) : cfg.fmt(t)) + "</text>";
  }
  if (cfg.repere != null) svg += '<line x1="' + gL + '" x2="' + W + '" y1="' + Y(cfg.repere).toFixed(1) + '" y2="' + Y(cfg.repere).toFixed(1) + '" stroke="var(--t2)" stroke-width="1" stroke-dasharray="4 3"/>';
  /* étiquettes de l'axe horizontal : imposées (temps), sinon une sur deux ou trois si serré */
  if (cfg.xticks) for (const t of cfg.xticks) svg += '<text x="' + (gL + 8 + t.f * (W - gL - 16)).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" class="tk">' + esc(t.l) + "</text>";
  else {
    const pas = n > 10 ? Math.ceil(n / 7) : 1;
    cfg.x.forEach((k, i) => { if ((n - 1 - i) % pas === 0) svg += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" class="tk">' + esc(cfg.xlib ? cfg.xlib(k) : parse(k).getDate()) + "</text>"; });
  }
  const bw = Math.min(16, (W - gL) / n - 4);
  const barre = (i, v, op) => {
    const y = Y(v), b = Y(Math.max(lo, 0 > lo ? 0 : lo)), h = Math.max(2, b - y), x = X(i) - bw / 2, r = Math.min(4, h);
    return '<path d="M' + x.toFixed(1) + "," + b.toFixed(1) + " V" + (y + r).toFixed(1) + " Q" + x.toFixed(1) + "," + y.toFixed(1) + " " + (x + r).toFixed(1) + "," + y.toFixed(1) +
      " H" + (x + bw - r).toFixed(1) + " Q" + (x + bw).toFixed(1) + "," + y.toFixed(1) + " " + (x + bw).toFixed(1) + "," + (y + r).toFixed(1) + " V" + b.toFixed(1) + ' Z" fill="' + cfg.c + '" opacity="' + op + '"/>';
  };
  /* Une courbe : coupée aux trous (une nuit sans mesure). cfg.trou : combien de cases
     vides on enjambe encore (1 = aucune) ; relier : toutes. */
  const courbe = (S, c, large, pastilles) => {
    const trou = cfg.trou != null ? cfg.trou : cfg.relier ? Infinity : 1;
    let seg = [], der = -1, g = "";
    const traits = [];
    S.forEach((v, i) => {
      if (v == null) return;
      if (der >= 0 && i - der > trou && seg.length) { traits.push(seg); seg = []; }
      seg.push(X(i).toFixed(1) + "," + Y(v).toFixed(1)); der = i;
    });
    if (seg.length) traits.push(seg);
    for (const t of traits) if (t.length > 1) g += '<polyline fill="none" stroke="' + c + '" stroke-width="' + large + '" stroke-linejoin="round" stroke-linecap="round" points="' + t.join(" ") + '"/>';
    if (pastilles) S.forEach((v, i) => { if (v != null) g += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="3.2" fill="' + c + '" stroke="var(--s1)" stroke-width="2"/>'; });
    return g;
  };
  if (cfg.type === "barres") {
    cfg.s.forEach((v, i) => { if (v != null) svg += barre(i, v, 1); else if (cfg.s2 && cfg.s2[i] != null) svg += barre(i, cfg.s2[i], .38); });
  } else {
    if (cfg.s2) svg += courbe(cfg.s2, cfg.c2 || cfg.c, 1.6, cfg.points !== false);
    svg += courbe(cfg.s, cfg.c, cfg.points === false ? 1.6 : 2, cfg.points !== false);
  }
  svg += '<line class="curseur" x1="0" x2="0" y1="' + gT + '" y2="' + (H - gB) + '" stroke="var(--t1)" stroke-width="1" opacity="0"/></svg>';
  box.innerHTML = svg;
  box.appendChild(lire);
  let sel = -1;
  const choisirI = i => {
    i = Math.max(0, Math.min(n - 1, i));
    sel = i;
    const c = box.querySelector(".curseur");
    if (c && c.setAttribute) { c.setAttribute("x1", X(i).toFixed(1)); c.setAttribute("x2", X(i).toFixed(1)); c.setAttribute("opacity", ".35"); }
    lire.innerHTML = cfg.lib(i);
  };
  box._choisir = choisirI;
  const s0 = cfg.s.map((v, i) => v != null || (cfg.s2 && cfg.s2[i] != null) ? i : -1).filter(i => i >= 0).pop();
  choisirI(s0 == null ? n - 1 : s0);
  const svgEl = box.querySelector("svg");
  if (svgEl && svgEl.getBoundingClientRect) {
    /* Abscisses au temps : le point le plus proche du doigt ; sinon la colonne touchée. */
    const proche = x => { let b = 0; for (let i = 1; i < n; i++) if (Math.abs(X(i) - x) < Math.abs(X(b) - x)) b = i; return b; };
    const depuisX = ev => { const r = svgEl.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width * W; choisirI(cfg.xpos ? proche(x) : Math.floor((x - gL) / ((W - gL) / n))); };
    svgEl.addEventListener("pointerdown", depuisX);
    svgEl.addEventListener("pointermove", ev => { if (ev.buttons || ev.pointerType === "mouse") depuisX(ev); });
    svgEl.setAttribute("tabindex", "0");
    svgEl.addEventListener("keydown", ev => { if (ev.key === "ArrowLeft") choisirI(sel - 1); if (ev.key === "ArrowRight") choisirI(sel + 1); });
  }
  return box;
}

const AIDE = {
  sommeil:["Ton sommeil", "La durée de chaque nuit, mesurée par " + MAT.montre + "." + (MAT.nuit_seule ? " Quand elle n'a rien enregistré (montre pas portée), c'est " + MAT.nuit_seule + " qui prend le relais : barre plus claire." : ""),
    "Repère en pointillés : 7 h. Le coach allège la séance du jour si tu dors moins de 5h30, ou moins de 6 h trois nuits sur cinq."],
  vfc:["Ta VFC", SRC.garmin ? "La variabilité de ta fréquence cardiaque pendant la nuit, en millisecondes. Plus elle est haute par rapport à ta zone habituelle (bande colorée, calculée par Garmin), mieux ton corps a récupéré."
      : "La variabilité de ta fréquence cardiaque pendant la nuit, en millisecondes. Plus elle est haute par rapport à tes nuits habituelles, mieux ton corps a récupéré.",
    "Une valeur seule ne veut pas dire grand-chose : c'est la tendance sur plusieurs nuits qui compte. Une baisse de plus de 10 % sur 3 jours fait alléger."],
  nuits:["Coucher et lever", "L'heure à laquelle tu t'endors et te réveilles, nuit par nuit, mesurée par " + MAT.montre + (MAT.nuit ? " (ou " + MAT.nuit + " quand la montre n'a rien vu)" : "") + ". Chaque barre va du coucher, en haut, au lever, en bas.",
    "Le repère : au lit avant 23 h (pointillés). Le sommeil est ton premier levier, et sa régularité compte autant que sa durée : un coucher qui bouge de plus d'une heure d'un soir à l'autre dérègle la récupération."],
  charge:["Ta charge", "Le rapport entre ce que tu as fait ces 7 derniers jours et ta moyenne des 4 dernières semaines (ratio aigu/chronique, calculé par Garmin).",
    "Entre 0,8 et 1,3 (bande colorée) : tu progresses sans prendre de risque. Au-dessus de 1,5 : tu en fais beaucoup plus que d'habitude, le risque de blessure monte. Sous 0,8 : tu perds du terrain."],
  semaines:["Tes semaines", "Tout ce que ta montre a enregistré, semaine par semaine (du lundi au dimanche) : la hauteur, ce sont les minutes d'effort.",
    "Ne comptent que les séances d'au moins 10 minutes, et les marches d'au moins 30 minutes. Ce que tu fais sans la montre n'apparaît pas ici."],
  pred:["Les estimations", "Les temps que Garmin estime que tu pourrais courir aujourd'hui, calculés à partir de ta VO₂max et de ta charge. Ce ne sont pas des records : aucune course n'a eu lieu.",
    "Elles bougent quand ta forme bouge. Comparées à tes records, elles disent si tu es au-dessus ou en dessous de ton meilleur niveau."],
  regularite:["Courir régulièrement", (OBJ.regularite ? "Ton objectif n°" + OBJ.regularite.rang + " : " + OBJ.regularite.texte + ". " : "") + "Le repère : " + pl(CIB.course, "course") + " par semaine, toutes les semaines. Un carré plein = une course.",
    "Une course compte dès 10 minutes enregistrées par ta montre, ou quand tu la déclares faite sur la page. La même séance vue des deux côtés ne compte qu'une fois."],
  moteur:["Ton moteur", "L'allure à laquelle tu cours quand ton cœur est à " + FH + " battements par minute (et à " + FB + "). À cœur égal, plus tu vas vite, plus ton endurance est développée : c'est la mesure de progrès la plus fiable, sans test ni dossard. Plus le point est haut, plus tu es rapide.",
    "Calculée sur chaque sortie à partir du fichier de ta montre : les moments où ton cœur est resté entre " + (FH - 4) + " et " + (FH + 4) + " pendant au moins 8 minutes, échauffement exclu. La chaleur, le dénivelé et la fatigue la font bouger : regarde la tendance sur des mois, pas un point isolé."],
  ventre:["Ventre et gainage", (OBJ.ventre ? "Ton objectif n°" + OBJ.ventre.rang + " : " + OBJ.ventre.texte + ". " : "") + "Sans balance, le tour de taille est le meilleur repère : mesuré toutes les deux semaines, dans les mêmes conditions, il dit si le ventre fond.",
    "Le gainage compte quand ta montre enregistre une séance de renforcement d'au moins 5 minutes, ou quand tu la déclares faite (le gainage guidé le fait pour toi à la fin). Le repère : " + (CIB.renfo > 1 ? CIB.renfo + " séances" : "au moins une séance") + " par semaine."],
  velo:REPRISE ? [REPRISE.titre, "Ton objectif n°" + REPRISE.rang + ". " + cap(REPRISE.nom) + " reprendra quand ce qui le bloque sera réglé : c'est écrit sur la carte.",
    "Dès que c'est le cas, dis-le au coach : il réintègre " + REPRISE.nom + " dans le plan progressivement, des sorties courtes d'abord."] : ["Reprise", "", ""]
};
function aide(cle) {
  const a = AIDE[cle];
  ouvrirFeuille(a[0], f => { f.appendChild(el("div", "mtx", esc(a[1]))); f.appendChild(el("div", "mtx", esc(a[2]))).style.marginTop = "12px"; });
}
function carteStat(cle, titre, valeur, chip, phrase) {
  const c = el("div", "stat");
  const h = el("div", "sth", '<div class="stt">' + esc(titre) + "</div>");
  const q = el("button", "aide", "?");
  q.setAttribute("aria-label", "Comprendre : " + titre);
  q.onclick = () => aide(cle);
  h.appendChild(q);
  c.appendChild(h);
  c.appendChild(el("div", "stv", esc(valeur) + (chip ? ' <span class="chip-e ' + chip[1] + '">' + esc(chip[0]) + "</span>" : "")));
  if (phrase) c.appendChild(el("div", "stp", phrase));
  return c;
}
function blocTendances(v, quoi) {
  const T = D.tendances;
  if (!T || !T.jours || !T.jours.length) return;
  const J = T.jours, x = J.map(j => j.d);
  const nuit = j => j.sg != null ? j.sg : j.sw;
  /* Sommeil */
  if (quoi === "sommeil" && J.some(j => nuit(j) != null)) {
    const r7 = moyenne(J.slice(-7).map(nuit)), a7 = moyenne(J.slice(0, 7).map(nuit));
    const der = dernier(J, "sg") || dernier(J, "sw");
    const phrase = r7 != null ? "Moyenne des 7 dernières nuits : <b>" + hm(Math.round(r7)) + "</b>" +
      (a7 != null ? (Math.abs(r7 - a7) >= 10 ? ", " + (r7 > a7 ? "+" : "−") + hm(Math.round(Math.abs(r7 - a7))).replace(/^0h/, "") + (Math.abs(r7 - a7) < 60 ? " min" : "") + " par rapport à la semaine d'avant." : ", comme la semaine d'avant.") : ".") : "";
    const c = carteStat("sommeil", "Sommeil", hm(nuit(der)), nuit(der) < 360 ? ["nuit courte", "warn"] : nuit(der) >= 420 ? ["bonne nuit", "ok"] : null, phrase);
    /* Sans montre Garmin, la seule source de nuit devient la série principale. */
    const deux = !!NUIT1;
    c.appendChild(graphe({ titre:"Sommeil par nuit", x, s:J.map(j => deux ? j.sg : j.sw), s2:deux ? J.map(j => j.sw) : null, type:"barres", c:"#3B82F6", min:0, max:Math.max(600, ...J.map(j => nuit(j) || 0)),
      ticks:[0, 240, 480], fmt:hm, fmtAxe:t => t / 60 + " h", repere:420,
      lib:i => { const j = J[i]; return "<b>" + (nuit(j) != null ? hm(nuit(j)) : "Pas de mesure") + "</b> " + esc(cap(jourLong(j.d))) +
        (!deux ? "" : j.sg != null && j.sw != null ? " · " + NUIT1 + " " + hm(j.sg) + ", " + (NUIT2 || "autre capteur") + " " + hm(j.sw) : j.sg == null && j.sw != null ? " · mesurée par " + (MAT.nuit_seule || "le capteur de nuit") : ""); } }));
    c.appendChild(el("div", "leg", deux
      ? '<span><i style="background:#3B82F6"></i>' + NUIT1 + '</span>' + (NUIT2 ? '<span><i style="background:#3B82F6;opacity:.38"></i>' + NUIT2 + ' (nuit sans ' + NUIT1 + ')</span>' : "") + '<span><i class="tiret"></i>7 h</span>'
      : '<span><i style="background:#3B82F6"></i>' + esc(NUIT2 || "Sommeil") + '</span><span><i class="tiret"></i>7 h</span>'));
    if (D.sourcesEtat && D.sourcesEtat.withings === "failure") c.appendChild(el("div", "ecart", "Withings ne répond plus depuis la dernière collecte : reconnecte-le dans les réglages (bouton L en haut à gauche)."));
    const ec = J.slice(-3).reverse().find(j => j.sg != null && j.sw != null && Math.abs(j.sg - j.sw) > 60);
    if (ec && deux && NUIT2) c.appendChild(el("div", "ecart", "Nuit du " + esc(jourLong(ec.d)) + " : " + NUIT1 + " " + hm(ec.sg) + ", " + NUIT2 + " " + hm(ec.sw) + ". Plus d'une heure d'écart : l'une des deux montres n'a pas tout vu."));
    v.appendChild(c);
  }
  /* Coucher et lever : le premier levier, rendu visible (lot 2, point 6). */
  if (quoi === "nuits" && J.filter(j => j.cou != null && j.lev != null).length >= 2) v.appendChild(carteNuits(J));
  /* VFC */
  if (quoi === "vfc" && J.some(j => j.vfc != null)) {
    const der = dernier(J, "vfc"), z = T.vfc;
    const chip = z ? (der.vfc < z[0] ? ["sous ta zone", "warn"] : der.vfc > z[1] ? ["au-dessus de ta zone", "ok"] : ["dans ta zone", "ok"]) : null;
    const r3 = moyenne(J.slice(-3).map(j => j.vfc)), a3 = moyenne(J.slice(-6, -3).map(j => j.vfc));
    const ev = r3 != null && a3 ? Math.round((r3 - a3) / a3 * 100) : null;
    const phrase = ev == null ? "" : "Sur 3 nuits : <b>" + Math.round(r3) + " ms</b> en moyenne, " + (Math.abs(ev) < 5 ? "stable" : (ev > 0 ? "+" : "−") + Math.abs(ev) + " %") + " par rapport aux 3 nuits d'avant.";
    const c = carteStat("vfc", "VFC nocturne", der.vfc + " ms", chip, phrase);
    const vals = J.map(j => j.vfc).filter(v => v != null).concat(z || []);
    const lo = Math.floor((Math.min(...vals) - 5) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 5) / 10) * 10;
    c.appendChild(graphe({ titre:"VFC par nuit", x, s:J.map(j => j.vfc), type:"ligne", c:"#0D9488", min:lo, max:hi, zone:z,
      ticks:[lo, Math.round((lo + hi) / 20) * 10, hi], fmt:t => t + "",
      lib:i => "<b>" + (J[i].vfc != null ? J[i].vfc + " ms" : "Pas de mesure") + "</b> " + esc(cap(jourLong(J[i].d))) }));
    if (z) c.appendChild(el("div", "leg", '<span><i class="zone" style="background:#0D9488"></i>Ta zone habituelle : ' + z[0] + "–" + z[1] + " ms</span>"));
    v.appendChild(c);
  }
  /* Charge */
  if (quoi === "charge" && J.some(j => j.ch != null)) {
    const der = dernier(J, "ch");
    const chip = der.ch > 1.5 ? ["trop élevée", "warn"] : der.ch > 1.3 ? ["élevée", "warn"] : der.ch >= 0.8 ? ["productive", "ok"] : ["faible", "warn"];
    const c = carteStat("charge", "Charge", fmt1(der.ch), chip,
      der.ch > 1.3 ? "Tu en fais plus que ton habitude des 4 dernières semaines : la récupération compte double." :
      der.ch >= 0.8 ? "Ta charge de la semaine est en ligne avec ton habitude : c'est la zone où l'on progresse." :
      "Tu en fais moins que ton habitude : ta forme de fond commence à baisser.");
    const hi = Math.max(2, Math.ceil(Math.max(...J.map(j => j.ch || 0)) * 2) / 2);
    c.appendChild(graphe({ titre:"Charge par jour", x, s:J.map(j => j.ch), type:"ligne", c:"#D97706", min:0, max:hi, zone:[0.8, 1.3],
      ticks:[0, 1, hi], fmt:t => fmt1(t).replace(",0", ""),
      lib:i => "<b>" + (J[i].ch != null ? fmt1(J[i].ch) : "Pas de mesure") + "</b> " + esc(cap(jourLong(J[i].d))) }));
    c.appendChild(el("div", "leg", '<span><i class="zone" style="background:#D97706"></i>Zone productive : 0,8–1,3</span>'));
    v.appendChild(c);
  }
}
/* ---------- Coucher et lever ----------
   Heures en minutes depuis midi la veille (depuis-plan.js) : 23 h → 660, 1 h → 780,
   7 h → 1140. Une barre par nuit, du coucher (en haut) au lever (en bas). */
const OBJ_COUCHER = 660;
const hNuit = m => { const t = Math.round(m + 720) % 1440; return Math.floor(t / 60) + "h" + String(t % 60).padStart(2, "0"); };
function carteNuits(J) {
  const N = J.filter(j => j.cou != null && j.lev != null), sem = J.slice(-7).filter(j => j.cou != null && j.lev != null);
  const base = sem.length >= 2 ? sem : N;
  const mc = moyenne(base.map(j => j.cou)), ml = moyenne(base.map(j => j.lev));
  const avant = base.filter(j => j.cou <= OBJ_COUCHER).length;
  const ecart = Math.round(moyenne(base.map(j => Math.abs(j.cou - mc))));
  const ok = mc <= OBJ_COUCHER;
  const c = carteStat("nuits", "Coucher et lever", hNuit(mc), [ok ? "objectif 23 h tenu" : "objectif 23 h", ok ? "ok" : "warn"],
    "Coucher moyen sur " + base.length + " nuits. Couché avant 23 h : <b>" + avant + " nuit" + (avant > 1 ? "s" : "") + " sur " + base.length + "</b>. Lever moyen : " + hNuit(ml) + "." +
    (ecart >= 45 ? " D'un soir à l'autre, ton coucher varie de ±" + (ecart >= 60 ? hm(ecart).replace(/^(\d+)h00$/, "$1 h") : ecart + " min") + " : un horaire régulier aide autant que dormir plus." : ""));
  c.appendChild(grapheNuits(J));
  c.appendChild(el("div", "leg", '<span><i style="background:#3B82F6"></i>couché avant 23 h</span><span><i style="background:#F59E0B"></i>après</span><span><i class="tiret"></i>23 h</span>'));
  return c;
}
function grapheNuits(J) {
  const W = 320, H = 170, gL = 34, gB = 20, gT = 8, n = J.length;
  const val = J.flatMap(j => j.cou != null && j.lev != null ? [j.cou, j.lev] : []).concat([OBJ_COUCHER]);
  const lo = Math.floor((Math.min(...val) - 20) / 60) * 60, hi = Math.ceil((Math.max(...val) + 20) / 60) * 60;
  const X = i => gL + (i + .5) * (W - gL) / n, Y = m => gT + (H - gT - gB) * (m - lo) / (hi - lo);
  const bw = Math.min(14, (W - gL) / n - 5);
  let svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Heures de coucher et de lever">';
  for (let t = lo; t <= hi; t += (hi - lo > 600 ? 120 : 60)) svg += '<line x1="' + gL + '" x2="' + W + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '" stroke="var(--line)"/>' +
    '<text x="' + (gL - 6) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end" class="tk">' + ((t + 720) / 60 % 24) + " h</text>";
  svg += '<line x1="' + gL + '" x2="' + W + '" y1="' + Y(OBJ_COUCHER).toFixed(1) + '" y2="' + Y(OBJ_COUCHER).toFixed(1) + '" stroke="var(--t2)" stroke-dasharray="4 3"/>';
  J.forEach((j, i) => {
    if ((n - 1 - i) % (n > 10 ? 2 : 1) === 0) svg += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" class="tk">' + parse(j.d).getDate() + "</text>";
    if (j.cou == null || j.lev == null) return;
    const y1 = Y(j.cou), y2 = Y(j.lev);
    svg += '<rect x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(3, y2 - y1).toFixed(1) +
      '" rx="' + Math.min(5, bw / 2).toFixed(1) + '" fill="' + (j.cou <= OBJ_COUCHER ? "#3B82F6" : "#F59E0B") + '"/>';
  });
  svg += '<line class="curseur" x1="0" x2="0" y1="' + gT + '" y2="' + (H - gB) + '" stroke="var(--t1)" stroke-width="1" opacity="0"/></svg>';
  const box = el("div", "graphe"), lire = el("div", "lire");
  box.innerHTML = svg; box.appendChild(lire);
  const choisirI = i => {
    i = Math.max(0, Math.min(n - 1, i));
    const j = J[i], cur = box.querySelector(".curseur");
    if (cur && cur.setAttribute) { cur.setAttribute("x1", X(i).toFixed(1)); cur.setAttribute("x2", X(i).toFixed(1)); cur.setAttribute("opacity", ".35"); }
    const veille = cap(JOURS[parse(decale(j.d, -1)).getDay()]) + " " + parse(decale(j.d, -1)).getDate();
    lire.innerHTML = j.cou == null ? "<b>Pas de mesure</b> nuit du " + esc(veille) + " au " + esc(jcourt(j.d)) :
      "<b>" + hNuit(j.cou) + " → " + hNuit(j.lev) + "</b> nuit du " + esc(veille) + " au " + esc(jcourt(j.d)) + (j.sg != null || j.sw != null ? " · " + hm(j.sg != null ? j.sg : j.sw) + " de sommeil" : "");
  };
  box._choisir = choisirI;
  const der = J.map((j, i) => j.cou != null ? i : -1).filter(i => i >= 0).pop();
  choisirI(der == null ? n - 1 : der);
  const s = box.querySelector("svg");
  if (s && s.getBoundingClientRect) {
    const depuisX = ev => { const r = s.getBoundingClientRect(); choisirI(Math.floor(((ev.clientX - r.left) / r.width * W - gL) / ((W - gL) / n))); };
    s.addEventListener("pointerdown", depuisX);
    s.addEventListener("pointermove", ev => { if (ev.buttons || ev.pointerType === "mouse") depuisX(ev); });
  }
  return box;
}

function blocSemaines(v) {
  const H = (D.hebdo || []).filter(w => !w.partiel);
  if (!H.length) return;
  const der = H[H.length - 1];
  const c = carteStat("semaines", "Tes semaines", der.min ? hm(der.min).replace(/^0h/, "") + (der.min < 60 ? " min" : "") : "0 min",
    null, "Cette semaine : <b>" + der.n + " séance" + (der.n > 1 ? "s" : "") + "</b>" + (der.km ? ", " + fmt1(der.km).replace(",0", "") + " km de course" : "") + ".");
  const max = Math.max(60, ...H.map(w => w.min));
  const pasAxe = max > 240 ? 120 : 60;
  c.appendChild(graphe({ titre:"Minutes d'effort par semaine", x:H.map(w => w.l), s:H.map(w => w.min), type:"barres", c:"#2563EB", min:0,
    max:Math.ceil(max / pasAxe) * pasAxe, ticks:[0, Math.ceil(max / pasAxe) * pasAxe], fmt:t => hm(t), fmtAxe:t => t >= 60 ? t / 60 + " h" : t + "",
    xlib:k => parse(k).getDate() + "/" + (parse(k).getMonth() + 1),
    lib:i => { const w = H[i]; return "<b>" + w.n + " séance" + (w.n > 1 ? "s" : "") + "</b> semaine du " + esc(jourCourt(w.l)) + " · " + (w.min ? hm(w.min) : "0 min") + (w.km ? " · " + fmt1(w.km) + " km de course" : ""); } }));
  v.appendChild(c);
}
/* ---------- Tes objectifs (profil.md), mesurés ---------- */
const mediane = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const ilYa = k => { const j = ecartJ(k, AUJ); return j === 0 ? "aujourd'hui" : j === 1 ? "hier" : "il y a " + j + " jours"; };
const etListe = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " et " + a[a.length - 1];
/* Les semaines des objectifs (calculées à la collecte). La semaine en cours se met
   à jour tout de suite avec ce que la page sait déjà (un gainage guidé, un retour). */
function semainesObjectifs() {
  const O = D.objectifs;
  if (!O || !O.semaines || !O.semaines.length) return null;
  const S = O.semaines.map(w => Object.assign({}, w));
  const ici = lundiDe(AUJ), cur = S[S.length - 1];
  if (cur && cur.l === ici) {
    const n = { course:0, renfo:0 };
    for (const j of weekDays(ici, 0)) for (const s of duJour(j)) {
      const e = etatDe(s), sp = FA(famOf(s)).sp;
      if ((e === "fait" || e === "partiel") && n[sp] != null) n[sp]++;
    }
    for (const r of tousRetours()) if (r.statut !== "carnet" && r.type === "seance" && (r.fait === "fait" || r.fait === "en partie") && r.d >= ici && r.d <= decale(ici, 6) &&
      !duJour(r.d).some(s => s.t === r.t)) { const sp = FA(famFromTitle(r.t)).sp; if (n[sp] != null) n[sp]++; }
    cur.course = Math.max(cur.course, n.course); cur.renfo = Math.max(cur.renfo, n.renfo);
  }
  return S;
}
/* Une bande de semaines : une colonne par semaine, un carré par séance de l'objectif. */
function bande(S, champ, cible, couleur, lib) {
  const box = el("div", "bande"), g = el("div", "bg"), lire = el("div", "lire");
  const ici = lundiDe(AUJ), cols = [];
  const choisirB = i => { cols.forEach((c, j) => c.classList.toggle("sel", j === i)); lire.innerHTML = lib(S[i]); };
  S.forEach((w, i) => {
    const col = el("button", "bc" + (w.l === ici ? " ici" : "") + (w[champ] >= cible ? " tenu" : ""));
    col.setAttribute("aria-label", "Semaine du " + jourCourt(w.l) + " : " + w[champ]);
    let h = "";
    for (let k = cible; k >= 1; k--) h += w[champ] >= k ? '<i class="plein" style="background:' + couleur + '"></i>' : "<i></i>";
    col.innerHTML = h;
    col.onclick = () => choisirB(i);
    cols.push(col); g.appendChild(col);
  });
  box.appendChild(g);
  box.appendChild(el("div", "bet", "<span>" + esc(jourCourt(S[0].l)) + "</span><span>cette semaine</span>"));
  box.appendChild(lire);
  box._choisir = choisirB;
  choisirB(S.length - 1);
  return box;
}
function carteRegularite(v, S) {
  const ici = lundiDe(AUJ), cur = S[S.length - 1], fait = cur.l === ici ? cur.course : 0;
  const pleines = S.filter(w => w.course >= CIB.course).length, der = (D.objectifs.dernier || {}).course;
  const prevus = [];
  for (const j of weekDays(AUJ, 0)) if (j >= AUJ && duJour(j).some(s => FA(famOf(s)).sp === "course" && etatDe(s) === "afaire")) prevus.push(j === AUJ ? "aujourd'hui" : JOURS[parse(j).getDay()]);
  let p = "<b>" + pleines + " semaine" + (pleines > 1 ? "s" : "") + " sur " + S.length + "</b> à " + pl(CIB.course, "course") + " ou plus.";
  if (der) p += " Dernière course : " + esc(jourLong(der)) + (ecartJ(der, AUJ) > 1 ? ", " + ilYa(der) : "") + ".";
  if (fait < CIB.course) p += prevus.length ? " Prévu d'ici dimanche : " + esc(etListe(prevus)) + "." : " Aucune autre course n'est prévue cette semaine.";
  const c = carteStat("regularite", TITRE_REG, fait + " sur " + CIB.course, fait >= CIB.course ? ["objectif tenu", "ok"] : null, p);
  c.appendChild(bande(S, "course", CIB.course, FA("facile").a, w => "<b>" + w.course + " course" + (w.course > 1 ? "s" : "") + "</b> semaine du " + esc(jourCourt(w.l)) +
    (w.renfo ? " · gainage " + w.renfo : "") + (w.foot ? " · football " + w.foot : "")));
  v.appendChild(c);
}
function carteMoteur(v) {
  const M = D.moteur;
  if (!M || !M.a150 || M.a150.length < 2) return;
  const A1 = M.a140 || [];
  /* Un point par mois : la médiane des sorties du mois. Une sortie isolée (chaleur,
     côtes) pèse moins, et dix sorties en dix jours ne s'empilent plus en un trait illisible. */
  const tous = M.a150.concat(A1).map(p => p[0]).sort();
  let m0 = moisDe(tous[0]);
  const mFin = moisDe(AUJ);
  if (m0 < decaleMois(mFin, -11)) m0 = decaleMois(mFin, -11);
  const mois = [];
  for (let m = m0; m <= mFin; m = decaleMois(m, 1)) mois.push(m);
  const parMois = L => mois.map(m => { const a = L.filter(p => moisDe(p[0]) === m).map(p => p[1]);
    return a.length ? { med:Math.round(mediane(a)), n:a.length, lo:Math.min(...a), hi:Math.max(...a) } : null; });
  const P150 = parMois(M.a150), P140 = parMois(A1);
  const tout = P150.concat(P140).filter(Boolean).map(p => p.med);
  const lo = Math.floor((Math.min(...tout) - 10) / 15) * 15, hi = Math.ceil((Math.max(...tout) + 10) / 15) * 15;
  /* Le chiffre en tête est celui du graphique : la médiane du dernier mois mesuré,
     comparée aux mesures d'au moins trois mois plus tôt. */
  const der = M.a150[M.a150.length - 1];
  const iDer = P150.map((p, i) => p ? i : -1).filter(i => i >= 0).pop(), pDer = P150[iDer], mDer = mois[iDer];
  const anciens = M.a150.filter(p => moisDe(p[0]) <= decaleMois(mDer, -3));
  let phrase = "<b>" + cap(MOIS[+mDer.slice(5, 7) - 1]) + " : " + allureTxt(pDer.med) + " /km</b>" + (pDer.n > 1 ? " (médiane de " + pDer.n + " sorties)" : " (1 sortie)") + ".";
  if (anciens.length) {
    const av = Math.round(mediane(anciens.map(p => p[1]))), ecart = av - pDer.med;
    const m1 = MOIS[parse(anciens[0][0]).getMonth()], m2 = MOIS[parse(anciens[anciens.length - 1][0]).getMonth()];
    phrase += " " + (m1 === m2 ? "En " + m1 : "De " + m1 + " à " + m2) + " : " + allureTxt(av) + ". " +
      (Math.abs(ecart) < 5 ? "À cœur égal, pas de progrès mesurable pour l'instant." :
       ecart > 0 ? "À cœur égal, tu cours <b>" + ecart + " s/km plus vite</b> : ton moteur progresse." :
       "À cœur égal, tu es " + -ecart + " s/km plus lent. Chaleur, dénivelé ou fatigue jouent : attends quelques sorties avant de conclure.");
  } else phrase += " Il faut plusieurs mois de mesures pour voir une tendance.";
  if (ecartJ(der[0], AUJ) > 21) {
    const dc = (D.objectifs && D.objectifs.dernier || {}).course;
    phrase += " Dernière mesure " + ilYa(der[0]) + " : " + (dc && dc > der[0] ? "tes sorties depuis n'ont pas passé assez de temps autour de " + FH + "." : "pas de sortie depuis.");
  }
  const c = carteStat("moteur", "Ton moteur", allureTxt(pDer.med) + " /km", ["à " + FH + " bpm", "neutre"], phrase);
  const lire1 = (p, f) => p ? "<b>" + allureTxt(p.med) + " /km</b> à " + f + " bpm" + (p.n > 1 ? " (médiane de " + p.n + " sorties, de " + allureTxt(p.lo) + " à " + allureTxt(p.hi) + ")" : " (1 sortie)") : "";
  c.appendChild(graphe({ titre:"Allure à fréquence cardiaque fixe, par mois", x:mois, xlib:m => MC[+m.slice(5, 7) - 1], trou:2, inverse:true,
    s:P150.map(p => p && p.med), s2:P140.map(p => p && p.med), type:"ligne", c:"#0EA5E9", c2:"#22C55E",
    min:lo, max:hi, ticks:[lo, Math.round((lo + hi) / 30) * 15, hi], fmt:allureTxt,
    lib:i => { const a = lire1(P150[i], FH), b = lire1(P140[i], FB), nom = cap(MOIS[+mois[i].slice(5, 7) - 1]);
      return a || b ? esc(nom) + " : " + a + (a && b ? " · " : "") + b : esc(nom) + " : pas de mesure"; } }));
  c.appendChild(el("div", "leg", '<span><i style="background:#0EA5E9"></i>à ' + FH + ' bpm</span>' + (A1.length ? '<span><i style="background:#22C55E"></i>à ' + FB + ' bpm</span>' : "") + "<span>plus haut = plus rapide</span>"));
  v.appendChild(c);
}
function carteVentre(v, S) {
  const M = mesuresToutes(), der = M[M.length - 1];
  const cm = x => fmt1(x).replace(/,0$/, "");
  let chip = null, p = "";
  if (M.length >= 2) {
    const e = Math.round((der.cm - M[0].cm) * 10) / 10;
    chip = [(e > 0 ? "+" : e < 0 ? "−" : "") + cm(Math.abs(e)) + " cm depuis le " + jourCourt(M[0].d), e < 0 ? "ok" : e > 0 ? "warn" : "neutre"];
  }
  if (der) {
    /* Due au bout de deux semaines, ou plus tôt si le coach l'a demandée (attente du plan). */
    const pro = decale(der.d, 14);
    const demandee = (D.echeances || []).some(e => e.attente && /tour de taille/i.test(e.l) && e.d > der.d);
    p = "Mesuré le " + esc(jourLong(der.d)) + ". " + (pro <= AUJ || demandee ? "<b>Prochaine mesure : maintenant.</b>" : "Prochaine mesure : " + esc(jourLong(pro)) + ".");
  } else p = "Pas encore de mesure. Une toutes les deux semaines suffit pour suivre ton ventre sans balance.";
  const c = carteStat("ventre", "Ventre et gainage", der ? cm(der.cm) + " cm" : "À relever", chip, p);
  if (M.length >= 2) {
    const d0 = M[0].d, tot = Math.max(1, ecartJ(d0, M[M.length - 1].d)), vs = M.map(x => x.cm);
    const lo = Math.floor(Math.min(...vs) - 1), hi = Math.ceil(Math.max(...vs) + 1);
    c.appendChild(graphe({ titre:"Tour de taille", x:M.map(x => x.d), xpos:M.map(x => ecartJ(d0, x.d) / tot), xticks:[{ f:0, l:jourCourt(d0) }, { f:1, l:jourCourt(M[M.length - 1].d) }],
      s:vs, type:"ligne", c:"#F59E0B", relier:true, min:lo, max:hi, ticks:[lo, hi], fmt:t => cm(t), h:120,
      lib:i => "<b>" + cm(M[i].cm) + " cm</b> " + esc(cap(jourLong(M[i].d))) }));
  }
  const b = el("button", "btn creux", I.regle + (der && der.d === AUJ ? "Corriger la mesure du jour" : "Relever mon tour de taille"));
  b.id = "bTaille";
  b.onclick = () => releverTaille();
  c.appendChild(b);
  /* Le gainage, semaine par semaine : au moins une séance. */
  const n = S.filter(w => w.renfo >= CIB.renfo).length, dg = (D.objectifs.dernier || {}).renfo;
  c.appendChild(el("div", "sep"));
  c.appendChild(el("div", "stp", "<b>Gainage : " + n + " semaine" + (n > 1 ? "s" : "") + " sur " + S.length + "</b> avec " + (CIB.renfo > 1 ? CIB.renfo + " séances ou plus" : "au moins une séance") + "." +
    (dg ? " Dernier : " + esc(jourLong(dg)) + (ecartJ(dg, AUJ) > 1 ? ", " + ilYa(dg) : "") + "." : "")));
  c.appendChild(bande(S, "renfo", CIB.renfo, FA("renfo").b, w => "<b>" + (w.renfo ? w.renfo + " gainage" + (w.renfo > 1 ? "s" : "") : "Pas de gainage") + "</b> semaine du " + esc(jourCourt(w.l))));
  v.appendChild(c);
}
function carteVelo(v) {
  const V = D.objectifs && D.objectifs.velo;
  if (!REPRISE || !V || !(V.attente || V.dernier)) return;
  if (V.attente) {
    const c = carteStat("velo", REPRISE.titre, "En pause", ["en attente", "warn"],
      "Ce qui bloque : <b>" + esc(V.attente) + "</b>" + (V.depuis ? ", depuis le " + esc(jourLong(V.depuis)) : "") + ". Dès que c'est réglé, dis-le au coach : il remet " + esc(REPRISE.nom) + " dans le plan, progressivement." +
      (V.dernier ? " Dernière sortie : " + esc(jourLong(V.dernier)) + "." : ""));
    const b = el("button", "btn creux", I.plume + "C'est réglé : le dire au coach");
    b.id = "bVelo";
    b.onclick = () => ecrireAuCoach(AUJ, "À propos de « " + V.attente + " » : ");
    c.appendChild(b);
    v.appendChild(c);
  } else v.appendChild(carteStat("velo", cap(nomSport(REPRISE.sport)), "Dernière sortie", null, esc(cap(jourLong(V.dernier))) + "."));
}

/* Le tour de taille, relevé ici : il part au coach comme un retour, et le
   prochain se redemande tout seul deux semaines plus tard. */
function releverTaille() {
  ouvrirFeuille("Tour de taille", f => {
    f.appendChild(el("div", "mtx", "Pour que deux mesures se comparent, toujours dans les mêmes conditions :"));
    const u = el("ul", "conseils");
    for (const x of ["Le matin, à jeun.", "Debout, détendu, en fin d'expiration normale : sans rentrer le ventre.",
      "Mètre ruban à la hauteur du nombril, bien horizontal, posé sur la peau sans la serrer.", "Deux mesures : note la moyenne."]) u.appendChild(el("li", "", esc(x)));
    f.appendChild(u);
    const l = el("div", "taille");
    const i = el("input", "txt num");
    i.id = "iTaille";
    i.setAttribute("type", "text"); i.setAttribute("inputmode", "decimal"); i.setAttribute("autocomplete", "off");
    i.setAttribute("placeholder", "84,5"); i.setAttribute("aria-label", "Tour de taille en centimètres");
    l.appendChild(i); l.appendChild(el("span", "", "cm"));
    f.appendChild(l);
    const der = mesuresToutes().slice(-1)[0];
    if (der) f.appendChild(el("div", "fnote", "Dernière mesure : " + fmt1(der.cm) + " cm, " + esc(jourLong(der.d)) + ".")).style.margin = "8px 4px 0";
    const go = el("button", "btn", "Enregistrer");
    const msg = el("div", "envoi");
    go.onclick = async () => {
      const x = parseFloat(String(i.value || "").replace(",", ".").replace(/[^\d.]/g, ""));
      if (!(x >= 40 && x <= 200)) { msg.textContent = "Entre ton tour de taille en centimètres, par exemple 84,5."; return; }
      const r = { type:"mesure", d:AUJ, tour_taille:Math.round(x * 10) / 10, ecrit:horo() };
      go.disabled = true; msg.textContent = "Envoi…";
      const res = await envoyer(r);
      msg.textContent = res === "ok" ? "Enregistré : " + fmt1(r.tour_taille) + " cm. Le coach le lira ; la prochaine mesure se redemandera dans deux semaines."
                                     : "Pas de réseau : ta mesure est gardée et partira toute seule.";
      go.disabled = false;
      rafraichir();
    };
    f.appendChild(go); f.appendChild(msg);
  });
}

/* Les cartes détaillées (graphique, explication) : elles s'ouvrent au toucher depuis le
   tableau de bord. Elles ne dessinent rien quand la donnée manque. */
const DETAIL_PROG = {
  regularite:v => { const S = semainesObjectifs(); if (S) carteRegularite(v, S); },
  moteur:v => carteMoteur(v),
  ventre:v => { const S = semainesObjectifs(); if (S) carteVentre(v, S); },
  gainage:v => { const S = semainesObjectifs(); if (S) carteVentre(v, S); },
  velo:v => carteVelo(v),
  sommeil:v => blocTendances(v, "sommeil"),
  nuits:v => blocTendances(v, "nuits"),
  vfc:v => blocTendances(v, "vfc"),
  charge:v => blocTendances(v, "charge"),
  semaines:v => blocSemaines(v),
  serie:v => {
    if (!D.serie || !D.serie.length) return;
    v.appendChild(el("h2", "", "Ta régularité"));
    const g = el("div", "gr");
    for (const r of D.serie) g.appendChild(el("div", "tu",
      '<div class="tul">' + esc(cap(String(r.l).toLowerCase())) + '</div><div class="tuv" style="color:' + (r.c || "var(--t1)") + '">' +
      esc(r.v) + '</div><div class="tud">' + esc(r.d) + "</div>"));
    v.appendChild(g);
  },
  pred:v => {
    if (!D.pred || !D.pred.length) return;
    const h = el("div", "sth"); h.style.marginTop = "26px";
    h.appendChild(el("h2", "", "Ce que tu vaux aujourd'hui")).style.margin = "0";
    const q = el("button", "aide", "?"); q.setAttribute("aria-label", "Comprendre les estimations"); q.onclick = () => aide("pred");
    h.appendChild(q); v.appendChild(h);
    const g = el("div", "gr"); g.style.marginTop = "10px";
    for (const p of D.pred) g.appendChild(el("div", "tu",
      '<div class="tul">' + esc(p.l) + '</div><div class="tuv">' + esc(p.v) + "</div>" + (p.g ? '<div class="tug">' + esc(p.g) + "</div>" : "")));
    v.appendChild(g);
  },
  rec:v => {
    if (!D.rec || !D.rec.length) return;
    v.appendChild(el("h2", "", "Tes records"));
    const g = el("div", "gr");
    for (const r of D.rec) g.appendChild(el("div", "tu",
      '<div class="tul">' + esc(r.l) + '</div><div class="tuv">' + esc(r.v) + '</div><div class="tud">' + esc(r.d) + "</div>"));
    v.appendChild(g);
  }
};
function rendreDetail(id, v) { DETAIL_PROG[id](v); }
/* Ouvre une ou plusieurs cartes détaillées par-dessus la page. */
function ouvrirDetail(titre, ids) {
  ouvrirFeuille(titre, f => { for (const id of ids) DETAIL_PROG[id](f); });
}
/* La valeur en tête d'une carte détaillée et son repère : la même source que le graphique. */
function resumeCarte(id) {
  const t = el("div");
  try { DETAIL_PROG[id](t); } catch (e) { return null; }
  const st = t.querySelector(".stat"), v = st && st.querySelector(".stv");
  if (!v) return null;
  const chip = v.querySelector(".chip-e");
  return { v:String(v.innerHTML).split(" <span")[0], chip:chip ? chip.textContent : "", cls:chip ? (chip.getAttribute("class") || "").replace("chip-e", "").trim() : "" };
}
const TITRE_DETAIL = { regularite:TITRE_REG, gainage:"Ventre et gainage", ventre:"Ventre et gainage", velo:REPRISE ? cap(nomSport(REPRISE.sport)) : "Reprise", moteur:"Ton moteur",
  sommeil:"Sommeil", nuits:"Coucher et lever", vfc:"VFC nocturne", charge:"Charge", semaines:"Tes semaines", serie:"Ta régularité", pred:"Ce que tu vaux", rec:"Tes records" };

/* Les quatre tuiles de tête : ce qu'on regarde en premier, comme un tableau de bord. */
function tuilesProg(v) {
  const T = (D.tendances && D.tendances.jours) || [];
  const nuit = j => j.sg != null ? j.sg : j.sw;
  const tu = [];
  const S = semainesObjectifs(), cur = S && S[S.length - 1];
  if (cur) { const f = cur.l === lundiDe(AUJ) ? cur.course : 0;
    if (CIB.course) tu.push({ k:"regularite", l:"Courses", v:f + " / " + CIB.course, d:f >= CIB.course ? "objectif tenu" : "cette semaine", cls:f >= CIB.course ? "ok" : "", ids:["regularite"] }); }
  const m = resumeCarte("moteur");
  if (m) tu.push({ k:"moteur", l:"Moteur", v:m.v, d:"à " + FH + " bpm", ids:["moteur"] });
  const r7 = moyenne(T.slice(-7).map(nuit));
  if (r7 != null) tu.push({ k:"sommeil", l:"Sommeil", v:hm(Math.round(r7)), d:"moyenne 7 nuits", cls:r7 < 390 ? "warn" : r7 >= 420 ? "ok" : "", ids:["sommeil", "nuits"] });
  const c = resumeCarte("charge");
  if (c) tu.push({ k:"charge", l:"Charge", v:c.v, d:c.chip, cls:c.cls, ids:["charge", "semaines"] });
  if (!tu.length) return;
  const g = el("div", "tuiles");
  for (const x of tu) {
    const b = el("button", "tuile", '<div class="tl">' + esc(x.l) + '</div><div class="tv">' + x.v + '</div><div class="tdx' + (x.cls ? " " + x.cls : "") + '">' + esc(x.d || "") + "</div>");
    b.dataset.k = x.k;
    b.onclick = () => ouvrirDetail(TITRE_DETAIL[x.k], x.ids);
    g.appendChild(b);
  }
  v.appendChild(el("h2", "", "Cette semaine"));
  v.appendChild(g);
}
/* Une ligne d'objectif : titre, barre de progression, valeur. */
function ligneObjectif(id) {
  const S = semainesObjectifs();
  let titre = "", val = "", pct = null, cls = "";
  if (id === "regularite" && S) { const n = S.filter(w => w.course >= CIB.course).length; titre = TITRE_REG; val = n + " sur " + S.length + " sem."; pct = n / S.length; }
  else if (id === "gainage" && S) { const n = S.filter(w => w.renfo >= CIB.renfo).length; titre = CIB.renfo > 1 ? "Gainage " + CIB.renfo + " fois par semaine" : "Gainage chaque semaine"; val = n + " sur " + S.length + " sem."; pct = n / S.length; }
  else if (id === "ventre" && S) {
    const M = mesuresToutes(), der = M[M.length - 1];
    titre = "Tour de taille";
    if (der) {
      const e = M.length >= 2 ? Math.round((der.cm - M[0].cm) * 10) / 10 : 0;
      val = fmt1(der.cm).replace(/,0$/, "") + " cm" + (e ? " · " + (e > 0 ? "+" : "−") + fmt1(Math.abs(e)).replace(/,0$/, "") : "");
      cls = e < 0 ? "ok" : e > 0 ? "warn" : "";
      const demandee = (D.echeances || []).some(e => e.attente && /tour de taille/i.test(e.l) && e.d > der.d);
      if (decale(der.d, 14) <= AUJ || demandee) { val += " · à relever"; cls = "warn"; }
    } else { val = "à relever"; cls = "warn"; }
  } else if (id === "velo") {
    const V = D.objectifs && D.objectifs.velo;
    if (!REPRISE || !V || !(V.attente || V.dernier)) return null;
    titre = REPRISE.titre; val = V.attente ? "en pause" : "repris"; cls = V.attente ? "warn" : "ok";
  }
  if (!titre) return null;
  const b = el("button", "obj", '<div class="oh"><span>' + esc(titre) + '</span><span class="ov' + (cls ? " " + cls : "") + '">' + esc(val) + ' <b class="chev">›</b></span></div>' +
    (pct != null ? '<div class="barre"><i style="width:' + Math.round(pct * 100) + '%"></i></div>' : ""));
  b.dataset.k = id;
  b.onclick = () => ouvrirDetail(TITRE_DETAIL[id], [id]);
  return b;
}
/* Une ligne de détail : titre, valeur du moment, le graphique au toucher. */
function ligneDetail(id) {
  let val = "";
  if (id === "serie" || id === "pred" || id === "rec") {
    const L = D[id];
    if (!L || !L.length) return null;
    val = id === "rec" ? L.length + " record" + (L.length > 1 ? "s" : "") : id === "pred" ? cap(String(L[0].l).toLowerCase()) + " en " + L[0].v : "";
  } else {
    const r = resumeCarte(id);
    if (!r) return null;
    val = r.v;
  }
  const b = el("button", "ligne nav det", "<span>" + esc(TITRE_DETAIL[id]) + "</span><span>" + val + ' <b class="chev">›</b></span>');
  b.dataset.k = id;
  b.onclick = () => ouvrirDetail(TITRE_DETAIL[id], [id]);
  return b;
}
function vueProg() {
  const v = $("#vProg"); v.innerHTML = "";
  v.appendChild(el("h1", "", "Progrès"));
  tuilesProg(v);
  /* Puis les objectifs, la forme et les repères, dans l'ordre choisi dans les réglages. */
  let groupe = null, boite = null;
  for (const b of blocsVisibles("prog")) {
    const l = b.g === "objectifs" ? ligneObjectif(b.id) : ligneDetail(b.id);
    if (!l) continue;
    if (b.g !== groupe) {
      v.appendChild(el("h2", "", NOM_GROUPE[b.g]));
      boite = el("div", b.g === "objectifs" ? "objs" : "grp lignes");
      v.appendChild(boite);
      groupe = b.g;
    }
    boite.appendChild(l);
  }
  if (D.sources) v.appendChild(el("footer", "", esc(D.sources)));
}

/* ==========================================================================
   8. Détail d'une séance
   ========================================================================== */
function pousserHisto() { if (typeof history !== "undefined" && history.pushState) history.pushState({ det:1 }, ""); }
function ouvrirDet() {
  $("#det").classList.add("on");
  $("#det").scrollTop = 0;
  document.body.style.overflow = "hidden";
  pousserHisto();
}
function ouvrir(s) {
  const fam = famOf(s), F = FA(fam), e = etatDe(s);
  $("#dh").style.background = "linear-gradient(160deg," + F.a + "," + F.a + " 40%," + F.b + ")";
  $("#dh").innerHTML = '<div class="dhb"><button id="dret" aria-label="Retour">' + I.fle + '</button><div class="dhj">' +
    esc(cap(jourLong(s.d))) + '</div><div style="width:36px"></div></div>' +
    '<div class="dhf">' + icoSport(fam) + esc(nomSport(fam)) + (s.horsPlan ? " · hors plan" : "") + '</div><div class="dht">' + esc(nomSeance(s.t)) + "</div>" +
    '<div class="dhm">' + (s.duree ? "<span>" + I.hor + esc(s.duree) + "</span>" : "") + (s.km ? "<span>" + I.rte + esc(s.km) + " km</span>" : "") + "</div>" +
    profil(s, true);
  $("#dret").onclick = fermer;

  const b = $("#db"); b.innerHTML = "";
  if (e === "fait" || e === "manque" || surMontre(s)) b.appendChild(el("div", "", puceEtat(s, e))).style.marginBottom = "14px";

  if (s.reel && s.reel.length) {
    const r = el("div", "pq");
    r.style.borderTop = "0"; r.style.paddingTop = "0";
    r.appendChild(el("div", "pqh", s.auto ? "Ce que ta montre a enregistré" : "Ce que tu as fait"));
    const m = el("div", "reel"); m.style.borderTop = "0"; m.style.marginTop = "0"; m.style.paddingTop = "4px"; m.style.flexWrap = "wrap";
    for (const x of s.reel) m.appendChild(el("div", "", '<div class="rl">' + esc(cap(String(x.l).toLowerCase())) + '</div><div class="rv">' + esc(x.v) + "</div>"));
    r.appendChild(m);
    if (s.x && s.x.length) r.appendChild(el("div", "mtx", s.x.map(esc).join("<br>"))).style.marginTop = "10px";
    b.appendChild(r);
  }
  const an = analyseDe(s);
  if (an) blocSortie(an, b);
  if (guidable(s)) {
    const g = el("button", "btn", I.jouer + "Lancer le gainage guidé");
    g.id = "bGainage";
    g.onclick = () => lancerGainage(s);
    b.appendChild(g).style.margin = "0 0 18px";
  }

  for (const bl of etapesVue(s)) {
    const box = el("div", "bl");
    const h = el("div", "blh", bl.bloc ? I.rep + "Répéter × " + bl.rep :
      bl.r === "echauf" ? "Échauffement" : bl.r === "calme" ? "Retour au calme" : "Corps de séance");
    if (bl.r === "corps" || bl.bloc) h.style.color = F.a;
    box.appendChild(h);
    const c = el("div", "blc");
    for (const p of (bl.bloc ? bl.pas : [bl])) c.appendChild(el("div", "pa", '<div class="pan">' + p.n + '</div><div class="pab"><div class="pat">' +
      esc(p.t) + "</div>" + (p.c ? '<div class="pac">' + esc(p.c) + "</div>" : "") + "</div>"));
    box.appendChild(c);
    b.appendChild(box);
  }

  if (s.pourquoi) b.appendChild(el("div", "pq", '<div class="pqh">Pourquoi cette séance</div><div class="mtx">' + esc(s.pourquoi) + "</div>"));
  if (!s.reel && s.x && s.x.length) b.appendChild(el("div", "pq", '<div class="pqh">Les consignes</div><div class="mtx">' + s.x.map(esc).join("<br>") + "</div>"));

  if (fam !== "repos" && s.d <= AUJ) formRetour(s, b);
  if (surMontre(s) && e === "afaire") b.appendChild(el("div", "astuce", fam === "renfo"
    ? "Deux façons de la faire guidé : le gainage guidé ci-dessus, téléphone posé au sol (minuteur, bips et voix), ou depuis le calendrier de ta montre. Le retour au coach part tout seul avec le téléphone."
    : "Lance-la depuis le calendrier de ta montre : c'est comme ça que les alertes de fréquence cardiaque se déclenchent.")).style.marginTop = "14px";
  ouvrirDet();
}
function fermer() {
  $("#det").classList.remove("on");
  document.body.style.overflow = "";
}

/* L'analyse d'une sortie, calculée à la collecte depuis le fichier de la montre :
   le plafond a-t-il été tenu, km par km, et à quelle allure le cœur était à 140/150. */
function blocSortie(a, b) {
  const w = el("div", "pq sortie");
  w.style.borderTop = "0"; w.style.paddingTop = "0";
  w.appendChild(el("div", "pqh", "Ta sortie, kilomètre par kilomètre"));
  if (a.plafond && a.pctSous != null) {
    const ok = a.pctSous >= 90;
    w.appendChild(el("div", "verdict " + (ok ? "ok" : "warn"), "<b>Plafond " + a.plafond + (ok ? " tenu" : " dépassé") + "</b> : " + a.pctSous +
      " % du temps sous " + a.plafond + ", " + a.kmSous + " km sur " + a.km.length + "." +
      (ok ? "" : " Le cœur est monté au-dessus : la prochaine fois, ralentis ou marche dès qu'il approche du plafond.")));
  }
  /* La courbe du cœur, minute par minute, avec le plafond en pointillés. */
  const S = a.serie || [];
  if (S.length > 4) {
    const tmax = S[S.length - 1][0] || 1, fcs = S.map(p => p[1]);
    const bas = Math.floor((Math.min(...fcs) - 5) / 10) * 10, haut = Math.ceil((Math.max(...fcs, a.plafond || 0) + 5) / 10) * 10;
    const pasT = tmax > 75 ? 20 : tmax > 35 ? 10 : 5, xt = [];
    for (let m = pasT; m < tmax - pasT / 3; m += pasT) xt.push({ f:m / tmax, l:m + "'" });
    w.appendChild(graphe({ titre:"Fréquence cardiaque pendant la sortie", x:S.map(p => p[0]), xpos:S.map(p => p[0] / tmax), xticks:xt,
      s:fcs, type:"ligne", c:"#E11D48", points:false, min:bas, max:haut, repere:a.plafond || null, h:140,
      ticks:a.plafond ? [bas, a.plafond, haut] : [bas, Math.round((bas + haut) / 20) * 10, haut], fmt:t => String(t),
      lib:i => "<b>" + S[i][1] + " bpm</b> à " + Math.round(S[i][0]) + " min" + (a.plafond && S[i][1] > a.plafond ? " · au-dessus du plafond" : "") }));
    if (a.plafond) w.appendChild(el("div", "leg", '<span><i class="tiret"></i>Ton plafond : ' + a.plafond + " bpm</span>"));
  }
  /* Le tableau des kilomètres : plus la barre est longue, plus le km est rapide. */
  const K = a.km.filter(k => k.p);
  if (K.length) {
    const t = el("div", "kms");
    t.appendChild(el("div", "kmr kmh", "<span>Km</span><span>Allure</span><span></span><span>FC</span>"));
    const pmin = Math.min(...K.map(k => k.p)), pmax = Math.max(...K.map(k => k.p));
    for (const k of K) {
      const larg = pmax > pmin ? Math.round(30 + 70 * (pmax - k.p) / (pmax - pmin)) : 100;
      const dessus = a.plafond && k.fc > a.plafond;
      t.appendChild(el("div", "kmr" + (dessus ? " dessus" : ""), "<span>" + (k.partiel ? fmt1(k.m / 1000) : k.n) + "</span><span>" + allureTxt(k.p) +
        (k.dp >= 10 ? " <small>+" + k.dp + " m</small>" : "") + '</span><span class="kmb"><i style="width:' + larg + '%"></i></span><span>' + (k.fc || "—") + "</span>"));
    }
    w.appendChild(t);
    if (a.plafond && K.some(k => k.fc > a.plafond)) w.appendChild(el("div", "fnote", "En couleur : les kilomètres courus au-dessus de ton plafond de " + a.plafond + ".")).style.margin = "6px 0 0";
  }
  /* Le moteur : la mesure de progrès, sortie après sortie. */
  const m = [];
  if (a.a150) m.push("à " + FH + " bpm, tu courais à <b>" + allureTxt(a.a150) + " /km</b>");
  if (a.a140) m.push("à " + FB + " bpm, à <b>" + allureTxt(a.a140) + " /km</b>");
  w.appendChild(el("div", "mtx", m.length ? cap(m.join(" ; ")) + ". C'est ta mesure de progrès : à cœur égal, plus vite = moteur plus fort (onglet Progrès)."
    : "Pas assez de temps passé autour de " + FB + " ou de " + FH + " bpm pour mesurer ton moteur sur cette sortie : il faut au moins 8 minutes autour de la valeur, échauffement exclu.")).style.marginTop = "12px";
  if (a.derive != null) w.appendChild(el("div", "mtx", "Dérive cardiaque : <b>" + fmt1(a.derive) + " %</b>. " + (a.derive < 5
    ? "À allure égale, ton cœur est resté stable d'une moitié à l'autre : l'endurance tient sur cette durée."
    : "À allure égale, ton cœur a grimpé en seconde moitié : chaleur, hydratation, ou sortie un peu longue pour ta forme du moment."))).style.marginTop = "8px";
  b.appendChild(w);
}

/* ==========================================================================
   9. Écrire au coach (retours et notes)
   ========================================================================== */
let JETON = null;
async function jeton() {
  if (JETON) return JETON;
  if (typeof CLE === "undefined" || !CLE || typeof crypto === "undefined" || !crypto.subtle) return null;
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("retour:" + CLE)));
  JETON = btoa(String.fromCharCode.apply(null, h)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return JETON;
}
async function api(chemin, opt) {
  const j = await jeton();
  if (!j || !avecReseau) return null;
  try {
    const o = Object.assign({}, opt || {});
    o.headers = Object.assign({ "Content-Type":"application/json", "X-Coach":j }, o.headers || {});
    return await fetch(chemin, o);
  } catch (e) { return null; }
}
async function poster(r) {
  const rep = await api(D.retour || "/api/retour", { method:"POST", body:JSON.stringify(r) });
  return !!(rep && rep.ok);
}
/* Une saisie s'affiche dès qu'elle part (ENVOI), puis rejoint ATTENTE (reçue par
   le serveur) ou la file locale (pas de réseau). */
let ENVOI = [];
async function envoyer(r) {
  ENVOI.push(r);
  let res = "attente";
  if (await poster(r)) { ATTENTE.push(Object.assign({ recu:new Date().toISOString() }, r)); res = "ok"; }
  else { const f = stock.lire("coach-file", []); f.push(r); stock.ecrire("coach-file", f); }
  ENVOI = ENVOI.filter(x => x !== r);
  return res;
}
async function vider() {
  const f = stock.lire("coach-file", []);
  if (!f.length) return;
  const reste = [];
  for (const r of f) { if (await poster(r)) ATTENTE.push(Object.assign({ recu:new Date().toISOString() }, r)); else reste.push(r); }
  stock.ecrire("coach-file", reste);
  if (reste.length !== f.length) rafraichir();
}
async function chargerAttente() {
  const rep = await api(D.retour || "/api/retour", { method:"GET" });
  if (!rep || !rep.ok) return;
  try { const j = await rep.json(); ATTENTE = (j && j.retours) || []; rafraichir(); } catch (e) {}
}
const horo = () => { const d = maintenant(); return iso(d) + " " + String(d.getHours()).padStart(2, "0") + "h" + String(d.getMinutes()).padStart(2, "0"); };

function choix(lab, opts, quand) {
  const w = el("div", "rq");
  w.appendChild(el("div", "rql", esc(lab)));
  const c = el("div", "chips" + (opts.length > 6 ? " serre" : ""));
  let val = null;
  const bs = [];
  for (const o of opts) {
    const b = el("button", "chip", esc(o.l));
    b.type = "button";
    b.onclick = () => {
      val = val === o.v ? null : o.v;
      for (const x of bs) x.classList.toggle("on", val !== null && x === b);
      if (quand) quand(val);
    };
    bs.push(b); c.appendChild(b);
  }
  w.appendChild(c);
  return { w, val:() => val };
}

function formRetour(s, b) {
  const f = el("div", "pq ret");
  const deja = retourDe(s);
  f.appendChild(el("div", "pqh", deja ? "Ton retour" : "Comment ça s'est passé ?"));
  if (deja) f.appendChild(el("div", "mtx", esc(resumeRetour(deja)) + "<br>Tu peux en renvoyer un : le coach lira le plus récent.")).style.marginBottom = "12px";
  const raisons = choix("Pourquoi ?", [{ l:"Pas le temps", v:"pas le temps" }, { l:"Fatigue", v:"fatigue" }, { l:"Douleur", v:"douleur" },
    { l:"Météo", v:"météo" }, { l:"Autre", v:"autre" }]);
  raisons.w.style.display = "none";
  const fait = choix("Séance", [{ l:"Faite", v:"fait" }, { l:"Pas faite", v:"pas fait" }, { l:"En partie", v:"en partie" }],
    v => { raisons.w.style.display = v === "pas fait" || v === "en partie" ? "" : "none"; });
  const sens = choix("Sensation sur 10", [1,2,3,4,5,6,7,8,9,10].map(n => ({ l:String(n), v:n })));
  const dou = choix("Douleur", [{ l:"Aucune", v:"aucune" }, { l:"Légère", v:"légère" }, { l:"Forte", v:"forte" }]);
  const txt = el("textarea", "txt");
  txt.setAttribute("rows", "3");
  txt.setAttribute("placeholder", "Où, comment, un mot pour le coach (facultatif)");
  const go = el("button", "btn", "Envoyer au coach");
  const msg = el("div", "envoi");
  go.onclick = async () => {
    const r = { type:"seance", d:s.d, t:s.t, fait:fait.val(), raison:raisons.val(), sensation:sens.val(), douleur:dou.val(),
                note:String(txt.value || "").trim().slice(0, 1200), ecrit:horo() };
    if (!r.fait && !r.sensation && !r.douleur && !r.note) { msg.textContent = "Rien à envoyer : choisis au moins une case."; return; }
    go.disabled = true; msg.textContent = "Envoi…";
    const res = await envoyer(r);
    msg.textContent = res === "ok" ? "Envoyé. La séance est à jour sur la page ; le coach le lira à son prochain passage." : "Pas de réseau : ton retour partira tout seul à la prochaine ouverture de la page.";
    if (r.douleur === "forte") msg.textContent += " Douleur forte : fais-toi examiner avant la prochaine séance.";
    go.disabled = false;
    rafraichir();
  };
  for (const x of [fait.w, raisons.w, sens.w, dou.w, txt, go, msg]) f.appendChild(x);
  b.appendChild(f);
}

function ecrireAuCoach(k, pre) {
  k = k || AUJ;
  $("#dh").style.background = "linear-gradient(160deg,#1C2A4A,#0F1A33)";
  $("#dh").innerHTML = '<div class="dhb"><button id="dret" aria-label="Retour">' + I.fle + '</button><div class="dhj">' + esc(cap(jourLong(AUJ))) +
    '</div><div style="width:36px"></div></div><div class="dhf">Message</div><div class="dht">Écrire au coach</div>';
  $("#dret").onclick = fermer;
  const b = $("#db"); b.innerHTML = "";
  b.appendChild(el("div", "mtx", "Une douleur, une nuit blanche, une envie de déplacer une séance : écris-le ici. Ça s'affiche tout de suite sur la page, et le coach le lit à son prochain point. Pour une réponse immédiate, passe par Parler."));
  const txt = el("textarea", "txt");
  txt.setAttribute("rows", "6");
  txt.setAttribute("placeholder", "Ce que tu veux que le coach sache");
  txt.style.marginTop = "14px";
  if (typeof pre === "string") txt.value = pre;
  const go = el("button", "btn", "Envoyer au coach");
  const msg = el("div", "envoi");
  go.onclick = async () => {
    const note = String(txt.value || "").trim().slice(0, 2000);
    if (!note) { msg.textContent = "Écris d'abord quelque chose."; return; }
    go.disabled = true; msg.textContent = "Envoi…";
    const res = await envoyer({ type:"note", d:AUJ, note, ecrit:horo() });
    msg.textContent = res === "ok" ? "Envoyé. Ton message est sur la page du jour." : "Pas de réseau : ton message partira tout seul à la prochaine ouverture de la page.";
    if (res === "ok") txt.value = "";
    go.disabled = false;
    rafraichir();
  };
  for (const x of [txt, go, msg]) b.appendChild(x);
  ouvrirDet();
}

/* ==========================================================================
   10. Feuilles : réglages et mise à jour
   ========================================================================== */
function ouvrirFeuille(titre, remplir) {
  const f = $("#fc"); f.innerHTML = "";
  f.appendChild(el("div", "poignee"));
  const h = el("div", "fh", "<h3>" + esc(titre) + '</h3><button id="fFerme" aria-label="Fermer">' + I.ferme + "</button>");
  f.appendChild(h);
  remplir(f);
  $("#feuille").classList.add("on");
  $("#fFerme").onclick = fermerFeuille;
  pousserHisto();
}
function fermerFeuille() { $("#feuille").classList.remove("on"); }

const THEMES = [{ v:"auto", l:"Auto" }, { v:"light", l:"Clair" }, { v:"dark", l:"Sombre" }];
function appliquerTheme(t) {
  const r = document.documentElement;
  if (!r || !r.setAttribute) return;
  if (t === "light" || t === "dark") r.setAttribute("data-theme", t); else if (r.removeAttribute) r.removeAttribute("data-theme");
}
/* ==========================================================================
   11 bis. Pages à la carte : ce qu'affichent Jour et Progrès, et dans quel ordre.
   Réglé dans Réglages → Personnaliser, gardé sur cet iPhone (« coach-pages »).
   Un bloc ajouté plus tard à l'application apparaît à sa place par défaut.
   ========================================================================== */
const BLOCS = {
  jour:[
    { id:"seances", l:"Ta séance du jour", d:"Toujours en tête", fixe:true, tete:true },
    { id:"forme", l:"Ta forme", d:"Feu du jour, chiffres du matin, check-in" },
    { id:"mot", l:"Le mot du coach", d:"Sa consigne, le reste au toucher" },
    { id:"semaine", l:"Ta semaine", d:"Séances faites, la suivante, ta course" },
    { id:"attentes", l:"À régler", d:"Compte rendu, mesure : une ligne" },
    { id:"messages", l:"Tes messages au coach", d:"Et le bouton « Écrire au coach »" }
  ],
  prog:[
    { id:"regularite", g:"objectifs", l:TITRE_REG, si:CIB.course > 0 },
    { id:"gainage", g:"objectifs", l:CIB.renfo > 1 ? "Gainage " + CIB.renfo + " fois par semaine" : "Gainage chaque semaine", si:CIB.renfo > 0 },
    { id:"ventre", g:"objectifs", l:"Tour de taille", si:!!OBJ.ventre },
    { id:"velo", g:"objectifs", l:REPRISE ? REPRISE.titre : "Reprise", si:!!REPRISE },
    { id:"sommeil", g:"forme", l:"Sommeil" },
    { id:"nuits", g:"forme", l:"Coucher et lever" },
    { id:"vfc", g:"forme", l:"VFC nocturne" },
    { id:"charge", g:"forme", l:"Charge" },
    { id:"semaines", g:"forme", l:"Tes semaines" },
    { id:"moteur", g:"forme", l:"Ton moteur", d:"Allure à " + FH + " bpm" },
    { id:"serie", g:"reperes", l:"Ta régularité" },
    { id:"pred", g:"reperes", l:"Ce que tu vaux" },
    { id:"rec", g:"reperes", l:"Tes records" }
  ]
};
const GROUPES = { objectifs:"Tes objectifs", forme:"Ta forme" };
const NOM_GROUPE = { objectifs:"Tes objectifs", forme:"Ta forme", reperes:"Tes repères" };
const NOM_PAGE = { jour:"Page Jour", prog:"Page Progrès" };
const pagesPerso = () => stock.lire("coach-pages", {}) || {};
/* Tous les blocs d'une page, dans l'ordre choisi, avec leur visibilité. Les groupes de
   Progrès gardent leur ordre (objectifs, forme, repères) : on range à l'intérieur. */
function blocsOrdonnes(page) {
  const def = BLOCS[page], st = pagesPerso()[page] || {};
  const ordre = (st.ordre || []).filter(id => def.some(b => b.id === id));
  def.forEach((b, i) => {
    if (ordre.includes(b.id)) return;
    const avant = def.slice(0, i).map(x => x.id).filter(id => ordre.includes(id)).pop();
    ordre.splice(avant ? ordre.indexOf(avant) + 1 : 0, 0, b.id);
  });
  const rang = g => ["objectifs", "forme", "reperes"].indexOf(g);
  const caches = new Set(st.caches || []);
  return ordre.map((id, i) => ({ b:def.find(x => x.id === id), i }))
    .sort((x, y) => ((y.b.tete ? 1 : 0) - (x.b.tete ? 1 : 0)) || (rang(x.b.g) - rang(y.b.g)) || (x.i - y.i))
    .map(x => Object.assign({}, x.b, { vis:x.b.fixe || !caches.has(x.b.id) }));
}
const blocsVisibles = page => blocsOrdonnes(page).filter(b => b.vis);
function enregistrerPage(page, liste) {
  const P = pagesPerso();
  P[page] = { ordre:liste.map(b => b.id), caches:liste.filter(b => !b.vis).map(b => b.id) };
  stock.ecrire("coach-pages", P);
}

/* ==========================================================================
   11 ter. Réglages : un sommaire, puis une page par sujet.
   ========================================================================== */
/* Une page de réglages, dans la même feuille, avec le retour au sommaire. */
function sousPage(titre, remplir) {
  const f = $("#fc"); f.innerHTML = "";
  f.appendChild(el("div", "poignee"));
  const h = el("div", "fh");
  const r = el("button", "fretour", I.fle + "Réglages");
  r.id = "fRetour"; r.onclick = () => reglages();
  h.appendChild(r);
  const x = el("button", "", I.ferme); x.setAttribute("aria-label", "Fermer"); x.onclick = fermerFeuille;
  h.appendChild(x);
  f.appendChild(h);
  f.appendChild(el("h3", "fst", esc(titre)));
  remplir(f);
}
function ligneMenu(g, id, titre, detail, ouvrir) {
  const b = el("button", "ligne nav", "<span>" + esc(titre) + "</span><span>" + (detail ? esc(detail) : "") + ' <b class="chev">›</b></span>');
  b.id = id; b.onclick = ouvrir;
  g.appendChild(b);
  return b;
}
function reglages() {
  const deja = $("#feuille").classList.contains("on");
  const remplir = f => {
    const se = D.sourcesEtat || {};
    const nb = p => blocsVisibles(p).length + " sur " + BLOCS[p].length;
    f.appendChild(el("div", "grpt", "Personnaliser"));
    const g1 = el("div", "grp");
    ligneMenu(g1, "rPageJour", "Page Jour", nb("jour"), () => reglerPage("jour"));
    ligneMenu(g1, "rPageProg", "Page Progrès", nb("prog"), () => reglerPage("prog"));
    f.appendChild(g1);
    f.appendChild(el("div", "grpt", "Préférences"));
    const g2 = el("div", "grp");
    ligneMenu(g2, "rApparence", "Apparence", (THEMES.find(t => t.v === stock.lire("coach-theme", "auto")) || THEMES[0]).l, reglerApparence);
    ligneMenu(g2, "rNotifs", "Notifications", stock.lire("coach-notifs", null) ? "réglées" : "", () => sousPage("Notifications", sectionNotifs));
    const pc = stock.lire("coach-parler", null);
    ligneMenu(g2, "rParler", "Bouton Parler", pc && PARLER[pc] ? PARLER[pc].c || "choisi" : "à choisir", () => { fermerFeuille(); choisirParler(); });
    f.appendChild(g2);
    f.appendChild(el("div", "grpt", "Système"));
    const g3 = el("div", "grp");
    const ko = [se.garmin, se.withings, se.strava, se.sante].includes("failure");
    const lm = ligneMenu(g3, "rMontres", "Montres et données", ko ? "une montre en échec" : "à jour", reglerMontres);
    if (ko) lm.classList.add("alerte");
    ligneMenu(g3, "rCoach", "Ton coach", "horaires", reglerCoach);
    ligneMenu(g3, "rIcone", "Icône de l'écran d'accueil", "", reglerIcone);
    f.appendChild(g3);
    f.appendChild(el("footer", "", "Coach v2 · page générée " + esc(D.genere || "—")));
  };
  if (deja) {
    const f = $("#fc"); f.innerHTML = "";
    f.appendChild(el("div", "poignee"));
    const h = el("div", "fh", "<h3>Réglages</h3>");
    const x = el("button", "", I.ferme); x.id = "fFerme"; x.setAttribute("aria-label", "Fermer"); x.onclick = fermerFeuille;
    h.appendChild(x); f.appendChild(h);
    remplir(f);
  } else ouvrirFeuille("Réglages", remplir);
}
/* Personnaliser une page : un interrupteur pour afficher, deux flèches pour ranger. */
function reglerPage(page) {
  sousPage(NOM_PAGE[page], f => {
    f.appendChild(el("div", "fnote", page === "jour"
      ? "Choisis ce que la page Jour affiche, et dans quel ordre. Les alertes (page pas à jour, souci de collecte) restent toujours en haut."
      : "Les quatre tuiles du haut restent. Choisis les lignes en dessous et leur ordre, à l'intérieur de chaque groupe ; une ligne sans donnée ne s'affiche pas, même cochée.")).style.marginTop = "0";
    const zone = el("div", "perso-l");
    f.appendChild(zone);
    let liste = blocsOrdonnes(page);
    const dessiner = () => {
      zone.innerHTML = "";
      let g = null, grp = null;
      liste.forEach((b, i) => {
        if (!grp || b.g !== g) {
          if (b.g && NOM_GROUPE[b.g]) zone.appendChild(el("div", "grpt", NOM_GROUPE[b.g]));
          grp = el("div", "grp"); zone.appendChild(grp); g = b.g;
        }
        const l = el("div", "ligne bloc" + (b.vis ? "" : " off"));
        l.dataset.id = b.id;
        l.appendChild(el("span", "bt", esc(b.l) + (b.d ? '<small class="ls">' + esc(b.d) + "</small>" : "")));
        const memeGroupe = j => liste[j] && liste[j].g === b.g;
        const monter = el("button", "ord", "↑"), descendre = el("button", "ord", "↓");
        monter.setAttribute("aria-label", "Monter « " + b.l + " »"); descendre.setAttribute("aria-label", "Descendre « " + b.l + " »");
        monter.disabled = !!b.tete || !memeGroupe(i - 1) || !!liste[i - 1].tete; descendre.disabled = !!b.tete || !memeGroupe(i + 1);
        const bouger = d => { const t = liste[i]; liste[i] = liste[i + d]; liste[i + d] = t; enregistrerPage(page, liste); dessiner(); rafraichir(); };
        monter.onclick = () => bouger(-1); descendre.onclick = () => bouger(1);
        l.appendChild(monter); l.appendChild(descendre);
        const t = el("button", "bascule" + (b.vis ? " on" : "") + (b.fixe ? " fixe" : ""), "<i></i>");
        t.setAttribute("role", "switch"); t.setAttribute("aria-checked", String(!!b.vis)); t.setAttribute("aria-label", "Afficher « " + b.l + " »");
        t.disabled = !!b.fixe;
        t.onclick = () => { if (b.fixe) return; b.vis = !b.vis; enregistrerPage(page, liste); dessiner(); rafraichir(); };
        l.appendChild(t);
        grp.appendChild(l);
      });
    };
    dessiner();
    const raz = el("button", "lien", "Revenir à la page d'origine");
    raz.id = "bRaz";
    raz.onclick = () => { const P = pagesPerso(); delete P[page]; stock.ecrire("coach-pages", P); liste = blocsOrdonnes(page); dessiner(); rafraichir(); };
    f.appendChild(raz);
  });
}
function reglerApparence() {
  sousPage("Apparence", f => {
    const seg = el("div", "seg");
    const actuel = stock.lire("coach-theme", "auto");
    for (const t of THEMES) {
      const b = el("button", t.v === actuel ? "on" : "", t.l);
      b.dataset.t = t.v;
      b.onclick = () => {
        stock.ecrire("coach-theme", t.v); appliquerTheme(t.v);
        for (const x of seg.children) x.classList.toggle("on", x === b);
      };
      seg.appendChild(b);
    }
    f.appendChild(seg);
    f.appendChild(el("div", "fnote", "Auto suit le réglage de ton iPhone. Le bandeau du haut reste foncé pour que l'heure et la batterie restent lisibles."));
  });
}
function reglerMontres() {
  sousPage("Montres et données", f => {
    const se = D.sourcesEtat || {};
    const lib = v => v === "success" ? "reçue à la dernière collecte" : v === "failure" ? "en échec" : "non collectée";
    const gm = el("div", "grp");
    const lsrc = (nom, v) => gm.appendChild(el("div", "ligne", "<span>" + nom + "</span><span" + (v === "failure" ? ' style="color:var(--ko)"' : "") + ">" + lib(v) + "</span>"));
    if (SRC.garmin) lsrc("Garmin", se.garmin);
    if (SRC.withings) lsrc("Withings", se.withings);
    if (SRC.strava === "api") lsrc("Strava", se.strava);
    if (SRC.apple_sante) lsrc("Apple Santé", se.sante);
    if (!NOMS_SOURCES.length) gm.appendChild(el("div", "ligne", "<span>Montre</span><span>aucune : check-in et séances déclarées</span>"));
    if (se.quand) gm.appendChild(el("div", "ligne", "<span>Dernière collecte</span><span>" + esc(String(se.quand).slice(11, 16).replace(":", "h")) + "</span>"));
    f.appendChild(gm);
    /* Le bouton n'apparaît que quand Withings échoue : tant que tout marche, il n'a rien à faire là. */
    if (SRC.withings && se.withings && se.withings !== "success") {
      const wb = el("button", "btn", "Reconnecter Withings");
      wb.id = "bWithings";
      const wm = el("div", "envoi");
      wb.onclick = () => reconnecterWithings(wb, wm);
      f.appendChild(wb); f.appendChild(wm);
      f.appendChild(el("div", "fnote", "Touche ce bouton : tu te connectes chez Withings, tu acceptes, et la collecte repart toute seule.")).style.marginTop = "10px";
    }
    /* Strava : le bouton reste là tant que la collecte n'a rien reçu. */
    if (SRC.strava === "api" && se.strava !== "success") {
      const sb = el("button", "btn", "Connecter Strava");
      sb.id = "bStrava";
      const sm = el("div", "envoi");
      sb.onclick = () => connecterSource("strava", "Strava", sb, sm);
      f.appendChild(sb); f.appendChild(sm);
      f.appendChild(el("div", "fnote", "Touche ce bouton : tu te connectes chez Strava, tu acceptes (activités privées comprises), et la collecte part toute seule.")).style.marginTop = "10px";
    }
    if (SRC.apple_sante) {
      const hb = el("button", "btn creux", "Raccourci Apple Santé");
      hb.id = "bSante";
      hb.onclick = () => sousPage("Apple Santé", sectionSante);
      f.appendChild(hb);
    }
    const a = el("button", "btn creux", "Mise à jour de la page");
    a.onclick = () => { fermerFeuille(); miseAJour(); };
    f.appendChild(a);
  });
}
function reglerCoach() {
  sousPage("Ton coach", f => {
    const g = el("div", "grp");
    g.appendChild(el("div", "ligne", "<span>Point du matin</span><span>7h27, en notification Claude</span>"));
    g.appendChild(el("div", "ligne", "<span>Débrief du soir</span><span>20h23</span>"));
    g.appendChild(el("div", "ligne", "<span>Bilan et plan de la semaine</span><span>dimanche 17h54</span>"));
    g.appendChild(el("div", "ligne", "<span>Collecte des montres</span><span>~6h45 et ~20h15</span>"));
    g.appendChild(el("div", "ligne", "<span>Quand tu écris ou actualises</span><span>il relit et réécrit son mot</span>"));
    f.appendChild(g);
  });
}
function reglerIcone() {
  sousPage("Icône de l'écran d'accueil", f => {
    const ci = el("button", "btn creux", "Copier le lien de la page");
    ci.id = "bLien";
    const cm = el("div", "envoi");
    ci.onclick = async () => {
      try { await navigator.clipboard.writeText(location.href); cm.textContent = "Lien copié. Colle-le dans Safari, puis Partager → Sur l'écran d'accueil. Supprime ensuite l'ancienne icône."; }
      catch (e) { cm.textContent = "Copie impossible ici : ouvre la page depuis le lien d'origine dans Safari."; }
    };
    f.appendChild(ci); f.appendChild(cm);
    f.appendChild(el("div", "fnote", "L'iPhone garde l'icône choisie au moment de l'ajout : pour avoir la nouvelle, il faut rajouter la page à l'écran d'accueil. Le lien contient ta clé : ne le partage pas. Tes choix de pages, de thème et de notifications sont gardés par l'icône : après une réinstallation, refais-les.")).style.marginTop = "10px";
  });
}

/* Connexion d'un service à autorisation (Strava) : même chemin que Withings. */
async function connecterSource(id, nom, b, m) {
  b.disabled = true; m.textContent = "Préparation…";
  const rep = await api("/api/" + id + "/debut", { method:"POST", body:"{}" });
  if (rep && rep.ok) {
    try { const j = await rep.json(); m.textContent = "Ouverture de " + nom + "…"; location.href = j.url; return; } catch (e) {}
  }
  m.textContent = rep && rep.status === 501 ? "Pas encore disponible : l'application " + nom + " n'est pas configurée (installation)." : "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.";
  b.disabled = false;
}
/* Apple Santé : ce que le raccourci de l'iPhone doit connaître (adresse et jeton). Le
   jeton se dérive de la clé de la page et ne permet QUE d'envoyer ces données. */
async function jetonSante() {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("sante:" + CLE)));
  return btoa(String.fromCharCode.apply(null, h)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function sectionSante(f) {
  const se = D.sourcesEtat || {};
  f.appendChild(el("div", "fnote", "Chaque matin, un raccourci de ton iPhone envoie ta nuit, ta FC de repos, ta VFC et tes séances d'Apple Santé (Apple Watch, Oura, Whoop, Polar, Coros… tout ce qui écrit dans Santé). " +
    (se.sante === "success" ? "Il marche : la dernière collecte a reçu tes données." : "Ton coach Claude t'aide à le créer : il te faut ces deux valeurs."))).style.marginTop = "0";
  const g = el("div", "grp");
  const adr = location.origin + "/api/sante";
  const champ = (id, lib, val) => {
    const l = el("div", "ligne", "<span>" + lib + "<small class=\"ls\">" + esc(val) + "</small></span>");
    const b = el("button", "lien", "Copier");
    b.id = id;
    b.onclick = async () => { try { await navigator.clipboard.writeText(val); b.textContent = "Copié"; } catch (e) { b.textContent = "Copie impossible"; } };
    l.appendChild(b); g.appendChild(l);
  };
  champ("bSanteAdr", "Adresse", adr);
  f.appendChild(g);
  jetonSante().then(j => { champ("bSanteJeton", "Jeton (en-tête X-Coach-Sante)", j); }).catch(() => {});
  f.appendChild(el("div", "fnote", "Le jeton ne permet que d'envoyer ces données : il n'ouvre pas ta page. Ne le partage pas pour autant.")).style.marginTop = "10px";
}

async function reconnecterWithings(b, m) {
  b.disabled = true; m.textContent = "Préparation…";
  const rep = await api("/api/withings/debut", { method:"POST", body:"{}" });
  if (rep && rep.ok) {
    try { const j = await rep.json(); m.textContent = "Ouverture de Withings…"; location.href = j.url; return; } catch (e) {}
  }
  m.textContent = rep && rep.status === 501 ? "Pas encore disponible : les identifiants Withings ne sont pas configurés." : "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.";
  b.disabled = false;
}

/* Âge de la page, pour la pastille de l'heure. */
function agePage() { const t = Date.parse(D.version || ""); return isNaN(t) ? null : (maintenant() - t) / 3600000; }
function pastille() {
  const a = agePage(), p = $("#majPt");
  $("#majH").textContent = (D.genere || "").slice(-5) || "—";
  p.className = demandeEnCours() ? "encours" : a != null && a > 14 ? "vieux" : "";
}
const demandeEnCours = () => { const t = stock.lire("coach-actualiser", 0); return t && Date.now() - t < 12 * 60 * 1000; };

function miseAJour() {
  ouvrirFeuille("Mise à jour", f => {
    const g = el("div", "grp");
    g.appendChild(el("div", "ligne", "<span>Page générée</span><span>" + esc(D.genere || "—") + "</span>"));
    const md = D.motDate;
    if (md) g.appendChild(el("div", "ligne", "<span>Dernier mot du coach</span><span>" + esc(jourLong(md)) + "</span>"));
    const att = tousRetours().filter(r => r.statut !== "carnet").length;
    g.appendChild(el("div", "ligne", "<span>Retours pas encore dans le carnet</span><span>" + att + "</span>"));
    f.appendChild(g);
    f.appendChild(el("div", "fnote", "La page se recharge toute seule dès qu'une nouvelle version est en ligne : après chaque collecte, chaque point du coach, et chaque réponse dans Parler qui modifie ton plan."));
    const b = el("button", "btn", I.maj + "Actualiser maintenant");
    const m = el("div", "envoi");
    if (demandeEnCours()) m.textContent = "Actualisation demandée. Compte 4 à 6 minutes : la page se rechargera seule.";
    b.onclick = async () => {
      b.disabled = true; m.textContent = "Demande envoyée…";
      const rep = await api("/api/actualiser", { method:"POST", body:"{}" });
      const code = rep ? rep.status : 0;
      if (code === 200 || code === 429) {
        if (code === 200) stock.ecrire("coach-actualiser", Date.now());
        m.textContent = code === 200 ? "C'est parti : nouvelle collecte de tes montres, puis la page se reconstruit. Compte 4 à 6 minutes, elle se rechargera seule."
                                     : "Une actualisation est déjà en cours. La page se rechargera seule dès qu'elle sera prête.";
        pastille(); suivreVersion(20);
      } else if (code === 501) m.textContent = "Le bouton n'est pas encore activé : il manque le jeton GitHub (voir le README). En attendant, la page se met à jour à chaque collecte et à chaque point du coach.";
      else m.textContent = "Impossible de joindre le serveur. Vérifie ta connexion et réessaie.";
      b.disabled = false;
    };
    f.appendChild(b); f.appendChild(m);
    const r = el("button", "btn creux", "Recharger la page");
    r.onclick = () => { if (typeof location !== "undefined" && location.reload) location.reload(); };
    f.appendChild(r);
  });
}

/* ==========================================================================
   11. Mise à jour en direct
   ========================================================================== */
let minuteur = null;
async function versionEnLigne() {
  if (!avecReseau || typeof VERSION === "undefined") return null;
  try { const r = await fetch("v.txt?" + Date.now(), { cache:"no-store" }); return r.ok ? (await r.text()).trim() : null; } catch (e) { return null; }
}
async function verifierVersion() {
  const v = await versionEnLigne();
  if (!v || v === VERSION) return false;
  /* Jamais pendant qu'il écrit, qu'il fait son check-in ou son gainage. */
  const ecrit = Array.from(document.querySelectorAll("textarea")).concat(Array.from(document.querySelectorAll("input"))).some(t => t.value && String(t.value).trim());
  if (ecrit || LEC.on || (CK && (CK.forme || CK.jambes || CK.alerte))) return false;
  stock.ecrire("coach-actualiser", 0);
  toast("Nouvelle version du coach");
  if (typeof setTimeout !== "undefined") setTimeout(() => location.reload(), 900);
  return true;
}
/* Rythme normal : toutes les 2 minutes quand la page est visible.
   Après une demande d'actualisation : toutes les 20 secondes. */
function suivreVersion(sec) {
  if (typeof setInterval === "undefined") return;
  if (minuteur) clearInterval(minuteur);
  minuteur = setInterval(() => { if (!document.hidden) verifierVersion(); }, (sec || 120) * 1000);
}
function toast(t) {
  const x = $("#toast"); if (!x) return;
  x.textContent = t; x.classList.add("on");
  if (typeof setTimeout !== "undefined") setTimeout(() => x.classList.remove("on"), 2600);
}

/* Le bandeau « Agenda · Mois | Liste » reste collé sous l'en-tête : il
   s'efface quand on descend dans la liste et revient dès qu'on remonte.

   Bug du 6 octobre (vidéo de l'utilisateur) : il apparaissait et disparaissait sans arrêt,
   la liste immobile. Un doigt posé sur l'écran fait trembler le défilement de
   quelques pixels dans un sens puis dans l'autre ; l'ancien code basculait dès
   4 px dans un sens. Désormais :
   - il faut 48 px de descente CONTINUE pour l'effacer, 24 px de remontée pour le
     rappeler ; un changement de sens remet le compteur à zéro, donc un
     tremblement s'annule de lui-même ;
   - après chaque bascule, 400 ms sans nouvelle bascule ;
   - le rebond élastique d'iOS (au-delà des bords de la page) ne compte pas ;
   - garde-fou : plus de 6 bascules en 4 secondes, le bandeau reste affiché
     jusqu'au prochain chargement de la page ;
   - il s'efface en fondu (opacité), plus en translation : une transformation sur
     un élément collant (sticky) est mal composée par iOS. */
let yAvant = 0, defilAuto = 0, cumul = 0, gelBandeau = 0, bascules = [], bandeauFige = false;
const SEUIL_CACHER = 48, SEUIL_MONTRER = 24;
/* Hauteur réelle de l'en-tête (elle change selon l'onglet : le bandeau des jours n'est que sur Jour). */
function caler() {
  const c = document.querySelector(".chrome");
  if (c && c.offsetHeight && document.documentElement && document.documentElement.style)
    document.documentElement.style.setProperty("--haut", c.offsetHeight + "px");
}
function basculerBandeau(h, cacher, sansCompter) {
  if (h.classList.contains("cache") === cacher) return;
  h.classList.toggle("cache", cacher);
  cumul = 0;
  if (sansCompter) return;
  const t = horloge();
  gelBandeau = t + 400;
  bascules = bascules.filter(x => t - x < 4000).concat(t);
  if (bascules.length > 6) { bandeauFige = true; h.classList.remove("cache"); }
}
function lireDefilement() {
  const h = $("#agHaut");
  const de = document.documentElement || {};
  const max = Math.max(0, (de.scrollHeight || 0) - (window.innerHeight || 0));
  const y = Math.min(max || Infinity, Math.max(0, window.scrollY || 0));
  const dy = y - yAvant;
  yAvant = y;
  if (!h || !h.classList) return;
  const t = horloge();
  /* En haut de page, pendant un saut automatique, ou si le garde-fou a sauté : affiché. */
  if (bandeauFige || t < defilAuto || y <= 140) { cumul = 0; basculerBandeau(h, false, true); return; }
  if (t < gelBandeau || !dy) { if (t < gelBandeau) cumul = 0; return; }
  cumul = (dy > 0) === (cumul > 0) ? cumul + dy : dy;
  if (cumul >= SEUIL_CACHER) basculerBandeau(h, true);
  else if (cumul <= -SEUIL_MONTRER) basculerBandeau(h, false);
}
function suivreDefilement() {
  if (typeof window === "undefined" || !window.addEventListener) return;
  caler();
  window.addEventListener("resize", caler);
  window.addEventListener("load", caler);
  /* L'en-tête fixe change de hauteur (bandeau des jours, polices chargées) : on suit. */
  if (typeof ResizeObserver !== "undefined") { const c = document.querySelector(".chrome"); if (c) new ResizeObserver(caler).observe(c); }
  /* Au plus une lecture par image affichée. */
  let prevu = false;
  window.addEventListener("scroll", () => {
    if (prevu) return;
    prevu = true;
    const go = () => { prevu = false; lireDefilement(); };
    if (window.requestAnimationFrame) window.requestAnimationFrame(go); else go();
  }, { passive:true });
}

/* ---------- Parler : ouvrir l'app Claude plutôt qu'une page web à connexion ----------
   Depuis l'icône d'écran d'accueil, un lien https s'ouvre dans un Safari
   intégré, sans ta session Claude. Le schéma claude:// ouvre l'app installée.
   Le premier appui propose les trois façons ; le choix est retenu. */
const PROJET = (D.parler || "").split("/project/")[1] || "";
const PARLER = {
  projet:{ l:"Le projet Coach dans l'app Claude", c:"le projet Coach", u:() => "claude://project/" + PROJET },
  app:{ l:"L'app Claude", c:"l'app Claude", u:() => "claude://" },
  web:{ l:"Claude dans le navigateur", c:"le navigateur", u:() => D.parler || "https://claude.ai/" }
};
function parler() {
  const c = stock.lire("coach-parler", null);
  if (c && PARLER[c]) { location.href = PARLER[c].u(); return; }
  choisirParler();
}
function choisirParler() {
  ouvrirFeuille("Parler au coach", f => {
    f.appendChild(el("div", "mtx", "Où veux-tu ouvrir la conversation ? Ton choix est retenu ; tu pourras le changer dans les réglages (L)."));
    const g = el("div", "grp"); g.style.marginTop = "12px";
    for (const k of ["projet", "app", "web"]) {
      const b = el("button", "ligne", "<span>" + esc(PARLER[k].l) + "</span><span>" + (k === "projet" ? "recommandé" : k === "web" ? "demande de te connecter" : "") + "</span>");
      b.style.width = "100%"; b.style.textAlign = "left";
      b.dataset.k = k;
      b.onclick = () => { stock.ecrire("coach-parler", k); fermerFeuille(); location.href = PARLER[k].u(); };
      g.appendChild(b);
    }
    f.appendChild(g);
    f.appendChild(el("div", "fnote", "Si « le projet » n'ouvre que l'accueil de l'app, choisis « L'app Claude » et épingle le projet Coach sportif dans l'app : il sera toujours en haut."));
  });
}

/* ==========================================================================
   12 bis. Gainage guidé : un minuteur plein écran, téléphone posé par terre.
   Le temps vient de l'horloge (horodatages), jamais d'un compteur qu'on
   incrémente : écran verrouillé, appli changée ou onglet en veille, la séance
   reste juste et se rattrape au retour. Bips (Web Audio), voix française,
   écran maintenu allumé. À la fin, le retour part au coach comme les autres.
   ========================================================================== */
const LEC = { on:false, s:null, E:[], i:0, debut:0, pause:null, pauseTot:0, fini:false, abandon:false, t0:0, tfin:0, arret:0, bips:{}, tic:null, h:null,
              son:stock.lire("coach-son", "voix") };
function lecteur() { return LEC; }                           /* accès pour le banc d'essai */
const horloge = () => LEC.h ? LEC.h() : Date.now();
const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const dureeLue = s => { s = Math.max(0, Math.round(s)); return s < 60 ? s + " s" : Math.floor(s / 60) + " min " + String(s % 60).padStart(2, "0"); };
const estRepos = e => /rest|recovery/.test(e.k);
const nomExo = p => /rest|recovery/.test(p.k || "") ? "Récupération" : String(p.t || "").replace(/\s*[×x]\s*\d+\s*$/, "").replace(/\s+\d+\s*(s|sec|min)\s*$/i, "").trim();
/* Les étapes à jouer : les tours dépliés, sans la récupération finale, avec 10 s pour
   se mettre en place au début et 5 s pour changer de position entre deux exercices. */
function etapesGainage(s) {
  const out = [];
  for (const b of s.etapes || []) {
    const bloc = !!(b.rep && b.pas), n = bloc ? b.rep : 1;
    for (let r = 1; r <= n; r++) for (const p of (bloc ? b.pas : [b])) {
      const f = p.fin || {};
      out.push({ k:p.k || "interval", nom:nomExo(p), c:p.c || "", sec:f.type === "temps" ? f.v : null, reps:f.type === "reps" ? f.v : null, tour:r, tours:n });
    }
  }
  while (out.length && estRepos(out[out.length - 1])) out.pop();
  if (!out.length) return [];
  const E = [{ k:"prep", nom:"Prépare-toi", c:"Mets-toi en place : " + out[0].nom.toLowerCase() + ".", sec:10, tour:1, tours:out[0].tours }];
  out.forEach((e, i) => {
    const av = out[i - 1];
    if (av && !estRepos(av) && !estRepos(e)) E.push({ k:"trans", nom:"Change de position", c:e.nom, sec:5, tour:e.tour, tours:e.tours });
    E.push(e);
  });
  return E;
}
const dureeEst = e => e.sec || (e.reps ? e.reps * 2.5 : 30);
function progression() {
  let fait = 0, tot = 0;
  LEC.E.forEach((e, i) => { tot += dureeEst(e); if (i < LEC.i) fait += dureeEst(e); });
  const e = LEC.E[LEC.i];
  if (e) fait += Math.min(dureeEst(e), Math.max(0, ((LEC.pause != null ? LEC.pause : horloge()) - LEC.debut) / 1000));
  return tot ? Math.min(1, fait / tot) : 0;
}

/* ---------- son, voix, écran allumé ---------- */
let AC = null, VERROU = null;
function audioPret() {
  try {
    /* « transient » : les bips passent par-dessus ta musique, sans la couper. */
    if (typeof navigator !== "undefined" && navigator.audioSession) navigator.audioSession.type = "transient";
    const A = typeof AudioContext !== "undefined" ? AudioContext : typeof webkitAudioContext !== "undefined" ? webkitAudioContext : null;
    if (A && !AC) AC = new A();
    if (AC && AC.state === "suspended") AC.resume();
  } catch (e) {}
}
function bip(long) {
  if (!AC || LEC.son === "muet") return;
  try {
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime, d = long ? .5 : .16;
    o.type = "sine"; o.frequency.value = long ? 1320 : 880;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.6, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + .02);
  } catch (e) {}
}
let VOIX = null;
function dire(txt) {
  if (!txt || LEC.son !== "voix" || typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return;
  try {
    if (!VOIX) VOIX = (speechSynthesis.getVoices() || []).find(v => /^fr(-|_)FR/i.test(v.lang)) || null;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = "fr-FR"; u.rate = 1.05;
    if (VOIX) u.voice = VOIX;
    speechSynthesis.speak(u);
  } catch (e) {}
}
async function garderEcran(oui) {
  try {
    if (oui && typeof navigator !== "undefined" && navigator.wakeLock) { if (!VERROU) { VERROU = await navigator.wakeLock.request("screen"); VERROU.addEventListener("release", () => { VERROU = null; }); } }
    else if (!oui && VERROU) { const v = VERROU; VERROU = null; await v.release(); }
  } catch (e) {}
}
const SONS = { voix:"Voix", bips:"Bips", muet:"Muet" };
function changerSon() {
  LEC.son = LEC.son === "voix" ? "bips" : LEC.son === "bips" ? "muet" : "voix";
  stock.ecrire("coach-son", LEC.son);
  if (LEC.son !== "voix" && typeof speechSynthesis !== "undefined") try { speechSynthesis.cancel(); } catch (e) {}
  const b = $("#lSon"); if (b) b.innerHTML = (LEC.son === "muet" ? I.muet : I.son) + "<span>" + SONS[LEC.son] + "</span>";
}

/* ---------- ce que dit la voix ---------- */
function annonce(e) {
  const av = LEC.E[LEC.i - 1], apres = LEC.E.slice(LEC.i + 1).find(x => x.k !== "trans");
  const dur = x => x.sec ? x.sec + " secondes" : x.reps ? x.reps + " répétitions" : "";
  const tour = x => x.tours > 1 ? (x.tour === x.tours ? "Dernier tour. " : "Tour " + x.tour + " sur " + x.tours + ". ") : "";
  if (e.k === "prep") { const x = LEC.E.find(y => !/prep|trans/.test(y.k)); return x ? "C'est parti. " + tour(x) + x.nom + ", " + dur(x) + "." : ""; }
  if (e.k === "trans") { const x = LEC.E[LEC.i + 1]; return x ? x.nom + ", " + dur(x) + "." : ""; }
  if (estRepos(e)) return "Récupération" + (e.sec ? ", " + e.sec + " secondes" : "") + "." + (apres ? " Ensuite : " + (apres.tour !== e.tour ? tour(apres) : "") + apres.nom + "." : "");
  const dejaDit = av && /prep|trans/.test(av.k);       /* annoncé pendant la mise en place */
  if (e.reps) return (dejaDit ? "" : e.nom + ", " + e.reps + " répétitions. ") + "Touche Fait quand c'est fini.";
  return dejaDit ? "" : e.nom + ".";
}

/* ---------- déroulé ---------- */
function lancerGainage(s) {
  const E = s ? etapesGainage(s) : [];
  if (!E.length) return;
  Object.assign(LEC, { on:true, s, E, i:0, pause:null, pauseTot:0, fini:false, abandon:false, arret:0, bips:{} });
  LEC.t0 = LEC.debut = horloge();
  audioPret();
  garderEcran(true);
  $("#lecteur").classList.add("on");
  document.body.style.overflow = "hidden";
  pousserHisto();
  entrer(false);
  if (typeof setInterval !== "undefined") { if (LEC.tic) clearInterval(LEC.tic); LEC.tic = setInterval(tic, 250); }
}
function entrer(silence) {
  LEC.bips = {};
  if (!silence) { if (LEC.i > 0) bip(true); dire(annonce(LEC.E[LEC.i])); }
  monterEtape();
}
function tic() {
  if (!LEC.on || LEC.fini || LEC.pause != null) return;
  const now = horloge();
  let e = LEC.E[LEC.i], change = false;
  /* Rattrapage : plusieurs étapes ont pu s'écouler pendant que l'écran dormait. */
  while (e && e.sec && now - LEC.debut >= e.sec * 1000) {
    LEC.debut += e.sec * 1000;
    if (LEC.i + 1 >= LEC.E.length) { terminer(false); return; }
    LEC.i++; e = LEC.E[LEC.i]; change = true;
  }
  if (change) entrer(now - LEC.debut > 2000);       /* revenu en retard : pas d'annonce périmée */
  if (e && e.sec) {
    const reste = Math.ceil((e.sec * 1000 - (now - LEC.debut)) / 1000);
    if (reste >= 1 && reste <= 3 && !LEC.bips[reste]) { LEC.bips[reste] = 1; bip(false); }
    if (e.sec >= 30 && reste === 10 && !LEC.bips.dix && !/prep|trans/.test(e.k) && !estRepos(e)) { LEC.bips.dix = 1; dire("10 secondes"); }
  }
  peindre();
}
function suivant() {
  if (LEC.fini) return;
  if (LEC.i + 1 >= LEC.E.length) { terminer(false); return; }
  LEC.i++;
  LEC.debut = horloge();
  if (LEC.pause != null) LEC.pause = LEC.debut;
  entrer(false);
}
function precedent() {
  if (LEC.fini) return;
  const now = horloge();
  /* Dans les 3 premières secondes, on revient à l'exercice d'avant (pas à une mise en
     place de 5 s) ; après, on reprend celui-ci depuis le début. */
  if (now - LEC.debut < 3000 && LEC.i > 0) { do LEC.i--; while (LEC.i > 0 && LEC.E[LEC.i].k === "trans"); }
  LEC.debut = now;
  if (LEC.pause != null) LEC.pause = now;
  entrer(false);
}
function basculerPause() {
  if (LEC.fini) return;
  const now = horloge();
  if (LEC.pause == null) LEC.pause = now;
  else { LEC.debut += now - LEC.pause; LEC.pauseTot += now - LEC.pause; LEC.pause = null; audioPret(); }
  monterEtape();
}
/* Arrêter demande deux touches : un coude qui glisse ne doit pas tuer la séance. */
function arreter() {
  if (LEC.fini) { fermerLecteur(); return; }
  const now = horloge();
  if (now - LEC.arret < 4000) { terminer(true); return; }
  LEC.arret = now;
  const x = $("#lX");
  if (x) x.classList.add("arme");
  if (typeof setTimeout !== "undefined") setTimeout(() => { const y = $("#lX"); if (y && horloge() - LEC.arret >= 3900) y.classList.remove("arme"); }, 4000);
}
function terminer(abandon) {
  const now = horloge();
  if (LEC.pause != null) { LEC.pauseTot += now - LEC.pause; LEC.pause = null; }
  LEC.fini = true; LEC.abandon = !!abandon; LEC.tfin = now;
  if (LEC.tic && typeof clearInterval !== "undefined") clearInterval(LEC.tic);
  LEC.tic = null;
  if (!abandon) { bip(true); dire("Gainage terminé."); }
  garderEcran(false);
  ecranFin();
}
function fermerLecteur() {
  LEC.on = false;
  if (LEC.tic && typeof clearInterval !== "undefined") clearInterval(LEC.tic);
  LEC.tic = null;
  garderEcran(false);
  if (typeof speechSynthesis !== "undefined") try { speechSynthesis.cancel(); } catch (e) {}
  const L = $("#lecteur");
  L.classList.remove("on"); L.classList.remove("fin"); L.innerHTML = "";
  document.body.style.overflow = $("#det").classList.contains("on") ? "hidden" : "";
}

/* ---------- l'écran ---------- */
function monterEtape() {
  const L = $("#lecteur"), e = LEC.E[LEC.i];
  if (!L || !e) return;
  L.innerHTML = "";
  const genre = e.k === "prep" ? "prep" : e.k === "trans" ? "trans" : estRepos(e) ? "repos" : "exo";
  L.setAttribute("data-k", genre);
  const h = el("div", "lh");
  const x = el("button", "lx", I.ferme + "<span>Arrêter ?</span>");
  x.id = "lX"; x.setAttribute("aria-label", "Arrêter la séance"); x.onclick = arreter;
  h.appendChild(x);
  h.appendChild(el("div", "lt", esc(e.tours > 1 ? "Tour " + e.tour + " sur " + e.tours : "Gainage")));
  const sn = el("button", "lson", (LEC.son === "muet" ? I.muet : I.son) + "<span>" + SONS[LEC.son] + "</span>");
  sn.id = "lSon"; sn.setAttribute("aria-label", "Son : " + SONS[LEC.son]); sn.onclick = changerSon;
  h.appendChild(sn);
  L.appendChild(h);
  L.appendChild(el("div", "lprog", '<i id="lProg"></i>'));
  const c = el("div", "lc");
  /* Pendant la mise en place, l'écran montre déjà l'exercice qui arrive. */
  const vise = genre === "prep" || genre === "trans" ? LEC.E[LEC.i + 1] || e : e;
  const exos = LEC.E.filter(y => y.tour === vise.tour && !/prep|trans/.test(y.k) && !estRepos(y));
  c.appendChild(el("div", "lk", genre === "prep" ? "Prépare-toi" : genre === "trans" ? "Change de position" : genre === "repos" ? "Récupération" :
    "Exercice " + (exos.indexOf(e) + 1) + " sur " + exos.length));
  c.appendChild(el("div", "ln", esc(vise.nom)));
  if (vise.c && !estRepos(vise)) c.appendChild(el("div", "lcons", esc(vise.c)));
  if (vise !== e) c.appendChild(el("div", "lcons", vise.sec ? vise.sec + " secondes" : "× " + vise.reps)).style.marginTop = "2px";
  if (e.sec) c.appendChild(el("div", "lring", '<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="88" class="lfond"/>' +
    '<circle cx="100" cy="100" r="88" class="larc" id="lArc" transform="rotate(-90 100 100)"/></svg><div class="lnum" id="lNum"></div>'));
  else c.appendChild(el("div", "lreps", "<b>× " + e.reps + '</b><span>répétitions, à ton rythme</span><span class="lchrono" id="lNum"></span>'));
  const apres = LEC.E.slice(LEC.E.indexOf(vise) + 1).find(y => y.k !== "trans");
  c.appendChild(el("div", "lsuiv", apres ? (vise !== e ? "Puis : " : "Ensuite : ") + "<b>" + esc(apres.nom) + "</b> · " + (apres.sec ? apres.sec + " s" : "× " + apres.reps) +
    (apres.tour !== vise.tour ? " · tour " + apres.tour : "") : "Dernier exercice"));
  if (LEC.pause != null) c.appendChild(el("div", "lpause", "En pause"));
  L.appendChild(c);
  const b = el("div", "lb");
  const p = el("button", "lbt", I.prec); p.setAttribute("aria-label", "Étape précédente"); p.onclick = precedent;
  const n = el("button", "lbt", I.suiv); n.setAttribute("aria-label", "Étape suivante"); n.onclick = suivant;
  const m = e.sec ? el("button", "lbt grand", LEC.pause != null ? I.jouer : I.pause) : el("button", "lbt fait", "Fait");
  m.id = "lMil";
  m.setAttribute("aria-label", e.sec ? (LEC.pause != null ? "Reprendre" : "Pause") : "Exercice fait, suivant");
  m.onclick = e.sec ? basculerPause : suivant;
  b.appendChild(p); b.appendChild(m); b.appendChild(n);
  L.appendChild(b);
  peindre();
}
function peindre() {
  if (!LEC.on || LEC.fini) return;
  const e = LEC.E[LEC.i], ecoule = Math.max(0, (LEC.pause != null ? LEC.pause : horloge()) - LEC.debut);
  const num = $("#lNum"), arc = $("#lArc"), pr = $("#lProg");
  if (e.sec) {
    const reste = Math.max(0, e.sec * 1000 - ecoule);
    if (num) num.textContent = mmss(Math.ceil(reste / 1000));
    if (arc && arc.setAttribute) arc.setAttribute("stroke-dashoffset", (553 * (1 - reste / (e.sec * 1000))).toFixed(1));
  } else if (num) num.textContent = mmss(ecoule / 1000);
  if (pr) pr.style.width = Math.round(progression() * 100) + "%";
}
function ecranFin() {
  const L = $("#lecteur"), s = LEC.s, e = LEC.E[LEC.i] || {};
  L.innerHTML = ""; L.classList.add("fin"); L.setAttribute("data-k", LEC.abandon ? "arret" : "fin");
  const tours = LEC.E.reduce((m, x) => Math.max(m, x.tours || 1), 1);
  const duree = (LEC.tfin - LEC.t0 - LEC.pauseTot) / 1000;
  const resume = LEC.abandon ? "arrêté au tour " + (e.tour || 1) + " sur " + tours + " (" + String(e.k === "trans" ? (LEC.E[LEC.i + 1] || {}).nom || "" : e.nom || "").toLowerCase() + "), après " + dureeLue(duree)
                             : tours + " tour" + (tours > 1 ? "s" : "") + " en " + dureeLue(duree);
  const w = el("div", "lfin");
  w.appendChild(el("div", "lk", LEC.abandon ? "Séance arrêtée" : "Séance terminée"));
  w.appendChild(el("div", "ln", LEC.abandon ? "Gainage en partie" : "Gainage fait"));
  w.appendChild(el("div", "lcons", esc(cap(resume)) + "."));
  const f = el("div", "ret");
  const raisons = choix("Pourquoi ?", [{ l:"Pas le temps", v:"pas le temps" }, { l:"Fatigue", v:"fatigue" }, { l:"Douleur", v:"douleur" }, { l:"Autre", v:"autre" }]);
  if (LEC.abandon) f.appendChild(raisons.w);
  const sens = choix("Sensation sur 10", [1,2,3,4,5,6,7,8,9,10].map(n => ({ l:String(n), v:n })));
  const dou = choix("Douleur", [{ l:"Aucune", v:"aucune" }, { l:"Légère", v:"légère" }, { l:"Forte", v:"forte" }]);
  const txt = el("textarea", "txt");
  txt.setAttribute("rows", "2"); txt.setAttribute("placeholder", "Un mot pour le coach (facultatif)");
  const go = el("button", "btn", "Envoyer au coach");
  go.id = "lEnvoyer";
  const msg = el("div", "envoi");
  const non = el("button", "btn creux", "Fermer sans envoyer");
  non.onclick = fermerLecteur;
  go.onclick = async () => {
    /* Faite en avance : datée d'aujourd'hui, pas du jour prévu. */
    const d = s.d <= AUJ ? s.d : AUJ, mot = String(txt.value || "").trim();
    const r = { type:"seance", d, t:s.t, fait:LEC.abandon ? "en partie" : "fait", raison:LEC.abandon ? raisons.val() : null, sensation:sens.val(), douleur:dou.val(),
                note:("Gainage guidé : " + resume + "." + (d !== s.d ? " Fait en avance, prévu le " + jourLong(s.d) + "." : "") + (mot ? " " + mot : "")).slice(0, 1200), ecrit:horo() };
    go.disabled = true; msg.textContent = "Envoi…";
    const res = await envoyer(r);
    fermerLecteur();
    if ($("#det").classList.contains("on")) fermer();
    toast(r.douleur === "forte" ? "Douleur forte : fais-toi examiner avant la prochaine séance" :
      res === "ok" ? "Envoyé au coach" : "Pas de réseau : ton retour partira tout seul");
    rafraichir();
  };
  for (const x of [sens.w, dou.w, txt, go, msg, non]) f.appendChild(x);
  w.appendChild(f);
  L.appendChild(w);
}

/* ==========================================================================
   12 ter. Notifications envoyées par la page elle-même (lot 2, point 5).
   Le service worker (sw.js) les affiche ; GitHub Actions les envoie
   (collecte/notifier.mjs). iOS ne les permet qu'à la page ouverte depuis son
   icône sur l'écran d'accueil (iOS 16.4 ou plus récent).
   ========================================================================== */
const NOTIFS_DEFAUT = { seance:true, heure:19, coucher:true, modif:true, montres:true };
const pushPossible = () => typeof navigator !== "undefined" && !!navigator.serviceWorker && typeof window !== "undefined" &&
  "PushManager" in window && "Notification" in window && typeof VAPID !== "undefined";
const ecranAccueil = () => typeof navigator !== "undefined" && (navigator.standalone === true ||
  (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(display-mode: standalone)").matches));
async function preparerSW() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker || typeof location === "undefined" || (location.protocol !== "https:" && location.hostname !== "127.0.0.1")) return;
  try {
    await navigator.serviceWorker.register("sw.js");
    const r = await navigator.serviceWorker.ready;
    if (r.active) r.active.postMessage({ type:"lien", url:location.href });
  } catch (e) {}
}
const octets = b => { const s = atob(b.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b.length + 3) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); };
async function abonnementActuel() {
  try { const r = await navigator.serviceWorker.ready; return await r.pushManager.getSubscription(); } catch (e) { return null; }
}
async function enregistrerNotifs(sub, prefs) {
  stock.ecrire("coach-notifs", prefs);
  const rep = await api("/api/abonnement", { method:"POST", body:JSON.stringify({ abonnement:sub.toJSON ? sub.toJSON() : sub, prefs }) });
  return !!(rep && rep.ok);
}
function sectionNotifs(f) {
  const z = el("div", "notifs");
  f.appendChild(z);
  const prefs = Object.assign({}, NOTIFS_DEFAUT, stock.lire("coach-notifs", {}));
  const msg = el("div", "envoi");
  const dessiner = async () => {
    z.innerHTML = "";
    if (!pushPossible() || !ecranAccueil()) {
      z.appendChild(el("div", "fnote", ecranAccueil() ? "Ton iPhone ne propose pas encore les notifications des pages : il faut iOS 16.4 ou plus récent."
        : "Les notifications ne marchent que depuis l'icône de l'écran d'accueil : ouvre le coach par son icône, puis reviens ici.")).style.margin = "0 4px 16px";
      return;
    }
    const perm = Notification.permission, sub = perm === "granted" ? await abonnementActuel() : null;
    if (perm === "denied") { z.appendChild(el("div", "fnote", "Notifications refusées. Pour les autoriser : Réglages de l'iPhone, Notifications, Coach.")).style.margin = "0 4px 16px"; return; }
    if (!sub) {
      const b = el("button", "btn", "Activer les notifications");
      b.id = "bNotifs";
      b.onclick = async () => {
        const p = Notification.requestPermission();               /* dans le geste, sinon iOS refuse */
        msg.textContent = "Autorisation…";
        if ((await p) !== "granted") { msg.textContent = "Pas d'autorisation : rien ne sera envoyé."; dessiner(); return; }
        try {
          const r = await navigator.serviceWorker.ready;
          const s = await r.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:octets(VAPID) });
          msg.textContent = (await enregistrerNotifs(s, prefs)) ? "Notifications activées sur cet iPhone." : "Activées sur l'iPhone, mais le serveur n'a pas répondu : réessaie.";
        } catch (e) { msg.textContent = "Activation impossible (" + (e && e.name || "erreur") + ")."; }
        dessiner();
      };
      z.appendChild(b);
      z.appendChild(el("div", "fnote", "Rien d'autre que ce qui suit : une séance pas faite, « au lit » après une nuit courte, une séance modifiée par le coach, une montre qui ne répond plus. Chaque type se coupe ici.")).style.margin = "10px 4px 16px";
      return;
    }
    /* Activées : un interrupteur par notification, l'heure du rappel de séance. */
    const g = el("div", "grp");
    const ligne = (cle, titre, detail) => {
      const l = el("div", "ligne", "<span>" + esc(titre) + (detail ? '<small class="ls">' + esc(detail) + "</small>" : "") + "</span>");
      const t = el("button", "bascule" + (prefs[cle] ? " on" : ""), "<i></i>");
      t.setAttribute("role", "switch"); t.setAttribute("aria-checked", String(!!prefs[cle])); t.setAttribute("aria-label", titre);
      t.dataset.cle = cle;
      t.onclick = async () => { prefs[cle] = !prefs[cle]; dessiner(); await enregistrerNotifs(sub, prefs); };
      l.appendChild(t); g.appendChild(l);
    };
    ligne("seance", "Séance pas faite", "à l'heure choisie ci-dessous");
    ligne("coucher", "« Au lit » après une nuit courte", "vers 23 h");
    ligne("modif", "Séance modifiée par le coach", "hors du point de 7h27");
    if (NOMS_SOURCES.length) ligne("montres", "Une montre ne répond plus", NOMS_SOURCES.join(" ou "));
    z.appendChild(g);
    if (prefs.seance) {
      z.appendChild(el("div", "grpt", "Heure du rappel de séance"));
      const seg = el("div", "seg");
      for (const h of [17, 18, 19, 20, 21]) {
        const b = el("button", prefs.heure === h ? "on" : "", h + " h");
        b.dataset.h = String(h);
        b.onclick = async () => { prefs.heure = h; dessiner(); await enregistrerNotifs(sub, prefs); };
        seg.appendChild(b);
      }
      z.appendChild(seg);
    }
    const tb = el("button", "btn creux", "Envoyer une notification de test");
    tb.id = "bNotifTest";
    tb.onclick = async () => {
      tb.disabled = true; msg.textContent = "Demande envoyée…";
      const rep = await api("/api/notif-test", { method:"POST", body:"{}" });
      msg.textContent = rep && rep.ok ? "Elle arrive d'ici une minute ou deux." : rep && rep.status === 429 ? "Une demande est déjà partie : patiente une minute." : "Le serveur n'a pas répondu.";
      tb.disabled = false;
    };
    z.appendChild(tb);
    const off = el("button", "lien", "Couper toutes les notifications sur cet iPhone");
    off.onclick = async () => { await api("/api/abonnement", { method:"DELETE", body:JSON.stringify({ endpoint:sub.endpoint }) }); try { await sub.unsubscribe(); } catch (e) {} msg.textContent = "Notifications coupées."; dessiner(); };
    z.appendChild(off);
  };
  f.appendChild(msg);
  dessiner();
}

/* ==========================================================================
   12. Onglets et démarrage
   ========================================================================== */
function rafraichir() {
  bandeau();
  if (VUE === "vJour") vueJour();
  if (VUE === "vPlan") vuePlan();
  if (VUE === "vProg") vueProg();
}
function onglet(id) {
  VUE = id;
  for (const v of document.querySelectorAll(".vue")) v.classList.toggle("on", v.id === id);
  for (const a of document.querySelectorAll("nav.tb button[data-v]")) a.classList.toggle("on", a.dataset.v === id);
  $("#bandeau").style.display = id === "vJour" ? "" : "none";
  caler();
  if (id === "vJour") { bandeau(); vueJour(); }
  if (id === "vPlan") vuePlan();
  if (id === "vProg") vueProg();
  if (typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
}
for (const a of document.querySelectorAll("nav.tb button[data-v]")) a.onclick = () => onglet(a.dataset.v);
$("#tParler").onclick = parler;
$("#bReg").onclick = reglages;
$("#bMaj").onclick = miseAJour;
$("#voile").onclick = fermerFeuille;
$("#semG").onclick = () => choisir(decale(lundiDe(SEL), -7));
$("#semD").onclick = () => choisir(decale(lundiDe(SEL), 7));
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("popstate", () => {
  /* Un glissement « retour » pendant le gainage met en pause, il ne quitte pas. */
  if (LEC.on) { if (LEC.fini) fermerLecteur(); else { if (LEC.pause == null) basculerPause(); pousserHisto(); } return; }
  if ($("#feuille").classList.contains("on")) fermerFeuille();
  else if ($("#det").classList.contains("on")) fermer();
});

indexer();
SEL = jourInitial();
appliquerTheme(stock.lire("coach-theme", "auto"));
$("#hj").textContent = cap(jourLong(AUJ));
pastille();
bandeau();
vueJour();
vuePlan();
vueProg();
glisser();
suivreDefilement();
vider();
chargerAttente();
verifierVersion();
suivreVersion(demandeEnCours() ? 20 : 120);
preparerSW();
if (document.addEventListener) document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  /* Pendant le gainage : l'écran allumé se redemande, le minuteur se recale ; pas de rechargement. */
  if (LEC.on && !LEC.fini) { garderEcran(true); tic(); return; }
  verifierVersion(); chargerAttente();
});
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("online", vider);
