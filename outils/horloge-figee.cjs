/* Fige l'horloge de Node (node --require outils/horloge-figee.cjs) à FIGE (ISO), qui
   avance ensuite normalement. Sert aux instantanés : deux générations de la page à la
   même « heure » doivent donner exactement les mêmes données. */
const FIGE = process.env.FIGE;
if (FIGE) {
  const Vrai = Date, decalage = new Vrai(FIGE).getTime() - Vrai.now();
  class Faux extends Vrai {
    constructor(...a) { if (a.length) super(...a); else super(Vrai.now() + decalage); }
    static now() { return Vrai.now() + decalage; }
  }
  globalThis.Date = Faux;
}
