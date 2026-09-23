# AI methods log

The course asks every group to document how AI tools were used and how their output was validated.
One section per week. Modes follow the course: 🧠 Learn (no AI), 🚀 Builder (agent, judged on outcome and defensibility), 🔬 Tool (LLM as instrument, validated).

Tooling: Claude Code (terminal agent) with Claude Opus 5 / Fable 5.1, running locally. Python 3.14, NetworkX 3.6, JupyterLab 4.6. Site: Astro 7 + React 19.

## Week 1 — Networks

### 🚀 Builder — what the agent did
- Set up the Python environment, the shared `sgi` package (`sgi/`) and the notebooks under `notebooks/week1/`.
- Implemented loading of the frozen snapshot (following the course's snippet), degree tables, raw distributions and the Goodies binning (`sgi/degree.py`).
- Generated the figures (`figures/week1/`) and the JSON exports the site consumes (`site/src/data/week1/`).
- Built and styled the site (`site/`), including the interactive degree plot, the force-directed drawing, the adjacency-matrix hero and the "Two clicks from Spider-Man" game (BFS shortest paths computed in the browser from the same exported graph).
- Called the Wikipedia API (`prop=pageimages`, batches of 50, identified User-Agent) to fetch one thumbnail per character for the game; 254 of 303 articles have one. The API was **not** used to verify links this week.
- A second agent session was used as a research assistant: it reviewed three other groups' week-1 sites and compiled their reported numbers, and verified React Bits' peer dependencies from the registry. Its report informed the post (the two average degrees; not over-claiming a power law) but it wrote no code or text.
- Drafted the week-1 post from the numbers below; the group edited the text and owns the interpretation.

### What we verified, and how
| Claim | How it was checked |
|---|---|
| n = 303, 1,784 directed edges, 1,434 undirected, ⟨k⟩ ≈ 9.5, 17 isolates | Compared against the numbers stated in exercise 1.6 and the data page (`notebooks/week1/1.6-degrees.ipynb`, first cell). |
| Top-5 in- and out-degree characters | Compared against the leaderboard in the course's degree explorable. |
| Binning implementation | Assertion in `sgi/degree.py` tests and in the 1.6 notebook: binned values equal raw counts wherever bin width is 1; bins sum to 303 nodes. |
| Reciprocity 39%, Spider-Man reciprocates 9 of 106 | Recomputed independently in the 1.8 notebook with a different loop; 1,784 − 1,434 = 350 mutual pairs → 700 / 1,784 = 0.392. |
| A handful of individual links | Opened the Wikipedia articles by hand and confirmed the mention exists in the article text. |
| Components: giant 277, island of 9 (Morituri, 22 links, 81.8% reciprocal), 17 isolates; largest SCC 229; 41 out-only / 3 in-only | Cross-checked against numbers published by other groups for the same snapshot (they agree). |
| Paths: 106 / 247 / 273 characters within 1 / 2 / 4 clicks of Spider-Man; 230 reachable from him, max 6 clicks | Computed in the notebook (NetworkX BFS) and recomputed independently in the game (own BFS in TypeScript); both agree. |
| Average degree 5.89 (directed) vs 9.47 (undirected pairs) | Both derived by hand from 1,784 / 303 and 2·1,434 / 303; the exercise states ⟨k⟩ ≈ 9.5. |

### What we did not verify
- We did not re-derive any part of the snapshot from the Wikipedia API (optional stretch, not done).
- We did not hand-check the isolates beyond confirming they have no edges in the TSV.

### 🧠 Learn — done without AI
Exercises 1.1, 1.4, 1.5 (pen and paper) and 1.7 were done by each member without machine help, in personal notebooks.

### 🔬 Tool — LLM calibration (exercise 1.2)
_To be filled by the group: ten factual questions, grading against trusted sources, error classes, and the paragraph on what we would supervise vs. verify._

## Week 2 — Models & null models

### 🚀 Builder — friendship-paradox notebook
- A coding agent (OpenAI Codex) implemented the reusable friendship-paradox helpers in `sgi/friendship.py`, their unit tests, and the first complete version of `notebooks/week2/2.11-go-nuts.ipynb`.
- The notebook computes exact person–friend probabilities, checks them against 20,000 seeded samples, ranks the characters most likely to appear as the friend, identifies local degree maxima, and compares Marvel with 100 degree-preserving shuffles and 100 matched $G(n,m)$ networks.
- The agent generated the Week 2 figure and data exports. The group still owns the framing, interpretation, and final post text.

### What we verified, and how
| Check | Method |
|---|---|
| Exact person–friend calculation | Verified that all exact friend-selection probabilities sum to one, then compared the aggregate results with 20,000 independently sampled pairs using a fixed seed. |
| Character-level conclusion | Counted the rows where mean neighbor degree exceeds the character's degree; isolates are excluded because their neighbor mean is undefined. |
| Degree-preserving null | Asserted after every shuffle that the complete sorted degree sequence is unchanged. |
| Helper behavior | Six unit tests cover uniform person–friend sampling, isolates, local maxima, exact sampling probabilities, reproducibility, and reciprocal directed-edge collapse. |
| Notebook reproducibility | Executed from top to bottom without errors; JSON exports were parsed independently after generation. |

### Still to verify by hand
- Read a sample of rows in the character-level export back against direct NetworkX neighbor lists.
- Agree as a group that “unbeaten” means no **direct neighbor** has strictly greater undirected degree, and retain that wording in the post.
- Review the null-model interpretation and final prose before removing `draft: true`.

## Week 3 — Who matters, and why

### 🚀 Builder — maximum-clique story
- A coding agent chose the clique prompt, implemented the reproducible pipeline in `notebooks/week3/build_week3.py`, added validation tests, wrote the first post draft, and built the interactive 2 × 3 rotating-seat explorable.
- The analysis projects the frozen directed network to a simple undirected graph, enumerates all cliques and all maximal cliques, and identifies every maximum clique plus their intersection.
- The baseline is 100 degree-preserving double-edge shuffles with 10 swaps per edge and a published seed. Every shuffled graph is checked against the complete observed degree sequence before its clique number, triangle count, and transitivity are recorded.

### What we verified, and how
| Check | Method |
|---|---|
| Clique number 8; six maximum cliques | Computed with `networkx.find_cliques`; unit test checks both values. |
| Six-character common core | Intersected all six maximum-clique node sets; unit test checks the intersection size. |
| Rotating seats form a 2 × 3 choice | Induced the subgraph on the five non-core characters; it is bipartite with side sizes 2 and 3 and all six cross-links present. |
| 1,839 triangles and 477 five-cliques | Counted with `enumerate_all_cliques`; the triangle total was independently checked with `sum(nx.triangles(G).values()) / 3`. |
| Null preserves the degree sequence | Exact sorted degree-sequence equality asserted after every one of the 100 shuffles. |
| Null result | Clique numbers are 5 in 37 shuffles, 6 in 58, and 7 in 5; none reaches the observed 8. |
| Site artifact | The build writes identical JSON to the analysis and site directories; the Astro/TypeScript build validates the consumed schema. |

### Still to verify by hand
- Open the eleven source Wikipedia pages and agree that “X-Men orbit” is fair wording for every character, especially the Phoenix Force.
- Review the caveat that this is a network of article links, not a direct record of team membership or co-appearance.
- Review and own the final post wording before sharing the link in Teams.

## Week 4 — Communities & backbones

### 🚀 Builder — where philosophy snaps (exercise 4.13)
- A coding agent followed the group's plan (`notebooks/week4/PLAN.md`): downloaded and documented the philosophers snapshot, added `sgi.load_philosophers()` (the course snippet verbatim), and implemented the disparity filter, Louvain helpers and NMI from their definitions in `sgi/backbone.py` and `sgi/communities.py`.
- `notebooks/week4/build_week4.py` is the deterministic pipeline: the course table, Louvain on the full unweighted giant (seed 20260923) with a 20-shuffle null and a five-seed NMI matrix, a union-find sweep over α that logs every chunk of 5+ philosophers the giant loses and the links that last held it, and two nulls for the sweep (50 weight shuffles, 50 degree-preserving rewirings that carry weights). It exports `backbone-snap.json` (0.50 MB) and the three static figures.
- The agent built the 3D opener (`BackboneSnap.tsx`, react-three-fiber): instanced spheres coloured by community, the α dial filtering in the browser, islands drifting as they detach, and the "Which tradition leaves first?" game. It also drafted the post, chose the community palette with the dataviz validator, and wrote the DESIGN.md exception.

### What we verified, and how
| Check | Method |
|---|---|
| Loader: 1,444 / 9,140; giant 1,374 / 9,139; no self-loops | Unit test on `load_philosophers()`. Weights 1–24, 5,899 of weight 1, Aristotle s = 521 on k = 300, Erasmus–More = 24: all match the course page. |
| Naive thresholds w ≥ 2 / 3 / 4 → 3,240 / 1,572 / 785 links; w ≥ 3 keeps 863 philosophers | Unit test. |
| Disparity table (α = 0.05, 0.1, 0.2, 0.3, 0.5: links, philosophers, giant) | Unit test against all 15 numbers of the course table; also the Moses of Narbonne example, (1 − 2/11)⁹. |
| Why 1,540 at α = 0.2 | Two links have p-value exactly 0.2 in exact arithmetic, (1 − 4/5)¹; floating point gives 0.19999999999999996, so they pass `< 0.2`. Rounding the export to 6 digits dropped them (1,538), so the JSON ships full precision; a test parses the exported JSON on its own and recounts the table with the browser's rule. |
| Louvain: 8 communities, Q = 0.499; null Q = 0.223 ± 0.002 (z ≈ 127) | Course expects ≈ 8, 0.50 and 0.23. Degree sequence asserted after every one of the 20 shuffles. |
| Five-seed stability: 7–9 communities, NMI 0.67–0.78 | Course quotes 0.65–0.83. |
| NMI implementation | Hand-computed toy case in a test; all 10 seed pairs and NMI vs era (0.424) equal scikit-learn's `normalized_mutual_info_score` to 6 decimals (scikit-learn installed in a throwaway venv only, not in the project). |
| Sweep | Toy two-triangle test; on the data, the first break (24 philosophers, α = 0.297238, bridge Gaudapada–The Buddha) and the Chinese break through Confucius–Voltaire at the α where the giant falls below 50 % are asserted in tests. |
| Nulls keep degrees | Asserted for every one of the 100 sweep nulls; a test also checks the weighted rewiring keeps the weight multiset. |
| Determinism | Two runs with different `PYTHONHASHSEED` produce byte-identical JSON (a strength tie between Mencius and Shen Buhai had to be broken by id first). |
| Page | `astro check` 0 errors, `astro build` green; played the game in Chromium (right and wrong guess, freeze, verdict, break log), no console errors; frame time while dragging with islands drifting: median 14.3 ms, p95 15.2 ms, no long tasks; no horizontal overflow at 390 px; reduced motion makes positions jump. |
| Community palette | `validate_palette.js` (dataviz skill): adjacent CVD ΔE ≥ 11.8, normal-vision ≥ 18.7; all-pairs fails as expected for 8 hues, so identity is also carried by position, legend, hover card and chips. |

### Still to verify by hand
- The community names (`TRADITIONS` in `build_week4.py`), especially "Aristotle and the Latin West" and "British and American moderns".
- The three Wikipedia readings in the post (Gaudapada–Buddha, Confucius–Voltaire, Max Müller and the Upanishadic sages).
- The 60 fps claim on a real laptop GPU; the timing above is headless Chromium on one Mac.
- Review and own the final wording before posting the link in Teams.
