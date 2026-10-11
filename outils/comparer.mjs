/* Compare deux instantanés (instantane.mjs) : liste les étapes dont le texte ou le
   HTML diffère. Code de sortie 1 s'il y a une différence. */
import fs from "node:fs";
const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
let n = 0;
for (const k of new Set([...Object.keys(a.etapes), ...Object.keys(b.etapes)])) {
  const x = a.etapes[k], y = b.etapes[k];
  if (!x || !y) { console.log((x ? "disparue : " : "nouvelle : ") + k); n++; continue; }
  if (x.texte !== y.texte) {
    n++; const i = [...x.texte].findIndex((c, j) => c !== y.texte[j]);
    console.log("texte ≠ " + k + "\n   avant : …" + x.texte.slice(Math.max(0, i - 60), i + 60).replace(/\n/g, "⏎") + "\n   après : …" + y.texte.slice(Math.max(0, i - 60), i + 60).replace(/\n/g, "⏎"));
  } else if (x.html !== y.html) {
    n++; const i = [...x.html].findIndex((c, j) => c !== y.html[j]);
    console.log("html ≠ " + k + "\n   avant : …" + x.html.slice(Math.max(0, i - 80), i + 80) + "\n   après : …" + y.html.slice(Math.max(0, i - 80), i + 80));
  }
}
console.log(n ? n + " différence(s)" : "identiques (" + Object.keys(a.etapes).length + " étapes)");
process.exit(n ? 1 : 0);
