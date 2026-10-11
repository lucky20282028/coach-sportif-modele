/* Ce qui distingue une installation d'une autre, hors secrets : reglages/installation.json.
     projet        nom du projet Cloudflare Pages (= l'adresse <projet>.pages.dev)
     horloge       nom du Worker qui sonne les tâches à l'heure
     adresse       adresse publique de la page (Cloudflare peut ajouter un suffixe au nom)
     routine_reagir identifiant de la routine Claude « Coach · Réagir » (trig_…), pas secret
     empreinte_cle SHA-256 de la clé de la page (PAGE_KEY). Pas la clé : une empreinte
                   ne permet pas de la retrouver. Sert à refuser de publier avec une autre
                   clé, ce qui casserait le lien enregistré sur l'écran d'accueil.
   Le fichier est écrit une fois par l'installation (installation.yml), puis ne bouge plus.
     node commun/installation.mjs projet|horloge|empreinte_cle|adresse  → affiche la valeur
     node commun/installation.mjs creer          → crée le fichier s'il n'existe pas (nom de page unique)
     node commun/installation.mjs adresse= URL   → note l'adresse donnée par Cloudflare
     node commun/installation.mjs noter-cle      → note l'empreinte de PAGE_KEY (env) ; refuse une autre clé */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOM = /^[a-z0-9][a-z0-9-]{2,57}$/;

export function verifierInstallation(x) {
  const e = [];
  if (!x || typeof x !== "object") return ["fichier illisible"];
  if (!NOM.test(x.projet || "")) e.push("projet : minuscules, chiffres et tirets (3 à 58 caractères)");
  if (!NOM.test(x.horloge || "")) e.push("horloge : minuscules, chiffres et tirets");
  if (x.empreinte_cle != null && !/^[0-9a-f]{64}$/.test(x.empreinte_cle)) e.push("empreinte_cle : 64 caractères hexadécimaux");
  if (x.adresse != null && !/^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(x.adresse)) e.push("adresse : https://<nom>.pages.dev");
  if (x.routine_reagir != null && !/^trig_[A-Za-z0-9]{8,64}$/.test(x.routine_reagir)) e.push("routine_reagir : identifiant trig_…");
  return e;
}

export function lireInstallation(racine = RACINE) {
  let x;
  try { x = JSON.parse(fs.readFileSync(path.join(racine, "reglages", "installation.json"), "utf8")); }
  catch (e) { throw new Error("reglages/installation.json absent ou illisible : l'installation n'a pas été faite (workflow « Installation »)."); }
  const err = verifierInstallation(x);
  if (err.length) throw new Error("reglages/installation.json : " + err.join(" ; "));
  return Object.assign({}, x, { adresse:x.adresse || "https://" + x.projet + ".pages.dev" });
}

const FICHIER = racine => path.join(racine, "reglages", "installation.json");
const ecrire = (racine, x) => { fs.mkdirSync(path.dirname(FICHIER(racine)), { recursive:true }); fs.writeFileSync(FICHIER(racine), JSON.stringify(x, null, 1) + "\n"); };

/* Nom de page unique : « coach- » + 8 caractères au hasard (l'adresse <nom>.pages.dev est publique). */
export function creerInstallation(racine = RACINE) {
  if (fs.existsSync(FICHIER(racine))) return { cree:false, x:lireInstallation(racine) };
  const a = "abcdefghijkmnpqrstuvwxyz23456789", o = crypto.randomBytes(8);
  const x = { projet:"coach-" + [...o].map(b => a[b % a.length]).join(""), horloge:"coach-horloge", empreinte_cle:null };
  ecrire(racine, x);
  return { cree:true, x };
}

/* La clé de la page : 32 octets en base64url (43 caractères), créée par la page de la clé. */
export const CLE_VALIDE = /^[A-Za-z0-9_+\/-]{43}=?$/;
export function noterCle(cle, racine = RACINE) {
  if (!CLE_VALIDE.test(cle || "")) return { ok:false, err:"PAGE_KEY n'a pas la bonne forme (43 caractères, lettres, chiffres, - et _) : elle a sans doute été mal collée (espace, retour à la ligne, guillemets). Recolle-la depuis la page de la clé." };
  const x = lireInstallation(racine);
  const emp = crypto.createHash("sha256").update(cle, "utf8").digest("hex");
  if (x.empreinte_cle && x.empreinte_cle !== emp) return { ok:false, err:"PAGE_KEY n'est pas la clé de cette installation : la changer casserait le lien de l'écran d'accueil. Remets l'ancienne, ou relance l'installation avec « nouvelle_cle »." };
  if (!x.empreinte_cle) { const y = JSON.parse(fs.readFileSync(FICHIER(racine), "utf8")); y.empreinte_cle = emp; ecrire(racine, y); return { ok:true, nouvelle:true }; }
  return { ok:true, nouvelle:false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2] || "";
  try {
    if (arg === "creer") { const r = creerInstallation(); console.log(r.cree ? "Installation créée : page « " + r.x.projet + " »." : "Installation déjà créée : page « " + r.x.projet + " »."); }
    else if (arg === "adresse=") {
      const u = process.argv[3] || "";
      if (!/^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(u)) throw new Error("adresse invalide : " + u);
      const y = JSON.parse(fs.readFileSync(FICHIER(RACINE), "utf8")); y.adresse = u; ecrire(RACINE, y); console.log("Adresse notée : " + u);
    }
    else if (arg === "noter-cle") {
      if (process.env.NOUVELLE_CLE === "true") { const y = JSON.parse(fs.readFileSync(FICHIER(RACINE), "utf8")); y.empreinte_cle = null; ecrire(RACINE, y); }
      const r = noterCle((process.env.PAGE_KEY || "").trim() === process.env.PAGE_KEY ? process.env.PAGE_KEY : "\u0000");
      if (!r.ok) { console.error(r.err); process.exit(4); }
      console.log(r.nouvelle ? "Clé de la page notée (empreinte seulement)." : "Clé de la page : c'est bien celle de cette installation.");
    }
    else { const v = lireInstallation()[arg]; if (v == null) process.exit(3); console.log(v); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
