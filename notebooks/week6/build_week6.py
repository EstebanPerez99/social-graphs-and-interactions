"""Exercise 6.11: one frozen Marvel corpus, two community perspectives.

Run from any directory: .venv/bin/python notebooks/week6/build_week6.py
All measurements precede the display layout. No screen distance is used as evidence.
"""
from pathlib import Path
from collections import Counter
from urllib.parse import unquote
import csv
import hashlib
import json
import re
import zipfile

import networkx as nx
import numpy as np
import scipy
import sklearn
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics import normalized_mutual_info_score
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parents[2]
SEED = 7
K = 8
COLORS = ['#cb9328', '#9d83c7', '#903d7b', '#526922', '#66c292', '#6773b4', '#d0622c', '#2e9e8f']
TOKEN = r'(?u)\b[a-zA-Z]{2,}\b'


def load():
    archive = ROOT / 'data/week5/marvel_pages.zip'
    with zipfile.ZipFile(archive) as z:
        pages = {unquote(n.split('/')[-1][:-4]): z.read(n).decode('utf-8')
                 for n in z.namelist() if n.endswith('.txt') and 'README' not in n}
    with (ROOT / 'data/week1/week1_nodes.tsv').open() as f:
        roster = sorted(csv.DictReader((l for l in f if not l.startswith('#')), delimiter='\t'), key=lambda n: n['node_id'])
    ids = [n['node_id'] for n in roster]
    edges = [tuple(l.split('\t')) for l in (ROOT / 'data/week1/week1_edges.tsv').read_text().splitlines() if l and not l.startswith('#')]
    assert len(ids) == len(pages) == 303 and set(ids) == set(pages)
    assert len(edges) == len(set(edges)) == 1784
    index = {name: i for i, name in enumerate(ids)}
    graph = nx.Graph()
    graph.add_nodes_from(range(len(ids)))
    graph.add_edges_from((index[a], index[b]) for a, b in edges if a != b)
    return roster, [pages[n] for n in ids], graph, edges


def vectorize(pages, remove_names=False):
    stop = set(ENGLISH_STOP_WORDS)
    if remove_names:
        seen, capitalized = Counter(), Counter()
        for text in pages:
            for word in re.findall(r'[A-Za-z]+', text):
                seen[word.lower()] += 1
                capitalized[word.lower()] += word[0].isupper()
        # Course heuristic, not a named-entity recognizer: also removes some ordinary words.
        stop |= {w for w in seen if capitalized[w] > seen[w] / 2}
    vectorizer = TfidfVectorizer(stop_words=sorted(stop), token_pattern=TOKEN, min_df=2,
                                 norm='l2', smooth_idf=True, sublinear_tf=False)
    matrix = vectorizer.fit_transform(pages).tocsr()
    assert np.all(np.asarray(matrix.multiply(matrix).sum(axis=1)).ravel() > 0)
    return vectorizer, matrix


def text_graph(scores, k):
    graph = nx.Graph()
    graph.add_nodes_from(range(len(scores)))
    for i, row in enumerate(scores):
        neighbors = sorted((j for j in range(len(row)) if j != i), key=lambda j: (-row[j], j))[:k]
        for j in neighbors:
            if row[j] > 0:
                graph.add_edge(i, j, weight=float(row[j]))
    return graph


def partition(graph, weight=None):
    groups = sorted(nx.community.louvain_communities(graph, weight=weight, seed=SEED), key=lambda g: (-len(g), min(g)))
    labels = [0] * len(graph)
    for c, group in enumerate(groups):
        for i in group:
            labels[i] = c
    return labels, groups


def snippet(text, term):
    match = re.search(r'\b' + re.escape(term) + r'\b', text, re.I)
    at = match.start() if match else 0
    start, end = max(0, at - 100), min(len(text), at + 190)
    return ('…' if start else '') + re.sub(r'\s+', ' ', text[start:end]).strip() + ('…' if end < len(text) else '')


def explain(matrix, vocab, a, b, top=8):
    shared = matrix[a].multiply(matrix[b]).tocoo()
    order = sorted(zip(shared.col, shared.data), key=lambda p: (-p[1], p[0]))[:top]
    return [{'word': str(vocab[i]), 'contribution': round(float(w), 8)} for i, w in order]


def lane_positions(matrix, text_groups, network_groups, graph):
    """Categorical lanes: top sees text groups, side sees network groups.

    x is shared deterministic within-lane jitter; y encodes structural membership;
    z encodes textual membership. Spacing is deliberately NOT a distance embedding.
    Isolated structural singletons share a grey display lane but retain separate labels.
    """
    n = matrix.shape[0]
    coords = np.zeros((n, 3))
    rng = np.random.default_rng(SEED)
    coords[:, 0] = rng.uniform(-1.25, 1.25, n)
    nonisolated = [g for g in network_groups if any(graph.degree(i) for i in g)]
    lanes = nonisolated + ([set(nx.isolates(graph))] if list(nx.isolates(graph)) else [])
    for axis, groups in [(2, text_groups), (1, lanes)]:
        centers = np.linspace(-1.7, 1.7, len(groups))
        half_width = min(0.22, 1.1 / max(1, len(groups)))
        for c, members in enumerate(groups):
            members = sorted(members)
            coords[members, axis] = centers[c] + rng.uniform(-half_width, half_width, len(members))
    return coords.round(6).tolist(), lanes


def build():
    roster, pages, network, directed_edges = load()
    ids = [n['node_id'] for n in roster]
    vectorizer, matrix = vectorize(pages)
    vocab = vectorizer.get_feature_names_out()
    scores = np.clip(cosine_similarity(matrix), 0, 1)
    clean_vectorizer, clean_matrix = vectorize(pages, remove_names=True)
    clean_scores = np.clip(cosine_similarity(clean_matrix), 0, 1)
    similarity = text_graph(scores, K)
    tc, text_groups = partition(similarity, 'weight')
    nc, network_groups = partition(network)
    n = len(ids)
    paths = dict(nx.all_pairs_shortest_path(network))
    distances = [[len(paths[a][b]) - 1 if b in paths[a] else None for b in range(n)] for a in range(n)]
    pairs = [(a, b) for a in range(n) for b in range(a + 1, n)]
    ranked = sorted(pairs, key=lambda p: (-scores[p], p))
    distant = [(a, b) for a, b in ranked if distances[a][b] is not None and distances[a][b] >= 3][:12]
    disconnected = [(a, b) for a, b in ranked if distances[a][b] is None][:6]
    within = [scores[a, b] for a, b in pairs if nc[a] == nc[b]]
    across = [scores[a, b] for a, b in pairs if nc[a] != nc[b]]
    positions, lanes = lane_positions(matrix, text_groups, network_groups, network)
    structural_lane = {i: c for c, lane in enumerate(lanes) for i in lane}

    nodes = []
    for i, node in enumerate(roster):
        row = matrix[i]
        top = sorted(zip(row.indices, row.data), key=lambda p: (-p[1], p[0]))[:8]
        nodes.append({'id': ids[i], 'name': node['name'], 'url': node['url'], 'p': positions[i],
                      't': tc[i], 's': nc[i], 'lane': structural_lane[i], 'degree': network.degree(i),
                      'words': [str(vocab[j]) for j, _ in top], 'excerpt': snippet(pages[i], str(vocab[top[0][0]])),
                      'v': [[int(j), round(float(w), 7)] for j, w in sorted(zip(row.indices, row.data))]})
    groups = {'text': [], 'network': []}
    for c, members in enumerate(text_groups):
        terms = np.asarray(matrix[sorted(members)].mean(axis=0)).ravel()
        top = sorted(range(len(terms)), key=lambda j: (-terms[j], j))[:4]
        groups['text'].append({'id': c, 'label': ' / '.join(str(vocab[j]) for j in top[:3]),
                               'words': [str(vocab[j]) for j in top], 'size': len(members), 'color': COLORS[c % len(COLORS)]})
    for c, members in enumerate(lanes):
        leaders = sorted(members, key=lambda i: (-network.degree(i), ids[i]))[:2]
        isolated = all(network.degree(i) == 0 for i in members)
        groups['network'].append({'id': c, 'label': 'Unlinked singletons' if isolated else ' / '.join(roster[i]['name'] for i in leaders),
                                  'size': len(members), 'color': '#798698' if isolated else COLORS[c % len(COLORS)], 'isolated': isolated})
    examples = []
    for a, b in distant + disconnected:
        shared = explain(matrix, vocab, a, b)
        terms = shared[0]['word'] if shared else ''
        examples.append({'a': a, 'b': b, 'cosine': round(float(scores[a, b]), 6),
                         'clean_cosine': round(float(clean_scores[a, b]), 6), 'distance': distances[a][b],
                         'path': paths[a].get(b, []), 'shared': shared,
                         'excerpts': [snippet(pages[i], terms) for i in (a, b)]})
    stability = {}
    for k in [5, 12]:
        alternate, _ = partition(text_graph(scores, k), 'weight')
        stability[str(k)] = round(float(normalized_mutual_info_score(tc, alternate)), 6)
    overlap = [[sum(structural_lane[i] == s and tc[i] == t for i in range(n)) for t in range(len(text_groups))] for s in range(len(lanes))]
    group_stats = []
    for c, members in enumerate(lanes):
        local = [scores[a, b] for a in members for b in members if a < b]
        group_stats.append({'lane': c, 'pairs': len(local), 'mean': round(float(np.mean(local)), 6) if local else None})
    summary = {'nodes': n, 'pairs': len(pairs), 'directed_links': len(directed_edges), 'undirected_links': network.number_of_edges(),
               'vocabulary': len(vocab), 'text_communities': len(text_groups), 'network_communities': len(network_groups),
               'isolates': len(list(nx.isolates(network))), 'disconnected_pairs': sum(distances[a][b] is None for a, b in pairs),
               'within_mean': round(float(np.mean(within)), 6), 'across_mean': round(float(np.mean(across)), 6),
               'within_pairs': len(within), 'across_pairs': len(across),
               'nmi': round(float(normalized_mutual_info_score(tc, nc)), 6), 'k_stability_nmi': stability}
    files = [ROOT / 'data/week5/marvel_pages.zip', ROOT / 'data/week1/week1_nodes.tsv', ROOT / 'data/week1/week1_edges.tsv']
    method = {'seed': SEED, 'k': K, 'source': 'https://sunelehmann.com/socialgraphs2026-web/data/',
              'verified_against_official_downloads': '2026-10-19', 'snapshot': '2026-08-26',
              'sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
              'tfidf': {'lowercase': True, 'stop_words': 'sklearn English', 'token_pattern': TOKEN, 'min_df': 2,
                        'tf': 'raw counts', 'idf': 'ln((1+N)/(1+df)) + 1', 'normalization': 'L2', 'sublinear_tf': False,
                        'text_scope': 'all supplied text; names retained in primary analysis'},
              'text_graph': 'union of each article\u2019s 8 highest-positive-cosine neighbors; cosine edge weights',
              'communities': 'Louvain, resolution=1, seed=7; weighted text graph, unweighted undirected link graph',
              'network_distance': 'shortest paths after symmetrizing links; disconnected pairs have null distance',
              'layout': 'categorical community lanes: x deterministic seeded jitter, y network membership, z text membership; not a metric embedding',
              'name_check': 'remove alphabetic words capitalized in more than half their occurrences; refit IDF and L2 norm',
              'versions': {'numpy': np.__version__, 'networkx': nx.__version__, 'scipy': scipy.__version__, 'scikit-learn': sklearn.__version__}}
    result = {'method': method, 'summary': summary, 'groups': groups, 'overlap': overlap, 'group_stats': group_stats,
              'nodes': nodes, 'vocabulary': vocab.tolist(), 'cosine': np.round(scores, 6).tolist(),
              'clean_cosine': np.round(clean_scores, 6).tolist(), 'distance': distances,
              'network_edges': [list(e) for e in sorted(network.edges())],
              'text_edges': [[a, b, round(float(d['weight']), 6)] for a, b, d in sorted(similarity.edges(data=True))],
              'examples': examples}
    for relative in ['data/week6/exports/two-perspectives.json', 'site/public/data/week6/two-perspectives.json']:
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
    small = ROOT / 'site/src/data/week6/summary.json'
    small.parent.mkdir(parents=True, exist_ok=True)
    small.write_text(json.dumps({'summary': summary, 'examples': [dict(e, names=[roster[e['a']]['name'], roster[e['b']]['name']]) for e in examples], 'method': method}, indent=2) + '\n')
    print(json.dumps(summary, indent=2))
    for example in examples[:5]:
        a, b = example['a'], example['b']
        print(roster[a]['name'], '/', roster[b]['name'], example['cosine'], 'hops', example['distance'], 'name-filtered', example['clean_cosine'])
        print('Shared:', ', '.join(w['word'] for w in example['shared']))
        print(*example['excerpts'], sep='\n')
    return result


if __name__ == '__main__':
    build()
