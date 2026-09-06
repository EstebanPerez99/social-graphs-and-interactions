"""Gráficas con estilo de la casa: distribuciones en lineal y log-log."""
import matplotlib.pyplot as plt

from .degree import goodies_bins, raw_distribution

PALETTE = {"in": "#d1495b", "out": "#1f6f8b", "und": "#5c6b73", "bin": "#111111"}


def set_style() -> None:
    plt.rcParams.update({
        "figure.dpi": 110, "savefig.dpi": 200, "savefig.bbox": "tight",
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.alpha": 0.25, "grid.linewidth": 0.6,
        "font.size": 10, "axes.titleweight": "bold",
    })


def plot_distribution(ax, raw, binned=None, *, scale="linear", color=PALETTE["in"],
                      label="raw", normalized=False):
    """Puntos crudos (uno por valor de k) y, opcionalmente, el binning encima."""
    y = "p" if normalized else "count"
    ax.scatter(raw.u, raw[y], s=18, color=color, alpha=0.85, label=label, zorder=3)
    if binned is not None:
        b = binned[binned["count"] > 0]
        yb = "p" if normalized else "density"
        ax.plot(b.x, b[yb], "o-", color=PALETTE["bin"], ms=4, lw=1, label="binned", zorder=4)
    if scale == "loglog":
        ax.set_xscale("log")
        ax.set_yscale("log")
    ax.set_xlabel("k + 1")
    ax.set_ylabel("p(k)" if normalized else "nodes")
    return ax


def degree_panels(table, *, binned=True, normalized=False, figsize=(11, 7)):
    """Cuadrícula 2×2: in/out-degree × lineal/log-log. Devuelve la figura."""
    fig, axes = plt.subplots(2, 2, figsize=figsize)
    for row, kind in enumerate(("in", "out")):
        deg = table[f"{kind}_degree"].to_numpy()
        raw = raw_distribution(deg)
        bins = goodies_bins(deg) if binned else None
        for col, scale in enumerate(("linear", "loglog")):
            ax = axes[row, col]
            plot_distribution(ax, raw, bins, scale=scale, color=PALETTE[kind],
                              label=f"{kind}-degree", normalized=normalized)
            ax.set_title(f"{kind}-degree · {scale}")
            if row == 0 and col == 0:
                ax.legend(frameon=False)
    fig.tight_layout()
    return fig
