# Week 8 · The check our week-1 post was missing

Exercise [8.2](https://sunelehmann.com/socialgraphs2026-web/weeks/week8.html). Same environment as week 7.

```sh
.venv-week7/bin/python notebooks/week8/build_week8.py      # ~15 s, 500 rewirings
```

Directed double-edge swaps (a→b, c→d ⇒ a→d, c→b), 10 per edge, seed 8; every in- and out-degree
preserved, no self-loops or duplicates. For the ten highest in-degree characters: how many linking
articles they link back to, observed vs null. Retraction criterion, fixed before running: if the hubs
link back no less than the null, the week-1 "fame is one-way traffic" claim goes. Outcome: retracted.
Outputs: `data/week8/exports/reciprocity-null.json` and the identical site copy.
