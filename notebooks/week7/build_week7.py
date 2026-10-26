"""Exercise 7.13: can the text of the Marvel pages rebuild the hyperlink network?

Run from the repository root: .venv-week7/bin/python notebooks/week7/build_week7.py
Edge A -> B in the *text network* when spaCy's NER finds, in A's article, an entity
span that resolves to one of B's names. The week-1 hyperlinks are the comparison,
not ground truth: both are measurements of how Wikipedia writes about Marvel.
"""
from pathlib import Path
from collections import Counter, defaultdict
from urllib.parse import unquote
import csv
import hashlib
import json
import random
import re
import zipfile

import spacy
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[2]
MODEL = 'en_core_web_sm'
SEED = 7
QUALIFIER = re.compile(r'\s*\(([^)]*)\)\s*$')
GENERIC = {'character', 'characters', 'comics', 'marvel', 'marvel comics', 'android', 'inhuman', 'morituri',
           'heroes for hire', 'guardians of the galaxy'}
# Páginas de versiones alternativas: su nombre pelado pertenece al personaje principal
# (que a veces ni está en la categoría, p. ej. Iron Man). No reciben alias.
VARIANT = {'ultimate marvel character', 'marvel mangaverse', 'x-men film series', 'new universe'}


# Lectura de la muestra aleatoria de 30 aristas sólo-texto (semilla 7), con la frase en el
# artículo completo. Leída por el agente; pendiente de revisión del grupo.
#   right     el texto habla de ese personaje
#   umbrella  habla de un portador concreto; el nodo es la página "nombre de varios personajes"
#   mantle    habla de otro portador del mismo nombre
#   thing     no es un personaje: espada, título de serie o película, club, palabra común
READING = {
    ('Black_Bolt', 'Franklin_Richards_(character)'): 'right',
    ('Black_Knight_(Marvel_Comics)', 'Blade_(character)'): 'thing',
    ('Black_Marvel', 'Dusk_(comics)'): 'right',
    ('Black_Widow_(Natasha_Romanova)', 'Bucky_(Marvel_Comics)'): 'right',
    ('Black_Widow_(Natasha_Romanova)', 'Hawkeye_(comics)'): 'umbrella',
    ('Blade_(character)', 'Cyclops_(Marvel_Comics)'): 'right',
    ('Blue_Eagle_(character)', 'Hawkeye_(comics)'): 'umbrella',
    ('Breeze_Barton', 'Red_Raven_(Marvel_Comics)'): 'right',
    ('Captain_Marvel_(Marvel_Comics)', 'Shang-Chi'): 'thing',
    ('Captain_Marvel_(Marvel_Comics)', 'Wolverine_(character)'): 'right',
    ('Captain_Universe', 'Gauntlet_(Joseph_Green)'): 'thing',
    ('Doctor_Druid', 'Magician_(Marvel_Comics)'): 'thing',
    ('Emma_Frost', 'Hellfire_(J._T._Slade)'): 'thing',
    ('Gwenpool', 'Hulk'): 'right',
    ('Hawkeye_(comics)', 'Wolverine_(character)'): 'right',
    ('Hercules_(Marvel_Comics)', 'Iron_Fist_(character)'): 'right',
    ('Karnak_(character)', 'Spider-Man'): 'thing',
    ('Misty_Knight', 'Power_Man_(Victor_Alvarez)'): 'mantle',
    ('Noh-Varr', 'Phoenix_Force'): 'right',
    ('Nomad_(Marvel_Comics)', 'Hawkeye_(comics)'): 'umbrella',
    ('Phil_Urich', 'Spider-Girl'): 'umbrella',
    ('Phoenix_Force', 'Blade_(character)'): 'thing',
    ('Power_Man_(Victor_Alvarez)', 'Spider-Man'): 'right',
    ('Silencer_(comics)', 'Spider-Man'): 'right',
    ('Spider-Woman', 'Spider-Girl'): 'umbrella',
    ('Steel_Spider', 'Spider-Girl'): 'thing',
    ('U.S._Agent', 'Hawkeye_(comics)'): 'umbrella',
    ('Union_Jack_(Marvel_Comics)', 'Hulk'): 'right',
    ('Venom_(character)', 'Hulk'): 'right',
    ('Venom_(character)', 'Nova_(Richard_Rider)'): 'right',
}


def load():
    archive = ROOT / 'data/week5/marvel_pages.zip'
    with zipfile.ZipFile(archive) as z:
        pages = {unquote(n.split('/')[-1][:-4]): z.read(n).decode('utf-8')
                 for n in z.namelist() if n.endswith('.txt') and 'README' not in n}
    with (ROOT / 'data/week1/week1_nodes.tsv').open() as f:
        roster = sorted(csv.DictReader((l for l in f if not l.startswith('#')), delimiter='\t'), key=lambda n: n['node_id'])
    edges = {tuple(l.split('\t')) for l in (ROOT / 'data/week1/week1_edges.tsv').read_text().splitlines() if l and not l.startswith('#')}
    assert len(roster) == len(pages) == 303 and {n['node_id'] for n in roster} == set(pages)
    assert len(edges) == 1784
    return roster, pages, edges, hashlib.sha256(archive.read_bytes()).hexdigest()


def norm(s):
    # Comparación sin mayúsculas, comillas tipográficas ni posesivo final.
    s = s.replace('’', "'").replace('“', '"').replace('”', '"').strip(' "\'.,;:')
    s = re.sub(r"'s$", '', s)
    s = re.sub(r'^the\s+', '', s, flags=re.I)
    return re.sub(r'\s+', ' ', s).lower()


def names_for(node):
    """Title without the disambiguator, plus the real name(s) in the first parenthesis of the lead."""
    q = QUALIFIER.search(node['name'])
    qualifier = q.group(1).lower() if q else ''
    if qualifier in VARIANT:
        return set()
    names = {QUALIFIER.sub('', node['name']).strip()}
    if q and qualifier not in GENERIC and len(q.group(1).split()) >= 2 and q.group(1)[0].isupper():
        names.add(q.group(1))                                        # Black Widow (Natasha Romanova)
    lead = re.match(r'^[^(]{0,80}\(([^)]{3,80})\)\s+(?:is|was|are)\b', node['description'])
    if lead:
        for part in re.split(r',\s*(?:alias|also known as|a\.k\.a\.)\s*|;\s*|\s+or\s+', lead.group(1)):
            part = re.sub(r'\b(?:born|née)\b.*', '', part).strip()
            part = re.sub(r'^(?:also known as|[\w ]{1,20}:)\s*', '', part, flags=re.I).strip()
            plain = re.sub(r'\s*"[^"]+"\s*', ' ', part).strip()      # Antonio "Tony" Stark -> Antonio Stark
            nick = re.search(r'"([^"]+)"', part)
            for n in [plain] + ([re.sub(r'^\S+\s*"[^"]+"', nick.group(1), part)] if nick else []):
                if len(n.split()) >= 2:                               # real names only when first + last
                    names.add(n)
    return {norm(n) for n in names if len(norm(n)) >= 3}


def alias_table(roster):
    owners = defaultdict(set)
    for node in roster:
        for n in names_for(node):
            owners[n].add(node['node_id'])
    unique = {n: next(iter(ids)) for n, ids in owners.items() if len(ids) == 1}
    shared = {n: sorted(ids) for n, ids in owners.items() if len(ids) > 1}
    return unique, shared


def snippet(text, start, end, width=110):
    a = max(0, start - width); b = min(len(text), end + width)
    left = text[a:start]; right = text[end:b]
    cut = max(left.rfind('. '), left.rfind('\n'))
    if cut >= 0: left = left[cut + 1:]
    stop = min([i for i in (right.find('. '), right.find('\n')) if i >= 0] or [len(right)])
    return (left.lstrip() , text[start:end], right[:stop + 1].rstrip())


def build():
    roster, pages, links, archive_sha = load()
    ids = [n['node_id'] for n in roster]
    name = {n['node_id']: QUALIFIER.sub('', n['name']).strip() for n in roster}
    aliases, shared = alias_table(roster)
    pattern = re.compile(r'(?<![\w-])(' + '|'.join(sorted((re.escape(a) for a in aliases), key=len, reverse=True)) + r')(?:’s|\'s)?(?![\w-])', re.I)

    nlp = spacy.load(MODEL, disable=['parser', 'lemmatizer', 'tagger', 'attribute_ruler'])
    nlp.max_length = 2_000_000
    ner_edges, string_edges, evidence, person_edges = defaultdict(int), defaultdict(int), {}, set()
    ner_hits, label_hits = Counter(), defaultdict(Counter)   # por personaje mencionado
    string_hits, covered = Counter(), Counter()
    for src, doc in zip(ids, nlp.pipe((pages[i] for i in ids), batch_size=8)):
        text = pages[src]
        spans = {(e.start_char, e.end_char): e.label_ for e in doc.ents}
        for e in doc.ents:
            tgt = aliases.get(norm(e.text))
            if tgt and tgt != src:
                ner_hits[tgt] += 1; label_hits[tgt][e.label_] += 1
                ner_edges[(src, tgt)] += 1
                if e.label_ == 'PERSON':
                    person_edges.add((src, tgt))
                evidence.setdefault((src, tgt), snippet(text, e.start_char, e.end_char) + (e.label_,))
        # Línea base sin modelo: coincidencia literal del nombre. ¿Vio NER esa misma mención?
        # Sólo cuenta mayúscula inicial: "storm" o "vision" en minúscula son palabras comunes.
        for m in pattern.finditer(text):
            if not m.group(1)[0].isupper():
                continue
            tgt = aliases[norm(m.group(1))]
            if tgt == src:
                continue
            string_edges[(src, tgt)] += 1; string_hits[tgt] += 1
            s, t = m.start(1), m.end(1)
            covered[tgt] += any(a <= s and t <= b for (a, b) in spans)

    text_set = set(ner_edges)
    both, text_only, link_only = text_set & links, text_set - links, links - text_set
    string_set = set(string_edges)

    rng = random.Random(SEED)
    sample = sorted(rng.sample(sorted(text_only), 30))
    indeg_link = Counter(t for _, t in links); indeg_text = Counter(t for _, t in text_set)
    rho = spearmanr([indeg_link[i] for i in ids], [indeg_text[i] for i in ids]).statistic

    nodes = []
    for node in roster:
        i = node['node_id']
        nodes.append({'id': i, 'name': name[i], 'url': node['url'],
                      'link_in': indeg_link[i], 'text_in': indeg_text[i],
                      'string_mentions': string_hits[i], 'ner_seen': covered[i],
                      'labels': dict(label_hits[i].most_common())})
    edge_rows = []
    for (s, t) in sorted(text_set | links):
        row = {'s': s, 't': t, 'kind': 'both' if (s, t) in both else 'text' if (s, t) in text_only else 'link',
               'mentions': ner_edges.get((s, t), 0), 'string': string_edges.get((s, t), 0)}
        if (s, t) in evidence:
            row['evidence'] = list(evidence[(s, t)])
        edge_rows.append(row)

    seen = sum(covered.values()); total = sum(string_hits.values())
    result = {
        'method': {'model': f'{MODEL} {spacy.util.get_package_version(MODEL)}', 'spacy': spacy.__version__,
                   'archive_sha256': archive_sha, 'seed': SEED, 'aliases': len(aliases),
                   'shared_aliases_dropped': len(shared), 'shared_examples': dict(sorted(shared.items())[:12]),
                   'edge_rule': 'A -> B if an entity span in A resolves exactly (case-insensitive, possessive and leading "the" removed) to a unique name of B'},
        'summary': {'nodes': len(ids), 'link_edges': len(links), 'text_edges': len(text_set),
                    'both': len(both), 'text_only': len(text_only), 'link_only': len(link_only),
                    'jaccard': len(both) / len(text_set | links),
                    'link_recall': len(both) / len(links), 'string_edges': len(string_set),
                    'string_link_recall': len(string_set & links) / len(links),
                    'ner_coverage': seen / total, 'string_mentions': total,
                    'indegree_spearman': float(rho),
                    'person_only_link_recall': len(person_edges & links) / len(links),
                    'person_only_in': {t: sum(1 for (a, b) in person_edges if b == t) for t in
                                       ['Hulk', 'Cyclops_(Marvel_Comics)', 'Wolverine_(character)', 'Spider-Man']}},
        'sample_text_only': [{'s': s, 't': t, 'reading': READING[(s, t)]} for s, t in sample],
        'reading_counts': dict(Counter(READING[p] for p in sample)),
        'nodes': nodes, 'edges': edge_rows,
    }
    for p in ['data/week7/exports/text-vs-links.json', 'site/src/data/week7/text-vs-links.json']:
        dest = ROOT / p; dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps(result['summary'], indent=2))
    print('shared aliases', len(shared), list(shared.items())[:10])
    return result


if __name__ == '__main__':
    build()
