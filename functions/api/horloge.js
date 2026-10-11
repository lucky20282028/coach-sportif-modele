/* Horloge du coach (route /api/horloge), appelée par le Worker « coach-horloge » à
   chaque créneau. Sans secret à transmettre : la fonction ne lance que ce que le
   programme prévoit à cette heure-ci, une seule fois par créneau. Un appel à une autre
   heure, ou répété, ne fait rien. GitHub retarde ses propres tâches planifiées de
   plusieurs heures : c'est cette horloge qui tient l'heure. */
import { creneau } from "../../commun/horloge.mjs";
import { lancerWorkflow, installe } from "../../commun/github.mjs";

const rep = (code, corps) => new Response(JSON.stringify(corps), {
  status:code, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" } });

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return rep(405, { ok:false });
  const c = creneau(new Date());
  if (!c) return rep(200, { ok:true, rien:"pas l'heure" });
  if (await env.RETOURS.get(c.cle)) return rep(200, { ok:true, rien:"déjà lancé" });
  if (!installe(env)) return rep(501, { ok:false, err:"pas-active" });
  await env.RETOURS.put(c.cle, "1", { expirationTtl:86400 });
  const s = await lancerWorkflow(env, c.p.workflow, c.p.inputs, "coach-horloge");
  if (s !== 204) { await env.RETOURS.delete(c.cle); return rep(502, { ok:false, err:"github-" + s }); }
  return rep(200, { ok:true, lance:c.p.workflow });
}
