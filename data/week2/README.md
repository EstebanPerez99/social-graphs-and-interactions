# Week 2 data

Assignment: [Week 2 — Models & null models](https://sunelehmann.com/socialgraphs2026-web/weeks/week2.html)

The Week 2 group assignment reuses the shared Marvel network from `data/week1/`.
Do not duplicate those files here. Use this directory only for additional raw data
or intermediate results specific to the Week 2 investigation.

## Layout

- `exports/`: generated tables and JSON used by the analysis and website.
- Additional source files: document their source URL, download date, license, and
  any preprocessing steps in this README before committing them.

Use `sgi.save_json(..., week=2)` or `sgi.save_table(..., week=2)` to write exports;
the helpers also copy website-ready JSON into `site/src/data/week2/`.
