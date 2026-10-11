"""Collecte Garmin — tourne sur GitHub Actions, plus jamais sur le Mac.

Réutilise le connecteur garmin_mcp (le même que celui du Mac) : ses outils
renvoient exactement les mêmes champs qu'avant (sleep_hours, sleep_score,
avg_overnight_hrv…), donc les tâches du coach lisent des données familières.

Trois modes :
  python collecte/garmin.py collecte [AAAA-MM-JJ]
      → ajoute une ligne à donnees/garmin/AAAA-MM.jsonl, tient à jour
        donnees/garmin/activites.json et analyse les nouvelles sorties
        (donnees/garmin/sorties/<id>.json, km par km, d'après le FIT d'origine)
  python collecte/garmin.py historique [jours]
      → rattrape l'historique des activités (365 jours par défaut) et leurs analyses
  python collecte/garmin.py activites-jour FICHIER
      → écrit dans FICHIER la liste des activités du jour (notifications)
  python collecte/garmin.py montre
      → exécute les appels listés dans montre/a-faire.json (programmation de
        la montre), écrit montre/resultat.json et vide a-faire.json

Jetons, dans cet ordre :
  1. le secret GARMIN_TOKENS : le dossier ~/.garminconnect d'un ordinateur, archivé en
     tar.gz puis encodé en base64 (connexion faite sur l'ordinateur) ;
  2. etat/garmin.enc : les mêmes jetons, chiffrés avec une clé dérivée de PAGE_KEY,
     écrits par la connexion depuis GitHub (python collecte/garmin.py connexion, secrets
     GARMIN_EMAIL et GARMIN_MOT_DE_PASSE). Quand ils expirent (vers un an), la collecte
     se reconnecte seule avec ces deux secrets.
"""
import asyncio
import base64
import datetime as dt
import io
import json
import os
import sys
import tarfile
from pathlib import Path
from zoneinfo import ZoneInfo

RACINE = Path(__file__).resolve().parent.parent
PARIS = ZoneInfo("Europe/Paris")
JETONS = Path.home() / ".garminconnect"


COFFRE = RACINE / "etat" / "garmin.enc"


def _fernet():
    from cryptography.fernet import Fernet
    import hashlib
    cle = os.environ.get("PAGE_KEY", "").strip()
    if not cle:
        return None
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(("garmin:" + cle).encode()).digest()))


def _extraire(donnees):
    with tarfile.open(fileobj=io.BytesIO(donnees), mode="r:gz") as tar:
        tar.extractall(Path.home(), filter="data")


def garder_jetons():
    """Chiffre ~/.garminconnect dans etat/garmin.enc (après une connexion par mot de passe)."""
    f = _fernet()
    if f is None or not JETONS.is_dir():
        return
    tampon = io.BytesIO()
    with tarfile.open(fileobj=tampon, mode="w:gz") as tar:
        tar.add(JETONS, arcname=".garminconnect")
    COFFRE.parent.mkdir(parents=True, exist_ok=True)
    COFFRE.write_bytes(f.encrypt(tampon.getvalue()))


def identifiants():
    e, m = os.environ.get("GARMIN_EMAIL", "").strip(), os.environ.get("GARMIN_MOT_DE_PASSE", "")
    return (e, m) if e and m else None


def connexion_mot_de_passe():
    """Connexion avec l'adresse et le mot de passe Garmin (secrets), jetons gardés chiffrés."""
    from garminconnect import Garmin
    ids = identifiants()
    if not ids:
        sys.exit("Ni jetons Garmin ni secrets GARMIN_EMAIL / GARMIN_MOT_DE_PASSE : Garmin ignoré.")
    client = Garmin(ids[0], ids[1], return_on_mfa=True)
    res = client.login()
    if isinstance(res, tuple) and res and res[0] == "needs_mfa":
        sys.exit("Ton compte Garmin demande un code (double authentification) : la connexion depuis GitHub "
                 "ne peut pas le saisir. Fais la connexion sur un ordinateur (Claude t'y guide), ou désactive la "
                 "double authentification le temps de la connexion.")
    JETONS.mkdir(parents=True, exist_ok=True)
    client.garth.dump(str(JETONS))
    garder_jetons()
    return client


def restaurer_jetons():
    brut = os.environ.get("GARMIN_TOKENS", "").strip()
    if brut:
        _extraire(base64.b64decode(brut))
        if not JETONS.is_dir():
            sys.exit("GARMIN_TOKENS ne contient pas de dossier .garminconnect.")
        return True
    f = _fernet()
    if f is not None and COFFRE.exists():
        _extraire(f.decrypt(COFFRE.read_bytes()))
        return JETONS.is_dir()
    return False


class Registre:
    """Remplace le serveur MCP : on récupère les fonctions-outils telles quelles."""

    def __init__(self):
        self.outils = {}

    def tool(self, *args, **kwargs):
        nom = kwargs.get("name") or (args[0] if args and isinstance(args[0], str) else None)

        def deco(fn):
            self.outils[nom or fn.__name__] = fn
            return fn

        return deco

    def __getattr__(self, item):  # resource(), prompt()… : ignorés
        def rien(*a, **k):
            return lambda fn: fn
        return rien


def connecter():
    from garminconnect import Garmin
    import garmin_mcp
    from garmin_mcp import (activity_management, health_wellness, training,
                            workouts, calendar_events, workout_builders)

    if restaurer_jetons():
        client = Garmin()
        try:
            client.login(str(JETONS))
        except Exception:
            # Jetons expirés : on se reconnecte seul si l'adresse et le mot de passe sont là.
            if not identifiants():
                raise
            client = connexion_mot_de_passe()
    else:
        client = connexion_mot_de_passe()

    reg = Registre()
    for mod in (activity_management, health_wellness, training, workouts, calendar_events,
                workout_builders):
        mod.configure(client)
        mod.register_tools(reg)

    # Deux outils maison, en lecture seule, pour vérifier ce que Garmin a réellement
    # enregistré (les outils du connecteur résument les réponses).
    async def lecture_brute(chemin: str):
        if not chemin.startswith("/workout-service/") and not chemin.startswith("/calendar-service/"):
            return {"erreur": "lecture_brute est limitée aux séances et au calendrier"}
        return json.dumps(client.connectapi(chemin))

    async def exercices_garmin():
        import requests
        r = requests.get("https://connect.garmin.com/web-data/exercises/Exercises.json", timeout=30)
        return r.text

    async def creer_gainage(nom: str, tours: int = 3, planche_s: int = 45, laterale_s: int = 30,
                            pont_reps: int = 12, climber_reps: int = 20, recup_s: int = 40,
                            mountain_climber: bool = True):
        """Circuit de gainage guidé : la montre affiche chaque exercice et son minuteur."""
        seance = construire_gainage(nom, tours, planche_s, laterale_s, pont_reps,
                                    climber_reps, recup_s, mountain_climber)
        # Passe par l'outil du connecteur : il valide et normalise la structure avant envoi.
        return await reg.outils["upload_workout"](workout_data=seance)

    async def fit_original(activity_id: int):
        """Fichier FIT d'origine de la montre (archive ZIP), en octets."""
        return bytes(client.download_activity(int(activity_id),
                                              dl_fmt=Garmin.ActivityDownloadFormat.ORIGINAL))

    reg.outils["fit_original"] = fit_original
    reg.outils["lecture_brute"] = lecture_brute
    reg.outils["exercices_garmin"] = exercices_garmin
    reg.outils["creer_gainage"] = creer_gainage
    return reg.outils


FORCE = {"sportTypeId": 5, "sportTypeKey": "strength_training"}
SANS_CIBLE = {"workoutTargetTypeId": 1, "workoutTargetTypeKey": "no.target"}


def etape(ordre, categorie, exercice, duree_s=None, reps=None):
    """Une étape d'exercice, à la durée ou aux répétitions (touche Lap pour passer)."""
    fin = ({"conditionTypeId": 2, "conditionTypeKey": "time"}, float(duree_s)) if duree_s \
        else ({"conditionTypeId": 10, "conditionTypeKey": "reps"}, float(reps))
    return {
        "type": "ExecutableStepDTO", "stepOrder": ordre,
        "stepType": {"stepTypeId": 3, "stepTypeKey": "interval"},
        "endCondition": fin[0], "endConditionValue": fin[1],
        "targetType": SANS_CIBLE, "category": categorie, "exerciseName": exercice,
    }


def construire_gainage(nom, tours=3, planche_s=45, laterale_s=30, pont_reps=12,
                       climber_reps=20, recup_s=40, mountain_climber=True):
    """Clés d'exercices issues du catalogue Garmin (Exercises.json) : sans elles, la montre
    n'affiche qu'un « intervalle » anonyme. Aucun champ description, conformément au profil."""
    pas = [
        etape(1, "PLANK", "PLANK", duree_s=planche_s),
        etape(2, "PLANK", "SIDE_PLANK", duree_s=laterale_s),
        etape(3, "PLANK", "SIDE_PLANK", duree_s=laterale_s),
        etape(4, "HIP_RAISE", "HIP_RAISE", reps=pont_reps),
    ]
    if mountain_climber:
        pas.append(etape(5, "PLANK", "MOUNTAIN_CLIMBER", reps=climber_reps))
    pas.append({
        "type": "ExecutableStepDTO", "stepOrder": len(pas) + 1,
        "stepType": {"stepTypeId": 4, "stepTypeKey": "recovery"},
        "endCondition": {"conditionTypeId": 2, "conditionTypeKey": "time"},
        "endConditionValue": float(recup_s), "targetType": SANS_CIBLE,
    })
    duree_tour = planche_s + 2 * laterale_s + 40 + (40 if mountain_climber else 0) + recup_s
    return {
        "workoutName": nom, "sportType": FORCE,
        "estimatedDurationInSecs": duree_tour * int(tours),
        "workoutSegments": [{
            "segmentOrder": 1, "sportType": FORCE,
            "workoutSteps": [{
                "type": "RepeatGroupDTO", "stepOrder": 1,
                "stepType": {"stepTypeId": 6, "stepTypeKey": "repeat"},
                "numberOfIterations": int(tours), "smartRepeat": False,
                "endCondition": {"conditionTypeId": 7, "conditionTypeKey": "iterations"},
                "workoutSteps": pas,
            }],
        }],
    }


def lisible(texte):
    """Les outils renvoient du JSON en texte, ou un message d'erreur."""
    try:
        return json.loads(texte)
    except (TypeError, ValueError):
        return texte


async def appeler(outils, _outil, **args):
    try:
        return lisible(await outils[_outil](**args))
    except Exception as e:  # une source qui manque ne bloque pas les autres
        return {"erreur": f"{type(e).__name__}: {e}"}


async def collecte(jours):
    outils = connecter()
    vues = []
    for jour in jours:
        vues += await collecte_jour(outils, jour)
    fusionner_activites(vues)
    await analyser_sorties(outils, limite=15)


# ---------- Historique des activités et analyse des sorties ----------
# donnees/garmin/activites.json : toutes les activités connues (résumé), par identifiant.
# donnees/garmin/sorties/<id>.json : l'analyse km par km d'une sortie de course,
# calculée une seule fois à partir du FIT d'origine (voir collecte/sortie_fit.py).
COURSE = {"running", "trail_running", "treadmill_running", "track_running", "street_running",
          "virtual_run", "indoor_running"}
F_ACTIVITES = RACINE / "donnees" / "garmin" / "activites.json"
D_SORTIES = RACINE / "donnees" / "garmin" / "sorties"


def liste_activites(bloc):
    if isinstance(bloc, dict):
        bloc = bloc.get("activities", [])
    return [a for a in (bloc or []) if isinstance(a, dict) and a.get("id")]


def fusionner_activites(liste):
    connues = json.loads(F_ACTIVITES.read_text(encoding="utf-8")) if F_ACTIVITES.exists() else {}
    for a in liste:
        connues[str(a["id"])] = {k: a.get(k) for k in ("id", "name", "type", "start_time", "distance_meters",
                                                        "duration_seconds", "avg_hr_bpm", "max_hr_bpm",
                                                        "elevation_gain_meters", "calories") if a.get(k) is not None}
    F_ACTIVITES.parent.mkdir(parents=True, exist_ok=True)
    F_ACTIVITES.write_text(json.dumps(dict(sorted(connues.items(), key=lambda kv: kv[1].get("start_time", ""))),
                                      ensure_ascii=False, indent=0), encoding="utf-8")
    return connues


async def analyser_sorties(outils, limite=15):
    """Analyse les sorties de course pas encore traitées, les plus récentes d'abord."""
    import sortie_fit
    connues = json.loads(F_ACTIVITES.read_text(encoding="utf-8")) if F_ACTIVITES.exists() else {}
    D_SORTIES.mkdir(parents=True, exist_ok=True)
    courses = sorted([a for a in connues.values() if a.get("type") in COURSE],
                     key=lambda a: a.get("start_time", ""), reverse=True)
    a_faire = [a for a in courses if not (D_SORTIES / f"{a['id']}.json").exists()]
    # Les 3 sorties les plus récentes doivent porter leur lieu de départ (pour la météo) :
    # celles analysées avant l'ajout de ce champ sont refaites une fois.
    for a in courses[:3]:
        f = D_SORTIES / f"{a['id']}.json"
        if f.exists() and a not in a_faire:
            ancienne = json.loads(f.read_text(encoding="utf-8"))
            if "lieu" not in ancienne and "erreur" not in ancienne:
                a_faire.append(a)
    faites = 0
    for a in a_faire[:limite]:
        fiche = {"id": a["id"], "date": str(a.get("start_time", ""))[:10], "debut": a.get("start_time"),
                 "type": a.get("type"), "nom": a.get("name")}
        try:
            brut = await outils["fit_original"](activity_id=a["id"])
            analyse = sortie_fit.analyser(sortie_fit.points(brut))
            if not analyse:
                raise ValueError("fichier FIT sans points")
            fiche.update(analyse)
            fiche["lieu"] = sortie_fit.depart(brut)
        except Exception as e:  # on note l'échec pour ne pas réessayer indéfiniment
            fiche["erreur"] = f"{type(e).__name__}: {e}"[:200]
        (D_SORTIES / f"{a['id']}.json").write_text(json.dumps(fiche, ensure_ascii=False, separators=(",", ":")),
                                                     encoding="utf-8")
        faites += 1
    print(f"Sorties analysées : {faites} (restent {max(0, len(a_faire) - faites)})")


async def historique(jours):
    """Rattrape l'historique : toutes les activités des N derniers jours, puis leurs analyses."""
    outils = connecter()
    fin = dt.datetime.now(PARIS).date()
    debut = fin - dt.timedelta(days=jours)
    toutes, page = [], 0
    while True:
        r = await appeler(outils, "get_activities_by_date", start_date=debut.isoformat(),
                          end_date=fin.isoformat(), page=page, page_size=200)
        lot = liste_activites(r)
        toutes += lot
        if not (isinstance(r, dict) and r.get("has_more")) or page > 20:
            break
        page += 1
    connues = fusionner_activites(toutes)
    print(f"Historique : {len(toutes)} activités du {debut} au {fin} ({len(connues)} connues en tout)")
    await analyser_sorties(outils, limite=400)


async def collecte_jour(outils, jour):
    j = jour.isoformat()
    veille = (jour - dt.timedelta(days=1)).isoformat()
    il_y_a_7 = (jour - dt.timedelta(days=7)).isoformat()
    dans_7 = (jour + dt.timedelta(days=7)).isoformat()

    ligne = {
        "collecte": dt.datetime.now(PARIS).isoformat(timespec="minutes"),
        "date": j,
        "sommeil": await appeler(outils, "get_sleep_summary", date=j),
        "vfc": await appeler(outils, "get_hrv_data", date=j),
        "disponibilite": await appeler(outils, "get_training_readiness", date=j),
        "statut": await appeler(outils, "get_training_status", date=j),
        "fc_repos": await appeler(outils, "get_rhr_day", date=j),
        "body_battery": await appeler(outils, "get_body_battery", start_date=veille, end_date=j),
        "activites_7j": await appeler(outils, "get_activities_by_date", start_date=il_y_a_7, end_date=j),
        "seances_programmees": await appeler(outils, "get_scheduled_workouts", start_date=j, end_date=dans_7),
    }

    # Zones FC par activité du jour : utile au débrief du soir.
    acts = ligne["activites_7j"]
    liste = acts.get("activities", acts) if isinstance(acts, dict) else acts
    zones = {}
    if isinstance(liste, list):
        for a in liste:
            if not isinstance(a, dict):
                continue
            debut = str(a.get("startTimeLocal") or a.get("start_time") or a.get("date") or "")
            ident = a.get("activityId") or a.get("activity_id") or a.get("id")
            if ident and debut.startswith(j):
                zones[str(ident)] = await appeler(outils, "get_activity_hr_in_timezones", activity_id=ident)
    if zones:
        ligne["zones_fc_du_jour"] = zones

    dossier = RACINE / "donnees" / "garmin"
    dossier.mkdir(parents=True, exist_ok=True)
    with open(dossier / f"{j[:7]}.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(ligne, ensure_ascii=False) + "\n")

    def en_echec(v):
        return ((isinstance(v, dict) and "erreur" in v)
                or (isinstance(v, str) and v.lower().startswith("error")))

    erreurs = [k for k, v in ligne.items() if k not in ("collecte", "date") and en_echec(v)]
    print(f"Garmin {j} : {len(ligne) - 2} blocs, erreurs : {erreurs or 'aucune'}")
    if len(erreurs) >= 6:
        raise SystemExit("Presque tout a échoué : jetons expirés ou Garmin bloque l'accès.")
    return liste_activites(ligne["activites_7j"])


def trouver_workout_id(res):
    if isinstance(res, dict):
        for k in ("workout_id", "workoutId"):
            if res.get(k):
                return res[k]
        for v in res.values():
            trouve = trouver_workout_id(v)
            if trouve:
                return trouve
    return None


async def montre():
    a_faire = RACINE / "montre" / "a-faire.json"
    demandes = json.loads(a_faire.read_text(encoding="utf-8") or "[]") if a_faire.exists() else []
    if not demandes:
        print("Rien à programmer.")
        return
    outils = connecter()
    resultats = []
    for d in demandes:
        nom, args = d.get("outil"), d.get("args", {})
        if nom not in outils:
            res = {"erreur": f"outil inconnu : {nom}"}
        else:
            res = await appeler(outils, nom, **args)
        entree = {"outil": nom, "args": args, "resultat": res}
        # Raccourci : {"outil": "create_…" ou "upload_workout", …, "planifier": "AAAA-MM-JJ"}
        # crée la séance puis la place dans le calendrier de la montre.
        if d.get("planifier"):
            ident = trouver_workout_id(res)
            entree["planification"] = (
                await appeler(outils, "schedule_workout", workout_id=int(ident),
                              calendar_date=d["planifier"])
                if ident else {"erreur": "identifiant de séance introuvable dans la réponse"})
        resultats.append(entree)
    sortie = {"execute": dt.datetime.now(PARIS).isoformat(timespec="minutes"), "appels": resultats}
    (RACINE / "montre" / "resultat.json").write_text(
        json.dumps(sortie, ensure_ascii=False, indent=1), encoding="utf-8")
    a_faire.write_text("[]\n", encoding="utf-8")
    print(f"{len(resultats)} appel(s) exécuté(s).")


async def activites_jour(fichier):
    """Activités du jour, lues à l'instant (rappel « séance pas faite » des notifications).
    Écrit seulement une liste JSON dans `fichier` : rien dans le dépôt."""
    outils = connecter()
    j = dt.datetime.now(PARIS).date().isoformat()
    acts = await appeler(outils, "get_activities_by_date", start_date=j, end_date=j)
    liste = acts.get("activities", acts) if isinstance(acts, dict) else acts
    liste = [a for a in liste if isinstance(a, dict)] if isinstance(liste, list) else []
    Path(fichier).write_text(json.dumps(liste, ensure_ascii=False), encoding="utf-8")
    print(f"{len(liste)} activité(s) aujourd'hui.")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "collecte"
    if mode == "activites-jour":
        asyncio.run(activites_jour(sys.argv[2] if len(sys.argv) > 2 else "/tmp/activites.json"))
    elif mode == "montre":
        asyncio.run(montre())
    elif mode == "historique":
        asyncio.run(historique(int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] else 365))
    elif mode == "connexion":
        # Première connexion depuis GitHub (workflow « Connexion Garmin ») : jetons chiffrés.
        if restaurer_jetons():
            print("Jetons Garmin déjà présents : rien à faire.")
        else:
            c = connexion_mot_de_passe()
            print("Connexion Garmin réussie (%s) : jetons gardés chiffrés dans etat/garmin.enc." % (c.get_full_name() or "compte"))
    else:
        # Une date (AAAA-MM-JJ) ou une plage (AAAA-MM-JJ:AAAA-MM-JJ) pour rattraper l'historique.
        arg = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else ""
        if ":" in arg:
            debut, fin = (dt.date.fromisoformat(x) for x in arg.split(":"))
            jours = [debut + dt.timedelta(days=i) for i in range((fin - debut).days + 1)]
        else:
            jours = [dt.date.fromisoformat(arg) if arg else dt.datetime.now(PARIS).date()]
        asyncio.run(collecte(jours))
