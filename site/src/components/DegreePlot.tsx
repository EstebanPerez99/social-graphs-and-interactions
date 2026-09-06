import { useMemo, useState } from "react";
import { line, scaleLinear, scaleLog } from "d3";

// Distribución de grado: puntos crudos + el binning de los Goodies. Lineal / log-log, in / out.
type Raw = { k: number; u: number; count: number; p: number };
type Bin = { lo: number; hi: number; width: number; x: number; count: number; density: number; p: number };
type Top = { name: string; node_id?: string; k: number };
type Series = { raw: Raw[]; binned: Bin[]; top: Top[] };
export type DegreeData = { in: Series; out: Series };

const COLOR = { in: "var(--color-in)", out: "var(--color-out)" } as const;
const isPow10 = (t: number) => Math.abs(Math.log10(t) - Math.round(Math.log10(t))) < 1e-9;

export default function DegreePlot({ data, initial = "in" }: { data: DegreeData; initial?: "in" | "out" }) {
  const [kind, setKind] = useState<"in" | "out">(initial);
  const [log, setLog] = useState(true);
  const [bins, setBins] = useState(true);
  const [hover, setHover] = useState<Raw | null>(null);

  const s = data[kind];
  const W = 680, H = 400, m = { t: 16, r: 18, b: 46, l: 54 };

  const { x, y } = useMemo(() => {
    const maxU = Math.max(...s.raw.map((d) => d.u), ...s.binned.map((b) => b.hi));
    const maxY = Math.max(...s.raw.map((d) => d.count));
    const minY = Math.min(1, ...s.binned.filter((b) => b.count > 0).map((b) => b.density)) * 0.6;
    const x = (log ? scaleLog() : scaleLinear()).domain([1, maxU]).range([m.l, W - m.r]).nice();
    const y = (log ? scaleLog().domain([minY, maxY]) : scaleLinear().domain([0, maxY])).range([H - m.b, m.t]).nice();
    return { x, y };
  }, [s, log]);

  const xt = (log ? x.ticks().filter(isPow10) : x.ticks(8)) as number[];
  const yt = (log ? y.ticks().filter(isPow10) : y.ticks(6)) as number[];
  const shown = s.binned.filter((b) => b.count > 0);
  const path = line<Bin>().x((b) => x(b.x)).y((b) => y(b.density))(shown) ?? "";
  const names = hover ? s.top.filter((t) => t.k === hover.k).map((t) => t.name) : [];

  const Seg = ({ on, onClick, children, tone }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: "in" | "out" }) => (
    <button type="button" onClick={onClick} aria-pressed={on}
      className="px-2.5 py-1 rounded font-mono text-[0.72rem] border transition-colors"
      style={on ? { background: tone ? COLOR[tone] : "var(--color-ink)", color: "white", borderColor: "transparent" }
               : { background: "white", color: "var(--color-ink-muted)", borderColor: "var(--color-grid)" }}>
      {children}
    </button>
  );

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3 items-center">
        <div className="flex gap-1"><Seg on={kind === "in"} tone="in" onClick={() => setKind("in")}>in-degree</Seg><Seg on={kind === "out"} tone="out" onClick={() => setKind("out")}>out-degree</Seg></div>
        <div className="flex gap-1"><Seg on={!log} onClick={() => setLog(false)}>linear</Seg><Seg on={log} onClick={() => setLog(true)}>log–log</Seg></div>
        <div className="flex gap-1"><Seg on={bins} onClick={() => setBins(!bins)}>binned</Seg></div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto font-mono" style={{ fontSize: 11 }} onMouseLeave={() => setHover(null)}>
        {xt.map((t) => <g key={`x${t}`}><line x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} stroke="var(--color-grid)" /><text x={x(t)} y={H - m.b + 16} textAnchor="middle" fill="var(--color-ink-muted)">{t}</text></g>)}
        {yt.map((t) => <g key={`y${t}`}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--color-grid)" /><text x={m.l - 8} y={y(t) + 4} textAnchor="end" fill="var(--color-ink-muted)">{t}</text></g>)}
        <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke="var(--color-ink)" strokeWidth={1} />
        <line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} stroke="var(--color-ink)" strokeWidth={1} />
        <text x={(m.l + W - m.r) / 2} y={H - 8} textAnchor="middle" fill="var(--color-ink)">k + 1 · {kind}-degree</text>
        <text transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" fill="var(--color-ink)">characters</text>

        {bins && <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth={1.25} />}
        {bins && shown.map((b) => <circle key={b.lo} cx={x(b.x)} cy={y(b.density)} r={3} fill="var(--color-ink)" />)}
        {s.raw.map((d) => (
          <circle key={d.k} cx={x(d.u)} cy={y(d.count)} r={hover?.k === d.k ? 6 : 4.2}
            fill={COLOR[kind]} fillOpacity={0.85} stroke="white" strokeWidth={1}
            onMouseEnter={() => setHover(d)} style={{ cursor: "crosshair" }} />
        ))}
      </svg>

      <div className="font-mono text-[0.78rem] mt-2 min-h-[2.6em] leading-snug text-ink-muted">
        {hover
          ? <><span className="text-ink">k = {hover.k}</span> · {hover.count} {hover.count === 1 ? "character" : "characters"}{names.length > 0 && <> · <span style={{ color: COLOR[kind] }}>{names.join(", ")}</span></>}</>
          : <>Hover a dot. Black line: bins of width 1 up to k+1 = 7, then doubling; each count ÷ bin width, drawn at the geometric mean of the integers it covers.</>}
      </div>
    </div>
  );
}
