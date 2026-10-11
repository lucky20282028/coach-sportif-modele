/* Accès à Cloudflare pour les workflows (jeton : secret CLOUDFLARE_API_TOKEN).
     node collecte/cloudflare.mjs url   → adresse publique de la page
     node collecte/cloudflare.mjs sous-domaine → crée au besoin le sous-domaine workers.dev
     node collecte/cloudflare.mjs preparer
       → crée au besoin le projet Pages et le stockage KV des retours, branche
         le KV sur le projet, y dépose les secrets EMPREINTE et JETON_GITHUB,
         et écrit CF_ACCOUNT_ID / CF_URL dans $GITHUB_ENV pour l'étape suivante.
   Le module exporte aussi le petit client KV utilisé par retours.mjs. */
import fs from "node:fs";
import { jetonDe, jetonSante, sha256hex } from "../commun/retour.mjs";
import { lireInstallation } from "../commun/installation.mjs";

/* Le projet Pages de CETTE installation (reglages/installation.json).
   CF_PROJET et CF_KV remplacent les noms (installation d'essai, qui ne touche à rien d'autre). */
export const PROJET = process.env.CF_PROJET || (() => { try { return lireInstallation().projet; } catch (e) { return null; } })();
const TITRE_KV = process.env.CF_KV || "coach-retours";
const API = process.env.CF_API || "https://api.cloudflare.com/client/v4";

async function cf(chemin, opt = {}) {
  const tok = process.env.CLOUDFLARE_API_TOKEN;
  if (!tok) throw new Error("secret CLOUDFLARE_API_TOKEN absent");
  const r = await fetch(API + chemin, Object.assign({}, opt, {
    headers:Object.assign({ Authorization:"Bearer " + tok }, opt.json ? { "Content-Type":"application/json" } : {}, opt.headers || {}),
    body:opt.json ? JSON.stringify(opt.json) : opt.body
  }));
  if (opt.brut) return r;
  const j = await r.json().catch(() => ({}));
  if (!j.success && !opt.tolerer) throw new Error(chemin + " → " + r.status + " " + JSON.stringify(j.errors || j).slice(0, 300));
  return j;
}

export async function compte() {
  if (process.env.CF_ACCOUNT_ID) return process.env.CF_ACCOUNT_ID;
  const j = await cf("/accounts?per_page=5");
  if (!j.result || !j.result.length) throw new Error("aucun compte Cloudflare visible avec ce jeton");
  return j.result[0].id;
}

export async function espaceKV(acc, creer) {
  const j = await cf("/accounts/" + acc + "/storage/kv/namespaces?per_page=100");
  const n = (j.result || []).find(x => x.title === TITRE_KV);
  if (n) return n.id;
  if (!creer) throw new Error("stockage KV " + TITRE_KV + " introuvable");
  return (await cf("/accounts/" + acc + "/storage/kv/namespaces", { method:"POST", json:{ title:TITRE_KV } })).result.id;
}

/* Client KV minimal pour la collecte. */
export async function kv() {
  const acc = await compte(), ns = await espaceKV(acc, false);
  const base = "/accounts/" + acc + "/storage/kv/namespaces/" + ns;
  return {
    async cles(prefixe) {
      const out = []; let curseur = "";
      do {
        const j = await cf(base + "/keys?limit=1000&prefix=" + encodeURIComponent(prefixe) + (curseur ? "&cursor=" + curseur : ""));
        out.push(...j.result.map(k => k.name));
        curseur = j.result_info && j.result_info.cursor;
      } while (curseur);
      return out.sort();
    },
    async lire(cle) {
      const r = await cf(base + "/values/" + encodeURIComponent(cle), { brut:true });
      return r.ok ? r.json().catch(() => null) : null;
    },
    async effacer(cle) { await cf(base + "/values/" + encodeURIComponent(cle), { method:"DELETE", tolerer:true }); },
    async ecrire(cle, valeur, ttl) {
      await cf(base + "/values/" + encodeURIComponent(cle) + (ttl ? "?expiration_ttl=" + Math.max(60, ttl) : ""),
        { method:"PUT", body:typeof valeur === "string" ? valeur : JSON.stringify(valeur), headers:{ "Content-Type":"text/plain" } });
    }
  };
}

async function preparer() {
  if (!PROJET) throw new Error("nom du projet Pages inconnu (reglages/installation.json)");
  const acc = await compte();
  const ns = await espaceKV(acc, true);
  let p = await cf("/accounts/" + acc + "/pages/projects/" + PROJET, { tolerer:true });
  if (!p.success) p = await cf("/accounts/" + acc + "/pages/projects", { method:"POST", json:{ name:PROJET, production_branch:"main" } });
  const vars = {};
  /* Empreinte du jeton des retours : dérivée de la clé de la page, ni la clé ni le jeton ne partent. */
  if (process.env.PAGE_KEY) {
    vars.EMPREINTE = { type:"secret_text", value:await sha256hex(await jetonDe(process.env.PAGE_KEY)) };
    vars.EMPREINTE_SANTE = { type:"secret_text", value:await sha256hex(await jetonSante(process.env.PAGE_KEY)) };
  }
  /* Jeton GitHub des fonctions (Actualiser, message au coach, horloge). Ancien nom : JETON_ACTUALISER. */
  const jg = process.env.JETON_GITHUB || process.env.JETON_ACTUALISER;
  if (jg) vars.JETON_GITHUB = { type:"secret_text", value:jg };
  /* Le dépôt que les fonctions déclenchent (pas secret). */
  if (process.env.GITHUB_REPOSITORY) vars.DEPOT = { type:"plain_text", value:process.env.GITHUB_REPOSITORY };
  /* Identifiants de l'application Withings, pour le bouton « Reconnecter Withings ». */
  const wenv = {};
  for (const l of String(process.env.WITHINGS_ENV || "").split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m) wenv[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  /* Identifiants de l'application Strava de l'athlète, pour le bouton « Connecter Strava ». */
  if (process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET) {
    vars.STRAVA_CLIENT_ID = { type:"secret_text", value:process.env.STRAVA_CLIENT_ID.trim() };
    vars.STRAVA_CLIENT_SECRET = { type:"secret_text", value:process.env.STRAVA_CLIENT_SECRET.trim() };
  }
  if (wenv.WITHINGS_CLIENT_ID && wenv.WITHINGS_CLIENT_SECRET) {
    vars.WITHINGS_CLIENT_ID = { type:"secret_text", value:wenv.WITHINGS_CLIENT_ID };
    vars.WITHINGS_CLIENT_SECRET = { type:"secret_text", value:wenv.WITHINGS_CLIENT_SECRET };
  }
  const conf = { kv_namespaces:{ RETOURS:{ namespace_id:ns } }, env_vars:vars, compatibility_date:"2026-09-01" };
  await cf("/accounts/" + acc + "/pages/projects/" + PROJET, { method:"PATCH",
    json:{ deployment_configs:{ production:conf, preview:{ kv_namespaces:conf.kv_namespaces, compatibility_date:conf.compatibility_date } } } });
  p = await cf("/accounts/" + acc + "/pages/projects/" + PROJET);
  const url = "https://" + p.result.subdomain;
  if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, "CF_ACCOUNT_ID=" + acc + "\nCF_URL=" + url + "\n");
  console.log("Projet Pages prêt : " + url + " · KV branché · secrets : " + (Object.keys(vars).join(", ") || "aucun"));
}

export async function adresse() {
  const acc = await compte();
  return "https://" + (await cf("/accounts/" + acc + "/pages/projects/" + PROJET)).result.subdomain;
}

/* Les déclencheurs planifiés d'un Worker exigent un sous-domaine workers.dev sur le
   compte (même si le Worker n'y est pas exposé : workers_dev = false). On le crée
   au besoin, au nom du projet, déjà public dans l'adresse de la page. */
export async function sousDomaine() {
  const acc = await compte();
  const j = await cf("/accounts/" + acc + "/workers/subdomain", { tolerer:true });
  if (j.success && j.result && j.result.subdomain) return j.result.subdomain;
  return (await cf("/accounts/" + acc + "/workers/subdomain", { method:"PUT", json:{ subdomain:PROJET } })).result.subdomain;
}

/* Efface une installation d'essai (projet Pages et stockage) : seulement un nom « coach-essai-… ». */
export async function supprimerEssai() {
  if (!/^coach-essai-[a-z0-9]+$/.test(PROJET || "") || !/^coach-essai-/.test(TITRE_KV)) throw new Error("refus : ce n'est pas une installation d'essai (" + PROJET + ", " + TITRE_KV + ")");
  const acc = await compte();
  await cf("/accounts/" + acc + "/pages/projects/" + PROJET, { method:"DELETE", tolerer:true });
  const j = await cf("/accounts/" + acc + "/storage/kv/namespaces?per_page=100");
  const n = (j.result || []).find(x => x.title === TITRE_KV);
  if (n) await cf("/accounts/" + acc + "/storage/kv/namespaces/" + n.id, { method:"DELETE", tolerer:true });
  console.log("Essai effacé : " + PROJET + (n ? " et " + TITRE_KV : ""));
}

if (process.argv[2] === "supprimer-essai") supprimerEssai().catch(e => { console.error(e.message); process.exit(1); });
if (process.argv[2] === "sous-domaine") sousDomaine().then(d => console.log("sous-domaine workers.dev : " + d)).catch(e => { console.error(e.message); process.exit(1); });
if (process.argv[2] === "url") adresse().then(u => console.log(u));
if (process.argv[2] === "preparer") preparer().catch(e => {
  console.log("::error title=Cloudflare::" + String(e.message).replace(/%/g, "%25").replace(/\n/g, "%0A"));
  process.exit(1);
});
