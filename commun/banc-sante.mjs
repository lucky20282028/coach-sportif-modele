/* Banc d'Apple Santé : lecture du format du raccourci et de Health Auto Export.
     node commun/banc-sante.mjs */
import { lireEnvoi, fusionner } from "./sante.mjs";
let ok = 0, ko = 0; const echecs = [];
const t = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? "  → " + JSON.stringify(d).slice(0, 240) : "")); } };

/* 1. Raccourci : un jour, nombres en texte, virgule française */
let r = lireEnvoi({ date:"2026-10-11", sommeil_min:"432", coucher:"2026-10-10T23:05:00+02:00", lever:"2026-10-11T06:47:00+02:00", fc_repos:"52", vfc_ms:"48,5",
  seances:[{ type:"Course à pied", debut:"2026-10-10T18:30:00+02:00", duree_s:"1800", distance_m:"5000", fc_moy:"145" }, { type:"Marche", debut:"x", duree_s:10 }] });
t("raccourci : lu", r.ok && r.jours.length === 1, r);
const j = r.jours[0];
t("sommeil en minutes", j.sommeil_min === 432);
t("coucher et lever en ISO", j.coucher === "2026-10-10T21:05:00.000Z" && j.lever === "2026-10-11T04:47:00.000Z", j);
t("FC de repos et VFC", j.fc_repos === 52 && j.vfc_ms === 48.5);
t("séance au format Garmin, heure de Paris", j.seances.length === 1 && j.seances[0].type === "running" && j.seances[0].start_time === "2026-10-10 18:30:00" &&
  j.seances[0].duration_seconds === 1800 && j.seances[0].distance_meters === 5000 && j.seances[0].avg_hr_bpm === 145, j.seances);
t("séance à date illisible ignorée", j.seances.length === 1);
t("sommeil en heures accepté", lireEnvoi({ date:"2026-10-11", sommeil_h:"7,5" }).jours[0].sommeil_min === 450);

/* 2. Valeurs absurdes ignorées, envoi vide refusé */
r = lireEnvoi({ date:"2026-10-11", sommeil_min:5000, fc_repos:3, vfc_ms:"abc" });
t("valeurs hors bornes : rien d'exploitable, refusé", !r.ok, r);
t("sans date : refusé", !lireEnvoi({ sommeil_min:400 }).ok);
t("date mal formée : refusé", !lireEnvoi({ date:"11/10/2026", sommeil_min:400 }).ok);
t("tableau à la racine : refusé", !lireEnvoi([1, 2]).ok);
t("plusieurs jours d'un coup", lireEnvoi({ jours:[{ date:"2026-10-10", sommeil_min:400 }, { date:"2026-10-11", fc_repos:50 }] }).jours.length === 2);

/* 3. Health Auto Export */
r = lireEnvoi({ data:{ metrics:[
  { name:"sleep_analysis", units:"hr", data:[{ date:"2026-10-11 00:00:00 +0200", totalSleep:7.2, sleepStart:"2026-10-10 23:10:00 +0200", sleepEnd:"2026-10-11 06:40:00 +0200" }] },
  { name:"resting_heart_rate", units:"count/min", data:[{ date:"2026-10-11 00:00:00 +0200", qty:51 }] },
  { name:"heart_rate_variability", units:"ms", data:[{ date:"2026-10-11 00:00:00 +0200", qty:61.3 }] } ],
  workouts:[{ name:"Outdoor Run", start:"2026-10-11 18:00:00 +0200", end:"2026-10-11 18:42:00 +0200", duration:2520, distance:{ qty:7.1, units:"km" }, avgHeartRate:{ qty:148 } },
            { name:"Outdoor Cycling", start:"2026-10-10 10:00:00 +0200", duration:3600, distance:{ qty:20, units:"mi" } }] } });
t("Health Auto Export : lu", r.ok, r);
const h = r.jours.find(x => x.date === "2026-10-11");
t("HAE : nuit rattachée au matin du lever, 7,2 h = 432 min", h && h.sommeil_min === 432 && h.lever === "2026-10-11T04:40:00.000Z", h);
t("HAE : FC de repos, VFC", h.fc_repos === 51 && h.vfc_ms === 61.3);
t("HAE : course de 7,1 km, 148 de moyenne", h.seances[0].type === "running" && Math.round(h.seances[0].distance_meters) === 7100 && h.seances[0].avg_hr_bpm === 148, h.seances);
const v = r.jours.find(x => x.date === "2026-10-10");
t("HAE : vélo en miles converti", v && v.seances[0].type === "cycling" && Math.round(v.seances[0].distance_meters) === 32187, v);

/* 4. Fusion de plusieurs envois */
const f = fusionner([{ date:"2026-10-11", sommeil_min:400, fc_repos:null, seances:[{ id:"a1" }] }, { date:"2026-10-11", sommeil_min:420, fc_repos:50, seances:[{ id:"a1" }, { id:"a2" }] }, { date:"2026-10-09", vfc_ms:40, seances:[] }]);
t("fusion : le plus récent gagne, séances sans doublon, jours triés", f.length === 2 && f[0].date === "2026-10-09" && f[1].sommeil_min === 420 && f[1].fc_repos === 50 && f[1].seances.length === 2, f);

console.log("\n  " + ok + " réussis, " + ko + " échoués");
if (ko) { for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
console.log("  Apple Santé validé.");
