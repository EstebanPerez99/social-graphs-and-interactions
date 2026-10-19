# Week 6 · Two perspectives on the Marvel universe

Exercise [6.11](https://sunelehmann.com/socialgraphs2026-web/weeks/week6.html#go-nuts).

Questions:

1. Who is textually close but structurally far away?
2. Do link-network communities also share similar article language?

## Environment and reproduction

Use Python 3.12+ in a dedicated environment. Do not mix this environment with the
older course-wide requirements lock, which is retained for previous weeks.

```sh
python3 -m venv .venv-week6
.venv-week6/bin/python -m pip install -r requirements-week6.txt
.venv-week6/bin/python notebooks/week6/build_week6.py
.venv-week6/bin/python -m unittest tests.test_week6_perspectives
cd site
npm ci
npm run check
npm run build
npm run dev -- --background
```

Open `/social-graphs-and-interactions/posts/week6/` on the printed local server.
The page follows Week 2’s immersive layout and paper background. Its steps are
Question → Language → Structure → Compare → Conclude. The opening scene reuses
Week 2’s network coordinates; the comparison retains the documented dual lanes.
In your notebook editor, select the repository's `.venv-week6/bin/python` as the
kernel; `ipykernel` is included without changing any global Jupyter installation.
Manage it with `npm run dev -- status`, `npm run dev -- logs`, and
`npm run dev -- stop`. The notebook `6.11-go-nuts.ipynb` runs the same builder.

## Data and measurements

The official [course data page](https://sunelehmann.com/socialgraphs2026-web/data/)
recommends `marvel_pages.zip` for weeks 5–8, joined by decoded `node_id` to the
week-1 roster and directed links. We reused the existing repository files and
verified all three byte-for-byte against official downloads on 19 October 2026.
SHA-256 hashes and library versions are embedded in the exports. The snapshot is
26 August 2026. All 303 roster nodes are retained, including 17 network isolates.

Text: all supplied text, lowercased alphabetic tokens of at least two letters,
scikit-learn English stopwords, `min_df=2`. TF is raw counts; smoothed IDF is
`ln((1+N)/(1+df)) + 1`; document vectors are L2-normalized. Cosine is calculated
in that original space for every pair, never from the 3D coordinates. A second
refit removes words capitalized in a majority of their occurrences. This is the
course's name heuristic, not a clean removal of all and only names.

Structure: symmetrize the frozen directed links and remove self-loops. Use
unweighted Louvain with seed 7 and resolution 1. A path can traverse either link
direction. A disconnected pair receives null, never a fabricated large distance.

Text communities: union the top eight positive-cosine neighbors of every article,
keep cosine as the edge weight, run weighted Louvain with the same seed and
resolution. Equal scores break by sorted node ID. Refit the text graph at k=5 and
k=12 and report NMI to expose sensitivity. These choices define communities, not
ground-truth teams. Color codes refer to each partition independently.

## Two camera views, one fixed layout

Coordinates deliberately encode **categorical community lanes**: y separates
structural groups, z separates textual groups, and x is seeded jitter. Small
within-lane offsets keep points readable. Looking down y shows text groups;
looking down z shows structural groups. All characters keep their 3D coordinates
during camera rotation. This is not a force layout, metric embedding, or a claim
that apparent point distances equal cosine or graph distances.

The 17 unlinked characters share a grey *display* lane but remain separate
singleton communities for statistics and NMI. Other small components retain their
own communities. The white selection segment is a visual comparison guide, not
an extra network edge. Optional context edges show either the similarity graph or
symmetrized Wikipedia links. Reduced-motion settings snap camera presets.

## Interpretation

Suggested pairs are the highest-cosine pairs with finite shortest path >=3;
disconnected pairs are ranked separately. Three hops is an operational choice,
not proof of extreme network separation. The inspector can compare any pair.
Term contributions are products of normalized TF-IDF coordinates, so their sum
over *all* shared terms equals cosine. Displayed terms are only the largest eight.

Within/across-community means and partition NMI are descriptive. Pairs share
articles and are not independent observations. Full articles include names,
publication history and boilerplate. Check excerpts and frozen raw pages before
telling a story about fictional characters. Group editorial review remains open.
