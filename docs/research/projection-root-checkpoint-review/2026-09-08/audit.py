"""Audit immutable source/history and retained bytes; never import the project."""
import ast
import hashlib
import json
from pathlib import Path
import subprocess
import zlib

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906')
OLD = 'a04bba14c487f7dc72e5f7e01abf93cd471979d1'
PIN = '51a96fa11bd7590af3d5ed45b6fb6ebfdca414fe'
BASE = 'docs/research/precision-gate-projection-reference-validation/2026-09-08/'
MODULE = 'src/Interp.Python/zeta_interp/precision_gate_projection_reference.py'
TEST = 'src/Interp.Python/tests/test_precision_gate_projection_reference.py'

def blob(pin, path):
    return subprocess.run(['git', '-C', str(REPO), 'show', pin + ':' + path], capture_output=True, check=True).stdout

def ident(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}

def checked(raw, row, prefix=''):
    assert ident(raw) == {'Bytes': row[prefix + 'Bytes'], 'Sha256': row[prefix + 'Sha256']}

summary = []
archives = {}
for cut, group, expected in ((OLD, 'root', 29), (PIN, 'certificate', 90)):
    manifest_raw = blob(cut, BASE + group + '/manifest.json')
    manifest = json.loads(manifest_raw)
    assert len(manifest) == expected
    raws = {}
    for row in manifest:
        assert Path(row['Stored']).name == row['Stored'] and row['Stored'] not in raws
        assert row['Bytes'] < 2**21
        packed = blob(cut, BASE + group + '/' + row['Stored'])
        checked(packed, row, 'Stored')
        decoder = zlib.decompressobj(31)
        raw = decoder.decompress(packed, row['Bytes'] + 1)
        assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
        checked(raw, row)
        path = REPO / row['Original']
        assert path.is_relative_to(REPO / '.git') and path.read_bytes() == raw
        raws[row['Stored']] = raw
    sources = []
    for name, raw in raws.items():
        if name.endswith('sources.json.gz'):
            prefix = name.removesuffix('sources.json.gz')
            rows = json.loads(raw)
            for i, row in enumerate(rows):
                checked(raws[prefix + f'source-{i}.gz'], row)
            sources.append({'File': name, 'Rows': rows})
    archives[group] = raws
    selected = {name: json.loads(raw) for name, raw in raws.items() if name.endswith(('commands.json.gz', 'command.json.gz'))}
    outputs = {name: raw.decode() for name, raw in raws.items() if name.endswith(('pytest.stdout.gz', 'mypy.stdout.gz', 'ruff.stdout.gz', 'format.stdout.gz', '06-stdout.gz', '07-stdout.gz', '08-stdout.gz'))}
    summary.append({'Group': group, 'Commit': cut, 'Manifest': ident(manifest_raw), 'Records': expected, 'RawBytes': sum(row['Bytes'] for row in manifest), 'StoredBytes': sum(row['StoredBytes'] for row in manifest), 'Sources': sources, 'Commands': selected, 'Outputs': outputs})

for path, index in ((MODULE, 0), (TEST, 1)):
    assert archives['root'][f'attempt-2-source-{index}.gz'] == blob(OLD, path)
    assert archives['certificate'][f'05-source-{index}.gz'] == blob(PIN, path)

def node(raw, name):
    matches = [n for n in ast.parse(raw).body if getattr(n, 'name', None) == name]
    assert len(matches) == 1
    return ast.dump(matches[0], include_attributes=False)

original = blob(OLD, MODULE)
regression = archives['certificate']['06-source.py.gz']
shared = ['_Root', '_take', '_input', '_caller', 'reference_root']
for name in shared:
    assert node(original, name) == node(regression, name)
result = {'OldRootCommit': OLD, 'CorrectedRootCut': PIN, 'OldModule': ident(original), 'CurrentModule': ident(blob(PIN, MODULE)), 'CurrentTests': ident(blob(PIN, TEST)), 'Archives': summary, 'AuthorRetryRegressionWholeModuleDiffersFromOldRoot': original != regression, 'AuthorRetryRegressionRootAstMatches': shared, 'ProjectCodeExecuted': False, 'CertificateAccepted': False}
print(json.dumps(result, indent=2))
