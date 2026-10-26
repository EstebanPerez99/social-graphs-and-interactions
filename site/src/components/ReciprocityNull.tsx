import data from '../data/week8/reciprocity-null.json';

// Una fila por hub: banda del 95 % del null (gris), media del null (raya) y lo observado (punto).
const rows = data.hubs;
const W = 760, rowH = 34, L = 190, R = 110, T = 34;
const H = T + rows.length * rowH + 40;
const max = Math.max(...rows.map(r => Math.max(r.observed, r.null_hi, r.out)));
const x = (v: number) => L + (v / max) * (W - L - R);
const name = (n: string) => n.replace(/ \((character|Marvel Comics)\)$/, '');

export default function ReciprocityNull() {
  return <figure className="m-0">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="rn-title" className="block w-full h-auto font-mono" style={{ minWidth: 0 }}>
      <title id="rn-title">For the ten most-linked characters, reciprocated links observed versus a degree-preserving null</title>
      {Array.from({ length: max + 1 }, (_, v) => v).filter(v => v % 5 === 0).map(v => <g key={v}>
        <line x1={x(v)} x2={x(v)} y1={T - 8} y2={H - 40} stroke="var(--color-grid)" />
        <text x={x(v)} y={H - 22} textAnchor="middle" fontSize="12" fill="var(--color-ink-muted)">{v}</text></g>)}
      <text x={W - R + 12} y={T - 14} fontSize="11" fill="var(--color-ink-muted)">sent back / in</text>
      {rows.map((r, i) => {
        const cy = T + i * rowH + rowH / 2;
        return <g key={r.id}>
          <text x={L - 12} y={cy + 4} textAnchor="end" fontSize="13" fill="var(--color-ink)">{name(r.name)}</text>
          <rect x={x(r.null_lo)} y={cy - 6} width={Math.max(2, x(r.null_hi) - x(r.null_lo))} height={12} rx={3} fill="var(--color-grid)" />
          <line x1={x(r.null_mean)} x2={x(r.null_mean)} y1={cy - 8} y2={cy + 8} stroke="var(--color-ink-muted)" strokeWidth={2} />
          <line x1={x(r.out)} x2={x(r.out)} y1={cy - 9} y2={cy + 9} stroke="var(--color-out)" strokeWidth={1.5} strokeDasharray="3 2" />
          <circle cx={x(r.observed)} cy={cy} r={6} fill="var(--color-ink)"><title>{name(r.name)}: links back to {r.observed} of {r.in}; null {r.null_mean.toFixed(1)} (95%: {r.null_lo}–{r.null_hi}); out-degree {r.out}</title></circle>
          <text x={W - R + 12} y={cy + 4} fontSize="12" fill="var(--color-ink-muted)">{r.observed} / {r.in} = {Math.round(100 * r.observed / r.in)}%</text>
        </g>;
      })}
      <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize="12" fill="var(--color-ink-muted)">Linking articles the character's own article links back to</text>
    </svg>
    <figcaption className="font-mono text-[0.75rem] text-ink-muted mt-3 leading-snug">
      ● observed · grey band: 95% of {data.method.samples} degree-preserving rewirings · grey tick: null mean ·{' '}
      <span style={{ color: 'var(--color-out)' }}>dashed blue: out-degree, the most it could ever send back</span>. Right column: the week-1 ratio.
    </figcaption>
  </figure>;
}
