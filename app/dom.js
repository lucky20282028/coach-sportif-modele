/* Arbre DOM minimal — assez pour exécuter le rendu de la v12 et relire le
   HTML produit. Pas de mise en page, pas de CSS : on vérifie la structure
   et les textes, c'est là que se cachent les bugs d'affichage. */

const AUTOF = new Set(["br","img","input","meta","link","hr"]);

class El {
  constructor(tag) {
    this.tag = String(tag).toLowerCase();
    this.children = [];
    this.parent = null;
    this.attrs = {};
    this.dataset = {};
    this.style = new Proxy({}, { set:(o,k,v) => (o[k] = v, true), get:(o,k) => o[k] || "" });
    this.style.setProperty = () => {};
    this.style.cssText = "";
    this._cls = new Set();
    this.onclick = null;
    this._text = null;
  }
  get className() { return [...this._cls].join(" "); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    const s = this._cls;
    return { add:(...c) => c.forEach(x => s.add(x)), remove:(...c) => c.forEach(x => s.delete(x)),
             toggle:(c, f) => (f === undefined ? (s.has(c) ? s.delete(c) : s.add(c)) : (f ? s.add(c) : s.delete(c))),
             contains:c => s.has(c) };
  }
  get id() { return this.attrs.id || ""; }
  set id(v) { this.attrs.id = v; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k.startsWith("data-")) this.dataset[k.slice(5)] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  addEventListener() {}
  set innerHTML(h) { this.children = []; this._text = null; parseHTML(String(h), this); }
  get innerHTML() { return this.children.map(serial).join(""); }
  set textContent(v) { this.children = []; this._text = String(v); }
  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map(c => c.textContent).join("");
  }
  querySelector(s) { return sel(this, s)[0] || null; }
  querySelectorAll(s) { return sel(this, s); }
  get outerHTML() { return serial(this); }
}
class Txt {
  constructor(t) { this.tag = "#text"; this._text = t; this.children = []; this._cls = new Set(); this.attrs = {}; }
  get textContent() { return this._text; }
  querySelectorAll() { return []; }
}

function serial(n) {
  if (n.tag === "#text") return n._text;
  const a = Object.entries(n.attrs).map(([k, v]) => " " + k + '="' + v + '"').join("") +
            (n._cls.size ? ' class="' + [...n._cls].join(" ") + '"' : "");
  if (AUTOF.has(n.tag)) return "<" + n.tag + a + ">";
  const dedans = n._text != null ? n._text : n.children.map(serial).join("");
  return "<" + n.tag + a + ">" + dedans + "</" + n.tag + ">";
}

/* Analyseur HTML de poche : balises, attributs, texte. Suffisant pour les
   fragments que produit l'application (aucun cas tordu, aucun script). */
function parseHTML(h, dans) {
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m, pile = [dans];
  while ((m = re.exec(h))) {
    const [, fin, tag, attrs, auto, txt] = m;
    const haut = pile[pile.length - 1];
    if (txt != null) { if (txt.trim() || txt === " ") haut.appendChild(new Txt(txt)); continue; }
    const t = tag.toLowerCase();
    if (fin) { if (pile.length > 1) pile.pop(); continue; }
    const e = new El(t);
    for (const a of attrs.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) {
      if (a[1] === "class") e.className = a[2]; else e.setAttribute(a[1], a[2]);
    }
    haut.appendChild(e);
    if (!auto && !AUTOF.has(t)) pile.push(e);
  }
}

/* Sélecteurs : #id, .classe, balise, et descendance « a b ».
   Les combinaisons composées « nav.tb a » et « a[data-v] » sont gérées. */
function unite(n, s) {
  if (n.tag === "#text") return false;
  const m = /^([a-z][a-z0-9]*)?((?:\.[\w-]+)*)(?:#([\w-]+))?(?:\[([\w-]+)\])?$/i.exec(s);
  if (!m) return false;
  const [, tag, cls, id, att] = m;
  if (tag && n.tag !== tag) return false;
  /* Plusieurs classes possibles : « .mini.fait » exige les deux. */
  for (const c of (cls || "").split(".").filter(Boolean)) if (!n._cls.has(c)) return false;
  if (id && n.attrs.id !== id) return false;
  if (att && !(att in n.attrs) && !(att.startsWith("data-") && att.slice(5) in n.dataset)) return false;
  return true;
}
function tous(n, out) { for (const c of n.children) { if (c.tag !== "#text") { out.push(c); tous(c, out); } } return out; }
function sel(racine, s) {
  s = s.trim();
  if (s[0] === "#" && !/[ .\[]/.test(s.slice(1))) {
    return tous(racine, []).filter(n => n.attrs.id === s.slice(1));
  }
  const bouts = s.replace(/\s*>\s*/g, " > ").split(/\s+/).filter(Boolean);
  let lot = tous(racine, []).filter(n => unite(n, bouts[0]));
  for (let i = 1; i < bouts.length; i++) {
    if (bouts[i] === ">") {          /* enfant direct, pas descendant */
      const cible = bouts[++i], suiv = [];
      for (const n of lot) for (const d of n.children) if (d.tag !== "#text" && unite(d, cible) && suiv.indexOf(d) < 0) suiv.push(d);
      lot = suiv;
      continue;
    }
    const suiv = [];
    for (const n of lot) for (const d of tous(n, [])) if (unite(d, bouts[i]) && suiv.indexOf(d) < 0) suiv.push(d);
    lot = suiv;
  }
  return lot;
}

function creerDocument(html) {
  const racine = new El("html");
  const body = new El("body");
  racine.appendChild(body);
  const corps = String(html).replace(/^[\s\S]*?<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, "")
                            .replace(/<script[\s\S]*?<\/script>/gi, "");
  parseHTML(corps, body);
  const doc = {
    body,
    createElement:t => new El(t),
    querySelector:s => sel(racine, s)[0] || null,
    querySelectorAll:s => sel(racine, s),
    addEventListener() {}
  };
  return { doc, racine, body };
}

module.exports = { El, Txt, creerDocument, sel, serial };
