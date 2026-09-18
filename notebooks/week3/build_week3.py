"""Reproduce the Week 3 clique analysis and the website data artifact.

Run from the repository root with ``python notebooks/week3/build_week3.py``.
The only randomized step is the degree-preserving null model; every run uses
the same published seed.
"""
from __future__ import annotations

import csv
import json
import statistics
from pathlib import Path

import networkx as nx


ROOT = Path(__file__).resolve().parents[2]
SEED = 20260918
NULL_SAMPLES = 100
SWAPS_PER_EDGE = 10


def load_network() -> tuple[nx.Graph, dict[str, dict[str, str]]]:
    """Load the frozen roster and collapse link direction for clique analysis."""
    data_dir = ROOT / "data" / "week1"
    with (data_dir / "week1_nodes.tsv").open(encoding="utf-8") as handle:
        rows = csv.DictReader(
            (line for line in handle if not line.startswith("#")), delimiter="\t"
        )
        metadata = {row["node_id"]: row for row in rows}

    graph = nx.Graph()
    graph.add_nodes_from(metadata)
    with (data_dir / "week1_edges.tsv").open(encoding="utf-8") as handle:
        edges = csv.reader(
            (line for line in handle if not line.startswith("#")), delimiter="\t"
        )
        graph.add_edges_from(edges)
    graph.remove_edges_from(nx.selfloop_edges(graph))
    return graph, metadata


def display_name(node_id: str, metadata: dict[str, dict[str, str]]) -> str:
    """Use concise labels while retaining node IDs and source URLs in the export."""
    overrides = {
        "Cable_(character)": "Cable",
        "Cyclops_(Marvel_Comics)": "Cyclops",
        "Jubilee_(character)": "Jubilee",
        "Northstar_(character)": "Northstar",
        "Phoenix_Force": "Phoenix Force",
        "Storm_(Marvel_Comics)": "Storm",
        "Wolverine_(character)": "Wolverine",
    }
    return overrides.get(node_id, metadata[node_id]["name"])


def character(
    node_id: str,
    graph: nx.Graph,
    metadata: dict[str, dict[str, str]],
) -> dict[str, object]:
    return {
        "id": node_id,
        "name": display_name(node_id, metadata),
        "degree": graph.degree(node_id),
        "url": metadata[node_id]["url"],
        "description": metadata[node_id]["description"],
    }


def build_artifact() -> dict[str, object]:
    graph, metadata = load_network()
    all_cliques = list(nx.enumerate_all_cliques(graph))
    maximal = list(nx.find_cliques(graph))
    clique_number = max(map(len, maximal))
    maximum = sorted(
        (tuple(sorted(clique)) for clique in maximal if len(clique) == clique_number)
    )

    core = set(maximum[0]).intersection(*map(set, maximum[1:]))
    rotating = sorted(set().union(*map(set, maximum)) - core)

    # The six maxima form a complete 2 x 3 grid of rotating-seat choices.
    compatible = nx.Graph(graph.subgraph(rotating))
    seat_a, seat_b = nx.algorithms.bipartite.sets(compatible)
    seat_a = sorted(seat_a)
    seat_b = sorted(seat_b)
    if len(seat_a) > len(seat_b):
        seat_a, seat_b = seat_b, seat_a

    max_clique_null: list[int] = []
    triangle_null: list[int] = []
    transitivity_null: list[float] = []
    for sample in range(NULL_SAMPLES):
        shuffled = graph.copy()
        nx.double_edge_swap(
            shuffled,
            nswap=SWAPS_PER_EDGE * graph.number_of_edges(),
            max_tries=100 * graph.number_of_edges(),
            seed=SEED + sample,
        )
        assert sorted(dict(shuffled.degree()).values()) == sorted(
            dict(graph.degree()).values()
        )
        max_clique_null.append(max(map(len, nx.find_cliques(shuffled))))
        triangle_null.append(sum(nx.triangles(shuffled).values()) // 3)
        transitivity_null.append(nx.transitivity(shuffled))

    size_counts: dict[int, int] = {}
    for clique in all_cliques:
        size_counts[len(clique)] = size_counts.get(len(clique), 0) + 1

    return {
        "method": {
            "seed": SEED,
            "null_samples": NULL_SAMPLES,
            "swaps_per_edge": SWAPS_PER_EDGE,
            "projection": "simple undirected",
        },
        "network": {
            "nodes": graph.number_of_nodes(),
            "undirected_edges": graph.number_of_edges(),
            "triangles": size_counts[3],
            "five_cliques": size_counts[5],
            "clique_number": clique_number,
            "maximum_cliques": len(maximum),
            "transitivity": nx.transitivity(graph),
        },
        "core": [character(node, graph, metadata) for node in sorted(core)],
        "seat_a": [character(node, graph, metadata) for node in seat_a],
        "seat_b": [character(node, graph, metadata) for node in seat_b],
        "cliques": [list(clique) for clique in maximum],
        "null": {
            "max_clique_numbers": max_clique_null,
            "max_clique_mean": statistics.mean(max_clique_null),
            "max_clique_max": max(max_clique_null),
            "triangles_mean": statistics.mean(triangle_null),
            "triangles_sd": statistics.pstdev(triangle_null),
            "transitivity_mean": statistics.mean(transitivity_null),
            "transitivity_sd": statistics.pstdev(transitivity_null),
        },
    }


if __name__ == "__main__":
    artifact = build_artifact()
    destinations = [
        ROOT / "data" / "week3" / "exports" / "clique-lab.json",
        ROOT / "site" / "src" / "data" / "week3" / "clique-lab.json",
    ]
    payload = json.dumps(artifact, indent=2, ensure_ascii=False) + "\n"
    for destination in destinations:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(payload, encoding="utf-8")
        print(destination.relative_to(ROOT))

    network = artifact["network"]
    null = artifact["null"]
    print(
        f"{network['maximum_cliques']} maximum cliques of size "
        f"{network['clique_number']}; null maximum {null['max_clique_max']}"
    )
