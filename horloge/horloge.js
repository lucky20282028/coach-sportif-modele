/* Horloge du coach (Cloudflare Worker, déclencheurs planifiés). Elle ne détient aucun
   secret : à chaque créneau, elle sonne à /api/horloge de SA page (variable PAGE, posée
   au déploiement depuis reglages/installation.json), qui lance le bon workflow GitHub
   avec le jeton qu'elle a déjà. Programme : commun/horloge.mjs. */
export const sonner = (page, f = fetch) => /^https:\/\/[a-z0-9.-]+$/.test(page || "")
  ? f(page + "/api/horloge", { method:"POST" }).then(r => r.status).catch(() => -1)
  : Promise.resolve(0);
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(sonner(env.PAGE)); },
  async fetch() { return new Response("Horloge du coach : rien à voir ici.", { status:200, headers:{ "Content-Type":"text/plain; charset=utf-8" } }); }
};
