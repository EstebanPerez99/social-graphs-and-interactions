import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Color, InstancedMesh, Object3D, Vector3, Matrix4, Quaternion } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { url } from '../lib/url';
import './marvel-perspectives.css';

export type View = 'top' | 'side' | 'free';
export type Lens = 'text' | 'network';
type Vec3 = [number, number, number];
type Node = { id: string; name: string; url: string; p: Vec3; t: number; s: number; lane: number; degree: number; words: string[]; excerpt: string; v: [number, number][] };
type Community = { id: number; label: string; size: number; color: string; isolated?: boolean };
type Example = { a: number; b: number; cosine: number; clean_cosine: number; distance: number | null; path: number[]; shared: { word: string; contribution: number }[]; excerpts: string[] };
export type Data = {
  nodes: Node[]; groups: Record<Lens, Community[]>; vocabulary: string[];
  cosine: number[][]; clean_cosine: number[][]; distance: (number | null)[][];
  network_edges: [number, number][]; text_edges: [number, number, number][];
  examples: Example[]; overlap: number[][];
  summary: { nodes: number; pairs: number; text_communities: number; network_communities: number; isolates: number; nmi: number; within_mean: number; across_mean: number };
};
const percent = (value: number) => value.toFixed(3);

export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="mp-fallback">The 3D view could not start. Explore the same characters, cosine scores and community table below.</div> : this.props.children;
  }
}

export function CameraRig({ view, request, reduced, onManual, intro = false, allowOrbit = true }: { view: View; request: number; reduced: boolean; onManual: () => void; intro?: boolean; allowOrbit?: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate, size } = useThree();
  const motion = useRef<{ from: Quaternion; to: Quaternion; fromRadius: number; toRadius: number; elapsed: number; duration: number } | null>(null);
  const origin = useMemo(() => new Vector3(), []);
  useEffect(() => {
    const introDistance = Math.max(0.708 / Math.tan(19 * Math.PI / 180), 0.708 / (Math.tan(19 * Math.PI / 180) * Math.max(0.5, size.width / size.height))) * 0.8;
    const destination = new Vector3(...(intro ? [0, introDistance, 0.001] : view === 'top' ? [0, 7.6, 0.001] : view === 'side' ? [0, 0, 7.6] : [5.2, 4.2, 5.2]) as Vec3);
    const up = new Vector3(0, intro || view === 'top' ? 0 : 1, intro || view === 'top' ? -1 : 0);
    if (intro) { camera.position.set(0, introDistance / 0.8, 0.001); camera.up.copy(up); camera.lookAt(origin); }
    motion.current = { from: camera.quaternion.clone(), to: new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(destination, origin, up)), fromRadius: camera.position.length(), toRadius: destination.length(), elapsed: 0, duration: reduced ? 0 : intro ? 12000 : 1600 };
    if (controls.current) { controls.current.target.set(0, 0, 0); controls.current.enabled = false; }
    invalidate();
  }, [request, invalidate, intro, size.width, size.height, reduced]);
  useFrame((_, delta) => {
    const current = motion.current;
    if (!current) return;
    current.elapsed += Math.min(delta, 0.1) * 1000;
    const progress = current.duration ? Math.min(1, current.elapsed / current.duration) : 1;
    const eased = progress * progress * (3 - 2 * progress);
    camera.quaternion.slerpQuaternions(current.from, current.to, eased);
    camera.position.set(0, 0, 1).applyQuaternion(camera.quaternion).multiplyScalar(current.fromRadius + (current.toRadius - current.fromRadius) * eased);
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (progress === 1) {
      motion.current = null;
      if (controls.current) { controls.current.update(); controls.current.enabled = allowOrbit; }
    } else invalidate();
  });
  return <OrbitControls ref={controls} makeDefault enabled={allowOrbit} enablePan={false} enableDamping={false}
    minDistance={intro ? 0.6 : 3} maxDistance={13} rotateSpeed={0.65}
    onStart={() => { if (allowOrbit) { motion.current = null; onManual(); } }} />;
}

function Backdrop() {
  const stars = useMemo(() => {
    // A static visual backdrop; no star represents an observation.
    let seed = 27;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const points: number[] = [];
    for (let i = 0; i < 350; i++) {
      const angle = random() * Math.PI * 2, z = random() * 2 - 1, radius = 10 + random() * 4;
      points.push(radius * Math.sqrt(1 - z * z) * Math.cos(angle), radius * z, radius * Math.sqrt(1 - z * z) * Math.sin(angle));
    }
    return new Float32Array(points);
  }, []);
  return <>
    <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[stars, 3]} /></bufferGeometry>
      <pointsMaterial color="#b6c1d1" size={0.018} transparent opacity={0.4} sizeAttenuation depthWrite={false} /></points>
    <gridHelper args={[4.1, 12, '#344258', '#1b293d']} position={[0, -2.05, 0]} />
  </>;
}

function Segments({ data, links, hot = false, light = false }: { data: Data; links: number[][]; hot?: boolean; light?: boolean }) {
  const positions = useMemo(() => new Float32Array(links.flatMap(([a, b]) => [...data.nodes[a].p, ...data.nodes[b].p])), [data, links]);
  return <lineSegments frustumCulled={false}><bufferGeometry>
    <bufferAttribute attach="attributes-position" args={[positions, 3]} />
  </bufferGeometry><lineBasicMaterial color={light ? '#0f172a' : hot ? '#ffffff' : '#a5b2c7'} transparent opacity={hot ? 0.95 : light ? 0.25 : 0.065} depthWrite={false} /></lineSegments>;
}

export function Scene({ data, lens, a, b, hovered, setHovered, pick, showLinks, filter, light = false, degreeTone = false, backdrop = true }: {
  data: Data; lens: Lens; a: number; b: number; hovered: number | null; setHovered: (i: number | null) => void;
  pick: (i: number) => void; showLinks: boolean; filter: number | null; light?: boolean; degreeTone?: boolean; backdrop?: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const { invalidate } = useThree();
  const groups = data.groups[lens];
  const connections = lens === 'text' ? data.text_edges : data.network_edges;
  const localLinks = useMemo(() => connections.filter(([i, j]) => i === a || j === a || i === b || j === b), [connections, a, b]);
  const selected = useMemo(() => [[a, b]], [a, b]);
  useEffect(() => {
    if (!mesh.current) return;
    const dummy = new Object3D();
    const quiet = new Color('#1f6f8b').lerp(new Color('#f6f8fb'), 0.04).offsetHSL(0, 0.12, 0.1);
    const strong = new Color('#d1495b').lerp(new Color('#f6f8fb'), 0.03).offsetHSL(0, 0.12, 0.08);
    data.nodes.forEach((node, index) => {
      const c = lens === 'text' ? node.t : node.lane;
      const focused = index === a || index === b || index === hovered;
      dummy.position.fromArray(node.p);
      const radius = degreeTone ? (0.1 + Math.sqrt(node.degree) * 0.034) / 12 : 0.018 + Math.sqrt(node.degree) * 0.0034;
      dummy.scale.setScalar(focused ? radius * 1.65 : filter !== null && c !== filter ? 0.009 : radius);
      dummy.updateMatrix(); mesh.current!.setMatrixAt(index, dummy.matrix);
      const tone = degreeTone ? quiet.clone().lerpHSL(strong, Math.log1p(node.degree) / Math.log1p(106)) : new Color(groups[c].color);
      mesh.current!.setColorAt(index, focused ? new Color(light ? '#0f172a' : '#ffffff') : filter !== null && c !== filter ? new Color(light ? '#d8dee7' : '#344055') : tone);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere(); invalidate();
  }, [data, lens, a, b, hovered, filter, groups, invalidate, light, degreeTone]);
  const hover = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); setHovered(event.instanceId ?? null); };
  return <>
    {!light && backdrop && <Backdrop />}
    <Segments data={data} links={showLinks ? connections : localLinks} light={light} />
    <Segments data={data} links={selected} hot light={light} />
    <instancedMesh ref={mesh} args={[undefined, undefined, data.nodes.length]} frustumCulled={false}
      onPointerMove={hover} onPointerOut={() => setHovered(null)}
      onClick={event => { event.stopPropagation(); if (event.instanceId !== undefined) pick(event.instanceId); }}>
      <sphereGeometry args={[1, 12, 10]} /><meshBasicMaterial toneMapped={false} />
    </instancedMesh>
    {[a, b].filter((i, n, arr) => arr.indexOf(i) === n).map(index => <group key={index} position={data.nodes[index].p}>
      <Html center position={[0, 0.12, 0]} zIndexRange={[15, 0]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <span className={`mp-node-label${light ? ' is-light' : ''}`}>{data.nodes[index].name}</span>
      </Html></group>)}
  </>;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches); update();
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

function Explorer({ data, downloadUrl }: { data: Data; downloadUrl?: string }) {
  const initial = data.examples[0];
  const [a, setA] = useState(initial.a), [b, setB] = useState(initial.b);
  const [view, setView] = useState<View>('top'), [lens, setLens] = useState<Lens>('text');
  const [request, setRequest] = useState(0), [filter, setFilter] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null), [showLinks, setShowLinks] = useState(false);
  const [tab, setTab] = useState<'pairs' | 'communities'>('pairs');
  const [pickSlot, setPickSlot] = useState<'a' | 'b'>('a');
  const reduced = useReducedMotion();
  const left = data.nodes[a], right = data.nodes[b], score = data.cosine[a][b], distance = data.distance[a][b];
  const example = data.examples.find(e => e.a === Math.min(a, b) && e.b === Math.max(a, b));
  const shared = useMemo(() => {
    const weights = new Map(right.v);
    return left.v.filter(([index]) => weights.has(index)).map(([index, w]) => ({ word: data.vocabulary[index], contribution: w * weights.get(index)! }))
      .sort((x, y) => y.contribution - x.contribution).slice(0, 8);
  }, [data, left, right]);
  const options = useMemo(() => data.nodes.map((n, i) => ({ n, i })).sort((x, y) => x.n.name.localeCompare(y.n.name)), [data]);
  const changeView = (next: View) => {
    setView(next); setRequest(x => x + 1);
    if (next !== 'free') { setLens(next === 'top' ? 'text' : 'network'); setFilter(null); }
  };
  const pickPair = (example: Example) => { setA(example.a); setB(example.b); setFilter(null); };
  const neighbors = [...data.cosine[a].keys()].filter(i => i !== a).sort((i, j) => data.cosine[a][j] - data.cosine[a][i]).slice(0, 5);
  return <section className="mp" aria-label="Marvel: two perspectives">
    <header className="mp-heading"><p className="mp-eyebrow">Week 06 / the same 303 characters</p>
      <h2>One universe.<br />Two ways to belong.</h2>
      <p>Find the characters whose words bring them together—and whose links keep them apart.</p>
    </header>
    <div className="mp-toolbar">
      <div className="mp-view-buttons" aria-label="Camera perspective">
        {(['top', 'side', 'free'] as View[]).map((v, i) => <button type="button" key={v} aria-pressed={view === v} onClick={() => changeView(v)}>
          <span>0{i + 1}</span>{v === 'top' ? 'Top · language' : v === 'side' ? 'Side · structure' : 'Free rotation'}
        </button>)}
      </div>
      <label className="mp-check"><input type="checkbox" checked={showLinks} onChange={e => setShowLinks(e.target.checked)} />All {lens === 'text' ? 'similarity' : 'network'} links</label>
    </div>
    <div className="mp-stage">
      <div className="mp-scene" role="img" aria-label={`3D network, ${lens === 'text' ? 'text similarity' : 'link network'} communities. Selected: ${left.name} and ${right.name}. All observations are also available in the controls and tables.`}>
        <SceneBoundary><Canvas frameloop="demand" camera={{ position: [0, 7.6, 0.001], up: [0, 0, -1], fov: 38, near: 0.05, far: 45 }}
          dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}
          fallback={<div className="mp-fallback">WebGL is unavailable. Use the character controls and tables below.</div>}>
          <Scene data={data} lens={lens} a={a} b={b} hovered={hovered} setHovered={setHovered}
            pick={i => pickSlot === 'a' ? setA(i) : setB(i)} showLinks={showLinks} filter={filter} />
          <CameraRig view={view} request={request} reduced={reduced} onManual={() => setView('free')} />
        </Canvas></SceneBoundary>
      </div>
      <div className="mp-scene-caption"><span>{view === 'top' ? 'Looking down / textual communities' : view === 'side' ? 'Looking across / network communities' : 'Orbiting / both community dimensions'}</span><span>Drag to orbit · scroll to zoom</span></div>
      <aside className="mp-legend">
        <div className="mp-legend-head"><p className="mp-eyebrow">Color by community</p>
          <select aria-label="Color nodes by" value={lens} onChange={e => { setLens(e.target.value as Lens); setFilter(null); }}><option value="text">Text similarity</option><option value="network">Link network</option></select>
        </div>
        <button className="mp-clear" type="button" onClick={() => setFilter(null)} disabled={filter === null}>Show all characters</button>
        <div className="mp-community-list">{data.groups[lens].map(g => <button type="button" key={g.id} aria-pressed={filter === g.id} onClick={() => setFilter(filter === g.id ? null : g.id)}>
          <i style={{ background: g.color }} /><span><b>{lens === 'text' ? 'T' : 'N'}{g.id + 1}</b> {g.label}</span><small>{g.size}</small>
        </button>)}</div>
        <p className="mp-legend-note">Click a community to highlight it. Colors identify groups within the selected partition.</p>
      </aside>
      {hovered !== null && <div className="mp-hover" role="status"><b>{data.nodes[hovered].name}</b><span>T{data.nodes[hovered].t + 1} · {data.nodes[hovered].degree ? `N${data.nodes[hovered].lane + 1}` : 'unlinked singleton'}</span></div>}
    </div>
    <p className="mp-layout-note">Community lanes, not a distance scale. Positions stay fixed when you rotate; use the measured cosine and path length below. The white segment marks your selected pair, not a Wikipedia link.</p>
    <div className="mp-inspector">
      <div className="mp-selectors">{(['a', 'b'] as const).map((slot, i) => <label key={slot}>
        <span>Character {i + 1}</span><select aria-label={`Character ${i + 1}`} value={slot === 'a' ? a : b} onChange={e => (slot === 'a' ? setA : setB)(Number(e.target.value))}>
          {options.map(({ n, i }) => <option key={n.id} value={i}>{n.name}</option>)}
        </select></label>)}
        <label><span>Clicking a dot selects</span><select value={pickSlot} onChange={e => setPickSlot(e.target.value as 'a' | 'b')}><option value="a">Character 1</option><option value="b">Character 2</option></select></label>
      </div>
      <div className="mp-measures" aria-live="polite">
        <div><span>TF-IDF cosine</span><strong>{percent(score)}</strong><small>1 = identical direction</small></div>
        <div><span>Network separation</span><strong>{distance === null ? 'No path' : `${distance} ${distance === 1 ? 'hop' : 'hops'}`}</strong><small>Undirected shortest path</small></div>
        <div><span>Names filtered · cosine</span><strong>{percent(data.clean_cosine[a][b])}</strong><small>Separate refit; sensitivity check</small></div>
      </div>
      <div className="mp-evidence">
        <div><h3>What brings their text together?</h3><p>Largest shared term contributions to the original cosine.</p>
          <div className="mp-terms">{shared.map(term => <div key={term.word}><span>{term.word}</span><meter min={0} max={1} value={score ? term.contribution / score : 0} /><small>{(100 * term.contribution / (score || 1)).toFixed(1)}%</small></div>)}</div>
        </div>
        <div><h3>Read before interpreting</h3>
          {[a, b].map((index, slot) => <div key={`${index}-${slot}`} className="mp-excerpt"><a href={data.nodes[index].url} target="_blank" rel="noreferrer">{data.nodes[index].name} ↗</a>
            <blockquote>{example ? example.excerpts[index === example.a ? 0 : 1] : data.nodes[index].excerpt}</blockquote>
          </div>)}
          <small>Excerpts from the frozen archive. For suggested pairs, both surround the strongest shared term. Links open live Wikipedia.</small>
        </div>
      </div>
      {example && example.path.length > 0 && <p className="mp-path"><b>Shortest path:</b> {example.path.map(i => data.nodes[i].name).join(' → ')}</p>}
      <div className="mp-neighbors"><span>Closest articles to {left.name}:</span>{neighbors.map(i => <button type="button" key={i} onClick={() => setB(i)}>{data.nodes[i].name} <b>{percent(data.cosine[a][i])}</b></button>)}</div>
    </div>
    <div className="mp-tabs" role="tablist" aria-label="Research questions">
      <button id="mp-pair-tab" role="tab" type="button" aria-selected={tab === 'pairs'} aria-controls="mp-pairs" onClick={() => setTab('pairs')}>01 / Close in text, far in links</button>
      <button id="mp-community-tab" role="tab" type="button" aria-selected={tab === 'communities'} aria-controls="mp-communities" onClick={() => setTab('communities')}>02 / Do communities share language?</button>
    </div>
    {tab === 'pairs' ? <div role="tabpanel" id="mp-pairs" aria-labelledby="mp-pair-tab" className="mp-results">
      <h3>Start with a surprising pair</h3><p>Highest-cosine pairs at least three network hops apart. Disconnected pairs are listed separately; “no path” is not a numerical distance.</p>
      <div className="mp-pairs">{data.examples.map((e, i) => <button key={`${e.a}-${e.b}`} type="button" aria-pressed={a === e.a && b === e.b} onClick={() => pickPair(e)}>
        <small>{e.distance === null ? 'DISCONNECTED' : `${String(i + 1).padStart(2, '0')} / ${e.distance} HOPS`}</small>
        <span>{data.nodes[e.a].name}<em> ↔ </em>{data.nodes[e.b].name}</span><strong>{percent(e.cosine)}</strong>
      </button>)}</div>
    </div> : <div role="tabpanel" id="mp-communities" aria-labelledby="mp-community-tab" className="mp-results">
      <h3>Two partitions of one universe</h3><p>Mean cosine within structural communities: <b>{percent(data.summary.within_mean)}</b>; between communities: <b>{percent(data.summary.across_mean)}</b>. These are descriptive averages over pairs, not a significance test.</p>
      <p>Partition agreement (NMI): <b>{percent(data.summary.nmi)}</b>, where 0 means no shared information and 1 means identical partitions.</p>
      <div className="mp-table-wrap"><table><caption>Character counts: network lanes × textual communities</caption><thead><tr><th scope="col">Network group</th>{data.groups.text.map(t => <th key={t.id} scope="col" title={t.label}>T{t.id + 1}</th>)}</tr></thead>
        <tbody>{data.groups.network.map(g => <tr key={g.id}><th scope="row">N{g.id + 1} · {g.label}</th>{data.overlap[g.id].map((count, t) => <td key={t} style={{ background: `rgba(15,23,42,${count ? 0.035 + count / g.size * 0.24 : 0})` }}>{count || '—'}</td>)}</tr>)}</tbody></table></div>
      <p>Unlinked characters keep separate singleton community identities in the analysis. Their shared display lane is only a space-saving convention.</p>
    </div>}
    <footer className="mp-footer"><span>Frozen course snapshot · 26 Aug 2026 · seed 7</span><a href={downloadUrl ?? url('/data/week6/two-perspectives.json')} download="two-perspectives.json">Download measurements ↓</a></footer>
  </section>;
}

export default function MarvelPerspectives({ embeddedData, downloadUrl }: { embeddedData?: Data; downloadUrl?: string }) {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (embeddedData) { setData(embeddedData); return; }
    const controller = new AbortController(); setError(false);
    fetch(url('/data/week6/two-perspectives.json'), { signal: controller.signal }).then(r => {
      if (!r.ok) throw new Error('Unable to load measurements'); return r.json();
    }).then(setData).catch(e => { if (e.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [attempt, embeddedData]);
  if (error) return <div className="mp-loading" role="alert">The measurements could not load. <button type="button" onClick={() => setAttempt(x => x + 1)}>Try again</button></div>;
  if (!data) return <div className="mp-loading" role="status">Loading 303 characters and their measured relationships…</div>;
  return <Explorer data={data} downloadUrl={downloadUrl} />;
}
