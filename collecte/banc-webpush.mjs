/* Banc du Web Push : clés dérivées stables, chiffrement relu par un « téléphone »
   simulé, jeton VAPID vérifiable avec la clé publique.  node collecte/banc-webpush.mjs */
import crypto from "node:crypto";
import { clesVapid, jetonVapid, chiffrer, dechiffrer, envoyer } from "./webpush.mjs";

let ok = 0, ko = 0; const echecs = [];
const t = (n, c, d) => { if (c) ok++; else { ko++; echecs.push(n + (d ? " → " + d : "")); } };

const K1 = clesVapid("cle-de-test-1"), K1b = clesVapid("cle-de-test-1"), K2 = clesVapid("cle-de-test-2");
t("mêmes clés pour le même secret (rien à stocker)", K1.publique === K1b.publique);
t("clés différentes pour un autre secret", K1.publique !== K2.publique);
t("clé publique : 65 octets non compressés", Buffer.from(K1.publique, "base64url").length === 65 && Buffer.from(K1.publique, "base64url")[0] === 4);
let err = null; try { clesVapid(""); } catch (e) { err = e.message; }
t("sans PAGE_KEY : erreur claire", /PAGE_KEY/.test(err || ""));

/* Un téléphone simulé et son abonnement. */
const tel = crypto.createECDH("prime256v1"); tel.generateKeys();
const auth = crypto.randomBytes(16);
const ab = { endpoint:"https://web.push.apple.com/QGuQyavXutnMx", keys:{ p256dh:tel.getPublicKey().toString("base64url"), auth:auth.toString("base64url") } };
const msg = JSON.stringify({ titre:"Ton footing n'est pas fait", corps:"Aérobie faible 35 min · 4,9 km — il te reste la soirée." });
const corps = chiffrer(msg, ab);
t("le téléphone relit exactement le message (accents compris)", dechiffrer(corps, tel.getPrivateKey(), auth) === msg);
t("en-tête aes128gcm : sel, taille 4096, clé de 65 octets", corps.readUInt32BE(16) === 4096 && corps[20] === 65);
t("deux envois du même message ne se ressemblent pas", !chiffrer(msg, ab).equals(chiffrer(msg, ab)));
const autreAuth = crypto.randomBytes(16); let casse = false;
try { dechiffrer(corps, tel.getPrivateKey(), autreAuth); } catch (e) { casse = true; }
t("un autre secret d'authentification ne peut pas lire", casse);

/* Vecteur de test officiel (RFC 8291, annexe A) : le chiffrement est conforme à la norme,
   pas seulement cohérent avec lui-même. */
const B = x => Buffer.from(x, "base64url");
const rfc = chiffrer("When I grow up, I want to be a watermelon",
  { endpoint:"https://x", keys:{ p256dh:"BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth:"BTBZMqHH6r4Tts7J_aSIgg" } },
  { privee:B("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"), sel:B("DGv6ra1nlYgDCS1FRnbzlw") });
t("RFC 8291 annexe A : octet pour octet", rfc.toString("base64url") ===
  "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");

const jwt = jetonVapid(ab.endpoint, K1, "https://coach.example", Date.UTC(2026, 9, 6));
const [h, p, s] = jwt.split(".");
const charge = JSON.parse(Buffer.from(p, "base64url"));
t("jeton : destinataire = origine du service", charge.aud === "https://web.push.apple.com");
t("jeton : expire dans 12 h", charge.exp === Date.UTC(2026, 9, 6) / 1000 + 12 * 3600);
const pubK = crypto.createPublicKey({ key:{ kty:"EC", crv:"P-256", x:Buffer.from(K1.publique, "base64url").subarray(1, 33).toString("base64url"),
  y:Buffer.from(K1.publique, "base64url").subarray(33).toString("base64url") }, format:"jwk" });
t("jeton : signature vérifiée avec la clé publique de la page",
  crypto.verify("sha256", Buffer.from(h + "." + p), { key:pubK, dsaEncoding:"ieee-p1363" }, Buffer.from(s, "base64url")));

/* Envoi : en-têtes attendus par Apple, sans réseau. */
let vu = null;
const code = await envoyer(ab, { titre:"Test", corps:"ok", tag:"test" }, K1, { fetch:async (u, o) => { vu = { u, o }; return { status:201 }; } });
t("envoi : code du service renvoyé", code === 201);
t("envoi : vers l'adresse de l'abonnement", vu.u === ab.endpoint);
t("envoi : Authorization vapid t=…, k=…", /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/.test(vu.o.headers.Authorization));
t("envoi : aes128gcm, TTL, Topic", vu.o.headers["Content-Encoding"] === "aes128gcm" && +vu.o.headers.TTL > 0 && vu.o.headers.Topic === "test");
t("envoi : le corps chiffré se relit", JSON.parse(dechiffrer(vu.o.body, tel.getPrivateKey(), auth)).titre === "Test");

console.log("\n  " + ok + " réussis, " + ko + " échoués");
if (ko) { echecs.forEach(e => console.log("  ✗ " + e)); process.exit(1); }
console.log("  Web Push validé.");
