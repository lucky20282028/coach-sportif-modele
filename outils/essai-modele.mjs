/* Installation d'essai du modèle, avec des sportifs fictifs : pour chaque jeu de sources
   (aucune, Strava + Apple Santé, Apple Santé seule), on remplit les réglages comme le ferait
   l'installateur, on fabrique quelques jours de données, puis on construit la page et on la
   parcourt entièrement (outils/instantane.mjs : toutes les vues, deux thèmes).
     node outils/essai-modele.mjs <dossier du modèle exporté>
   Échoue si la page plante, affiche « undefined » ou « NaN », ou parle d'une source que
   l'athlète n'a pas (Garmin, Withings). */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const modele = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(path.join(modele, "app", "app.js"))) { console.error("usage : node outils/essai-modele.mjs <modèle exporté>"); process.exit(2); }
const ici = path.dirname(fileURLToPath(import.meta.url));
const FIGE = "2026-10-14T16:30:00Z";           /* un mercredi */
const jour = k => { const d = new Date("2026-10-14T12:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };

const base = nom => ({
  version:1, prenom:nom, lieu:{ nom:"Lyon", lat:45.8, lon:4.8 },
  materiel:{ montre:"ta montre", nuit:null, nuit_seule:null, programmer_montre:false },
  cible:{ course:2, renfo:1 }, fc_moteur:[148, 138], allures:{ recup:420, facile:400, endur:385, tempo:300, vma:265, rapide:330 },
  plafond_chaleur:153,
  objectifs:{ regularite:{ rang:1, texte:"courir deux fois par semaine sans me blesser" }, ventre:{ rang:2, texte:"perdre un peu de ventre" }, reprise:null },
  renfo_pourquoi:"Le gainage protège ton genou : court, mais non négociable.",
  checkin:{ question:"Genou, dos", rien:"rien au genou ni au dos",
    zones:[{ v:"genou", l:"Genou", nom:"au genou" }, { v:"dos", l:"Dos", nom:"au dos" }, { v:"ailleurs", l:"Ailleurs", nom:"" }] }
});
const PROFILS = {
  "aucune-source":{ ath:Object.assign(base("Camille"), { sources:{ garmin:false, withings:false, apple_sante:false, strava:false } }), strava:false, sante:false },
  "strava-et-sante":{ ath:Object.assign(base("Nora"), { sources:{ garmin:false, withings:false, apple_sante:true, strava:"api" }, materiel:{ montre:"ta Coros", nuit:"ton Apple Watch", nuit_seule:"l'Apple Watch", programmer_montre:false } }), strava:true, sante:true },
  "apple-sante":{ ath:Object.assign(base("Tom"), { sources:{ garmin:false, withings:false, apple_sante:true, strava:false }, materiel:{ montre:"ton Apple Watch", nuit:null, nuit_seule:null, programmer_montre:false } }), strava:false, sante:true }
};

const plan = () => {
  const e = [
    { d:jour(-2), t:"Endurance fondamentale 40 min · 6 km", s:"FC 125–145", km:"6 km", type:"course", x:["Plat, au cœur"] },
    { d:jour(-1), t:"Gainage circuit · 3 tours", s:"12 min", type:"renfo", x:["Planche, gainage latéral, pont"] },
    { d:jour(0), t:"Repos", s:"", type:"repos", x:["Aucun sport"] },
    { d:jour(1), t:"Endurance fondamentale + 4 lignes droites 45 min · 6,7 km", s:"FC 125–145", km:"6,7 km", type:"course", x:["36 min faciles puis 4 lignes droites"] },
    { d:jour(3), t:"Sortie longue 1h05 · 9,4 km", s:"FC 125–148", km:"9,4 km", type:"course", x:["Régulier"] },
    { d:jour(8), t:"Endurance fondamentale 45 min · 6,7 km", s:"FC 125–145", km:"6,7 km", type:"course", prov:true, x:["Esquisse"] }
  ];
  return "PLAN_JSON_START\n" + JSON.stringify({ updated:jour(-3), meta:{ cycle:1, week_in_cycle:1, caps:[{ d:jour(25), l:"10 km de Lyon · course avec dossard", k:"course" }, { d:jour(-20), l:"Avis du kiné pour le genou", attente:true }] }, entries:e }) + "\nPLAN_JSON_END\n";
};
const serie = (min, fc0) => Array.from({ length:min * 4 }, (_, i) => [i * 15, Math.round(i * 15 * 2.6), fc0 + Math.min(Math.floor(i / 8), 14)]);
const fiche = (id, d, min) => {
  const s = serie(min, 128), dist = s[s.length - 1][1];
  const km = []; for (let k = 1; k * 1000 <= dist; k++) km.push({ n:k, m:1000, s:385, fc:135 + Math.min(k, 8), fcmax:150, dp:4 });
  return { id, date:d, debut:d + " 18:30:00", type:"running", nom:"Footing", distance_m:dist, duree_s:min * 60, fc_moy:139, fc_max:150, deniv_pos:20, km, hist:{ "130":600, "135":900, "140":900 }, serie:s, lieu:[45.8, 4.8] };
};

const echecs = [];
for (const [nom, P] of Object.entries(PROFILS)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "essai-" + nom + "-"));
  fs.cpSync(modele, dir, { recursive:true, filter:s => !/(^|\/)(\.git|node_modules|site)$/.test(s) });
  const w = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive:true }); fs.writeFileSync(path.join(dir, f), t); };
  w("reglages/athlete.json", JSON.stringify(P.ath, null, 1));
  w("reglages/installation.json", JSON.stringify({ projet:"coach-essai", horloge:"coach-horloge", empreinte_cle:null }, null, 1));
  w("app/entrees/plan.txt", plan());
  w("app/entrees/jour.json", JSON.stringify({ date:jour(0), mot:"Nuit correcte, jambes fraîches. <b>Mercredi 14 : repos, couche-toi avant 23 h.</b>", faits:[] }));
  w("donnees/retours.jsonl", [
    { type:"checkin", d:jour(0), forme:4, jambes:"fraîches", alerte:"rien", ecrit:jour(0) + " 07h40", recu:jour(0) + "T05:40:00Z" },
    { type:"seance", d:jour(-1), t:"Gainage circuit · 3 tours", fait:"fait", sensation:7, douleur:"aucune", ecrit:jour(-1) + " 19h10", recu:jour(-1) + "T17:10:00Z" }
  ].map(x => JSON.stringify(x)).join("\n") + "\n");
  w("etat/derniere-collecte.json", JSON.stringify({ collecte:jour(0) + " 20:15", garmin:"skipped", withings:"skipped", strava:P.strava ? "success" : "skipped", sante:P.sante ? "success" : "skipped", retours:"success" }));
  if (P.strava) {
    const acts = {};
    for (const [k, min] of [[-9, 35], [-6, 42], [-2, 40]]) { const id = "s" + (900 + k); acts[id] = { id, name:"Footing", type:"running", start_time:jour(k) + " 18:30:00", distance_meters:min * 156, duration_seconds:min * 60, avg_hr_bpm:139, source:"strava" };
      w("donnees/strava/sorties/" + id + ".json", JSON.stringify(fiche(id, jour(k), min))); }
    acts.s950 = { id:"s950", name:"Gainage", type:"strength_training", start_time:jour(-1) + " 07:00:00", distance_meters:0, duration_seconds:780, source:"strava" };
    w("donnees/strava/activites.json", JSON.stringify(acts));
  }
  if (P.sante) {
    const l = [];
    for (let k = -13; k <= 0; k++) l.push({ collecte:jour(k) + "T07:10:00Z", date:jour(k), sommeil_min:380 + (k % 3) * 25, coucher:jour(k - 1) + "T21:10:00.000Z", lever:jour(k) + "T04:50:00.000Z", fc_repos:54 - (k % 2), vfc_ms:42 + (k % 4), seances:[] });
    w("donnees/sante/2026-10.jsonl", l.map(x => JSON.stringify(x)).join("\n") + "\n");
  }
  const sortie = path.join(os.tmpdir(), "essai-" + nom + ".json");
  try { execFileSync("node", [path.join(ici, "instantane.mjs"), dir, sortie, FIGE], { stdio:"pipe", timeout:300000 }); }
  catch (e) { echecs.push(nom + " : le parcours n'a pas pu tourner : " + String(e.stderr || e.message).slice(0, 300)); continue; }
  const r = JSON.parse(fs.readFileSync(sortie, "utf8"));
  for (const x of r.erreurs) echecs.push(nom + " : " + x);
  const parle = (re, src) => Object.entries(r.etapes).filter(([, v]) => re.test(v.texte)).map(([k, v]) => k + " (« " + v.texte.match(new RegExp(".{0,40}" + re.source + ".{0,20}"))[0].replace(/\n/g, " ") + " »)");
  for (const [re, src] of [[/Garmin/, "garmin"], [/Withings/, "withings"]]) if (!P.ath.sources[src]) for (const x of parle(re)) echecs.push(nom + " : parle de " + src + " sans l'avoir : " + x);
  const nb = Object.keys(r.etapes).length;
  const t = Object.values(r.etapes).map(v => v.texte).join("\n");
  const attendu = ["10 km de Lyon", "Avis du kiné pour le genou"];
  for (const a of attendu) if (t.indexOf(a) < 0) echecs.push(nom + " : « " + a + " » n'apparaît nulle part");
  console.log(nom + " : " + nb + " vues parcourues, " + r.erreurs.length + " erreur(s)");
  fs.rmSync(dir, { recursive:true, force:true });
}
if (echecs.length) { console.log("\nÉCHECS :\n  " + echecs.join("\n  ")); process.exit(1); }
console.log("Installation d'essai : les trois sportifs fictifs ont une page complète et juste.");
