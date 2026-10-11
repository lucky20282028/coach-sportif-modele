/* Bouton « Actualiser » de la page (route /api/actualiser) : demande à GitHub
   une collecte immédiate (montres, retours) suivie de la régénération et de la
   publication de la page. JETON_GITHUB et DEPOT : variables du projet Pages
   (commun/github.mjs). Au plus une demande toutes les 5 minutes. */
import { autorise } from "../../commun/retour.mjs";
import { lancerWorkflow, installe } from "../../commun/github.mjs";

const rep = (code, corps) => new Response(JSON.stringify(corps), {
  status:code, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" } });

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return rep(405, { ok:false });
  if (!(await autorise(request, env.EMPREINTE))) return rep(401, { ok:false });
  if (!installe(env)) return rep(501, { ok:false, err:"pas-active" });
  const der = await env.RETOURS.get("etat:actualiser", "json");
  if (der && Date.now() - der.t < 5 * 60 * 1000) return rep(429, { ok:false, err:"trop-tot", depuis:der.t });
  const s = await lancerWorkflow(env, "collecte.yml", { raison:"actualiser" });   /* le coach réécrit son mot s'il y a du neuf */
  if (s !== 204) return rep(502, { ok:false, err:"github-" + s });
  await env.RETOURS.put("etat:actualiser", JSON.stringify({ t:Date.now() }), { expirationTtl:600 });
  return rep(200, { ok:true, t:Date.now() });
}
