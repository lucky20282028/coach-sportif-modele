/* ==========================================================================
   BANC D'ESSAI DE L'ÉCRAN — v2 (6 octobre 2026)
   On exécute le vrai rendu dans un DOM factice, avec l'heure du téléphone
   figée (D.__now), puis on relit le HTML. Remplace le banc v12.
   ========================================================================== */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { creerDocument } = require("./dom.js");

let ok = 0, ko = 0; const echecs = [];
const t = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? "  → " + String(d).slice(0, 200) : "")); } };
const eq = (n, a, b) => t(n, a === b, "attendu " + JSON.stringify(b) + ", obtenu " + JSON.stringify(a));

const ici = __dirname;
const core = fs.readFileSync(path.join(ici, "core.js"), "utf8").replace(/\nif \(typeof module[\s\S]*$/, "\n");
const app  = fs.readFileSync(path.join(ici, "app.js"), "utf8");
const head = fs.readFileSync(path.join(ici, "head.html"), "utf8");

function monter(donnees, now) {
  const { doc, racine } = creerDocument(head);
  const win = { addEventListener() {}, scrollTo() {} };
  const D = JSON.parse(JSON.stringify(donnees));
  D.__now = now || "2026-08-22T10:00:00";
  const ctx = {
    D, document: doc, window: win,
    history: { pushState() {} }, location: { href:"" },
    console, JSON, Math, String, Number, Array, Object, Date, RegExp, parseFloat, parseInt, Promise, Set, Map, isNaN
  };
  win.location = ctx.location;
  vm.createContext(ctx);
  vm.runInContext(core + "\n" + app, ctx, { filename:"app.js" });
  return { doc, racine, ctx, html: () => racine.outerHTML };
}
const clic = n => n.onclick();

/* Jeu figé, jamais les données du jour. */
const D = require("./fixture.js");
const M = monter(D);
const doc = M.doc;
const jour = doc.querySelector("#vJour"), plan = doc.querySelector("#vPlan"), prog = doc.querySelector("#vProg");

/* ---------- 1. En-tête et bandeau ---------- */
eq("le jour est écrit en toutes lettres", doc.querySelector("#hj").textContent, "Samedi 22 août");
const sj = () => doc.querySelectorAll("#sem .sj");
eq("sept jours dans le bandeau", sj().length, 7);
eq("un seul jour choisi", sj().filter(x => x._cls.has("sel")).length, 1);
t("le jour choisi est le 22", sj().find(x => x._cls.has("sel")).textContent.indexOf("22") >= 0);
eq("lundi en premier", sj()[0].textContent.slice(0, 3), "LUN");
eq("mardi 18 : une pastille (gainage)", sj()[1].querySelectorAll(".pt").length, 1);
t("mardi 18 : gainage sauté, pastille marquée", sj()[1].querySelector(".pt")._cls.has("manque"));
eq("mercredi 19 : aucune pastille (repos)", sj()[2].querySelectorAll(".pt").length, 0);
eq("jeudi 20 : deux pastilles (course + gainage)", sj()[3].querySelectorAll(".pt").length, 2);
eq("dimanche 23 : aucune pastille", sj()[6].querySelectorAll(".pt").length, 0);
t("le titre de la semaine est lisible", doc.querySelector("#semT").textContent === "17 août – 23 août", doc.querySelector("#semT").textContent);
t("le bouton L est un bouton", doc.querySelector("#bReg").tag === "button");
t("l'heure est un bouton", doc.querySelector("#bMaj").tag === "button" && doc.querySelector("#majH").textContent === "18:35", doc.querySelector("#majH").textContent);

/* ---------- 2. Écran du jour ---------- */
eq("titre : Aujourd'hui", jour.querySelector("h1").textContent, "Aujourd'hui");
const cartes = jour.querySelectorAll(".carte");
eq("une seule séance aujourd'hui", cartes.length, 1);
t("le titre est celui de la séance", cartes[0].querySelector(".ctit").textContent.indexOf("Sortie longue 1h30") >= 0, cartes[0].textContent);
t("la séance est marquée faite", cartes[0].querySelector(".etat.ok") !== null);
const rv = cartes[0].querySelectorAll(".rv").map(x => x.textContent);
t("le réalisé est affiché", rv.indexOf("15,2 km") >= 0 && rv.indexOf("1:31:16") >= 0 && rv.indexOf("150") >= 0, rv.join(" "));
t("le sport est affiché en pastille, avec son icône", cartes[0].querySelector(".pill").textContent === "Course à pied" && !!cartes[0].querySelector(".pill svg"));
eq("un seul mot du coach", jour.querySelectorAll(".mot").length, 1);
t("le mot ne cache pas le sommeil qui baisse", /5h31/.test(jour.querySelector(".mot").textContent));
eq("trois chiffres, pas quatre", jour.querySelectorAll(".n3 > div").length, 3);
eq("charge en premier", jour.querySelectorAll(".n3v")[0].textContent, "1,2");
t("aucun record ni estimation sur l'écran du jour", jour.textContent.indexOf("22:38") < 0 && jour.textContent.indexOf("20:58") < 0);
t("pas de retour à aujourd'hui quand on y est", !jour.querySelector(".retour"));
t("le bouton Écrire au coach est là", !!jour.querySelector("#bNote"));

/* ---------- 3. Toucher une date ouvre CE jour ---------- */
clic(sj()[3]);
t("on reste sur l'onglet Jour", jour._cls.has("on") && !plan._cls.has("on"));
eq("titre : jeudi 20", jour.querySelector("h1").textContent, "Jeudi 20");
eq("jeudi 20 porte bien DEUX séances", jour.querySelectorAll(".carte").length, 2);
t("la course y est, sous un nom clair", jour.textContent.indexOf("Endurance fondamentale") >= 0 && jour.textContent.indexOf("Aérobie faible") < 0);
t("le gainage aussi", jour.textContent.indexOf("Gainage") >= 0);
t("le gainage du 20 est marqué pas fait", jour.querySelectorAll(".carte")[1].querySelector(".etat.ko") !== null);
t("le profil de séance est dessiné", jour.querySelectorAll(".carte")[1].querySelectorAll("rect").length >= 10);
t("un bouton ramène à aujourd'hui", !!jour.querySelector(".retour"));
t("le jour touché est choisi dans le bandeau", sj()[3]._cls.has("sel") && !sj()[5]._cls.has("sel"));
t("le mot du coach reste sur son jour", jour.querySelectorAll(".mot").length === 0);
clic(sj()[2]);
t("un jour de repos affiche une carte Repos", jour.querySelector(".carte.repos") !== null && jour.textContent.indexOf("il pleuvait") >= 0);
clic(jour.querySelector(".retour"));
eq("retour à aujourd'hui", jour.querySelector("h1").textContent, "Aujourd'hui");

/* Semaine suivante, puis retour */
clic(doc.querySelector("#semD"));
t("la flèche passe à la semaine suivante", doc.querySelector("#semT").textContent === "24 août – 30 août", doc.querySelector("#semT").textContent);
eq("lundi 24 : deux séances", jour.querySelectorAll(".carte").length, 2);
t("la semaine d'après reste accessible (rendez-vous, plan à venir)", doc.querySelector("#semD").disabled === false);
clic(doc.querySelector("#semG"));
t("et revient", doc.querySelector("#semT").textContent === "17 août – 23 août");
clic(sj()[5]);

/* ---------- 4. Agenda : le mois, l'aperçu, la liste (7 octobre) ---------- */
M.ctx.onglet("vPlan");
t("l'onglet Agenda s'affiche", plan._cls.has("on") && !jour._cls.has("on"));
eq("le bandeau des jours se cache", doc.querySelector("#bandeau").style.display, "none");
eq("titre : Agenda", plan.querySelector("h1").textContent, "Agenda");
t("l'agenda s'ouvre en mode liste", plan.querySelectorAll(".seg.petit button")[1]._cls.has("on") && plan.querySelectorAll(".wk").length >= 2);
t("le bandeau Mois | Liste peut rester collé en haut", plan.querySelector("#agHaut") !== null);
clic(plan.querySelectorAll(".seg.petit button")[0]);
eq("le mois en cours", plan.querySelector(".agm").textContent, "Août 2026");
const mc = () => plan.querySelectorAll(".mc");
eq("six semaines de grille (lundi → dimanche)", mc().length, 42);
const cel = n => mc().find(c => !c._cls.has("hors") && c.querySelector(".mcd").textContent === String(n));
t("aujourd'hui est choisi", cel(22)._cls.has("sel") && cel(22)._cls.has("auj"));
eq("jeudi 20 : deux pastilles", cel(20).querySelectorAll(".pt").length, 2);
t("mardi 18 : gainage sauté, pastille marquée", cel(18).querySelector(".pt")._cls.has("manque"));
t("le jour choisi est détaillé sous la grille", plan.querySelector(".agjt").textContent === "Samedi 22 août · aujourd'hui");
eq("une séance ce jour-là", plan.querySelectorAll(".agjour .ev").length, 1);
const wks = () => plan.querySelector(".wks").textContent;
t("suivi de la semaine : 4 séances faites sur 6", wks().indexOf("4 sur 6") === 0, wks());
t("kilomètres courus vraiment additionnés", /40,9 sur/.test(wks()), wks());
t("la barre de progression est remplie à 67 %", plan.querySelector(".barre i").getAttribute("style").indexOf("67%") >= 0);
clic(cel(20));
t("toucher un jour reste dans l'agenda", plan._cls.has("on") && !jour._cls.has("on"));
eq("et montre ses deux séances", plan.querySelectorAll(".agjour .ev").length, 2);
t("le gainage du 20 est pas fait", plan.querySelectorAll(".agjour .ev")[1].querySelector(".evs.ko") !== null);
clic(plan.querySelectorAll(".agjour .ev")[0]);
t("toucher une séance ouvre un aperçu par-dessus l'agenda", doc.querySelector("#feuille")._cls.has("on") && plan._cls.has("on") && !doc.querySelector("#det")._cls.has("on"));
t("l'aperçu donne la date, le titre, le réalisé", /Jeudi 20 août/.test(doc.querySelector("#fc").textContent) && /Endurance fondamentale/.test(doc.querySelector("#fc .ctit").textContent) && doc.querySelector("#fc").querySelectorAll(".rv").length >= 3);
t("et propose le détail complet", /Voir la séance/.test(doc.querySelector("#fc .btn").textContent));
clic(doc.querySelector("#fc .btn"));
t("le détail s'ouvre, l'agenda reste derrière", doc.querySelector("#det")._cls.has("on") && plan._cls.has("on") && !doc.querySelector("#feuille")._cls.has("on"));
M.ctx.fermer();
const navs = () => plan.querySelectorAll(".agnav button");
t("pas de mois avant le début du plan", navs()[0].disabled === true);
clic(navs()[1]);
eq("le mois suivant", plan.querySelector(".agm").textContent, "Septembre 2026");
clic(plan.querySelectorAll(".agnav button")[0]);
eq("et retour", plan.querySelector(".agm").textContent, "Août 2026");
clic(plan.querySelectorAll(".seg.petit button")[1]);
const wk = plan.querySelectorAll(".wk");
t("mode liste : toutes les semaines, dans l'ordre", wk.length >= 2 && wk[0].textContent.indexOf("Cette semaine") >= 0 && wk[1].textContent.indexOf("La semaine prochaine") >= 0);
const jrs = plan.querySelectorAll(".jr");
eq("jeudi 20 : deux séances dans la liste", jrs[3].querySelectorAll(".ev").length, 2);
t("repos écrit en toutes lettres", jrs[2].textContent.indexOf("Repos") >= 0);
clic(jrs[3].querySelectorAll(".ev")[1]);
t("dans la liste aussi, un aperçu sans quitter l'agenda", doc.querySelector("#feuille")._cls.has("on") && plan._cls.has("on"));
M.ctx.fermerFeuille();
clic(plan.querySelectorAll(".seg.petit button")[0]);
M.ctx.onglet("vJour");

/* La semaine passée avant la semaine en cours, et les rendez-vous futurs. */
const AGD = monter(Object.assign({}, D, { plan:[Object.assign({}, D.plan[0], { d:"2026-08-11" })].concat(D.plan),
  echeances:[{ d:"2026-09-17", l:"Test de contrôle · 40 min" }] }));
AGD.ctx.onglet("vPlan");
clic(AGD.doc.querySelectorAll("#vPlan .seg.petit button")[1]);
const ltxt = AGD.doc.querySelector("#vPlan").textContent;
t("la semaine dernière AVANT la semaine en cours", ltxt.indexOf("La semaine dernière") >= 0 && ltxt.indexOf("La semaine dernière") < ltxt.indexOf("Cette semaine"));
t("les semaines futures vont jusqu'au rendez-vous", ltxt.indexOf("Test de contrôle") > ltxt.indexOf("La semaine prochaine"));
t("une semaine sans plan le dit", /Plan pas encore écrit/.test(ltxt));
clic(AGD.doc.querySelectorAll("#vPlan .seg.petit button")[0]);
clic(AGD.doc.querySelectorAll("#vPlan .agnav button")[1]);
const c17 = AGD.doc.querySelectorAll("#vPlan .mc").find(c => !c._cls.has("hors") && c.querySelector(".mcd").textContent === "17");
t("le rendez-vous a sa pastille dans la grille", c17.querySelector(".pt.ech") !== null);
clic(c17);
clic(AGD.doc.querySelector("#vPlan .agjour .ev"));
t("aperçu d'un rendez-vous : compte à rebours", /Dans 26 jours/.test(AGD.doc.querySelector("#fc").textContent), AGD.doc.querySelector("#fc").textContent);

/* ---------- 5. Progrès ---------- */
M.ctx.onglet("vProg");
t("Progrès : records et estimations ont leur ligne", ["pred", "rec"].every(k => prog.querySelectorAll(".ligne.det").some(l => l.dataset.k === k)));
const dRec = doc.createElement("div"); M.ctx.rendreDetail("pred", dRec); M.ctx.rendreDetail("rec", dRec);
t("records et estimations, au toucher", dRec.textContent.indexOf("22:38") >= 0 && dRec.textContent.indexOf("20:58") >= 0);
t("les records sont datés", dRec.querySelectorAll(".tu").slice(-D.rec.length).every(r => /20\d\d/.test(r.textContent)));
t("le marathon n'est pas maquillé", dRec.textContent.indexOf("jamais couru") >= 0);
M.ctx.onglet("vJour");

/* ---------- 6. Détail d'une séance ---------- */
M.ctx.ouvrir(D.plan.find(s => s.d === "2026-08-22"));
const dh = doc.querySelector("#dh"), db = doc.querySelector("#db");
t("le bandeau porte la famille", dh.textContent.indexOf("Sortie longue") >= 0, dh.textContent);
t("le bandeau porte la date", dh.textContent.indexOf("Samedi 22 août") >= 0);
t("le profil est dessiné dans le bandeau", dh.querySelectorAll("rect").length >= 3);
t("le profil touche le haut (effort le plus fort)", dh.querySelectorAll("rect").some(r => r.getAttribute("y") === "0.0"));
eq("trois sections d'étapes", db.querySelectorAll(".bl").length, 3);
t("le pourquoi est là", db.textContent.indexOf("Pourquoi cette séance") >= 0);
t("le réalisé est là", db.textContent.indexOf("Ce que tu as fait") >= 0 && db.textContent.indexOf("Plafond tenu") >= 0);
t("le retour est proposé", !!db.querySelector(".ret"));
const rq = db.querySelectorAll(".ret .rq");
eq("trois choix pour la séance", rq[0].querySelectorAll(".chip").length, 3);
eq("sensation de 1 à 10", rq[2].querySelectorAll(".chip").length, 10);
t("le motif est caché au départ", rq[1].style.display === "none");
clic(rq[0].querySelectorAll(".chip")[1]);
t("« pas faite » fait apparaître le motif", rq[1].style.display === "");
t("le détail est ouvert", doc.querySelector("#det")._cls.has("on"));
M.ctx.fermer();
M.ctx.ouvrir(D.plan.find(s => s.d === "2026-08-18"));
t("le gainage annonce ses tours", db.textContent.indexOf("Répéter × 3") >= 0);
eq("six pas dans le tour", db.querySelectorAll(".pa").length, 6);
t("le circuit est celui du plan", /Pont fessier/.test(db.textContent) && !/Superman/.test(db.textContent));
M.ctx.fermer();
M.ctx.ouvrir(D.plan.find(s => s.d === "2026-08-23"));
eq("le repos n'affiche aucune étape", db.querySelectorAll(".bl").length, 0);
t("le repos ne propose pas de retour", !db.querySelector(".ret"));
M.ctx.fermer();
M.ctx.ouvrir(D.plan.find(s => s.d === "2026-08-27"));
t("une séance future ne propose pas de retour", !db.querySelector(".ret"));
M.ctx.fermer();

/* ---------- 7. Réglages et mise à jour ---------- */
clic(doc.querySelector("#bReg"));
t("L ouvre les réglages", doc.querySelector("#feuille")._cls.has("on") && doc.querySelector("#fc").textContent.indexOf("Réglages") >= 0);
t("un sommaire : Personnaliser, Préférences, Système", /Personnaliser.*Préférences.*Système/.test(doc.querySelector("#fc").textContent));
clic(doc.querySelector("#rApparence"));
t("Apparence s'ouvre dans la même feuille, avec un retour", doc.querySelector("#fc .fst").textContent === "Apparence" && !!doc.querySelector("#fRetour"));
eq("trois thèmes", doc.querySelectorAll("#fc .seg button").length, 3);
t("Auto, Clair, Sombre", doc.querySelector("#fc .seg").textContent === "AutoClairSombre");
clic(doc.querySelectorAll("#fc .seg button")[2]);
t("le choix est surligné", doc.querySelectorAll("#fc .seg button")[2]._cls.has("on"));
clic(doc.querySelector("#fRetour"));
t("retour au sommaire", !doc.querySelector("#fRetour") && !!doc.querySelector("#rApparence"));
M.ctx.fermerFeuille();
clic(doc.querySelector("#bMaj"));
t("l'heure ouvre la mise à jour", doc.querySelector("#fc").textContent.indexOf("Actualiser maintenant") >= 0 && doc.querySelector("#fc").textContent.indexOf("22 août à 18:35") >= 0);
M.ctx.fermerFeuille();

/* Withings en échec : le bouton de reconnexion est mis en avant */
const W = monter(Object.assign({}, D, { sourcesEtat:{ garmin:"success", withings:"failure" } }));
clic(W.doc.querySelector("#bReg"));
t("le sommaire signale la montre en échec", W.doc.querySelector("#rMontres")._cls.has("alerte"));
clic(W.doc.querySelector("#rMontres"));
t("les réglages montrent l'état des montres", W.doc.querySelector("#fc").textContent.indexOf("Withingsen échec") >= 0, W.doc.querySelector("#fc").textContent.slice(0, 200));
t("le bouton Reconnecter Withings apparaît quand Withings échoue", !!W.doc.querySelector("#bWithings"));
const WOK = monter(Object.assign({}, D, { sourcesEtat:{ garmin:"success", withings:"success" } }));
clic(WOK.doc.querySelector("#bReg")); clic(WOK.doc.querySelector("#rMontres"));
t("et disparaît quand Withings marche", WOK.doc.querySelector("#bWithings") === null);

/* Parler : premier appui = choix, puis ouverture directe */
clic(doc.querySelector("#tParler"));
t("Parler propose où ouvrir la conversation", doc.querySelector("#fc").textContent.indexOf("Le projet Coach dans l'app Claude") >= 0);
const lignesP = doc.querySelectorAll("#fc .ligne");
eq("trois façons", lignesP.length, 3);
clic(lignesP[0]);
t("le projet s'ouvre dans l'app Claude", M.ctx.location.href.indexOf("claude://project/") === 0, M.ctx.location.href);
M.ctx.location.href = "";

/* Le conseil « lance-la depuis ta montre » n'emprunte pas le style du bouton « ? » (bug du 6 octobre) */
const MTR = monter(Object.assign({}, D, { montre:[{ d:"2026-08-24", n:D.plan.find(s => s.d === "2026-08-24").t }] }), "2026-08-24T08:00:00");
MTR.ctx.ouvrir(MTR.ctx.D.plan.find(s => s.d === "2026-08-24"));
const ast = MTR.doc.querySelector("#db .astuce");
t("le conseil montre est un texte, pas un bouton rond", ast !== null && MTR.doc.querySelectorAll("#db .aide").length === 0);

/* ---------- 8. Interdits ---------- */
for (const v of ["vJour", "vPlan", "vProg"]) M.ctx.onglet(v);
const tout = M.html();
t("aucun mojibake", !/Ã|â€|Â[^\s]/.test(tout));
t("aucun texte de remplacement oublié", !/lorem|TODO|XXX/i.test(tout) && !/undefined|\bNaN\b/.test(tout), (tout.match(/.{30}(undefined|NaN).{10}/) || [""])[0]);
for (const hex of tout.match(/#[0-9A-Fa-f]{6}/g) || []) {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx - mn;
  if (!d || d / mx < 0.3) continue;
  let h = mx===r ? ((g-b)/d+6)%6 : mx===g ? (b-r)/d+2 : (r-g)/d+4; h *= 60;
  t("pas de violet (" + hex + ")", !(h >= 255 && h <= 320), hex + " teinte " + Math.round(h));
}
t("pas de libellés en capitales hurlantes dans les cartes", !/class="pill">[^<]*<\/i>[A-ZÉ ]{6,}</.test(tout));

/* ---------- 9. Cas dégradés ---------- */
const vide = monter({ today:"2026-08-23", plan:[], genere:"—", semaines:1 }, "2026-08-23T10:00:00");
t("un plan vide ne fait pas planter la page", !!vide.doc.querySelector("#vJour"));
t("un plan vide le dit clairement", /Rien de prévu|pas encore écrit/.test(vide.doc.querySelector("#vJour").textContent));
const souci = monter({ today:"2026-08-22", plan:[], genere:"—", souci:"Garmin n'a pas répondu : charge et sommeil manquants." });
t("une source en panne est signalée", souci.doc.querySelector("#vJour").querySelectorAll(".err").some(e => e.textContent.indexOf("Garmin") >= 0));

/* ---------- 10. Fraîcheur, avec l'heure du téléphone ---------- */
const vieux = monter(D, "2026-08-25T10:00:00");
const ban = vieux.doc.querySelector("#vJour").querySelectorAll(".err");
t("une page de 3 jours le dit", ban.length >= 1 && ban[0].textContent.indexOf("il y a 3 jours") >= 0, ban[0] && ban[0].textContent);
eq("et s'ouvre sur le vrai jour (le plan le couvre)", vieux.doc.querySelector("#vJour h1").textContent, "Aujourd'hui");
t("le lundi 25 n'est pas un jour inventé", vieux.doc.querySelector("#vJour .sousT").textContent.indexOf("Mardi 25 août") >= 0, vieux.doc.querySelector("#vJour .sousT").textContent);
const nuit = monter(D, "2026-08-23T07:00:00");
eq("le lendemain matin avant 9 h : pas d'alarme", nuit.doc.querySelector("#vJour").querySelectorAll(".err").length, 0);
t("le mot d'hier soir s'affiche, daté", nuit.doc.querySelector("#vJour .motd").textContent === "Le mot du coach, hier soir");
const midi = monter(D, "2026-08-23T11:00:00");
t("le lendemain midi : on le signale", midi.doc.querySelector("#vJour").querySelectorAll(".err").some(e => /depuis hier/.test(e.textContent)));

/* ---------- 11. Échéances, tendances ---------- */
const isoJ = dec => { const d = new Date(2026, 7, 22); d.setDate(d.getDate() + dec); const p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
const jours14 = Array.from({ length:14 }, (_, i) => ({ d:isoJ(i - 13), sg:400 + i * 5, sw:i === 13 ? 259 : null, vfc:50 + i, ch:i < 4 ? null : 0.6 + i / 20 }));
const plus = monter(Object.assign({}, D, {
  echeances:[{ d:isoJ(-34), l:"Compte rendu du échographie du dos", attente:true }, { d:isoJ(-5), l:"Tour de taille à relever", attente:true },
             { d:isoJ(-3), l:"Rendez-vous passé" }, { d:isoJ(12), l:"Test de contrôle" }],
  tendances:{ jours:jours14, vfc:[48, 84] } }));
const pj = plus.doc.querySelector("#vJour");
/* Les cartes détaillées de Progrès s'ouvrent au toucher : le banc les dessine à part. */
const pp = plus.doc.createElement("div");
for (const id of ["sommeil", "nuits", "vfc", "charge"]) plus.ctx.rendreDetail(id, pp);
t("les attentes tiennent en une ligne repliée", !!pj.querySelector(".aregler .arh") && pj.querySelectorAll(".att").length === 0 && /À régler/.test(pj.querySelector(".arh").textContent));
clic(pj.querySelector(".arh"));
const att = pj.querySelectorAll(".att");
eq("deux choses en attente", att.length, 2);
t("le échographie en tête, avec ses jours", att[0].textContent.indexOf("échographie") >= 0 && att[0].textContent.indexOf("34 jours") >= 0, att[0].textContent);
t("plus de 14 jours : rouge", att[0]._cls.has("ko") && !att[1]._cls.has("ko"));
t("la séance passe avant les attentes", pj.innerHTML.indexOf('class="carte') < pj.innerHTML.indexOf('class="aregler'));
t("les rendez-vous restent dans l'agenda, pas sur le Jour", pj.textContent.indexOf("Test de contrôle") < 0);
t("un rendez-vous passé n'est pas annoncé", pj.textContent.indexOf("Rendez-vous passé") < 0);
clic(plus.doc.querySelectorAll("#sem .sj")[0]);
t("les attentes ne s'affichent que sur aujourd'hui", plus.doc.querySelector("#vJour").querySelectorAll(".att").length === 0);
eq("trois cartes de mesures dans Progrès", pp.querySelectorAll(".stat").length, 3);
eq("dernière nuit Garmin en gros", pp.querySelectorAll(".stat")[0].querySelector(".stv").textContent.slice(0, 4), "7h45");
t("une phrase dit la tendance", /Moyenne des 7 dernières nuits/.test(pp.querySelectorAll(".stat")[0].querySelector(".stp").textContent));
t("écart Garmin / Withings signalé", pp.querySelector(".ecart") && pp.querySelector(".ecart").textContent.indexOf("Withings 4h19") >= 0);
eq("une barre par nuit", pp.querySelectorAll(".stat")[0].querySelectorAll("path").length, 14);
t("axe du sommeil chiffré en heures", pp.querySelectorAll(".stat")[0].querySelectorAll(".tk").some(x => x.textContent === "8 h"));
eq("jours sans charge non tracés", pp.querySelectorAll(".stat")[2].querySelectorAll("circle").length, 10);
t("la VFC est située par rapport à ta zone", /dans ta zone|sous ta zone|au-dessus/.test(pp.querySelectorAll(".stat")[1].querySelector(".stv").textContent));
const g0 = pp.querySelectorAll(".graphe")[0];
t("le graphique affiche la dernière nuit par défaut", /7h45/.test(g0.querySelector(".lire").textContent), g0.querySelector(".lire").textContent);
g0._choisir(0);
t("toucher un jour affiche sa valeur", /6h40/.test(g0.querySelector(".lire").textContent) && /Dimanche 9 août/.test(g0.querySelector(".lire").textContent), g0.querySelector(".lire").textContent);
clic(pp.querySelectorAll(".stat .aide")[2]);
t("le « ? » explique la mesure", plus.doc.querySelector("#feuille")._cls.has("on") && /0,8 et 1,3/.test(plus.doc.querySelector("#fc").textContent));
plus.ctx.fermerFeuille();
const HB = monter(Object.assign({}, D, { hebdo:[{ l:"2026-08-03", km:5, n:2, min:70, partiel:true }, { l:"2026-08-10", km:12, n:3, min:150 }, { l:"2026-08-17", km:40.9, n:4, min:290 }] }));
const dHB = HB.doc.createElement("div"); HB.ctx.rendreDetail("semaines", dHB);
const sHB = dHB.querySelectorAll(".stat");
t("tes semaines : les semaines incomplètes sont écartées", sHB.length === 1 && sHB[0].querySelectorAll("path").length === 2);
t("tes semaines : séances et kilomètres de la semaine", /4 séances/.test(sHB[0].textContent) && /40,9 km/.test(sHB[0].textContent), sHB[0].textContent);

/* ---------- 12. Retours : visibles tout de suite, sur tous les appareils ---------- */
const R = monter(Object.assign({}, D, { retours:[
  { type:"seance", d:"2026-08-18", t:D.plan.find(s => s.d === "2026-08-18").t, fait:"fait", sensation:6, douleur:"aucune", ecrit:"2026-08-18 21h10" },
  { type:"note", d:"2026-08-22", note:"Genou droit un peu raide", ecrit:"2026-08-22 08h05" } ] }));
const sjR = R.doc.querySelectorAll("#sem .sj");
t("un gainage déclaré fait se coche dans le bandeau", !sjR[1].querySelector(".pt")._cls.has("manque"));
clic(sjR[1]);
const cR = R.doc.querySelector("#vJour .carte");
t("et sur sa carte", cR.querySelector(".etat.ok") !== null);
t("avec la sensation", cR.querySelector(".sens").textContent.indexOf("sensation 6/10") >= 0);
clic(sjR[5]);
t("le message du jour s'affiche", R.doc.querySelector("#vJour").textContent.indexOf("Genou droit un peu raide") >= 0);
t("avec son statut", R.doc.querySelector("#vJour .msgs").textContent.indexOf("dans ton carnet") >= 0);
R.ctx.onglet("vPlan");
t("le plan compte la séance déclarée", R.doc.querySelector("#vPlan .wks").textContent.indexOf("5 sur 6") === 0, R.doc.querySelector("#vPlan .wks").textContent);

const HP = monter(Object.assign({}, D, { plan:D.plan.concat([{ d:"2026-08-22", t:"Football · 1 h", fam:"foot", sport:"foot", horsPlan:true, fait:true, auto:true,
  reel:[{ l:"DURÉE", v:"1:00:08" }], etapes:[] }]) }));
t("une activité hors plan est étiquetée", HP.doc.querySelector("#vJour").querySelectorAll(".pill").some(p => /hors plan/.test(p.textContent)));

(async () => {
  M.ctx.choisir("2026-08-22");
  clic(doc.querySelector("#bNote"));
  t("Écrire au coach ouvre une page avec zone de texte", doc.querySelector("#det")._cls.has("on") && !!doc.querySelector("#db textarea"));
  const go = doc.querySelector("#db .btn"), msg = doc.querySelector("#db .envoi");
  await go.onclick();
  t("un message vide n'est pas envoyé", msg.textContent.indexOf("Écris d'abord") >= 0, msg.textContent);
  doc.querySelector("#db textarea").value = "Douleur au genou droit";
  await go.onclick();
  t("hors réseau, le message est mis en attente", msg.textContent.indexOf("Pas de réseau") >= 0, msg.textContent);
  M.ctx.fermer();

  console.log("\n  " + ok + " tests verts, " + ko + " rouges");
  if (ko) { console.log("\n  ÉCHECS :"); echecs.forEach(e => console.log("  ✗ " + e)); process.exit(1); }
  console.log("  Écrans validés.\n");
})();
