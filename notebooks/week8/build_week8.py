"""Exercise 8.2: run the check our week-1 post was missing.

Week 1 said "fame is one-way traffic": Spider-Man links back to 9 of the 106 articles
that link to him. That claim had no null. Here: a directed degree-preserving null
(double-edge swaps keep every in- and out-degree, no self-loops, no duplicate edges).

Run from the repository root: .venv-week7/bin/python notebooks/week8/build_week8.py
"""
from pathlib import Path
from collections import Counter
import json
import random

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SEED = 8
SAMPLES = 500
SWAPS_PER_EDGE = 10
HUBS = 10


def load():
    edges = [tuple(l.split('\t')) for l in (ROOT / 'data/week1/week1_edges.tsv').read_text().splitlines() if l and not l.startswith('#')]
    assert len(edges) == len(set(edges)) == 1784
    return edges


def reciprocated_in(edges, nodes):
    """For each node: how many of the articles linking to it it links back to."""
    present = set(edges)
    return {n: sum((n, s) in present for s, t in edges if t == n) for n in nodes}


def rewire(edges, rng, swaps):
    # Intercambio dirigido: (a→b, c→d) ⇒ (a→d, c→b). Conserva grado de entrada y salida.
    edges = list(edges); present = set(edges); m = len(edges); done = 0
    while done < swaps:
        i, j = rng.randrange(m), rng.randrange(m)
        (a, b), (c, d) = edges[i], edges[j]
        if a == d or c == b or (a, d) in present or (c, b) in present:
            continue
        present -= {(a, b), (c, d)}; present |= {(a, d), (c, b)}
        edges[i], edges[j] = (a, d), (c, b); done += 1
    return edges


def build():
    edges = load()
    indeg = Counter(t for _, t in edges); outdeg = Counter(s for s, _ in edges)
    hubs = [n for n, _ in sorted(indeg.items(), key=lambda x: (-x[1], x[0]))[:HUBS]]
    observed = reciprocated_in(edges, hubs)
    def mutual(es):
        present = set(es)
        return sum((b, a) in present for a, b in es) / len(es)
    rng = random.Random(SEED)
    null, null_mutual = {h: [] for h in hubs}, []
    for _ in range(SAMPLES):
        g = rewire(edges, rng, SWAPS_PER_EDGE * len(edges))
        for h, v in reciprocated_in(g, hubs).items():
            null[h].append(v)
        null_mutual.append(mutual(g))
    rows = []
    for h in hubs:
        v = np.array(null[h])
        rows.append({'id': h, 'name': h.replace('_', ' '), 'in': indeg[h], 'out': outdeg[h],
                     'observed': observed[h], 'null_mean': float(v.mean()), 'null_sd': float(v.std()),
                     'null_lo': float(np.percentile(v, 2.5)), 'null_hi': float(np.percentile(v, 97.5)),
                     'p_at_least': float((v >= observed[h]).mean())})
    result = {'method': {'null': 'directed double-edge swaps preserving every in- and out-degree; no self-loops or duplicate edges',
                         'samples': SAMPLES, 'swaps_per_edge': SWAPS_PER_EDGE, 'seed': SEED},
              'network': {'edges': len(edges), 'mutual': mutual(edges),
                          'null_mutual_mean': float(np.mean(null_mutual)), 'null_mutual_sd': float(np.std(null_mutual)),
                          'null_mutual_max': float(np.max(null_mutual))},
              'hubs': rows}
    for p in ['data/week8/exports/reciprocity-null.json', 'site/src/data/week8/reciprocity-null.json']:
        dest = ROOT / p; dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(result, indent=1) + '\n')
    print(json.dumps(result, indent=1))


if __name__ == '__main__':
    build()
