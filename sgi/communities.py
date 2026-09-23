"""Comunidades: Louvain con semilla, NMI desde la definición y nombres por fuerza."""
import math
from collections import Counter

import networkx as nx


def louvain(G: nx.Graph, seed: int, weight: str | None = None) -> dict:
    """Partición de Louvain como {nodo: id}, ids 0.. ordenados por tamaño descendente.

    Por defecto sin pesos (weight=None): la regla 3 del curso colorea con la red completa
    sin pesos, no con el backbone.
    """
    comms = nx.community.louvain_communities(G, weight=weight, seed=seed)
    comms = sorted(comms, key=lambda c: (-len(c), min(c)))
    return {n: i for i, c in enumerate(comms) for n in c}


def modularity(G: nx.Graph, part: dict, weight: str | None = None) -> float:
    groups: dict = {}
    for n, c in part.items():
        groups.setdefault(c, set()).add(n)
    return nx.community.modularity(G, groups.values(), weight=weight)


def _entropy(counts, n):
    return -sum(c / n * math.log(c / n) for c in counts if c)


def nmi(a, b) -> float:
    """NMI con normalización aritmética: 2 I(A;B) / (H(A) + H(B)).

    `a` y `b` son dos etiquetados de los mismos elementos (listas alineadas o dicts con las
    mismas claves). Es la misma definición que el valor por defecto de scikit-learn.
    """
    if isinstance(a, dict):
        keys = list(a)
        a, b = [a[k] for k in keys], [b[k] for k in keys]
    n = len(a)
    ca, cb, cab = Counter(a), Counter(b), Counter(zip(a, b))
    ha, hb = _entropy(ca.values(), n), _entropy(cb.values(), n)
    if ha == 0 and hb == 0:
        return 1.0
    mi = sum(c / n * math.log(c * n / (ca[x] * cb[y])) for (x, y), c in cab.items())
    return 2 * mi / (ha + hb)


def top_members(part: dict, score: dict, k: int = 3) -> dict:
    """Los k miembros con mayor `score` (p. ej. fuerza) de cada comunidad."""
    out: dict = {}
    for n in sorted(part, key=lambda n: -score[n]):
        out.setdefault(part[n], [])
        if len(out[part[n]]) < k:
            out[part[n]].append(n)
    return out
