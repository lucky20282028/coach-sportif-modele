/* Retours de la page iPhone (fonction Cloudflare Pages, route /api/retour).
   POST : enregistre un retour dans le stockage KV « RETOURS ».
   GET  : renvoie ceux qui n'ont pas encore été recopiés dans le carnet, pour
          que la page les affiche tout de suite, sur n'importe quel appareil.
   La collecte GitHub les recopie dans carnet.md puis les efface d'ici.
   EMPREINTE (secret du projet) = SHA-256 du jeton que la page dérive de sa clé. */
import { valider, autorise } from "../../commun/retour.mjs";
import { lancerWorkflow, installe } from "../../commun/github.mjs";

const rep = (code, corps) => new Response(JSON.stringify(corps), {
  status:code, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" } });

/* Ce qui mérite que le coach relise tout de suite : un message, une alerte, une séance manquée. */
const compteTout = r => r.type === "note" ||
  (r.type === "checkin" && (r.alerte === "douleur" || r.alerte === "raideur" || (r.forme && r.forme <= 2) || r.jambes === "lourdes")) ||
  (r.type === "seance" && (r.douleur === "légère" || r.douleur === "forte" || r.fait === "pas fait" || (r.sensation && r.sensation <= 4)));

export async function onRequest({ request, env }) {
  if (!(await autorise(request, env.EMPREINTE))) return rep(401, { ok:false });
  const kv = env.RETOURS;
  if (request.method === "GET") {
    const { keys } = await kv.list({ prefix:"r:" });
    const out = [];
    for (const k of keys.slice(-60)) {
      const v = await kv.get(k.name, "json");
      if (v && v.type !== "test") out.push(v);
    }
    return rep(200, { ok:true, retours:out });
  }
  if (request.method !== "POST") return rep(405, { ok:false });
  const brut = await request.text();
  if (brut.length > 8000) return rep(413, { ok:false });
  let b; try { b = JSON.parse(brut); } catch (e) { return rep(400, { ok:false, err:"json" }); }
  const v = valider(b);
  if (!v.ok) return rep(400, { ok:false, err:v.err });
  const recu = new Date().toISOString();
  const alea = [...crypto.getRandomValues(new Uint8Array(3))].map(x => x.toString(16).padStart(2, "0")).join("");
  await kv.put("r:" + recu + "-" + alea, JSON.stringify(Object.assign({ recu }, v.r)));
  /* Un message au coach (ou un signal d'alerte) lance aussitôt une collecte : elle le
     recopie au carnet et réveille le coach, qui réécrit son mot (collecte/reagir.mjs). */
  /* KV garde en cache une lecture jusqu'à 60 s : deux messages rapprochés peuvent lancer
     deux collectes. C'est sans risque (elles passent l'une après l'autre, repartent du
     dernier main, et le réveil du coach ne part qu'une fois). */
  if (compteTout(v.r) && installe(env)) {
    const der = await kv.get("etat:collecte-note", "json");
    if (!der || Date.now() - der.t > 60 * 1000) {
      try {
        if ((await lancerWorkflow(env, "collecte.yml", { raison:"note" })) === 204)
          await kv.put("etat:collecte-note", JSON.stringify({ t:Date.now() }), { expirationTtl:300 });
      } catch (e) {}
    }
  }
  return rep(200, { ok:true, recu });
}
