"""Development-only projection of Graphify output; never imports Nexus services."""
import argparse
from collections import Counter
from copy import deepcopy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
from tree_sitter import Language, Parser
import tree_sitter_javascript


class CallSites:
    """Check the receiver at a reported JS callsite, not its spelling alone."""
    def __init__(self, root):
        self.root = root.resolve()
        self.parser = Parser(Language(tree_sitter_javascript.language()))
        self.cache = {}

    def recursion(self, edge, target):
        source = Path(edge.get('source_file', ''))
        if source.suffix not in ('.js', '.cjs', '.mjs'):
            return True  # Other languages are not re-resolved by this adapter.
        if source not in self.cache:
            path = (self.root / source).resolve()
            if not path.is_relative_to(self.root):
                raise ValueError('Source outside map root')
            self.cache[source] = self.parser.parse(path.read_bytes())
        match = re.fullmatch(r'\.?([\w$]+)\(\)', target.get('label', ''))
        location = re.fullmatch(r'L(\d+)(?:[-:].*)?', edge.get('source_location', ''))
        if not match or not location:
            return False
        row = int(location[1]) - 1
        stack = [self.cache[source].root_node]
        while stack:
            node = stack.pop()
            if not node.start_point.row <= row <= node.end_point.row:
                continue
            if node.type == 'call_expression':
                callee = node.child_by_field_name('function')
                if callee and callee.type == 'identifier' and callee.text.decode() == match[1]:
                    return True
                if callee and callee.type == 'member_expression':
                    obj = callee.child_by_field_name('object')
                    prop = callee.child_by_field_name('property')
                    if obj and prop and obj.type == 'this' and prop.text.decode() == match[1]:
                        return True
            stack.extend(node.named_children)
        return False


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('src'):
            self.references.append(('loads_script', attrs['src'], self.getpos()[0]))
        if tag == 'link' and 'stylesheet' in attrs.get('rel', '').lower().split() and attrs.get('href'):
            self.references.append(('loads_stylesheet', attrs['href'], self.getpos()[0]))


def add_assets(graph, root):
    """Only explicit local public-file dependencies, not guessed DOM/CSS semantics."""
    root = root.resolve()
    public = root / 'public'
    if not public.is_dir() or public.is_symlink():
        return 0
    public = public.resolve()
    files = {}
    for node in graph['nodes']:
        source = node.get('source_file', '')
        if (source and not node.get('_callable') and node.get('source_location') == 'L1'
                and node.get('label', '').endswith(Path(source).name)):
            files.setdefault(source.replace('\\', '/'), node['id'])
    added = 0

    def file_node(path):
        nonlocal added
        relative = path.relative_to(root).as_posix()
        if relative not in files:
            # Exact path ID cannot collide with normalized AST IDs.
            node_id = 'asset:' + relative
            graph['nodes'].append({'id': node_id, 'label': relative, 'source_file': relative,
                                   'source_location': 'L1', 'file_type': 'code',
                                   '_origin': 'html-asset-reference'})
            files[relative] = node_id
            added += 1
        return files[relative]

    for path in sorted(public.rglob('*')):
        if (path.suffix not in ('.html', '.css') or path.is_symlink()
                or not path.resolve().is_relative_to(public) or path.stat().st_size > 2 * 1024 * 1024):
            continue
        source = file_node(path)
        if path.suffix != '.html':
            continue
        parser = Assets()
        parser.feed(path.read_text(encoding='utf-8'))
        for relation, url, line in parser.references:
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            target_path = unquote(parsed.path)
            candidate = ((public / target_path.lstrip('/')) if target_path.startswith('/')
                         else (path.parent / target_path)).resolve()
            if (not candidate.is_relative_to(public) or not candidate.is_file()
                    or candidate.suffix not in ('.js', '.mjs', '.cjs', '.css')):
                continue
            graph['links'].append({'source': source, 'target': file_node(candidate),
                                   'relation': relation, 'confidence': 'EXTRACTED',
                                   '_origin': 'html-asset-reference',
                                   'source_file': path.relative_to(root).as_posix(),
                                   'source_location': f'L{line}'})
    return added


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    raw = json.loads(args.input.read_text(encoding='utf-8'))
    graph = deepcopy(raw)
    edges = graph.pop('edges', graph.get('links', []))
    # Name-based inference is evidence to review, not a resolved dependency.
    pending = [{**e, 'review_reason': 'inference-not-verified'} for e in edges
               if e.get('confidence') != 'EXTRACTED']
    graph['links'] = []
    sites = CallSites(args.root)
    by_id = {n['id']: n for n in graph['nodes']}
    for edge in edges:
        if edge.get('confidence') != 'EXTRACTED':
            continue
        if (edge.get('relation') == 'calls' and edge['source'] == edge['target']
                and not sites.recursion(edge, by_id[edge['target']])):
            pending.append({**edge, 'review_reason': 'receiver-not-resolved-as-self'})
            continue
        graph['links'].append(edge)
    added = add_assets(graph, args.root)
    # Disambiguate labels in the visualization without changing stable symbol IDs.
    names = Counter(n.get('label') for n in graph['nodes'])
    for node in graph['nodes']:
        label = node.get('label', '')
        if names[label] > 1 and node.get('source_file'):
            node['original_label'] = label
            node['label'] = f'{label} [{node["source_file"]}]'
    graph.update(directed=True, multigraph=False)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / 'graph.json').write_text(json.dumps(graph), encoding='utf-8')
    audit = {'input_nodes': len(raw['nodes']), 'input_edges': len(edges),
             'kept_edges': len(graph['links']), 'added_asset_nodes': added,
             'pending_edges': len(pending), 'pending': pending,
             'limitations': ['Not a complete call resolver; EXTRACTED is not a runtime proof.',
                             'HTML/CSS coverage is file/asset structure only.']}
    # Track working-tree content too: HEAD alone misses uncommitted changes.
    sources = sorted({n.get('source_file') for n in graph['nodes'] if n.get('source_file')})
    audit['source_sha256'] = {}
    root = args.root.resolve()
    for source in sources:
        path = (root / source).resolve()
        if path.is_relative_to(root) and path.is_file():
            audit['source_sha256'][source] = hashlib.sha256(path.read_bytes()).hexdigest()
    (args.out / 'MAP_AUDIT.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in audit.items() if k not in ('pending', 'source_sha256')}))


if __name__ == '__main__':
    main()
