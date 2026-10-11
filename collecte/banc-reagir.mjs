/* Banc du réveil du coach : quand réveiller, quand attendre.  node collecte/banc-reagir.mjs */
import { nouveautes, decider, texteRoutine, horoParis, prochaineTache } from "./reagir.mjs";

let ok = 0, ko = 0; const echecs = [];
const t = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? " → " + d : "")); } };

/* Le mot écrit à 7h27 (5h27 UTC), avant la nuit mesurée et avant le message de 16h16. */
const memoire = { motVu:"2026-10-06T05:27:00Z",
  motBase:{ d:"2026-10-06", nuit:null, acts:[], checkin:null },
  empreinte:{ d:"2026-10-06", nuit:307, acts:[], checkin:"2026-10-06 16h22" } };
const carnet = [
  "## Octobre 2026",
  "2026-10-06 01h34 — *(écrit depuis la page)* Non je fais du foot le mardi donc ce sera soir 1h de foot",
  "2026-10-06 16h16 — *(écrit depuis la page)* J'ai une course de 15km à laquelle je me suis inscrit le 18 octobre",
  "2026-10-06 16h22 — *(check-in du matin)* Forme 3/5, jambes fraîches, rien au genou ni au dos."
].join("\n");

t("heure de Paris d'un instant", horoParis("2026-10-06T05:27:00Z") === "2026-10-06 07h27");
const N = nouveautes({ memoire, carnet });
t("le message de 16h16 compte", N.some(x => /16h16/.test(x.texte) && /15km/.test(x.texte)), JSON.stringify(N));
t("celui de 1h34, lu par le point du matin, non", !N.some(x => /01h34/.test(x.texte)));
t("un check-in sans alerte ne réveille personne", !N.some(x => /check-in/.test(x.texte)));
t("la nuit mesurée après le mot compte", N.some(x => /nuit, mesurée après le mot \(5h07\)/.test(x.texte)));
t("douleur au check-in : compte", nouveautes({ memoire, carnet:carnet + "\n2026-10-06 17h02 — *(check-in du matin)* Forme 2/5, ⚠️ douleur au dos ou aux lombaires." }).some(x => /check-in de 17h02/.test(x.texte)));
t("nouvelle activité de la montre", nouveautes({ memoire:Object.assign({}, memoire, { empreinte:Object.assign({}, memoire.empreinte, { acts:["123"] }) }), carnet:"" })
  .some(x => /nouvelle activité/.test(x.texte)));
t("sans heure de mot, aucune ligne du carnet n'est comptée", nouveautes({ memoire:{}, carnet }).length === 0);

const D = (h, m, x) => decider(Object.assign({ instant:new Date(Date.UTC(2026, 9, 6, h - 2, m)), raison:"note", memoire, carnet, etat:{}, jeton:true }, x || {}));
t("19h05, message écrit : on réveille", D(19, 5).lancer === true, JSON.stringify(D(19, 5)));
t("collecte planifiée ou lancée par une tâche : jamais", D(19, 5, { raison:"" }).lancer === false && /sans demande/.test(D(19, 5, { raison:"" }).attendre));
t("Actualiser compte aussi", D(16, 30, { raison:"actualiser" }).lancer === true);
t("20h10 : le débrief arrive, on attend", D(20, 10).lancer === false && /débrief/.test(D(20, 10).attendre));
{
  /* Le point du matin a écrit à 7h30 ; message à 7h34 : on n'attend plus rien. */
  const m2 = Object.assign({}, memoire, { motVu:"2026-10-07T05:30:19Z", motBase:{ d:"2026-10-07", nuit:423, acts:[] }, empreinte:{ d:"2026-10-07", nuit:423, acts:[] } });
  const c2 = carnet + "\n2026-10-07 07h34 — *(écrit depuis la page)* Il me faut un programme pour mes 15km de rouen";
  const r2 = decider({ instant:new Date(Date.UTC(2026, 9, 7, 5, 36)), raison:"note", memoire:m2, carnet:c2, etat:{}, jeton:true });
  t("7h36, point du matin déjà écrit : le message réveille le coach", r2.lancer === true, JSON.stringify(r2));
}
t("7h00 : le point du matin arrive", D(7, 0).lancer === false && /point du matin/.test(D(7, 0).attendre));
t("1h30 du matin : on attend le point du matin", D(1, 30).lancer === false && /point du matin/.test(D(1, 30).attendre));
t("dimanche 17h50 : le bilan arrive", decider({ instant:new Date(Date.UTC(2026, 9, 11, 15, 50)), raison:"note", memoire, carnet, etat:{}, jeton:true }).attendre === "le bilan du dimanche (17h54)");
{
  const calme = Object.assign({}, memoire, { motVu:"2026-10-06T16:30:00Z", motBase:memoire.empreinte });
  const ra = decider({ instant:new Date(Date.UTC(2026, 9, 6, 17, 0)), raison:"actualiser", memoire:calme, carnet, etat:{}, jeton:true });
  t("Actualiser sans nouveauté : on réveille quand même (c'est l'athlète qui demande)", ra.lancer === true && /Actualiser/.test(ra.raisons[0]), JSON.stringify(ra));
  const rn = decider({ instant:new Date(Date.UTC(2026, 9, 6, 17, 0)), raison:"note", memoire:calme, carnet, etat:{}, jeton:true });
  t("une note déjà lue, sans rien de neuf : rien à faire", rn.attendre === "rien de nouveau depuis le mot du coach");
  const rr = decider({ instant:new Date(Date.UTC(2026, 9, 6, 17, 10)), raison:"actualiser", memoire:calme, carnet, etat:{ lance:"2026-10-06T17:00:00Z", cles:[ra.cles[0]] }, jeton:true });
  t("deuxième Actualiser 10 min après : la réaction est en cours", rr.lancer === false && /en cours/.test(rr.attendre));
}
const enCours = { lance:"2026-10-06T17:00:00Z", cles:["note:2026-10-06 16h16", "nuit:2026-10-06"], historique:["2026-10-06T17:00:00Z"] };
t("réaction lancée il y a 10 min : on la laisse finir", D(19, 10, { etat:enCours }).lancer === false && /en cours/.test(D(19, 10, { etat:enCours }).attendre));
t("40 min après, sans nouveau mot ni nouveauté : pas de second réveil", D(19, 40, { etat:enCours }).lancer === false);
t("40 min après, un nouveau message : on réveille", D(19, 40, { etat:enCours, carnet:carnet + "\n2026-10-06 19h35 — *(écrit depuis la page)* Finalement pas de foot" }).lancer === true);
t("au plus 8 réveils par jour", D(19, 5, { etat:{ historique:Array(8).fill("2026-10-06T10:00:00Z") } }).lancer === false);
const sans = D(19, 5, { jeton:false });
t("sans jeton : pas de réveil, mais la page sait pourquoi", sans.lancer === false && /pas encore activé/.test(sans.attendre) && sans.raisons.length === 2);
t("prochaine tâche : le débrief l'après-midi", prochaineTache(new Date(Date.UTC(2026, 9, 6, 15, 0))) === "au débrief de 20h23");
t("le soir : le point du matin", prochaineTache(new Date(Date.UTC(2026, 9, 6, 20, 0))) === "au point du matin, à 7h27");
t("dimanche après-midi : le bilan", prochaineTache(new Date(Date.UTC(2026, 9, 11, 12, 0))) === "au bilan du dimanche, à 17h54");
{ /* 11 octobre : bilan lancé à la main à 16h51, mot de 17h10, message de 17h48 : la tâche de
     17h54 ne refera rien, il ne faut pas l'attendre. */
  const m11 = { motVu:"2026-10-11T15:10:54Z" };
  const c11 = "2026-10-11 16h51 — *(bilan du coach)* Semaine 5-11/10…\n2026-10-11 17h48 — *(écrit depuis la page)* Fais-moi une séance de 25 min";
  const r11 = decider({ instant:new Date(Date.UTC(2026, 9, 11, 15, 48)), raison:"note", memoire:m11, carnet:c11, etat:{}, jeton:true });
  t("bilan déjà fait à la main : un message de 17h48 réveille le coach", r11.lancer === true);
  t("bilan déjà fait : la prochaine tâche est le débrief", prochaineTache(new Date(Date.UTC(2026, 9, 11, 12, 0)), c11) === "au débrief de 20h23");
}
const txt = texteRoutine(D(19, 5).raisons, "note");
t("le texte envoyé dit ce qui a changé et renvoie à la consigne", /16h16/.test(txt) && /taches\/reagir\.md/.test(txt) && !/PAGE_KEY|sk-ant/.test(txt));

console.log("\n  " + ok + " réussis, " + ko + " échoués");
if (ko) { for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("  Réveil du coach validé.");
