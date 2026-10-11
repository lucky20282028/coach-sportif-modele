/* « Envoyer une notification de test » (route /api/notif-test) : demande à GitHub
   le workflow notifier.yml en mode test. Au plus une demande par minute. */
import { autorise } from "../../commun/retour.mjs";
import { lancerWorkflow, installe } from "../../commun/github.mjs";

const rep = (code, corps) => new Response(JSON.stringify(corps), {
  status:code, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" } });

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return rep(405, { ok:false });
  if (!(await autorise(request, env.EMPREINTE))) return rep(401, { ok:false });
  if (!installe(env)) return rep(501, { ok:false, err:"pas-active" });
  if (await env.RETOURS.get("etat:notif-test")) return rep(429, { ok:false, err:"trop-tot" });
  const s = await lancerWorkflow(env, "notifier.yml", { type:"test" });
  if (s !== 204) return rep(502, { ok:false, err:"github-" + s });
  await env.RETOURS.put("etat:notif-test", "1", { expirationTtl:60 });
  return rep(200, { ok:true });
}
