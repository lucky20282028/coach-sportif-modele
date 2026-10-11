"""Collecte Strava — pour toute montre qui envoie ses séances sur Strava
(Coros, Polar, Suunto, Wahoo, Apple Watch avec l'app Strava, téléphone…).

L'athlète crée sa propre application Strava (strava.com/settings/api) et la branche
depuis sa page (Réglages › Montres et données › Connecter Strava). La page dépose le
jeton de renouvellement dans le stockage Cloudflare ; la collecte le reprend
(collecte/jeton-kv.mjs) et le garde ici, CHIFFRÉ (etat/strava.enc), avec une clé
dérivée de PAGE_KEY. Strava peut changer ce jeton à chaque renouvellement : le
dernier est toujours réécrit.

Écrit, au même format que la collecte Garmin (lu par app/depuis-plan.js) :
  donnees/strava/activites.json       {id: activité}   (id préfixé « s »)
  donnees/strava/sorties/<id>.json    analyse km par km des courses (flux de Strava)

  python collecte/strava.py collecte      → 30 derniers jours, analyse des nouvelles courses
  python collecte/strava.py historique    → 365 jours, analyse des 60 dernières courses

Secrets : STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, PAGE_KEY. Variable : STRAVA_NEUF
(fichier du jeton neuf déposé par la page, s'il y en a un).
"""
import base64
import datetime as dt
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import requests
from cryptography.fernet import Fernet

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sortie_fit  # noqa: E402  (analyse km par km, la même que pour Garmin)

RACINE = Path(__file__).resolve().parent.parent
ETAT = RACINE / "etat" / "strava.enc"
NEUF = RACINE / "etat" / ".strava-neuf.json"
DOSSIER = RACINE / "donnees" / "strava"
API = "https://www.strava.com/api/v3"

# Types Strava → types Garmin (ceux que lit analyses.js : G_TYPE).
TYPES = {
    "Run": "running", "TrailRun": "trail_running", "VirtualRun": "virtual_run",
    "Ride": "road_biking", "MountainBikeRide": "mountain_biking", "GravelRide": "gravel_cycling",
    "VirtualRide": "virtual_ride", "EBikeRide": "cycling", "EMountainBikeRide": "mountain_biking",
    "Swim": "lap_swimming", "WeightTraining": "strength_training", "Crossfit": "hiit",
    "HighIntensityIntervalTraining": "hiit", "Workout": "fitness_equipment", "Yoga": "yoga",
    "Pilates": "pilates", "Soccer": "soccer", "Walk": "walking", "Hike": "hiking",
    "Rowing": "indoor_rowing", "Elliptical": "elliptical", "StairStepper": "stair_climbing",
}
COURSES = {"Run", "TrailRun", "VirtualRun"}


def coffre():
    cle = os.environ.get("PAGE_KEY", "").strip()
    if not cle:
        sys.exit("Secret PAGE_KEY absent : Strava ignoré.")
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(("strava:" + cle).encode()).digest()))


def lire_etat(f):
    """Le jeton neuf déposé par la page passe avant celui du coffre."""
    if NEUF.exists():
        return json.loads(NEUF.read_text())
    if ETAT.exists():
        return json.loads(f.decrypt(ETAT.read_bytes()))
    sys.exit("Strava pas encore connecté : touche « Connecter Strava » dans les réglages de ta page.")


def ecrire_etat(f, etat):
    ETAT.parent.mkdir(parents=True, exist_ok=True)
    ETAT.write_bytes(f.encrypt(json.dumps(etat).encode()))


def renouveler(etat):
    cid, sec = os.environ.get("STRAVA_CLIENT_ID", "").strip(), os.environ.get("STRAVA_CLIENT_SECRET", "").strip()
    if not cid or not sec:
        sys.exit("Secrets STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET absents : Strava ignoré.")
    r = requests.post("https://www.strava.com/oauth/token", data={
        "client_id": cid, "client_secret": sec, "grant_type": "refresh_token",
        "refresh_token": etat["refresh_token"]}, timeout=30)
    if r.status_code != 200:
        sys.exit("Strava refuse le renouvellement (HTTP %d) : reconnecte Strava depuis les réglages de ta page." % r.status_code)
    j = r.json()
    return {"refresh_token": j["refresh_token"], "access_token": j["access_token"], "expires_at": j["expires_at"]}


def appeler(jeton, chemin, params=None):
    for essai in range(3):
        r = requests.get(API + chemin, headers={"Authorization": "Bearer " + jeton}, params=params or {}, timeout=30)
        if r.status_code == 429:          # limite de débit : on attend un peu, puis on abandonne proprement
            time.sleep(20 * (essai + 1))
            continue
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
    raise RuntimeError("Strava : limite de requêtes atteinte, la prochaine collecte reprendra.")


def activite(a):
    """Une activité Strava, au format des activités Garmin."""
    debut = str(a.get("start_date_local") or a.get("start_date") or "").replace("T", " ").replace("Z", "")[:19]
    return {
        "id": "s%d" % a["id"], "name": a.get("name") or "",
        "type": TYPES.get(a.get("sport_type") or a.get("type"), "other"),
        "start_time": debut,
        "distance_meters": a.get("distance") or 0,
        "duration_seconds": a.get("moving_time") or a.get("elapsed_time") or 0,
        "avg_hr_bpm": a.get("average_heartrate"), "max_hr_bpm": a.get("max_heartrate"),
        "elevation_gain_meters": a.get("total_elevation_gain"), "source": "strava",
    }


def points(flux, debut_iso):
    """Les flux Strava (temps, distance, FC, altitude) → les points de sortie_fit.analyser."""
    t = (flux.get("time") or {}).get("data") or []
    d = (flux.get("distance") or {}).get("data") or []
    fc = (flux.get("heartrate") or {}).get("data") or []
    alt = (flux.get("altitude") or {}).get("data") or []
    t0 = dt.datetime.fromisoformat(debut_iso)
    return [(t0 + dt.timedelta(seconds=t[i]),
             float(d[i]) if i < len(d) and d[i] is not None else None,
             int(fc[i]) if i < len(fc) and fc[i] else None,
             float(alt[i]) if i < len(alt) and alt[i] is not None else None) for i in range(len(t))]


def depart(flux):
    ll = (flux.get("latlng") or {}).get("data") or []
    return [round(ll[0][0], 1), round(ll[0][1], 1)] if ll and ll[0] else None


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "collecte"
    jours, analyses = (365, 60) if mode == "historique" else (30, 15)
    f = coffre()
    etat = renouveler(lire_etat(f))
    ecrire_etat(f, {"refresh_token": etat["refresh_token"]})
    jeton = etat["access_token"]

    DOSSIER.mkdir(parents=True, exist_ok=True)
    (DOSSIER / "sorties").mkdir(exist_ok=True)
    fichier = DOSSIER / "activites.json"
    connues = json.loads(fichier.read_text()) if fichier.exists() else {}
    apres = int(time.time()) - jours * 86400
    page, brutes = 1, []
    while page <= 10:
        lot = appeler(jeton, "/athlete/activities", {"after": apres, "per_page": 100, "page": page}) or []
        brutes += lot
        if len(lot) < 100:
            break
        page += 1
    for a in brutes:
        x = activite(a)
        connues[x["id"]] = x
    # On garde 13 mois d'historique, comme pour Garmin.
    limite = (dt.date.today() - dt.timedelta(days=400)).isoformat()
    connues = {k: v for k, v in connues.items() if str(v.get("start_time", "")) >= limite}
    fichier.write_text(json.dumps(connues, ensure_ascii=False, indent=1) + "\n")

    faites = 0
    for a in sorted(brutes, key=lambda x: x.get("start_date") or "", reverse=True):
        if faites >= analyses:
            break
        if (a.get("sport_type") or a.get("type")) not in COURSES:
            continue
        sortie = DOSSIER / "sorties" / ("s%d.json" % a["id"])
        if sortie.exists():
            continue
        flux = appeler(jeton, "/activities/%d/streams" % a["id"],
                       {"keys": "time,distance,heartrate,altitude,latlng", "key_by_type": "true"}) or {}
        x = activite(a)
        fiche = {"id": x["id"], "date": x["start_time"][:10], "debut": x["start_time"], "type": x["type"], "nom": x["name"]}
        try:
            an = sortie_fit.analyser(points(flux, x["start_time"].replace(" ", "T")))
        except Exception as e:  # une sortie illisible ne bloque pas les autres
            an, fiche["erreur"] = None, str(e)[:200]
        if an and an.get("distance_m", 0) < 200:
            an = None          # tapis sans distance, montre sans GPS : rien à analyser km par km
        if an:
            fiche.update(an)
            fiche["lieu"] = depart(flux)
        elif "erreur" not in fiche:
            fiche["erreur"] = "pas de flux exploitable (séance sans GPS ni distance ?)"
        sortie.write_text(json.dumps(fiche, ensure_ascii=False) + "\n")
        faites += 1
    print("Strava : %d activités sur %d jours, %d course(s) analysée(s)." % (len(brutes), jours, faites))


if __name__ == "__main__":
    main()
