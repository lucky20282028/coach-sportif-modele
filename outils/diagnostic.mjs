/* Diagnostic complet d'une installation : réglages, secrets (présence seulement), Cloudflare,
   page en ligne, horloge, workflows, sources, réveil du coach, échéances.
     node outils/diagnostic.mjs      (workflows « Installation » et « Diagnostic »)
   Écrit etat/diagnostic.json, lisible par Claude ({ quand, ok, points:[{ id, ok, texte, action }] }),
   et un résumé dans la page du workflow. N'affiche jamais la valeur d'un secret.
   Entrées : CLOUDFLARE_API_TOKEN, GH_TOKEN, GITHUB_REPOSITORY, SECRETS (JSON nom → présent). */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { lireInstallation } from "../commun/installation.mjs";
import { PROGRAMME } from "../commun/horloge.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ATH = require("../commun/athlete.cjs");
const lireJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(RACINE, f), "utf8")); } catch (e) { return d; } };
const points = [];
const note = (id, ok, texte, action) => points.push({ id, ok:ok === null ? null : !!ok, texte, action:ok ? null : action || null });
const S = (() => { try { return JSON.parse(process.env.SECRETS || "{}"); } catch (e) { return {}; } })();
const a = (n) => !!S[n];

/* 1. Réglages */
let ath = null, inst = null;
try { ath = ATH.lireAthlete(RACINE); note("athlete", true, "Réglages de l'athlète valides (" + (ath.prenom || "sans prénom") + ")."); }
catch (e) { note("athlete", false, e.message, "Corriger reglages/athlete.json (Claude le fait)."); }
try {
  const profil = fs.readFileSync(path.join(RACINE, "profil.md"), "utf8");
  note("profil", !/À REMPLIR/.test(profil) && profil.length > 400, /À REMPLIR/.test(profil) ? "profil.md n'est pas encore rempli." : "profil.md rempli.",
    "Refaire l'entretien avec Claude (installation, étape « profil »).");
} catch (e) { note("profil", false, "profil.md absent.", "Refaire l'entretien avec Claude."); }
try { inst = lireInstallation(RACINE); note("installation", !!inst.empreinte_cle, inst.empreinte_cle ? "Installation : page « " + inst.projet + " »." : "Installation commencée : la clé de la page n'est pas encore notée.",
  "Coller la clé (PAGE_KEY) dans GitHub, puis relancer le workflow « Installation »."); }
catch (e) { note("installation", false, e.message, "Lancer le workflow « Installation »."); }

/* 2. Secrets (présence) */
const manque = [];
if (!a("CLOUDFLARE_API_TOKEN")) manque.push("CLOUDFLARE_API_TOKEN");
if (!a("JETON_GITHUB")) manque.push("JETON_GITHUB");
if (!a("PAGE_KEY")) manque.push("PAGE_KEY");
note("secrets", !manque.length, manque.length ? "Secrets manquants : " + manque.join(", ") + "." : "Secrets de base présents.", "Les ajouter dans GitHub › Settings › Secrets and variables › Actions.");
if (ath) {
  const s = ath.sources;
  if (s.garmin) note("garmin-acces", a("GARMIN_TOKENS") || (a("GARMIN_EMAIL") && a("GARMIN_MOT_DE_PASSE")) || fs.existsSync(path.join(RACINE, "etat", "garmin.enc")),
    "Garmin : accès " + (a("GARMIN_TOKENS") ? "par jetons" : fs.existsSync(path.join(RACINE, "etat", "garmin.enc")) ? "par jetons chiffrés" : a("GARMIN_EMAIL") ? "par identifiants" : "absent") + ".",
    "Ajouter GARMIN_EMAIL et GARMIN_MOT_DE_PASSE, puis lancer « Connexion Garmin ».");
  if (s.withings) note("withings-acces", a("WITHINGS_ENV"), "Withings : " + (a("WITHINGS_ENV") ? "application configurée." : "secret WITHINGS_ENV manquant."),
    "Créer l'application Withings et ajouter le secret WITHINGS_ENV (INSTALLER.md, Withings).");
  if (s.strava === "api") note("strava-acces", a("STRAVA_CLIENT_ID") && a("STRAVA_CLIENT_SECRET"), "Strava : " + (a("STRAVA_CLIENT_ID") && a("STRAVA_CLIENT_SECRET") ? "application configurée." : "secrets STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET manquants."),
    "Créer l'application Strava (strava.com/settings/api) et ajouter les deux secrets.");
}
note("reveil-secret", inst && inst.routine_reagir && a("COACH_REAGIR_JETON"), inst && inst.routine_reagir && a("COACH_REAGIR_JETON") ? "Réveil du coach : routine et jeton présents." : "Réveil du coach pas branché (routine « Coach · Réagir » ou secret COACH_REAGIR_JETON).",
  "Créer la routine « Coach · Réagir » avec un déclencheur API, noter son identifiant (Claude) et coller son jeton dans COACH_REAGIR_JETON.");

/* 3. Cloudflare */
const CF = "https://api.cloudflare.com/client/v4";
const cf = async chemin => {
  const r = await fetch(CF + chemin, { headers:{ Authorization:"Bearer " + process.env.CLOUDFLARE_API_TOKEN } });
  return r.json().catch(() => ({}));
};
if (process.env.CLOUDFLARE_API_TOKEN && inst) {
  try {
    const comptes = await cf("/accounts?per_page=5");
    const acc = comptes.result && comptes.result[0] && comptes.result[0].id;
    if (!acc) note("cloudflare", false, "Le jeton Cloudflare ne voit aucun compte.", "Recréer le jeton (guide : permissions Pages, Workers KV, Workers Scripts en Edit).");
    else {
      const p = await cf("/accounts/" + acc + "/pages/projects/" + inst.projet);
      if (!p.success) note("pages", false, "Projet Pages « " + inst.projet + " » introuvable.", "Relancer le workflow « Installation ».");
      else {
        const prod = (p.result.deployment_configs || {}).production || {};
        const vars = Object.keys(prod.env_vars || {});
        const voulu = ["EMPREINTE", "EMPREINTE_SANTE", "JETON_GITHUB", "DEPOT"];
        if (ath && ath.sources.strava === "api") voulu.push("STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET");
        if (ath && ath.sources.withings) voulu.push("WITHINGS_CLIENT_ID", "WITHINGS_CLIENT_SECRET");
        const absents = voulu.filter(v => !vars.includes(v));
        note("pages", !absents.length && !!(prod.kv_namespaces || {}).RETOURS, "Projet Pages « " + inst.projet + " » : " +
          (absents.length ? "variables manquantes : " + absents.join(", ") : "variables en place") + ((prod.kv_namespaces || {}).RETOURS ? ", stockage branché." : ", stockage NON branché."),
          "Relancer le workflow « Publier la page iPhone » (il remet tout en place).");
        if (inst.adresse && "https://" + p.result.subdomain !== inst.adresse) note("adresse", false, "L'adresse notée (" + inst.adresse + ") n'est pas celle de Cloudflare (https://" + p.result.subdomain + ").", "Relancer « Installation » : elle la corrige.");
      }
      const sd = await cf("/accounts/" + acc + "/workers/subdomain");
      const sc = await cf("/accounts/" + acc + "/workers/scripts/" + inst.horloge + "/schedules");
      const crons = ((sc.result && sc.result.schedules) || []).map(x => x.cron).sort();
      const attendus = PROGRAMME.map(x => x.cron).sort();
      note("horloge", sd.success && sd.result && sd.result.subdomain && JSON.stringify(crons) === JSON.stringify(attendus),
        "Horloge : " + (sc.success ? crons.length + " déclencheur(s) planifié(s)" : "Worker « " + inst.horloge + " » absent") + (sd.result && sd.result.subdomain ? "" : ", pas de sous-domaine workers.dev") + ".",
        "Relancer le workflow « Horloge (Cloudflare) » ; s'il échoue sur les droits, ajouter Workers Scripts : Edit au jeton Cloudflare.");
    }
  } catch (e) { note("cloudflare", false, "Cloudflare injoignable : " + e.message, "Relancer plus tard."); }
}

/* 4. Page en ligne */
if (inst) {
  try {
    const r = await fetch((inst.adresse || "https://" + inst.projet + ".pages.dev") + "/v.txt?t=" + Date.now());
    const v = (await r.text()).trim();
    note("page", r.ok && /^[0-9a-f]{16}$/.test(v), r.ok ? (v === "installation" ? "En ligne : encore la page de la clé." : "Page en ligne (version " + v + ").") : "Page injoignable (HTTP " + r.status + ").",
      v === "installation" ? "Coller la clé dans GitHub (PAGE_KEY) puis relancer « Installation »." : "Relancer « Publier la page iPhone ».");
  } catch (e) { note("page", false, "Page injoignable : " + e.message, "Relancer « Publier la page iPhone »."); }
}

/* 5. Workflows récents */
if (process.env.GH_TOKEN && process.env.GITHUB_REPOSITORY) {
  const gh = async c => (await fetch("https://api.github.com/repos/" + process.env.GITHUB_REPOSITORY + c, { headers:{ Authorization:"Bearer " + process.env.GH_TOKEN, Accept:"application/vnd.github+json" } })).json().catch(() => ({}));
  for (const [w, nom, maxH] of [["collecte.yml", "Collecte", 26], ["publier.yml", "Publication", 48], ["notifier.yml", "Notifications", 48], ["horloge.yml", "Horloge", null]]) {
    const j = await gh("/actions/workflows/" + w + "/runs?per_page=5&status=completed");
    const runs = (j.workflow_runs || []).filter(r => r.conclusion !== "cancelled" && r.conclusion !== "skipped");
    const der = runs[0];
    if (!der) { note("wf-" + w, null, nom + " : jamais lancée pour l'instant."); continue; }
    const ageH = (Date.now() - Date.parse(der.updated_at)) / 3600000;
    const ok = der.conclusion === "success" && (maxH == null || ageH <= maxH);
    note("wf-" + w, ok, nom + " : dernière " + (der.conclusion === "success" ? "réussie" : "en échec") + " il y a " + Math.round(ageH) + " h.",
      der.conclusion !== "success" ? "Ouvrir le workflow « " + nom + " » sur GitHub et lire l'erreur (Claude peut le faire)." : "L'horloge ne lance plus rien : relancer « Horloge (Cloudflare) ».");
  }
}

/* 6. Sources, réveil, échéances */
const dc = lireJson("etat/derniere-collecte.json", null);
if (ath && dc) for (const [k, nom, on] of [["garmin", "Garmin", ath.sources.garmin], ["withings", "Withings", ath.sources.withings], ["strava", "Strava", ath.sources.strava === "api"], ["sante", "Apple Santé", ath.sources.apple_sante]]) {
  if (!on) continue;
  note("src-" + k, dc[k] === "success", nom + " : " + (dc[k] === "success" ? "reçu à la dernière collecte (" + dc.collecte + ")." : "pas reçu à la dernière collecte (" + (dc[k] || "?") + ")."),
    k === "strava" ? "Toucher « Connecter Strava » dans les réglages de la page." : k === "sante" ? "Vérifier le raccourci Apple Santé (Claude t'aide)." : "Lire etat/" + k + ".log (Claude le fait).");
}
const re = lireJson("etat/reaction.json", {});
if (re.test) note("reveil-test", re.test.resultat === "ok", "Test du réveil du coach : " + re.test.resultat + ".", "Recréer le jeton de la routine « Coach · Réagir » et le recoller dans COACH_REAGIR_JETON.");
const exp = lireJson("etat/expirations.json", []);
for (const e of exp) {
  const j = Math.round((Date.parse(e.d) - Date.now()) / 86400000);
  if (j <= 30) note("exp-" + e.id, false, e.l + (j < 0 ? " : expiré." : " : expire dans " + j + " jours."), e.quoi);
}

const ok = points.every(p => p.ok !== false);
const res = { quand:new Date().toISOString(), ok, points };
fs.mkdirSync(path.join(RACINE, "etat"), { recursive:true });
fs.writeFileSync(path.join(RACINE, "etat", "diagnostic.json"), JSON.stringify(res, null, 1) + "\n");
const ligne = p => (p.ok === null ? "⏳" : p.ok ? "✅" : "❌") + " " + p.texte + (p.action ? " → " + p.action : "");
console.log((ok ? "Tout va bien." : "À régler :") + "\n" + points.map(ligne).join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, "## Diagnostic du coach\n\n" + points.map(p => "- " + ligne(p)).join("\n") + "\n");
