"""Collecte Withings — tourne sur GitHub Actions.

Withings change le jeton de rafraîchissement à CHAQUE renouvellement : l'ancien
devient inutilisable. Le nouveau est donc conservé dans le dépôt, chiffré
(etat/withings.enc), avec la clé du secret WITHINGS_CLE. Au tout premier
passage, les jetons viennent du secret WITHINGS_ENV (le fichier .env du
connecteur Withings du Mac).

Conséquence assumée : dès le premier passage ici, le connecteur Withings du Mac
cesse de fonctionner (son jeton est périmé). C'est voulu, il est remplacé.
"""
import base64
import datetime as dt
import hashlib
import json
import os
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from cryptography.fernet import Fernet

RACINE = Path(__file__).resolve().parent.parent
PARIS = ZoneInfo("Europe/Paris")
ETAT = RACINE / "etat" / "withings.enc"
API = "https://wbsapi.withings.net"


def coffre():
    # Clé du coffre : le secret WITHINGS_CLE s'il existe, sinon dérivée de PAGE_KEY
    # (une installation neuve n'a rien de plus à créer).
    cle = os.environ.get("WITHINGS_CLE", "").strip()
    if not cle and os.environ.get("PAGE_KEY", "").strip():
        cle = "withings:" + os.environ["PAGE_KEY"].strip()
    if not cle:
        sys.exit("Ni WITHINGS_CLE ni PAGE_KEY : Withings ignoré.")
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(cle.encode()).digest()))


def lire_etat(f, depuis_env=False):
    if ETAT.exists() and not depuis_env:
        return json.loads(f.decrypt(ETAT.read_bytes()))
    env = os.environ.get("WITHINGS_ENV", "")
    if not env.strip():
        sys.exit("Ni état chiffré ni secret WITHINGS_ENV : Withings ignoré.")
    vals = {}
    for ligne in env.splitlines():
        if "=" in ligne and not ligne.strip().startswith("#"):
            k, v = ligne.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    return {
        "client_id": vals.get("WITHINGS_CLIENT_ID"),
        "client_secret": vals.get("WITHINGS_CLIENT_SECRET"),
        "refresh_token": vals.get("WITHINGS_REFRESH_TOKEN"),
    }


def ecrire_etat(f, etat):
    ETAT.parent.mkdir(parents=True, exist_ok=True)
    ETAT.write_bytes(f.encrypt(json.dumps(etat).encode()))


def demander(etat):
    return requests.post(f"{API}/v2/oauth2", data={
        "action": "requesttoken",
        "grant_type": "refresh_token",
        "client_id": etat["client_id"],
        "client_secret": etat["client_secret"],
        "refresh_token": etat["refresh_token"],
    }, timeout=30).json()


def renouveler(f, etat):
    """Renvoie (jeton d'accès, état à jour). Si le jeton enregistré est refusé
    (une nouvelle autorisation a été faite ailleurs, par exemple sur le Mac),
    on repart du secret WITHINGS_ENV : il suffit alors de le mettre à jour."""
    # Jeton neuf déposé par le bouton « Reconnecter Withings » de la page : il passe en premier.
    neuf_page = RACINE / "etat" / ".withings-neuf.json"
    if neuf_page.exists():
        base = lire_etat(f, depuis_env=True)
        base["refresh_token"] = json.loads(neuf_page.read_text())["refresh_token"]
        r = demander(base)
        if r.get("status") == 0:
            print("Withings reconnecté depuis la page.")
            base["refresh_token"] = r["body"]["refresh_token"]
            return r["body"]["access_token"], base
        print(f"Jeton de la page refusé (status {r.get('status')}) : essai avec le jeton enregistré.")
    if not etat.get("refresh_token"):
        sys.exit("Withings pas encore connecté : page du coach → réglages (L) → « Montres et données » → « Reconnecter Withings ».")
    r = demander(etat)
    if r.get("status") != 0 and ETAT.exists():
        neuf = lire_etat(f, depuis_env=True)
        if neuf.get("refresh_token") and neuf["refresh_token"] != etat.get("refresh_token"):
            print("Jeton enregistré refusé : nouvel essai avec le secret WITHINGS_ENV.")
            etat, r = neuf, demander(neuf)
    if r.get("status") != 0:
        sys.exit(f"Renouvellement Withings refusé (status {r.get('status')}) : l'autorisation n'est plus valable. "
                 "Page du coach → réglages (L) → « Reconnecter Withings ».")
    etat["refresh_token"] = r["body"]["refresh_token"]
    return r["body"]["access_token"], etat


def appel(jeton, chemin, params):
    try:
        r = requests.post(f"{API}{chemin}", data=params,
                          headers={"Authorization": f"Bearer {jeton}"}, timeout=30).json()
        return r.get("body", r) if r.get("status") == 0 else {"erreur": r}
    except Exception as e:
        return {"erreur": f"{type(e).__name__}: {e}"}


def main():
    f = coffre()
    etat = lire_etat(f)
    jeton, etat = renouveler(f, etat)
    ecrire_etat(f, etat)  # tout de suite : le jeton précédent est déjà mort

    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    # Une date seule couvre les 3 derniers jours ; une plage debut:fin est lue d'un seul appel.
    a, _, b = arg.partition(":")
    jour = dt.date.fromisoformat(b or a) if arg else dt.datetime.now(PARIS).date()
    debut = a if b else (jour - dt.timedelta(days=2)).isoformat()
    ligne = {
        "collecte": dt.datetime.now(PARIS).isoformat(timespec="minutes"),
        "date": jour.isoformat(),
        "sommeil": appel(jeton, "/v2/sleep", {
            "action": "getsummary", "startdateymd": debut, "enddateymd": jour.isoformat(),
            "data_fields": "total_sleep_time,total_timeinbed,sleep_score,deepsleepduration,"
                           "lightsleepduration,remsleepduration,wakeupcount,wakeupduration,"
                           "hr_average,hr_min,rr_average,sleep_efficiency"}),
        "activite": appel(jeton, "/v2/measure", {
            "action": "getactivity", "startdateymd": debut, "enddateymd": jour.isoformat()}),
    }
    dossier = RACINE / "donnees" / "withings"
    dossier.mkdir(parents=True, exist_ok=True)
    with open(dossier / f"{jour.isoformat()[:7]}.jsonl", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(ligne, ensure_ascii=False) + "\n")
    print(f"Withings {jour} : sommeil {'ok' if 'erreur' not in ligne['sommeil'] else 'ÉCHEC'}, "
          f"activité {'ok' if 'erreur' not in ligne['activite'] else 'ÉCHEC'}")


if __name__ == "__main__":
    main()
