"""Verify retained driver validation only; never import or execute task modules."""
import ast
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zlib

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906')
PIN, FOLDER = sys.argv[1:]
BASE = 'docs/research/precision-gate-projection/2026-09-08/' + FOLDER


def blob(pin, path):
    return subprocess.check_output(['git', '-C', str(REPO), 'show', pin + ':' + path])


def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest().upper()}


manifest_raw = blob(PIN, BASE + '/manifest.json')
manifest = json.loads(manifest_raw)
records = {}
stored_total = 0
for row in manifest['Records']:
    name = row['Stored']
    assert name not in records and Path(name).name == name
    stored = blob(PIN, BASE + '/' + name)
    assert identity(stored) == {'Bytes': row['StoredBytes'], 'Sha256': row['StoredSha256']}
    decoder = zlib.decompressobj(31)
    raw = decoder.decompress(stored, row['Bytes'] + 1)
    assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
    assert identity(raw) == {'Bytes': row['Bytes'], 'Sha256': row['Sha256']}
    assert (REPO / row['Original']).read_bytes() == raw
    records[name] = (row['Original'], raw)
    stored_total += len(stored)
assert len(records) == manifest['RecordCount']
assert sum(len(raw) for _, raw in records.values()) == manifest['RawBytes']
assert stored_total == manifest['StoredBytes']
for row in manifest['CurrentOwnedFiles']:
    assert identity(blob(PIN, row['Path'])) == {k: row[k] for k in ('Bytes', 'Sha256')}
summary = {
    'Pin': PIN, 'Manifest': identity(manifest_raw), 'Records': len(records),
    'RawBytes': manifest['RawBytes'], 'StoredBytes': stored_total,
    'EveryStoredRawAndLocalOriginalMatches': True,
    'OwnedFiles': manifest['CurrentOwnedFiles'],
    'CapturedCommands': [], 'CapturedGateSummaries': [],
}
for name, (original, raw) in records.items():
    if original.endswith(('commands.json', 'command.json')):
        summary['CapturedCommands'].append({'Record': name, 'Observed': json.loads(raw)})
    if original.endswith(('pytest.stdout', 'mypy.stdout', 'ruff.stdout', 'format.stdout')):
        lines = raw.decode().splitlines()
        summary['CapturedGateSummaries'].append({'Record': name, 'Tail': lines[-3:]})
if FOLDER == 'driver-source-validation':
    source_path = 'src/Interp.Python/zeta_interp/precision_gate_projection_driver.py'
    test_path = 'src/Interp.Python/tests/test_precision_gate_projection_driver.py'
    source = blob(PIN, source_path)
    assert records['036-source.py.gz'][1] == source
    assert records['037-test.py.gz'][1] == blob(PIN, test_path)
    module = ast.parse(source)
    roster = next(ast.literal_eval(node.value) for node in module.body
                  if isinstance(node, ast.Assign)
                  and any(isinstance(t, ast.Name) and t.id == 'SOURCE_PATHS' for t in node.targets))
    assert len(roster) == len(set(roster)) == 47
    observed = json.loads(records['042-stdout.json.gz'][1])
    rows = observed['LocalModules']
    expected_modules = [p for p in roster if p.startswith('src/Interp.Python/zeta_interp/')]
    assert len(rows) == len(expected_modules) == 14
    for row, path in zip(rows, expected_modules):
        assert row['File'] == row['Origin'] == str(REPO / path)
        assert identity(blob(PIN, path)) == {k: row[k] for k in ('Bytes', 'Sha256')}
    for row in json.loads(records['045-dependency-equality.json.gz'][1]):
        data = blob(PIN, row['Path'])
        assert data == blob(row['Pin'], row['Path'])
        assert identity(data) == {k: row[k] for k in ('Bytes', 'Sha256')}
    summary.update(ExactSourceRoster=list(roster), MatchingLocalModuleObservations=14,
                   UnchangedDependencyFiles=6, FinalTestSourceMatchesPin=True)
print(json.dumps(summary, indent=2))
