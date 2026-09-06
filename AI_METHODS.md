# AI methods log

The course asks every group to document how AI tools were used and how their output was validated.
One section per week. Modes follow the course: 🧠 Learn (no AI), 🚀 Builder (agent, judged on outcome and defensibility), 🔬 Tool (LLM as instrument, validated).

Tooling: Claude Code (terminal agent) with Claude Opus 5 / Fable 5.1, running locally. Python 3.14, NetworkX 3.6, JupyterLab 4.6. Site: Astro 7 + React 19.

## Week 1 — Networks

### 🚀 Builder — what the agent did
- Set up the Python environment, the shared `sgi` package (`sgi/`) and the notebooks under `notebooks/week1/`.
- Implemented loading of the frozen snapshot (following the course's snippet), degree tables, raw distributions and the Goodies binning (`sgi/degree.py`).
- Generated the figures (`figures/week1/`) and the JSON exports the site consumes (`site/src/data/week1/`).
- Built and styled the site (`site/`), including the interactive degree plot, the force-directed drawing and the adjacency-matrix hero.
- Drafted the week-1 post from the numbers below; the group edited the text and owns the interpretation.

### What we verified, and how
| Claim | How it was checked |
|---|---|
| n = 303, 1,784 directed edges, 1,434 undirected, ⟨k⟩ ≈ 9.5, 17 isolates | Compared against the numbers stated in exercise 1.6 and the data page (`notebooks/week1/1.6-degrees.ipynb`, first cell). |
| Top-5 in- and out-degree characters | Compared against the leaderboard in the course's degree explorable. |
| Binning implementation | Assertion in `sgi/degree.py` tests and in the 1.6 notebook: binned values equal raw counts wherever bin width is 1; bins sum to 303 nodes. |
| Reciprocity 39%, Spider-Man reciprocates 9 of 106 | Recomputed independently in the 1.8 notebook with a different loop; 1,784 − 1,434 = 350 mutual pairs → 700 / 1,784 = 0.392. |
| A handful of individual links | Opened the Wikipedia articles by hand and confirmed the mention exists in the article text. |

### What we did not verify
- We did not re-derive any part of the snapshot from the Wikipedia API (optional stretch, not done).
- We did not hand-check the isolates beyond confirming they have no edges in the TSV.

### 🧠 Learn — done without AI
Exercises 1.1, 1.4, 1.5 (pen and paper) and 1.7 were done by each member without machine help, in personal notebooks.

### 🔬 Tool — LLM calibration (exercise 1.2)
_To be filled by the group: ten factual questions, grading against trusted sources, error classes, and the paragraph on what we would supervise vs. verify._
