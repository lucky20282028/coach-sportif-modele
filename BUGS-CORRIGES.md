# Problèmes déjà rencontrés, et ce qui les empêche de revenir

Chaque ligne est un vrai problème rencontré sur la première installation du coach
(août–octobre 2026). Le modèle arrive avec la correction **et** un garde-fou : un test
qui échoue, une vérification qui bloque, ou le diagnostic qui le signale.

| Problème | Ce qui l'empêche maintenant | Où |
|---|---|---|
| La clé de la page changeait à une publication : le lien de l'écran d'accueil cessait de marcher | La publication refuse une clé dont l'empreinte n'est pas celle de l'installation ; l'installation refuse de la remplacer sans « nouvelle_cle » ; la clé n'est jamais affichée dans un journal | `publier.yml`, `commun/installation.mjs`, `app/build.js` |
| Une clé collée avec un espace ou un retour à la ligne cassait tout sans message clair | La forme de la clé est vérifiée avant usage, avec la consigne pour la recoller | `commun/installation.mjs noter-cle` |
| Un badge ajouté par l'hébergeur masquait les onglets | Politique de sécurité stricte : seul le script de la page, identifié par son empreinte, s'exécute | `app/build.js` (CSP) |
| La nouvelle version était « publiée » mais l'ancienne restait servie | Après chaque publication, la version servie est relue et comparée à celle construite | `publier.yml` (« Vérifier la version servie ») |
| Une donnée en clair dans la page publique (ou un faux positif qui bloquait la publication : « 0,8 », « 49 ») | Contrôle anti-fuite à chaque construction, sur le texte lisible seulement | `app/build.js`, `app/bench.js` |
| L'icône de l'écran d'accueil ne s'affichait pas (l'iPhone ignore le SVG) | Icône PNG | `app/icones/`, `app/build.js` |
| Flou gris sous la barre d'état (iOS 26), bandeau de l'agenda qui clignotait, flèche de semaine bloquée, texte du conseil montre écrasé | Corrigés ; le parcours complet de la page (toutes les vues, deux thèmes) échoue sur une erreur ou un texte cassé | `outils/instantane.mjs`, `app/bench-lot1.js`, `app/bench-v2.js` |
| Couleurs refusées (violet, vert citron) | Test des couleurs | `app/bench-formules.js` |
| Séances au nom incompréhensible (« Aérobie faible ») ; titres vélo renommés « Sortie longue » | Convention de nommage par discipline, traduction des anciens titres, tests | `app/core.js` (`nomSeance`), `app/bench-formules.js`, `profil.md` |
| Deux séances du même jour fusionnées ; « repos + renforcement » | Une entrée par séance, même date ; règle écrite dans le profil et les consignes | `COACH.md`, `profil.md` |
| La course inscrite au programme apparaissait aussi en rendez-vous | Dédoublonnage | `app/app.js`, `app/bench-lot1.js` |
| Les séances de gainage arrivaient sur la montre en blocs muets de 90 s | Circuit guidé exercice par exercice (`creer_gainage`), jamais `create_strength_workout` | `collecte/garmin.py`, `app/bench-formules.js` |
| Un message envoyé depuis la page était compté deux fois | Signature de chaque retour, doublons écartés | `commun/retour.mjs`, `commun/banc-retour.mjs` |
| La reconnexion Withings échouait si la page de retour était rechargée | Un second passage redit le succès ; idem pour Strava | `functions/api/*/retour.js`, `commun/banc-fonctions.mjs` |
| La chaîne de jetons Withings se cassait | Jeton chiffré gardé dans le dépôt, repli, bouton « Reconnecter » et notification après deux échecs | `collecte/withings.py`, `collecte/notifs.mjs` |
| Les jetons Garmin expiraient et ne se refaisaient que depuis un ordinateur | Reconnexion automatique avec les identifiants (secrets), jetons chiffrés ; rappel un mois avant chaque expiration | `collecte/garmin.py`, `etat/expirations.json`, `collecte/notifs.mjs` |
| Les tâches planifiées de GitHub partaient avec des heures de retard (collecte de 6h45 vers 13 h) | Horloge Cloudflare à l'heure, une seule fois par créneau | `horloge/`, `commun/horloge.mjs`, `horloge/banc-horloge.mjs` |
| L'horloge ne se déployait pas : permission « Workers Scripts » manquante, puis sous-domaine workers.dev absent | Permission listée dans le guide ; sous-domaine créé automatiquement ; le diagnostic vérifie les déclencheurs | `INSTALLER.md`, `collecte/cloudflare.mjs`, `outils/diagnostic.mjs` |
| La routine de réaction poussait sur une branche que personne ne fusionnait | Fusion automatique dans main, page régénérée et publiée | `.github/workflows/fusion-coach.yml` |
| Une routine créée par Claude n'apparaissait pas dans l'interface | La routine « Coach · Réagir » est créée par la personne elle-même, Claude ne fait que noter son identifiant | `INSTALLER.md`, étape 8 |
| « Actualiser » ne réveillait pas le coach quand rien de neuf n'était détecté | Actualiser réveille toujours (mêmes garde-fous) | `collecte/reagir.mjs`, `collecte/banc-reagir.mjs` |
| Le coach attendait un bilan du dimanche déjà fait à la main : un message restait sans réponse | Un bilan déjà fait n'est plus attendu | `collecte/reagir.mjs` (`bilanFait`), `collecte/banc-reagir.mjs` |
| Le coach réveillé n'avait pas le droit d'ajouter une séance demandée | Il peut l'ajouter si l'athlète la demande et que le feu n'est pas rouge | `taches/reagir.md` |
| Deux collectes lancées ensemble : la seconde repartait d'une version périmée et échouait | Toutes les tâches repartent du dernier état du dépôt ; fusions tolérantes, poussées réessayées | `.github/workflows/*.yml` (`ref: main`), `collecte.yml` |
| Un échec de publication restait illisible depuis Claude | La fin du journal devient une annotation lisible par l'API ; diagnostic dans `etat/diagnostic.json` | workflows, `outils/diagnostic.mjs` |
| D'anciennes consignes de tâches contenaient la clé de la page en clair | Aucune consigne ne contient de secret ; l'installation ne les manipule jamais | `taches/`, `INSTALLER.md` |
| Une source absente (pas de lieu pour la météo, pas de Garmin) faisait échouer la collecte | Chaque source est facultative et seulement collectée si l'athlète l'utilise | `collecte.yml`, `collecte/meteo.py`, `commun/athlete.cjs` |
| La même séance vue par deux sources (Garmin et Strava) comptait deux fois | Dédoublonnage à 5 minutes près, même sport ; Garmin + Strava « api » refusé dans les réglages | `app/depuis-plan.js`, `commun/athlete.cjs`, `app/bench-depuis-plan.js` |
