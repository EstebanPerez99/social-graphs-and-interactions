"""Reproduce the Week 4 backbone analysis and the website data artifact.

Run from the repository root with ``python notebooks/week4/build_week4.py``.

One dial: the disparity-filter significance alpha on the weighted philosophers
network. Every link gets ``alpha_min`` (the smaller of its two endpoint p-values),
so the backbone at any alpha is just ``alpha_min < alpha``. Sweeping alpha from 1
down, we record when the giant component loses a chunk, which tradition the chunk
is, and which links were the last thread. Two nulls answer "compared to what":
weights shuffled over the same topology, and degree-preserving rewiring that
carries the weights along. Every random step uses the published seed.
"""
from __future__ import annotations

import json
import math
import random
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

import networkx as nx
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from sgi.backbone import (  # noqa: E402
    backbone_row, disparity_alpha, disparity_filter, naive_threshold, strength,
)
from sgi.communities import louvain, modularity, nmi, top_members  # noqa: E402
from sgi.data import load_philosophers  # noqa: E402
from sgi.plots import PALETTE  # noqa: E402

SEED = 20260923
COURSE_ALPHAS = (0.05, 0.1, 0.2, 0.3, 0.5)
THRESHOLDS = (2, 3, 4)
LAYOUT_ALPHA = 0.2
STABILITY_SEEDS = (SEED, SEED + 1, SEED + 2, SEED + 3, SEED + 4)
NULL_Q_SAMPLES = 20
NULL_SWEEP_SAMPLES = 50
SWAPS_PER_EDGE = 10
BREAK_SIZE = 20       # a "break": the giant loses at least this many philosophers at once
LOG_SIZE = 5          # smaller chunks still go in the break log

# Names come from reading each community's strongest members (see the notebook);
# the key is the community's highest-strength philosopher under the published seed.
TRADITIONS = {
    "Immanuel_Kant": "German philosophy",
    "Gottfried_Wilhelm_Leibniz": "Early modern Europe",
    "Aristotle": "Aristotle and the Latin West",
    "Bertrand_Russell": "British and American moderns",
    "Plato": "Greek and Roman antiquity",
    "Madhvacharya": "Indian philosophy",
    "Avicenna": "Islamic and Jewish philosophy",
    "Confucius": "Chinese philosophy",
}


# ---------------------------------------------------------------------------
# The sweep
# ---------------------------------------------------------------------------

def sweep(nodes, alpha_min: dict[tuple, float], min_size: int = LOG_SIZE):
    """Remove links from the highest alpha_min down and log every chunk the giant loses.

    Implemented in the opposite direction (union-find, adding links from the lowest
    alpha_min up) because merges are cheap and splits are not. Links with equal
    alpha_min vanish together, so they are processed as one group: a group of tied
    links is exactly one step of the dial. Returns (events, curve) where curve is
    [(alpha, giant size just above alpha)] for every distinct alpha.
    """
    parent = {n: n for n in nodes}
    members = {n: [n] for n in nodes}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    groups = defaultdict(list)
    for edge, a in alpha_min.items():
        groups[a].append(edge)

    events, curve, largest = [], [], 1
    for a in sorted(groups):
        links = groups[a]
        pre = {find(x): None for edge in links for x in edge}
        top = max(pre, key=lambda r: len(members[r]))
        size_before = {r: len(members[r]) for r in pre}
        snapshot = {r: list(members[r]) for r in pre if r != top}

        for u, v in links:
            ru, rv = find(u), find(v)
            if ru == rv:
                continue
            if len(members[ru]) < len(members[rv]):
                ru, rv = rv, ru
            parent[rv] = ru
            members[ru].extend(members.pop(rv))

        big = max({find(r) for r in pre}, key=lambda r: len(members[r]))
        if len(members[big]) >= largest:
            # Read backwards: just above alpha the giant is `big`; at alpha it falls
            # into the pieces that existed before this group was added.
            pieces = sorted((r for r in pre if find(r) == big), key=lambda r: -size_before[r])
            for r in pieces[1:]:
                if size_before[r] >= min_size:
                    chunk = set(snapshot[r])
                    events.append({
                        "alpha": a,
                        "size": size_before[r],
                        "members": sorted(chunk),
                        "bridge": sorted((u, v) if u < v else (v, u)
                                         for u, v in links if (u in chunk) != (v in chunk)),
                        "giant_after": size_before[pieces[0]],
                    })
        largest = max(largest, len(members[big]))
        curve.append((a, largest))
    events.sort(key=lambda e: (-e["alpha"], -e["size"]))
    return events, curve


def giant_below(curve, n: int, share: float = 0.5) -> float:
    """The alpha at which the giant first holds fewer than share * n philosophers."""
    return min(a for a, size in curve if size >= share * n)


def first_break(events):
    return next((e for e in events if e["size"] >= BREAK_SIZE), None)


# ---------------------------------------------------------------------------
# Nulls
# ---------------------------------------------------------------------------

def shuffled_weights(G: nx.Graph, rng: random.Random) -> nx.Graph:
    """Null A: same links, weights permuted across them (degree kept, strength not)."""
    H = G.copy()
    weights = [d["weight"] for _, _, d in G.edges(data=True)]
    rng.shuffle(weights)
    for (u, v), w in zip(H.edges(), weights):
        H[u][v]["weight"] = w
    return H


def rewired_with_weights(G: nx.Graph, rng: random.Random, swaps: int) -> nx.Graph:
    """Null B: double-edge swaps (a-b, c-d) -> (a-d, c-b), each link keeping its weight.

    Degree sequence is preserved exactly; a and c keep their strength, b and d trade.
    """
    edges = [(u, v, d["weight"]) for u, v, d in G.edges(data=True)]
    present = {frozenset((u, v)) for u, v, _ in edges}
    done = tries = 0
    while done < swaps and tries < 100 * swaps:
        tries += 1
        i, j = rng.randrange(len(edges)), rng.randrange(len(edges))
        if i == j:
            continue
        a, b, wi = edges[i]
        c, d, wj = edges[j]
        if rng.random() < 0.5:
            c, d = d, c
        if len({a, b, c, d}) < 4:
            continue
        if frozenset((a, d)) in present or frozenset((c, b)) in present:
            continue
        present -= {frozenset((a, b)), frozenset((c, d))}
        present |= {frozenset((a, d)), frozenset((c, b))}
        edges[i], edges[j] = (a, d, wi), (c, b, wj)
        done += 1
    H = nx.Graph()
    H.add_nodes_from(G)
    H.add_weighted_edges_from(edges)
    return H


def null_sweep(G: nx.Graph, part: dict, kind: str, samples: int) -> dict:
    rng = random.Random(SEED)
    degree = sorted(d for _, d in G.degree())
    rows = []
    for _ in range(samples):
        if kind == "weights":
            H = shuffled_weights(G, rng)
        else:
            H = rewired_with_weights(G, rng, SWAPS_PER_EDGE * G.number_of_edges())
        assert sorted(d for _, d in H.degree()) == degree
        events, curve = sweep(list(H), disparity_alpha(H))
        brk = first_break(events)
        share, community = dominant(brk["members"], part) if brk else (None, None)
        rows.append({
            "first_break_alpha": brk["alpha"] if brk else None,
            "first_break_size": brk["size"] if brk else None,
            "first_break_community": community,
            "first_break_purity": share,
            "half_alpha": giant_below(curve, H.number_of_nodes()),
        })
    alphas = [r["first_break_alpha"] for r in rows if r["first_break_alpha"] is not None]
    return {
        "samples": samples,
        "no_break": samples - len(alphas),
        "rows": rows,
        "first_break_alpha_mean": statistics.mean(alphas),
        "first_break_alpha_sd": statistics.pstdev(alphas),
        "half_alpha_mean": statistics.mean(r["half_alpha"] for r in rows),
        "half_alpha_sd": statistics.pstdev(r["half_alpha"] for r in rows),
    }


def dominant(members, part: dict) -> tuple[float, int]:
    counts = Counter(part[n] for n in members)
    community, count = counts.most_common(1)[0]
    return count / len(members), community


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------

def layout_3d(giant: nx.Graph, alpha_min: dict) -> dict:
    """Rule 2: lay out the alpha = 0.2 backbone, then place everyone else among
    their neighbours without moving the backbone. Scaled into the unit ball."""
    backbone = disparity_filter(giant, LAYOUT_ALPHA, alpha_min=alpha_min)
    pos = nx.spring_layout(backbone, dim=3, seed=SEED, weight=None, iterations=200)
    pos = nx.spring_layout(giant, dim=3, seed=SEED, weight=None, pos=pos,
                           fixed=list(pos), iterations=100)
    xyz = np.array([pos[n] for n in giant])
    xyz -= xyz.mean(axis=0)
    xyz /= np.percentile(np.linalg.norm(xyz, axis=1), 98)
    return {n: xyz[i] for i, n in enumerate(giant)}


# ---------------------------------------------------------------------------
# The artifact
# ---------------------------------------------------------------------------

def community_analysis(giant: nx.Graph):
    part = louvain(giant, SEED)
    q = modularity(giant, part)

    runs = [louvain(giant, s) for s in STABILITY_SEEDS]
    nmi_matrix = [[nmi(a, b) for b in runs] for a in runs]
    off = [nmi_matrix[i][j] for i in range(5) for j in range(5) if i < j]

    degree = sorted(d for _, d in giant.degree())
    null_q = []
    for sample in range(NULL_Q_SAMPLES):
        H = giant.copy()
        nx.double_edge_swap(H, nswap=SWAPS_PER_EDGE * H.number_of_edges(),
                            max_tries=100 * H.number_of_edges(), seed=SEED + sample)
        assert sorted(d for _, d in H.degree()) == degree
        null_q.append(modularity(H, louvain(H, SEED)))
    mean, sd = statistics.mean(null_q), statistics.stdev(null_q)

    era = nx.get_node_attributes(giant, "era")
    sub = {n: (s or "none") for n, s in nx.get_node_attributes(giant, "subfields").items()}
    return part, {
        "communities": max(part.values()) + 1,
        "q": q,
        "null_q": null_q,
        "null_q_mean": mean,
        "null_q_sd": sd,
        "z": (q - mean) / sd,
        "stability": {
            "seeds": list(STABILITY_SEEDS),
            "communities": [max(r.values()) + 1 for r in runs],
            "q": [modularity(giant, r) for r in runs],
            "nmi": nmi_matrix,
            "nmi_min": min(off),
            "nmi_max": max(off),
        },
        "nmi_era": nmi(part, era),
        "nmi_subfields": nmi(part, sub),
    }


def build_artifact() -> dict:
    G, giant, _ = load_philosophers()
    s = strength(giant)
    k = dict(giant.degree())
    # alpha_min ships at full float precision: two links sit at exactly 0.2 in exact
    # arithmetic, (1 - 4/5)^1, and float round-off (0.19999999999999996) is what puts
    # them inside the course's 1,540. Rounding for size would silently drop them.
    alpha_min = exact = disparity_alpha(giant)

    table = []
    for a in COURSE_ALPHAS:
        table.append({"filter": "disparity", "alpha": a,
                      **backbone_row(disparity_filter(giant, a, alpha_min=exact))})
    for w in THRESHOLDS:
        table.append({"filter": "threshold", "w_min": w, **backbone_row(naive_threshold(giant, w))})

    part, network = community_analysis(giant)
    tops = top_members(part, s, 5)
    labels = {c: TRADITIONS.get(m[0], f"Circle of {giant.nodes[m[0]]['name']}") for c, m in tops.items()}

    events, curve = sweep(list(giant), alpha_min)
    for e in events:
        share, community = dominant(e["members"], part)
        e["community"], e["purity"] = community, share
        e["eras"] = Counter(giant.nodes[n]["era"] for n in e["members"]).most_common()
        e["bridge"] = [[u, v, giant[u][v]["weight"]] for u, v in e["bridge"]]
    brk = first_break(events)
    half = giant_below(curve, giant.number_of_nodes())

    null_a = null_sweep(giant, part, "weights", NULL_SWEEP_SAMPLES)
    null_b = null_sweep(giant, part, "rewire", NULL_SWEEP_SAMPLES)

    pos = layout_3d(giant, exact)
    order = sorted(giant, key=lambda n: (part[n], -s[n], n))
    index = {n: i for i, n in enumerate(order)}
    eras = sorted({giant.nodes[n]["era"] for n in giant}, key=ERA_ORDER.index)
    last_alpha = {n: min(alpha_min[e] if e in alpha_min else alpha_min[e[::-1]]
                         for e in giant.edges(n)) for n in giant}

    featured = set()
    for e in events[:12]:
        featured.update(x for b in e["bridge"] for x in b[:2])
    for c in tops.values():
        featured.update(c[:3])
    featured.update(sorted(giant, key=lambda n: -s[n])[:10])

    grid = [float(f"{10 ** x:.4g}") for x in np.linspace(0, -3, 61)]
    sweep_table = []
    for a in grid:
        kept = [e for e, am in alpha_min.items() if am < a]
        B = nx.Graph(kept)
        sweep_table.append({"alpha": a, **backbone_row(B)})

    return {
        "method": {
            "seed": SEED,
            "filter": "disparity (Serrano, Boguñá, Vespignani 2009), both-ends rule, from scratch",
            "layout_alpha": LAYOUT_ALPHA,
            "break_size": BREAK_SIZE,
            "log_size": LOG_SIZE,
            "null_q_samples": NULL_Q_SAMPLES,
            "null_sweep_samples": NULL_SWEEP_SAMPLES,
            "swaps_per_edge": SWAPS_PER_EDGE,
            "louvain": "networkx louvain_communities on the unweighted giant, weight=None",
        },
        "network": {
            "nodes_all": G.number_of_nodes(),
            "links_all": G.number_of_edges(),
            "nodes": giant.number_of_nodes(),
            "links": giant.number_of_edges(),
            "weight_one": sum(1 for *_, d in giant.edges(data=True) if d["weight"] == 1),
            "max_weight": max(d["weight"] for *_, d in giant.edges(data=True)),
            **network,
            "break_alpha": brk["alpha"],
            "break_size": brk["size"],
            "half_alpha": half,
        },
        "communities": [
            {"id": c, "label": labels[c], "size": sum(1 for v in part.values() if v == c),
             "top": [giant.nodes[n]["name"] for n in tops[c]], "colour": PALETTE["communities"][c]}
            for c in sorted(tops)
        ],
        "eras": eras,
        "nodes": [
            {"id": n, "name": giant.nodes[n]["name"], "era": eras.index(giant.nodes[n]["era"]),
             "c": part[n], "k": k[n], "s": s[n], "p": [round(float(x), 3) for x in pos[n]],
             "last": last_alpha[n],
             **({"d": giant.nodes[n]["description"]} if n in featured else {})}
            for n in order
        ],
        "links": sorted(
            ([index[u], index[v], d["weight"], alpha_min[(u, v)]] for u, v, d in giant.edges(data=True)),
            key=lambda x: -x[3]),
        "events": [
            {"alpha": e["alpha"], "size": e["size"], "giant_after": e["giant_after"],
             "community": e["community"], "purity": round(e["purity"], 3), "eras": e["eras"],
             "bridge": [[index[u], index[v], w] for u, v, w in e["bridge"]],
             "members": [index[n] for n in e["members"]]}
            for e in events
        ],
        "table": table,
        "sweep": sweep_table,
        "null": {"weights": null_a, "rewire": null_b},
    }


ERA_ORDER = [
    "centuries BC", "1st through 10th centuries", "11th through 14th centuries",
    "15th and 16th centuries", "17th century", "18th century", "19th century",
]


# ---------------------------------------------------------------------------
# Static figures for the post (exercise 4.11)
# ---------------------------------------------------------------------------

def figures(artifact: dict | None = None) -> dict:
    """Strength vs degree, the alpha = 0.2 backbone, and the three-alpha strip."""
    import matplotlib.pyplot as plt
    from sgi.export import save_fig
    from sgi.plots import set_style

    set_style()
    G, giant, _ = load_philosophers()
    s, k = strength(giant), dict(giant.degree())
    exact = disparity_alpha(giant)
    part = louvain(giant, SEED)
    tops = top_members(part, s, 1)
    labels = {c: TRADITIONS.get(m[0], m[0]) for c, m in tops.items()}
    colours = PALETTE["communities"]
    ink, muted, grid = "#0f172a", "#5b6577", "#e4eaf2"
    out = {}

    # 1 · strength against degree
    fig, ax = plt.subplots(figsize=(6.4, 4.6))
    nodes = list(giant)
    x = np.array([k[n] for n in nodes]); y = np.array([s[n] for n in nodes])
    ax.scatter(x, y, s=10, color=PALETTE["und"], alpha=0.45, linewidths=0)
    ax.set_xscale("log"); ax.set_yscale("log")
    ratio = np.log(y / x)
    far = [nodes[i] for i in np.argsort(-ratio)[:3]]
    marked = list(dict.fromkeys(["Diogenes_Laertius", *far]))
    for n in marked:
        ax.scatter(k[n], s[n], s=26, color=ink, zorder=3)
    _place_labels(ax, [((k[n], s[n]), giant.nodes[n]["name"]) for n in marked], fontsize=8)
    lim = [1, max(y) * 1.2]
    ax.plot(lim, lim, color=muted, lw=0.8, ls="--")
    ax.text(1.2, 1.5, "s = k (every link weight 1)", fontsize=7.5, color=muted, rotation=33)
    ax.set_xlabel("degree k (links)"); ax.set_ylabel("strength s (total weight)")
    ax.set_title("Strength against degree, 1,374 philosophers")
    out["strength_degree"] = save_fig(fig, "strength-vs-degree", week=4)
    out["strength_far"] = far
    plt.close(fig)

    # 2 · the alpha = 0.2 backbone, laid out on itself (rule 2)
    B = disparity_filter(giant, LAYOUT_ALPHA, alpha_min=exact)
    pos = nx.spring_layout(B, seed=SEED, weight=None, iterations=300)
    fig, ax = plt.subplots(figsize=(10, 8.2))
    _draw_backbone(ax, B, pos, part, s, colours)
    top10 = sorted(B, key=lambda n: -s[n])[:10]
    _place_labels(ax, [(pos[n], giant.nodes[n]["name"]) for n in top10],
                  fontsize=8.5, fontweight="bold", reach=34)
    handles = [plt.Line2D([], [], marker="o", ls="", color=colours[c], ms=7,
                          label=f"{labels[c]} ({sum(1 for v in part.values() if v == c)})")
               for c in sorted(labels)]
    ax.legend(handles=handles, loc="center left", bbox_to_anchor=(1.0, 0.5), frameon=False,
              fontsize=8.5, title="Louvain community\n(full unweighted giant)", title_fontsize=8.5,
              alignment="left")
    ax.set_axis_off()
    out["backbone"] = save_fig(fig, "backbone-alpha-0.2", week=4)
    plt.close(fig)

    # 3 · three alphas, same positions so the eye can compare
    fig, axes = plt.subplots(1, 3, figsize=(15, 5.2))
    wide = disparity_filter(giant, 0.3, alpha_min=exact)
    pos3 = nx.spring_layout(wide, seed=SEED, weight=None, iterations=300)
    for ax, a in zip(axes, (0.3, 0.2, 0.1)):
        Ba = disparity_filter(giant, a, alpha_min=exact)
        gcc = max(nx.connected_components(Ba), key=len)
        _draw_backbone(ax, Ba, pos3, part, s, colours, scale=0.6, faded=set(Ba) - gcc)
        ax.set_title(f"α = {a}: {Ba.number_of_edges():,} links, giant {len(gcc):,}",
                     fontsize=10, color=ink)
        ax.set_axis_off()
    out["strip"] = save_fig(fig, "backbone-three-alphas", week=4)
    plt.close(fig)
    return out


def _place_labels(ax, items, fontsize=8, reach=18, **style):
    """Greedy labels: try offsets around each point, keep the first that overlaps no
    earlier label; a thin leader line joins label and point when it had to move."""
    fig = ax.figure
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    taken = []
    offsets = [(5, 4), (5, -12), (-5, 4), (-5, -12)]
    offsets += [(r * dx, r * dy) for r in (1, 1.6, 2.3, 3) for dx, dy in
                ((1, 1), (1, -1), (-1, 1), (-1, -1), (0, 1.2), (0, -1.4), (1.3, 0), (-1.3, 0))
                for r in [r * reach / 18]]
    for xy, text in items:
        for dx, dy in offsets:
            ha = "left" if dx >= 0 else "right"
            label = ax.annotate(text, xy, xytext=(dx, dy), textcoords="offset points", ha=ha,
                                fontsize=fontsize, color="#0f172a", zorder=5, **style,
                                arrowprops=None if abs(dx) + abs(dy) < 20 else
                                dict(arrowstyle="-", color="#5b6577", lw=0.5, shrinkA=1, shrinkB=2))
            box = label.get_window_extent(renderer).expanded(1.05, 1.15)
            if not any(box.overlaps(b) for b in taken):
                taken.append(box)
                break
            label.remove()


def _draw_backbone(ax, B, pos, part, s, colours, scale=1.0, faded=frozenset()):
    weights = np.array([d["weight"] for *_, d in B.edges(data=True)])
    nx.draw_networkx_edges(B, pos, ax=ax, edge_color="#9aa4b2",
                           width=0.3 + 0.25 * np.sqrt(weights), alpha=0.45)
    nodes = list(B)
    nx.draw_networkx_nodes(
        B, pos, nodelist=nodes, ax=ax,
        node_color=[colours[part[n]] for n in nodes],
        node_size=[scale * (4 + 2.2 * math.sqrt(s[n])) for n in nodes],
        alpha=[0.25 if n in faded else 0.95 for n in nodes],
        edgecolors="white", linewidths=0.3 * scale)


if __name__ == "__main__":
    artifact = build_artifact()
    destinations = [
        ROOT / "data" / "week4" / "exports" / "backbone-snap.json",
        ROOT / "site" / "src" / "data" / "week4" / "backbone-snap.json",
    ]
    payload = json.dumps(artifact, ensure_ascii=False, separators=(",", ":")) + "\n"
    for destination in destinations:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(payload, encoding="utf-8")
        print(destination.relative_to(ROOT), f"{len(payload.encode()) / 1e6:.2f} MB")

    net = artifact["network"]
    print(f"{net['communities']} communities, Q = {net['q']:.3f}, null {net['null_q_mean']:.3f} "
          f"± {net['null_q_sd']:.3f}, z = {net['z']:.0f}; NMI {net['stability']['nmi_min']:.2f}"
          f"–{net['stability']['nmi_max']:.2f}")
    print(f"first break at alpha = {net['break_alpha']}, {net['break_size']} philosophers; "
          f"giant below half at alpha = {net['half_alpha']}")
    if "--figures" in sys.argv:
        for key, value in figures(artifact).items():
            print(key, value)
