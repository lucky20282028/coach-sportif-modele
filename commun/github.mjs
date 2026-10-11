/* Lancer un workflow GitHub depuis une fonction Cloudflare.
   env.DEPOT (« propriétaire/dépôt », écrit par collecte/cloudflare.mjs preparer) et
   env.JETON_GITHUB (secret : Actions en écriture sur ce seul dépôt).
   Renvoie le code HTTP de GitHub (204 = lancé), 0 si l'installation est incomplète. */
export async function lancerWorkflow(env, workflow, inputs, agent) {
  if (!env.JETON_GITHUB || !/^[\w.-]+\/[\w.-]+$/.test(env.DEPOT || "")) return 0;
  const r = await fetch("https://api.github.com/repos/" + env.DEPOT + "/actions/workflows/" + workflow + "/dispatches", {
    method:"POST",
    headers:{ "Authorization":"Bearer " + env.JETON_GITHUB, "Accept":"application/vnd.github+json",
              "X-GitHub-Api-Version":"2022-11-28", "User-Agent":agent || "coach-page" },
    body:JSON.stringify(inputs ? { ref:"main", inputs } : { ref:"main" })
  });
  return r.status;
}
export const installe = env => !!env.JETON_GITHUB && /^[\w.-]+\/[\w.-]+$/.test(env.DEPOT || "");
