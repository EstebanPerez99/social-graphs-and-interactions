# Week 5 · Does network fame buy more words?

Run from the repository root: `python notebooks/week5/build_week5.py`.
Requires NumPy and SciPy (already in the project requirements).

Inputs: the frozen week-1 node/edge TSVs and `data/week5/marvel_pages.zip`.
Outputs: identical analysis and site JSON exports. No network requests at build time.
The archive SHA-256 is recorded in the output. Alphabetic tokenization preserves internal
apostrophes, splits hyphenated words, retains stopwords and all supplied article sections.
Fit: log10(tokens) = intercept + slope × ln(1 + incoming links).
Outliers are ranked by signed log residual, with node IDs breaking ties.

## Text inspection
The draft readings are based on archived introductions and headings, not current Wikipedia:
- Brian Braddock: Captain Britain / Captain Avalon; Marvel UK publication history,
  Excalibur, other versions and adaptations. Multiple aliases are an audit hypothesis,
  not a demonstrated network extraction bug.
- Miracleman: L. Miller & Son, Warrior, Eclipse, ownership dispute, later Marvel reprints.
- Betsy Braddock: Psylocke, Kwannon body swap, Captain Britain; detailed biography and powers.
- Quasar: an umbrella name; biography subsections for four incarnations.
Group members should review the interpretations before sharing the post.
