import { useMemo, useState } from 'react';
import data from '../data/week7/text-vs-links.json';
import './text-vs-links.css';

type Edge = { s: string; t: string; kind: string; mentions: number; string: number; evidence?: string[] };
const nodes = data.nodes;
const byId = new Map(nodes.map(n => [n.id, n]));
const edges = data.edges as Edge[];
const W = 860, H = 470, L = 64, R = 24, T = 24, B = 58;
const max = Math.max(...nodes.map(n => Math.max(n.link_in, n.text_in)));
// Raíz cuadrada: los cientos de personajes con pocos enlaces no se aplastan contra el origen.
const sc = (v: number) => Math.sqrt(v / max);
const x = (v: number) => L + sc(v) * (W - L - R);
const y = (v: number) => H - B - sc(v) * (H - T - B);
const ticks = [0, 5, 20, 50, 100].filter(t => t <= max);
const picks = ['Doctor_Strange', 'Hawkeye_(comics)', 'Hulk', 'Ms._Marvel', 'Spider-Man'];
const kinds = [
  { key: 'both', label: 'Named and linked' },
  { key: 'text', label: 'Named, not linked' },
  { key: 'link', label: 'Linked, not named' },
];

export default function TextVsLinks() {
  const [selected, setSelected] = useState('Doctor_Strange');
  const [kind, setKind] = useState('text');
  const node = byId.get(selected)!;
  const incoming = useMemo(() => edges.filter(e => e.t === selected), [selected]);
  const shown = incoming.filter(e => e.kind === kind).sort((a, b) => b.mentions - a.mentions || a.s.localeCompare(b.s));
  const coverage = node.string_mentions ? node.ner_seen / node.string_mentions : null;
  const labels = Object.entries(node.labels as Record<string, number>);
  return <section className="tvl-panel" aria-label="Text network versus hyperlink network explorer">
    <div className="tvl-head"><span className="tvl-eyebrow">303 characters · spaCy NER vs Wikipedia links</span><h3>Who is named in the text, and who is only linked?</h3></div>
    <div className="tvl-chart"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="tvl-title"><title id="tvl-title">Incoming hyperlinks versus incoming text mentions, one dot per character</title>
      {ticks.map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={T} y2={H - B} className="tvl-grid" /><text x={x(t)} y={H - B + 22} textAnchor="middle">{t}</text>
        <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="tvl-grid" /><text x={L - 10} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
      <line x1={x(0)} y1={y(0)} x2={x(max)} y2={y(max)} className="tvl-diag" />
      <text x={x(max) - 6} y={y(max) + 16} textAnchor="end" className="tvl-note">same in both</text>
      {nodes.map(n => <circle key={n.id} cx={x(n.link_in)} cy={y(n.text_in)} r={n.id === selected ? 7 : 3.6}
        className={n.id === selected ? 'tvl-selected' : 'tvl-dot'} onClick={() => setSelected(n.id)}>
        <title>{n.name}: {n.link_in} linking articles, {n.text_in} naming articles</title></circle>)}
      <text x={Math.min(W - 200, x(node.link_in) + 12)} y={Math.max(T + 14, y(node.text_in) - 12)} className="tvl-label">{node.name}</text>
      <text x={(L + W - R) / 2} y={H - 12} textAnchor="middle" className="tvl-axis">Articles that link to the character (week-1 in-degree, √ scale)</text>
      <text transform={`translate(18 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" className="tvl-axis">Articles where NER names them (√ scale)</text>
    </svg></div>
    <div className="tvl-picks">{picks.map(id => <button key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>{byId.get(id)!.name}</button>)}
      <select aria-label="Select any character" value={selected} onChange={e => setSelected(e.target.value)}>
        {[...nodes].sort((a, b) => a.name.localeCompare(b.name)).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
    <div className="tvl-detail" aria-live="polite">
      <div><span className="tvl-eyebrow">Selected</span><h4>{node.name}</h4>
        <p>{coverage === null ? 'No resolvable name: shared with another character or variant page, so NER cannot be scored here.'
          : <>Its name appears capitalised <b>{node.string_mentions}</b> times in other articles; the NER put an entity span around <b>{Math.round(100 * coverage)}%</b> of them.</>}
          {labels.length > 0 && <> Labels spaCy gave the name: {labels.map(([l, c]) => `${l} ${c}`).join(' · ')}.</>}</p>
        <a href={node.url} target="_blank" rel="noopener noreferrer">Wikipedia article ↗</a></div>
      <dl><div><dt>Linking in</dt><dd>{node.link_in}</dd></div><div><dt>Naming in</dt><dd>{node.text_in}</dd></div></dl>
    </div>
    <div className="tvl-edges">
      <div className="tvl-tabs" role="tablist">{kinds.map(k => <button key={k.key} role="tab" aria-selected={kind === k.key} onClick={() => setKind(k.key)}>
        {k.label} <span>{incoming.filter(e => e.kind === k.key).length}</span></button>)}</div>
      {shown.length === 0 ? <p className="tvl-empty">No incoming edges of this kind.</p> :
        <ul>{shown.slice(0, 40).map(e => <li key={e.s}><b>{byId.get(e.s)!.name}</b>
          {e.evidence ? <q>{e.evidence[0]}<mark>{e.evidence[1]}</mark>{e.evidence[2]}</q>
            : <small>{e.string ? `name appears ${e.string}× but NER never resolved it` : 'the name never appears in the text'}</small>}
          {e.evidence && <small>{e.evidence[3]} · {e.mentions} mention{e.mentions > 1 ? 's' : ''}</small>}</li>)}
          {shown.length > 40 && <li className="tvl-more">…and {shown.length - 40} more</li>}</ul>}
    </div>
  </section>;
}
