/* Banc des retours : validation, jeton, lignes du carnet. Sans réseau. */
import { valider, jetonDe, sha256hex, ligneCarnet, ajouterAuCarnet, horoParis, signatureRetour } from "./retour.mjs";

let ok = 0, ko = 0; const echecs = [];
const t = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? "  → " + String(d).slice(0, 200) : "")); } };
const eq = (n, a, b) => t(n, a === b, "attendu " + JSON.stringify(b) + ", obtenu " + JSON.stringify(a));

/* Le jeton calculé ici (Node) doit être celui que calcule la page (WebCrypto + btoa). */
const cle = "AbC-dEf_0123456789abcdefghijklmnopqrstuvwxyzABC";
const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("retour:" + cle)));
const page = btoa(String.fromCharCode.apply(null, h)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
eq("jeton identique côté page et côté serveur", await jetonDe(cle), page);
const emp = await sha256hex(page);
t("l'empreinte n'est pas le jeton", emp !== page && emp.length === 64);
eq("empreinte SHA-256 correcte", await sha256hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

const S = { type:"seance", d:"2026-10-05", t:"Gainage circuit · 2 tours", fait:"fait", raison:null, sensation:7, douleur:"aucune", note:"RAS", ecrit:"2026-10-05 19h42" };
t("un retour normal passe", valider(S).ok);
{
  const n1 = { recu:"2026-10-06T14:16:51Z", type:"note", d:"2026-10-06", note:"J'ai une course", ecrit:"2026-10-06 16h16" };
  const n2 = Object.assign({}, n1, { recu:"2026-10-06T15:09:16Z" });
  t("une note renvoyée par la page a la même empreinte", signatureRetour(n1) === signatureRetour(n2));
  t("une autre note, non", signatureRetour(n1) !== signatureRetour(Object.assign({}, n1, { note:"Autre chose" })));
}
t("un type inconnu est refusé", !valider(Object.assign({}, S, { type:"admin" })).ok);
t("une date bidon est refusée", !valider(Object.assign({}, S, { d:"../../etc" })).ok);
t("un retour vide est refusé", !valider({ type:"seance", d:"2026-10-05" }).ok);
t("une note vide est refusée", !valider({ type:"note", d:"2026-10-05", note:"   " }).ok);
eq("sensation hors bornes ignorée", valider(Object.assign({}, S, { sensation:42 })).r.sensation, null);
eq("douleur inventée ignorée", valider(Object.assign({}, S, { douleur:"atroce" })).r.douleur, null);
t("champ inconnu jeté", !("admin" in valider(Object.assign({}, S, { admin:true })).r));
eq("note tronquée à 2000", valider({ type:"note", d:"2026-10-05", note:"x".repeat(5000) }).r.note.length, 2000);
eq("horodatage mal formé ignoré", valider(Object.assign({}, S, { ecrit:"hier soir" })).r.ecrit, null);

eq("ligne d'une séance faite", ligneCarnet(valider(S).r, "2026-10-05T17:42:00Z"),
  "2026-10-05 19h42 — *(retour page, séance du 05/10 · Gainage circuit · 2 tours)* Faite, sensation 7/10, douleur : aucune. RAS");
const P = valider({ type:"seance", d:"2026-10-06", t:"Aérobie faible 30 min", fait:"pas fait", raison:"fatigue", ecrit:"2026-10-06 21h05" }).r;
eq("ligne d'une séance sautée", ligneCarnet(P, ""), "2026-10-06 21h05 — *(retour page, séance du 06/10 · Aérobie faible 30 min)* Pas faite (fatigue).");
const F = valider({ type:"seance", d:"2026-10-06", t:"Course", douleur:"forte", note:"genou droit\nen descente" }).r;
t("douleur forte signalée", /⚠️ douleur : forte\. genou droit \/ en descente$/.test(ligneCarnet(F, "2026-10-06T08:00:00Z")), ligneCarnet(F, "2026-10-06T08:00:00Z"));
eq("sans horodatage : heure de réception à Paris", ligneCarnet(F, "2026-10-06T08:00:00Z").slice(0, 16), "2026-10-06 10h00");
eq("hiver : UTC+1", horoParis("2026-12-01T08:00:00Z"), "2026-12-01 09h00");
eq("une note", ligneCarnet(valider({ type:"note", d:"2026-10-05", note:"Nuit blanche", ecrit:"2026-10-05 07h10" }).r, ""),
  "2026-10-05 07h10 — *(écrit depuis la page)* Nuit blanche");

/* Check-in du matin et mesures (7 octobre) */
/* Les zones viennent des réglages de l'athlète (ici, celles d'un athlète d'essai). */
const ZK = { rien:"rien au genou ni au dos", zones:[ { v:"genou", l:"Genou", nom:"au genou" }, { v:"dos", l:"Dos", nom:"au bas du dos" }, { v:"ailleurs", l:"Ailleurs", nom:"" } ] };
const CK = valider({ type:"checkin", d:"2026-10-07", forme:3, jambes:"lourdes", alerte:"raideur", zone:"genou", ecrit:"2026-10-07 06h52" });
t("un check-in passe", CK.ok);
eq("ligne du check-in", ligneCarnet(CK.r, "", ZK), "2026-10-07 06h52 — *(check-in du matin)* Forme 3/5, jambes lourdes, raideur au genou.");
const CK2 = valider({ type:"checkin", d:"2026-10-07", forme:4, jambes:"fraîches", alerte:"rien", zone:"genou", ecrit:"2026-10-07 06h52" });
eq("pas de zone quand rien n'est signalé", CK2.r.zone, null);
eq("check-in tranquille", ligneCarnet(CK2.r, "", ZK), "2026-10-07 06h52 — *(check-in du matin)* Forme 4/5, jambes fraîches, rien au genou ni au dos.");
const CK3 = valider({ type:"checkin", d:"2026-10-07", forme:2, alerte:"douleur", zone:"dos", ecrit:"2026-10-07 06h52" });
t("une douleur est signalée", /⚠️ douleur au bas du dos\.$/.test(ligneCarnet(CK3.r, "", ZK)), ligneCarnet(CK3.r, "", ZK));
t("une zone mal formée est jetée", valider({ type:"checkin", d:"2026-10-07", alerte:"douleur", zone:"<script>" }).r.zone === null);
t("sans réglages, la ligne reste lisible", /douleur \(dos\)\.$/.test(ligneCarnet(CK3.r, "")), ligneCarnet(CK3.r, ""));
t("forme hors bornes refusée", valider({ type:"checkin", d:"2026-10-07", forme:9 }).ok === false);
t("check-in vide refusé", !valider({ type:"checkin", d:"2026-10-07" }).ok);
const MS = valider({ type:"mesure", d:"2026-10-07", tour_taille:84.46, ecrit:"2026-10-07 07h10" });
eq("tour de taille arrondi au millimètre", MS.r.tour_taille, 84.5);
eq("ligne de mesure", ligneCarnet(MS.r, ""), "2026-10-07 07h10 — *(mesure)* Tour de taille : 84,5 cm.");
t("mesure absurde refusée", !valider({ type:"mesure", d:"2026-10-07", tour_taille:8 }).ok && !valider({ type:"mesure", d:"2026-10-07", tour_taille:"84" }).ok);

const C0 = "# Carnet\n\n## Octobre 2026\n\n2026-10-05 10h00 — avant\n";
const C1 = ajouterAuCarnet(C0, [{ ligne:"2026-10-05 19h42 — après" }]);
eq("ajout sous le mois en cours", C1, "# Carnet\n\n## Octobre 2026\n\n2026-10-05 10h00 — avant\n2026-10-05 19h42 — après\n");
const C2 = ajouterAuCarnet("# Carnet\n\n## Octobre 2026\n\n", [{ ligne:"2026-10-05 19h42 — premier" }]);
eq("mois vide : la ligne suit l'en-tête", C2, "# Carnet\n\n## Octobre 2026\n\n2026-10-05 19h42 — premier\n");
const C3 = ajouterAuCarnet(C1, [{ ligne:"2026-11-01 08h00 — novembre" }]);
t("nouveau mois : nouvel en-tête", /## Novembre 2026\n\n2026-11-01 08h00 — novembre\n$/.test(C3), C3);

console.log("\n  " + ok + " réussis, " + ko + " échoués");
if (ko) { for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("  Retours validés.");
