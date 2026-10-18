# Installer le coach — procédure pour Claude

*Tu es Claude. La personne en face de toi vient de copier ce modèle dans son propre
GitHub et t'a demandé d'installer son coach. Ce document est ta procédure : suis-la dans
l'ordre, une étape après l'autre. La personne n'est pas forcément à l'aise avec
l'informatique : guide-la clic par clic, une seule chose à la fois, et vérifie chaque
étape avant de passer à la suivante.*

## Règles absolues

- **Ne demande jamais un mot de passe, un jeton ou une clé dans la conversation.** Elle
  les colle elle-même dans GitHub (Settings › Secrets). Si elle en colle un ici quand même :
  dis-lui de le révoquer et d'en créer un autre, ne le recopie nulle part.
- **N'écris dans aucun autre outil que ce dépôt** sans sa demande explicite (pas de Drive,
  pas de Notion), et ne touche à aucun dossier de son ordinateur.
- **Ne fabrique aucun chiffre** dans son profil : ce qu'elle ne sait pas reste « inconnu ».
- **La santé est privée** : elle va dans `profil.md` (dépôt privé) et nulle part ailleurs.
- Un workflow GitHub qui échoue : lis son annotation
  (`gh api repos/<dépôt>/check-runs/<job>/annotations`) avant de conclure, puis
  `etat/diagnostic.json`. Ne relance pas trois fois la même chose sans comprendre.
- Utilise l'outil de questions à choix (AskUserQuestion) pour les choix ; texte libre pour
  le reste. Pas plus de 4 questions à la fois.
- Tutoie-la (sauf si elle préfère le vous). Phrases courtes : elle lit sur un téléphone.

Tout au long, tiens une liste de tâches visible (étapes 1 à 9 ci-dessous).

---

## Étape 1 — Vérifier le point de départ

1. `git remote get-url origin` → le dépôt (`propriétaire/nom`). Note-le : c'est `DEPOT`.
   Vérifie qu'il est **privé** (`gh api repos/DEPOT --jq .private` → `true`). S'il est
   public, demande-lui de le passer en privé (Settings › General › Danger Zone ›
   Change visibility) : son profil de santé va y vivre.
2. `reglages/installation.json` existe et contient `empreinte_cle` ? Alors le coach est
   déjà installé : ne refais pas tout. Lance le workflow « Diagnostic », lis
   `etat/diagnostic.json`, et répare seulement ce qui est en rouge (étape 7 et suivantes).
3. Vérifie que les bancs d'essai passent (`cd app && TZ=Europe/Paris node bench.js`) :
   le modèle doit arriver sain.

## Étape 2 — L'entretien (son profil)

Explique en une phrase : « Je vais te poser des questions pour écrire ton profil ; c'est
lui que ton coach relira chaque matin. » Puis, un thème à la fois :

1. **Qui** : prénom, âge, taille et poids (facultatifs), tutoiement ou vouvoiement.
2. **Ses sports** : lesquels, combien de fois par semaine, à quels jours/créneaux (matin
   à jeun, soir, pause de midi), les jours où il ne veut jamais de sport, les sports
   collectifs à heure fixe (match le mardi soir…).
3. **Objectifs**, dans l'ordre d'importance : progresser, perdre du ventre, reprendre un
   sport, une course à dossard (nom, date, distance), la régularité…
4. **Santé** : blessures passées et actuelles, zones fragiles (elles deviennent les zones
   du check-in de la page), avis médical en cours (ce qui est interdit, ce qui attend un
   examen), traitements qui changent la fréquence cardiaque. Rappelle que c'est privé et
   qu'il peut ne pas répondre.
5. **Repères** : allure facile, allure de seuil ou un temps récent sur 5/10 km, FC max ou
   zones de sa montre. S'il ne sait pas : on les déduira de ses séances (étape 6).
6. **Vie** : sommeil habituel, travail (horaires), habitudes qui comptent pour la
   récupération (tabac, alcool : seulement s'il en parle), alimentation (régime,
   contraintes).
7. **Ses appareils** — question à choix multiple :
   - Montre **Garmin** → source `garmin` (sommeil, VFC, charge, séances, et la montre
     reçoit les séances programmées).
   - **Coros, Polar, Suunto, Wahoo, Apple Watch avec l'app Strava, téléphone** → source
     `strava` en mode « api » (ses séances, via son compte Strava).
   - **Apple Watch, Oura, Whoop, Fitbit, ou tout ce qui écrit dans Apple Santé** → source
     `apple_sante` (nuit, FC de repos, VFC, séances, envoyés chaque jour par un raccourci).
   - **Balance ou montre Withings** (ScanWatch…) → source `withings` (sommeil).
   - **Rien** → aucune source : la page vit avec son check-in du matin et les séances
     qu'il déclare. Ça marche très bien.
   Combinaisons utiles : Garmin + Withings ; Apple Santé + Strava ; Strava seul. **Jamais
   Garmin + Strava en « api »** (chaque séance compterait deux fois) : avec Garmin, Strava
   reste « connecteur » (le coach lit les descriptions dans Claude, rien de plus).
   Il a un **iPhone** ? La page s'installe sur l'écran d'accueil comme une app. Sur
   Android, elle marche aussi (Chrome › Ajouter à l'écran d'accueil), sans Apple Santé.
8. **Son coach actuel** (étape 3).

## Étape 3 — Reprendre son coach actuel (s'il en a un)

Demande : « Tu utilises déjà quelque chose pour t'entraîner ? » — n'importe quoi :
un projet Claude, ChatGPT, une app (Runna, Garmin Coach, TrainingPeaks, Nike Run Club,
Strava…), un coach humain, un PDF, un tableur, des notes.

1. **Récupère son contenu**, selon l'outil :
   - Projet Claude : qu'il te colle les instructions du projet et les documents utiles,
     ou qu'il ouvre ce projet et y demande « résume tout ce que tu sais de moi et de mon
     plan », puis te colle la réponse. S'il a des tâches planifiées de cet ancien coach,
     liste-les avec `list_triggers` (outil des tâches planifiées).
   - ChatGPT ou autre assistant : qu'il lui demande « fais-moi la liste de tout ce que tu
     sais de moi et de mon entraînement » et te colle la réponse (mémoire et instructions).
   - App de plan : captures d'écran du plan des prochaines semaines, ou export (PDF, CSV,
     calendrier .ics).
   - Coach humain, PDF, tableur : le fichier joint à la conversation.
   - Un document dans Google Drive ou Notion : par le connecteur s'il est branché, sinon
     le fichier exporté.
2. **Fais l'inventaire** de ce que tu y trouves, rangé en : profil et santé · objectifs
   et courses · plan en cours · historique (séances, records) · règles et consignes ·
   préférences de ton. Montre-lui cet inventaire en court.
3. **Demande ce qu'il garde** (choix multiples, par rubrique ; « tout » est un choix).
   Ce qu'il garde est intégré : profil et santé, objectifs → `profil.md` ; plan en cours →
   traduit dans `app/entrees/plan.txt` (format de COACH.md, section 3, titres selon la
   convention du profil) ; règles et préférences → `profil.md` (Préférences, Repères) ;
   historique → une ligne « *(repris de l'ancien coach)* » datée dans `carnet.md`.
   Ce qu'il ne garde pas n'est écrit nulle part.
4. **Éteins l'ancien** pour éviter deux coachs contradictoires, avec son accord :
   tâches planifiées de l'ancien projet Claude → désactive-les (`update_trigger`,
   `enabled:false`), jamais de suppression sans qu'il le demande ; pour une app, dis-lui
   de couper ses notifications ou son plan.

## Étape 4 — Écrire le profil et les réglages

1. `profil.md` : remplace **chaque** « À REMPLIR » (le modèle les liste). Garde les
   sections communes (« Qui a le droit d'écrire le plan », « Nommage des séances »).
   Écris la santé telle qu'il l'a dite, sans diagnostic de ta part.
2. `reglages/athlete.json` (vérifié par `node commun/athlete.cjs verifier`) :
   - `prenom` ; `sources` (étape 2.7) ; `materiel` : `montre` (« ta Forerunner », « ta
     montre »…), `nuit` et `nuit_seule` (le capteur de nuit s'il y en a un, sinon null),
     `programmer_montre` (true seulement avec Garmin) ;
   - `cible` : séances de course et de renforcement par semaine ;
   - `fc_moteur` : deux fréquences de référence pour mesurer le progrès, la plus haute
     d'abord — la FC de ses sorties d'endurance tenues longtemps (haut de sa zone 2,
     souvent 140–150) et 10 de moins. Inconnues : [150, 140], corrigées après 3 sorties ;
   - `allures` (secondes par km) : `facile`, `endur` (sortie longue), `recup`, `tempo`
     (seuil), `vma`, `rapide` (en dessous, une sortie compte comme rapide). Déduites de ses
     repères ; inconnues : null (valeurs prudentes du code), à régler après ses premières
     sorties ;
   - `plafond_chaleur` : la FC plafond quand il fait chaud le soir (≈ FC haute + 5) ;
   - `objectifs` : `regularite` (texte), `ventre` (si perdre du ventre / tour de taille
     est un objectif, sinon null), `reprise` (reprendre un sport bloqué par un avis
     médical : `sport`, `nom`, `titre`, `motif` = mots qui reconnaissent l'attente
     correspondante dans le plan ; sinon null), chacun avec son `rang` ;
   - `renfo_pourquoi` : pourquoi le renforcement compte pour LUI (une phrase) ;
   - `checkin` : `question` (ses zones fragiles en quelques mots), `rien` (« rien au
     genou ni au dos »), `zones` (2 à 4 zones : `v` en minuscules, `l` libellé, `nom`
     « au genou », et `raideur` s'il y a une consigne particulière) ;
   - `lieu` : la ville où il court, arrondie au dixième de degré (`{ "nom", "lat",
     "lon" }`), pour la météo tant qu'aucune sortie GPS n'est arrivée.
3. `app/entrees/plan.txt` : s'il a gardé le plan de son ancien coach, la semaine en
   cours ; sinon laisse vide (`"entries":[]`) : le premier bilan l'écrira (étape 8).
   Ses courses à dossard dans `meta.caps` avec `"k":"course"`, ses attentes médicales
   avec `"attente":true`.
4. Régénère et teste (COACH.md, section 3), puis un commit : « Profil et réglages ».
   Montre-lui le résumé de son profil en 5 lignes et demande s'il veut corriger.

## Étape 5 — Les comptes et les secrets

Une chose à la fois, il te dit « fait » après chacune.

**a. Cloudflare** (gratuit, héberge sa page) :
1. Créer un compte sur dash.cloudflare.com (adresse e-mail + mot de passe, vérifier l'e-mail).
2. Ouvrir **dash.cloudflare.com/profile/api-tokens** › **Create Token** › en bas,
   **Create Custom Token** › **Get started**.
3. Nom : `coach`. Permissions, une ligne chacune (bouton **+ Add more**), toutes en
   **Account** :
   - `Cloudflare Pages` › `Edit`
   - `Workers KV Storage` › `Edit`
   - `Workers Scripts` › `Edit`
   - `Account Settings` › `Read`
   Account Resources : `Include` › son compte. Pas de date d'expiration.
4. **Continue to summary** › **Create Token** › **Copy**. Ne le colle pas ici.

**b. Le coller dans GitHub** : ouvre-lui le lien
`https://github.com/DEPOT/settings/secrets/actions/new` (remplace DEPOT). Name :
`CLOUDFLARE_API_TOKEN`, Secret : coller, **Add secret**.

**c. Jeton GitHub** (pour que la page puisse lancer une collecte, et pour l'horloge) :
1. `https://github.com/settings/personal-access-tokens/new` (Fine-grained token).
2. Token name `coach` ; Expiration : **1 an** (choisis une date dans 1 an) ;
   Repository access : **Only select repositories** › son dépôt ;
   Permissions › Repository permissions › **Actions** : `Read and write`.
3. **Generate token** › copier › secret `JETON_GITHUB` (même page qu'en b).
4. Note la date d'expiration dans `etat/expirations.json` (entrée `github`, avec ce qu'il
   faudra refaire) : il sera prévenu un mois avant.

**d. Sa source** (seulement celles qu'il a choisies) :
- **Garmin** : secrets `GARMIN_EMAIL` (son adresse Garmin Connect) et
  `GARMIN_MOT_DE_PASSE`. Ils restent dans GitHub pour que le coach se reconnecte seul
  chaque année. Si son compte Garmin a la **double authentification**, la connexion
  depuis GitHub échouera : soit il la désactive le temps de la première collecte, soit il
  fait la connexion depuis un ordinateur (Python : `pip install garminconnect`, puis un
  petit script de connexion qui écrit le dossier `~/.garminconnect`, à archiver en
  `tar -C ~ -czf - .garminconnect | base64` dans le secret `GARMIN_TOKENS`) — guide-le.
- **Strava** : il crée son application sur **strava.com/settings/api** : Application
  Name `Coach`, Category `Training`, Website = l'adresse de sa page (étape 6 ; tu peux
  revenir ici après), **Authorization Callback Domain** = le nom de domaine de sa page,
  **sans https ni /** (ex. `coach-ab12cd34.pages.dev`). Il colle `Client ID` dans le
  secret `STRAVA_CLIENT_ID` et `Client Secret` dans `STRAVA_CLIENT_SECRET`.
- **Withings** : application sur **developer.withings.com** (Public API integration),
  Callback URL = `https://<sa page>/api/withings/retour`. Secret `WITHINGS_ENV` =
  deux lignes : `WITHINGS_CLIENT_ID=…` et `WITHINGS_CLIENT_SECRET=…`.
- **Apple Santé** : rien à ce stade (étape 7).

## Étape 6 — Installation (deux passages)

**Premier passage** :
```bash
gh api -X POST repos/DEPOT/actions/workflows/installation.yml/dispatches -f ref=main
```
Attends la fin (`.../workflows/installation.yml/runs?per_page=1`, au plus 5 minutes),
`git pull`, lis `reglages/installation.json` : l'`adresse` de sa page (https://coach-….pages.dev).
En cas d'échec, lis l'annotation et corrige (souvent : une permission manquante au jeton
Cloudflare, ou un secret mal nommé).

Pour Strava et Withings, c'est le moment de remplir l'adresse et le domaine (étape 5.d).

**La clé de sa page** : dis-lui d'ouvrir l'adresse **sur son iPhone, dans Safari**. Une
page « Ta clé » s'affiche : elle crée la clé dans son téléphone (ni toi ni GitHub ne la
voyez) et le guide en 4 étapes pour la coller dans le secret `PAGE_KEY`. Il te dit
« c'est fait ».

**Second passage** : relance le même workflow. Il note l'empreinte de la clé, publie la
vraie page, déploie l'horloge, lance la première collecte et le diagnostic. Attends 5
minutes, relance le workflow « Diagnostic », lis `etat/diagnostic.json` et règle chaque
point rouge avec lui.

## Étape 7 — Brancher ses sources et poser l'app

1. **Sur l'iPhone, dans Safari**, il rouvre l'adresse : sa page s'affiche (elle retrouve
   sa clé toute seule). **Partager › Sur l'écran d'accueil › Ajouter.** C'est son app.
   Rappelle-lui de garder son lien personnel (étape 4 de la page de la clé) dans ses notes.
2. Dans l'app, bouton **L** (réglages) :
   - **Notifications** › activer (l'iPhone demande l'autorisation ; ça ne marche que depuis
     l'icône de l'écran d'accueil, pas dans Safari) ; heure du rappel. **Toutes les
     notifications du coach passent par là** : le mot du coach (point du matin, débrief,
     programme du dimanche, réponses), la séance pas faite, « au lit », séance modifiée,
     montre déconnectée, jeton qui expire. Fais-lui toucher **Envoyer un test** : la
     notification doit arriver dans la minute. Sinon : lire l'annotation « Notifications (test) »
     du workflow « Notifications », qui donne le code et la raison du refus.
   - **Montres et données** :
     - Strava → **Connecter Strava**, accepter (cocher « activités privées »).
     - Withings → **Reconnecter Withings**, accepter.
     - Apple Santé → **Raccourci Apple Santé** : l'adresse et le jeton à copier.
       Guide-le pour créer le raccourci (ci-dessous).
   - **Bouton Parler** : choisir comment il te parle depuis la page (app Claude, projet).
3. **Raccourci Apple Santé** (app Raccourcis, onglet Automatisation › **+** ›
   **Heure de la journée**, 9:00, Quotidien, **Exécuter immédiatement**) — actions, dans
   l'ordre :
   1. **Rechercher des échantillons de santé** : Analyse du sommeil, Date de début *dans
      les dernières* 1 jours, Valeur *n'est pas* Éveillé.
   2. **Obtenir les détails des échantillons de santé** : Durée → **Calculer les
      statistiques** : Somme → **Calculer** : ÷ 60 (minutes) → variable `Sommeil`.
   3. **Rechercher des échantillons de santé** : Fréquence cardiaque au repos, trier par
      Date de début, du plus récent, limite 1 → **Obtenir les détails** : Valeur →
      variable `FCRepos`.
   4. Pareil avec **Variabilité de la fréquence cardiaque** → variable `VFC`.
   5. **Date actuelle** → **Formater la date** : personnalisé `yyyy-MM-dd` → `Jour`.
   6. **Dictionnaire** : `date` = Jour, `sommeil_min` = Sommeil, `fc_repos` = FCRepos,
      `vfc_ms` = VFC.
   7. **Obtenir le contenu de l'URL** : l'adresse (…/api/sante), Méthode **POST**,
      En-têtes : `X-Coach-Sante` = le jeton, Corps de la requête **JSON** = le Dictionnaire.
   Lance-le une fois à la main : la page de résultat doit dire `"ok":true`. Le lendemain,
   la collecte l'aura recopié (diagnostic : « Apple Santé : reçu »). Variante sans
   bricolage : l'app **Health Auto Export** (payante) › Automations › REST API, même
   adresse, en-tête `X-Coach-Sante`, format JSON : le coach la lit aussi.
   Ses séances (Apple Watch) : le plus simple est l'app Strava (source `strava`) ; sinon
   il les déclare sur la page.

## Étape 8 — Ses tâches de coach (routines Claude)

Ce sont elles qui écrivent le point du matin, le débrief et le programme. Crée-les avec
l'outil des tâches planifiées (`create_trigger`), fuseau Europe/Paris, en remplaçant
`__DEPOT__` dans chaque texte (l'installation l'a déjà fait dans `taches/`) :

| Nom | Quand | Texte |
|---|---|---|
| Coach · Point du matin | `CRON_TZ=Europe/Paris 27 7 * * *` | `taches/point-du-matin.md` |
| Coach · Débrief quotidien | `CRON_TZ=Europe/Paris 23 20 * * *` | `taches/debrief-quotidien.md` |
| Coach · Bilan du dimanche | `CRON_TZ=Europe/Paris 54 17 * * 0` | `taches/point-running-hebdo.md` |

Chacune doit avoir accès au dépôt (son environnement Claude Code avec GitHub branché).
**Crée-les SANS notification Claude** (`notifications: {}`) : c'est l'app du coach qui
prévient (le nouveau mot part en notification de la page dès sa publication). Sinon il
recevrait tout en double. Si l'outil n'est pas disponible dans cette session, guide-le pour
les créer à la main sur **claude.ai/code/routines** (Nouvelle routine : nom, horaire,
texte, dépôt, notifications désactivées).

**La 4ᵉ, « Coach · Réagir »** (le coach relit tout quand il écrit depuis la page) :
1. Il la crée lui-même sur **claude.ai/code/routines** : nom `Coach · Réagir`, texte =
   `taches/reagir.md`, son dépôt, **sans horaire**, **notifications désactivées** ; puis
   **Ajouter un déclencheur › API › Générer un jeton** (affiché une seule fois) → secret
   GitHub `COACH_REAGIR_JETON`.
2. Il te donne l'identifiant de la routine (dans l'adresse : `trig_…`, ce n'est pas un
   secret). Écris-le dans `reglages/installation.json` (`routine_reagir`), commit, push.
3. Test : `gh api -X POST repos/DEPOT/actions/workflows/collecte.yml/dispatches -f ref=main -f 'inputs[raison]=test'`,
   puis `etat/reaction.json` → `test.resultat` doit valoir `ok`.

**Son coach sur le téléphone** : un projet Claude « Coach sportif » dont les instructions
sont `taches/instructions-projet.md` (il crée le projet, tu lui donnes le texte à coller).

**Le premier programme** : lance la routine du bilan maintenant (`fire_trigger`) :
elle écrit ses 4 premières semaines (bilan vide la première fois, c'est normal) et les
envoie à la montre si elle se programme. Vérifie que la page affiche le plan.

## Étape 9 — Vérifier et conclure

1. Workflow « Diagnostic » → `etat/diagnostic.json` : tout en vert, sauf ce qui attend
   des données (première nuit, première séance).
2. Récapitule-lui en 6 lignes : son app (sur l'écran d'accueil), ce qui arrive et quand
   (point du matin 7h27, débrief 20h23, programme le dimanche à 17h54 — chacun arrive en
   notification de son app, pas de Claude),
   comment te parler (bouton Parler, projet Claude), ce qui expire et quand (il sera
   prévenu), et que tout se répare en demandant « fais un diagnostic » au coach.
3. Ne lui laisse aucune action en suspens sans la nommer.
