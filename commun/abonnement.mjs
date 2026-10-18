/* Abonnement aux notifications envoyé par la page : validé avant d'entrer dans le KV.
   Seuls les services de notification connus sont acceptés comme destination. */
const HOTES = /^(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
const HEURES = [17, 18, 19, 20, 21];
const b64 = /^[A-Za-z0-9_-]+={0,2}$/;

export function validerAbonnement(b) {
  const a = b && b.abonnement;
  if (!a || typeof a.endpoint !== "string" || a.endpoint.length > 1000) return { ok:false, err:"abonnement absent" };
  let u; try { u = new URL(a.endpoint); } catch (e) { return { ok:false, err:"adresse invalide" }; }
  if (u.protocol !== "https:" || !HOTES.test(u.hostname)) return { ok:false, err:"service de notification inconnu" };
  const k = a.keys || {};
  if (typeof k.p256dh !== "string" || typeof k.auth !== "string" || !b64.test(k.p256dh) || !b64.test(k.auth) || k.p256dh.length > 120 || k.auth.length > 40)
    return { ok:false, err:"clés invalides" };
  const p = b.prefs && typeof b.prefs === "object" ? b.prefs : {};
  const bo = (v, d) => typeof v === "boolean" ? v : d;
  return { ok:true, abonnement:{ endpoint:a.endpoint, keys:{ p256dh:k.p256dh, auth:k.auth } },
           prefs:{ coach:bo(p.coach, true), seance:bo(p.seance, true), heure:HEURES.includes(p.heure) ? p.heure : 19, coucher:bo(p.coucher, true), modif:bo(p.modif, true), montres:bo(p.montres, true) } };
}
