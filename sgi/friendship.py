"""Friendship-paradox metrics for simple, undirected views of networks."""
from __future__ import annotations

from collections.abc import Hashable, Mapping

import networkx as nx
import numpy as np
import pandas as pd


def _undirected_simple(G: nx.Graph) -> nx.Graph:
    """Return a copy suitable for friendship-paradox calculations.

    Direction is ignored, parallel edges are collapsed, and self-loops are
    removed. A person is therefore counted at most once in another person's
    neighborhood and can never be their own friend.
    """
    U = nx.Graph(G)
    U.remove_edges_from(nx.selfloop_edges(U))
    return U


def _names(U: nx.Graph, nodes: pd.DataFrame | None) -> dict[Hashable, str]:
    names = {node: str(data.get("name", node)) for node, data in U.nodes(data=True)}
    if nodes is not None and {"node_id", "name"}.issubset(nodes.columns):
        names.update(nodes.set_index("node_id")["name"].astype(str).to_dict())
    return names


def friendship_table(G: nx.Graph, nodes: pd.DataFrame | None = None) -> pd.DataFrame:
    """Return one row per node with local friendship-paradox measurements.

    The paradox is evaluated on the simple undirected version of ``G``. Isolates
    have undefined neighbor statistics and are excluded from aggregate fractions.
    ``unbeaten`` means that no direct neighbor has strictly greater degree.
    """
    U = _undirected_simple(G)
    degree = dict(U.degree())
    names = _names(U, nodes)
    rows = []

    for node in U:
        neighbor_degrees = np.asarray([degree[v] for v in U.neighbors(node)], dtype=float)
        k = degree[node]
        if k:
            mean_neighbor = float(neighbor_degrees.mean())
            max_neighbor = int(neighbor_degrees.max())
            higher = int(np.sum(neighbor_degrees > k))
            at_least = int(np.sum(neighbor_degrees >= k))
            rows.append({
                "node_id": node,
                "name": names[node],
                "degree": k,
                "mean_neighbor_degree": mean_neighbor,
                "max_neighbor_degree": max_neighbor,
                "neighbor_degree_gap": mean_neighbor - k,
                "higher_degree_neighbors": higher,
                "fraction_higher_degree_neighbors": higher / k,
                "fraction_at_least_as_popular_neighbors": at_least / k,
                "local_paradox": mean_neighbor > k,
                "unbeaten": max_neighbor <= k,
            })
        else:
            rows.append({
                "node_id": node,
                "name": names[node],
                "degree": 0,
                "mean_neighbor_degree": np.nan,
                "max_neighbor_degree": np.nan,
                "neighbor_degree_gap": np.nan,
                "higher_degree_neighbors": 0,
                "fraction_higher_degree_neighbors": np.nan,
                "fraction_at_least_as_popular_neighbors": np.nan,
                "local_paradox": pd.NA,
                "unbeaten": pd.NA,
            })

    table = pd.DataFrame(rows)
    table["local_paradox"] = table["local_paradox"].astype("boolean")
    table["unbeaten"] = table["unbeaten"].astype("boolean")
    return table


def friendship_summary(G: nx.Graph) -> dict[str, float | int]:
    """Summarize the uniform-person-then-uniform-friend experiment exactly."""
    U = _undirected_simple(G)
    table = friendship_table(U)
    degrees = table["degree"].to_numpy(dtype=float)
    connected = table[table["degree"] > 0]
    n = len(table)
    if len(connected):
        person_mean = float(connected["degree"].mean())
        friend_mean = float(connected["mean_neighbor_degree"].mean())
        friend_more = float(connected["fraction_higher_degree_neighbors"].mean())
        friend_at_least = float(
            connected["fraction_at_least_as_popular_neighbors"].mean()
        )
        local_count = int(connected["local_paradox"].sum())
        local_fraction = local_count / len(connected)
        unbeaten_count = int(connected["unbeaten"].sum())
    else:
        person_mean = friend_mean = friend_more = friend_at_least = float("nan")
        local_fraction = float("nan")
        local_count = 0
        unbeaten_count = 0

    return {
        "node_count": n,
        "edge_count": U.number_of_edges(),
        "isolate_count": int(np.sum(degrees == 0)),
        "eligible_person_count": len(connected),
        "person_mean_degree": person_mean,
        "friend_mean_degree": friend_mean,
        "person_friend_gap": friend_mean - person_mean,
        "friend_more_popular_probability": friend_more,
        "friend_at_least_as_popular_probability": friend_at_least,
        "local_paradox_count": local_count,
        "local_paradox_fraction": local_fraction,
        "unbeaten_count": unbeaten_count,
    }


def popular_friends(
    G: nx.Graph,
    nodes: pd.DataFrame | None = None,
    n: int | None = 10,
) -> pd.DataFrame:
    """Rank characters by how often a person-then-friend sample selects them.

    ``friend_sample_probability`` is exact: choose a non-isolated person
    uniformly, then one of their neighbors uniformly. ``overrepresentation`` is
    that probability divided by the uniform probability of being chosen as the
    person.
    """
    U = _undirected_simple(G)
    degree = dict(U.degree())
    names = _names(U, nodes)
    nonisolates = [node for node, k in degree.items() if k]
    person_probability = 1 / len(nonisolates) if nonisolates else float("nan")
    rows = []

    for node in nonisolates:
        probability = sum(person_probability / degree[neighbor] for neighbor in U.neighbors(node))
        lower_neighbors = sum(degree[neighbor] < degree[node] for neighbor in U.neighbors(node))
        paradox_contribution = sum(
            person_probability / degree[neighbor]
            for neighbor in U.neighbors(node)
            if degree[node] >= degree[neighbor]
        )
        rows.append({
            "node_id": node,
            "name": names[node],
            "degree": degree[node],
            "friend_sample_probability": probability,
            "overrepresentation": probability / person_probability,
            "lower_degree_neighbors": lower_neighbors,
            "paradox_probability_contribution": paradox_contribution,
        })

    result = pd.DataFrame(rows).sort_values(
        ["friend_sample_probability", "degree", "name"],
        ascending=[False, False, True],
    ).reset_index(drop=True)
    return result if n is None else result.head(n).copy()


def sample_friendship_pairs(
    G: nx.Graph,
    samples: int = 1_000,
    seed: int | None = None,
    nodes: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Sample non-isolated people uniformly and then one friend uniformly."""
    if samples < 0:
        raise ValueError("samples must be non-negative")

    U = _undirected_simple(G)
    degree = dict(U.degree())
    names = _names(U, nodes)
    people = [node for node, k in degree.items() if k]
    if not people and samples:
        raise ValueError("cannot sample friendship pairs from a graph without edges")

    rng = np.random.default_rng(seed)
    rows = []
    for _ in range(samples):
        person = people[int(rng.integers(len(people)))]
        friends = list(U.neighbors(person))
        friend = friends[int(rng.integers(len(friends)))]
        rows.append({
            "person_id": person,
            "person_name": names[person],
            "person_degree": degree[person],
            "friend_id": friend,
            "friend_name": names[friend],
            "friend_degree": degree[friend],
            "friend_more_popular": degree[friend] > degree[person],
            "friend_at_least_as_popular": degree[friend] >= degree[person],
        })
    return pd.DataFrame(rows)


def _packed_spring_layout(G: nx.Graph, seed: int) -> dict[Hashable, np.ndarray]:
    """Lay out the giant component at full scale and pack satellites around it."""
    components = sorted(nx.connected_components(G), key=len, reverse=True)
    satellite_count = max(1, len(components) - 1)
    positions: dict[Hashable, np.ndarray] = {}

    for component_index, component in enumerate(components):
        subgraph = G.subgraph(component)
        size = len(component)
        if component_index == 0:
            center = np.zeros(3)
            radius = 14.0
        else:
            satellite_index = component_index - 1
            ring_index = satellite_index // 14
            index_on_ring = satellite_index % 14
            members_on_ring = min(14, satellite_count - ring_index * 14)
            angle = 2 * np.pi * index_on_ring / members_on_ring
            orbit = 17.5 + ring_index * 3.4
            center = np.asarray([
                orbit * np.cos(angle),
                0.0,
                orbit * np.sin(angle),
            ])
            radius = min(3.0, 0.75 + 0.42 * np.sqrt(size))

        if size == 1:
            positions[next(iter(component))] = center
            continue

        local = nx.spring_layout(
            subgraph,
            dim=2,
            seed=seed + component_index,
            iterations=180,
            k=2.4 / np.sqrt(size),
            scale=radius,
        )
        depth_rng = np.random.default_rng(seed + component_index)
        for node, local_point in local.items():
            positions[node] = np.asarray([
                local_point[0] + center[0],
                depth_rng.uniform(-1.35, 1.35),
                local_point[1] + center[2],
            ])

    return positions


def friendship_journey_data(
    G: nx.Graph,
    nodes: pd.DataFrame | None = None,
    *,
    seed: int = 20260914,
    swaps_per_edge: int = 10,
    enrichment: Mapping[Hashable, Mapping[str, object]] | None = None,
) -> dict[str, object]:
    """Build the deterministic data artifact used by the Week 2 web journey.

    The second network is created with double-edge swaps, so every node keeps
    its degree while the endpoints are rewired. Both layouts are calculated
    here rather than in the browser, making the visual transition reproducible.
    ``enrichment`` can add presentation-only fields such as thumbnail URLs.
    """
    if swaps_per_edge < 0:
        raise ValueError("swaps_per_edge must be non-negative")

    U = _undirected_simple(G)
    shuffled = U.copy()
    swap_count = swaps_per_edge * U.number_of_edges()
    if swap_count:
        nx.double_edge_swap(
            shuffled,
            nswap=swap_count,
            max_tries=max(100, 20 * swap_count),
            seed=seed,
        )

    node_order = list(U.nodes())
    original_layout = _packed_spring_layout(U, seed)
    shuffled_layout = _packed_spring_layout(shuffled, seed + 1)

    table = friendship_table(U, nodes).set_index("node_id")
    drivers = popular_friends(U, nodes, n=None).set_index("node_id")
    names = _names(U, nodes)
    metadata: dict[Hashable, dict[str, object]] = {
        node: dict(data) for node, data in U.nodes(data=True)
    }
    if nodes is not None and "node_id" in nodes.columns:
        for row in nodes.to_dict(orient="records"):
            node = row.pop("node_id")
            metadata.setdefault(node, {}).update(row)
    if enrichment:
        for node, values in enrichment.items():
            metadata.setdefault(node, {}).update(values)

    node_records = []
    for node in node_order:
        row = table.loc[node]
        driver = drivers.loc[node] if node in drivers.index else None
        meta = metadata.get(node, {})
        node_records.append({
            "id": str(node),
            "name": names[node],
            "degree": int(row["degree"]),
            "mean_neighbor_degree": (
                None if pd.isna(row["mean_neighbor_degree"])
                else round(float(row["mean_neighbor_degree"]), 6)
            ),
            "higher_degree_neighbors": int(row["higher_degree_neighbors"]),
            "local_paradox": (
                None if pd.isna(row["local_paradox"])
                else bool(row["local_paradox"])
            ),
            "unbeaten": None if pd.isna(row["unbeaten"]) else bool(row["unbeaten"]),
            "friend_sample_probability": (
                0.0 if driver is None
                else round(float(driver["friend_sample_probability"]), 8)
            ),
            "url": meta.get("url"),
            "description": meta.get("description", meta.get("desc")),
            "thumbnail": meta.get("thumbnail", meta.get("thumb")),
            "position": [round(float(value), 5) for value in original_layout[node]],
            "shuffled_position": [
                round(float(value), 5) for value in shuffled_layout[node]
            ],
        })

    def edge_records(graph: nx.Graph) -> list[dict[str, str]]:
        return [
            {"source": str(source), "target": str(target)}
            for source, target in graph.edges()
        ]

    top_drivers = popular_friends(U, nodes, n=5)
    unbeaten = table[(table["degree"] > 0) & table["unbeaten"]]
    return {
        "seed": seed,
        "swaps": swap_count,
        "nodes": node_records,
        "links": edge_records(U),
        "shuffled_links": edge_records(shuffled),
        "summary": friendship_summary(U),
        "shuffled_summary": friendship_summary(shuffled),
        "popular_friends": top_drivers.to_dict(orient="records"),
        "unbeaten": [
            {
                "id": str(node),
                "name": names[node],
                "degree": int(row["degree"]),
            }
            for node, row in unbeaten.iterrows()
        ],
    }
