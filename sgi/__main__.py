"""Andamiaje semanal:  python -m sgi new-week 2  [--topic "Models & null models"]

Crea notebooks/weekN/, data/weekN/, figures/weekN/ y el post borrador site/src/content/posts/weekN.mdx.
El post nace con `draft: true`: no aparece en el sitio hasta que lo quites.
"""
import argparse
import datetime as dt
import sys

import nbformat as nbf

from . import DATA, FIGURES, ROOT, SITE

SCHEDULE = {  # misma secuencia que site/src/site.config.ts
    1: ("Networks", "2026-09-02"), 2: ("Models & null models", "2026-09-09"),
    3: ("Who matters, and why", "2026-09-16"), 4: ("Communities & backbones", "2026-09-23"),
    5: ("NLP I", "2026-09-30"), 6: ("NLP II", "2026-10-07"),
    7: ("NLP III", "2026-10-21"), 8: ("Networks × language", "2026-10-28"),
}

POST = '''---
title: "Week {n}: working title"
description: "One sentence: what we asked and what we found."
week: {n}
topic: "{topic}"
date: {due}
dataset: "TODO"
draft: true
---
import Figure from "../../components/Figure.astro";
import Stats from "../../components/Stats.astro";
import Interactive from "../../components/Interactive.astro";
import DegreePlot from "../../components/DegreePlot";
import NetworkGraph from "../../components/NetworkGraph";

## What we asked

## What we did

<Stats items={{[
  {{ value: "—", label: "nodes" }},
  {{ value: "—", label: "edges" }},
]}} />

## The figure

{{/* <Figure src={{fig.src}} alt="" caption="" wide /> */}}

## What surprised us

## Methods and AI

What the agent did, what we verified by hand, and what we did not verify — see `AI_METHODS.md`.
'''


def notebook(n: int, topic: str):
    md, code = nbf.v4.new_markdown_cell, nbf.v4.new_code_cell
    nb = nbf.v4.new_notebook()
    nb.cells = [
        md(f"# {n}.8 — Go nuts with your LLM 🚀 Builder · grupo\n\n**Semana {n} · {topic}**\n\n"
           "Pipeline reproducible del post: carga → cálculo → figuras y JSON para el sitio.\n\n**Pregunta:** _TODO_"),
        code("import numpy as np, pandas as pd, networkx as nx\nimport matplotlib.pyplot as plt\nimport sgi\nsgi.set_style()\n\n"
             f"# Si el dataset de la semana {n} tiene el mismo formato que el de la semana 1:\n"
             f"# G, nodes = sgi.load_marvel(week={n})\n"
             f"# Si no, cárgalo aquí y documenta el formato en data/week{n}/README.md"),
        md("## Análisis"),
        code("# TODO"),
        md("## Exportar lo que consume el sitio"),
        code(f"# fig = ...\n# sgi.save_fig(fig, 'nombre', week={n})     -> figures/week{n}/ + site/src/assets/week{n}/\n"
             f"# sgi.save_json(obj, 'nombre', week={n})    -> data/week{n}/exports/ + site/src/data/week{n}/"),
    ]
    nb.metadata = {"kernelspec": {"display_name": "Python (Social Graphs)", "language": "python", "name": "social-graphs"},
                   "language_info": {"name": "python"}}
    return nb


def new_week(n: int, topic: str | None):
    topic_default, class_date = SCHEDULE.get(n, (f"Week {n}", None))
    topic = topic or topic_default
    due = (dt.date.fromisoformat(class_date) + dt.timedelta(days=5)).isoformat() if class_date else dt.date.today().isoformat()

    created = []
    for d in (ROOT / "notebooks" / f"week{n}", DATA / f"week{n}", FIGURES / f"week{n}"):
        d.mkdir(parents=True, exist_ok=True); created.append(d)
    readme = DATA / f"week{n}" / "README.md"
    if not readme.exists():
        readme.write_text(f"# Week {n} data\n\nDescarga los archivos de https://sunelehmann.com/socialgraphs2026-web/data/ aquí.\n")
        created.append(readme)
    nbp = ROOT / "notebooks" / f"week{n}" / f"{n}.8-go-nuts.ipynb"
    if not nbp.exists():
        nbf.write(notebook(n, topic), nbp); created.append(nbp)
    post = SITE / "src" / "content" / "posts" / f"week{n}.mdx"
    if not post.exists():
        post.write_text(POST.format(n=n, topic=topic, due=due)); created.append(post)

    print(f"Semana {n} · {topic} · post due {due}")
    for p in created:
        print("  +", p.relative_to(ROOT))
    print("\nSiguiente: descarga los datos a data/week%d/, corre el notebook, escribe el post y quita `draft: true`." % n)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="python -m sgi")
    sub = ap.add_subparsers(dest="cmd", required=True)
    nw = sub.add_parser("new-week", help="crear el andamiaje de una semana")
    nw.add_argument("week", type=int)
    nw.add_argument("--topic")
    a = ap.parse_args(argv)
    if a.cmd == "new-week":
        new_week(a.week, a.topic)


if __name__ == "__main__":
    sys.exit(main())
