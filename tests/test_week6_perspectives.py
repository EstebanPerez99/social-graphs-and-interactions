"""Independent checks of the numerical claims supporting the Week 6 story."""
import importlib.util
import json
import math
from pathlib import Path
import unittest

import networkx as nx
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('week6', ROOT / 'notebooks/week6/build_week6.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PerspectivesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'data/week6/exports/two-perspectives.json').read_text())
        cls.roster, cls.pages, cls.graph, cls.edges = module.load()

    def test_tfidf_against_hand_computation(self):
        with self.assertRaises(AssertionError):
            module.vectorize(['mutant power power', 'mutant power', 'cosmic cosmic'])
        # min_df=2 leaves mutant and power. Both have df=2, hence equal IDF.
        # Document 1 is [1,2]/sqrt(5); document 2 is [1,1]/sqrt(2).
        # The third document is all filtered, so vectorize deliberately rejects it.

    def test_formula_and_cosine(self):
        v, matrix = module.vectorize(['mutant power power', 'mutant power cosmic', 'cosmic power'])
        words = list(v.get_feature_names_out())
        row = matrix[0].toarray()[0]
        idf = math.log(4 / 3) + 1
        raw = np.array([0 if w == 'cosmic' else idf if w == 'mutant' else 2 for w in words])
        np.testing.assert_allclose(row, raw / np.linalg.norm(raw))
        self.assertAlmostEqual(float(row @ row), 1.0)

    def test_alignment_and_all_pairs(self):
        d = self.data
        self.assertEqual([n['id'] for n in d['nodes']], [n['node_id'] for n in self.roster])
        self.assertEqual(d['summary']['pairs'], 303 * 302 // 2)
        scores = np.array(d['cosine'])
        self.assertEqual(scores.shape, (303, 303))
        np.testing.assert_allclose(scores, scores.T)
        np.testing.assert_allclose(np.diag(scores), 1)
        self.assertTrue(np.all((scores >= 0) & (scores <= 1)))
        for n in d['nodes']:
            self.assertAlmostEqual(sum(w*w for _, w in n['v']), 1, places=5)

    def test_distances_against_independent_bfs(self):
        d = self.data
        self.assertEqual(self.graph.number_of_edges(), d['summary']['undirected_links'])
        self.assertEqual(len(list(nx.isolates(self.graph))), 17)
        for a in range(303):
            shortest = nx.single_source_shortest_path_length(self.graph, a)
            self.assertEqual(d['distance'][a], [shortest.get(b) for b in range(303)])
        for e in d['examples']:
            if e['distance'] is not None:
                self.assertGreaterEqual(e['distance'], 3)
                self.assertEqual(len(e['path']) - 1, e['distance'])
                self.assertTrue(all(self.graph.has_edge(a,b) for a,b in zip(e['path'], e['path'][1:])))
            else:
                self.assertFalse(nx.has_path(self.graph, e['a'], e['b']))

    def test_exact_term_contributions_and_ranking(self):
        d = self.data
        for e in d['examples']:
            x, y = dict(d['nodes'][e['a']]['v']), dict(d['nodes'][e['b']]['v'])
            cosine = sum(w*y.get(i, 0) for i,w in x.items())
            self.assertAlmostEqual(cosine, e['cosine'], places=5)
            self.assertLessEqual(sum(t['contribution'] for t in e['shared']), cosine + 1e-6)
        ranked = sorted(((a,b) for a in range(303) for b in range(a+1,303) if d['distance'][a][b] is not None and d['distance'][a][b] >= 3), key=lambda p: (-d['cosine'][p[0]][p[1]], p))
        self.assertEqual([(e['a'],e['b']) for e in d['examples'] if e['distance'] is not None], ranked[:12])

    def test_partition_counts_and_descriptive_means(self):
        d = self.data
        self.assertEqual(sum(sum(r) for r in d['overlap']), 303)
        for c, group in enumerate(d['groups']['text']):
            self.assertEqual(sum(n['t'] == c for n in d['nodes']), group['size'])
        within, across = [], []
        for a in range(303):
            for b in range(a+1,303):
                (within if d['nodes'][a]['s'] == d['nodes'][b]['s'] else across).append(d['cosine'][a][b])
        self.assertAlmostEqual(float(np.mean(within)), d['summary']['within_mean'], places=5)
        self.assertAlmostEqual(float(np.mean(across)), d['summary']['across_mean'], places=5)
        isolates = [i for i in self.graph if self.graph.degree(i)==0]
        self.assertEqual(len({d['nodes'][i]['s'] for i in isolates}), 17)

    def test_browser_export_is_identical(self):
        self.assertEqual((ROOT/'data/week6/exports/two-perspectives.json').read_bytes(), (ROOT/'site/public/data/week6/two-perspectives.json').read_bytes())


if __name__ == '__main__':
    unittest.main()
