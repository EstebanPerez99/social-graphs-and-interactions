import unittest

import networkx as nx

from sgi.friendship import (
    friendship_summary,
    friendship_table,
    popular_friends,
    sample_friendship_pairs,
)


class FriendshipTest(unittest.TestCase):
    def setUp(self):
        self.graph = nx.path_graph(["left", "center", "right"])

    def test_summary_uses_uniform_person_then_uniform_friend(self):
        summary = friendship_summary(self.graph)
        self.assertAlmostEqual(summary["person_mean_degree"], 4 / 3)
        self.assertAlmostEqual(summary["friend_mean_degree"], 5 / 3)
        self.assertAlmostEqual(summary["friend_at_least_as_popular_probability"], 2 / 3)
        self.assertEqual(summary["eligible_person_count"], 3)
        self.assertEqual(summary["local_paradox_count"], 2)
        self.assertAlmostEqual(summary["local_paradox_fraction"], 2 / 3)
        self.assertEqual(summary["unbeaten_count"], 1)

    def test_table_marks_the_only_unbeaten_nonisolate(self):
        table = friendship_table(self.graph).set_index("node_id")
        self.assertTrue(table.loc["center", "unbeaten"])
        self.assertFalse(table.loc["left", "unbeaten"])
        self.assertEqual(table.loc["left", "mean_neighbor_degree"], 2)

    def test_isolates_have_undefined_neighbor_statistics(self):
        graph = self.graph.copy()
        graph.add_node("isolate")
        row = friendship_table(graph).set_index("node_id").loc["isolate"]
        self.assertTrue(row[["mean_neighbor_degree", "max_neighbor_degree"]].isna().all())
        self.assertEqual(friendship_summary(graph)["isolate_count"], 1)

    def test_popular_friend_probabilities_sum_to_one(self):
        drivers = popular_friends(self.graph, n=None).set_index("node_id")
        self.assertAlmostEqual(drivers["friend_sample_probability"].sum(), 1)
        self.assertAlmostEqual(drivers.loc["center", "friend_sample_probability"], 2 / 3)
        self.assertAlmostEqual(drivers.loc["left", "friend_sample_probability"], 1 / 6)

    def test_sampling_is_reproducible_and_respects_edges(self):
        first = sample_friendship_pairs(self.graph, samples=20, seed=7)
        second = sample_friendship_pairs(self.graph, samples=20, seed=7)
        self.assertTrue(first.equals(second))
        for row in first.itertuples(index=False):
            self.assertTrue(self.graph.has_edge(row.person_id, row.friend_id))

    def test_directed_reciprocal_edges_collapse_to_one_friendship(self):
        graph = nx.DiGraph([("a", "b"), ("b", "a")])
        summary = friendship_summary(graph)
        self.assertEqual(summary["edge_count"], 1)
        self.assertEqual(summary["person_mean_degree"], 1)


if __name__ == "__main__":
    unittest.main()
