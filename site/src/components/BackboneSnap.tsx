import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import {
  BufferAttribute,
  Color,
  InstancedMesh,
  Group,
  LineSegments,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import ClickSpark from "./bits/ClickSpark";
import artifact from "../data/week4/backbone-snap.json";
import "./backbone-snap.css";

type Vec3 = [number, number, number];
type SnapNode = {
  id: string;
  name: string;
  era: number;
  c: number;
  k: number;
  s: number;
  p: Vec3;
  last: number;
  d?: string;
};
type SnapEvent = {
  alpha: number;
  size: number;
  giant_after: number;
  community: number;
  purity: number;
  eras: Array<[string, number]>;
  bridge: Array<[number, number, number]>;
  members: number[];
};
type Community = { id: number; label: string; size: number; top: string[]; colour: string };
type SnapData = {
  network: { nodes: number; links: number; break_alpha: number; break_size: number; half_alpha: number };
  method: { break_size: number };
  communities: Community[];
  eras: string[];
  nodes: SnapNode[];
  links: Array<[number, number, number, number]>;
  events: SnapEvent[];
};

const data = artifact as unknown as SnapData;
const N = data.nodes.length;
const BREAK = data.method.break_size;
const ALPHA_MAX = 1;
const ALPHA_MIN = 0.001;
const LOG_MIN = Math.log10(ALPHA_MIN);
const PRESETS = [0.3, 0.2, 0.1] as const;
const FREEZE_MS = 1400;

// Links ascending by alpha_min: the backbone at any alpha is a prefix of this list.
const LINKS = [...data.links].sort((a, b) => a[3] - b[3]);
const LINK_ALPHA = Float64Array.from(LINKS, (link) => link[3]);
const FIRST_BREAK = data.events.find((event) => event.size >= BREAK)!;

/** Number of links with alpha_min < alpha (binary search on the sorted list). */
function visibleCount(alpha: number) {
  let lo = 0;
  let hi = LINK_ALPHA.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (LINK_ALPHA[mid] < alpha) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

type Structure = {
  comp: Int32Array;
  sizes: Map<number, number>;
  giant: number;
  linked: number;
  components: number;
  drift: Float32Array;
};

/** Components of the backbone made of the first `count` links, plus a drift per island. */
function structure(count: number): Structure {
  const parent = Int32Array.from({ length: N }, (_, i) => i);
  const find = (x: number) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const degree = new Uint16Array(N);
  for (let i = 0; i < count; i++) {
    const [u, v] = LINKS[i];
    degree[u]++;
    degree[v]++;
    const ru = find(u);
    const rv = find(v);
    if (ru !== rv) parent[ru] = rv;
  }
  const comp = new Int32Array(N);
  const sizes = new Map<number, number>();
  for (let i = 0; i < N; i++) {
    comp[i] = find(i);
    sizes.set(comp[i], (sizes.get(comp[i]) ?? 0) + 1);
  }
  let giant = comp[0];
  sizes.forEach((size, root) => {
    if (size > (sizes.get(giant) ?? 0)) giant = root;
  });

  const centroids = new Map<number, Vector3>();
  data.nodes.forEach((node, i) => {
    const size = sizes.get(comp[i]) ?? 1;
    if (size < 5) return;
    const c = centroids.get(comp[i]) ?? new Vector3();
    centroids.set(comp[i], c.add(new Vector3(...node.p).divideScalar(size)));
  });
  const centre = centroids.get(giant) ?? new Vector3();
  const drift = new Float32Array(N * 3);
  const offsets = new Map<number, Vector3>();
  centroids.forEach((c, root) => {
    if (root === giant) return;
    const direction = c.clone().sub(centre);
    if (direction.lengthSq() < 1e-4) direction.set(Math.sin(root), Math.cos(root), 0.3);
    const size = sizes.get(root) ?? 5;
    offsets.set(root, direction.normalize().multiplyScalar(0.3 + 0.08 * Math.log2(size)));
  });
  for (let i = 0; i < N; i++) {
    const offset = offsets.get(comp[i]);
    if (offset) drift.set([offset.x, offset.y, offset.z], i * 3);
  }

  let linked = 0;
  let components = 0;
  for (let i = 0; i < N; i++) if (degree[i] > 0) linked++;
  sizes.forEach((size) => {
    if (size > 1) components++;
  });
  return { comp, sizes, giant, linked, components, drift };
}

const fmtAlpha = (alpha: number) => (alpha >= 1 ? "1" : alpha.toPrecision(3));
const fmtInt = (value: number) => value.toLocaleString("en-US");
const eventAlpha = (alpha: number) => alpha.toFixed(3);

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

type Palette = { ink: string; faint: string; paper: string; communities: string[] };

function Scene({
  count,
  shape,
  palette,
  reducedMotion,
  focusId,
  thread,
  onHover,
  onPick,
}: {
  count: number;
  shape: Structure;
  palette: Palette;
  reducedMotion: boolean;
  focusId: number | null;
  thread: SnapEvent | null;
  onHover: (index: number | null) => void;
  onPick: (index: number | null) => void;
}) {
  const nodes = useRef<InstancedMesh>(null);
  const lines = useRef<LineSegments>(null);
  const { invalidate } = useThree();
  const geometry = useMemo(() => new SphereGeometry(1, 14, 10), []);
  const base = useMemo(() => data.nodes.map((node) => new Vector3(...node.p)), []);
  const current = useRef(base.map((v) => v.clone()));
  const target = useMemo(() => new Vector3(), []);
  const dummy = useMemo(() => new Object3D(), []);
  const moving = useRef(true);
  const positions = useMemo(() => new Float32Array(LINKS.length * 6), []);
  const threadPositions = useMemo(() => new Float32Array(6), []);
  const threadLine = useRef<LineSegments>(null);
  const labelGroups = useRef<Array<Group | null>>([]);

  // Link colours: tinted by community when both ends share one, grey across traditions;
  // heavier links sit closer to full ink. White ground, so lightness does the work of alpha.
  const colours = useMemo(() => {
    const out = new Float32Array(LINKS.length * 6);
    const white = new Color("#ffffff");
    const across = new Color(palette.faint);
    const tints = palette.communities.map((hex) => new Color(hex));
    const mixed = new Color();
    LINKS.forEach(([u, v, w], i) => {
      const cu = data.nodes[u].c;
      const same = cu === data.nodes[v].c;
      const strength = Math.min(1, 0.28 + 0.12 * Math.sqrt(w));
      mixed.copy(white).lerp(same ? tints[cu] : across, same ? strength : strength * 0.8);
      out.set([mixed.r, mixed.g, mixed.b, mixed.r, mixed.g, mixed.b], i * 6);
    });
    return out;
  }, [palette]);

  // Node colours: community hue; philosophers with no link left at this alpha fade out.
  useEffect(() => {
    const mesh = nodes.current;
    if (!mesh) return;
    const paper = new Color("#ffffff");
    const colour = new Color();
    data.nodes.forEach((node, i) => {
      const alone = (shape.sizes.get(shape.comp[i]) ?? 1) === 1;
      colour.set(palette.communities[node.c]);
      if (alone) colour.lerp(paper, 0.72);
      if (focusId === i) colour.set(palette.ink);
      mesh.setColorAt(i, colour);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    moving.current = true;
    invalidate();
  }, [shape, palette, focusId, invalidate]);

  useEffect(() => {
    lines.current?.geometry.setDrawRange(0, count * 2);
    invalidate();
  }, [count, invalidate]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    const mesh = nodes.current;
    const lineObject = lines.current;
    if (!mesh || !lineObject || !moving.current) return;
    const step = reducedMotion ? 1 : 1 - Math.exp(-3.2 * Math.min(delta, 0.05));
    let still = true;
    for (let i = 0; i < N; i++) {
      target.set(
        base[i].x + shape.drift[i * 3],
        base[i].y + shape.drift[i * 3 + 1],
        base[i].z + shape.drift[i * 3 + 2],
      );
      const point = current.current[i];
      point.lerp(target, step);
      if (point.distanceToSquared(target) > 1e-7) still = false;
      const node = data.nodes[i];
      const alone = (shape.sizes.get(shape.comp[i]) ?? 1) === 1;
      const radius = (0.0065 + 0.0015 * Math.sqrt(node.s)) * (alone ? 0.7 : 1) * (focusId === i ? 1.8 : 1);
      dummy.position.copy(point);
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();

    for (let i = 0; i < count; i++) {
      const a = current.current[LINKS[i][0]];
      const b = current.current[LINKS[i][1]];
      positions.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    }
    const attribute = lineObject.geometry.getAttribute("position") as BufferAttribute;
    attribute.needsUpdate = true;

    if (thread && threadLine.current) {
      const [u, v] = thread.bridge[0];
      const a = current.current[u];
      const b = current.current[v];
      threadPositions.set([a.x, a.y, a.z, b.x, b.y, b.z]);
      (threadLine.current.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
      threadLine.current.computeLineDistances();
      labelGroups.current[0]?.position.copy(a);
      labelGroups.current[1]?.position.copy(b);
    }

    if (still) moving.current = false;
    else invalidate();
  });

  // New target whenever the islands change.
  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [shape, thread, invalidate]);

  const pointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover(event.instanceId ?? null);
  };

  const labels = thread ? [thread.bridge[0][0], thread.bridge[0][1]] : [];

  return (
    <>
      <lineSegments ref={lines} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colours, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors toneMapped={false} />
      </lineSegments>
      {thread && (
        <lineSegments ref={threadLine} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[threadPositions, 3]} />
          </bufferGeometry>
          <lineDashedMaterial color={palette.ink} dashSize={0.025} gapSize={0.018} toneMapped={false} />
        </lineSegments>
      )}
      <instancedMesh
        ref={nodes}
        args={[geometry, undefined, N]}
        frustumCulled={false}
        onPointerMove={pointer}
        onPointerOut={() => onHover(null)}
        onClick={(event) => {
          event.stopPropagation();
          onPick(event.instanceId ?? null);
        }}
      >
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {labels.map((index, slot) => (
        <group key={index} ref={(group) => { labelGroups.current[slot] = group; }} position={current.current[index].toArray()}>
          <Html className="snap-label" zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
            {data.nodes[index].name}
          </Html>
        </group>
      ))}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping={false}
        minDistance={1.3}
        maxDistance={6}
        rotateSpeed={0.6}
        zoomSpeed={0.7}
      />
    </>
  );
}

function Chip({ community }: { community: number }) {
  const c = data.communities[community];
  return <i className="snap-chip" style={{ background: c.colour }} aria-hidden="true" />;
}

function PhilosopherCard({ index, alpha, pinned, onClose }: {
  index: number;
  alpha: number;
  pinned: boolean;
  onClose: () => void;
}) {
  const node = data.nodes[index];
  const community = data.communities[node.c];
  const stillLinked = node.last < alpha;
  return (
    <div className="snap-card" role="status">
      <p className="snap-kicker">
        <Chip community={node.c} /> {community.label}
      </p>
      <h3>{node.name}</h3>
      <p className="snap-card-era">{data.eras[node.era]}</p>
      {node.d && <p className="snap-card-desc">{node.d}</p>}
      <dl>
        <div><dt>Degree</dt><dd>{node.k}</dd></div>
        <div><dt>Strength</dt><dd>{node.s}</dd></div>
      </dl>
      <p className="snap-card-last">
        {stillLinked ? "Keeps" : "Kept"} a significant link until α = <b>{fmtAlpha(node.last)}</b>
        {stillLinked ? "" : " — cut loose at this setting"}
      </p>
      {pinned && (
        <p className="snap-card-actions">
          <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(node.id)}`} target="_blank" rel="noreferrer">
            Wikipedia <span aria-hidden="true">↗</span>
          </a>
          <button type="button" onClick={onClose}>Close</button>
        </p>
      )}
    </div>
  );
}

type Phase = "guess" | "play" | "freeze" | "after";

export default function BackboneSnap() {
  const root = useRef<HTMLElement>(null);
  const sliderId = useId();
  const reducedMotion = useReducedMotion();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [alpha, setAlpha] = useState(ALPHA_MAX);
  const [phase, setPhase] = useState<Phase>("guess");
  const [guess, setGuess] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const freezeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!root.current) return;
    const styles = getComputedStyle(root.current);
    setPalette({
      ink: styles.getPropertyValue("--color-ink").trim() || "#0f172a",
      faint: styles.getPropertyValue("--color-ink-faint").trim() || "#9aa4b2",
      paper: styles.getPropertyValue("--color-paper").trim() || "#f6f8fb",
      communities: data.communities.map((c) => c.colour),
    });
  }, []);
  useEffect(() => () => window.clearTimeout(freezeTimer.current), []);

  const count = useMemo(() => visibleCount(alpha), [alpha]);
  const shape = useMemo(() => structure(count), [count]);
  const giantSize = shape.sizes.get(shape.giant) ?? 1;
  // Newest break first, so the one that just happened is always in view.
  const happened = useMemo(() => data.events.filter((event) => event.alpha >= alpha).reverse(), [alpha]);
  const revealed = phase === "freeze" || phase === "after";

  const moveTo = useCallback((next: number) => {
    if (phase === "guess" || phase === "freeze") return;
    const value = Math.min(ALPHA_MAX, Math.max(ALPHA_MIN, next));
    if (phase === "play" && value <= FIRST_BREAK.alpha) {
      // The scene holds still for a beat at the break before the dial moves on.
      setAlpha(FIRST_BREAK.alpha);
      setPhase("freeze");
      freezeTimer.current = window.setTimeout(() => setPhase("after"), reducedMotion ? 600 : FREEZE_MS);
      return;
    }
    setAlpha(value);
  }, [phase, reducedMotion]);

  const reset = () => {
    window.clearTimeout(freezeTimer.current);
    setAlpha(ALPHA_MAX);
    setGuess(null);
    setPhase("guess");
    setPicked(null);
  };

  const focus = picked ?? hovered;
  const right = guess === FIRST_BREAK.community;
  const threadNames = FIRST_BREAK.bridge.map(([u, v]) => `${data.nodes[u].name} – ${data.nodes[v].name}`).join(", ");
  const tradition = data.communities[FIRST_BREAK.community].label;
  const locked = phase === "guess" || phase === "freeze";
  const sceneLabel =
    `Three-dimensional network of ${fmtInt(N)} philosophers coloured by Louvain community. ` +
    `At α = ${fmtAlpha(alpha)} the backbone keeps ${fmtInt(count)} links; ${fmtInt(shape.linked)} philosophers ` +
    `have a link, and the largest component holds ${fmtInt(giantSize)}.`;

  return (
    <section ref={root} className="snap" aria-label="Where philosophy snaps: disparity-filter dial">
      <div className="snap-stage">
        <div className="snap-canvas" role="img" aria-label={sceneLabel}>
          {palette ? (
            <Canvas
              frameloop="demand"
              camera={{ position: [0.45, 0.55, 3.6], fov: 42, near: 0.05, far: 40 }}
              dpr={[1, 1.75]}
              gl={{ antialias: true, alpha: true }}
              onPointerMissed={() => setPicked(null)}
              fallback={<div className="snap-fallback">WebGL is unavailable. The break log and the post below carry the same numbers.</div>}
            >
              <Scene
                count={count}
                shape={shape}
                palette={palette}
                reducedMotion={reducedMotion}
                focusId={focus}
                thread={revealed ? FIRST_BREAK : null}
                onHover={setHovered}
                onPick={setPicked}
              />
            </Canvas>
          ) : (
            <div className="snap-fallback" role="status">Loading 1,374 philosophers…</div>
          )}
        </div>

        <div className="snap-readout" aria-live="polite">
          <p className="snap-kicker">Disparity filter · both-ends rule</p>
          <p className="snap-alpha">α = {fmtAlpha(alpha)}</p>
          <dl>
            <div><dt>links kept</dt><dd>{fmtInt(count)}</dd></div>
            <div><dt>philosophers linked</dt><dd>{fmtInt(shape.linked)}</dd></div>
            <div><dt>components</dt><dd>{fmtInt(shape.components)}</dd></div>
            <div><dt>largest</dt><dd>{fmtInt(giantSize)}</dd></div>
          </dl>
        </div>

        {focus !== null && (
          <PhilosopherCard index={focus} alpha={alpha} pinned={picked !== null} onClose={() => setPicked(null)} />
        )}

        {phase === "guess" && (
          <div className="snap-gate">
            <p className="snap-kicker">Before you touch the dial</p>
            <h2>Which tradition leaves first?</h2>
            <p>
              Lowering α keeps only links that matter to one of their two philosophers. Pick the
              tradition you think lets go of the rest first; that unlocks the dial.
            </p>
            <div className="snap-guesses">
              {data.communities.map((community) => (
                <ClickSpark key={community.id} sparkColor={community.colour} sparkRadius={18} sparkCount={7} duration={380}>
                  <button
                    type="button"
                    onClick={() => {
                      setGuess(community.id);
                      setPhase("play");
                    }}
                  >
                    <Chip community={community.id} />
                    <span>{community.label}</span>
                  </button>
                </ClickSpark>
              ))}
            </div>
          </div>
        )}

        {revealed && (
          <div className={`snap-verdict${phase === "freeze" ? " is-fresh" : ""}`} role="status">
            <p className="snap-kicker">
              {right ? "You called it" : `You picked ${guess === null ? "nothing" : data.communities[guess].label}`}
            </p>
            <h2><Chip community={FIRST_BREAK.community} /> {tradition} leaves first</h2>
            <p>
              At α = <b>{eventAlpha(FIRST_BREAK.alpha)}</b>, {FIRST_BREAK.size} philosophers let go of the giant at once.
              The last thread: <b>{threadNames}</b> (weight {FIRST_BREAK.bridge[0][2]}).
            </p>
          </div>
        )}

        {phase === "play" && alpha === ALPHA_MAX && (
          <p className="snap-hint">You picked {data.communities[guess ?? 0].label}. Now drag α down.</p>
        )}
      </div>

      <div className="snap-controls">
        <label htmlFor={sliderId}>
          <span>α</span>
          <small>{locked ? (phase === "guess" ? "pick a tradition to unlock" : "holding at the break…") : "drag to filter"}</small>
        </label>
        <input
          id={sliderId}
          type="range"
          min={LOG_MIN}
          max={0}
          step={0.005}
          value={Math.log10(alpha)}
          disabled={locked}
          aria-valuetext={`alpha ${fmtAlpha(alpha)}, largest component ${giantSize}`}
          onChange={(event) => moveTo(10 ** Number(event.target.value))}
        />
        <div className="snap-scale" aria-hidden="true"><span>1</span><span>0.1</span><span>0.01</span><span>0.001</span></div>
        <div className="snap-presets">
          {PRESETS.map((value) => (
            <button key={value} type="button" disabled={locked} aria-pressed={alpha === value} onClick={() => moveTo(value)}>
              α = {value}
            </button>
          ))}
          <button type="button" disabled={locked} aria-pressed={alpha === FIRST_BREAK.alpha} onClick={() => moveTo(FIRST_BREAK.alpha)}>
            snap
          </button>
          <button type="button" className="snap-reset" onClick={reset}>Reset</button>
        </div>
      </div>

      <div className="snap-side">
        <div className="snap-legend">
          <p className="snap-kicker">Louvain community · full unweighted giant</p>
          <ul>
            {data.communities.map((community) => (
              <li key={community.id}><Chip community={community.id} />{community.label}<small>{community.size}</small></li>
            ))}
          </ul>
        </div>
        <div className="snap-log">
          <p className="snap-kicker">Break log · chunks of 5+ leaving the giant</p>
          {happened.length === 0 ? (
            <p className="snap-log-empty">Nothing has let go yet.</p>
          ) : (
            <ol>
              {happened.map((event, index) => (
                <li key={index} className={event.size >= BREAK ? "is-big" : ""}>
                  <span className="snap-log-alpha">{eventAlpha(event.alpha)}</span>
                  <Chip community={event.community} />
                  <span className="snap-log-what">
                    {data.communities[event.community].label} · {event.size}
                    <small>{event.bridge.slice(0, 2).map(([u, v]) => `${data.nodes[u].name} – ${data.nodes[v].name}`).join("; ")}{event.bridge.length > 2 ? ` +${event.bridge.length - 2}` : ""}</small>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
