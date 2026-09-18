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
