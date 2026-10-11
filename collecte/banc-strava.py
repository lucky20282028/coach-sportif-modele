"""Banc de la collecte Strava, sans réseau : l'API Strava est simulée.
     python collecte/banc-strava.py
Vérifie : jeton neuf de la page pris en premier, jeton renouvelé gardé CHIFFRÉ (jamais en
clair), activités au format Garmin (type, début, durée, distance, FC), analyse km par km
d'une course à partir des flux, séances sans flux qui n'empêchent rien, refus clairs."""
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
ok, ko, echecs = 0, 0, []


def t(nom, cond, detail=""):
    global ok, ko
    if cond:
        ok += 1
    else:
        ko += 1
        echecs.append(nom + ("  → " + str(detail)[:200] if detail else ""))


class Rep:
    def __init__(self, code, corps):
        self.status_code, self._c = code, corps

    def json(self):
        return self._c

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("HTTP %d" % self.status_code)


def monter(racine):
    """Copie le code utile dans un faux dépôt et importe strava.py depuis là."""
    (racine / "collecte").mkdir(parents=True)
    for f in ("strava.py", "sortie_fit.py"):
        shutil.copy(ICI / f, racine / "collecte" / f)
    sys.path.insert(0, str(racine / "collecte"))
    for m in ("strava", "sortie_fit"):
        sys.modules.pop(m, None)
    import strava  # noqa
    return strava


vus = []
COURSE = {"id": 111, "name": "Footing", "sport_type": "Run", "start_date_local": "2026-10-10T18:30:00Z",
          "start_date": "2026-10-10T16:30:00Z", "moving_time": 1800, "elapsed_time": 1850, "distance": 5000.0,
          "average_heartrate": 142.5, "max_heartrate": 155, "total_elevation_gain": 12}
RENFO = {"id": 222, "name": "Gainage", "sport_type": "WeightTraining", "start_date_local": "2026-10-09T07:00:00Z",
         "start_date": "2026-10-09T05:00:00Z", "moving_time": 900, "distance": 0}
TAPIS = {"id": 333, "name": "Tapis", "sport_type": "Run", "start_date_local": "2026-10-08T12:00:00Z",
         "start_date": "2026-10-08T10:00:00Z", "moving_time": 1200, "distance": 0}
N = 1801
FLUX = {"time": {"data": list(range(0, N))}, "distance": {"data": [i * 2.78 for i in range(N)]},
        "heartrate": {"data": [120 + min(i // 60, 25) for i in range(N)]}, "altitude": {"data": [50 + (i % 100) / 10 for i in range(N)]},
        "latlng": {"data": [[48.8566, 2.3522]] * N}}


def faux_post(url, data=None, timeout=None):
    vus.append(("POST", url, dict(data or {})))
    if data.get("refresh_token") == "MORT":
        return Rep(400, {"message": "Bad Request"})
    return Rep(200, {"refresh_token": "R2", "access_token": "A2", "expires_at": 9999999999})


def faux_get(url, headers=None, params=None, timeout=None):
    vus.append(("GET", url, dict(params or {})))
    if url.endswith("/athlete/activities"):
        return Rep(200, [COURSE, RENFO, TAPIS] if (params or {}).get("page", 1) == 1 else [])
    if url.endswith("/activities/111/streams"):
        return Rep(200, FLUX)
    if url.endswith("/activities/333/streams"):
        return Rep(200, {"time": {"data": [0, 600, 1200]}, "heartrate": {"data": [100, 120, 130]}})
    return Rep(404, {})


def principal():
    racine = Path(tempfile.mkdtemp())
    try:
        strava = monter(racine)
        strava.RACINE = racine
        strava.ETAT, strava.NEUF, strava.DOSSIER = racine / "etat" / "strava.enc", racine / "etat" / ".strava-neuf.json", racine / "donnees" / "strava"
        strava.requests.post, strava.requests.get = faux_post, faux_get
        os.environ.update({"PAGE_KEY": "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", "STRAVA_CLIENT_ID": "123", "STRAVA_CLIENT_SECRET": "sec"})

        # 1. Pas encore connecté : refus clair, rien d'écrit
        sys.argv = ["strava.py", "collecte"]
        try:
            strava.main()
            t("sans jeton : refus", False)
        except SystemExit as e:
            t("sans jeton : refus qui dit quoi faire", "Connecter Strava" in str(e), e)

        # 2. Jeton neuf déposé par la page
        strava.NEUF.parent.mkdir(parents=True, exist_ok=True)
        strava.NEUF.write_text(json.dumps({"refresh_token": "R1"}))
        strava.main()
        post = [v for v in vus if v[0] == "POST"][-1]
        t("le jeton neuf de la page est renouvelé avec l'application de l'athlète", post[2].get("refresh_token") == "R1" and post[2].get("client_id") == "123", post)
        brut = strava.ETAT.read_bytes()
        t("jeton renouvelé gardé chiffré (jamais en clair)", strava.ETAT.exists() and b"R2" not in brut)
        t("et relisible avec la clé", json.loads(strava.coffre().decrypt(brut))["refresh_token"] == "R2")
        acts = json.loads((strava.DOSSIER / "activites.json").read_text())
        c = acts.get("s111", {})
        t("activité au format Garmin : course, début local, durée en mouvement, distance, FC",
          c.get("type") == "running" and c.get("start_time") == "2026-10-10 18:30:00" and c.get("duration_seconds") == 1800
          and c.get("distance_meters") == 5000.0 and c.get("avg_hr_bpm") == 142.5 and c.get("source") == "strava", c)
        t("renforcement reconnu", acts.get("s222", {}).get("type") == "strength_training")
        fiche = json.loads((strava.DOSSIER / "sorties" / "s111.json").read_text())
        t("course analysée km par km depuis les flux", fiche.get("distance_m", 0) > 4900 and len(fiche.get("km", [])) == 5 and fiche["km"][0]["fc"], fiche.get("km"))
        t("lieu de départ arrondi (météo), jamais précis", fiche.get("lieu") == [48.9, 2.4], fiche.get("lieu"))
        f3 = json.loads((strava.DOSSIER / "sorties" / "s333.json").read_text())
        t("course sans distance (tapis) : notée sans analyse, sans planter", "erreur" in f3, f3)
        t("le renforcement n'est pas analysé comme une course", not (strava.DOSSIER / "sorties" / "s222.json").exists())

        # 3. Le jeton de la page a été consommé par la collecte (jeton-kv l'efface) : on repart du coffre
        strava.NEUF.unlink()
        nb = len([v for v in vus if v[0] == "GET" and "streams" in v[1]])
        strava.main()
        post = [v for v in vus if v[0] == "POST"][-1]
        t("collecte suivante : repart du jeton du coffre", post[2].get("refresh_token") == "R2", post)
        t("une sortie déjà analysée ne l'est pas deux fois", len([v for v in vus if v[0] == "GET" and "streams" in v[1]]) == nb)

        # 4. Autorisation révoquée chez Strava : refus clair
        strava.ecrire_etat(strava.coffre(), {"refresh_token": "MORT"})
        try:
            strava.main()
            t("jeton mort : refus", False)
        except SystemExit as e:
            t("jeton mort : refus qui dit de reconnecter", "reconnecte Strava" in str(e), e)

        # 5. Sans application Strava
        del os.environ["STRAVA_CLIENT_ID"]
        try:
            strava.main()
            t("sans application : refus", False)
        except SystemExit as e:
            t("sans application : refus clair", "STRAVA_CLIENT_ID" in str(e), e)
    finally:
        shutil.rmtree(racine, ignore_errors=True)

    print("\n  %d réussis, %d échoués" % (ok, ko))
    if ko:
        for e in echecs:
            print("  ✗ " + e)
        sys.exit(1)
    print("  Strava validé.")


principal()
