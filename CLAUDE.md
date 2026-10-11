# Coach sportif — ce dépôt

Ce dépôt est le coach sportif personnel d'une personne : sa page iPhone (`app/`), ses
données (`donnees/`), son profil (`profil.md`), ses réglages (`reglages/`) et les consignes
de ses tâches (`taches/`, `COACH.md`). Tout y est en français ; réponds en français.

- **Installation** : si `reglages/installation.json` n'existe pas ou n'a pas
  d'`empreinte_cle`, le coach n'est pas encore installé. Si la personne demande de
  l'installer (« installe mon coach », « configure », « commence »), suis **INSTALLER.md**,
  étape par étape. Ne commence pas l'installation sans qu'elle le demande.
- **Tâche planifiée du coach** (point du matin, débrief, bilan, réaction) : ta consigne
  arrive avec la tâche ; elle renvoie à `COACH.md`. Ne lance jamais l'installation pendant
  une tâche.
- **Conversation avec l'athlète** : `taches/instructions-projet.md` dit comment te comporter.
- **Dépannage** : workflow « Diagnostic » → `etat/diagnostic.json` ; README.md, section
  « Dépannage ».

Règles : ne recopie jamais un secret (clé de page, jetons, mots de passe) dans un fichier
ou un message ; ne modifie le code de `app/` que pour corriger un bug, avec ses bancs
d'essai (`cd app && TZ=Europe/Paris node bench.js` et les autres `bench-*.js`) au vert.
