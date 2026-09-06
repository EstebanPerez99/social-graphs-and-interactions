"""Wikipedia API: miniaturas de los artículos (con caché en data/weekN/exports/thumbnails.json)."""
import json
import re
import time

import requests

from . import DATA

API = "https://en.wikipedia.org/w/api.php"
UA = {"User-Agent": "SocialGraphsTeam/1.0 (DTU 02805 student project; https://github.com/EstebanPerez99/social-graphs-and-interactions)"}


def fetch_thumbnails(titles, week: int = 1, size: int = 400, refresh: bool = False) -> dict[str, str]:
    """{node_id: url} para los títulos que tienen imagen principal. Cachea el resultado.

    Usa pilicense=any: la mayoría de los personajes Marvel solo tienen arte de portada (no libre),
    que Wikipedia muestra bajo fair use. Las URLs se limpian de parámetros de tracking.
    """
    cache = DATA / f"week{week}" / "exports" / "thumbnails.json"
    if cache.exists() and not refresh:
        return json.loads(cache.read_text())

    out = {}
    titles = list(titles)
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        r = requests.get(API, headers=UA, timeout=30, params={
            "action": "query", "prop": "pageimages", "piprop": "thumbnail", "pithumbsize": size,
            "pilicense": "any", "titles": "|".join(batch), "format": "json", "formatversion": 2, "redirects": 1})
        r.raise_for_status()
        q = r.json()["query"]
        norm = {n["to"]: n["from"] for n in q.get("normalized", [])}
        redir = {n["to"]: n["from"] for n in q.get("redirects", [])}
        for p in q["pages"]:
            t = p["title"]
            orig = norm.get(redir.get(t, t), redir.get(t, t)).replace(" ", "_")
            if "thumbnail" in p:
                out[orig] = re.sub(r"\?.*$", "", p["thumbnail"]["source"])
        time.sleep(0.3)
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(out, indent=0))
    return out
