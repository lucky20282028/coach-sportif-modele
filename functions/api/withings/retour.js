/* Retour de Withings après autorisation (GET /api/withings/retour?code&state).
   Échange le code tout de suite (il ne vit que 30 secondes), garde le jeton de
   renouvellement dans le stockage KV ; la collecte GitHub le reprend, puis
   l'efface. Si le bouton Actualiser est activé, la collecte part aussitôt. */
import { lancerWorkflow } from "../../../commun/github.mjs";
const page = (titre, texte, ok) => new Response(
  '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<meta name="robots" content="noindex"><title>Withings</title></head>' +
  '<body style="margin:0;background:#0A0C0F;color:#fff;font:400 16px/1.55 -apple-system,system-ui,sans-serif">' +
  '<div style="max-width:420px;margin:22vh auto;padding:0 24px;text-align:center">' +
  '<div style="font-size:40px;margin-bottom:10px">' + (ok ? "✓" : "!") + '</div>' +
  '<div style="font-size:21px;font-weight:800;margin-bottom:8px">' + titre + '</div>' +
  '<div style="color:#B4BCC6">' + texte + '</div></div></body></html>',
  { status:ok ? 200 : 400, headers:{ "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store",
    "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'", "Referrer-Policy":"no-referrer" } });

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const code = u.searchParams.get("code"), state = u.searchParams.get("state") || "";
  /* Safari recharge parfois cette page en revenant à l'écran d'accueil : un
     second passage après une reconnexion réussie doit le redire, pas crier à l'erreur. */
  if (/^[0-9a-f]{32}$/.test(state) && (await env.RETOURS.get("wstate-ok:" + state)))
    return page("Withings est reconnecté", "C'est déjà fait : la collecte a été lancée. Tu peux fermer cette page.", true);
  if (!code || !/^[0-9a-f]{32}$/.test(state) || !(await env.RETOURS.get("wstate:" + state)))
    return page("Lien expiré", "Repars du bouton « Reconnecter Withings » dans les réglages de ta page.", false);
  await env.RETOURS.delete("wstate:" + state);
  const r = await fetch("https://wbsapi.withings.net/v2/oauth2", {
    method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" },
    body:new URLSearchParams({ action:"requesttoken", grant_type:"authorization_code", client_id:env.WITHINGS_CLIENT_ID,
      client_secret:env.WITHINGS_CLIENT_SECRET, code, redirect_uri:u.origin + u.pathname })
  });
  const j = await r.json().catch(() => ({}));
  if (j.status !== 0 || !j.body || !j.body.refresh_token)
    return page("Withings a refusé", "Code " + (j.status ?? r.status) + ". Réessaie depuis les réglages ; si ça recommence, vérifie l'adresse de redirection dans ton application Withings.", false);
  await env.RETOURS.put("withings:neuf", JSON.stringify({ refresh_token:j.body.refresh_token, t:Date.now() }));
  await env.RETOURS.put("wstate-ok:" + state, "1", { expirationTtl:3600 });
  let suite = "La prochaine collecte reprendra tes nuits (vers 6h45 ou 20h15).";
  if ((await lancerWorkflow(env, "collecte.yml")) === 204) suite = "Une collecte vient de partir : tes nuits Withings seront sur la page d'ici 5 minutes.";
  return page("Withings est reconnecté", suite + " Tu peux fermer cette page.", true);
}
