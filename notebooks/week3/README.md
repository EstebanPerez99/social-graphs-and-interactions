# Week 3 — Who matters, and why

The Go Nuts post follows the largest cliques in the undirected Marvel network.
`build_week3.py` is the reproducible pipeline behind the interactive: it finds
all maximum cliques, extracts their shared core, and compares the observed
clique number with 100 degree-preserving edge shuffles.

From the repository root:

```bash
python notebooks/week3/build_week3.py
```

The script writes the same checked artifact to `data/week3/exports/` and to the
Astro site's `src/data/week3/` directory.
