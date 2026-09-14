# Week 2 — Models & null models

Official assignment: [Week 2](https://sunelehmann.com/socialgraphs2026-web/weeks/week2.html)

## Group deliverable

The collaborative assignment is **2.11 — Go nuts with your LLM**. Produce one
free-form post for the group website using the shared Marvel network (or the
standing alternative-Wikipedia-category option), and share its link in the Week 2
Teams channel by Monday evening.

The official page suggests several possible directions:

- compare the real degree distribution with random and Barabási–Albert models;
- investigate the friendship paradox and the characters driving it;
- shuffle-test a network measurement with a degree-preserving null model;
- compare a preferential-attachment network with the real Marvel network;
- pursue another question motivated by the Week 2 explorables.

Keep the analysis reproducible in `2.11-go-nuts.ipynb`. Record the research
question and checks before interpreting results; use fixed random seeds where
simulation is involved.

## Outputs

- Figures: `figures/week2/`, copied to `site/src/assets/week2/` with
  `sgi.save_fig(..., week=2)`.
- Tables and JSON: `data/week2/exports/`, copied to `site/src/data/week2/` with
  `sgi.save_table(..., week=2)` or `sgi.save_json(..., week=2)`.
- Draft article: `site/src/content/posts/week2.mdx`; remove `draft: true` only
  when the post is ready to publish.

Individual Learn/Builder/Tool exercises remain outside this group repository, as
described in the root README.
