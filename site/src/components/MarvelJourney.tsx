import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CameraRig, Scene, SceneBoundary, type Data, type Lens, type View } from './MarvelPerspectives';
import original from '../data/week2/friendship-journey.json';
import { url } from '../lib/url';
// Week 2 supplies the page shell, typography, paper background, cards and navigation.
import './friendship-journey.css';
import './marvel-journey.css';

const steps = [
  { short: 'Question', title: 'The Marvel Lookalikes', note: 'Who is textually close but structurally far away?' },
  { short: 'Language', title: 'Close in words', note: 'Top view · articles grouped by language.' },
  { short: 'Structure', title: 'Apart in links', note: 'Side view · the same characters, grouped by links.' },
  { short: 'Explore', title: 'Two patterns worth investigating', note: 'Free rotation is now unlocked. Explore a misleading match and a shared story context.' },
  { short: 'Conclude', title: 'Shared words are not shared relationships', note: 'Two questions, three findings—and the limits of this representation.' },
] as const;
const fmt = (n: number) => n.toFixed(3);
const portraits = ['Spider-Man', 'Hulk', 'Wolverine_(character)', 'Doctor_Strange', 'Deadpool', 'She-Hulk']
  .map(id => original.nodes.find(n => n.id === id)).filter(n => n?.thumbnail);

function Journey({ data }: { data: Data }) {
  const methods = useRef<HTMLDialogElement>(null);
  const evidence = useRef<HTMLDialogElement>(null);
  const [stage, setStage] = useState(() => {
    let requested = new URLSearchParams(window.location.search).get('stage')?.toLowerCase();
    if (requested === 'compare') requested = 'explore';
    return Math.max(0, steps.findIndex(s => s.short.toLowerCase() === requested));
  });
  const [a, setA] = useState(data.examples[0].a), [b, setB] = useState(data.examples[0].b);
  const [view, setView] = useState<View>('free'), [lens, setLens] = useState<Lens>('network');
  const [request, setRequest] = useState(0), [hovered, setHovered] = useState<number | null>(null);
  const [filter, setFilter] = useState<number | null>(null), [showLinks, setShowLinks] = useState(true);
  const [reduced, setReduced] = useState(true), [compare, setCompare] = useState<'pairs' | 'communities'>('pairs');
  const aNode = data.nodes[a], bNode = data.nodes[b], score = data.cosine[a][b], distance = data.distance[a][b];
  const options = useMemo(() => data.nodes.map((n, i) => ({ n, i })).sort((x, y) => x.n.name.localeCompare(y.n.name)), [data]);
  const welcome = useMemo(() => {
    const positions = new Map(original.nodes.map(n => [n.id, n.position]));
    return { ...data, nodes: data.nodes.map(n => ({ ...n, p: (positions.get(n.id) ?? n.p).map(x => x / 12) as [number, number, number] })) };
  }, [data]);
  const shared = useMemo(() => {
    const other = new Map(bNode.v);
    return aNode.v.filter(([i]) => other.has(i)).map(([i, w]) => ({ word: data.vocabulary[i], weight: w * other.get(i)! }))
      .sort((x, y) => y.weight - x.weight).slice(0, 8);
  }, [data, aNode, bNode]);
  const example = data.examples.find(e => e.a === Math.min(a, b) && e.b === Math.max(a, b));
  const changeView = (next: View) => { setView(next); setRequest(x => x + 1); };
  const go = (next: number) => {
    setStage(Math.max(0, Math.min(4, next))); setFilter(null);
    if (next === 0) { setLens('network'); changeView('free'); }
    if (next === 1) { setLens('text'); changeView('top'); }
    if (next === 2) { setLens('network'); changeView('side'); }
    if (next === 3) { setLens('network'); changeView('free'); }
  };
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches); update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (stage === 1) { setLens('text'); setView('top'); }
    if (stage === 2) { setLens('network'); setView('side'); }
    if (stage === 3) { setLens('network'); setView('free'); }
    if (stage >= 1 && stage <= 3) setRequest(x => x + 1);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (methods.current?.open || evidence.current?.open || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(stage + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(stage - 1); }
      if (e.key === 'Escape') setFilter(null);
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [stage]);

  const selectors = <div className="mj-selectors">{(['a', 'b'] as const).map((slot, i) => <label key={slot}>
    Character {i + 1}<select aria-label={`Character ${i + 1}`} value={slot === 'a' ? a : b} onChange={e => (slot === 'a' ? setA : setB)(Number(e.target.value))}>
      {options.map(({ n, i }) => <option key={n.id} value={i}>{n.name}</option>)}
    </select></label>)}</div>;
  const measures = <dl className="journey-node-stats mj-measures">
    <div><dt>TF-IDF cosine</dt><dd>{fmt(score)}</dd></div>
    <div><dt>Shortest path</dt><dd>{distance === null ? 'No path' : `${distance} ${distance === 1 ? 'hop' : 'hops'}`}</dd></div>
    <div><dt>Names filtered</dt><dd>{fmt(data.clean_cosine[a][b])}</dd></div>
    <div><dt>Same link community?</dt><dd>{aNode.s === bNode.s ? 'Yes' : 'No'}</dd></div>
  </dl>;
  const terms = <div className="mj-terms">{shared.slice(0, stage === 1 ? 4 : 8).map(term => <div key={term.word}><span>{term.word}</span>
    <meter min={0} max={1} value={score ? term.weight / score : 0} /><small>{(100 * term.weight / (score || 1)).toFixed(1)}%</small></div>)}</div>;

  return <section id="two-perspectives" className={`friendship-journey marvel-journey mj-step-${stage}${stage === 0 ? ' mj-welcome-active' : ''}`} aria-label="Week 6 Marvel lookalikes journey">
    <a className="journey-home" href={url('/')} aria-label="Back to all posts"><span aria-hidden="true">⌁</span> Team ##</a>
    <button type="button" className="journey-methods-trigger" onClick={() => methods.current?.showModal()}>Methods</button>
    <div className="journey-stage" role="img" aria-label={`Interactive stage: ${steps[stage].title}. 303 characters in 3D.`}>
      <SceneBoundary><Canvas frameloop="demand" camera={{ position: [0, 44 / 12, 0.001], up: [0, 0, -1], fov: 38, near: 0.05, far: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}
        fallback={<div className="journey-fallback">WebGL is unavailable. The comparison and conclusions show the same measurements.</div>}>
        <Scene data={stage === 0 ? welcome : data} lens={lens} a={a} b={b} hovered={hovered} setHovered={setHovered}
          pick={setA} showLinks={showLinks} filter={filter} backdrop={false} degreeTone={stage === 0} />
        <CameraRig view={view} request={request} reduced={reduced} onManual={() => setView('free')} intro={stage === 0} allowOrbit={stage === 3} />
      </Canvas></SceneBoundary>
    </div>
    <div className={`journey-overlay mj-overlay stage-${stage}`} key={stage}>
      {stage === 0 && <div className="journey-welcome">
        <div className="journey-portraits" aria-label="Explore a Marvel character">{portraits.map((node, i) => node && <button key={node.id} type="button" className={`journey-portrait journey-portrait-${i + 1}`} aria-label={`Explore ${node.name}`} onClick={() => {
          const index = data.nodes.findIndex(n => n.id === node.id); setA(index);
          setB([...data.nodes.keys()].filter(j => j !== index).sort((i, j) => data.cosine[index][j] - data.cosine[index][i])[0]); go(1);
        }}><img src={node.thumbnail ?? ''} alt="" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} /><span>{node.name}</span><b>{node.degree} links</b></button>)}</div>
        <div className="journey-title-card">
          <p className="journey-title-eyebrow"><span>Week 06</span><span>303 heroes · 45,753 pairs</span></p>
          <h1 aria-label="The Marvel Lookalikes"><span className="journey-title-the">The</span><span className="journey-title-superfriends">Marvel</span><span className="journey-title-paradox">Lookalikes</span></h1>
          <p className="journey-title-question">Who is textually close but structurally far away? Turn the same universe from language to links—and find out what brings its characters together.</p>
          <button type="button" className="journey-title-cta" onClick={() => go(1)}>Explore the network <span aria-hidden="true">→</span></button>
        </div>
      </div>}
      {(stage === 1 || stage === 2 || stage === 3) && <div className="journey-scene-label"><span>{String(stage + 1).padStart(2, '0')} / 05</span><h2>{steps[stage].title}</h2></div>}
      {stage === 1 && <>
        <aside className="journey-panel mj-community-panel">
          <p className="journey-kicker">Text communities</p>
          

          <div className="mj-community-list">{data.groups[lens].map(group => <button key={group.id} type="button" aria-pressed={filter === group.id} onClick={() => setFilter(filter === group.id ? null : group.id)}>
            <i style={{ background: group.color }} /><span><b>{lens === 'text' ? 'T' : 'N'}{group.id + 1}</b> {group.label}</span><small>{group.size}</small>
          </button>)}</div>
          <button className="mj-text-button" type="button" onClick={() => setFilter(null)}>Show all characters</button>
        </aside>
        <aside className="journey-panel mj-pair-panel">
          <p className="journey-kicker">Inspect a pair</p>{selectors}
          <div className="mj-language-score"><span>Cosine similarity</span><strong>{fmt(score)}</strong></div>
          <h3>Shared words</h3>{terms}
          <button type="button" className="mj-next-reveal" onClick={() => go(2)}>See their links →</button>
          <label className="mj-checkbox"><input type="checkbox" checked={showLinks} onChange={e => setShowLinks(e.target.checked)} />Show {lens === 'text' ? 'similarity' : 'Wikipedia'} links</label>
          <p className="mj-small">Layout shows groups; cosine measures similarity.</p>
        </aside>
        {hovered !== null && <div className="mj-hover"><b>{data.nodes[hovered].name}</b><span>Click to select as character 1</span></div>}
      </>}
      {stage === 2 && <>
        <aside className="journey-panel mj-structure-results">
          <p className="journey-kicker">Words versus links</p>
          
          <p className="mj-pair-heading">{aNode.name}<span> ↔ </span>{bNode.name}</p>
          <div className="mj-result-pair"><div><span>Textual similarity</span><strong>{fmt(score)}</strong><small>TF-IDF cosine</small></div><div><span>Network separation</span><strong>{distance === null ? 'No path' : `${distance} hops`}</strong><small>Undirected shortest path</small></div></div>
          <p className="mj-small">{aNode.s === bNode.s ? 'Same link community.' : 'Different link communities.'}</p>
          <div className="mj-community-result"><p className="journey-kicker">Community comparison</p><dl><div><dt>Within · cosine</dt><dd>{fmt(data.summary.within_mean)}</dd></div><div><dt>Between · cosine</dt><dd>{fmt(data.summary.across_mean)}</dd></div></dl><p className="mj-small">Agreement (NMI): {fmt(data.summary.nmi)}</p></div>
          <button type="button" className="mj-next-reveal" onClick={() => go(3)}>Explore two insights →</button>
        </aside>
        <aside className="journey-panel mj-side-key"><p className="journey-kicker">Link communities</p><div className="mj-community-list">{data.groups.network.map(group => <button type="button" key={group.id} aria-pressed={filter === group.id} onClick={() => setFilter(filter === group.id ? null : group.id)}><i style={{background:group.color}} /><span><b>N{group.id + 1}</b> {group.label}</span><small>{group.size}</small></button>)}</div><p className="mj-small">Same points. Different perspective.</p></aside>
      </>}
      {stage === 3 && <>
        <aside className="journey-panel mj-insight-panel"><p className="journey-kicker">Two key insights</p>
          <section><span className="mj-insight-number">01 / Names can mislead</span><h3>A surname can outweigh a story.</h3><p>Emma Frost and Jack Frost have cosine <b>0.494</b> despite being three hops apart. <i>Frost</i> contributes about 94% of that score. Filtering name-like words reduces it to <b>0.123</b>.</p><button type="button" onClick={() => { const e=data.examples[0]; setA(e.a);setB(e.b); }}>Highlight the Frost pair →</button></section>
          <section><span className="mj-insight-number">02 / Context can connect</span><h3>A shared series leaves a trace.</h3><p>Backhand and Scaredycat have cosine <b>0.447</b> at three hops. Their articles share <i>Strikeforce: Morituri</i>, creators and repeated wording. The name-filtered cosine is <b>0.235</b>.</p><button type="button" onClick={() => { const e=data.examples[1]; setA(e.a);setB(e.b); }}>Highlight the Morituri pair →</button></section>
          <button className="mj-next-reveal" type="button" onClick={() => { setCompare('pairs'); evidence.current?.showModal(); }}>Read the evidence and comparisons →</button>
        </aside>
        <aside className="journey-panel mj-pair-panel mj-explore-panel"><p className="journey-kicker">Free rotation · unlocked</p><h3>Now explore it yourself.</h3><p className="mj-small">Drag the network to rotate. Scroll to zoom. Click a node to change character 1.</p>{selectors}{measures}
          <label className="mj-color-select">Color communities by<select aria-label="Color communities by" value={lens} onChange={e => {setLens(e.target.value as Lens);setFilter(null);}}><option value="network">Wikipedia links</option><option value="text">Textual similarity</option></select></label>
          <label className="mj-checkbox"><input type="checkbox" checked={showLinks} onChange={e => setShowLinks(e.target.checked)} />Show {lens === 'text' ? 'similarity' : 'Wikipedia'} links</label>
          <button type="button" className="mj-text-button" onClick={() => changeView('free')}>Reset the 3D view</button><p className="mj-small">Use scores and shortest paths to judge closeness. The 3D positions encode community membership.</p>
        </aside>
        {hovered !== null && <div className="mj-hover"><b>{data.nodes[hovered].name}</b><span>Click to select as character 1</span></div>}
      </>}
      {stage === 4 && <div className="journey-conclusions">
        <header className="journey-conclusion-question"><p className="journey-kicker">The two questions</p><h2>Who is close in words but far in links—and do communities speak alike?</h2></header>
        <section><p className="journey-kicker">01 · A misleading match</p><h3>A surname can outweigh a story.</h3><p>Emma Frost and Jack Frost are three hops apart, with cosine <strong>0.494</strong>. The term <strong>frost</strong> contributes about 94% of their score. After the capitalization-based name filter, cosine falls to <strong>0.123</strong>.</p></section>
        <section><p className="journey-kicker">02 · A shared context</p><h3>Some distant pairs share a series.</h3><p>Backhand and Scaredycat are three hops apart, with cosine <strong>0.447</strong>. Both archived introductions identify <strong>Strikeforce: Morituri</strong> and the same creators. Series context and repeated wording help explain the match.</p></section>
        <section><p className="journey-kicker">03 · Communities overlap</p><h3>Links and language partly agree.</h3><p>Mean cosine is <strong>{fmt(data.summary.within_mean)}</strong> within link communities and <strong>{fmt(data.summary.across_mean)}</strong> across them. Their NMI is <strong>{fmt(data.summary.nmi)}</strong>. Neither partition is a ground-truth set of Marvel teams.</p></section>
        <p className="journey-caveat">We measure frozen Wikipedia articles, not the characters themselves. Names, publication boilerplate and the choice of eight text neighbors affect the result. Three hops is an operational filter; disconnected pairs have no finite distance. The group’s editorial review remains open.</p>
      </div>}
    </div>
    <p className="journey-caption" aria-live="polite"><span>{String(stage + 1).padStart(2, '0')} · {steps[stage].short}</span>{steps[stage].note}</p>
    <nav className="journey-controls" aria-label="Journey navigation">
      <button type="button" disabled={stage === 0} onClick={() => go(stage - 1)}><span aria-hidden="true">←</span> Back</button>
      <ol>{steps.map((step, i) => <li key={step.short}><button type="button" className={i === stage ? 'is-current' : ''} aria-current={i === stage ? 'step' : undefined} aria-label={`Go to ${step.short}`} onClick={() => go(i)}><span>{String(i + 1).padStart(2, '0')}</span><b>{step.short}</b></button></li>)}</ol>
      <button type="button" disabled={stage === 4} onClick={() => go(stage + 1)}>Next <span aria-hidden="true">→</span></button>
    </nav>
    <dialog ref={evidence} className="mj-evidence-dialog" aria-labelledby="mj-evidence-title" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}><div className="journey-conclusions mj-comparison">
        <header className="journey-conclusion-question"><p className="journey-kicker">Check the evidence</p><h2 id="mj-evidence-title">When words and links tell different stories</h2><button type="button" className="mj-evidence-close" aria-label="Close evidence" onClick={() => evidence.current?.close()}>×</button>
          <div className="mj-compare-tabs" aria-label="Research question"><button type="button" aria-pressed={compare === 'pairs'} onClick={() => setCompare('pairs')}>01 · Surprising pairs</button><button type="button" aria-pressed={compare === 'communities'} onClick={() => setCompare('communities')}>02 · Community overlap</button></div>
        </header>
        {compare === 'pairs' ? <div className="mj-compare-grid"><div className="mj-pair-list"><p className="mj-small">Highest cosines among pairs 3+ hops apart. Disconnected pairs follow separately.</p>
          {data.examples.map(e => <button type="button" key={`${e.a}-${e.b}`} aria-pressed={a === e.a && b === e.b} onClick={() => { setA(e.a); setB(e.b); }}>
            <small>{e.distance === null ? 'NO PATH' : `${e.distance} HOPS`} · {fmt(e.cosine)} COSINE</small><span>{data.nodes[e.a].name} ↔ {data.nodes[e.b].name}</span>
          </button>)}
        </div><div className="mj-pair-evidence">{selectors}{measures}
          <h3>Read before interpreting</h3>{[a, b].map((index, slot) => <div key={`${index}-${slot}`} className="mj-excerpt"><a href={data.nodes[index].url} target="_blank" rel="noreferrer">{data.nodes[index].name} ↗</a>
            <blockquote>{example ? example.excerpts[index === example.a ? 0 : 1] : data.nodes[index].excerpt}</blockquote></div>)}
          <p className="mj-small">Frozen article excerpts; suggested pairs show the strongest shared term. Links open live Wikipedia.</p>
          {example?.path.length ? <p className="mj-small"><b>Shortest path:</b> {example.path.map(i => data.nodes[i].name).join(' → ')}</p> : null}
          <h3>Shared words</h3>{terms}
        </div></div> : <div className="mj-overlap">
          <p>Within · cosine link communities: <strong>{fmt(data.summary.within_mean)}</strong>. Between communities: <strong>{fmt(data.summary.across_mean)}</strong>. Partition agreement (NMI): <strong>{fmt(data.summary.nmi)}</strong>.</p>
          <div className="mj-table-scroll"><table><caption>Character counts · network lanes × text communities</caption><thead><tr><th scope="col">Link group</th>{data.groups.text.map(g => <th scope="col" key={g.id} title={g.label}>T{g.id + 1}</th>)}</tr></thead><tbody>{data.groups.network.map(g => <tr key={g.id}><th scope="row">N{g.id + 1} · {g.label}</th>{data.overlap[g.id].map((count, t) => <td key={t} style={{ background: `rgba(230,238,250,${count ? 0.04 + 0.22 * count / g.size : 0})` }}>{count || '—'}</td>)}</tr>)}</tbody></table></div>
          <p className="mj-small">Descriptive, not a significance test. NMI ranges from 0 (no shared information) to 1 (identical partitions). The 17 isolated characters share a display lane but retain separate singleton identities for analysis.</p>
        </div>}
      </div></dialog>
    <dialog ref={methods} className="journey-methods-dialog" aria-labelledby="mj-methods-title" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}><div>
      <header><p className="journey-kicker">Documentation</p><h2 id="mj-methods-title">Method, reproduction & AI</h2><button type="button" aria-label="Close methods" onClick={() => methods.current?.close()}>×</button></header>
      <section><h3>Dataset</h3><p>All 303 articles from the course’s marvel_pages.zip, joined by node_id to the week-1 roster and 1,784 directed links. The files matched fresh official downloads byte for byte on 19 October 2026. The frozen snapshot is 26 August 2026; all 17 isolates are retained.</p><a href="https://sunelehmann.com/socialgraphs2026-web/data/" target="_blank" rel="noreferrer">Official course data ↗</a></section>
      <section><h3>Text</h3><p>Full supplied articles; lowercase alphabetic tokens of two or more letters; scikit-learn English stopwords; min_df=2. Raw TF, smoothed IDF ln((1+N)/(1+df))+1, L2 normalization. Cosine is measured in the full 14,513-term space. The name check removes words capitalized in a majority of occurrences, then refits IDF. That heuristic also removes some ordinary words.</p></section>
      <section><h3>Communities</h3><p>The text graph unions each article’s top eight positive-cosine neighbors and weights edges by cosine. The structural graph symmetrizes the original Wikipedia links and drops self-links. Both partitions use Louvain, resolution 1, seed 7; weighted for text, unweighted for structure. Repeating the text graph at k=5 and k=12 gives NMI 0.703 and 0.759 against k=8.</p></section>
      <section><h3>3D layout</h3><p>The opener reuses Week 2’s actual 3D network coordinates. Language and Structure use one fixed community-lane layout: top reveals text membership, side reveals link membership. Steps 2 and 3 lock the camera to top and side views, joined by a smooth rotation. Step 4 unlocks free rotation and presents two key insights. Screen distances are not measurements. Node radius scales with square root of link degree, as in Week 2. The dark selection segment is a comparison guide, not an added link.</p></section>
      <section><h3>Reproduce</h3><p>Use .venv-week6 and run notebooks/week6/build_week6.py, or select that environment’s kernel in 6.11-go-nuts.ipynb. Seven tests verify the formula, all paths, pair rankings, isolated nodes, term contributions and matching exports. The downloadable export records file hashes and library versions.</p><a href={url('/data/week6/two-perspectives.json')} download="two-perspectives.json">Download all measurements ↓</a></section>
      <section><h3>Methods & AI</h3><p>A coding agent implemented and checked the pipeline and presentation, inspected the archived excerpts and drafted the results. Group review remains open. This page reuses Week 2’s immersive shell and styling; it does not alter Week 2.</p><a href="https://github.com/EstebanPerez99/social-graphs-and-interactions/blob/main/AI_METHODS.md" target="_blank" rel="noreferrer">Read AI log ↗</a></section>
    </div></dialog>
  </section>;
}

export default function MarvelJourney() {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(false);
    fetch(url('/data/week6/two-perspectives.json'), { signal: controller.signal }).then(r => {
      if (!r.ok) throw new Error('Measurements unavailable'); return r.json();
    }).then(setData).catch(e => { if (e.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [attempt]);
  if (!data) return <div className="friendship-journey"><div className="journey-loading" role="status">{error ? <span>Measurements could not load. <button type="button" onClick={() => setAttempt(x => x + 1)}>Try again</button></span> : 'Loading the Marvel universe…'}</div></div>;
  return <Journey data={data} />;
}
