# Week 4 — Communities & backbones

The Go Nuts post (exercise 4.13) turns one dial: the disparity-filter significance α on the
weighted philosophers network. `build_week4.py` is the reproducible pipeline behind the 3D
opener: it implements the filter from scratch, reproduces the course table, colours by
Louvain on the full unweighted giant (with a 20-shuffle null and a five-seed NMI check),
sweeps α downward to find every chunk the giant loses and the link that last held it, and
compares the first break against 50 weight-shuffled and 50 rewired networks.

From the repository root:

```bash
.venv/bin/python notebooks/week4/build_week4.py             # JSON only (~30 s)
.venv/bin/python notebooks/week4/build_week4.py --figures   # + the three static figures
.venv/bin/python -m unittest tests.test_week4_backbone      # the course checkpoints
```

The script writes `data/week4/exports/backbone-snap.json` and the same file to
`site/src/data/week4/`; figures go to `figures/week4/` and `site/src/assets/week4/`.
`4.13-go-nuts.ipynb` runs the same functions and shows the figures inline.

Published seed: `20260923` (Louvain, both nulls, layouts).
