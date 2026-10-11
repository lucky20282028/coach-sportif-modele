/* Notifications de la page (route /api/abonnement).
   POST {abonnement, prefs} : enregistre ou met à jour l'abonnement de cet iPhone.
   DELETE {endpoint}        : le retire.
   Le KV « push:<empreinte de l'adresse> » est lu par collecte/notifier.mjs. */
import { autorise, sha256hex } from "../../commun/retour.mjs";
import { validerAbonnement } from "../../commun/abonnement.mjs";

const rep = (code, corps) => new Response(JSON.stringify(corps), {
  status:code, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" } });

export async function onRequest({ request, env }) {
  if (!(await autorise(request, env.EMPREINTE))) return rep(401, { ok:false });
  let b = null;
  try { b = await request.json(); } catch (e) { return rep(400, { ok:false, err:"corps illisible" }); }
  if (request.method === "POST") {
    const v = validerAbonnement(b);
    if (!v.ok) return rep(400, { ok:false, err:v.err });
    const id = (await sha256hex(v.abonnement.endpoint)).slice(0, 16);
    await env.RETOURS.put("push:" + id, JSON.stringify({ abonnement:v.abonnement, prefs:v.prefs, maj:new Date().toISOString() }));
    return rep(200, { ok:true, id, prefs:v.prefs });
  }
  if (request.method === "DELETE") {
    if (!b || typeof b.endpoint !== "string") return rep(400, { ok:false });
    await env.RETOURS.delete("push:" + (await sha256hex(b.endpoint)).slice(0, 16));
    return rep(200, { ok:true });
  }
  return rep(405, { ok:false });
}
