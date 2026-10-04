"""Reproduce exercise 5.9 from the frozen course pages and week-1 network."""
from pathlib import Path
import csv, hashlib, io, json, re, zipfile
from urllib.parse import unquote
from collections import Counter
import numpy as np
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[2]
TOKEN = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*", re.UNICODE)

def tokens(text):
    # Alphabetic words, preserving internal apostrophes. No stopword removal.
    return TOKEN.findall(text.lower())

def build():
    archive = ROOT / 'data/week5/marvel_pages.zip'
    with zipfile.ZipFile(archive) as z:
        pages = {unquote(n.split('/')[-1][:-4]): z.read(n).decode('utf-8')
                 for n in z.namelist() if n.endswith('.txt') and 'README' not in n}
    with (ROOT / 'data/week1/week1_nodes.tsv').open() as f:
        nodes = list(csv.DictReader((l for l in f if not l.startswith('#')), delimiter='\t'))
    edges = [tuple(l.strip().split('\t')) for l in (ROOT / 'data/week1/week1_edges.tsv').read_text().splitlines() if l and not l.startswith('#')]
    assert len(nodes) == len(pages) == 303 and len(set(edges)) == len(edges) == 1784
    assert set(pages) == {n['node_id'] for n in nodes}
    assert all(a in pages and b in pages for a,b in edges)
    indegree = Counter(b for a,b in edges)
    rows = [{'id':n['node_id'], 'name':n['name'], 'url':n['url'], 'degree':indegree[n['node_id']], 'tokens':len(tokens(pages[n['node_id']])), 'whitespace_tokens':len(pages[n['node_id']].split())} for n in nodes]
    x = np.log1p([r['degree'] for r in rows]); y = np.log10([r['tokens'] for r in rows])
    slope, intercept = np.polyfit(x, y, 1)
    for r in rows:
        expected = float(10 ** (intercept + slope * np.log1p(r['degree'])))
        r.update(expected=expected, ratio=r['tokens']/expected, residual=float(np.log10(r['tokens']/expected)))
    order = sorted(rows, key=lambda r:(-r['residual'],r['id']))
    high, low = [r['id'] for r in order[:3]], [r['id'] for r in reversed(order[-3:])]
    result = {'method':{'tokenization':TOKEN.pattern,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'fit':'log10(tokens) = intercept + slope * ln(1 + in-degree)','slope':float(slope),'intercept':float(intercept)},'summary':{'nodes':len(rows),'edges':len(edges),'spearman':float(spearmanr(x,y).statistic),'whitespace_spearman':float(spearmanr(x,[r['whitespace_tokens'] for r in rows]).statistic),'total_tokens':sum(r['tokens'] for r in rows),'zero_indegree':sum(r['degree']==0 for r in rows)},'high':high,'low':low,'nodes':rows}
    for p in ['data/week5/exports/fame-vs-words.json','site/src/data/week5/fame-vs-words.json']:
        dest=ROOT/p; dest.parent.mkdir(parents=True,exist_ok=True); dest.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(result['summary'],indent=2))
    for r in order[:3]+list(reversed(order[-3:])):
        print(r['name'],r['degree'],r['tokens'],round(r['ratio'],2))
        print(pages[r['id']][:650])

if __name__ == '__main__':
    build()
