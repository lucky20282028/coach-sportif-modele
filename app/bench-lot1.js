/* ==========================================================================
   BANC DE L'ÉCRAN — lot 1 (7 octobre 2026)
   Check-in du matin, feu du jour, attentes réglables d'un geste, analyse de
   sortie, gainage guidé, objectifs. Le vrai rendu tourne dans un DOM factice,
   avec l'heure du téléphone figée et une horloge pilotée pour le minuteur.
   ========================================================================== */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { creerDocument } = require("./dom.js");
const A = require("./analyses.js");
const C = require("./core.js");

let ok = 0, ko = 0; const echecs = [];
const t = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? "  → " + String(d).slice(0, 240) : "")); } };
const eq = (n, a, b) => t(n, a === b, "attendu " + JSON.stringify(b) + ", obtenu " + JSON.stringify(a));
const ici = __dirname;
const core = fs.readFileSync(path.join(ici, "core.js"), "utf8").replace(/\nif \(typeof module[\s\S]*$/, "\n");
const app  = fs.readFileSync(path.join(ici, "app.js"), "utf8");
const head = fs.readFileSync(path.join(ici, "head.html"), "utf8");
const attendre = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };

/* Un téléphone : stockage local, et en option un haut-parleur et une voix factices. */
function monter(donnees, now, opt) {
  opt = opt || {};
  const { doc, racine } = creerDocument(head);
  const win = Object.assign({ addEventListener() {}, scrollTo() {} }, opt.win || {});
  const D = JSON.parse(JSON.stringify(donnees));
  D.__now = now;
  const mem = {}, sons = [], voix = [];
  const ctx = {
    D, document:doc, window:win, history:{ pushState() {} }, location:{ href:"" },
    localStorage:{ getItem:k => (k in mem ? mem[k] : null), setItem:(k, v) => { mem[k] = String(v); } },
    console, JSON, Math, String, Number, Array, Object, Date, RegExp, parseFloat, parseInt, Promise, Set, Map, isNaN
  };
  if (opt.ctx) Object.assign(ctx, opt.ctx);
  if (opt.audio) {
    const noeud = () => ({ connect() {}, gain:{ setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency:{}, start() { sons.push(this.frequency.value); }, stop() {} });
    ctx.AudioContext = class { constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; } createOscillator() { return noeud(); } createGain() { return noeud(); } resume() {} };
    ctx.speechSynthesis = { speak:u => voix.push(u.text), cancel() {}, getVoices:() => [{ lang:"fr-FR", name:"Thomas" }] };
    ctx.SpeechSynthesisUtterance = class { constructor(x) { this.text = x; } };
  }
  win.location = ctx.location;
  vm.createContext(ctx);
  vm.runInContext(core + "\n" + app, ctx, { filename:"app.js" });
  const file = () => JSON.parse(mem["coach-file"] || "[]");
  return { doc, racine, ctx, sons, voix, file, D:ctx.D };
}
const clic = n => n.onclick({ stopPropagation() {} });
/* Les espaces insécables de la typographie française se lisent comme des espaces. */
const txt = n => n ? n.textContent.replace(/\u00a0/g, " ") : "";

/* ---------- le jeu de données : lundi 24 août, 8 h ---------- */
const F = require("./fixture.js");
/* Un athlète d'essai (fictif) : objectifs de reprise et de tour de taille, zones du check-in. */
const ATHL = require("../commun/athlete.cjs").fusion(require("../commun/athlete.cjs").DEFAUT, require("./fixture-athlete.json"));
const sortie = A.resumeSortie({ id:777, date:"2026-08-22", debut:"2026-08-22 07:10:00", distance_m:3400, duree_s:1200, fc_moy:148, fc_max:157, deniv_pos:20,
  km:[{ n:1, m:1000, s:372, fc:139, dp:2 }, { n:2, m:1000, s:351, fc:148, dp:14 }, { n:3, m:1000, s:340, fc:153, dp:4 }, { n:4, m:400, s:140, fc:150, dp:0, partiel:true }],
  serie:Array.from({ length:161 }, (_, i) => [i * 15, Math.round(i * 15 * 2.9), i * 15 < 600 ? 125 + i : i * 15 < 2100 ? 149 : 154]) }, 150);
const L = Object.assign({}, F, {
  today:"2026-08-24",
  plan:F.plan.map(s => s.d === "2026-08-22" ? Object.assign({}, s, { gid:777 }) : s),
  sorties:{ 777:sortie },
  feu:{ couleur:"vert", raisons:[], ok:["VFC sur 3 nuits : +2 %.", "Disponibilité Garmin : 61/100."], manque:["la nuit dernière"],
        meteo:{ matin_7h:{ t:14, ressenti:13, pluie:10, vent:8 }, soir_19h:{ t:27, ressenti:29, pluie:60, vent:12 } } },
  checkin:A.checkinDe(ATHL),
  reglages:require("../commun/athlete.cjs").pourLaPage(ATHL),
  echeances:[{ d:"2026-08-10", l:"Compte rendu du échographie", attente:true }, { d:"2026-08-23", l:"Tour de taille à relever", attente:true }],
  mesures:[{ d:"2026-08-01", cm:86 }, { d:"2026-08-15", cm:85.2 }],
  moteur:{ a150:[["2026-02-16", 370], ["2026-04-11", 365], ["2026-08-20", 331], ["2026-08-21", 384], ["2026-08-22", 344]], a140:[["2026-08-22", 363]] },
  objectifs:{ cible:{ course:2, renfo:1 }, dernier:{ course:"2026-08-22", renfo:"2026-08-13", velo:"2026-05-02" },
    semaines:Array.from({ length:12 }, (_, i) => { const d = new Date(2026, 5, 8 + 7 * i); const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      return { l:k, course:[0, 1, 2, 2, 0, 1, 3, 2, 1, 3, 4, 0][i], renfo:[0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0][i], foot:0 }; }),
    velo:{ attente:"Compte rendu du échographie", depuis:"2026-08-10", dernier:"2026-05-02" } }
});
eq("le jeu de données finit bien sur la semaine du 24", L.objectifs.semaines[11].l, "2026-08-24");

(async () => {
/* ==========================================================================
   1. Le matin : feu du jour et check-in
   ========================================================================== */
const M = monter(L, "2026-08-24T08:00:00");
const J = () => M.doc.querySelector("#vJour");
const matin = () => J().querySelector(".matin");
t("la séance en tête, la forme juste après", !!matin() && J().innerHTML.indexOf('class="carte') < J().innerHTML.indexOf('class="matin'));
t("feu vert, écrit en toutes lettres", matin()._cls.has("vert") && txt(matin().querySelector(".feu")) === "Feu vert");
t("ce qui n'est pas mesuré est dit", /Pas mesuré : la nuit dernière/.test(txt(matin())));
t("la météo du créneau : 7 h et 19 h, ressenti et pluie", /7 h 14° · 19 h 27° \(ressenti 29°\), pluie 60 %/.test(txt(matin())), txt(matin().querySelector(".feum")));
const verif = matin().querySelector(".feuv.cache");
t("le détail des vérifications est replié", verif && /VFC sur 3 nuits/.test(txt(verif)));
clic(matin().querySelectorAll(".lien")[0]);
t("et se déplie d'une touche", !verif._cls.has("cache"));
const ck = () => matin().querySelector(".ck");
eq("check-in : trois questions", ck().querySelectorAll(".ckl").length, 3);
t("check-in : la question de santé vient des données chiffrées", /Genou, dos/.test(txt(ck())));
const puce = (ligne, v) => ck().querySelectorAll(".ckl")[ligne].querySelectorAll(".chip").find(b => b.dataset.v === String(v));
clic(puce(0, 4));
t("une touche ne suffit pas à envoyer", !!ck() && puce(0, 4)._cls.has("on") && M.file().length === 0);
clic(puce(1, "lourdes"));
clic(puce(2, "raideur"));
eq("raideur : on demande où", ck().querySelectorAll(".ckl").length, 4);
t("les zones viennent des données", txt(ck().querySelectorAll(".ckl")[3]).indexOf("Dos, lombaires") >= 0);
clic(puce(3, "genou"));
t("la dernière touche envoie : résumé immédiat", !ck() && /Forme 4\/5, jambes lourdes, raideur au genou droit/.test(txt(matin().querySelector(".ckres"))), txt(matin()));
t("le feu réagit tout de suite : orange", matin()._cls.has("orange") && txt(matin().querySelector(".feu")) === "Prudence");
t("avec la consigne du profil pour le genou", /kiné du sport/.test(txt(matin().querySelector(".feul"))));
t("et les jambes lourdes", /Jambes lourdes ce matin/.test(txt(matin().querySelector(".feul"))));
eq("deux signaux annoncés", txt(matin().querySelector(".feus")), "Plusieurs signaux demandent d'alléger :");
await attendre();
const f1 = M.file();
t("hors réseau, le check-in attend dans la file", f1.length === 1 && f1[0].type === "checkin" && f1[0].forme === 4 && f1[0].zone === "genou" && f1[0].d === "2026-08-24", JSON.stringify(f1));
t("après l'envoi, le résumé reste", /raideur au genou/.test(txt(matin().querySelector(".ckres"))));
clic(matin().querySelector(".ckres .lien"));
t("Modifier rouvre le check-in, pré-rempli", !!ck() && puce(0, 4)._cls.has("on") && puce(2, "raideur")._cls.has("on"));
clic(puce(2, "rien"));
t("« rien » : plus de zone, et c'est complet donc envoyé", !ck() && /rien à signaler/.test(txt(matin().querySelector(".ckres"))));
eq("plus qu'un signal (les jambes)", txt(matin().querySelector(".feus")), "Un signal demande d'alléger :");
await attendre();
eq("la correction s'ajoute (le coach lit la plus récente)", M.file().length, 2);
clic(matin().querySelector(".ckres .lien"));
clic(puce(2, "douleur"));
clic(puce(3, "dos"));
t("douleur : feu rouge, pas de séance", matin()._cls.has("rouge") && txt(matin().querySelector(".feu")) === "Stop" && /Pas de séance aujourd'hui/.test(txt(matin().querySelector(".feus"))));
t("douleur : consulter", /fais-toi examiner/.test(txt(matin().querySelector(".feul"))));
await attendre();

/* Un check-in saisi sur un autre appareil, arrivé après l'ouverture de la page :
   il s'affiche en résumé, la carte ne reste pas bloquée en saisie (bug vu le 6 octobre). */
const MX = monter(L, "2026-08-24T08:00:00");
t("avant : la saisie est proposée", !!MX.doc.querySelector("#vJour .ck"));
MX.ctx.localStorage.setItem("coach-file", JSON.stringify([{ type:"checkin", d:"2026-08-24", forme:5, jambes:"fraîches", alerte:"rien", ecrit:"2026-08-24 07h50" }]));
MX.ctx.rafraichir();
t("après : le check-in arrivé s'affiche en résumé", !MX.doc.querySelector("#vJour .ck") && /Forme 5\/5, jambes fraîches, rien à signaler/.test(txt(MX.doc.querySelector("#vJour .ckres"))));

/* Un retour de séance d'hier avec douleur forte allume le rouge, sans check-in. */
const MR = monter(Object.assign({}, L, { retours:[{ type:"seance", d:"2026-08-23", t:"Football · 1 h", douleur:"forte", ecrit:"2026-08-23 22h10" }] }), "2026-08-24T08:00:00");
const mr = MR.doc.querySelector("#vJour .matin");
t("douleur forte hier : rouge dès l'ouverture", mr._cls.has("rouge") && /Douleur forte après « Football · 1 h » hier/.test(txt(mr)), txt(mr));

/* Données d'un autre jour : jamais de feu vert, mais le check-in reste possible. */
const MV = monter(Object.assign({}, L, { today:"2026-08-22" }), "2026-08-24T08:00:00");
const mv = MV.doc.querySelector("#vJour .matin");
t("données périmées : pas de feu vert", mv && !mv.querySelector(".feu") && !!mv.querySelector(".ck"));
/* Un jour sans séance à faire et rien à signaler : pas de feu (rien à décider). */
const MF = monter(L, "2026-08-22T08:00:00");
t("un autre jour que le jour même : ni feu ni check-in", !MF.doc.querySelector("#vJour .matin") || !MF.doc.querySelector("#vJour .feu"));
MF.ctx.choisir("2026-08-25");
t("et pas de check-in sur un autre jour", !MF.doc.querySelector("#vJour .ck"));

/* ==========================================================================
   2. Les attentes se règlent d'un geste
   ========================================================================== */
const MA = monter(L, "2026-08-24T08:00:00");
const atts = () => MA.doc.querySelector("#vJour").querySelectorAll(".att");
t("repliées par défaut : une ligne « À régler » avec leur nombre", atts().length === 0 && txt(MA.doc.querySelector("#vJour .arn")) === "2");
clic(MA.doc.querySelector("#vJour .arh"));
eq("deux attentes", atts().length, 2);
clic(atts()[0].querySelector(".attb"));
t("« C'est réglé » ouvre un message au coach, pré-rempli", MA.doc.querySelector("#det")._cls.has("on") && /^À propos de « Compte rendu du échographie » : $/.test(MA.doc.querySelector("#db textarea").value));
MA.ctx.fermer();
clic(atts()[1].querySelector(".attb"));
t("« Relever maintenant » ouvre la feuille du tour de taille", MA.doc.querySelector("#feuille")._cls.has("on") && txt(MA.doc.querySelector("#fc h3")) === "Tour de taille");
t("avec la façon de mesurer", /nombril/.test(txt(MA.doc.querySelector("#fc .conseils"))));
t("et la dernière mesure", /85,2 cm/.test(txt(MA.doc.querySelector("#fc"))));
const champ = MA.doc.querySelector("#iTaille"), go = MA.doc.querySelector("#fc .btn"), msg = MA.doc.querySelector("#fc .envoi");
champ.value = "abc"; await go.onclick();
t("une saisie illisible est refusée", /par exemple 84,5/.test(txt(msg)) && MA.file().length === 0);
champ.value = "84,6"; await go.onclick(); await attendre();
const fm = MA.file();
t("la virgule française est comprise", fm.length === 1 && fm[0].type === "mesure" && fm[0].tour_taille === 84.6, JSON.stringify(fm));
t("le message le confirme", /Pas de réseau/.test(txt(msg)) || /Enregistré/.test(txt(msg)));
MA.ctx.fermerFeuille();
eq("l'attente du tour de taille disparaît", atts().length, 1);

/* ==========================================================================
   3. L'analyse d'une sortie
   ========================================================================== */
M.ctx.choisir("2026-08-22");
const carte22 = M.doc.querySelector("#vJour .carte");
t("la carte dit si le plafond a tenu", /Plafond 150 tenu \d+ % du temps/.test(txt(carte22.querySelector(".ana"))), txt(carte22.querySelector(".ana")));
t("et l'allure à 150", /à 150 bpm : 5:45 \/km/.test(txt(carte22.querySelector(".ana"))));
t("couleur : tenu à plus de 90 % = vert", carte22.querySelector(".ana")._cls.has("ok") === (sortie.pctSous >= 90));
M.ctx.ouvrir(M.D.plan.find(s => s.gid === 777));
const so = M.doc.querySelector("#db .sortie");
t("le détail contient l'analyse", !!so && /kilomètre par kilomètre/.test(txt(so)));
t("le verdict du plafond", /Plafond 150 (tenu|dépassé)/.test(txt(so.querySelector(".verdict"))));
t("la courbe du cœur avec le plafond en pointillés", so.querySelectorAll("polyline").length === 1 && so.querySelectorAll("line").some(l => l.getAttribute("stroke-dasharray") === "4 3"));
t("courbe dense : pas de pastille par point", so.querySelectorAll("circle").length === 0);
eq("un rang par km, plus l'en-tête", so.querySelectorAll(".kmr").length, 5);
t("le km partiel est écrit en distance", txt(so.querySelectorAll(".kmr")[4]).indexOf("0,4") === 0, txt(so.querySelectorAll(".kmr")[4]));
t("le km au-dessus du plafond est marqué", so.querySelectorAll(".kmr")[3]._cls.has("dessus") && !so.querySelectorAll(".kmr")[1]._cls.has("dessus"));
t("le dénivelé notable est montré (+14 m)", /\+14 m/.test(txt(so.querySelectorAll(".kmr")[2])));
t("le moteur de la sortie", /À 150 bpm, tu courais à 5:45 \/km/.test(txt(so)), txt(so).slice(-400));
t("la dérive cardiaque, expliquée", /Dérive cardiaque : [\d,−-]+ %/.test(txt(so)), txt(so).slice(-300));
const gr = so.querySelector(".graphe");
gr._choisir(0);
t("toucher la courbe lit la FC et la minute", /bpm<\/b> à 0 min/.test(gr.querySelector(".lire").innerHTML), gr.querySelector(".lire").innerHTML);
M.ctx.fermer();
M.ctx.apercu({ s:M.D.plan.find(s => s.gid === 777) });
t("l'aperçu de l'agenda montre l'analyse", /Plafond 150/.test(txt(M.doc.querySelector("#fc .ana"))));
t("et propose l'analyse détaillée", txt(M.doc.querySelectorAll("#fc .btn").slice(-1)[0]) === "Voir l'analyse kilomètre par kilomètre");
M.ctx.fermerFeuille();

/* ==========================================================================
   4. Le gainage guidé
   ========================================================================== */
const G = monter(L, "2026-08-24T08:00:00", { audio:true });
const LE = G.ctx.lecteur();
let horl = 1e12; LE.h = () => horl;
const avance = s => { horl += s * 1000; G.ctx.tic(); };
const lec = () => G.doc.querySelector("#lecteur");
const cg = G.doc.querySelector("#vJour").querySelectorAll(".carte").find(c => /Gainage/.test(txt(c)));
t("la carte du gainage du jour a son bouton", !!cg.querySelector(".lancer"));
t("la course du jour n'en a pas", !G.doc.querySelector("#vJour").querySelectorAll(".carte").find(c => /Endurance fondamentale/.test(txt(c))).querySelector(".lancer"));
clic(cg.querySelector(".lancer"));
t("le lecteur s'ouvre en plein écran", lec()._cls.has("on"));
eq("30 étapes : préparation, 3 tours de 5 exercices, 2 récupérations, 12 changements de position", LE.E.length, 30);
eq("la récupération finale est retirée", LE.E[LE.E.length - 1].nom, "Mountain climber");
t("on commence par se mettre en place", txt(lec().querySelector(".lk")) === "Prépare-toi" && txt(lec().querySelector(".ln")) === "Planche coudes" && txt(G.doc.querySelector("#lNum")) === "0:10");
t("l'écran montre déjà la consigne de l'exercice", /Bassin bas/.test(txt(lec().querySelector(".lc"))));
t("la voix annonce le premier exercice", G.voix[0] === "C'est parti. Tour 1 sur 3. Planche coudes, 45 secondes.", JSON.stringify(G.voix));
avance(4);
eq("le compte à rebours suit l'horloge", txt(G.doc.querySelector("#lNum")), "0:06");
G.sons.length = 0;
avance(3.1); avance(1); avance(1);
eq("3, 2, 1 : trois bips courts", G.sons.join(","), "880,880,880");
avance(1.1);
eq("puis un long bip au départ", G.sons[3], 1320);
t("planche coudes : exercice 1 sur 5, 45 s", txt(lec().querySelector(".lk")) === "Exercice 1 sur 5" && txt(G.doc.querySelector("#lNum")) === "0:45", txt(lec().querySelector(".lk")) + " " + txt(G.doc.querySelector("#lNum")));
t("la suite est annoncée à l'écran", /Ensuite : Planche latérale droite · 30 s/.test(txt(lec().querySelector(".lsuiv"))));
avance(10);
clic(G.doc.querySelector("#lMil"));
t("pause : l'écran le dit", LE.pause != null && /En pause/.test(txt(lec())));
avance(60);
eq("en pause, le temps ne file pas", txt(G.doc.querySelector("#lNum")), "0:35");
clic(G.doc.querySelector("#lMil"));
avance(25);
t("10 secondes avant la fin, la voix le dit", G.voix.indexOf("10 secondes") >= 0, JSON.stringify(G.voix.slice(-3)));
/* Écran verrouillé pendant 5 + 30 + 5 + 30 + 5 s : au retour, on est au pont fessier. */
avance(10 + 5 + 30 + 5 + 30 + 5 + 2);
t("au retour, rattrapage jusqu'au pont fessier", txt(lec().querySelector(".ln")) === "Pont fessier" && /× 12/.test(txt(lec().querySelector(".lreps"))), txt(lec().querySelector(".ln")));
eq("un exercice en répétitions attend « Fait »", txt(G.doc.querySelector("#lMil")), "Fait");
avance(120);
eq("même deux minutes plus tard", txt(lec().querySelector(".ln")), "Pont fessier");
clic(G.doc.querySelector("#lMil"));
t("Fait : 5 s pour changer de position, l'exercice suivant affiché", txt(lec().querySelector(".lk")) === "Change de position" && txt(lec().querySelector(".ln")) === "Mountain climber");
t("et ce qui vient après", /Puis : Récupération · 40 s/.test(txt(lec().querySelector(".lsuiv"))));
t("la voix annonce l'exercice qui arrive", G.voix[G.voix.length - 1] === "Mountain climber, 20 répétitions.", G.voix[G.voix.length - 1]);
avance(5.2);
clic(G.doc.querySelector("#lMil"));
t("récupération, avec le tour suivant annoncé", txt(lec().querySelector(".lk")) === "Récupération" && /Ensuite : Tour 2 sur 3\. Planche coudes\./.test(G.voix[G.voix.length - 1]), G.voix[G.voix.length - 1]);
avance(41);
eq("tour 2", txt(lec().querySelector(".lt")), "Tour 2 sur 3");
avance(1);
G.ctx.precedent();
eq("« Précédent » au début d'un exercice : celui d'avant (pas une mise en place)", txt(lec().querySelector(".ln")), "Récupération");
for (let i = 0; i < 40 && !LE.fini; i++) G.ctx.suivant();
t("au bout du dernier exercice : l'écran de fin", LE.fini && lec()._cls.has("fin") && txt(lec().querySelector(".ln")) === "Gainage fait");
t("la durée réelle, pauses retirées", /^3 tours en \d+ min \d\d\.$/.test(txt(lec().querySelector(".lcons"))), txt(lec().querySelector(".lcons")));
t("pas de « pourquoi » quand c'est fait", !/Pourquoi \?/.test(txt(lec())));
const rqs = lec().querySelectorAll(".rq");
clic(rqs[0].querySelectorAll(".chip")[6]);
clic(rqs[1].querySelectorAll(".chip")[0]);
await G.doc.querySelector("#lEnvoyer").onclick(); await attendre();
const fg = G.file().find(r => r.type === "seance");
t("le retour part : fait, sensation 7, aucune douleur", fg && fg.fait === "fait" && fg.sensation === 7 && fg.douleur === "aucune" && fg.d === "2026-08-24" && fg.t === "Gainage circuit · 3 tours", JSON.stringify(fg));
t("avec le résumé du minuteur pour le coach", /^Gainage guidé : 3 tours en \d+ min \d\d\.$/.test(fg.note), fg.note);
t("le lecteur se ferme", !lec()._cls.has("on"));
const cg2 = G.doc.querySelector("#vJour").querySelectorAll(".carte").find(c => /Gainage/.test(txt(c)));
t("la carte passe à « Faite », sans bouton", !!cg2.querySelector(".etat.ok") && !cg2.querySelector(".lancer"));
G.ctx.onglet("vProg");
const dG = G.doc.createElement("div"); G.ctx.rendreDetail("regularite", dG); G.ctx.rendreDetail("ventre", dG);
const bandeG = dG.querySelectorAll(".bande")[1];
t("Progrès : le gainage de la semaine est compté tout de suite", bandeG.querySelectorAll(".bc").slice(-1)[0].querySelectorAll("i.plein").length === 1);

/* Arrêter demande deux touches ; la séance arrêtée part « en partie ». */
const H = monter(L, "2026-08-24T08:00:00");
const LH = H.ctx.lecteur(); let h2 = 5e11; LH.h = () => h2;
H.ctx.lancerGainage(H.D.plan.find(s => s.d === "2026-08-24" && s.fam === "renfo"));
h2 += 30000; H.ctx.tic();
clic(H.doc.querySelector("#lX"));
t("une touche sur ✕ : on demande confirmation", !LH.fini && H.doc.querySelector("#lX")._cls.has("arme"));
h2 += 5000; H.ctx.tic();
clic(H.doc.querySelector("#lX"));
t("trop tard pour confirmer : ça redemande", !LH.fini);
h2 += 1000;
clic(H.doc.querySelector("#lX"));
t("deux touches rapprochées : arrêt", LH.fini && /Gainage en partie/.test(txt(H.doc.querySelector("#lecteur .ln"))));
t("arrêtée : où, et pourquoi", /Arrêté au tour 1 sur 3/.test(txt(H.doc.querySelector("#lecteur .lcons"))) && /Pourquoi \?/.test(txt(H.doc.querySelector("#lecteur"))), txt(H.doc.querySelector("#lecteur .lcons")));
clic(H.doc.querySelector("#lecteur").querySelectorAll(".rq")[0].querySelectorAll(".chip")[1]);
await H.doc.querySelector("#lEnvoyer").onclick(); await attendre();
const fh = H.file()[0];
t("retour « en partie », pour fatigue", fh && fh.fait === "en partie" && fh.raison === "fatigue" && /arrêté au tour 1 sur 3/.test(fh.note), JSON.stringify(fh));

/* Son coupé : aucun bip. */
const S = monter(L, "2026-08-24T08:00:00", { audio:true });
S.ctx.lecteur().son = "muet"; let h3 = 1e11; S.ctx.lecteur().h = () => h3;
S.ctx.lancerGainage(S.D.plan.find(s => s.d === "2026-08-24" && s.fam === "renfo"));
for (let i = 0; i < 12; i++) { h3 += 1000; S.ctx.tic(); }
t("son coupé : ni bip ni voix", S.sons.length === 0 && S.voix.length === 0, S.sons.length + " / " + S.voix.length);

/* ==========================================================================
   5. Progrès : les objectifs
   ========================================================================== */
const P = monter(L, "2026-08-24T08:00:00");
P.ctx.onglet("vProg");
const V = P.doc.querySelector("#vProg");
const h2s = V.querySelectorAll("h2").map(txt);
eq("tableau de bord : la semaine, puis les objectifs", h2s.slice(0, 2).join(" | "), "Cette semaine | Tes objectifs");
const tu = V.querySelectorAll(".tuile");
eq("quatre tuiles au plus", tu.length <= 4 && tu.length >= 2, true);
t("tuile Courses : 0 / 2 cette semaine", txt(tu[0].querySelector(".tv")) === "0 / 2" && tu[0].dataset.k === "regularite");
t("tuile Moteur : 5:44 /km, comme sa carte", tu.find(x => x.dataset.k === "moteur") && txt(tu.find(x => x.dataset.k === "moteur").querySelector(".tv")) === "5:44 /km");
const objs = V.querySelectorAll(".obj");
t("objectif course : 6 semaines sur 12, en barre", /6 sur 12 sem/.test(txt(objs[0])) && !!objs[0].querySelector(".barre"));
t("objectif gainage : 4 sur 12", /4 sur 12 sem/.test(txt(objs[1])));
t("tour de taille : dernière mesure, écart, et « à relever »", /85,2 cm · −0,8 · à relever/.test(txt(objs[2])), txt(objs[2]));
t("vélo : en pause", /en pause/.test(txt(objs[3])));
clic(tu[0]);
t("toucher une tuile ouvre sa carte détaillée", P.doc.querySelector("#feuille")._cls.has("on") && /6 semaines sur 12/.test(txt(P.doc.querySelector("#fc"))));
P.ctx.fermerFeuille();
const dP = () => { const d = P.doc.createElement("div"); for (const id of ["regularite", "moteur", "ventre", "velo"]) P.ctx.rendreDetail(id, d); return d; };
const cP = dP();
const st = cP.querySelectorAll(".stat");
eq("course : titre", txt(st[0].querySelector(".stt")), "Courir 2 fois par semaine");
t("course : cette semaine 0 sur 2", txt(st[0].querySelector(".stv")).indexOf("0 sur 2") === 0);
t("course : 6 semaines sur 12 à 2 courses ou plus", /6 semaines sur 12/.test(txt(st[0])), txt(st[0].querySelector(".stp")));
t("course : la dernière course, datée", /Dernière course : samedi 22 août/.test(txt(st[0])));
t("course : ce qui reste prévu", /Prévu d'ici dimanche : aujourd'hui, jeudi et samedi/.test(txt(st[0])), txt(st[0].querySelector(".stp")));
const bc = st[0].querySelectorAll(".bc");
eq("une colonne par semaine", bc.length, 12);
eq("deux cases par semaine", bc[0].querySelectorAll("i").length, 2);
t("la semaine en cours est marquée", bc[11]._cls.has("ici") && !bc[10]._cls.has("ici"));
eq("une semaine à 4 courses remplit ses deux cases", bc[10].querySelectorAll("i.plein").length, 2);
clic(bc[10]);
t("toucher une semaine la raconte", /4 courses<\/b> semaine du 17 août/.test(st[0].querySelector(".lire").innerHTML), st[0].querySelector(".lire").innerHTML);
eq("moteur : titre", txt(st[1].querySelector(".stt")), "Ton moteur");
t("moteur : la dernière mesure", txt(st[1].querySelector(".stv")).indexOf("5:44 /km") === 0);
t("moteur : le dernier mois, comparé au printemps, chiffré", /Août : 5:44 \/km \(médiane de 3 sorties\)\. De février à avril : 6:08\./.test(txt(st[1])) && /24 s\/km plus vite/.test(txt(st[1])), txt(st[1].querySelector(".stp")));
/* Un point par mois (médiane) : février 370, avril 365, août 344 à 150 bpm ; août 363 à 140. */
const pts150 = st[1].querySelectorAll("circle").filter(c => c.getAttribute("fill") === "#0EA5E9").map(c => +c.getAttribute("cy"));
const pts140 = st[1].querySelectorAll("circle").filter(c => c.getAttribute("fill") === "#22C55E");
t("un point par mois mesuré", pts150.length === 3 && pts140.length === 1, pts150.length + " / " + pts140.length);
t("axe inversé : août (5:44) dessiné plus haut que février (6:10)", pts150[2] < pts150[0], JSON.stringify(pts150));
t("les mois sur l'axe, de février à août", /févr\./.test(txt(st[1])) && /août/.test(txt(st[1])));
eq("février et avril reliés (un mois d'écart), pas avril et août", st[1].querySelectorAll("polyline").length, 1);
const gm = st[1].querySelector(".graphe");
t("par défaut : le dernier mois mesuré, avec le nombre de sorties", /Août : <b>5:44 \/km<\/b> à 150 bpm \(médiane de 3 sorties, de 5:31 à 6:24\)/.test(gm.querySelector(".lire").innerHTML), gm.querySelector(".lire").innerHTML);
gm._choisir(1);
t("un mois sans sortie le dit", /Mars : pas de mesure/.test(gm.querySelector(".lire").innerHTML), gm.querySelector(".lire").innerHTML);
eq("ventre : la dernière mesure", txt(st[2].querySelector(".stv")).slice(0, 7), "85,2 cm");
t("ventre : l'écart depuis la première mesure", /−0,8 cm depuis le 1er août/.test(txt(st[2].querySelector(".chip-e"))), txt(st[2].querySelector(".chip-e")));
t("ventre : la mesure est due", /Prochaine mesure : maintenant/.test(txt(st[2])));
t("ventre : gainage 4 semaines sur 12, dernier il y a 11 jours", /Gainage : 4 semaines sur 12/.test(txt(st[2])) && /jeudi 13 août, il y a 11 jours/.test(txt(st[2])), txt(st[2]).slice(-200));
clic(cP.querySelector("#bTaille"));
P.doc.querySelector("#iTaille").value = "84.4";
await P.doc.querySelector("#fc .btn").onclick(); await attendre();
P.ctx.fermerFeuille();
const cP2 = dP(), st2 = cP2.querySelectorAll(".stat");
t("la nouvelle mesure s'affiche aussitôt", txt(st2[2].querySelector(".stv")).indexOf("84,4 cm") === 0 && /−1,6 cm/.test(txt(st2[2].querySelector(".chip-e"))), txt(st2[2].querySelector(".stv")));
eq("vélo : titre", txt(st2[3].querySelector(".stt")), "Reprendre le vélo");
t("vélo : ce qui bloque, depuis quand, dernière sortie", /Compte rendu du échographie/.test(txt(st2[3])) && /lundi 10 août/.test(txt(st2[3])) && /samedi 2 mai/.test(txt(st2[3])));
clic(cP2.querySelector("#bVelo"));
t("vélo : « C'est réglé » prépare le message", /^À propos de « Compte rendu du échographie » : $/.test(P.doc.querySelector("#db textarea").value));
P.ctx.fermer();

/* Coucher et lever (lot 2, point 6) */
const nuitsJ = Array.from({ length:14 }, (_, i) => { const d = new Date(2026, 7, 11 + i); const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  return { d:k, sg:400, sw:null, vfc:55, ch:1, cou:i === 3 ? null : [640, 700, 780, 600, 690, 710, 650][i % 7], lev:i === 3 ? null : 1110 }; });
const SN = monter(Object.assign({}, L, { tendances:{ jours:nuitsJ, vfc:[48, 84] } }), "2026-08-24T08:00:00");
SN.ctx.onglet("vProg");
const dSN = SN.doc.createElement("div"); SN.ctx.rendreDetail("nuits", dSN);
const cn = dSN.querySelectorAll(".stat").find(c => /Coucher et lever/.test(txt(c)));
t("ligne « Coucher et lever » dans Ta forme", SN.doc.querySelector("#vProg").querySelectorAll(".ligne.det").some(l => l.dataset.k === "nuits"));
t("carte « Coucher et lever »", !!cn);
t("coucher moyen des 7 dernières nuits", /^\d+h\d\d/.test(txt(cn.querySelector(".stv"))), txt(cn.querySelector(".stv")));
t("nuits couchées avant 23 h comptées", /Couché avant 23 h : \d nuits? sur 7/.test(txt(cn)), txt(cn.querySelector(".stp")));
t("une barre par nuit mesurée (13 sur 14)", cn.querySelectorAll("rect").length === 13);
t("la ligne de 23 h en pointillés", cn.querySelectorAll("line").some(l => l.getAttribute("stroke-dasharray") === "4 3"));
cn.querySelector(".graphe")._choisir(3);
t("nuit sans mesure : dite", /Pas de mesure/.test(cn.querySelector(".lire").innerHTML));
cn.querySelector(".graphe")._choisir(0);
t("toucher une nuit : coucher → lever", /22h40 → 6h30/.test(cn.querySelector(".lire").innerHTML), cn.querySelector(".lire").innerHTML);

/* Sans objectifs dans les données (ancienne page) : Progrès reste comme avant. */
const PA = monter(F, "2026-08-22T10:00:00");
PA.ctx.onglet("vProg");
t("sans données d'objectifs : pas de section vide", PA.doc.querySelector("#vProg").querySelectorAll("h2").every(h => txt(h) !== "Tes objectifs"));

/* ==========================================================================
   5 bis. Le bandeau de l'agenda ne clignote plus (vidéo de l'utilisateur, 6 octobre)
   Le doigt posé sur l'écran fait trembler le défilement de quelques pixels :
   l'ancien code basculait le bandeau à chaque tremblement.
   ========================================================================== */
const ecoute = {};
const B = monter(L, "2026-08-24T08:00:00", { win:{ addEventListener:(t, f) => { (ecoute[t] = ecoute[t] || []).push(f); }, requestAnimationFrame:f => f(), innerHeight:800, scrollY:0 } });
B.doc.documentElement = { scrollHeight:5000, style:{ setProperty() {} } };
let tb = 3e12; B.ctx.lecteur().h = () => tb;
B.ctx.onglet("vPlan");
const bandeauH = () => B.doc.querySelector("#agHaut");
let nB = 0, etatB = false;
const defile = (y, pas) => { tb += pas == null ? 50 : pas; B.ctx.window.scrollY = y; for (const f of ecoute.scroll || []) f();
  const c = bandeauH()._cls.has("cache"); if (c !== etatB) { nB++; etatB = c; } };
t("le défilement est écouté", (ecoute.scroll || []).length === 1);
for (let y = 0; y <= 1000; y += 25) defile(y, 16);
t("descendre franchement efface le bandeau", bandeauH()._cls.has("cache") && nB === 1, nB);
tb += 1000;
const avant = nB;
for (let i = 0; i < 80; i++) defile(1000 + (i % 2 ? 4 : -4), 25);        /* 2 s de tremblement, comme sur la vidéo */
eq("doigt posé, défilement qui tremble de ±4 px pendant 2 s : aucune bascule", nB - avant, 0);
for (let i = 0; i < 40; i++) defile(1000 + [0, 6, -3, 7, -5, 2][i % 6], 25);
eq("tremblement irrégulier : toujours aucune bascule", nB - avant, 0);
defile(990); defile(982); defile(975);
t("remonter de 25 px rappelle le bandeau", !bandeauH()._cls.has("cache"));
tb += 500;                                                              /* après la pause de 400 ms */
defile(985); defile(995); defile(1005);
t("redescendre de 30 px ne suffit pas à l'effacer", !bandeauH()._cls.has("cache"));
defile(1020); defile(1040);
t("au-delà de 48 px de descente continue, il s'efface", bandeauH()._cls.has("cache"));
defile(1030, 100);
t("dans les 400 ms qui suivent une bascule, rien ne rebascule", bandeauH()._cls.has("cache"));
tb += 1000;
defile(4200); defile(4260); defile(4230); defile(4290); defile(4200);
t("rebond élastique en bas de page (au-delà du bord) : ignoré", bandeauH()._cls.has("cache"));
defile(100);
t("revenu en haut de page : affiché", !bandeauH()._cls.has("cache"));
/* Garde-fou : si quelque chose fait basculer le bandeau en boucle, il reste affiché. */
const B2 = monter(L, "2026-08-24T08:00:00", { win:{ addEventListener:(t, f) => { (ecoute["b2" + t] = ecoute["b2" + t] || []).push(f); }, requestAnimationFrame:f => f(), innerHeight:800, scrollY:0 } });
B2.doc.documentElement = { scrollHeight:5000, style:{ setProperty() {} } };
let t2 = 3e12; B2.ctx.lecteur().h = () => t2;
B2.ctx.onglet("vPlan");
const d2 = y => { t2 += 450; B2.ctx.window.scrollY = y; for (const f of ecoute.b2scroll) f(); };
d2(500); for (let i = 0; i < 8; i++) d2(i % 2 ? 1500 : 1400);
t("plus de 6 bascules en 4 s : le bandeau reste affiché", !B2.doc.querySelector("#agHaut")._cls.has("cache"));
d2(2500); d2(3500);
t("et ne s'efface plus jusqu'au rechargement", !B2.doc.querySelector("#agHaut")._cls.has("cache"));

/* ==========================================================================
   5 ter. Notifications : activation depuis les réglages (faux iPhone)
   ========================================================================== */
let abonne = null, demande = 0, cleServeur = null;
const faux = (standalone, permission) => {
  const reg = { active:{ postMessage() {} }, pushManager:{ getSubscription:async () => abonne,
    subscribe:async o => { cleServeur = o.applicationServerKey; abonne = { endpoint:"https://web.push.apple.com/abc", toJSON:() => ({ endpoint:"https://web.push.apple.com/abc", keys:{ p256dh:"x", auth:"y" } }), unsubscribe:async () => { abonne = null; } }; return abonne; } } };
  const Notif = { permission, requestPermission:async () => { demande++; Notif.permission = "granted"; return "granted"; } };
  return { navigator:{ standalone, serviceWorker:{ ready:Promise.resolve(reg), register:async () => reg } }, Notification:Notif, atob, Uint8Array,
           VAPID:"BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4" };
};
const NB = monter(L, "2026-08-24T08:00:00", { ctx:faux(false, "default"), win:{ PushManager:function () {}, Notification:{} } });
NB.ctx.window.PushManager = function () {}; NB.ctx.window.Notification = NB.ctx.Notification;
clic(NB.doc.querySelector("#bReg")); clic(NB.doc.querySelector("#rNotifs")); await attendre();
t("dans Safari (pas l'icône) : on explique qu'il faut l'icône de l'écran d'accueil", /icône de l'écran d'accueil/.test(txt(NB.doc.querySelector("#fc .notifs"))) && !NB.doc.querySelector("#bNotifs"));
const NA = monter(L, "2026-08-24T08:00:00", { ctx:faux(true, "default") });
NA.ctx.window.PushManager = function () {}; NA.ctx.window.Notification = NA.ctx.Notification;
clic(NA.doc.querySelector("#bReg")); clic(NA.doc.querySelector("#rNotifs")); await attendre();
t("depuis l'icône : bouton « Activer les notifications »", !!NA.doc.querySelector("#bNotifs"));
await NA.doc.querySelector("#bNotifs").onclick(); await attendre();
t("l'autorisation est demandée une fois, dans le geste", demande === 1);
t("abonnement avec la clé publique de la page (65 octets)", cleServeur && cleServeur.length === 65 && cleServeur[0] === 4, cleServeur && cleServeur.length);
t("hors réseau dans le banc : on le dit franchement", /serveur n'a pas répondu/.test(txt(NA.doc.querySelector("#fc .envoi"))), txt(NA.doc.querySelector("#fc .envoi")));
const bascules = () => NA.doc.querySelectorAll("#fc .bascule");
eq("une fois abonné : cinq interrupteurs (dont le mot du coach)", bascules().length, 5);
t("tous activés par défaut", bascules().every(b => b._cls.has("on")));
t("heure du rappel : 19 h par défaut", NA.doc.querySelectorAll("#fc .notifs .seg button").find(b => b._cls.has("on")).dataset.h === "19");
await bascules()[1].onclick(); await attendre();
t("couper « au lit » : interrupteur éteint, préférence gardée", !bascules()[1]._cls.has("on") && JSON.parse(NA.ctx.localStorage.getItem("coach-notifs")).coucher === false);
await NA.doc.querySelectorAll("#fc .notifs .seg button")[3].onclick(); await attendre();
t("rappel à 20 h", JSON.parse(NA.ctx.localStorage.getItem("coach-notifs")).heure === 20);
await bascules()[0].onclick(); await attendre();
t("rappel de séance coupé : le choix de l'heure disparaît", NA.doc.querySelectorAll("#fc .notifs .seg button").length === 0);
t("un bouton de test", !!NA.doc.querySelector("#bNotifTest"));

/* ==========================================================================
   6. Interdits
   ========================================================================== */
for (const X of [M, G, P]) for (const v of ["vJour", "vPlan", "vProg"]) X.ctx.onglet(v);
const tout = M.racine.outerHTML + G.racine.outerHTML + P.racine.outerHTML;
t("aucun texte cassé", !/undefined|\bNaN\b|\[object/.test(tout), (tout.match(/.{40}(undefined|NaN|\[object).{20}/) || [""])[0]);
for (const hex of new Set(tout.match(/#[0-9A-Fa-f]{6}/g) || [])) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d || d / mx < 0.3) continue;
  let h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  t("pas de violet (" + hex + ")", !(h >= 255 && h <= 320), hex);
}

/* ==========================================================================
   7. Bandeau, agenda en liste, mot du coach qui suit les nouvelles (6 octobre)
   ========================================================================== */
{
const L7 = Object.assign({}, L, {
  mot:"Nuit non mesurée : traite-la comme une nuit courte. <b>Footing facile ce soir.</b>", motDate:"2026-08-24",
  motVu:"2026-08-24T07:27:00",
  echeances:L.echeances.concat([{ d:"2026-08-29", l:"Test de contrôle", j:5 }, { d:"2026-09-13", l:"15 km de Rouen · course avec dossard", k:"course", j:20 }]),
  reaction:{ motVu:"2026-08-24T07:27:00", raisons:["ta nuit, mesurée après le mot (5h07)", "ton message de 16h16 : « J'ai une course »"],
             attendre:"la réaction déjà en cours", prochain:"au débrief de 20h23", lance:"2026-08-24T19:01:00" },
  retours:(L.retours || []).concat([{ type:"note", d:"2026-08-24", note:"J'ai une course", ecrit:"2026-08-24 16h16" },
                                    { type:"note", d:"2026-08-24", note:"Bien dormi finalement", ecrit:"2026-08-24 07h10" }])
});
const K7 = monter(L7, "2026-08-24T19:05:00");
const K7J = K7.doc.querySelector("#vJour");
t("en-tête : trois colonnes, titre vraiment centré", /header\{display:grid;grid-template-columns:1fr auto 1fr/.test(head));
t("les flèches encadrent les jours (une rangée de moins)", K7.doc.querySelector(".semnav #sem") !== null && K7.doc.querySelector("#semT")._cls.has("vh"));
t("la racine reste sombre sous la barre d'état", /html\{background:var\(--ch\);color-scheme:dark\}/.test(head));
eq("le mot porte son heure", txt(K7J.querySelector(".motd")), "Le mot du coach · 7h27");
const mr = K7J.querySelector(".motr");
t("le coach relit : on le dit, avec ce qui a changé", mr && mr._cls.has("en") && /Le coach relit depuis 19h01 : ta nuit, mesurée après le mot \(5h07\) ; ton message de 16h16/.test(txt(mr)), txt(mr));
t("message de 16h16 : pas encore lu", /dans ton carnet, pas encore lu par le coach/.test(txt(K7J)), txt(K7J));
t("message de 7h10 : lu (le mot est de 7h27)", /07h10 · lu par le coach/.test(txt(K7J)));
t("la course à dossard s'annonce dans la carte de la semaine", /15 km de Rouen · dans 20 jours/.test(txt(K7J.querySelector(".sem7 .s7c"))), txt(K7J.querySelector(".sem7")));
t("pas les autres rendez-vous (ils sont dans l'agenda)", !/Test de contrôle/.test(txt(K7J)));
t("la carte de la semaine annonce la séance suivante", /Ensuite · /.test(txt(K7J.querySelector(".sem7"))));
const K72 = monter(Object.assign({}, L7, { reaction:Object.assign({}, L7.reaction, { lance:null }) }), "2026-08-24T19:05:00");
t("sans réveil en cours : ce qui est arrivé, et quand le coach le reprendra", /Arrivé après ce mot : ta nuit.+Le coach en tiendra compte au débrief de 20h23\./.test(txt(K72.doc.querySelector("#vJour .motr"))), txt(K72.doc.querySelector("#vJour .motr")));
const K73 = monter(Object.assign({}, L7, { motVu:"2026-08-24T19:20:00" }), "2026-08-24T19:25:00");
t("nouveau mot écrit : plus de bandeau de relecture", !K73.doc.querySelector("#vJour .motr") && /16h16 · lu par le coach/.test(txt(K73.doc.querySelector("#vJour"))));
/* Les flèches de la semaine vont au-delà du plan écrit. */
clic(K7.doc.querySelector("#semD")); clic(K7.doc.querySelector("#semD"));
t("deux semaines plus loin, la flèche marche encore", /31 août|7 sept/.test(txt(K7.doc.querySelector("#semT"))), txt(K7.doc.querySelector("#semT")));
t("une semaine sans plan le dit", /pas encore écrit/.test(txt(K7J)));
/* L'agenda en liste */
K7.ctx.onglet("vPlan");
const K7P = K7.doc.querySelector("#vPlan");
const ici7 = K7P.querySelector(".wk.ici");
t("la semaine en cours : titre « Du … au … » et repère", /^Du 24 au 30 août/.test(txt(ici7.querySelector(".wkt"))) && txt(ici7.querySelector(".wkb")) === "Cette semaine", txt(ici7.querySelector(".wkh2")));
t("chaque séance est une carte bordée de sa couleur", ici7.querySelectorAll(".jrs .ev").length >= 1 && ici7.querySelector(".jrs .ev .evb").getAttribute("style").indexOf("background") >= 0);
const wkC = K7P.querySelectorAll(".wk").find(w => /15 km de Rouen/.test(txt(w)));
t("la semaine de la course : seulement le jour de la course, et « Ta course »", wkC && wkC.querySelectorAll(".jr").length === 1 && /Ta course · dans 20 jours/.test(txt(wkC)) && wkC.querySelector(".evb")._cls.has("dossard"), wkC && txt(wkC));

}
/* ==========================================================================
   8. Pages à la carte (11 octobre)
   ========================================================================== */
{
  const X = monter(L, "2026-08-24T08:00:00");
  const XJ = () => X.doc.querySelector("#vJour");
  const ordreJour = () => {
    const h = XJ().innerHTML;
    return [["forme", 'class="matin'], ["seances", 'class="carte'], ["messages", 'id="bNote"']]
      .map(([k, m]) => [k, h.indexOf(m)]).filter(x => x[1] >= 0).sort((a, b) => a[1] - b[1]).map(x => x[0]).join(",");
  };
  eq("par défaut : séance, forme, …, messages", ordreJour(), "seances,forme,messages");
  t("plus de lien « Personnaliser » sur la page (il est dans les réglages)", !XJ().querySelector(".lien.perso"));
  clic(X.doc.querySelector("#bReg")); clic(X.doc.querySelector("#rPageJour"));
  t("Réglages → Page Jour", txt(X.doc.querySelector("#fc .fst")) === "Page Jour" && !!X.doc.querySelector("#fRetour"));
  const ligne = id => X.doc.querySelectorAll("#fc .ligne.bloc").find(l => l.dataset.id === id);
  eq("six blocs réglables", X.doc.querySelectorAll("#fc .ligne.bloc").length, 6);
  t("la séance ne se cache pas et reste en tête", ligne("seances").querySelector(".bascule").disabled === true && ligne("seances").querySelectorAll(".ord").every(b => b.disabled));
  t("le suivant ne monte pas au-dessus, le dernier ne descend pas", ligne("forme").querySelectorAll(".ord")[0].disabled && ligne("messages").querySelectorAll(".ord")[1].disabled);
  clic(ligne("forme").querySelector(".bascule"));
  t("cacher la forme : elle disparaît aussitôt de la page", !XJ().querySelector(".matin") && ligne("forme")._cls.has("off"));
  t("et le choix est gardé sur l'iPhone", JSON.parse(X.ctx.localStorage.getItem("coach-pages")).jour.caches.indexOf("forme") >= 0);
  for (let i = 0; i < 5; i++) clic(ligne("messages").querySelectorAll(".ord")[0]);
  eq("messages remontés juste sous la séance, qui reste en tête", ordreJour(), "seances,messages");
  t("et au-dessus du mot du coach", XJ().innerHTML.indexOf('id="bNote"') < XJ().innerHTML.indexOf('class="mot'));
  /* Rechargée, la page garde l'ordre */
  const X2 = monter(L, "2026-08-24T08:00:00");
  X2.ctx.localStorage.setItem("coach-pages", X.ctx.localStorage.getItem("coach-pages")); X2.ctx.rafraichir();
  const h2 = X2.doc.querySelector("#vJour").innerHTML;
  t("une autre ouverture garde l'ordre et le choix", h2.indexOf('class="carte') < h2.indexOf('id="bNote"') && h2.indexOf('id="bNote"') < h2.indexOf('class="mot') && h2.indexOf('class="matin') < 0);
  clic(X.doc.querySelector("#bRaz"));
  eq("« Revenir à la page d'origine »", ordreJour(), "seances,forme,messages");
  /* Progrès : ranger à l'intérieur d'un groupe, cacher une carte */
  X.ctx.fermerFeuille(); X.ctx.onglet("vProg");
  const XP = () => X.doc.querySelector("#vProg");
  const titres = () => XP().querySelectorAll("h2").map(n => txt(n)).join(" | ");
  const avant = titres();
  t("Progrès : la semaine en tuiles, puis les objectifs", avant.indexOf("Cette semaine") === 0 && avant.indexOf("Tes objectifs") > 0, avant);
  clic(X.doc.querySelector("#bReg")); clic(X.doc.querySelector("#rPageProg"));
  t("réglages de la page Progrès, par groupe", txt(X.doc.querySelector("#fc .fst")) === "Page Progrès" && /Tes objectifs.*Ta forme.*Tes repères/.test(txt(X.doc.querySelector("#fc .perso-l"))));
  const lp = id => X.doc.querySelectorAll("#fc .ligne.bloc").find(l => l.dataset.id === id);
  t("une carte ne sort pas de son groupe", lp("velo").querySelectorAll(".ord")[1].disabled && lp("sommeil").querySelectorAll(".ord")[0].disabled);
  const cartesP = () => XP().querySelectorAll(".sc").map(c => c.dataset ? c.dataset.k : "").filter(Boolean);
  clic(lp("charge").querySelector(".bascule"));
  t("cacher la charge", !/Zone productive/.test(txt(XP())));
  for (const o of ["regularite", "gainage", "ventre", "velo"]) { const l = lp(o); if (l.querySelector(".bascule")._cls.has("on")) clic(l.querySelector(".bascule")); }
  t("tout le groupe objectifs caché : son titre disparaît, le reste demeure", titres().indexOf("Tes objectifs") < 0 && titres().length > 0, titres());
  X.ctx.fermerFeuille();
}

{
  /* Semaines esquissées du programme sur 4 semaines : « à confirmer ». */
  const PV = monter(Object.assign({}, L, { plan:L.plan.map(s => s.d === "2026-08-27" ? Object.assign({}, s, { prov:true }) : s) }), "2026-08-24T08:00:00");
  PV.ctx.choisir("2026-08-27");
  t("une séance esquissée est marquée « À confirmer »", PV.doc.querySelectorAll("#vJour .carte .etat.prov").length >= 1);
}
console.log("\n  " + ok + " tests verts, " + ko + " rouges");
if (ko) { console.log("\n  ÉCHECS :"); echecs.forEach(e => console.log("  ✗ " + e)); process.exit(1); }
console.log("  Lot 1 validé.\n");
})().catch(e => { console.log("PLANTAGE : " + e.stack); process.exit(1); });
