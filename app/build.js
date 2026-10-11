/* Générateur de la page — chiffré.
   Le fichier déposé sur Netlify ne contient QUE du chiffré. La clé voyage
   dans le fragment de l'URL (après le #), que le navigateur n'envoie jamais
   au serveur : ni Netlify ni personne d'autre ne voit passer les données. */
const fs = require("fs");
const path = require("path");
const ici = __dirname;

const core = fs.readFileSync(path.join(ici, "core.js"), "utf8").replace(/\nif \(typeof module[\s\S]*$/, "\n");
const head = fs.readFileSync(path.join(ici, "head.html"), "utf8");
const app  = fs.readFileSync(path.join(ici, "app.js"), "utf8");


/* Retire les commentaires avant publication.
   Ils documentent la santé de l'athlète, son sommeil, ses habitudes : autant de
   choses qui n'ont rien à faire sur une adresse publique, même chiffrée
   par ailleurs. Le retrait est volontairement prudent — on ne touche pas
   à une ligne qui contient un guillemet, pour ne jamais mutiler une chaîne. */
function sansCommentaires(src) {
  const out = [];
  let dedans = false;
  for (let ligne of src.split("\n")) {
    const t = ligne.trim();
    if (dedans) { if (t.indexOf("*/") >= 0) { dedans = false; const r = ligne.slice(ligne.indexOf("*/") + 2); if (r.trim()) out.push(r); } continue; }
    if (t.startsWith("/*")) {
      if (t.indexOf("*/") > 0) { const r = ligne.slice(ligne.indexOf("*/") + 2); if (r.trim()) out.push(r); continue; }
      dedans = true; continue;
    }
    /* commentaire de fin de ligne : uniquement si aucune chaîne sur la ligne */
    const i = ligne.indexOf("/*");
    if (i > 0 && ligne.indexOf('"') < 0 && ligne.indexOf("'") < 0 && ligne.indexOf("`") < 0) {
      const j = ligne.indexOf("*/", i);
      ligne = j > 0 ? ligne.slice(0, i) + ligne.slice(j + 2) : ligne.slice(0, i);
      if (!ligne.trim()) continue;
    }
    out.push(ligne);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

(async () => {
  const fichier = process.argv[2] || path.join(ici, "donnees.js");
  const sortie  = process.argv[3] || path.join(ici, "site", "index.html");
  const cleArg  = process.argv[4];

  const D = require(path.resolve(fichier));
  const clair = Buffer.from(JSON.stringify(D), "utf8");

  /* Clé de 256 bits. Réutilisée si elle est fournie : sans ça, chaque
     régénération changerait l'adresse enregistrée sur l'écran d'accueil. */
  const brut = cleArg
    ? Buffer.from(cleArg.replace(/-/g, "+").replace(/_/g, "/"), "base64")
    : Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
  if (brut.length !== 32) throw new Error("clé invalide : " + brut.length + " octets au lieu de 32");

  const cle = await crypto.subtle.importKey("raw", brut, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = Buffer.from(await crypto.subtle.encrypt({ name:"AES-GCM", iv }, cle, clair));
  const charge = b64u(Buffer.concat([Buffer.from(iv), chiffre]));

  /* Empreinte de la version : la page la compare à v.txt pour savoir qu'une
     nouvelle version est en ligne. Ne dit rien du contenu. */
  const version = require("crypto").createHash("sha256").update(charge).digest("hex").slice(0, 16);
  /* Clé publique des notifications, dérivée de la clé de la page (rien de secret :
     elle permet seulement de s'abonner). La clé privée n'existe que dans GitHub Actions. */
  const { clesVapid } = await import("../collecte/webpush.mjs");
  const vapid = clesVapid(cleArg || b64u(brut)).publique;
  const loader = `
const CH = "${charge}";
const VERSION = "${version}";
const VAPID = "${vapid}";
try { const t = JSON.parse(localStorage.getItem("coach-theme")); if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); } catch (e) {}
const MUR = '<div style="max-width:340px;margin:22vh auto;padding:0 28px;text-align:center;font:400 15px/1.6 -apple-system,system-ui,sans-serif;color:#6B7683">' +
  '<div style="font-size:34px;margin-bottom:14px">·</div>' +
  '<div style="color:#fff;font-weight:700;font-size:17px;margin-bottom:8px">Rien à voir ici</div>' +
  'Cette page ne s\\'ouvre qu\\'avec sa clé. Elle est dans le lien complet, celui que tu as enregistré sur ton écran d\\'accueil.</div>';

(async function () {
  /* La clé est dans le lien (#…). Sans elle, celle que la page de la clé (installation) ou
     une ouverture précédente a gardée dans ce navigateur, réécrite dans le lien pour que
     « Sur l'écran d'accueil » enregistre le lien complet. */
  let f = location.hash.slice(1), gardee = null;
  try { gardee = localStorage.getItem("coach-cle"); } catch (e) {}
  if (!f && gardee && /^[A-Za-z0-9_-]{43}$/.test(gardee)) { f = gardee; try { history.replaceState(null, "", location.pathname + location.search + "#" + f); } catch (e) {} }
  if (!f) { document.body.innerHTML = MUR; return; }
  try {
    const oct = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const b = oct(CH);
    const k = await crypto.subtle.importKey("raw", oct(f), "AES-GCM", false, ["decrypt"]);
    const clair = await crypto.subtle.decrypt({ name:"AES-GCM", iv:b.slice(0, 12) }, k, b.slice(12));
    try { if (gardee !== f) localStorage.setItem("coach-cle", f); } catch (e) {}
    demarrer(JSON.parse(new TextDecoder().decode(clair)), f);
  } catch (e) {
    document.body.innerHTML = MUR;
  }
})();`;

  const script = "\nfunction demarrer(D, CLE) {\n" + sansCommentaires(core) + "\n" + sansCommentaires(app) + "\n}\n" + loader + "\n";
  const html = head + "\n<script>" + script + "</script>\n</body>\n</html>\n";
  /* Politique de sécurité : seul CE script peut s'exécuter (empreinte SHA-256).
     Effet voulu : aucun script injecté ne tourne — y compris le badge
     « Powered by Netlify » ajouté d'office, qui masquait les onglets sur l'iPhone. */
  const empreinte = require("crypto").createHash("sha256").update(script, "utf8").digest("base64");
  const csp = "default-src 'none'; script-src 'sha256-" + empreinte + "'; style-src 'unsafe-inline'; img-src 'self' data:; " +
              "connect-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

  fs.mkdirSync(path.dirname(sortie), { recursive:true });
  fs.writeFileSync(sortie, html, "utf8");

  /* Interdire l'indexation, quoi qu'il arrive. */
  fs.writeFileSync(path.join(path.dirname(sortie), "robots.txt"), "User-agent: *\nDisallow: /\n", "utf8");
  fs.writeFileSync(path.join(path.dirname(sortie), "_headers"),
    "/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n" +
    "/\n  Content-Security-Policy: " + csp + "\n  Cache-Control: no-cache\n" +
    "/index.html\n  Content-Security-Policy: " + csp + "\n  Cache-Control: no-cache\n" +
    "/v.txt\n  Cache-Control: no-store\n" +
    "/sw.js\n  Cache-Control: no-cache\n  Content-Type: application/javascript; charset=utf-8\n", "utf8");
  /* Le service worker : notifications et ouverture hors réseau. */
  fs.copyFileSync(path.join(ici, "sw.js"), path.join(path.dirname(sortie), "sw.js"));
  fs.writeFileSync(path.join(path.dirname(sortie), "v.txt"), version + "\n", "utf8");
  /* L'icône de l'écran d'accueil : un PNG (l'iPhone ignore les icônes SVG). Variante
     choisie dans icones/choix.txt (a, b ou c). */
  const choix = (() => { try { return fs.readFileSync(path.join(ici, "icones", "choix.txt"), "utf8").trim(); } catch (e) { return "a"; } })();
  fs.copyFileSync(path.join(ici, "icones", "coach-" + (/^[abc]$/.test(choix) ? choix : "a") + ".png"), path.join(path.dirname(sortie), "apple-touch-icon.png"));

  /* Contrôle : la page ne doit contenir AUCUNE donnée en clair. */
  /* Contrôle anti-fuite : on cherche dans la page publiée les valeurs
     distinctives des données. Un mot générique comme « Endurance » vient de
     la librairie et n'apprend rien ; « 1:31:16 » ou « 5h31 », si. */
  const temoins = new Set();
  const cueillir = o => {
    if (typeof o === "string") { if (o[0] !== "#" && /\d[:h,]\d|\d{2,}/.test(o) && o.length <= 40) temoins.add(o); return;   /* les couleurs ne sont pas des données */ }
    if (Array.isArray(o)) return o.forEach(cueillir);
    if (o && typeof o === "object") return Object.values(o).forEach(cueillir);
  };
  cueillir({ n3:D.n3, serie:D.serie, pred:D.pred, rec:D.rec, genere:D.genere });
  /* On cherche dans ce qui se lit en clair : les longues suites base64 (données chiffrées,
     icône) sont retirées, sinon « 49 » s'y trouve toujours par hasard. Un nombre seul de
     moins de 4 chiffres n'apprend rien et se retrouve partout dans le code : il n'est pas témoin. */
  const lisible = html.replace(/[A-Za-z0-9+\/_=-]{60,}/g, " ");
  const echap = m => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fuite = [...temoins].filter(m => !/^\d{1,3}$/.test(m))
    .filter(m => new RegExp("(^|[^0-9A-Za-zÀ-ÿ])" + echap(m) + "($|[^0-9A-Za-zÀ-ÿ])").test(lisible));
  if (fuite.length) throw new Error("FUITE EN CLAIR : " + fuite.join(" | "));
  console.log("  anti-fuite : " + temoins.size + " valeurs témoins cherchées, aucune trouvée");

  console.log("→ " + path.basename(sortie) + "  " + Math.round(html.length / 1024) + " Ko");
  console.log("  charge chiffrée : " + Math.round(charge.length / 1024) + " Ko, rien en clair");
  console.log("  version : " + version);
  /* La clé n'est affichée que si elle vient d'être inventée (jamais celle de PAGE_KEY). */
  if (!cleArg) console.log("  clé : " + b64u(brut));
})();
