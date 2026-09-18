import { useMemo, useState } from "react";

import artifact from "../data/week3/clique-lab.json";
import "./clique-lab.css";

type Character = {
  id: string;
  name: string;
  degree: number;
  url: string;
  description: string;
};

type Point = Character & { x: number; y: number; role: "core" | "seat" };

const data = artifact as unknown as {
  method: { null_samples: number; swaps_per_edge: number };
  network: {
    nodes: number;
    undirected_edges: number;
    triangles: number;
    five_cliques: number;
    clique_number: number;
    maximum_cliques: number;
    transitivity: number;
  };
  core: Character[];
  seat_a: Character[];
  seat_b: Character[];
  null: {
    max_clique_numbers: number[];
    max_clique_mean: number;
    max_clique_max: number;
    triangles_mean: number;
    triangles_sd: number;
    transitivity_mean: number;
    transitivity_sd: number;
  };
};

const corePositions = [
  [280, 70],
  [480, 70],
  [550, 215],
  [480, 360],
  [280, 360],
  [210, 215],
] as const;

function completeEdges(points: Point[]) {
  const edges: Array<[Point, Point]> = [];
  points.forEach((source, i) => {
    points.slice(i + 1).forEach((target) => edges.push([source, target]));
  });
  return edges;
}

export default function CliqueLab() {
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const selectedA = data.seat_a[left];
  const selectedB = data.seat_b[right];

  const points = useMemo<Point[]>(
    () => [
      ...data.core.map((character, index) => ({
        ...character,
        x: corePositions[index][0],
        y: corePositions[index][1],
        role: "core" as const,
      })),
      { ...selectedA, x: 75, y: 215, role: "seat" as const },
      { ...selectedB, x: 685, y: 215, role: "seat" as const },
    ],
    [selectedA, selectedB],
  );
  const edges = useMemo(() => completeEdges(points), [points]);
  const nullCounts = useMemo(
    () => [5, 6, 7, 8].map((value) => ({
      value,
      count: data.null.max_clique_numbers.filter((item) => item === value).length,
    })),
    [],
  );
  const nullDescription = `Null model distribution: ${nullCounts
    .map(({ value, count }) => `${count} shuffles have clique number ${value}`)
    .join(", ")}; the observed clique number is 8.`;
  const selectedNumber = left * data.seat_b.length + right + 1;

  return (
    <section className="clique-lab" aria-labelledby="clique-lab-title">
      <div className="clique-lab-heading">
        <div>
          <p className="clique-kicker">Interactive · maximum clique {selectedNumber} of 6</p>
          <h2 id="clique-lab-title">Keep the core. Rotate two seats.</h2>
        </div>
        <p className="clique-equation" aria-label="An eight-clique contains twenty-eight links">
          K<sub>8</sub> = 28 links
        </p>
      </div>

      <div className="clique-picker-grid">
        <fieldset>
          <legend>Seat A · choose one</legend>
          {data.seat_a.map((character, index) => (
            <button
              type="button"
              key={character.id}
              aria-pressed={left === index}
              onClick={() => setLeft(index)}
            >
              <span>{character.name}</span>
              <small>degree {character.degree}</small>
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>Seat B · choose one</legend>
          {data.seat_b.map((character, index) => (
            <button
              type="button"
              key={character.id}
              aria-pressed={right === index}
              onClick={() => setRight(index)}
            >
              <span>{character.name}</span>
              <small>degree {character.degree}</small>
            </button>
          ))}
        </fieldset>
      </div>

      <div className="clique-figure-wrap">
        <svg
          viewBox="0 0 760 430"
          role="img"
          aria-label={`Eight-character clique: the six-character core, ${selectedA.name}, and ${selectedB.name}. Every pair has a link.`}
        >
          <path className="clique-core-ring" d="M 246 36 H 514 Q 584 36 584 106 V 324 Q 584 394 514 394 H 246 Q 176 394 176 324 V 106 Q 176 36 246 36 Z" />
          <g className="clique-links">
            {edges.map(([source, target]) => (
              <line
                key={`${source.id}-${target.id}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
              />
            ))}
          </g>
          <text className="clique-core-label" x="380" y="215" textAnchor="middle">six-character core</text>
          {points.map((point) => (
            <g key={point.id} className={`clique-node clique-node-${point.role}`}>
              <circle cx={point.x} cy={point.y} r={point.role === "core" ? 25 : 31} />
              <text
                x={point.x}
                y={point.y + (point.y < 110 ? -37 : point.y > 320 ? 48 : 48)}
                textAnchor="middle"
              >
                {point.name}
              </text>
              <text className="clique-degree" x={point.x} y={point.y + 4} textAnchor="middle">
                {point.degree}
              </text>
            </g>
          ))}
        </svg>
        <p className="clique-caption">
          The 28 grey lines are the 28 undirected pairs required for an eight-clique. Numbers inside nodes are their degrees in the full network; layout only separates the shared core from the rotating seats.
        </p>
      </div>

      <div className="clique-null">
        <div className="clique-null-copy">
          <p className="clique-kicker">Compared with the right null</p>
          <h3>Degree alone never rebuilds an eight-clique.</h3>
          <p>
            We rewired every link {data.method.null_samples} times while preserving every character’s degree. The shuffled worlds peak at clique number {data.null.max_clique_max}; the observed network sits alone at 8.
          </p>
        </div>
        <div className="clique-null-bars" role="img" aria-label={nullDescription}>
          {nullCounts.map(({ value, count }) => (
            <div className="clique-null-column" key={value}>
              <span className="clique-null-count">{count || "—"}</span>
              <div className="clique-null-track">
                <span style={{ height: `${Math.max(2, count)}%` }} />
              </div>
              <b>{value}</b>
            </div>
          ))}
          <div className="clique-observed" aria-hidden="true">
            <span>observed</span>
          </div>
        </div>
      </div>

      <dl className="clique-stats">
        <div><dt>Maximum cliques</dt><dd>{data.network.maximum_cliques}</dd></div>
        <div><dt>Shared core</dt><dd>{data.core.length}</dd></div>
        <div><dt>Observed triangles</dt><dd>{data.network.triangles.toLocaleString()}</dd></div>
        <div><dt>Null mean triangles</dt><dd>{Math.round(data.null.triangles_mean).toLocaleString()}</dd></div>
      </dl>
    </section>
  );
}
