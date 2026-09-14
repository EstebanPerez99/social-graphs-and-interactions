"""Friendship-paradox metrics for simple, undirected views of networks."""
from __future__ import annotations

from collections.abc import Hashable

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
