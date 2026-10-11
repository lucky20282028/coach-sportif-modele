"""Analyse d'une sortie à partir du fichier FIT d'origine de la montre.

On ne garde pas la trace seconde par seconde : seulement ce qu'il faut pour
répondre à « le plafond a-t-il été tenu ? » et « à quelle allure mon cœur
est-il à 140 ? », et pour dessiner la sortie sur la page.

Produit (compact, quelques Ko) :
  km     : un enregistrement par kilomètre (le dernier, partiel, s'il fait ≥ 200 m)
           {n, m (mètres), s (secondes en mouvement), fc (moyenne), fcmax, dp (dénivelé +)}
  hist   : secondes en mouvement par tranche de 5 bpm  {"135": 412, "140": 380, …}
  serie  : un point toutes les 15 s de mouvement  [t (s), d (m), fc]
  duree_s, distance_m, fc_moy, fc_max, deniv_pos

Testé par collecte/banc_sortie.py sur de vrais fichiers FIT de montres Garmin.
"""
import io
import zipfile

PAUSE_S = 10        # au-delà, l'écart entre deux points est une pause (feu rouge, arrêt)
PAS_SERIE = 15      # secondes de mouvement entre deux points de la série
HYST_M = 2.0        # dénivelé : variation minimale comptée


def extraire_fit(brut: bytes) -> bytes:
    """Garmin renvoie l'original dans une archive ZIP."""
    if brut[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(brut)) as zf:
            for nom in zf.namelist():
                if nom.lower().endswith(".fit"):
                    return zf.read(nom)
    return brut


SEMI = 180 / 2 ** 31  # semi-cercles FIT → degrés


def depart(fit_bytes: bytes):
    """Lieu de départ arrondi au dixième de degré (~10 km) : assez pour la météo,
    trop flou pour situer un domicile."""
    import fitparse
    ff = fitparse.FitFile(io.BytesIO(extraire_fit(fit_bytes)))
    for msg in ff.get_messages("record"):
        v = {d.name: d.value for d in msg}
        la, lo = v.get("position_lat"), v.get("position_long")
        if la is not None and lo is not None:
            if abs(la) > 180 or abs(lo) > 180:      # encore en semi-cercles
                la, lo = la * SEMI, lo * SEMI
            return [round(la, 1), round(lo, 1)]
    return None


def points(fit_bytes: bytes):
    """[(datetime UTC, distance m | None, fc | None, altitude m | None)] dans l'ordre."""
    import fitparse
    ff = fitparse.FitFile(io.BytesIO(extraire_fit(fit_bytes)))
    out = []
    for msg in ff.get_messages("record"):
        v = {}
        for d in msg:
            v[d.name] = d.value
        ts = v.get("timestamp")
        if ts is None:
            continue
        dist = v.get("distance")
        fc = v.get("heart_rate")
        alt = v.get("enhanced_altitude", v.get("altitude"))
        out.append((ts, float(dist) if dist is not None else None,
                    int(fc) if fc else None, float(alt) if alt is not None else None))
    return out


def analyser(pts):
    """Calcule le résumé compact à partir des points (voir l'en-tête du module)."""
    if len(pts) < 2:
        return None
    km, hist, serie = [], {}, []
    t_mvt = 0.0                       # secondes en mouvement depuis le départ
    d_prec = None
    alt_prec = None
    deniv = 0.0
    # accumulateurs du kilomètre en cours
    k_s = 0.0; k_fc = 0.0; k_fcs = 0.0; k_fcmax = 0; k_dp = 0.0; k_debut_d = 0.0
    prochain_pt = 0.0
    fc_tot = 0.0; fc_s = 0.0; fc_max = 0
    d_fin = 0.0
    for i in range(1, len(pts)):
        t0, d0, fc0, a0 = pts[i - 1]
        t1, d1, fc1, a1 = pts[i]
        dt = (t1 - t0).total_seconds()
        if dt <= 0:
            continue
        if d1 is None:
            d1 = d0 if d0 is not None else d_prec
        if d0 is None:
            d0 = d_prec
        if d1 is None or d0 is None:
            continue
        d_prec = d1
        dd = max(0.0, d1 - d0)
        # Pause (feu rouge, arrêt) : un long écart SANS avancer. Un long écart en
        # avançant, c'est l'enregistrement « intelligent » de la montre : on le garde.
        if dt > 300 or (dt > PAUSE_S and dd / dt < 0.5):
            alt_prec = a1 if a1 is not None else alt_prec
            continue
        fc = fc1 or fc0
        # dénivelé positif avec hystérésis de 2 m : le bruit de l'altimètre ne compte pas
        if a1 is not None:
            if alt_prec is None:
                alt_prec = a1
            elif a1 - alt_prec >= HYST_M:
                deniv += a1 - alt_prec
                k_dp += a1 - alt_prec
                alt_prec = a1
            elif alt_prec - a1 >= HYST_M:
                alt_prec = a1
        t_mvt += dt
        k_s += dt
        if fc:
            k_fc += fc * dt; k_fcs += dt; k_fcmax = max(k_fcmax, fc)
            fc_tot += fc * dt; fc_s += dt; fc_max = max(fc_max, fc)
            b = str(int(fc // 5 * 5))
            hist[b] = hist.get(b, 0) + dt
        # franchissement d'un kilomètre : on coupe au prorata
        while d1 >= (len(km) + 1) * 1000:
            borne = (len(km) + 1) * 1000
            frac = (borne - d0) / dd if dd > 0 else 1.0
            reste = (1 - frac) * dt
            s_km = k_s - reste
            km.append({"n": len(km) + 1, "m": 1000, "s": round(s_km, 1),
                       "fc": round(k_fc / k_fcs) if k_fcs else None,
                       "fcmax": k_fcmax or None, "dp": round(k_dp)})
            k_s = reste; k_dp = 0.0; k_debut_d = borne
            k_fc = (fc * reste) if fc else 0.0; k_fcs = reste if fc else 0.0; k_fcmax = fc or 0
        while t_mvt >= prochain_pt:
            serie.append([round(prochain_pt), round(d1), fc])
            prochain_pt += PAS_SERIE
        d_fin = d1
    if d_fin - k_debut_d >= 200 and k_s > 0:
        km.append({"n": len(km) + 1, "m": round(d_fin - k_debut_d), "s": round(k_s, 1),
                   "fc": round(k_fc / k_fcs) if k_fcs else None,
                   "fcmax": k_fcmax or None, "dp": round(k_dp), "partiel": True})
    return {
        "distance_m": round(d_fin),
        "duree_s": round(t_mvt),
        "fc_moy": round(fc_tot / fc_s) if fc_s else None,
        "fc_max": fc_max or None,
        "deniv_pos": round(deniv),
        "km": km,
        "hist": {k: round(v) for k, v in sorted(hist.items(), key=lambda x: int(x[0]))},
        "serie": serie,
    }
