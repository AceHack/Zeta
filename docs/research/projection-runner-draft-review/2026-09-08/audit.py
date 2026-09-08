"""Inspect source and archived fixture outcomes only; no project execution."""
import ast
import hashlib
import json
from pathlib import Path
import subprocess
import zlib

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
OLD = '2e051e8d0e5715dc3da6aa5176037d25598e74df'
PIN = 'c124a621db83d96894310cb079be20d942ebc45e'
BASE = 'docs/research/precision-gate-projection/2026-09-08/'
MODULE = 'src/Interp.Python/zeta_interp/precision_gate_projection_run.py'
TEST = 'src/Interp.Python/tests/test_precision_gate_projection_run.py'

def blob(pin, path):
    return subprocess.run(['git', '-C', str(REPO), 'show', pin + ':' + path], capture_output=True, check=True).stdout

def ident(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}

archives = {}
summary = []
for pin, group, count in ((OLD, 'run-draft-validation', 40), (PIN, 'run-followup-validation', 46)):
    manifest_raw = blob(pin, BASE + group + '/manifest.json')
    manifest = json.loads(manifest_raw)
    rows = manifest['Records']
    assert len(rows) == count
    raws = {}
    for row in rows:
        name = row['Stored']
        assert Path(name).name == name and row['RawBytes'] < 2**21
        packed = blob(pin, BASE + group + '/' + name)
        assert ident(packed) == {'Bytes': row['StoredBytes'], 'Sha256': row['StoredSha256']}
        decoder = zlib.decompressobj(31)
        raw = decoder.decompress(packed, row['RawBytes'] + 1)
        assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
        assert ident(raw) == {'Bytes': row['RawBytes'], 'Sha256': row['RawSha256']}
        original = REPO / row['Original']
        assert original.is_relative_to(REPO / '.git') and original.read_bytes() == raw
        assert row['Original'] not in raws
        raws[row['Original']] = raw
    archives[group] = raws
    commands = {n: json.loads(r) for n, r in raws.items() if n.endswith(('start.json', 'process.json'))}
    outputs = {n: {'Identity': ident(r), 'Tail': r.decode().splitlines()[-8:]} for n, r in raws.items() if n.endswith(('-stdout', '-stderr', '.log', '.txt'))}
    summary.append({'Group': group, 'Commit': pin, 'Manifest': ident(manifest_raw), 'Records': count, 'RawBytes': sum(r['RawBytes'] for r in rows), 'StoredBytes': sum(r['StoredBytes'] for r in rows), 'IncidentalPycacheRecords': sum(n.endswith('.pyc') for n in raws), 'Commands': commands, 'Outputs': outputs})
combined = archives['run-draft-validation'] | archives['run-followup-validation']
for index in range(1, 9):
    prefix = f'.git/projection-run-fixture-tests-{index}/'
    start = json.loads(combined[prefix + 'start.json'])
    raw = combined[prefix + 'dependency/precision_gate_projection_process.py']
    assert hashlib.sha256(raw).hexdigest() == start['DraftSha256']
for index, pin in ((4, OLD), (8, PIN)):
    for path in (MODULE, TEST):
        assert combined[f'.git/projection-run-fixture-tests-{index}/' + Path(path).name] == blob(pin, path)
def node(raw, name):
    rows = [n for n in ast.parse(raw).body if getattr(n, 'name', None) == name]
    assert len(rows) == 1
    return ast.dump(rows[0], include_attributes=False)
regression = combined['.git/projection-run-fixture-tests-5/precision_gate_projection_run.py']
old = blob(OLD, MODULE)
assert regression != old
for name in ('_Run', '_observe', 'reference_services'):
    assert node(regression, name) == node(old, name)
print(json.dumps({'OriginalSourceCut': OLD, 'CorrectedCut': PIN, 'Module': ident(blob(PIN, MODULE)), 'Tests': ident(blob(PIN, TEST)), 'Archives': summary, 'FailingAttemptWholeModuleDiffersFromOriginal': True, 'FailingAttemptOriginalAstMatches': ['_Run', '_observe', 'reference_services'], 'ProjectCodeExecuted': False, 'ActualNumericalServicesCalled': False, 'FinalRunAccepted': False}, indent=2))
