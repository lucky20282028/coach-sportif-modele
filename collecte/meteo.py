"""Météo des deux prochains jours, là où l'athlète court (Open-Meteo, gratuit, sans clé).

Le lieu vient du départ de sa dernière sortie enregistrée (arrondi à ~10 km,
voir sortie_fit.depart), sinon de reglages/athlete.json (« lieu »). Sert à la règle
« le soir s'il fait chaud, plafond de FC » et au coach pour parler du créneau.
Écrit donnees/meteo.json : {collecte, lieu, heures: {"AAAA-MM-JJTHH:00": [t, ressenti, pluie %, vent km/h]}}
"""
import datetime as dt
import json
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

RACINE = Path(__file__).resolve().parent.parent
PARIS = ZoneInfo("Europe/Paris")


def lieu():
    meilleur = None
    for f in [*(RACINE / "donnees" / "garmin" / "sorties").glob("*.json"), *(RACINE / "donnees" / "strava" / "sorties").glob("*.json")]:
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            continue
        if d.get("lieu") and (meilleur is None or str(d.get("debut")) > str(meilleur.get("debut"))):
            meilleur = d
    if meilleur:
        return meilleur["lieu"]
    # Sans sortie GPS (pas de Garmin, ou pas encore de sortie) : le lieu des réglages.
    try:
        a = json.loads((RACINE / "reglages" / "athlete.json").read_text(encoding="utf-8")).get("lieu")
        if a and isinstance(a.get("lat"), (int, float)) and isinstance(a.get("lon"), (int, float)):
            return [round(a["lat"], 1), round(a["lon"], 1)]
    except (OSError, ValueError):
        pass
    return None


def main():
    pos = lieu()
    if not pos:
        # Pas une erreur : la page vit sans météo (la collecte ne doit pas échouer pour ça).
        print("Aucun lieu connu (ni sortie GPS, ni lieu dans les réglages) : météo ignorée.")
        return
    r = requests.get("https://api.open-meteo.com/v1/forecast", params={
        "latitude": pos[0], "longitude": pos[1], "timezone": "Europe/Paris", "forecast_days": 2,
        "hourly": "temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m",
    }, timeout=30)
    r.raise_for_status()
    h = r.json()["hourly"]
    heures = {}
    for i, t in enumerate(h["time"]):
        heures[t] = [h["temperature_2m"][i], h["apparent_temperature"][i],
                     h["precipitation_probability"][i], h["wind_speed_10m"][i]]
    sortie = {"collecte": dt.datetime.now(PARIS).isoformat(timespec="minutes"), "lieu": pos, "heures": heures}
    (RACINE / "donnees" / "meteo.json").write_text(json.dumps(sortie, separators=(",", ":")), encoding="utf-8")
    print(f"Météo : {len(heures)} heures pour {pos}")


if __name__ == "__main__":
    main()
