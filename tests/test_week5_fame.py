"""Verify measurement boundaries and the exported analysis independently."""
import importlib.util
import json
from pathlib import Path
from collections import Counter
import unittest
import math

ROOT = Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('week5',ROOT/'notebooks/week5/build_week5.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class FameTests(unittest.TestCase):
    def test_token_boundaries(self):
        self.assertEqual(module.tokens("Spider-Man's 123 powers: don't STOP."),['spider',"man's",'powers',"don't",'stop'])
    def test_export(self):
        d=json.loads((ROOT/'site/src/data/week5/fame-vs-words.json').read_text())
        edges=[l.split('\t') for l in (ROOT/'data/week1/week1_edges.tsv').read_text().splitlines() if l and not l.startswith('#')]
        counts=Counter(b for a,b in edges)
        self.assertEqual(len(d['nodes']),303)
        self.assertEqual(sum(n['degree'] for n in d['nodes']),1784)
        self.assertEqual(sum(n['degree']==0 for n in d['nodes']),58)
        for n in d['nodes']:
            self.assertEqual(n['degree'],counts[n['id']])
            expected=10**(d['method']['intercept']+d['method']['slope']*math.log1p(n['degree']))
            self.assertAlmostEqual(n['expected'],expected)
            self.assertAlmostEqual(n['ratio'],n['tokens']/expected)
        order=sorted(d['nodes'],key=lambda n:(-n['residual'],n['id']))
        self.assertEqual(d['high'],[n['id'] for n in order[:3]])
        self.assertEqual(d['low'],[n['id'] for n in reversed(order[-3:])])
        self.assertEqual((ROOT/'data/week5/exports/fame-vs-words.json').read_bytes(),(ROOT/'site/src/data/week5/fame-vs-words.json').read_bytes())

if __name__=='__main__': unittest.main()
