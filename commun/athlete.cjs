/* Réglages de l'athlète (reglages/athlete.json) : tout ce qui est propre à une personne
   et que le code utilise (cibles de la semaine, fréquences cardiaques de référence,
   objectifs, zones du check-in, noms de ses appareils). Le reste de sa vie de sportif
   est dans profil.md, que lit le coach. Un réglage absent prend la valeur par défaut :
   une installation neuve marche sans rien régler.
   Utilisé côté serveur seulement (génération, collecte) : la page reçoit ce qu'il lui
   faut dans ses données chiffrées (D.reglages), jamais dans son code. */
const fs = require("fs");
const path = require("path");

const DEFAUT = {
  version:1,
  prenom:"",
  lieu:null,                                     /* { nom, lat, lon } si aucune sortie GPS ne le donne */
  /* D'où viennent les données. garmin : montre Garmin (sommeil, VFC, charge, séances,
     programmation de la montre). withings : sommeil Withings. strava : false, « connecteur »
     (le coach lit Strava dans Claude) ou « api » (la collecte lit Strava : toute montre qui
     y synchronise ses séances). apple_sante : sommeil, FC de repos, VFC et séances
     envoyés chaque jour par un raccourci de l'iPhone. Aucune source : la page vit avec
     le check-in et les séances déclarées. */
  sources:{ garmin:false, withings:false, apple_sante:false, strava:"connecteur" },
  materiel:{ montre:"ta montre", nuit:null, nuit_seule:null, programmer_montre:false },
  cible:{ course:2, renfo:1 },
  fc_moteur:[150, 140],
  /* allures de référence en s/km (facile, sortie longue, récup, seuil, VMA ; « rapide » =
     au-dessous, une sortie compte comme rapide). null = valeurs du code. */
  allures:null,
  plafond_chaleur:155,
  objectifs:{
    regularite:{ rang:1, texte:"progresser en course à pied en étant régulier" },
    ventre:null,
    reprise:null
  },
  renfo_pourquoi:"Le renforcement protège tes articulations et ta posture. Court, mais non négociable.",
  checkin:{ question:"Une douleur ou une raideur ?", rien:"rien à signaler",
    zones:[ { v:"jambes", l:"Jambes, genoux", nom:"aux jambes ou aux genoux" },
            { v:"dos", l:"Dos", nom:"au dos" },
            { v:"ailleurs", l:"Ailleurs", nom:"" } ] }
};

const objet = x => x && typeof x === "object" && !Array.isArray(x);
function fusion(base, x) {
  if (!objet(x)) return x === undefined ? base : x;
  const out = Object.assign({}, base);
  for (const k of Object.keys(x)) out[k] = objet(base && base[k]) && objet(x[k]) ? fusion(base[k], x[k]) : x[k];
  return out;
}
const ZONE = /^[a-z0-9_-]{1,24}$/;

/* Vérifie les réglages : renvoie la liste des erreurs, en français (vide = tout va bien). */
function verifier(a) {
  const e = [];
  const s = a && a.sources;
  if (!objet(s)) e.push("sources : un objet { garmin, withings, strava, apple_sante }");
  else {
    for (const k of ["garmin", "withings", "apple_sante"]) if (typeof s[k] !== "boolean") e.push("sources." + k + " : true ou false");
    if (![false, "connecteur", "api"].includes(s.strava)) e.push("sources.strava : false, « connecteur » ou « api »");
    if (s.garmin && s.strava === "api") e.push("sources : Garmin et Strava « api » ensemble compteraient chaque séance deux fois ; garde Strava en « connecteur »");
  }
  const entier = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  if (!a || typeof a !== "object") return ["le fichier n'est pas un objet JSON"];
  if (a.version !== 1) e.push("version doit valoir 1");
  if (!entier(a.cible && a.cible.course, 0, 7)) e.push("cible.course : un nombre de 0 à 7");
  if (!entier(a.cible && a.cible.renfo, 0, 7)) e.push("cible.renfo : un nombre de 0 à 7");
  if (!Array.isArray(a.fc_moteur) || a.fc_moteur.length !== 2 || !a.fc_moteur.every(v => entier(v, 90, 200)) || a.fc_moteur[0] <= a.fc_moteur[1])
    e.push("fc_moteur : deux fréquences cardiaques, la plus haute d'abord (ex. [150, 140])");
  if (!entier(a.plafond_chaleur, 100, 200)) e.push("plafond_chaleur : une fréquence cardiaque");
  if (a.allures != null) {
    if (!objet(a.allures)) e.push("allures : un objet { facile, endur, recup, tempo, vma, rapide } en secondes par km, ou null");
    else for (const k of Object.keys(a.allures)) if (!["recup", "facile", "endur", "tempo", "vma", "rapide"].includes(k) || !entier(a.allures[k], 150, 720))
      e.push("allures." + k + " : secondes par km entre 150 (2:30) et 720 (12:00)");
  }
  if (a.lieu != null && !(objet(a.lieu) && typeof a.lieu.lat === "number" && typeof a.lieu.lon === "number" && Math.abs(a.lieu.lat) <= 90 && Math.abs(a.lieu.lon) <= 180))
    e.push("lieu : { nom, lat, lon } ou null");
  const z = (a.checkin && a.checkin.zones) || [];
  if (!Array.isArray(z) || z.length > 6) e.push("checkin.zones : une liste de 6 zones au plus");
  else for (const x of z) if (!objet(x) || !ZONE.test(x.v || "") || typeof x.l !== "string" || typeof x.nom !== "string") e.push("checkin.zones : chaque zone a v (minuscules), l et nom");
  if (new Set(z.map(x => x && x.v)).size !== z.length) e.push("checkin.zones : deux zones ont le même v");
  const o = a.objectifs || {};
  if (o.reprise && !(typeof o.reprise.sport === "string" && typeof o.reprise.titre === "string" && typeof o.reprise.nom === "string"))
    e.push("objectifs.reprise : sport, nom et titre");
  if (o.reprise && o.reprise.motif) { try { new RegExp(o.reprise.motif, "i"); } catch (x) { e.push("objectifs.reprise.motif : expression invalide"); } }
  for (const k of ["regularite", "ventre", "reprise"]) if (o[k] && !entier(o[k].rang, 1, 9)) e.push("objectifs." + k + ".rang : un nombre de 1 à 9");
  return e;
}

/* Lit les réglages du dépôt (racine = dossier du dépôt). Un fichier absent donne les
   valeurs par défaut ; un fichier invalide arrête tout, avec le détail. */
function lireAthlete(racine) {
  let brut = null;
  try { brut = JSON.parse(fs.readFileSync(path.join(racine, "reglages", "athlete.json"), "utf8")); }
  catch (x) { if (x.code !== "ENOENT") throw new Error("reglages/athlete.json illisible : " + x.message); }
  const a = fusion(DEFAUT, brut || {});
  if (brut && brut.checkin && Array.isArray(brut.checkin.zones)) a.checkin.zones = brut.checkin.zones;   /* une liste se remplace, ne se fusionne pas */
  const err = verifier(a);
  if (err.length) throw new Error("reglages/athlete.json : " + err.join(" ; "));
  return a;
}

/* Ce que la page a besoin de savoir (transmis chiffré). */
function pourLaPage(a) {
  return { prenom:a.prenom, materiel:a.materiel, cible:a.cible, fc:a.fc_moteur, objectifs:a.objectifs, allures:a.allures, sources:a.sources };
}

module.exports = { DEFAUT, lireAthlete, verifier, pourLaPage, fusion };

/* node commun/athlete.cjs sources  → lignes « clé=valeur » pour $GITHUB_OUTPUT (workflows)
   node commun/athlete.cjs verifier → vérifie reglages/athlete.json (code 1 si invalide) */
if (require.main === module) {
  const racine = path.resolve(__dirname, "..");
  try {
    const a = lireAthlete(racine);
    if (process.argv[2] === "sources") {
      const s = a.sources;
      console.log("garmin=" + !!s.garmin + "\nwithings=" + !!s.withings + "\nstrava=" + (s.strava === "api") + "\nsante=" + !!s.apple_sante);
    } else if (process.argv[2] === "verifier") console.log("reglages/athlete.json : valide (" + (a.prenom || "sans prénom") + ")");
    else if (process.argv[2] === "prenom") console.log(a.prenom || "");
  } catch (e) { console.error(e.message); process.exit(1); }
}
