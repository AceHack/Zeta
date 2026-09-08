"""Verify retained interval-source records without importing or executing them."""

import ast
import hashlib
import json
from pathlib import Path
import subprocess
import zlib


WRITER = Path('/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906')
PIN = '9f0d5ca7c7bf18a9df02b5061ce5665253ce559b'
BASE = 'docs/research/precision-gate-projection-reference-validation/2026-09-08/intervals/'
OUT = Path(__file__).resolve().parent


def blob(path):
    return subprocess.run(['git', 'show', PIN + ':' + path], cwd=WRITER,
                          capture_output=True, check=True).stdout


def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}


def check(raw, size, sha):
    assert len(raw) == size and hashlib.sha256(raw).hexdigest() == sha


manifest_raw = blob(BASE + 'manifest.json')
manifest = json.loads(manifest_raw)
assert len(manifest['Records']) == 31
rows = []
originals = {}
for row in manifest['Records']:
    stored = blob(BASE + row['Stored'])
    check(stored, row['StoredBytes'], row['StoredSha256'])
    decoder = zlib.decompressobj(31)
    raw = decoder.decompress(stored, row['RawBytes'] + 1)
    assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
    check(raw, row['RawBytes'], row['RawSha256'])
    assert raw == (WRITER / row['Original']).read_bytes()
    originals[row['Stored'].removesuffix('.gz')] = raw
    rows.append({**row, 'StoredRawOriginalMatch': True})

assert sum(row['RawBytes'] for row in rows) == 57104
sources = []
for row in json.loads(originals['attempt-2-sources.json']):
    raw = originals['attempt-2-' + row['Copy']]
    check(raw, row['Bytes'], row['Sha256'])
    assert raw == blob(row['Path'])
    sources.append({**row, 'ExecutedCopyMatchesCommittedSource': True})
initial = originals['attempt-1-source-0']
final = originals['attempt-2-source-0']
assert ast.dump(ast.parse(initial)) == ast.dump(ast.parse(final))
processes = {}
for attempt in (1, 2):
    for name in ('pytest', 'mypy', 'ruff', 'format'):
        stem = f'attempt-{attempt}-{name}'
        process = json.loads(originals[stem + '.json'])
        processes[stem] = {
            'Process': process,
            'Stdout': originals[stem + '.stdout'].decode(),
            'Stderr': originals[stem + '.stderr'].decode(),
        }
        expected = 1 if attempt == 1 and name in ('ruff', 'format') else 0
        assert process['ExitCode'] == expected
assert '41 passed in 4.21s' in processes['attempt-1-pytest']['Stdout']
assert '42 passed in 4.13s' in processes['attempt-2-pytest']['Stdout']
assert 'BLE001' in processes['attempt-1-ruff']['Stdout']

result = {
    'SourceCommit': PIN, 'Manifest': identity(manifest_raw),
    'Records': rows, 'OriginalBytes': sum(row['RawBytes'] for row in rows),
    'StoredBytes': sum(row['StoredBytes'] for row in rows),
    'SourceIdentities': sources, 'InitialFinalSourceAstEqual': True,
    'OriginalProcesses': processes, 'ReviewerNumericalExecution': False,
}
with (OUT / 'audit-observation.json').open('x') as stream:
    json.dump(result, stream, indent=2)
    stream.write('\n')
print(json.dumps({'Records': len(rows), 'SourceRows': len(sources),
                  'OriginalBytes': result['OriginalBytes'], 'StoredBytes': result['StoredBytes'],
                  'InitialFinalSourceAstEqual': True}))
