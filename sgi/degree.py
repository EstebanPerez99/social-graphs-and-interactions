"""Grados, distribuciones y el binning de los 'Goodies' de la semana 1."""
import networkx as nx
import numpy as np
import pandas as pd

_COL = {"in": "in_degree", "out": "out_degree", "und": "degree"}


def degree_table(G: nx.DiGraph, nodes: pd.DataFrame | None = None) -> pd.DataFrame:
    """Una fila por nodo: in_degree, out_degree y degree (no dirigido)."""
    U = G.to_undirected()
    df = pd.DataFrame({
        "node_id": list(G.nodes),
        "in_degree": [d for _, d in G.in_degree()],
        "out_degree": [d for _, d in G.out_degree()],
        "degree": [U.degree(n) for n in G.nodes],
    })
    if nodes is not None:
        df = df.merge(nodes[["node_id", "name"]], on="node_id", how="left")
        df = df[["node_id", "name", "in_degree", "out_degree", "degree"]]
    return df


def top(table: pd.DataFrame, kind: str = "in", n: int = 5) -> pd.DataFrame:
    """Los n nodos con mayor grado. kind: 'in' | 'out' | 'und'."""
    col = _COL[kind]
    cols = [c for c in ("name", "node_id") if c in table.columns] + [col]
    return table.sort_values(col, ascending=False).head(n)[cols].reset_index(drop=True)


def raw_distribution(degrees) -> pd.DataFrame:
    """Cuántos nodos tienen cada grado k. Columnas: k, u (=k+1), count, p.

    Se grafica contra u = k+1 porque un eje log no puede mostrar k = 0,
    y esta red tiene 17 personajes sin links.
    """
    k = np.asarray(degrees)
    vals, counts = np.unique(k, return_counts=True)
    return pd.DataFrame({"k": vals, "u": vals + 1, "count": counts, "p": counts / len(k)})


def goodies_bins(degrees, linear_until: int = 7) -> pd.DataFrame:
    """El esquema de binning de los Goodies, sobre u = k+1.

    - bins de ancho 1 para u = 1 … linear_until (7)
    - luego bins que doblan: [8,16), [16,32), [32,64), … hasta cubrir el máximo
    - el conteo de cada bin se divide por su ancho  -> columna `density`
    - cada bin se dibuja en la media geométrica de los enteros que cubre -> columna `x`

    Donde el ancho es 1, `x == u` y `density == count`: coincide exacto con raw_distribution.
    """
    u = np.asarray(degrees) + 1
    edges = list(range(1, linear_until + 2))         # [1, 2, …, 8]  -> 7 bins de ancho 1
    lo = linear_until + 1
    while lo <= u.max():                             # 8→16→32→… hasta pasar el máximo
        edges.append(lo * 2)
        lo *= 2
    edges = np.asarray(edges)
    counts, _ = np.histogram(u, bins=edges)

    rows = []
    for i, c in enumerate(counts):
        a, b = int(edges[i]), int(edges[i + 1])
        ints = np.arange(a, b)
        rows.append({
            "lo": a, "hi": b, "width": b - a,
            "x": float(np.exp(np.log(ints).mean())),   # media geométrica de los enteros cubiertos
            "count": int(c),
            "density": c / (b - a),
            "p": c / len(u) / (b - a),
        })
    return pd.DataFrame(rows)
