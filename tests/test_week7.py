"""Independent checks of the week-7 text network."""
import importlib.util
import json
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


if __name__ == '__main__':
    unittest.main()
