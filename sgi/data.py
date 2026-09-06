"""Carga de los snapshots del playground compartido."""
import networkx as nx
import pandas as pd

from . import DATA


def load_marvel(week: int = 1) -> tuple[nx.DiGraph, pd.DataFrame]:
    """Carga el snapshot de la semana como DiGraph, conservando los nodos aislados.

    Devuelve (G, nodes). `nodes` trae node_id, name, wikidata_id, url, description;
    name/url/description quedan también como atributos de cada nodo en G.
    Sigue el snippet oficial de la página de datos del curso.
    """
    d = DATA / f"week{week}"
    nodes = pd.read_csv(d / f"week{week}_nodes.tsv", sep="\t", comment="#", quoting=3)
    edges = pd.read_csv(d / f"week{week}_edges.tsv", sep="\t", comment="#",
                        names=["source", "target"])

    G = nx.DiGraph()
    G.add_nodes_from(nodes.node_id)          # primero los 303 — así no se pierden los 17 aislados
    G.add_edges_from(edges.itertuples(index=False))
    nx.set_node_attributes(
        G, nodes.set_index("node_id")[["name", "url", "description"]].to_dict("index"))
    return G, nodes
