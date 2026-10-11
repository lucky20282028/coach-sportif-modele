# Profil — À REMPLIR (prénom)

*Référence commune à toutes les tâches du coach et au coach sur iPhone. Écrit pendant
l'installation (entretien avec Claude), mis à jour quand l'athlète le demande.
Ce fichier est privé : il ne quitte pas ce dépôt.*

## Identité

- Prénom : À REMPLIR
- Âge, taille, poids (s'il veut les donner) : À REMPLIR
- Repères de forme connus (VO₂max, records, FC max mesurée) : À REMPLIR

## Ses sports

| Sport | Rythme habituel | Statut |
|---|---|---|
| À REMPLIR | | |

**Semaine cible : À REMPLIR** (ex. course 2× · renforcement 1× · football le mardi soir).
Jours sans sport : À REMPLIR. Disponibilités (créneaux, matin ou soir) : À REMPLIR.

> **« Repos » signifie ne rien faire.** Une séance de renforcement est une séance.
> **Une journée peut porter plusieurs séances** : chacune est une entrée distincte du
> plan, avec la même date.

## Santé

À REMPLIR : blessures passées et actuelles, zones fragiles (ce sont les zones du check-in
de la page), avis médicaux en cours, ce qui est interdit ou à surveiller.
- Douleur, blessure ou fatigue anormale → **conseiller de consulter**, ne pas ajuster
  le plan comme si c'était une solution.

## Objectifs

1. À REMPLIR (le plus important d'abord)

Courses prévues (avec dossard) : À REMPLIR ou aucune. Elles s'inscrivent aussi dans
`meta.caps` du plan avec `"k":"course"`.

## Repères d'entraînement

- Zones de fréquence cardiaque (de sa montre ou mesurées) : À REMPLIR
- Allures connues (facile, sortie longue, seuil, VMA) : À REMPLIR — elles sont aussi
  dans `reglages/athlete.json` (« allures »), en secondes par km
- **Pilote les sorties faciles à la fréquence cardiaque, pas à l'allure.**
- Il raisonne en kilomètres ou en minutes : À REMPLIR

## Où il en est (date de l'installation)

À REMPLIR : volume des dernières semaines, régularité, forme, ce que l'ancien coach (s'il
y en avait un) avait mis en place et qui est gardé.

## ⚠️ QUI A LE DROIT D'ÉCRIRE LE PLAN

*Le plan vit dans un seul fichier, `app/entrees/plan.txt` : il n'y a pas « le plus
récent des documents », il y a LE fichier. L'historique est dans git.*

| Tâche | Ce qu'elle a le droit de faire au plan |
|---|---|
| `point-running-hebdo` (dimanche 17h54) | **Seule à décider la structure du programme.** Elle réécrit `plan.txt` pour les **4 semaines** qui commencent : la première en détail, les 3 suivantes esquissées (`"prov":true`) |
| `point-du-matin` (7h30) | **Uniquement la journée du jour**, et seulement pour l'alléger. Elle ne change QUE les entrées d'aujourd'hui |
| `debrief-quotidien` (20h30) | **Uniquement le réalisé du jour** (champ `x`), plus un allègement des jours suivants si un signal l'impose. Jamais une refonte de la semaine |
| Conversation (iPhone ou ordinateur) | Comme le débrief. Si une refonte semble nécessaire, **le dire à l'athlète et attendre dimanche** |

**Avant toute modification : `git pull`, relire `plan.txt`, ne changer que ses
propres entrées.** On ne réécrit jamais une semaine de mémoire. Les semaines esquissées
(`"prov":true`) ne se touchent que le dimanche.

**Courses à dossard : « après un évènement, prévoir toujours
un programme adapté à la course ».** Une course annoncée structure le programme : affûtage
la semaine de la course, la course dans le plan, puis une récupération proportionnée à la
distance avant de repartir vers l'objectif suivant.

## Nommage des séances — convention à respecter partout

Le titre porte **le type de séance, puis le volume, puis la distance**, avec des mots que
tout le monde comprend (pas de jargon comme « Aérobie faible »). L'athlète le
réutilise tel quel comme titre d'activité Strava, et le lit sur sa montre. Le sport
(course à pied, vélo, natation…) est affiché à part par la page, avec son icône.
Format : `<Type> <volume> · <distance>`. Trois types par discipline (facile / soutenu / intense).

| Discipline | Type | Exemple |
|---|---|---|
| Course à pied | Endurance fondamentale | `Endurance fondamentale 55 min · 10 km` |
| | + lignes droites | `Endurance fondamentale + 5 lignes droites 45 min · 9,8 km` |
| | Sortie longue *(endurance, plus longue)* | `Sortie longue 1h15 · 13,4 km` |
| | Récupération *(très facile)* | `Récupération 30 min · 5,5 km` |
| | Seuil *(allure tempo)* | `Seuil 3×8 min @ 4:35 · 10 km` |
| | Fractionné *(VMA)* | `Fractionné 8×400 @ 4:00 · 8 km` |
| | Compétition | `Compétition · 10 km de Paris` |
| | Test de contrôle | `Test contrôle 40 min FC 150` |
| Vélo | Endurance (Z2) | `Vélo endurance Z2 1h30 · 35 km` |
| | Sweet spot / Seuil (travail au FTP) | `Vélo seuil 3×10 min · 30 km` |
| | Fractionné (PMA) | `Vélo fractionné PMA 6×3 min · 25 km` |
| Natation | Endurance (aérobie continu) | `Natation endurance 30 min · 1 200 m` |
| | Technique (éducatifs) | `Natation technique 30 min` |
| | Fractionné (séries rapides) | `Natation fractionné 10×100 m · 1 500 m` |
| Football | Match ou entraînement | `Football · 1 h` |
| Renforcement | Gainage | `Gainage circuit · 3 tours` |

Les anciens titres (« Aérobie faible », « Tempo », « LD ») s'affichent traduits sur la page ;
n'en écris plus.
Séparateur « · » entre les blocs. Distance calculée sur la borne haute de l'allure.
**Aucun champ description sur les séances Garmin** : tout tient dans le titre.

## Alimentation

À REMPLIR : habitudes, contraintes, objectif. **Jamais de déficit agressif ni de restriction.**

## Matériel

À REMPLIR : montre, capteur de nuit, applications. Les sources réellement branchées sont
dans `reglages/athlete.json` (« sources »).

## Préférences

À REMPLIR : ton (direct, encourageant…), tutoiement ou vouvoiement, longueur des messages,
ce qu'il ne veut pas entendre.

## Système

| Élément | Où |
|---|---|
| Ce profil | `profil.md` — source de vérité |
| Réglages chiffrés | `reglages/athlete.json` (cibles, FC de référence, allures, sources, check-in) |
| Installation | `reglages/installation.json` (nom de la page, horloge, routine Réagir — aucun secret) |
| Le plan | `app/entrees/plan.txt` |
| Points du matin, débriefs, bilans | `journal/AAAA-MM.md` |
| Ses notes | `carnet.md` (ce qu'il écrit prime sur les capteurs) |
| Synthèse calculée | `donnees/synthese.json` |
| État de l'installation | `etat/diagnostic.json` (workflow « Diagnostic ») |
| Échéances (jetons à renouveler) | `etat/expirations.json` |
