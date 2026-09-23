# Design system — Team ## · 02805

One rule above all: **the data is the decoration.** Every visual device on this site is derived from
the week's network — the adjacency-matrix mark, the two-colour degree semantics, the graph-paper ground.
If an element does not encode something true about the content, cut it.

## Tokens (`src/styles/global.css` → `@theme`)

| Token | Value | Meaning |
|---|---|---|
| `--color-paper` | `#f6f8fb` | page ground |
| `--color-grid` | `#e4eaf2` | graph-paper lines, borders, panel edges |
| `--color-ink` | `#0f172a` | text, matrix cells, nodes |
| `--color-ink-muted` | `#5b6577` | secondary text, captions |
| `--color-ink-faint` | `#9aa4b2` | disabled / locked / placeholders |
| `--color-in` | `#d1495b` | **in-degree · links received · targets**. Same red in matplotlib (`sgi.PALETTE`). |
| `--color-out` | `#1f6f8b` | **out-degree · links sent · sources**. Same blue in matplotlib. |
| `--color-in-soft` / `--color-out-soft` | `#fbe9ec` / `#e3f0f5` | tints for chips and highlights |

Red and blue are **semantic**, not decorative: never use them for emphasis, buttons, or "brand" — only for the
in/out direction. A third accent is not allowed; if something needs attention, use weight, size or ink.

### Exception: community palette (data views only, from week 4)

Communities need categorical hues, and red/blue already mean in/out. So data views (and only data views: the 3D
scene, matplotlib figures, legend chips) may use this muted eight-hue palette. Never for UI, buttons, links,
emphasis or text. Community *i* always gets slot *i*; the same hex values live in `sgi.PALETTE["communities"]`
so the static figures match the scene.

| Slot | Hex | Week 4 community |
|---|---|---|
| 0 | `#cb9328` ochre | German philosophy |
| 1 | `#9d83c7` lavender | Early modern Europe |
| 2 | `#903d7b` plum | Aristotle and the Latin West |
| 3 | `#526922` olive | British and American moderns |
| 4 | `#66c292` sage | Greek and Roman antiquity |
| 5 | `#6773b4` periwinkle | Indian philosophy |
| 6 | `#d0622c` burnt orange | Islamic and Jewish philosophy |
| 7 | `#2e9e8f` teal | Chinese philosophy |

Hues avoid the in-red and out-blue families. Validated with the dataviz skill's `validate_palette.js` on white:
lightness band, chroma floor and adjacent-pair CVD (worst ΔE 11.8) and normal-vision (18.7) checks pass. With all
28 pairs in play no eight-hue palette passes, so the slot order puts the two closest pairs (lavender/periwinkle,
olive/burnt orange) on communities that share almost no links, and every view also carries identity without
colour: position in the layout, a named legend, and names in hover cards. Sage and ochre sit below 3:1 on white,
so they appear only with a visible label or legend nearby.

Light only. `color-scheme: light` is declared; figures from matplotlib are light too.

## Type

| Role | Face | Use |
|---|---|---|
| Display | **Bricolage Grotesque** 700–800, tracking −0.02em | titles, section headings, big numbers |
| Body | **Source Serif 4** 400/600, 17px, 1.6 | posts, descriptions |
| Utility | **IBM Plex Mono** 400/500 | eyebrows, captions, labels, dates, tables, axis text, UI controls |

Scale: h1 `2.2–3.4rem` · post h2 `1.6rem` · h3 `1.15rem` · body `1.0625rem` · mono UI `0.72–0.8rem`.
Eyebrows are mono, uppercase, `tracking-wider`, muted. Captions are mono, muted, under the figure.

## Layout

- Page: `max-w-6xl`, gutters `px-6 sm:px-10`. Header/footer share the same container.
- Post column: `.prose` at `68ch`. Figures and interactive panels may **break out** with `.wide` (`60rem`).
- Panels (`.panel`): white, 1px `grid` border, radius 8. Every chart, figure and game sits in a panel; the
  graph-paper ground never shows through a data view.
- Rules: `border-t-2 border-ink` above key blocks (stats, latest post). Hairlines use `grid`.

## Post anatomy — every week, same skeleton

The course asks for *what you asked · what you did · one figure or table · what surprised you*. Posts follow
exactly this order so readers (and the professor) can compare weeks:

```
eyebrow   Week N · Topic
h1        Title (a claim, not a label — "Fame is not the same as talking")
lede      one sentence in muted body type
meta      authors · date · dataset            ← from frontmatter
## What we asked
## What we did            (+ <Stats/> with 2–4 numbers)
## The figure             (<Interactive/> and/or <Figure wide/>)
## What surprised us      (numbered bold leads: **1. Claim.** explanation)
## (optional) one more interactive / "Play"
## What we would check next
## Methods and AI         (what was verified, link to AI_METHODS.md)
```

`python -m sgi new-week N` writes this skeleton. Titles are claims. Numbers in the text must come from the
week's `N.8-go-nuts.ipynb`.

## Components

| Component | Purpose | Notes |
|---|---|---|
| `Figure.astro` | static image + caption | `wide` to break out |
| `Interactive.astro` | frame for an island: label, white panel, note | islands go inside, `client:visible` |
| `Stats.tsx` | 2–4 key numbers, count up on view | `tone="in"/"out"` colours the rule; `suffix`/`prefix` for % etc. |
| `DegreePlot.tsx` | distribution explorer, raw + Goodies bins | takes the JSON from `sgi.save_json` |
| `NetworkGraph.tsx` | force-directed drawing | `client:only="react"`, loads `data/weekN/network.json` |
| `AdjacencyMatrix.tsx` | the site mark; hero of the landing | degree-sorted, animated row reveal |
| `WeekGrid.tsx` | landing: the course sequence as cards; unlocked → link, locked → encrypted topic + unlock date | one island for all cards |
| `SpiderRace.tsx` | the week-1 game: reach / escape Spider-Man through real out-links | BFS live; facts computed from the same JSON |
| `PostTitle.tsx` | post h1 with the one reveal per page | `role="heading"` wrapper |
| `BackboneSnap.tsx` | week 4 opener: disparity-filter dial on the philosophers in 3D, guessing game, break log | `client:only="react"`; demand frame loop (renders only while the dial or camera moves); community palette exception |

### React Bits (`src/components/bits/`, MIT)

Used sparingly, each with one job. Do not add a background or cursor effect; the matrix is the atmosphere.

| Bit | Where | Why it earns its place |
|---|---|---|
| `SpotlightCard` | week cards | the spotlight follows the pointer like a crosshair on the matrix |
| `CountUp` | `Stats` | numbers count up once when scrolled into view |
| `BlurText` | post `h1` | one quiet reveal per page, 0.4s, never on body text |
| `DecryptedText` | locked week cards | "locked" literally reads as encrypted until unlocked |
| `ClickSpark` | the games | tactile feedback on each jump (week 1) and on each guess (week 4) |
| `Magnet` | primary CTA (Play) | one magnetic button per page, max |

Anything else from React Bits needs a sentence here justifying it.

## Motion

Reduced motion is respected globally (`prefers-reduced-motion` kills animations/transitions). Durations:
micro 150ms · reveal 400ms · matrix draw 1.4s. No looping ambient animation anywhere.

## Writing

Sentence case. Active voice. Controls say what they do ("Read the post →", "Play again"). Numbers use thin
separators (1,784). Captions state what is data and what is layout. Copy in English; code comments may be Spanish.
