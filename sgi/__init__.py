"""Herramientas compartidas del curso 02805 — Social Graphs and Interactions.

Uso desde cualquier notebook:

    import sgi
    G, nodes = sgi.load_marvel(week=1)
    table = sgi.degree_table(G, nodes)
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
FIGURES = ROOT / "figures"
SITE = ROOT / "site"

from .data import load_marvel                                              # noqa: E402
from .degree import degree_table, top, raw_distribution, goodies_bins       # noqa: E402
from .plots import set_style, plot_distribution, degree_panels, PALETTE     # noqa: E402
from .graph import draw                                                    # noqa: E402
from .export import save_fig, save_json, save_table                         # noqa: E402
from .wiki import fetch_thumbnails                                         # noqa: E402

__all__ = [
    "ROOT", "DATA", "FIGURES", "SITE",
    "load_marvel",
    "degree_table", "top", "raw_distribution", "goodies_bins",
    "set_style", "plot_distribution", "degree_panels", "PALETTE",
    "draw",
    "save_fig", "save_json", "save_table",
    "fetch_thumbnails",
]
