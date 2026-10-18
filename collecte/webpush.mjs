/* Web Push sans bibliothèque : chiffrement du message (RFC 8291, aes128gcm)
   et signature VAPID (RFC 8292), avec le seul module crypto de Node.

   Les clés VAPID ne sont stockées nulle part : elles se DÉRIVENT de PAGE_KEY
   (le secret de la page). La clé publique part dans la page (elle n'a rien de
   secret), la clé privée n'existe que le temps d'un envoi dans GitHub Actions.
   Changer PAGE_KEY change les clés : il faudrait alors se réabonner.

   Testé par collecte/banc-webpush.mjs (aller-retour chiffrement/déchiffrement,
   signature vérifiée). */
import crypto from "node:crypto";

const b64u = buf => Buffer.from(buf).toString("base64url");
const deb64u = s => Buffer.from(String(s), "base64url");
/* Ordre du groupe de la courbe P-256 : la clé privée doit être dans [1, n-1]. */
const N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");

/* « sub » du jeton VAPID : l'adresse de la page de cette installation. */
import { lireInstallation } from "../commun/installation.mjs";
const SUJET = (() => { try { return lireInstallation().adresse; } catch (e) { return "https://coach.invalid"; } })();

/* Clés VAPID dérivées de PAGE_KEY. */
export function clesVapid(pageKey) {
  if (!pageKey) throw new Error("PAGE_KEY absente : impossible de dériver les clés de notification");
  let d = null;
  for (let i = 0; i < 16 && !d; i++) {
    const c = Buffer.from(crypto.hkdfSync("sha256", Buffer.from(String(pageKey)), Buffer.from("coach-vapid"), Buffer.from("v1:" + i), 32));
    const v = BigInt("0x" + c.toString("hex"));
    if (v > 0n && v < N) d = c;
  }
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(d);
  const pub = ecdh.getPublicKey();                       /* 65 octets, non compressée */
  const jwk = { kty:"EC", crv:"P-256", d:b64u(d), x:b64u(pub.subarray(1, 33)), y:b64u(pub.subarray(33, 65)) };
  return { publique:b64u(pub), privee:crypto.createPrivateKey({ key:jwk, format:"jwk" }) };
}

/* Jeton VAPID (JWT ES256) pour l'origine du service de notification. */
export function jetonVapid(endpoint, cles, sujet, maintenant) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor((maintenant || Date.now()) / 1000) + 12 * 3600;
  const h = b64u(JSON.stringify({ typ:"JWT", alg:"ES256" })), p = b64u(JSON.stringify({ aud, exp, sub:sujet }));
  const sig = crypto.sign("sha256", Buffer.from(h + "." + p), { key:cles.privee, dsaEncoding:"ieee-p1363" });
  return h + "." + p + "." + b64u(sig);
}

/* Chiffre `texte` pour un abonnement {endpoint, keys:{p256dh, auth}} (RFC 8291). */
export function chiffrer(texte, abonnement, alea) {
  const uaPub = deb64u(abonnement.keys.p256dh), auth = deb64u(abonnement.keys.auth);
  if (uaPub.length !== 65 || auth.length !== 16) throw new Error("clés d'abonnement invalides");
  const as = crypto.createECDH("prime256v1");
  if (alea && alea.privee) as.setPrivateKey(alea.privee); else as.generateKeys();
  const asPub = as.getPublicKey();
  const secret = as.computeSecret(uaPub);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", secret, auth, Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub]), 32));
  const sel = alea && alea.sel ? alea.sel : crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, sel, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, sel, Buffer.from("Content-Encoding: nonce\0"), 12));
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const chiffre = Buffer.concat([c.update(Buffer.concat([Buffer.from(texte, "utf8"), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([sel, rs, Buffer.from([asPub.length]), asPub, chiffre]);
}

/* L'inverse, côté téléphone : sert uniquement au banc d'essai. */
export function dechiffrer(corps, uaPrivee, auth) {
  const sel = corps.subarray(0, 16), idlen = corps[20], asPub = corps.subarray(21, 21 + idlen), chiffre = corps.subarray(21 + idlen);
  const ua = crypto.createECDH("prime256v1"); ua.setPrivateKey(uaPrivee);
  const secret = ua.computeSecret(asPub);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", secret, auth, Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPub]), 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, sel, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, sel, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(chiffre.subarray(chiffre.length - 16));
  const clair = Buffer.concat([d.update(chiffre.subarray(0, chiffre.length - 16)), d.final()]);
  return clair.subarray(0, clair.lastIndexOf(2)).toString("utf8");
}

/* Envoie une notification. Renvoie le code HTTP du service (201 = remis ;
   404 / 410 = abonnement mort, à effacer). */
export async function envoyer(abonnement, message, cles, opt) {
  opt = opt || {};
  const corps = chiffrer(JSON.stringify(message), abonnement);
  const r = await (opt.fetch || fetch)(abonnement.endpoint, {
    method:"POST",
    headers:{
      Authorization:"vapid t=" + jetonVapid(abonnement.endpoint, cles, opt.sujet || SUJET) + ", k=" + cles.publique,
      "Content-Encoding":"aes128gcm", "Content-Type":"application/octet-stream",
      TTL:String(opt.ttl || 4 * 3600), Urgency:opt.urgence || "normal",
      ...(message.tag ? { Topic:String(message.tag).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {})
    },
    body:corps
  });
  /* En cas de refus, la raison donnée par le service (Apple : {"reason":"…"}) pour le journal. */
  envoyer.raison = r.status >= 400 ? await r.text().catch(() => "") : "";
  return r.status;
}
