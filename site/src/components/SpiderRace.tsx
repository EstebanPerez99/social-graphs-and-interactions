import { useEffect, useMemo, useState } from "react";
import ClickSpark from "./bits/ClickSpark";
import Magnet from "./bits/Magnet";

// "Two clicks from Spider-Man": salta por los links de cada artículo hasta llegar a Spider-Man (o escapar de él).
// El hallazgo del post, jugado: hacia el hub todo es cerca; desde el hub, casi nada lo es.
type Node = { id: string; name: string; in: number; out: number; url: string; desc: string; thumb: string | null };
type Data = { nodes: Node[]; links: { source: string; target: string }[] };
type Mode = "to" | "from";
const loaders = import.meta.glob<Data>("../data/week*/network.json", { import: "default" });
const HUB = "Spider-Man";

export default function SpiderRace({ week = 1 }: { week?: number }) {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => { loaders[`../data/week${week}/network.json`]?.().then(setData); }, [week]);
  if (!data) return <div className="h-[28rem] animate-pulse bg-grid/60 rounded" />;
  return <Game data={data} />;
}

// ---------- grafo ----------
function bfs(adj: Map<string, string[]>, src: string) {
  const dist = new Map<string, number>([[src, 0]]);
  const prev = new Map<string, string>();
  const q = [src];
  for (let i = 0; i < q.length; i++) {
    const u = q[i];
    for (const v of adj.get(u) ?? []) if (!dist.has(v)) { dist.set(v, dist.get(u)! + 1); prev.set(v, u); q.push(v); }
  }
  return { dist, prev };
}

function build(data: Data) {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const out = new Map<string, string[]>(), inn = new Map<string, string[]>();
  for (const { source, target } of data.links) {
    (out.get(source) ?? out.set(source, []).get(source)!).push(target);
    (inn.get(target) ?? inn.set(target, []).get(target)!).push(source);
  }
  for (const l of out.values()) l.sort((a, b) => byId.get(a)!.name.localeCompare(byId.get(b)!.name));
  const toHub = bfs(inn, HUB);     // dist de cada nodo HACIA el hub; prev = siguiente salto hacia él
  const fromHub = bfs(out, HUB);   // dist DESDE el hub; prev = salto anterior en el camino desde él
  return { byId, out, inn, toHub, fromHub, n: data.nodes.length };
}
type Graph = ReturnType<typeof build>;

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function newGame(g: Graph, mode: Mode) {
  if (mode === "to") {
    const start = pick([...g.toHub.dist].filter(([id, d]) => d >= 2 && d <= 4).map(([id]) => id));
    return { mode, start, target: HUB, path: [start], clicks: 0, status: "playing" as const, hint: false };
  }
  const target = pick([...g.fromHub.dist].filter(([id, d]) => d >= 3).map(([id]) => id));
  return { mode, start: HUB, target, path: [HUB], clicks: 0, status: "playing" as const, hint: false };
}

function optimalPath(g: Graph, mode: Mode, start: string, target: string) {
  if (mode === "to") {                      // start → … → HUB siguiendo toHub.prev
    const p = [start]; let v = start;
    while (v !== HUB) { v = g.toHub.prev.get(v)!; p.push(v); }
    return p;
  }
  const p = [target]; let v = target;       // HUB → … → target reconstruido hacia atrás
  while (v !== HUB) { v = g.fromHub.prev.get(v)!; p.push(v); }
  return p.reverse();
}

// ---------- UI ----------
function Avatar({ node, size = 28 }: { node: Node; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = node.name.replace(/\s*\(.*\)/, "").split(" ").slice(0, 2).map((w) => w[0]).join("");
  if (!node.thumb || err)
    return <span aria-hidden="true" className="inline-flex items-center justify-center rounded-full bg-grid text-ink-muted font-mono shrink-0"
                 style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials}</span>;
  return <img src={node.thumb} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer"
              onError={() => setErr(true)} className="rounded-full object-cover shrink-0 bg-grid" style={{ width: size, height: size }} />;
}

function Chip({ node, onClick, badge, tone }: { node: Node; onClick?: () => void; badge?: number; tone?: "in" | "out" }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick}
         className={`inline-flex items-center gap-1.5 rounded-full border bg-white pl-0.5 pr-2.5 py-0.5 font-mono text-[0.72rem] text-ink ${onClick ? "border-grid hover:border-ink hover:bg-paper cursor-pointer" : "border-grid"}`}>
      <Avatar node={node} size={22} />
      <span className="truncate max-w-[11rem]">{node.name}</span>
      {badge !== undefined && <span className="ml-0.5 tabular-nums" style={{ color: tone === "out" ? "var(--color-out)" : "var(--color-in)" }}>{badge}</span>}
    </Tag>
  );
}

function Game({ data }: { data: Data }) {
  const g = useMemo(() => build(data), [data]);
  const [s, setS] = useState(() => newGame(g, "to"));
  const cur = g.byId.get(s.path[s.path.length - 1])!;
  const target = g.byId.get(s.target)!;
  const links = g.out.get(cur.id) ?? [];
  const optimal = useMemo(() => optimalPath(g, s.mode, s.start, s.target), [g, s.mode, s.start, s.target]);

  // los números del hallazgo, calculados en vivo del mismo grafo
  const facts = useMemo(() => {
    const to = [...g.toHub.dist.values()].filter((d) => d > 0);
    const from = [...g.fromHub.dist.values()].filter((d) => d > 0);
    const others = g.n - 1;
    return {
      to1: to.filter((d) => d === 1).length, to2: to.filter((d) => d <= 2).length, to4: to.filter((d) => d <= 4).length,
      toNone: others - to.length,
      fromAll: from.length, fromMax: Math.max(...from), fromNone: others - from.length, hubOut: g.out.get(HUB)?.length ?? 0,
    };
  }, [g]);

  const go = (id: string) => {
    if (s.status !== "playing") return;
    const path = [...s.path, id];
    setS({ ...s, path, clicks: s.clicks + 1, status: id === s.target ? "won" : "playing" });
  };
  const back = () => s.path.length > 1 && setS({ ...s, path: s.path.slice(0, -1), clicks: s.clicks + 1 });
  const restart = (mode: Mode = s.mode) => setS(newGame(g, mode));
  const giveUp = () => setS({ ...s, status: "gaveup" });

  const Seg = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} aria-pressed={on}
      className="px-2.5 py-1 rounded font-mono text-[0.72rem] border transition-colors"
      style={on ? { background: "var(--color-ink)", color: "white", borderColor: "transparent" }
               : { background: "white", color: "var(--color-ink-muted)", borderColor: "var(--color-grid)" }}>{children}</button>
  );

  const done = s.status !== "playing";
  return (
    <ClickSpark sparkColor="#d1495b" sparkSize={8} sparkRadius={18} sparkCount={8} duration={420}>
      <div className="font-body">
        {/* barra superior */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4">
          <div className="flex gap-1">
            <Seg on={s.mode === "to"} onClick={() => restart("to")}>Reach Spider-Man</Seg>
            <Seg on={s.mode === "from"} onClick={() => restart("from")}>Escape Spider-Man</Seg>
          </div>
          <span className="font-mono text-[0.75rem] text-ink-muted">
            clicks <b className="text-ink tabular-nums">{s.clicks}</b>
            {done && <> · shortest possible <b className="text-ink tabular-nums">{optimal.length - 1}</b></>}
          </span>
          <div className="ml-auto flex gap-1">
            <Seg on={s.hint} onClick={() => setS({ ...s, hint: !s.hint })}>show in-degree</Seg>
            {!done && <Seg on={false} onClick={giveUp}>give up</Seg>}
            <Seg on={false} onClick={() => restart()}>new game</Seg>
          </div>
        </div>

        <p className="font-mono text-[0.78rem] text-ink-muted mb-4">
          {s.mode === "to"
            ? <>Start at <b className="text-ink">{g.byId.get(s.start)!.name}</b>. Reach <b style={{ color: "var(--color-in)" }}>Spider-Man</b> by clicking the characters each article links to.</>
            : <>Start at <b className="text-ink">Spider-Man</b>. Reach <b style={{ color: "var(--color-out)" }}>{target.name}</b> — only through links that leave each article.</>}
        </p>

        {/* tarjeta actual + links */}
        <div className="grid md:grid-cols-[15rem_1fr] gap-5">
          <div className="panel p-4 flex md:flex-col gap-4 items-start">
            <Avatar node={cur} size={88} />
            <div className="min-w-0">
              <p className="font-display font-bold text-[1.25rem] leading-tight tracking-tight">{cur.name}</p>
              <p className="font-body text-[0.9rem] text-ink-muted leading-snug mt-1 line-clamp-3">{cur.desc}</p>
              <p className="font-mono text-[0.72rem] mt-2">
                <span style={{ color: "var(--color-in)" }}>in {cur.in}</span> · <span style={{ color: "var(--color-out)" }}>out {cur.out}</span>
              </p>
            </div>
          </div>

          <div className="min-w-0">
            {!done && (
              <>
                <p className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-muted mb-2">
                  This article links to {links.length} {links.length === 1 ? "character" : "characters"}
                </p>
                {links.length === 0 ? (
                  <p className="font-body text-ink-muted">Dead end — this article links to no one in the category.
                    <button type="button" onClick={back} className="ml-2 font-mono text-[0.75rem] underline underline-offset-4 text-ink">← go back</button></p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {links.map((id) => <Chip key={id} node={g.byId.get(id)!} onClick={() => go(id)}
                                             badge={s.hint ? g.byId.get(id)!.in : undefined} tone="in" />)}
                  </div>
                )}
                {s.path.length > 1 && links.length > 0 && (
                  <button type="button" onClick={back} className="mt-3 font-mono text-[0.72rem] underline underline-offset-4 text-ink-muted hover:text-ink">← go back (counts as a click)</button>
                )}
              </>
            )}

            {done && (
              <div>
                <p className="font-display font-bold text-[1.4rem] leading-tight tracking-tight">
                  {s.status === "won"
                    ? <>You got there in {s.clicks} {s.clicks === 1 ? "click" : "clicks"}{s.clicks === optimal.length - 1 ? " — the shortest way." : `; ${optimal.length - 1} was possible.`}</>
                    : <>The shortest way was {optimal.length - 1} clicks.</>}
                </p>
                <p className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-muted mt-4 mb-1.5">Shortest path</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {optimal.map((id, i) => <span key={id} className="contents"><Chip node={g.byId.get(id)!} badge={s.hint ? g.byId.get(id)!.in : undefined} tone="in" />{i < optimal.length - 1 && <span className="text-ink-faint">→</span>}</span>)}
                </div>
                <p className="font-body mt-5 text-[1rem] leading-snug max-w-[52ch]">
                  {s.mode === "to"
                    ? <><b>{facts.to1}</b> characters link straight to Spider-Man; <b>{facts.to2}</b> are within two clicks and <b>{facts.to4}</b> within four. Only {facts.toNone} can't get there at all.</>
                    : <>Spider-Man's own article links to just <b>{facts.hubOut}</b> characters. From there you can reach <b>{facts.fromAll}</b> — but it takes up to <b>{facts.fromMax}</b> clicks, and <b>{facts.fromNone}</b> are out of reach entirely.</>}
                  {" "}<span className="text-ink-muted">That asymmetry is the whole post.</span>
                </p>
                <div className="flex flex-wrap gap-3 mt-5 items-center">
                  <Magnet padding={40} magnetStrength={4}>
                    <button type="button" onClick={() => restart()} className="px-4 py-2 rounded font-mono text-[0.78rem] bg-ink text-white hover:bg-in transition-colors">Play again</button>
                  </Magnet>
                  <button type="button" onClick={() => restart(s.mode === "to" ? "from" : "to")} className="font-mono text-[0.78rem] underline underline-offset-4 text-ink-muted hover:text-ink">
                    {s.mode === "to" ? "Now try escaping him →" : "← Back to reaching him"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* tu camino */}
        <div className="mt-5 pt-4 border-t border-grid">
          <p className="font-mono text-[0.72rem] uppercase tracking-wider text-ink-muted mb-1.5">Your path</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {s.path.map((id, i) => <span key={`${id}-${i}`} className="contents"><Chip node={g.byId.get(id)!} />{i < s.path.length - 1 && <span className="text-ink-faint">→</span>}</span>)}
            {!done && <span className="text-ink-faint">→ ?</span>}
          </div>
        </div>
      </div>
    </ClickSpark>
  );
}
