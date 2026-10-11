# Régénérer la page mobile

*Procédure appelée par `point-du-matin`, `debrief-quotidien` et `faire-le-point`.
Sans elle, la page reste figée sur la dernière génération et affiche un programme
périmé. C'est arrivé deux fois les 25 et 31 août.*

---

## Depuis le 30 septembre : la tâche n'écrit plus de code

Jusqu'au 30 septembre, chaque tâche devait réécrire `donnees.js` à la main,
soit 200 lignes avec les formules. Trop lourd : les tâches sautaient l'étape,
et la page est restée figée du 21 au 30 septembre. Désormais `depuis-plan.js`
fabrique `donnees.js` à partir de deux fichiers bruts :

| Fichier | Contenu | Règle |
|---|---|---|
| `entrees/plan.txt` | Écrit par les tâches du coach | **Tel quel.** Le script gère les antislashs de Google et les guillemets cités |
| `entrees/jour.json` | `date`, `mot`, `n3`, `serie`, `pred`, `rec`, `faits`, `souci`, `sources` | Un champ non mesuré aujourd'hui est **omis**, jamais inventé |

Le script tient aussi à jour deux fichiers, sans que personne n'y touche :
- `entrees/historique.json` : les séances des plans précédents, pour garder la semaine écoulée visible ;
- `entrees/memoire.json` : les dernières valeurs connues, avec leur date.

Si une valeur est reprise d'un jour précédent, la page **l'affiche en rouge**
(« Les chiffres de forme datent du … »). Même chose s'il n'y a aucun plan pour
la semaine en cours, ou si le plan est illisible.

```bash
cd ~/Coach/app && node depuis-plan.js && node bench-depuis-plan.js && node build.js donnees.js ../site/index.html "$PAGE_KEY"
```

⚠️ **La clé en quatrième argument de `build.js` est obligatoire.** Sans elle,
l'adresse enregistrée sur l'écran d'accueil de l'athlète cesse de fonctionner.
Elle est aussi dans `profil.md`.

### `faits`

`[{"d":"2026-09-29","type":"foot","t":"Football · 1 h","pourquoi":"…","reel":[{"l":"DURÉE","v":"1:00:08"}]}]`
Une activité faite coche la première séance prévue ce jour-là **du même type**.
Si aucune ne correspond, elle est ajoutée comme séance hors plan.

### Formules

Les titres du plan sont courts. La librairie `core.js` en fait des séances
exécutables : `LIB.facile(min)`, `LIB.endurance(km, plafond)`, `LIB.recup(min)`,
`LIB.tempo(n, min)`, `LIB.vma(n, m)`, `LIB.gainage(tours)`, `LIB.foot()`,
`LIB.repos(note)`.

Quand le plan impose une consigne différente de la librairie — un plafond
cardiaque plus bas, un exercice retiré — **le plan gagne**. `seance()` dans `depuis-plan.js`
choisit la formule d'après le titre, puis reprend du plan le titre, la distance, la
plage cardiaque (« FC 120–140 », « plafond 145 ») et les notes. Un sport sans
formule (vélo, tennis, marche) s'affiche sans étapes : rien n'est inventé.

---

## Avant de publier

```bash
cd ~/Coach/app && node bench-formules.js && node bench-v2.js && node bench-depuis-plan.js
```

Les deux doivent finir verts. Ils tournent sur `fixture.js`, un jeu figé au
22 août — **jamais sur les données du jour**, sinon ils virent au rouge chaque
matin sans qu'une ligne de code ait bougé.

`build.js` refuse par ailleurs de produire la page si une valeur des données
apparaît en clair dedans, et retire tous les commentaires du code : ils décrivent
la santé de l'athlète et l'adresse est publique.

---

## Vérifier que c'est parti

```bash
tail -3 ~/Coach/publier.log
```

Une ligne `JJ/MM HH:MM  en ligne` doit apparaître dans la minute. Sinon, voir
`../PUBLIER.md`.
