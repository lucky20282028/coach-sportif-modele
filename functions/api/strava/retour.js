/* Retour de Strava après autorisation (GET /api/strava/retour?code&state&scope).
   Échange le code tout de suite, garde le jeton de renouvellement dans le stockage
   KV ; la collecte GitHub le reprend (collecte/jeton-kv.mjs), le chiffre dans le
   dépôt, puis l'efface d'ici. La collecte part aussitôt. */
import { lancerWorkflow } from "../../../commun/github.mjs";
const page = (titre, texte, ok) => new Response(
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<meta name="robots" content="noindex"><title>Strava</title></head>' +
  '<body style="margin:0;background:#0A0C0F;color:#fff;font:400 16px/1.55 -apple-system,system-ui,sans-serif">' +
  '<div style="max-width:420px;margin:22vh auto;padding:0 24px;text-align:center">' +
  '<div style="font-size:40px;margin-bottom:10px">' + (ok ? "✓" : "!") + '</div>' +
  '<div style="font-size:21px;font-weight:800;margin-bottom:8px">' + titre + '</div>' +
  '<div style="color:#B4BCC6">' + texte + '</div></div></body></html>',
  { status:ok ? 200 : 400, headers:{ "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store",
    "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'", "Referrer-Policy":"no-referrer" } });

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const code = u.searchParams.get("code"), state = u.searchParams.get("state") || "", scope = u.searchParams.get("scope") || "";
  /* Safari recharge parfois cette page : un second passage après une connexion réussie le redit. */
  if (/^[0-9a-f]{32}$/.test(state) && (await env.RETOURS.get("sstate-ok:" + state)))
    return page("Strava est connecté", "C'est déjà fait : la collecte a été lancée. Tu peux fermer cette page.", true);
  if (u.searchParams.get("error")) return page("Connexion annulée", "Strava n'a rien autorisé. Repars du bouton « Connecter Strava » dans les réglages de ta page.", false);
  if (!code || !/^[0-9a-f]{32}$/.test(state) || !(await env.RETOURS.get("sstate:" + state)))
    return page("Lien expiré", "Repars du bouton « Connecter Strava » dans les réglages de ta page.", false);
  /* Sans « activity:read_all », la collecte ne verrait pas les séances privées. */
  if (!/activity:read_all/.test(scope))
    return page("Autorisation incomplète", "Coche bien « Voir les données de vos activités », y compris privées, puis recommence depuis les réglages.", false);
  await env.RETOURS.delete("sstate:" + state);
  const r = await fetch("https://www.strava.com/oauth/token", {
    method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" },
    body:new URLSearchParams({ client_id:env.STRAVA_CLIENT_ID, client_secret:env.STRAVA_CLIENT_SECRET, code, grant_type:"authorization_code" })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token)
    return page("Strava a refusé", "Code " + r.status + ". Réessaie depuis les réglages ; si ça recommence, vérifie le « domaine de rappel » de ton application Strava.", false);
  await env.RETOURS.put("strava:neuf", JSON.stringify({ refresh_token:j.refresh_token, t:Date.now() }));
  await env.RETOURS.put("sstate-ok:" + state, "1", { expirationTtl:3600 });
  let suite = "La prochaine collecte reprendra tes séances.";
  if ((await lancerWorkflow(env, "collecte.yml")) === 204) suite = "Une collecte vient de partir : tes séances Strava seront sur la page d'ici 5 minutes.";
  return page("Strava est connecté", suite + " Tu peux fermer cette page.", true);
}
