/* JEU D'ESSAI FIGÉ — ne change jamais.
   Le banc d'essai tourne là-dessus, jamais sur les données du jour : sinon
   les tests virent au rouge chaque matin sans qu'une ligne de code ait bougé.
   Ce jeu est construit pour couvrir les cas tordus : deux séances le même
   jour, une faite et une sautée, du repos, un plan qui déborde sur la
   semaine suivante. */
const C = require("./core.js");
const le = (s, d) => (s.d = d, s);
const fait = (s, reel) => {
  s.fait = true; s.reel = reel;
  const d = reel.find(r => /DISTANCE/i.test(r.l));
  if (d) s.kmFait = d.v.replace(" km", "");
  return s;
};

module.exports = {
  today: "2026-08-22",
  genere: "22 août à 18:35",
  semaines: 2,
  etiq: { 1:"ALLÉGÉE" },
  meteo: "26°",
  plan: [
    le(fait(C.LIB.facile(50), [{l:"DISTANCE",v:"8,7 km"},{l:"DURÉE",v:"51:21"},{l:"FC MOY.",v:"148"}]), "2026-08-17"),
    le(C.LIB.gainage(3), "2026-08-18"),
    le(C.LIB.repos("Sortie décalée : il pleuvait."), "2026-08-19"),
    le(fait(C.LIB.facile(55), [{l:"DISTANCE",v:"10,6 km"},{l:"DURÉE",v:"1:00:04"},{l:"FC MOY.",v:"153"}]), "2026-08-20"),
    le(C.LIB.gainage(3), "2026-08-20"),
    le(fait(C.LIB.facile(40), [{l:"DISTANCE",v:"6,4 km"},{l:"DURÉE",v:"41:31"},{l:"FC MOY.",v:"144"}]), "2026-08-21"),
    le(Object.assign(fait(C.LIB.endurance(15, 150), [{l:"DISTANCE",v:"15,2 km"},{l:"DURÉE",v:"1:31:16"},{l:"FC MOY.",v:"150"}]),
      { x:["Plafond tenu au battement près, sur 1 h 31.", "+43 % sur ton record du mois."] }), "2026-08-22"),
    le(C.LIB.repos("Dimanche : aucun sport, pas même du gainage."), "2026-08-23"),
    le(C.LIB.facile(35), "2026-08-24"),
    le(C.LIB.gainage(3), "2026-08-24"),
    le(C.LIB.facile(50), "2026-08-27"),
    le(C.LIB.endurance(11, 150), "2026-08-29"),
    le(C.LIB.repos(), "2026-08-30")
  ],
  mot: "Plafond tenu au battement près sur 1 h 31, et 5:59 au kilomètre là où le plan en annonçait 6:30. " +
       "<b>Mais ton sommeil est tombé à 5h31 de moyenne, contre 6h35 la semaine d'avant.</b> Demain tu ne fais rien.",
  n3: [
    { l:"CHARGE",  v:"1,2",  d:"optimal",     c:"#84CC16" },
    { l:"AÉROBIE", v:"33 %", d:"↑ 0 % lundi", c:"#84CC16" },
    { l:"SOMMEIL", v:"5h31", d:"↓ 6h35",      c:"#F87171" }
  ],
  serie: [
    { l:"COURSES CETTE SEMAINE", v:"3 sur 3", d:"41 km au total",        c:"#84CC16" },
    { l:"RENFORCEMENT",          v:"0 sur 2", d:"lundi et jeudi sautés", c:"#F87171" }
  ],
  pred: [
    { l:"5 KM",     v:"20:58",   g:"−1:40 sur ton record"  },
    { l:"10 KM",    v:"44:38",   g:"−4:41 sur ton record"  },
    { l:"SEMI",     v:"1:41:14", g:"−15:07 sur ton record" },
    { l:"MARATHON", v:"3:46:17", g:"jamais couru"          }
  ],
  rec: [
    { l:"1 KM",  v:"4:02",    d:"18 juillet 2026" },
    { l:"5 KM",  v:"22:38",   d:"18 juillet 2026" },
    { l:"10 KM", v:"49:19",   d:"18 juillet 2026" },
    { l:"SEMI",  v:"1:56:21", d:"7 mars 2026"     }
  ],
  sources: "Plan et débrief : Drive · séances : Strava · charge et sommeil : Garmin et Withings"
};
