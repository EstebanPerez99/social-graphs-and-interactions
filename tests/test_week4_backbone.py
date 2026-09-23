import importlib.util
import json
import random
import unittest
from pathlib import Path

import networkx as nx

import sgi
from sgi.backbone import backbone_row, disparity_alpha, disparity_filter, naive_threshold
from sgi.communities import louvain, modularity, nmi

SCRIPT = Path(__file__).parents[1] / "notebooks" / "week4" / "build_week4.py"
SPEC = importlib.util.spec_from_file_location("build_week4", SCRIPT)
week4 = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(week4)

G, GIANT, _ = sgi.load_philosophers()
ALPHA_MIN = disparity_alpha(GIANT)


class LoadTest(unittest.TestCase):
    def test_official_snippet_counts(self):
        self.assertEqual((G.number_of_nodes(), G.number_of_edges()), (1444, 9140))
        self.assertEqual((GIANT.number_of_nodes(), GIANT.number_of_edges()), (1374, 9139))
        self.assertEqual(nx.number_of_selfloops(G), 0)

    def test_weights_sum_both_directions(self):
        # Course page: weights run 1-24, 5,899 of 9,139 links have weight 1,
        # Aristotle has strength 521 on degree 300.
        weights = [d["weight"] for *_, d in GIANT.edges(data=True)]
        self.assertEqual((min(weights), max(weights)), (1, 24))
        self.assertEqual(weights.count(1), 5899)
        self.assertEqual(GIANT.degree("Aristotle", weight="weight"), 521)
        self.assertEqual(GIANT.degree("Aristotle"), 300)
        self.assertEqual(GIANT["Erasmus"]["Thomas_More"]["weight"], 24)


class BackboneTest(unittest.TestCase):
    def test_naive_thresholds(self):
        links = [naive_threshold(GIANT, w).number_of_edges() for w in (2, 3, 4)]
        self.assertEqual(links, [3240, 1572, 785])
        self.assertEqual(naive_threshold(GIANT, 3).number_of_nodes(), 863)

    def test_disparity_table_matches_course(self):
        course = {0.05: (292, 348, 116), 0.1: (649, 607, 419), 0.2: (1540, 950, 816),
                  0.3: (2549, 1111, 1052), 0.5: (5641, 1284, 1270)}
        for alpha, expected in course.items():
            row = backbone_row(disparity_filter(GIANT, alpha, alpha_min=ALPHA_MIN))
            self.assertEqual((row["links"], row["nodes"], row["giant"]), expected, alpha)

    def test_exported_links_keep_the_table(self):
        # The browser filters the shipped alpha_min with the same strict "<"; parse the
        # JSON on its own so a rounding or ordering slip in the export shows up here.
        export = Path(__file__).parents[1] / "site" / "src" / "data" / "week4" / "backbone-snap.json"
        links = json.loads(export.read_text(encoding="utf-8"))["links"]
        self.assertEqual(len(links), 9139)
        for alpha, kept in ((0.05, 292), (0.1, 649), (0.2, 1540), (0.3, 2549), (0.5, 5641)):
            self.assertEqual(sum(link[3] < alpha for link in links), kept)

    def test_float_round_off_at_point_two(self):
        # Exactly 0.2 on paper, just under it in floating point: the course counts both.
        on_the_line = [e for e, a in ALPHA_MIN.items() if abs(a - 0.2) < 1e-12]
        self.assertEqual(len(on_the_line), 2)
        self.assertTrue(all(ALPHA_MIN[e] < 0.2 for e in on_the_line))

    def test_moses_of_narbonne_example(self):
        # (1 - 2/11)^9 = 0.16 on his side; Aristotle's side is far above alpha.
        self.assertAlmostEqual(ALPHA_MIN[next(e for e in ALPHA_MIN
                                              if set(e) == {"Aristotle", "Moses_of_Narbonne"})],
                               (1 - 2 / 11) ** 9)

    def test_degree_one_end_is_never_significant(self):
        H = nx.Graph([("hub", "a", {"weight": 1}), ("hub", "b", {"weight": 5}),
                      ("hub", "c", {"weight": 1})])
        am = disparity_alpha(H)
        self.assertAlmostEqual(am[("hub", "b")], (1 - 5 / 7) ** 2)
        self.assertAlmostEqual(am[("hub", "a")], (1 - 1 / 7) ** 2)


class CommunityTest(unittest.TestCase):
    def test_louvain_published_seed(self):
        part = louvain(GIANT, week4.SEED)
        self.assertEqual(max(part.values()) + 1, 8)
        self.assertAlmostEqual(modularity(GIANT, part), 0.50, delta=0.01)

    def test_nmi_definition(self):
        self.assertAlmostEqual(nmi([0, 0, 1, 1], [1, 1, 0, 0]), 1.0)
        self.assertAlmostEqual(nmi([0, 0, 1, 1], [0, 1, 0, 1]), 0.0)
        # By hand: I = (2/3) ln 2, H(a) = ln 2, H(b) = ln 3 -> 2I / (H(a) + H(b)) = 0.5158
        self.assertAlmostEqual(nmi([0, 0, 0, 1, 1, 1], [0, 0, 1, 1, 2, 2]), 0.51580, places=4)


class SweepTest(unittest.TestCase):
    def test_toy_bridge(self):
        # Two triangles joined by one weak bridge; the bridge has the highest alpha_min.
        am = {("a", "b"): 0.01, ("b", "c"): 0.01, ("a", "c"): 0.01,
              ("x", "y"): 0.02, ("y", "z"): 0.02, ("x", "z"): 0.02, ("c", "x"): 0.5}
        events, curve = week4.sweep(list("abcxyz"), am, min_size=2)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["alpha"], 0.5)
        self.assertEqual(events[0]["bridge"], [("c", "x")])
        self.assertEqual(events[0]["size"], 3)
        self.assertEqual(curve[-1], (0.5, 6))

    def test_first_break_is_vedanta(self):
        events, curve = week4.sweep(list(GIANT), ALPHA_MIN)
        brk = week4.first_break(events)
        self.assertEqual(brk["size"], 24)
        self.assertAlmostEqual(brk["alpha"], 0.297238, places=6)
        self.assertEqual(brk["bridge"], [("Gaudapada", "The_Buddha")])
        self.assertIn("Adi_Shankara", brk["members"])
        # The giant falls below half when Chinese philosophy leaves through Confucius-Voltaire.
        half = week4.giant_below(curve, 1374)
        self.assertAlmostEqual(half, 0.169585, places=6)
        chinese = next(e for e in events if e["alpha"] == half and e["size"] >= 20)
        self.assertEqual(chinese["bridge"], [("Confucius", "Voltaire")])

    def test_rewired_null_keeps_degrees(self):
        H = week4.rewired_with_weights(GIANT, random.Random(1), 2000)
        self.assertEqual(sorted(d for _, d in H.degree()), sorted(d for _, d in GIANT.degree()))
        self.assertEqual(sorted(d["weight"] for *_, d in H.edges(data=True)),
                         sorted(d["weight"] for *_, d in GIANT.edges(data=True)))


if __name__ == "__main__":
    unittest.main()
