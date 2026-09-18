import importlib.util
import unittest
from pathlib import Path

import networkx as nx


SCRIPT = Path(__file__).parents[1] / "notebooks" / "week3" / "build_week3.py"
SPEC = importlib.util.spec_from_file_location("build_week3", SCRIPT)
week3 = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(week3)


class Week3CliqueTest(unittest.TestCase):
    def test_maximum_cliques_share_six_nodes(self):
        graph, _ = week3.load_network()
        maximal = list(nx.find_cliques(graph))
        largest = max(map(len, maximal))
        maximum = [set(clique) for clique in maximal if len(clique) == largest]

        self.assertEqual(largest, 8)
        self.assertEqual(len(maximum), 6)
        self.assertEqual(len(set.intersection(*maximum)), 6)

    def test_rotating_seats_form_two_by_three_choices(self):
        graph, _ = week3.load_network()
        maximum = [set(c) for c in nx.find_cliques(graph) if len(c) == 8]
        core = set.intersection(*maximum)
        extras = set.union(*maximum) - core
        compatible = graph.subgraph(extras)
        sides = nx.algorithms.bipartite.sets(compatible)

        self.assertEqual(sorted(map(len, sides)), [2, 3])
        self.assertEqual(compatible.number_of_edges(), 6)


if __name__ == "__main__":
    unittest.main()
