"""Independent checks of the week-7 text network and the week-8 reciprocity null."""
import importlib.util
import json
import random
from collections import Counter
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m


EDGES = {tuple(l.split('\t')) for l in (ROOT / 'data/week1/week1_edges.tsv').read_text().splitlines() if l and not l.startswith('#')}


class Week7(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = json.loads((ROOT / 'site/src/data/week7/text-vs-links.json').read_text())

    def test_aliases(self):
        try:
            w7 = module('notebooks/week7/build_week7.py', 'week7')
        except ModuleNotFoundError:
            self.skipTest('spaCy environment not installed')
        node = lambda name, desc: {'name': name, 'description': desc}
        self.assertEqual(w7.names_for(node('Iron Man (Ultimate Marvel character)', 'Iron Man (Antonio "Tony" Stark) is a')), set())
        self.assertEqual(w7.names_for(node('Black Widow (Natasha Romanova)', 'Black Widow is a')), {'black widow', 'natasha romanova'})
        self.assertEqual(w7.names_for(node('X (comics)', 'X (Antonio "Tony" Stark) is a')), {'antonio stark', 'tony stark'})
        self.assertEqual(w7.norm("The Hulk's"), 'hulk')

    def test_edge_counts(self):
        e, s = self.d['edges'], self.d['summary']
        kinds = Counter(x['kind'] for x in e)
        self.assertEqual({(x['s'], x['t']) for x in e if x['kind'] != 'text'}, EDGES)
        self.assertTrue(all((x['s'], x['t']) not in EDGES for x in e if x['kind'] == 'text'))
        self.assertEqual((kinds['both'], kinds['text'], kinds['link']), (s['both'], s['text_only'], s['link_only']))
        self.assertTrue(all(x['mentions'] > 0 for x in e if x['kind'] != 'link'))
        self.assertTrue(all(x['mentions'] == 0 for x in e if x['kind'] == 'link'))
        self.assertAlmostEqual(s['link_recall'], kinds['both'] / len(EDGES))
        text_in = Counter(x['t'] for x in e if x['kind'] != 'link')
        link_in = Counter(t for _, t in EDGES)
        for n in self.d['nodes']:
            self.assertEqual(n['text_in'], text_in[n['id']]); self.assertEqual(n['link_in'], link_in[n['id']])
            self.assertLessEqual(n['ner_seen'], n['string_mentions'])

    def test_reading(self):
        r = self.d['sample_text_only']
        self.assertEqual(len(r), 30)
        self.assertEqual(sum(self.d['reading_counts'].values()), 30)
        self.assertTrue(all((x['s'], x['t']) not in EDGES for x in r))


class Week8(unittest.TestCase):
    def test_rewire_preserves_degrees(self):
        w8 = module('notebooks/week8/build_week8.py', 'week8')
        edges = sorted(EDGES)
        g = w8.rewire(edges, random.Random(0), 5000)
        self.assertEqual(Counter(s for s, _ in g), Counter(s for s, _ in edges))
        self.assertEqual(Counter(t for _, t in g), Counter(t for _, t in edges))
        self.assertEqual(len(set(g)), len(g)); self.assertFalse(any(a == b for a, b in g))
        self.assertNotEqual(set(g), EDGES)

    def test_observed(self):
        d = json.loads((ROOT / 'site/src/data/week8/reciprocity-null.json').read_text())
        for h in d['hubs']:
            back = sum((h['id'], s) in EDGES for s, t in EDGES if t == h['id'])
            self.assertEqual(h['observed'], back)
            self.assertLessEqual(h['observed'], h['out'])
        self.assertEqual(d['hubs'][0]['id'], 'Spider-Man')
        self.assertEqual((d['hubs'][0]['in'], d['hubs'][0]['observed']), (106, 9))


if __name__ == '__main__':
    unittest.main()
