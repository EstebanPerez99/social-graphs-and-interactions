import { useEffect, useMemo, useRef, useState } from "react";

// La firma del sitio: la matriz de adyacencia de la red de la semana, ordenada por grado.
// Fila i → columna j pintada = el artículo de i enlaza al de j.
type Node = { id: string; name: string; in: number; out: number };
type Link = { source: string; target: string };
type Data = { nodes: Node[]; links: Link[] };

const loaders = import.meta.glob<Data>("../data/week*/network.json", { import: "default" });

export default function AdjacencyMatrix({ week = 1, size = 520 }: { week?: number; size?: number }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    // Every weekly post currently uses the same frozen Marvel snapshot. A week
    // may add a focused artifact without duplicating the full network export.
    const load = loaders[`../data/week${week}/network.json`] ?? loaders["../data/week1/network.json"];
    load?.().then(setData);
  }, [week]);
  if (!data) return <div style={{ aspectRatio: "1 / 1", width: "100%" }} className="animate-pulse bg-grid/60 rounded" />;
  return <Matrix data={data} size={size} />;
}

function Matrix({ data, size }: { data: Data; size: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);

  const order = useMemo(() => [...data.nodes].sort((a, b) => b.in + b.out - (a.in + a.out)), [data]);
  const n = order.length;
  const index = useMemo(() => new Map(order.map((d, i) => [d.id, i])), [order]);
  const cells = useMemo(
    () => data.links.map((l) => [index.get(l.source)!, index.get(l.target)!] as const).sort((a, b) => a[0] - b[0]),
    [data, index],
  );
  const linked = useMemo(() => new Set(cells.map(([i, j]) => i * n + j)), [cells, n]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#0f172a";
    const cell = size / n, px = Math.max(cell * 1.25, 2);
    const draw = (k: number) => { const [i, j] = cells[k]; ctx.fillRect(j * cell, i * cell, px, px); };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { cells.forEach((_, k) => draw(k)); return; }

    // se dibuja por filas, de arriba a abajo: la estructura densa aparece primero
    let k = 0, raf = 0; const t0 = performance.now(), dur = 1400;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
      const upto = Math.floor(cells.length * eased);
      for (; k < upto; k++) draw(k);
      if (k < cells.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cells, n, size]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const j = Math.floor(((e.clientX - r.left) / r.width) * n);
    const i = Math.floor(((e.clientY - r.top) / r.height) * n);
    if (i < 0 || j < 0 || i >= n || j >= n) return setHover(null);
    setHover({ i, j });
  };

  const pct = (k: number) => `${(k / n) * 100}%`;
  const isLinked = hover ? linked.has(hover.i * n + hover.j) : false;

  return (
    <div className="relative select-none" style={{ width: "100%", maxWidth: size }}>
      <canvas
        ref={canvas}
        style={{ width: "100%", height: "auto", display: "block", imageRendering: "pixelated" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        aria-label={`Adjacency matrix, ${n} by ${n}, ${data.links.length} links`}
        role="img"
      />
      {hover && (
        <>
          {/* fila = quien enlaza (out) · columna = quien recibe (in) */}
          <div className="absolute left-0 right-0 pointer-events-none" style={{ top: pct(hover.i), height: 1, background: "var(--color-out)", opacity: 0.7 }} />
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: pct(hover.j), width: 1, background: "var(--color-in)", opacity: 0.7 }} />
          <div className="absolute pointer-events-none font-mono text-[0.72rem] leading-tight bg-white border border-grid rounded px-2 py-1.5 shadow-sm"
               style={{ left: hover.j < n / 2 ? `calc(${pct(hover.j)} + 10px)` : undefined, right: hover.j >= n / 2 ? `calc(100% - ${pct(hover.j)} + 10px)` : undefined,
                        top: hover.i < n / 2 ? `calc(${pct(hover.i)} + 10px)` : undefined, bottom: hover.i >= n / 2 ? `calc(100% - ${pct(hover.i)} + 10px)` : undefined }}>
            <span style={{ color: "var(--color-out)" }}>{order[hover.i].name}</span>
            <span className="text-ink-faint"> → </span>
            <span style={{ color: "var(--color-in)" }}>{order[hover.j].name}</span>
            <div className="text-ink-muted mt-0.5">{isLinked ? "links" : "no link"}</div>
          </div>
        </>
      )}
    </div>
  );
}
