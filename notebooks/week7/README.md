# Week 7 · Can text rebuild the link network?

Exercise [7.13](https://sunelehmann.com/socialgraphs2026-web/weeks/week7.html#go-nuts).

```sh
uv venv --python 3.12 .venv-week7
uv pip install --python .venv-week7/bin/python -r requirements-week7.txt
.venv-week7/bin/python notebooks/week7/build_week7.py      # ~1 min, spaCy over 303 pages
.venv-week7/bin/python -m unittest tests.test_week7
```

Inputs: `data/week5/marvel_pages.zip` and the frozen week-1 TSVs. Outputs (byte-identical):
`data/week7/exports/text-vs-links.json` and `site/src/data/week7/text-vs-links.json`.

- Text edge A → B: an `en_core_web_sm` entity span in A (any label) resolves to a unique name of B.
- Names: title without the trailing parenthesis, the parenthesis itself when it is a person name
  (`Black Widow (Natasha Romanova)`), and two-word real names from the lead's first parenthesis.
- Names shared by several pages (Ghost Rider, Spider-Woman, She-Hulk, …) are dropped.
  Alternate-universe pages (Ultimate, Mangaverse, X-Men film series, New Universe) get no names.
- NER recall check: capitalised literal name occurrences, and whether an entity span covers each.
- `READING` in the builder: 30 random text-only edges (seed 7) read in context by the agent.
  **The group should re-read and confirm these labels.**
