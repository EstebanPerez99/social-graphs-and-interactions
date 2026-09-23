"""Backbones de redes con pesos: umbral global y filtro de disparidad (Serrano et al. 2009).

Implementado desde la fórmula del curso, sin paquetes de backboning:
para el nodo i con grado k_i y fuerza s_i, la arista (i, j) es significativa en i si
(1 - w_ij / s_i) ** (k_i - 1) < alpha. Se conserva si es significativa en cualquiera de
sus dos extremos, así que basta con guardar el mínimo de los dos valores (`alpha_min`):
la arista sobrevive a un alpha dado si y solo si alpha_min < alpha.
"""
import networkx as nx


def strength(G: nx.Graph, weight: str = "weight") -> dict:
    """s_i = suma de los pesos de las aristas de i."""
    return dict(G.degree(weight=weight))


def disparity_alpha(G: nx.Graph, weight: str = "weight") -> dict[tuple, float]:
    """alpha_min por arista: el menor de los dos p-valores (1 - w/s)^(k-1).

    Un extremo de grado 1 da (1 - 1)^0 = 1: nunca es significativo por su lado,
    la arista depende del otro extremo.
    """
    s = strength(G, weight)
    k = dict(G.degree())

    def p(i, w):
        return (1 - w / s[i]) ** (k[i] - 1)

    return {(u, v): min(p(u, d[weight]), p(v, d[weight])) for u, v, d in G.edges(data=True)}


def disparity_filter(G: nx.Graph, alpha: float, weight: str = "weight",
                     alpha_min: dict | None = None) -> nx.Graph:
    """Backbone a un alpha dado: solo las aristas con alpha_min < alpha (y sus nodos)."""
    alpha_min = alpha_min if alpha_min is not None else disparity_alpha(G, weight)
    return G.edge_subgraph([e for e, a in alpha_min.items() if a < alpha]).copy()


def naive_threshold(G: nx.Graph, w_min: float, weight: str = "weight") -> nx.Graph:
    """Umbral global ingenuo: solo las aristas con peso >= w_min."""
    return G.edge_subgraph([(u, v) for u, v, d in G.edges(data=True) if d[weight] >= w_min]).copy()


def backbone_row(B: nx.Graph) -> dict:
    """Una fila de la tabla del curso: links, filósofos con un link, componente gigante."""
    giant = max(map(len, nx.connected_components(B)), default=0)
    return {"links": B.number_of_edges(), "nodes": B.number_of_nodes(), "giant": giant}
