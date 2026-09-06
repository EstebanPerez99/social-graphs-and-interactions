import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";

// Dibujo force-directed de la red de la semana. Tamaño ∝ in-degree. Click abre Wikipedia.
// react-force-graph-2d toca `window` al importarse → se carga dinámicamente, solo en el navegador.
type Node = { id: string; name: string; in: number; out: number; url: string };
type Link = { source: string; target: string };
type Data = { nodes: Node[]; links: Link[] };
const loaders = import.meta.glob<Data>("../data/week*/network.json", { import: "default" });

export default function NetworkGraph({ week = 1, height = 560 }: { week?: number; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const fg = useRef<any>(null);
  const [width, setWidth] = useState(680);
  const [data, setData] = useState<Data | null>(null);
  const [ForceGraph, setForceGraph] = useState<ComponentType<any> | null>(null);
  const [hover, setHover] = useState<Node | null>(null);

  useEffect(() => { import("react-force-graph-2d").then((m) => setForceGraph(() => m.default)); }, []);
  useEffect(() => { loaders[`../data/week${week}/network.json`]?.().then(setData); }, [week]);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  // force-graph muta los objetos: copia para no tocar el JSON importado
  const graph = useMemo(() => data && { nodes: data.nodes.map((n) => ({ ...n })), links: data.links.map((l) => ({ ...l })) }, [data]);

  return (
    <div ref={wrap} className="relative w-full" style={{ height }}>
      {graph && ForceGraph ? (
        <ForceGraph
          ref={fg}
          graphData={graph}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          nodeVal={(n: any) => 1 + n.in / 5}
          nodeColor={(n: any) => (hover && n.id === hover.id ? "#d1495b" : n.in + n.out === 0 ? "#b8c0cc" : "#0f172a")}
          nodeLabel={() => ""}
          linkColor={() => "rgba(15,23,42,0.07)"}
          linkWidth={0.6}
          cooldownTicks={180}
          onEngineStop={() => fg.current?.zoomToFit(500, 24)}
          onNodeHover={(n: any) => setHover(n ?? null)}
          onNodeClick={(n: any) => window.open(n.url, "_blank", "noopener")}
          enableNodeDrag={false}
        />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-grid/60 rounded" />
      )}
      <div className="absolute left-2 top-2 font-mono text-[0.75rem] leading-snug pointer-events-none bg-white/90 border border-grid rounded px-2 py-1.5">
        {hover
          ? <><span className="text-ink font-medium">{hover.name}</span><br /><span style={{ color: "var(--color-in)" }}>in {hover.in}</span> · <span style={{ color: "var(--color-out)" }}>out {hover.out}</span></>
          : <span className="text-ink-muted">hover a node · click opens Wikipedia<br />size ∝ in-degree · grey = isolated</span>}
      </div>
    </div>
  );
}
