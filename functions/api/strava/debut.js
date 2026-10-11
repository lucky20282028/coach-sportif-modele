/* « Connecter Strava » (POST /api/strava/debut, depuis la page) : prépare
   l'autorisation et renvoie l'adresse Strava où l'envoyer. Le « state » à usage
   unique empêche qu'une autre personne branche son compte à la place de l'athlète. */
import { autorise } from "../../../commun/retour.mjs";

const rep = (code, corps) => new Response(JSON.stringify(corps), {
  status:code, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" } });

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return rep(405, { ok:false });
  if (!(await autorise(request, env.EMPREINTE))) return rep(401, { ok:false });
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) return rep(501, { ok:false, err:"pas-configure" });
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, "0")).join("");
  await env.RETOURS.put("sstate:" + state, "1", { expirationTtl:900 });
  const retour = new URL("/api/strava/retour", request.url).toString();
  const url = "https://www.strava.com/oauth/mobile/authorize?response_type=code&approval_prompt=auto" +
    "&client_id=" + encodeURIComponent(env.STRAVA_CLIENT_ID) +
    "&scope=" + encodeURIComponent("read,activity:read_all") +
    "&redirect_uri=" + encodeURIComponent(retour) + "&state=" + state;
  return rep(200, { ok:true, url });
}
