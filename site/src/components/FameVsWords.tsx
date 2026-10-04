import { useState } from 'react';
import data from '../data/week5/fame-vs-words.json';
import './fame-vs-words.css';

const format = (n: number) => Math.round(n).toLocaleString('en-US');
const W = 860, H = 500, L = 80, R = 30, T = 28, B = 65;
const maxDegree = Math.max(...data.nodes.map(n => n.degree));
const maxTokens = Math.max(...data.nodes.map(n => n.tokens));
const minTokens = 100;
const outliers = [...data.high, ...data.low];

export default function FameVsWords() {
  const [selected, setSelected] = useState(data.high[0]);
  const [query, setQuery] = useState('');
  const [log, setLog] = useState(true);
  const node = data.nodes.find(n => n.id === selected)!;
  const x = (d: number) => L + (log ? Math.log1p(d) / Math.log1p(maxDegree) : d / maxDegree) * (W-L-R);
  const y = (t: number) => H-B - (log ? (Math.log10(t)-Math.log10(minTokens)) / (Math.log10(maxTokens)-Math.log10(minTokens)) : t/maxTokens) * (H-T-B);
  const prediction = (d: number) => 10 ** (data.method.intercept + data.method.slope * Math.log1p(d));
  const line = Array.from({length:151}, (_, i) => { const d = i * maxDegree / 150; return `${i ? 'L' : 'M'}${x(d)},${y(prediction(d))}`; }).join(' ');
  const ticksX = log ? [0,1,3,10,30,100].filter(n => n<=maxDegree) : [0,20,40,60,80,100].filter(n => n<=maxDegree);
  const ticksY = log ? [100,300,1000,3000,10000,30000].filter(n => n<=maxTokens) : [0,5000,10000,15000,20000,25000].filter(n => n<=maxTokens);
  return <section className="fame-panel" aria-label="Marvel article length and incoming links explorer">
    <div className="fame-toolbar"><div><span className="fame-eyebrow">303 characters · one frozen snapshot</span><h3>Who gets more words than their links suggest?</h3></div><label className="fame-scale"><input type="checkbox" checked={log} onChange={e=>setLog(e.target.checked)} /> Log scales</label></div>
    <div className="fame-chart"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="fame-title fame-desc"><title id="fame-title">Incoming links versus article word tokens</title><desc id="fame-desc">Each dot is a Marvel character. The association is positive, with Spearman correlation 0.751. Select a character using the search or outlier buttons below. Dashed line is a descriptive log-space fit.</desc>
      {ticksY.map(t=><g key={t}><line x1={L} x2={W-R} y1={y(t)} y2={y(t)} className="fame-grid"/><text x={L-12} y={y(t)+4} textAnchor="end">{format(t)}</text></g>)}
      {ticksX.map(t=><g key={t}><line x1={x(t)} x2={x(t)} y1={T} y2={H-B} className="fame-grid"/><text x={x(t)} y={H-B+25} textAnchor="middle">{t}</text></g>)}
      <path d={line} className="fame-trend"/>
      {data.nodes.map(n=><circle key={n.id} cx={x(n.degree)} cy={y(n.tokens)} r={n.id===selected?7:outliers.includes(n.id)?4.5:3.5} className={n.id===selected?'fame-selected':'fame-dot'} opacity={query && !n.name.toLowerCase().includes(query.toLowerCase()) ? 0.12 : 0.75} onClick={()=>setSelected(n.id)} onMouseEnter={()=>setSelected(n.id)}><title>{n.name}: {n.degree} incoming links, {format(n.tokens)} tokens</title></circle>)}
      <text x={(L+W-R)/2} y={H-12} textAnchor="middle" className="fame-axis">Incoming Wikipedia links (in-degree){log?' · log(1 + degree)':''}</text>
      <text transform={`translate(19 ${(T+H-B)/2}) rotate(-90)`} textAnchor="middle" className="fame-axis">Article length · word tokens{log?' · log scale':''}</text>
      <text x={Math.min(W-240,Math.max(L+10,x(node.degree)+12))} y={Math.max(T+15,y(node.tokens)-14)} className="fame-label">{node.name}</text>
    </svg></div>
    <p className="fame-caption">One dot per article. Dashed line: descriptive fit, not a causal prediction. Switch scales to see how the hubs stretch the view. Zero-link characters remain visible.</p>
    <div className="fame-detail" aria-live="polite"><div><span className="fame-eyebrow">Selected character</span><h4>{node.name}</h4><a href={node.url} target="_blank" rel="noopener noreferrer">Read the Wikipedia article ↗</a><small>Live Wikipedia may differ from the frozen text.</small></div><dl><div><dt>Incoming links</dt><dd>{node.degree}</dd></div><div><dt>Word tokens</dt><dd>{format(node.tokens)}</dd></div><div><dt>Relative to fit</dt><dd>{node.ratio.toFixed(2)}×</dd></div></dl></div>
    <div className="fame-search"><label htmlFor="fame-search">Find a character</label><input id="fame-search" type="search" placeholder="Try Spider-Man…" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Select character" value={selected} onChange={e=>setSelected(e.target.value)}><option value={selected}>{node.name}</option>{data.nodes.filter(n=>n.id!==selected && n.name.toLowerCase().includes(query.toLowerCase())).map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
    <div className="fame-outliers">{[{label:'Far above the fit',ids:data.high},{label:'Far below the fit',ids:data.low}].map(group=><div key={group.label}><span className="fame-eyebrow">{group.label}</span><div>{group.ids.map(id=><button key={id} aria-pressed={selected===id} onClick={()=>{setSelected(id);setQuery('');}}>{data.nodes.find(n=>n.id===id)!.name}</button>)}</div></div>)}</div>
  </section>;
}
