/* Page de la clé, publiée à l'adresse du coach PENDANT l'installation, avant la vraie page.
     node outils/page-cle.mjs <dossier site> <propriétaire/dépôt> <adresse>
   Ouverte sur l'iPhone, elle crée la clé de la page DANS le téléphone (personne d'autre ne
   la voit, ni GitHub, ni Claude), la garde dans le navigateur, et guide l'athlète pour la
   coller dans les secrets GitHub (PAGE_KEY). Une fois la vraie page publiée à la même
   adresse, celle-ci retrouve la clé toute seule et l'écrit dans le lien (#…), qu'il n'y a
   plus qu'à poser sur l'écran d'accueil. Aucune donnée, aucun appel réseau. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const [site, depot, adresse] = process.argv.slice(2);
if (!site || !/^[\w.-]+\/[\w.-]+$/.test(depot || "") || !/^https:\/\/[a-z0-9.-]+$/.test(adresse || "")) {
  console.error("usage : node outils/page-cle.mjs <site> <propriétaire/dépôt> <https://…pages.dev>"); process.exit(2);
}
const ici = path.dirname(fileURLToPath(import.meta.url));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const lienSecret = "https://github.com/" + depot + "/settings/secrets/actions/new";

const script = `
(function () {
  var cle = null;
  try { cle = localStorage.getItem("coach-cle"); } catch (e) {}
  if (!cle || !/^[A-Za-z0-9_-]{43}$/.test(cle)) {
    var b = new Uint8Array(32); crypto.getRandomValues(b);
    cle = btoa(String.fromCharCode.apply(null, b)).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
    try { localStorage.setItem("coach-cle", cle); } catch (e) {}
  }
  var $ = function (id) { return document.getElementById(id); };
  $("cle").textContent = cle;
  $("lien").textContent = ${JSON.stringify(adresse)} + "/#" + cle;
  function copier(btn, texte) {
    var fini = function (ok) { btn.textContent = ok ? "Copié ✓" : "Sélectionne et copie à la main"; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(function () { fini(true); }, function () { fini(false); });
    else fini(false);
  }
  $("bCle").onclick = function () { copier(this, cle); };
  $("bNom").onclick = function () { copier(this, "PAGE_KEY"); };
  $("bLien").onclick = function () { copier(this, ${JSON.stringify(adresse)} + "/#" + cle); };
})();`;
const h = crypto.createHash("sha256").update(script, "utf8").digest("base64");
const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>Coach · ta clé</title>
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#fff;--s1:#F2F4F6;--t1:#0D1014;--t2:#3F4752;--t3:#737C88;--ac:#2563EB;--line:#E3E6EA}
@media (prefers-color-scheme: dark){:root{--bg:#0A0F1C;--s1:#131A2A;--t1:#fff;--t2:#B4BCC6;--t3:#6B7683;--ac:#4D8BFF;--line:#1E2738}}
body{background:var(--bg);color:var(--t1);font:400 16px/1.55 -apple-system,system-ui,sans-serif;padding:max(28px,env(safe-area-inset-top)) 16px 40px}
main{max-width:460px;margin:0 auto}
h1{font-size:26px;font-weight:800;margin-bottom:6px}
p{color:var(--t2);margin:8px 0}
.etape{background:var(--s1);border-radius:16px;padding:16px;margin-top:16px}
.etape b.n{display:inline-block;width:24px;height:24px;border-radius:12px;background:var(--ac);color:#fff;text-align:center;font-size:14px;line-height:24px;margin-right:8px}
.etape h2{font-size:17px;font-weight:700;display:flex;align-items:center}
code{display:block;font:500 14px/1.4 ui-monospace,Menlo,monospace;word-break:break-all;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px;margin:10px 0;user-select:all;-webkit-user-select:all}
button,a.btn{display:block;width:100%;text-align:center;font:600 16px -apple-system,system-ui,sans-serif;padding:13px;border-radius:12px;border:0;background:var(--t1);color:var(--bg);text-decoration:none;margin-top:8px}
button.creux{background:transparent;color:var(--ac);border:1px solid var(--line)}
small{color:var(--t3);font-size:13px}
</style></head><body><main>
<h1>Ta clé</h1>
<p>Ta page de coach est chiffrée avec une clé que toi seul as. Elle vient d'être créée <b>dans ce téléphone</b> : personne d'autre ne la voit, pas même Claude.</p>
<div class="etape"><h2><b class="n">1</b>Copie ta clé</h2>
<code id="cle">…</code><button id="bCle">Copier la clé</button></div>
<div class="etape"><h2><b class="n">2</b>Colle-la dans GitHub</h2>
<p>Ouvre la page ci-dessous (connecte-toi à GitHub si besoin). Dans <b>Name</b>, mets exactement :</p>
<code>PAGE_KEY</code><button class="creux" id="bNom">Copier « PAGE_KEY »</button>
<p>Dans <b>Secret</b>, colle ta clé, puis touche <b>Add secret</b>.</p>
<a class="btn" href="${esc(lienSecret)}" target="_blank" rel="noopener">Ouvrir GitHub</a></div>
<div class="etape"><h2><b class="n">3</b>Dis à Claude : « c'est fait »</h2>
<p>Il termine l'installation. Ensuite, tu reviens ici avec <b>Safari</b> : ta page s'affiche à la place de celle-ci.</p></div>
<div class="etape"><h2><b class="n">4</b>Garde ton lien personnel</h2>
<p>C'est lui que tu poseras sur l'écran d'accueil (Partager › Sur l'écran d'accueil). Ne le partage avec personne : il contient ta clé.</p>
<code id="lien">…</code><button class="creux" id="bLien">Copier le lien</button>
<p><small>Garde-le aussi dans tes notes : si tu effaces les données de Safari, c'est lui qui te ramène à ta page.</small></p></div>
</main><script>${script}</script></body></html>
`;
fs.mkdirSync(site, { recursive:true });
fs.writeFileSync(path.join(site, "index.html"), html);
const csp = "default-src 'none'; script-src 'sha256-" + h + "'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
fs.writeFileSync(path.join(site, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  Cache-Control: no-cache\n  Content-Security-Policy: " + csp + "\n");
fs.writeFileSync(path.join(site, "robots.txt"), "User-agent: *\nDisallow: /\n");
fs.writeFileSync(path.join(site, "v.txt"), "installation\n");
fs.copyFileSync(path.join(ici, "..", "app", "icones", "coach-a.png"), path.join(site, "apple-touch-icon.png"));
console.log("Page de la clé prête : " + adresse);
