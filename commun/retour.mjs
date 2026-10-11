/* Logique commune aux retours de la page : validation (fonctions Cloudflare)
   et mise en forme pour le carnet (synchronisation dans la collecte).
   Uniquement des API standard (Web Crypto) : le même fichier tourne dans
   Cloudflare et dans Node. Testé par : node commun/banc-retour.mjs */

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha = s => crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));

export const sha256hex = async s => hex(await sha(s));
/* Le jeton que la page envoie : dérivé de la clé, jamais la clé elle-même. */
export const jetonDe = async cle => b64u(await sha("retour:" + cle));
/* Le jeton du raccourci Apple Santé : dérivé de la clé, il ne sert QU'à envoyer ces données. */
export const jetonSante = async cle => b64u(await sha("sante:" + cle));

const FAIT = ["fait", "pas fait", "en partie"];
const RAISONS = ["pas le temps", "fatigue", "douleur", "météo", "autre"];
const DOULEUR = ["aucune", "légère", "forte"];
const JAMBES = ["fraîches", "lourdes"];
const ALERTE = ["rien", "raideur", "douleur"];
/* Les zones du check-in sont propres à chaque athlète (reglages/athlete.json) : ici on
   n'accepte qu'un identifiant bien formé, leurs noms viennent des réglages (collecte). */
const ZONE = /^[a-z0-9_-]{1,24}$/;
const CHECKIN_NEUTRE = { rien:"rien à signaler", zones:[] };
const virgule = n => String(n).replace(".", ",");
const txt = (v, n) => typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim().slice(0, n) : "";

/* Renvoie { ok:true, r } ou { ok:false, err }. Tout ce qui n'est pas prévu est jeté. */
export function valider(b) {
  if (!b || typeof b !== "object") return { ok:false, err:"corps illisible" };
  const type = b.type;
  if (!["seance", "note", "test", "checkin", "mesure"].includes(type)) return { ok:false, err:"type inconnu" };
  if (typeof b.d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.d)) return { ok:false, err:"date invalide" };
  const r = { type, d:b.d, note:txt(b.note, 2000) };
  r.ecrit = typeof b.ecrit === "string" && /^\d{4}-\d{2}-\d{2} \d{2}h\d{2}$/.test(b.ecrit) ? b.ecrit : null;
  if (type === "seance") {
    r.t = txt(b.t, 120);
    r.fait = FAIT.includes(b.fait) ? b.fait : null;
    r.raison = RAISONS.includes(b.raison) ? b.raison : null;
    r.sensation = Number.isInteger(b.sensation) && b.sensation >= 1 && b.sensation <= 10 ? b.sensation : null;
    r.douleur = DOULEUR.includes(b.douleur) ? b.douleur : null;
    if (!r.fait && !r.sensation && !r.douleur && !r.note) return { ok:false, err:"retour vide" };
  } else if (type === "checkin") {
    /* Check-in du matin : forme 1–5, jambes, et la zone sensible (zones des réglages de l'athlète). */
    r.forme = Number.isInteger(b.forme) && b.forme >= 1 && b.forme <= 5 ? b.forme : null;
    r.jambes = JAMBES.includes(b.jambes) ? b.jambes : null;
    r.alerte = ALERTE.includes(b.alerte) ? b.alerte : null;
    r.zone = r.alerte && r.alerte !== "rien" && typeof b.zone === "string" && ZONE.test(b.zone) ? b.zone : null;
    if (!r.forme && !r.jambes && !r.alerte) return { ok:false, err:"check-in vide" };
  } else if (type === "mesure") {
    const tt = typeof b.tour_taille === "number" ? Math.round(b.tour_taille * 10) / 10 : NaN;
    if (!(tt >= 40 && tt <= 200)) return { ok:false, err:"mesure invalide" };
    r.tour_taille = tt;
  } else if (type === "note" && !r.note) return { ok:false, err:"note vide" };
  return { ok:true, r };
}

/* Empreinte d'un retour, hors heure de réception : la page peut renvoyer une saisie
   dont la première réponse s'est perdue (réseau mobile). Même empreinte = même saisie. */
export const signatureRetour = r => JSON.stringify(Object.keys(r || {}).filter(k => k !== "recu" && r[k] != null && r[k] !== "").sort().map(k => [k, r[k]]));

/* Authentifie une requête de la page : l'empreinte du jeton est connue du serveur. */
export async function autorise(req, empreinte) {
  return !!empreinte && (await sha256hex(req.headers.get("x-coach") || "")) === empreinte;
}

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
export const enteteMois = ecrit => "## " + MOIS[+ecrit.slice(5, 7) - 1] + " " + ecrit.slice(0, 4);

/* Heure de Paris d'un horodatage ISO, au format du carnet. */
export function horoParis(isoStr) {
  const d = new Date(isoStr);
  const p = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone:"Europe/Paris", year:"numeric", month:"2-digit",
    day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(d).map(x => [x.type, x.value]));
  return p.year + "-" + p.month + "-" + p.day + " " + p.hour + "h" + p.minute;
}

/* Une ligne du carnet, au format des autres : « AAAA-MM-JJ HHhMM — … ». */
export function ligneCarnet(r, recu, checkin) {
  const ck = checkin || CHECKIN_NEUTRE;
  const nomZone = v => { const z = (ck.zones || []).find(x => x.v === v); return z ? z.nom : v ? "(" + v + ")" : ""; };
  const quand = r.ecrit || horoParis(recu);
  const note = (r.note || "").replace(/\s*\n+\s*/g, " / ");
  if (r.type === "note") return quand + " — *(écrit depuis la page)* " + note;
  if (r.type === "mesure") return quand + " — *(mesure)* Tour de taille : " + virgule(r.tour_taille) + " cm." + (note ? " " + note : "");
  if (r.type === "checkin") {
    const b = [];
    if (r.forme) b.push("forme " + r.forme + "/5");
    if (r.jambes) b.push("jambes " + r.jambes);
    if (r.alerte === "rien") b.push(ck.rien || "rien à signaler");
    else if (r.alerte) b.push((r.alerte === "douleur" ? "⚠️ douleur " : "raideur ") + nomZone(r.zone).trim());
    const t = b.join(", ");
    return (quand + " — *(check-in du matin)* " + t.charAt(0).toUpperCase() + t.slice(1) + "." + (note ? " " + note : "")).replace(/ +\./g, ".");
  }
  const jj = r.d.slice(8) + "/" + r.d.slice(5, 7);
  const bouts = [];
  if (r.fait) bouts.push(r.fait === "fait" ? "Faite" : r.fait === "pas fait" ? "Pas faite" + (r.raison ? " (" + r.raison + ")" : "") : "Faite en partie" + (r.raison ? " (" + r.raison + ")" : ""));
  if (r.sensation) bouts.push("sensation " + r.sensation + "/10");
  if (r.douleur) bouts.push("douleur : " + r.douleur);
  let l = quand + " — *(retour page, séance du " + jj + (r.t ? " · " + r.t : "") + ")* " + (r.douleur === "forte" ? "⚠️ " : "") +
    (bouts.length ? bouts.join(", ") + "." : "");
  if (note) l += (bouts.length ? " " : "") + note;
  return l.trim();
}

/* Ajoute les lignes à la fin du carnet, sous l'en-tête du mois (créé au besoin). */
export function ajouterAuCarnet(carnet, lignes) {
  let c = carnet.replace(/\s+$/, "") + "\n";
  for (const { ligne } of lignes) {
    const ent = enteteMois(ligne.slice(0, 16));
    const tetes = c.match(/^## .+$/gm) || [];
    if (tetes[tetes.length - 1] !== ent) c += "\n" + ent + "\n";
    if (!/\n\n$/.test(c) && /\n## .+\n$/.test(c)) c += "\n";
    c += ligne + "\n";
  }
  return c;
}
