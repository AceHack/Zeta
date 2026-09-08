"""Compare preserved experiment artifacts across publication cuts, without execution."""

import hashlib
import json
from pathlib import Path
import subprocess


PUB = Path('/Users/acehack/.zeta/agents/codex/Zeta-projection-publication-20260908')
HEAD = '212758f124fbe7d42cf8073c7863fa99183c1d1a'
MERGE = 'f59b6e395603062882dd1fe69fa8247406842e4d'
CUT = '6608fdacc5dce7da60cb0f61d004726b65d78ff0'
PREFIX = 'docs/research/precision-gate-projection/2026-09-08/'


def read(commit, path):
    return subprocess.run(['git', 'show', commit + ':' + path], cwd=PUB,
                          capture_output=True, timeout=30, check=True).stdout


rows = []
for original, paths in (
    ('61f8e14ba9f89e790dce635ce5c86db5c619b63c',
     ['registered-1/custody.tar.gz', 'registered-1/manifest.json', 'registered-1/observation.json']),
    ('ba7c312d55233f507ecbbfd62e3c3fb733fd35a7',
     ['implementation-source/custody.tar.gz', 'implementation-source/archive-manifest.json',
      'implementation-source/implementation-manifest.json']),
):
    for leaf in paths:
        path = PREFIX + leaf
        raw = read(original, path)
        assert all(read(cut, path) == raw for cut in (HEAD, MERGE, CUT))
        rows.append({'Path': path, 'OriginalCommit': original, 'Bytes': len(raw),
                     'Sha256': hashlib.sha256(raw).hexdigest().upper(),
                     'EqualAt': [HEAD, MERGE, CUT]})
assert rows[-1]['Sha256'] == 'FE1F5BDF732FA6B08092887210552BA9CEF68D724E519C77958A282366A348E7'
helper_path = 'docs/research/projection-hygiene-independent-review/2026-09-08/audit.py'
helper = read(HEAD, helper_path)
assert helper == read('02c439f7e87d30fb5062cbafa21ffe8759e32da1', helper_path)
assert b"removed_ruff = new['tool'].pop('ruff')" in helper
report_path = 'docs/research/2026-09-08-mixed-message-epoch-independent-review.md'
accepted = read('6f5c62198aaee8f758d726e0c4c514f3bab57b9a', report_path)
assert read(CUT, report_path) == accepted
print(json.dumps({'Complete': True, 'PreservedArtifactRows': rows,
                  'PublishedThreadCorrectionEqualsReviewedSource': True,
                  'PriorDesignReviewBytesUnchanged': True,
                  'PriorDesignReviewSha256': hashlib.sha256(accepted).hexdigest().upper(),
                  'NumericalOrDesignReevaluationPerformed': False}, indent=2))
