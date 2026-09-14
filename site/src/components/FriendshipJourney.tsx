import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import {
  BufferAttribute,
  Color,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  SphereGeometry,
  Vector3,
} from "three";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import journeyArtifact from "../data/week2/friendship-journey.json";
import analysisArtifact from "../data/week2/friendship-paradox.json";
import "./friendship-journey.css";

type Position = [number, number, number];

type JourneyNode = {
  id: string;
  name: string;
  degree: number;
  mean_neighbor_degree: number | null;
  higher_degree_neighbors: number;
  local_paradox: boolean | null;
  unbeaten: boolean | null;
  friend_sample_probability: number;
  url: string | null;
  description: string | null;
  thumbnail: string | null;
  position: Position;
  shuffled_position: Position;
};

type JourneyLink = { source: string; target: string };

type JourneyData = {
  seed: number;
  swaps: number;
  nodes: JourneyNode[];
  links: JourneyLink[];
  shuffled_links: JourneyLink[];
  summary: Record<string, number>;
  shuffled_summary: Record<string, number>;
  popular_friends: Array<{
    node_id: string;
    name: string;
    degree: number;
    friend_sample_probability: number;
  }>;
  unbeaten: Array<{ id: string; name: string; degree: number }>;
};

type SceneColors = {
  ink: string;
  muted: string;
  faint: string;
  grid: string;
  paper: string;
  low: string;
  high: string;
};

const data = journeyArtifact as unknown as JourneyData;
const nullModels = analysisArtifact.null_models;
const degreeShuffle = nullModels.find(
  (model) => model.model === "degree-preserving shuffle",
);

const stages = [
  {
    short: "Question",
    title: "The Superfriends Paradox",
    note: "Does the friendship paradox hold—and which popular friends drive it?",
  },
  {
    short: "Observe",
    title: "The observed network",
    note: "303 characters and 1,434 undirected links. Node size and tone encode degree.",
  },
  {
    short: "Rewire",
    title: "Same degrees, different neighbours",
    note: "14,340 edge swaps change the neighbours while preserving every node’s degree.",
  },
  {
    short: "Compare",
    title: "Most characters look up",
    note: "Each point compares one character’s degree with the mean degree of their neighbours.",
  },
  {
    short: "Conclude",
    title: "Degree inequality creates the paradox",
    note: "One sampling rule yields three concise answers about the paradox, its drivers, and its cause.",
  },
] as const;

const percent = (value: number, digits = 1) => `${(100 * value).toFixed(digits)}%`;
const decimal = (value: number, digits = 2) => value.toFixed(digits);

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

function TopCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const halfExtent = 22;
    const verticalFov = (perspective.fov * Math.PI) / 180;
    const aspect = Math.max(0.5, size.width / size.height);
    const verticalDistance = halfExtent / Math.tan(verticalFov / 2);
    const horizontalDistance = halfExtent / (Math.tan(verticalFov / 2) * aspect);
    const distance = Math.max(verticalDistance, horizontalDistance);
    camera.position.set(0, distance, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    perspective.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  return null;
}

function NetworkScene({
  shuffled,
  selectedId,
  colors,
  reducedMotion,
  onSelect,
}: {
  shuffled: boolean;
  selectedId: string | null;
  colors: SceneColors;
  reducedMotion: boolean;
  onSelect: (id: string | null) => void;
}) {
  const nodeMeshes = useRef<Array<Mesh | null>>([]);
  const lines = useRef<LineSegments>(null);
  const point = useMemo(() => new Vector3(), []);
  const nodeGeometry = useMemo(() => new SphereGeometry(1, 12, 12), []);
  const current = useRef(data.nodes.map((node) => new Vector3(...node.position)));
  const idToIndex = useMemo(
    () => new Map(data.nodes.map((node, index) => [node.id, index])),
    [],
  );
  const links = shuffled ? data.shuffled_links : data.links;
  const edgePositions = useMemo(
    () => new Float32Array(links.length * 6),
    [links],
  );
  const nodeMaterials = useMemo(() => {
    const paper = new Color(colors.paper);
    const quiet = new Color(colors.low).lerp(paper, 0.04).offsetHSL(0, 0.12, 0.1);
    const strong = new Color(colors.high).lerp(paper, 0.03).offsetHSL(0, 0.12, 0.08);
    const buckets = Array.from({ length: 12 }, (_, index) =>
      new MeshBasicMaterial({
        color: quiet.clone().lerpHSL(strong, index / 11),
        toneMapped: false,
      }),
    );
    const selected = new MeshBasicMaterial({ color: colors.ink, toneMapped: false });
    return { buckets, selected };
  }, [colors]);

  useEffect(() => () => {
    nodeGeometry.dispose();
    nodeMaterials.buckets.forEach((material) => material.dispose());
    nodeMaterials.selected.dispose();
  }, [nodeGeometry, nodeMaterials]);

  useFrame((_, delta) => {
    const lineObject = lines.current;
    if (!lineObject) return;

    data.nodes.forEach((node, index) => {
      const nodeObject = nodeMeshes.current[index];
      if (!nodeObject) return;
      const target = shuffled ? node.shuffled_position : node.position;
      if (reducedMotion) {
        current.current[index].set(...target);
      } else {
        current.current[index].lerp(point.set(...target), 1 - Math.exp(-4.8 * delta));
      }
      const radius = 0.1 + Math.sqrt(node.degree) * 0.034;
      const selectedScale = node.id === selectedId ? 1.65 : 1;
      nodeObject.position.copy(current.current[index]);
      nodeObject.scale.setScalar(radius * selectedScale);
    });

    links.forEach((link, edgeIndex) => {
      const source = current.current[idToIndex.get(link.source) ?? 0];
      const target = current.current[idToIndex.get(link.target) ?? 0];
      const offset = edgeIndex * 6;
      edgePositions[offset] = source.x;
      edgePositions[offset + 1] = source.y;
      edgePositions[offset + 2] = source.z;
      edgePositions[offset + 3] = target.x;
      edgePositions[offset + 4] = target.y;
      edgePositions[offset + 5] = target.z;
    });
    const position = lineObject.geometry.getAttribute("position") as BufferAttribute;
    position.needsUpdate = true;
  });

  return (
    <>
      <lineSegments ref={lines} renderOrder={0}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[edgePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={colors.ink}
          transparent
          opacity={shuffled ? 0.28 : 0.34}
          depthWrite={false}
        />
      </lineSegments>
      {data.nodes.map((node, index) => {
        const degreeWeight = Math.log1p(node.degree) / Math.log1p(106);
        const bucket = Math.round(degreeWeight * (nodeMaterials.buckets.length - 1));
        return (
          <mesh
            key={node.id}
            ref={(object) => { nodeMeshes.current[index] = object; }}
            geometry={nodeGeometry}
            material={node.id === selectedId ? nodeMaterials.selected : nodeMaterials.buckets[bucket]}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(node.id);
            }}
          />
        );
      })}
      <TopCamera />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={13}
        maxDistance={110}
        rotateSpeed={0.55}
        zoomSpeed={0.65}
      />
    </>
  );
}

function CharacterDetails({ selected }: { selected: JourneyNode }) {
  return (
    <div className="journey-character">
      {selected.thumbnail && (
        <img
          src={selected.thumbnail}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
      <p className="journey-kicker">Selected node</p>
      <h3>{selected.name}</h3>
      {selected.description && <p className="journey-character-description">{selected.description}</p>}
      <dl className="journey-node-stats">
        <div>
          <dt>Degree</dt>
          <dd>{selected.degree}</dd>
        </div>
        <div>
          <dt>Neighbours’ mean</dt>
          <dd>
            {selected.mean_neighbor_degree === null
              ? "—"
              : decimal(selected.mean_neighbor_degree, 1)}
          </dd>
        </div>
        <div>
          <dt>Higher-degree neighbours</dt>
          <dd>{selected.higher_degree_neighbors}/{selected.degree}</dd>
        </div>
        <div>
          <dt>Local paradox</dt>
          <dd>
            {selected.local_paradox === null
              ? "Not eligible"
              : selected.local_paradox
                ? "Yes"
                : "No"}
          </dd>
        </div>
      </dl>
      {selected.url && (
        <a href={selected.url} target="_blank" rel="noreferrer">
          Wikipedia article <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  );
}

function CharacterSelect({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const selected = data.nodes.find((node) => node.id === selectedId) ?? null;
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!normalizedQuery) return data.nodes.slice().sort((a, b) => b.degree - a.degree).slice(0, 8);
    return data.nodes
      .filter((node) => node.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
        return aStarts - bStarts || b.degree - a.degree || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [normalizedQuery]);

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.name]);

  const choose = (node: JourneyNode | null) => {
    onSelect(node?.id ?? null);
    setQuery(node?.name ?? "");
    setOpen(false);
    setActiveIndex(0);
  };

  return (
    <div
      ref={root}
      className="journey-picker"
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label htmlFor={`journey-character-${listId}`}>Inspect a character</label>
      <div className="journey-combobox-control">
        <input
          id={`journey-character-${listId}`}
          name="character"
          type="search"
          value={query}
          placeholder="Search 303 characters…"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (selectedId) onSelect(null);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(matches.length - 1, index + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(0, index - 1));
            } else if (event.key === "Enter" && open && matches[activeIndex]) {
              event.preventDefault();
              choose(matches[activeIndex]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {query && (
          <button type="button" aria-label="Clear character" onClick={() => choose(null)}>
            ×
          </button>
        )}
      </div>
      {open && (
        <ul id={listId} className="journey-combobox-list" role="listbox">
          <li
            role="option"
            aria-selected={!selectedId}
            className={!selectedId ? "is-selected" : ""}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(null)}
          >
            <span className="journey-degree-dot is-overview" aria-hidden="true" />
            <span>Network overview</span>
            <small>all nodes</small>
          </li>
          {matches.map((node, index) => (
            <li
              id={`${listId}-${index}`}
              key={node.id}
              role="option"
              aria-selected={node.id === selectedId}
              className={`${index === activeIndex ? "is-active" : ""}${node.id === selectedId ? " is-selected" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(node)}
            >
              <span
                className={`journey-degree-dot ${node.degree >= 30 ? "is-high" : node.degree >= 10 ? "is-mid" : "is-low"}`}
                aria-hidden="true"
              />
              <span>{node.name}</span>
              <small>k = {node.degree}</small>
            </li>
          ))}
          {matches.length === 0 && <li className="is-empty">No matching character</li>}
        </ul>
      )}
    </div>
  );
}

function NodePanel({
  selected,
  shuffled,
  selectedId,
  onSelect,
}: {
  selected: JourneyNode | null;
  shuffled: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const summary = shuffled ? data.shuffled_summary : data.summary;

  return (
    <aside className="journey-panel" aria-live="polite">
      <CharacterSelect selectedId={selectedId} onSelect={onSelect} />
      <div className="journey-degree-key" aria-label="Node tone: low degree to high degree">
        <span>Low degree</span>
        <i aria-hidden="true" />
        <span>High degree</span>
      </div>
      {selected ? (
        <CharacterDetails selected={selected} />
      ) : (
        <div className="journey-overview">
          <p className="journey-kicker">
            {shuffled ? "Degree-preserving null" : "Observed network"}
          </p>
          <h3>{shuffled ? "The hubs remain" : "Pick any point"}</h3>
          <p>
            {shuffled
              ? "Every character keeps the same number of links; only their neighbours change."
              : "Click a point, rotate the network, or use the character list above."}
          </p>
          <dl className="journey-summary-stats">
            <div>
              <dt>Characters</dt>
              <dd>{summary.node_count}</dd>
            </div>
            <div>
              <dt>Links</dt>
              <dd>{summary.edge_count.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Mean person</dt>
              <dd>{decimal(summary.person_mean_degree)}</dd>
            </div>
            <div>
              <dt>Mean friend</dt>
              <dd>{decimal(summary.friend_mean_degree)}</dd>
            </div>
          </dl>
        </div>
      )}
    </aside>
  );
}

function ScatterPlot({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const points = data.nodes.filter(
    (node) => node.degree > 0 && node.mean_neighbor_degree !== null,
  );
  const width = 760;
  const height = 500;
  const margin = { top: 28, right: 36, bottom: 62, left: 72 };
  const max = 128;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const logScale = (value: number, range: number) =>
    (Math.log(value) / Math.log(max)) * range;
  const x = (value: number) => margin.left + logScale(value, innerWidth);
  const y = (value: number) => height - margin.bottom - logScale(value, innerHeight);
  const ticks = [1, 2, 5, 10, 20, 50, 100];
  const selected = data.nodes.find((node) => node.id === selectedId) ?? null;

  return (
    <div className="journey-plot-wrap">
      <div className="journey-plot-copy">
        <p className="journey-kicker">Local friendship paradox</p>
        <h3>250 of 286 look up</h3>
        <p>
          Points above the diagonal have neighbours whose average degree exceeds
          their own.
        </p>
      </div>
      <svg
        className="journey-plot"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="friendship-plot-title friendship-plot-desc"
      >
        <title id="friendship-plot-title">
          Mean neighbour degree versus character degree
        </title>
        <desc id="friendship-plot-desc">
          A log-log scatterplot where 250 of 286 connected characters lie above
          the equal-degree diagonal.
        </desc>
        {ticks.map((tick) => (
          <g key={tick} className="journey-plot-grid">
            <line x1={x(tick)} x2={x(tick)} y1={margin.top} y2={height - margin.bottom} />
            <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
            <text x={x(tick)} y={height - 34} textAnchor="middle">
              {tick}
            </text>
            <text x={54} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <line
          className="journey-plot-equal"
          x1={x(1)}
          x2={x(100)}
          y1={y(1)}
          y2={y(100)}
        />
        {points.map((node) => {
          const selected = node.id === selectedId;
          return (
            <circle
              key={node.id}
              className={`journey-plot-point${node.local_paradox ? " is-above" : ""}${selected ? " is-selected" : ""}`}
              cx={x(node.degree)}
              cy={y(node.mean_neighbor_degree ?? 1)}
              r={selected ? 6.5 : 3.4}
              onClick={() => onSelect(node.id)}
            />
          );
        })}
        {data.unbeaten.map((item) => {
          const node = data.nodes.find((candidate) => candidate.id === item.id);
          if (!node?.mean_neighbor_degree) return null;
          return (
            <g key={node.id} className="journey-plot-label">
              <line
                x1={x(node.degree)}
                y1={y(node.mean_neighbor_degree)}
                x2={x(node.degree) - 8}
                y2={y(node.mean_neighbor_degree) - 12}
              />
              <text
                x={x(node.degree) - 11}
                y={y(node.mean_neighbor_degree) - 15}
                textAnchor="end"
              >
                {node.name}
              </text>
            </g>
          );
        })}
        <text className="journey-axis-title" x={margin.left + innerWidth / 2} y={486} textAnchor="middle">
          Character degree
        </text>
        <text
          className="journey-axis-title"
          transform={`translate(17 ${margin.top + innerHeight / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          Mean neighbour degree
        </text>
      </svg>
      <div className="journey-plot-picker">
        <CharacterSelect selectedId={selectedId} onSelect={onSelect} />
        {selected ? (
          <CharacterDetails selected={selected} />
        ) : (
          <p>Click a dot to inspect that character and its local neighbourhood.</p>
        )}
      </div>
    </div>
  );
}

function Conclusions() {
  const summary = data.summary;
  const topFiveShare = data.popular_friends.reduce(
    (total, node) => total + node.friend_sample_probability,
    0,
  );
  const topNames = data.popular_friends.map((node) => node.name.replace(" (character)", ""));

  return (
    <div className="journey-conclusions">
      <header className="journey-conclusion-question">
        <p className="journey-kicker">Main question</p>
        <h2>
          Does the friendship paradox hold among superheroes—and who are the
          popular friends that drive it? Is anyone out-popularized by nobody?
        </h2>
      </header>
      <section>
        <p className="journey-kicker">01 · Does it hold?</p>
        <h3>Yes—strongly.</h3>
        <p>
          A uniformly chosen connected character has degree{" "}
          <strong>{decimal(summary.person_mean_degree)}</strong>; one uniformly
          chosen neighbour has degree <strong>{decimal(summary.friend_mean_degree)}</strong>
          {" "}on average. The friend is at least as connected in{" "}
          <strong>{percent(summary.friend_at_least_as_popular_probability)}</strong>
          {" "}of draws, and <strong>250 of 286 ({percent(summary.local_paradox_fraction)})</strong>
          {" "}connected characters have a higher mean neighbour degree.
        </p>
      </section>
      <section>
        <p className="journey-kicker">02 · Who drives it?</p>
        <h3>Hubs that many neighbours can reach.</h3>
        <p>
          {topNames.join(", ")} account for <strong>{percent(topFiveShare)}</strong>
          {" "}of all friend draws. Spider-Man alone appears in{" "}
          <strong>{percent(data.popular_friends[0].friend_sample_probability, 2)}</strong>.
          Only <strong>Spider-Man</strong> and <strong>Radian</strong> have no
          direct neighbour with higher degree; Radian leads only a separate small
          component.
        </p>
      </section>
      <section>
        <p className="journey-kicker">03 · What surprised us?</p>
        <h3>The exact wiring matters less than the degree sequence.</h3>
        <p>
          Across 100 degree-preserving shuffles, the selected friend’s mean degree
          remained <strong>{decimal(degreeShuffle?.friend_mean_degree_mean ?? 0)}</strong>.
          Degree inequality—not the specific pattern of links—drives the paradox.
        </p>
      </section>
      <p className="journey-caveat">
        Here, “popularity” means degree in the undirected Wikipedia article-link
        network—not social popularity inside the Marvel universe.
      </p>
    </div>
  );
}

function SceneOverlay({
  stage,
  selected,
  selectedId,
  onSelect,
}: {
  stage: number;
  selected: JourneyNode | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <Html fullscreen className="journey-html">
      <div className={`journey-overlay stage-${stage}`} key={stage}>
        {stage === 0 && (
          <div className="journey-title-card">
            <p>Week 2 · Friendship paradox</p>
            <h1 id="journey-title">The Superfriends Paradox</h1>
            <p className="journey-title-question">
              Does the friendship paradox hold among superheroes? Who are the
              popular friends that drive it—and is anyone out-popularized by nobody?
            </p>
          </div>
        )}
        {(stage === 1 || stage === 2) && (
          <div className="journey-scene-label">
            <span>{String(stage + 1).padStart(2, "0")} / {String(stages.length).padStart(2, "0")}</span>
            <h2>{stages[stage].title}</h2>
          </div>
        )}
        {(stage === 1 || stage === 2) && (
          <NodePanel
            selected={selected}
            shuffled={stage === 2}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}
        {stage === 3 && <ScatterPlot selectedId={selectedId} onSelect={onSelect} />}
        {stage === 4 && <Conclusions />}
      </div>
    </Html>
  );
}

export default function FriendshipJourney() {
  const root = useRef<HTMLElement>(null);
  const methodsDialog = useRef<HTMLDialogElement>(null);
  const [stage, setStage] = useState(() => {
    if (typeof window === "undefined") return 0;
    const requested = new URLSearchParams(window.location.search).get("stage")?.toLowerCase();
    const index = stages.findIndex((item) => item.short.toLowerCase() === requested);
    return index < 0 ? 0 : index;
  });
  const [selectedId, setSelectedId] = useState<string | null>("Spider-Man");
  const [colors, setColors] = useState<SceneColors | null>(null);
  const reducedMotion = useReducedMotion();
  const selected = data.nodes.find((node) => node.id === selectedId) ?? null;

  useEffect(() => {
    if (!root.current) return;
    const styles = getComputedStyle(root.current);
    setColors({
      ink: styles.getPropertyValue("--color-ink").trim(),
      muted: styles.getPropertyValue("--color-ink-muted").trim(),
      faint: styles.getPropertyValue("--color-ink-faint").trim(),
      grid: styles.getPropertyValue("--color-grid").trim(),
      paper: styles.getPropertyValue("--color-paper").trim(),
      low: styles.getPropertyValue("--color-out").trim(),
      high: styles.getPropertyValue("--color-in").trim(),
    });
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "ArrowRight") setStage((value) => Math.min(stages.length - 1, value + 1));
      if (event.key === "ArrowLeft") setStage((value) => Math.max(0, value - 1));
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <section ref={root} className="friendship-journey" aria-label="Week 2 friendship-paradox journey">
      <a className="journey-home" href="/social-graphs-and-interactions/" aria-label="Back to all posts">
        <span aria-hidden="true">⌁</span> Team ##
      </a>
      <button
        type="button"
        className="journey-methods-trigger"
        onClick={() => methodsDialog.current?.showModal()}
      >
        Methods
      </button>
      <div className="journey-stage" aria-label={`Interactive stage: ${stages[stage].title}`}>
        {colors ? (
          <Canvas
            camera={{ position: [0, 44, 0], up: [0, 0, -1], fov: 46 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true }}
            fallback={
              <div className="journey-fallback">
                WebGL is unavailable. Use the character selector and conclusions
                to explore the same analysis.
              </div>
            }
          >
            <NetworkScene
              shuffled={stage >= 2}
              selectedId={selectedId}
              colors={colors}
              reducedMotion={reducedMotion}
              onSelect={setSelectedId}
            />
            <SceneOverlay
              stage={stage}
              selected={selected}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </Canvas>
        ) : (
          <div className="journey-loading" role="status">
            Loading network…
          </div>
        )}
      </div>

      <p className="journey-caption" aria-live="polite">
        <span>{String(stage + 1).padStart(2, "0")} · {stages[stage].short}</span>
        {stages[stage].note}
      </p>

      <nav className="journey-controls" aria-label="Journey navigation">
        <button
          type="button"
          onClick={() => setStage((value) => Math.max(0, value - 1))}
          disabled={stage === 0}
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <ol>
          {stages.map((item, index) => (
            <li key={item.short}>
              <button
                type="button"
                className={index === stage ? "is-current" : ""}
                aria-current={index === stage ? "step" : undefined}
                aria-label={`Go to ${item.short}`}
                onClick={() => setStage(index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{item.short}</b>
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setStage((value) => Math.min(stages.length - 1, value + 1))}
          disabled={stage === stages.length - 1}
        >
          Next <span aria-hidden="true">→</span>
        </button>
      </nav>
      <dialog
        ref={methodsDialog}
        className="journey-methods-dialog"
        aria-labelledby="journey-methods-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div>
          <header>
            <p className="journey-kicker">Documentation</p>
            <h2 id="journey-methods-title">Method, reproduction & AI</h2>
            <button
              type="button"
              aria-label="Close methods"
              onClick={() => methodsDialog.current?.close()}
            >
              ×
            </button>
          </header>
          <section>
            <h3>Method</h3>
            <p>
              We ignore link direction, collapse reciprocal links, and remove
              self-links. We choose a non-isolated character uniformly, then one
              of that character’s neighbours uniformly. “More popular” means
              higher degree under this definition.
            </p>
            <p>
              The null uses 14,340 double-edge swaps, preserving every degree
              while changing the neighbours. Results use seed 20260914; the final
              null comparison summarizes 100 independent shuffles.
            </p>
          </section>
          <section>
            <h3>Reproduce it</h3>
            <p>
              Run the Week 2 notebook from top to bottom. It regenerates the
              tables, figure, null models, and the JSON loaded by this page.
            </p>
            <a
              href="https://github.com/EstebanPerez99/social-graphs-and-interactions/blob/main/notebooks/week2/2.11-go-nuts.ipynb"
              target="_blank"
              rel="noreferrer"
            >
              Open notebook <span aria-hidden="true">↗</span>
            </a>
          </section>
          <section>
            <h3>Methods & AI</h3>
            <p>
              The agent helped implement the metrics, tests, export, and page. We
              checked the sampling definition, exact probabilities, degree
              preservation, and every reported count.
            </p>
            <a
              href="https://github.com/EstebanPerez99/social-graphs-and-interactions/blob/main/AI_METHODS.md"
              target="_blank"
              rel="noreferrer"
            >
              Read AI log <span aria-hidden="true">↗</span>
            </a>
          </section>
        </div>
      </dialog>
    </section>
  );
}
