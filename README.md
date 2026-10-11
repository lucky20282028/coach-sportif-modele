# Coach sportif

Ton coach sportif personnel : une page sur ton iPhone (comme une app), des séances
programmées, un point chaque matin, un débrief chaque soir, un programme sur 4 semaines
chaque dimanche, et Claude pour lui parler. Tout vit dans **ce dépôt privé**, sur **ton**
compte GitHub et **ton** compte Cloudflare : personne d'autre n'y a accès.

## Installer

Il te faut un iPhone (ou un Android), un compte Claude avec Claude Code (claude.ai/code),
et un compte GitHub (gratuit, github.com › Sign up).

1. Sur cette page du modèle, en haut à droite : **Use this template › Create a new
   repository**. Nom : `coach-sportif`. Coche **Private** (ton profil de santé y vivra).
   **Create repository**.
2. Ouvre **claude.ai/code**, connecte ton compte GitHub si ce n'est pas fait, et choisis
   TON nouveau dépôt `coach-sportif` (pas le modèle).
3. Écris : **« Installe mon coach »**.

Claude te pose des questions (tes sports, tes objectifs, ta santé, ta montre, ton coach
actuel s'il y en a un), te guide pour les deux comptes gratuits (Cloudflare) et les
réglages GitHub, puis installe tout et vérifie. Compte 45 minutes à 1 heure, une seule
fois. Sa procédure est dans `INSTALLER.md`.

## Ce qui tourne tout seul

| Quand | Quoi |
|---|---|
| ~6h45 et ~20h15 | Collecte de tes montres et de ce que tu tapes sur la page, page régénérée et publiée |
| 7h27 | Point du matin (notification Claude) : la nuit, la séance du jour, une consigne |
| 20h23 | Débrief du soir |
| Dimanche 17h54 | Bilan de la semaine et programme des 4 semaines suivantes (envoyé à ta montre si elle se programme) |
| Quand tu écris au coach ou appuies sur Actualiser | Collecte immédiate ; le coach relit et réécrit son mot |
| Fin d'après-midi et soir | Notifications de la page : séance pas faite, « au lit » après une nuit courte, séance modifiée, montre déconnectée, jeton qui va expirer |
| Chaque lundi | Diagnostic de l'installation (`etat/diagnostic.json`) |

Les heures sont tenues par une horloge Cloudflare (`horloge/`) : les tâches planifiées de
GitHub, elles, partent souvent avec des heures de retard.

## Tes sources de données

Réglées dans `reglages/athlete.json` (`sources`) pendant l'installation :

| Source | Ce qu'elle apporte | Comment elle se branche |
|---|---|---|
| Garmin | Sommeil, VFC, charge, séances ; la montre reçoit les séances programmées | Secrets `GARMIN_EMAIL` et `GARMIN_MOT_DE_PASSE` (reconnexion automatique chaque année) |
| Strava | Séances de toute montre qui synchronise sur Strava (Coros, Polar, Suunto, Apple Watch…) | Ton application Strava (secrets `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`), puis « Connecter Strava » dans la page |
| Apple Santé | Nuit, FC de repos, VFC (Apple Watch, Oura, Whoop… tout ce qui écrit dans Santé) | Un raccourci de l'iPhone, chaque matin (INSTALLER.md, étape 7) |
| Withings | Sommeil | Ton application Withings (secret `WITHINGS_ENV`), puis « Reconnecter Withings » dans la page |
| Aucune | Le check-in du matin et les séances que tu déclares | Rien à brancher |

## Secrets (GitHub › Settings › Secrets and variables › Actions)

| Secret | Obligatoire | Rôle |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | oui | Publier la page, son stockage, l'horloge (Pages, Workers KV Storage, Workers Scripts en Edit ; Account Settings en Read) |
| `JETON_GITHUB` | oui | Que la page et l'horloge puissent lancer une collecte (jeton à portée fine, ce dépôt seul, Actions en lecture et écriture, 1 an) |
| `PAGE_KEY` | oui | La clé de ta page, créée dans ton iPhone pendant l'installation. **Ne la change jamais** : le lien de ton écran d'accueil cesserait de marcher |
| `COACH_REAGIR_JETON` | conseillé | Le jeton de ta routine « Coach · Réagir » : le coach relit tout quand tu lui écris |
| `GARMIN_EMAIL`, `GARMIN_MOT_DE_PASSE` | avec Garmin | Connexion Garmin |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | avec Strava | Ton application Strava |
| `WITHINGS_ENV` | avec Withings | Ton application Withings (deux lignes `WITHINGS_CLIENT_ID=…` et `WITHINGS_CLIENT_SECRET=…`) |

Aucun secret n'est jamais écrit dans un fichier, ni montré à Claude.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `profil.md` | Toi : sports, santé, objectifs, repères, préférences. Source de vérité du coach |
| `reglages/athlete.json` | Tes réglages chiffrés : cibles de la semaine, FC de référence, allures, sources, zones du check-in |
| `reglages/installation.json` | Le nom de ta page, l'horloge, ta routine Réagir (aucun secret) |
| `carnet.md` | Ce que tu dis au coach (notes datées) |
| `journal/AAAA-MM.md` | Ce que le coach répond (points, débriefs, bilans) |
| `app/entrees/plan.txt` | Ton programme. Un seul fichier ; l'historique est dans git |
| `donnees/` | Tes données, une ligne par collecte ; `synthese.json` = ce que le coach lit en premier |
| `COACH.md`, `taches/` | Les consignes du coach |
| `app/` | La page (bancs d'essai : `bench*.js`, lancés à chaque publication) |
| `collecte/`, `commun/`, `functions/`, `horloge/` | Collecte, logique partagée, fonctions de la page, horloge |
| `etat/` | État de la dernière collecte, diagnostic, échéances des jetons |
| `outils/` | Diagnostic, page de la clé, parcours complet de la page (`instantane.mjs`) |
| `BUGS-CORRIGES.md` | Les problèmes déjà rencontrés et ce qui les empêche de revenir |

## Dépannage

Demande à ton coach : **« fais un diagnostic »**. Il lance le workflow « Diagnostic »,
lit `etat/diagnostic.json` et te dit quoi faire, point par point. Les cas courants :

- **La page dit « Rien à voir ici »** : ouvre ton lien complet (celui qui finit par `#…`),
  pas l'adresse seule ; il est dans tes notes et dans Réglages › Icône de l'écran d'accueil.
- **Une montre ne répond plus** : Strava et Withings se reconnectent depuis la page
  (Réglages › Montres et données) ; Garmin se reconnecte seul, sauf mot de passe changé
  (mets à jour `GARMIN_MOT_DE_PASSE`).
- **Le coach ne relit pas quand tu écris** : jeton de la routine Réagir à recréer
  (`COACH_REAGIR_JETON`).
- **Un jeton expire** : tu es prévenu un mois avant (notification) ; refais-le comme à
  l'installation et colle-le au même nom.
- **Réinstaller ou réparer** : workflow « Installation » (sans risque, rien n'est recréé
  deux fois, la clé n'est jamais remplacée).
