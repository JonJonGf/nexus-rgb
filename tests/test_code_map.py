"""Regressions at the development map CLI/artifact boundary (isolated uv Python)."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from graphify.extract import extract

CLI = Path(__file__).resolve().parents[1] / 'scripts' / 'refine-code-map.py'


class CodeMapTests(unittest.TestCase):
    def project(self, files):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        for name, text in files.items():
            file = root / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(text, encoding='utf-8')
        raw = extract(list(root.rglob('*.js')), root=root, parallel=False)
        input_file = root / 'raw.json'
        input_file.write_text(json.dumps(raw), encoding='utf-8')
        subprocess.run([sys.executable, str(CLI), '--root', str(root),
                        '--input', str(input_file), '--out', str(root / 'out')],
                       check=True, capture_output=True, text=True)
        self.raw = raw
        graph = json.loads((root / 'out' / 'graph.json').read_text(encoding='utf-8'))
        audit = json.loads((root / 'out' / 'MAP_AUDIT.json').read_text(encoding='utf-8'))
        self.assertEqual(audit['input_nodes'], len(raw['nodes']))
        # Every original edge must remain visible or be preserved for review.
        def signature(edge):
            return (edge['source'], edge['target'], edge['relation'],
                    edge.get('source_file'), edge.get('source_location'))
        originals = {signature(e) for e in raw['edges']}
        accounted = {signature(e) for e in graph['links']} | {signature(e) for e in audit['pending']}
        self.assertTrue(originals <= accounted)
        ids = {n['id'] for n in graph['nodes']}
        self.assertTrue(all(e['source'] in ids and e['target'] in ids for e in graph['links']))
        return graph

    def test_string_argument_does_not_call_homonymous_function_in_other_file(self):
        graph = self.project({
            'worker.js': 'const origin="http://localhost"; function api(){return fetch(origin);}',
            'ui.js': 'function origin(){return window.location.origin;}',
        })
        self.assertTrue(any(e['source'] == 'worker_api' and e['target'] == 'ui_origin'
                            for e in self.raw['edges']), 'Fixture must reproduce the upstream bug')
        self.assertFalse(any(e['source'] == 'worker_api' and e['target'] == 'ui_origin'
                             for e in graph['links']), 'A string is not a callback to another module')

    def test_other_object_method_is_not_recursion_but_real_recursion_remains(self):
        graph = self.project({'hardware.js': '''
class Hardware {
  connect() { client.connect(); }
  tick() { this.tick(); }
}
function retry() { retry(); }
'''})
        labels = {n['id']: n['label'] for n in graph['nodes']}
        loops = [labels[e['source']] for e in graph['links'] if e['source'] == e['target']]
        self.assertNotIn('.connect()', loops, 'client.connect is not Hardware.connect')
        self.assertIn('.tick()', loops, 'Keep the actual this.tick recursion')
        self.assertIn('retry()', loops, 'Keep bare function recursion')

    def test_html_assets_cover_local_scripts_and_styles_without_following_external_paths(self):
        graph = self.project({
            'public/index.html': '''<link rel="stylesheet" href="/theme.css?v=2">
<script src="./app.js"></script><script src="https://external.invalid/remote.js"></script>
<script src="../private.js"></script>''',
            'public/app.js': 'function boot(){}',
            'public/theme.css': 'body {color: red}',
            'private.js': 'function privateValue(){}',
        })
        nodes = {n['id']: n for n in graph['nodes']}
        assets = {(nodes[e['source']]['source_file'], e['relation'], nodes[e['target']]['source_file'])
                  for e in graph['links'] if e['relation'].startswith('loads_')}
        self.assertIn(('public/index.html', 'loads_script', 'public/app.js'), assets)
        self.assertIn(('public/index.html', 'loads_stylesheet', 'public/theme.css'), assets)
        self.assertFalse(any(a[2] == 'private.js' for a in assets))


if __name__ == '__main__':
    unittest.main()
