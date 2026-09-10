"""Drawing helpers: one house style for every graph the notebooks draw."""
import matplotlib.pyplot as plt
import networkx as nx

from .plots import PALETTE

NODE = "#e8e8e8"
HIGHLIGHT = PALETTE["in"]
EDGE = "#9aa5ab"


def draw(G, ax=None, *, pos=None, title="", highlight=(), weights=False,
         node_size=520, seed=7, figsize=(5.5, 4.5)):
    """Draw G in the house style. Handles Graph and DiGraph, self-loops and weights.

    highlight  nodes drawn in accent colour, with their incident edges thickened.
    weights    label each edge with its ``weight`` attribute.
    Returns the axes, so the caller can keep tweaking.
    """
    if ax is None:
        _, ax = plt.subplots(figsize=figsize)
    if pos is None:
        pos = nx.spring_layout(G, seed=seed)

    highlight = set(highlight)
    hot = [e for e in G.edges if e[0] in highlight or e[1] in highlight]
    hot_set = set(hot)
    cold = [e for e in G.edges if e not in hot_set]

    node_colors = [HIGHLIGHT if n in highlight else NODE for n in G]
    nx.draw_networkx_nodes(G, pos, ax=ax, node_color=node_colors, node_size=node_size,
                           edgecolors="#333333", linewidths=1.0)
    nx.draw_networkx_labels(G, pos, ax=ax, font_size=8, font_color="#333333")

    common = dict(ax=ax, node_size=node_size, arrows=True,
                  connectionstyle="arc3,rad=0.08")
    for edges, color, width in ((cold, EDGE, 1.2), (hot, HIGHLIGHT, 2.4)):
        plain = [e for e in edges if e[0] != e[1]]
        loops = [e for e in edges if e[0] == e[1]]
        if plain:
            nx.draw_networkx_edges(G, pos, edgelist=plain, edge_color=color, width=width, **common)
        if loops:  # the loop radius scales with node_size, so inflate it to make loops legible
            nx.draw_networkx_edges(G, pos, edgelist=loops, edge_color=color, width=width,
                                   ax=ax, node_size=node_size * 3, arrows=True)

    if weights:
        labels = nx.get_edge_attributes(G, "weight")
        nx.draw_networkx_edge_labels(G, pos, edge_labels=labels, ax=ax, font_size=8,
                                     label_pos=0.35, rotate=False,
                                     bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.85))

    ax.set_title(title)
    ax.set_axis_off()
    ax.margins(0.12)
    return ax
