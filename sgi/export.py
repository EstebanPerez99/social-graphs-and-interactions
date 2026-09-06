"""Exportar resultados: figuras a figures/, datos a data/…/exports, y copia al sitio si existe."""
import json
import shutil
from pathlib import Path

from . import DATA, FIGURES, SITE


def _jsonable(o):
    if hasattr(o, "item"):          # numpy scalars
        return o.item()
    if hasattr(o, "tolist"):        # numpy arrays
        return o.tolist()
    return str(o)


def save_fig(fig, name: str, week: int, formats=("svg", "png")) -> list[Path]:
    """Guarda en figures/weekN/ y, si hay sitio, también en site/src/assets/weekN/."""
    out = FIGURES / f"week{week}"
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for ext in formats:
        p = out / f"{name}.{ext}"
        fig.savefig(p)
        paths.append(p)
    if SITE.exists():
        assets = SITE / "src" / "assets" / f"week{week}"
        assets.mkdir(parents=True, exist_ok=True)
        for p in paths:
            shutil.copy(p, assets / p.name)
    return paths


def save_json(obj, name: str, week: int) -> Path:
    """Guarda en data/weekN/exports/ y, si hay sitio, también en site/src/data/weekN/ (se importa en build)."""
    out = DATA / f"week{week}" / "exports"
    out.mkdir(parents=True, exist_ok=True)
    p = out / f"{name}.json"
    p.write_text(json.dumps(obj, ensure_ascii=False, default=_jsonable), encoding="utf-8")
    if SITE.exists():
        pub = SITE / "src" / "data" / f"week{week}"
        pub.mkdir(parents=True, exist_ok=True)
        shutil.copy(p, pub / p.name)
    return p


def save_table(df, name: str, week: int) -> Path:
    """CSV en data/weekN/exports/ + JSON (records) para el sitio."""
    out = DATA / f"week{week}" / "exports"
    out.mkdir(parents=True, exist_ok=True)
    p = out / f"{name}.csv"
    df.to_csv(p, index=False)
    save_json(df.to_dict(orient="records"), name, week)
    return p
