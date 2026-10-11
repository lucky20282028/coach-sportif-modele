/* Données d'Apple Santé envoyées par l'iPhone (POST /api/sante) : un raccourci
   quotidien ou l'app « Health Auto Export ». En-tête « X-Coach-Sante » : le jeton
   Santé, affiché sur la page (Réglages › Montres et données › Apple Santé). Il ne
   permet QUE d'envoyer ces données. Validées et normalisées (commun/sante.mjs),
   gardées dans le stockage KV ; la collecte les recopie dans donnees/sante/. */
import { lireEnvoi } from "../../commun/sante.mjs";
import { sha256hex } from "../../commun/retour.mjs";

const rep = (code, corps) => new Response(JSON.stringify(corps), {
  status:code, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" } });

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return rep(405, { ok:false });
  const jeton = request.headers.get("x-coach-sante") || "";
  if (!env.EMPREINTE_SANTE || !jeton || (await sha256hex(jeton)) !== env.EMPREINTE_SANTE) return rep(401, { ok:false, err:"jeton Santé refusé" });
  const brut = await request.text();
  if (brut.length > 200000) return rep(413, { ok:false, err:"trop gros : envoie un jour à la fois" });
  let b; try { b = JSON.parse(brut); } catch (e) { return rep(400, { ok:false, err:"json illisible" }); }
  const v = lireEnvoi(b);
  if (!v.ok) return rep(400, v);
  const recu = new Date().toISOString();
  const alea = [...crypto.getRandomValues(new Uint8Array(3))].map(x => x.toString(16).padStart(2, "0")).join("");
  await env.RETOURS.put("sante:" + recu + "-" + alea, JSON.stringify({ recu, jours:v.jours }), { expirationTtl:45 * 86400 });
  return rep(200, { ok:true, jours:v.jours.map(j => j.date) });
}
