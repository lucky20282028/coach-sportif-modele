/* Instantané complet de la page, à heure figée : régénère les données, construit la
   page avec une clé d'essai, l'ouvre dans Chromium et parcourt toutes les vues
   (Jour et ses 7 jours, chaque séance, l'agenda, Progrès et chaque détail, les
   réglages), dans les deux thèmes. Écrit le texte et le HTML de chaque étape.
     node outils/instantane.mjs <dossier du dépôt> <sortie.json> [ISO figé]
   Sert à prouver qu'une modification du code ne change rien à la page (comparer.mjs)
   et de test de bout en bout d'une installation. Ne modifie pas le dépôt : tout se
   passe dans une copie temporaire. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const [depot, sortie, fige = "2026-10-11T16:30:00Z"] = process.argv.slice(2);
if (!depot || !sortie) { console.error("usage : node outils/instantane.mjs <dépôt> <sortie.json> [ISO]"); process.exit(2); }
const ici = path.dirname(new URL(import.meta.url).pathname);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "instantane-"));
fs.cpSync(path.resolve(depot), tmp, { recursive:true, filter:s => !/(^|\/)(\.git|node_modules|site)$/.test(s) });
const env = Object.assign({}, process.env, { TZ:"Europe/Paris", FIGE:fige });
const freeze = path.join(ici, "horloge-figee.cjs");
execFileSync("node", ["--require", freeze, "depuis-plan.js"], { cwd:path.join(tmp, "app"), env, stdio:"pipe" });
const CLE = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";       /* clé d'essai, publique */
execFileSync("node", ["--require", freeze, "build.js", "donnees.js", path.join(tmp, "site", "index.html"), CLE], { cwd:path.join(tmp, "app"), env, stdio:"pipe" });

const site = path.join(tmp, "site");
const types = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json", ".png":"image/png", ".txt":"text/plain", ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml" };
const serveur = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  if (u.startsWith("/api/")) { r.writeHead(200, { "Content-Type":"application/json" }); r.end(JSON.stringify({ ok:true, retours:[] })); return; }
  const f = path.join(site, u === "/" ? "index.html" : u);
  if (!f.startsWith(site) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { "Content-Type":types[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f));
});
await new Promise(ok => serveur.listen(0, "127.0.0.1", ok));
const port = serveur.address().port;

const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch (e) { pw = require("/opt/npm-tools/node_modules/playwright"); }
const b = await pw.chromium.launch({ executablePath:fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
const res = { fige, etapes:{}, erreurs:[] };
const norm = h => h.replace(/\s+/g, " ").replace(/ (id|for)="u\d+"/g, "").trim();
for (const th of ["light", "dark"]) {
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, colorScheme:th, serviceWorkers:"block" });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(fige)); p.setDefaultTimeout(6000);
  p.on("pageerror", e => res.erreurs.push(th + " pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) res.erreurs.push(th + " console: " + m.text()); });
  const note = async (nom, sel) => {
    const el = await p.$(sel);
    const t = el ? await el.innerText() : "(absent)";
    if (/undefined|NaN|\[object /.test(t)) res.erreurs.push(th + " " + nom + " : texte cassé « " + t.match(/.{0,30}(undefined|NaN|\[object ).{0,10}/)[0] + " »");
    res.etapes[th + " · " + nom] = { texte:t, html:el ? norm(await el.innerHTML()) : "" };
  };
  const fermer = () => p.evaluate(() => { for (const s of ["#feuille", "#det"]) { const f = document.querySelector(s); if (f) f.classList.remove("on"); } });
  const pas = async (nom, f) => { try { await f(); } catch (e) { res.erreurs.push(th + " " + nom + " : " + e.message.split("\n")[0]); } };
  await p.goto("http://127.0.0.1:" + port + "/#" + CLE);
  await p.waitForSelector("#vJour", { timeout:10000 }).catch(() => res.erreurs.push(th + " : la page ne s'ouvre pas"));
  await p.waitForTimeout(1500);
  await note("jour", "#vJour");
  const nj = (await p.$$("#sem .sj")).length;
  for (let i = 0; i < nj; i++) await pas("jour " + i, async () => {
    await p.click("#sem .sj:nth-child(" + (i + 1) + ")"); await p.waitForTimeout(200);
    await note("jour " + i, "#vJour");
    const cartes = await p.$$("#vJour .carte:not(.repos)");
    for (let c = 0; c < cartes.length; c++) { await (await p.$$("#vJour .carte:not(.repos)"))[c].click(); await p.waitForTimeout(300); await note("jour " + i + " séance " + c, "#det"); await fermer(); }
  });
  await pas("agenda", async () => { await p.click('nav.tb button[data-v="vPlan"]'); await p.waitForTimeout(800); await note("agenda", "#vPlan"); });
  await pas("agenda mois", async () => { await p.click('#vPlan .seg.petit button[data-m="mois"]'); await p.waitForTimeout(300); await note("agenda mois", "#vPlan"); await p.click('#vPlan .seg.petit button[data-m="liste"]'); });
  await pas("progrès", async () => { await p.click('nav.tb button[data-v="vProg"]'); await p.waitForTimeout(600); await note("progrès", "#vProg"); });
  for (const sel of [".tuile", ".obj", ".ligne.det"]) await pas("progrès " + sel, async () => {
    const n = (await p.$$("#vProg " + sel)).length;
    for (let i = 0; i < n; i++) { await (await p.$$("#vProg " + sel))[i].click(); await p.waitForTimeout(250); await note("progrès " + sel + " " + i, "#fc"); await fermer(); }
  });
  await pas("réglages", async () => {
    await p.click("#bReg"); await p.waitForTimeout(250); await note("réglages", "#fc");
    const ids = await p.$$eval("#fc .ligne[id^=r]", l => l.map(x => x.id).filter(i => i !== "rParler"));
    for (const id of ids) { try { await p.click("#" + id, { timeout:3000 }); } catch (e) { res.erreurs.push(th + " réglages : " + id + " ne s'ouvre pas"); continue; } await p.waitForTimeout(200); await note("réglages " + id, "#fc"); await p.click("#fRetour").catch(() => {}); await p.waitForTimeout(150); }
    await fermer();
  });
  await ctx.close();
}
await b.close(); serveur.close();
fs.rmSync(tmp, { recursive:true, force:true });
fs.writeFileSync(sortie, JSON.stringify(res, null, 1));
console.log(Object.keys(res.etapes).length + " étapes, " + res.erreurs.length + " erreur(s)" + (res.erreurs.length ? "\n  " + res.erreurs.join("\n  ") : ""));
