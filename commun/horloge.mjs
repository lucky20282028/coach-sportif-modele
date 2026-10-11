/* Le programme de l'horloge du coach, partagé par le Worker Cloudflare (qui sonne)
   et la fonction /api/horloge (qui lance le workflow GitHub). Heures UTC, comme les
   crons ; les fenêtres d'envoi sont recalculées à l'heure de Paris par notifs.mjs. */
export const PROGRAMME = [
  { cron:"45 4 * * *",     h:[4],                          m:45, workflow:"collecte.yml", inputs:{} },   /* 6h45 l'été, 5h45 l'hiver */
  { cron:"15 18 * * *",    h:[18],                         m:15, workflow:"collecte.yml", inputs:{} },   /* 20h15 / 19h15 */
  { cron:"55 14-21 * * *", h:[14, 15, 16, 17, 18, 19, 20, 21], m:55, workflow:"notifier.yml", inputs:{ type:"horaire" } }
];
/* Le créneau de cet instant (à 10 minutes près), ou null. */
export function creneau(instant) {
  const min = instant.getUTCHours() * 60 + instant.getUTCMinutes();
  for (const p of PROGRAMME) for (const h of p.h) {
    const c = h * 60 + p.m;
    if (Math.abs(min - c) <= 10) return { p, cle:"horloge:" + instant.toISOString().slice(0, 10) + ":" + String(h).padStart(2, "0") + String(p.m).padStart(2, "0") };
  }
  return null;
}
