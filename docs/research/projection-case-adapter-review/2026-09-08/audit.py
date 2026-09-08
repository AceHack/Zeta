"""Read exact adapter literals and retained checks without running the adapter."""

import ast
import hashlib
import json
from pathlib import Path
import subprocess
import zlib


WRITER = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
PIN = '2ba65308e6e0a520634c8a8bac49aa4f0c925b3a'
CONTRACT = '1bf71bbac7f6896216c7079abd4e99b7c79e2870'
BASE = 'docs/research/precision-gate-projection/2026-09-08/case-adapter-validation/'
OUT = Path(__file__).resolve().parent


def blob(path, pin=PIN):
    return subprocess.run(['git', 'show', pin + ':' + path], cwd=WRITER,
                          capture_output=True, check=True).stdout


def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}


def check(raw, size, sha):
    assert len(raw) == size and hashlib.sha256(raw).hexdigest() == sha


manifest_raw = blob(BASE + 'manifest.json')
manifest = json.loads(manifest_raw)
rows, contents = [], {}
for row in manifest['Artifacts']:
    stored = blob(BASE + row['File'])
    check(stored, row['StoredBytes'], row['StoredSha256'])
    decoder = zlib.decompressobj(31)
    raw = decoder.decompress(stored, row['Bytes'] + 1)
    assert decoder.eof and not decoder.unconsumed_tail and not decoder.unused_data
    check(raw, row['Bytes'], row['Sha256'])
    assert raw == (WRITER / row['OriginalPath']).read_bytes()
    contents[row['OriginalPath']] = raw
    rows.append({**row, 'StoredRawOriginalMatch': True})
assert len(rows) == 14
sources = []
for row in manifest['SourceIdentitiesAtPassingAttempt']:
    check(blob(row['Path']), row['Bytes'], row['Sha256'])
    sources.append({**row, 'CommittedSourceMatches': True})
assert len(sources) == 5

source = blob('src/Interp.Python/zeta_interp/precision_gate_projection_cases.py')
tree = ast.parse(source)
assignments = {node.targets[0].id: node.value for node in tree.body
               if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)}
cstar = ast.literal_eval(assignments['CSTAR'])


def case(node):
    assert isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    assert node.func.id == 'Case' and not node.keywords
    values = [cstar if isinstance(arg, ast.Name) and arg.id == 'CSTAR'
              else ast.literal_eval(arg) for arg in node.args]
    assert len(values) in (6, 7) and all(type(value) is str for value in values)
    return dict(zip(('Id', 'T', 'U', 'K', 'C', 'Class', 'Profile'),
                    values if len(values) == 7 else [*values, 'default'], strict=True))


base = [case(node) for node in assignments['BASE_CASES'].elts]
reference = case(assignments['REFERENCE_LIMIT'])
wire = ast.literal_eval(assignments['WIRE_IDS'])
certificate = ast.literal_eval(assignments['CERTIFICATE_IDS'])
contract_raw = blob('docs/research/2026-09-08-precision-gate-projection-proposed-contract.md', CONTRACT)
contract = contract_raw.decode()
assert cstar in contract
table = []
for line in contract.splitlines():
    if not line.startswith('| ') or not any(line.startswith('| ' + prefix)
            for prefix in ('core/', 'stress/', 'limit/native-', 'domain/')):
        continue
    parts = [part.strip() for part in line.strip('|').split('|')]
    assert len(parts) == 6
    table.append(parts)
assert len(base) == len(table) == 21
for actual, expected in zip(base, table, strict=True):
    assert actual['Id'] == expected[0]
    target = expected[1:5]
    if actual['Id'] == 'limit/native-midpoints':
        target = ['1', '0', '0', '1']
        assert actual['Profile'] == 'native-one'
    elif actual['Id'] == 'core/rounded-center':
        target[-1] = cstar
    assert [actual[key] for key in ('T', 'U', 'K', 'C')] == target
    if actual['Id'] != 'limit/native-midpoints':
        assert actual['Profile'] == 'default'
    assert actual['Class'] == actual['Id'].split('/')[0]
assert reference == {'Id': 'limit/reference-midpoints', 'T': '1', 'U': '0',
                     'K': '0', 'C': '1', 'Class': 'limit', 'Profile': 'reference-one'}
assert len(wire) == 6 and len(certificate) == 12
for name in (*wire, *certificate):
    assert name in contract
all_ids = [row['Id'] for row in base] + [reference['Id'], *wire, *certificate]
assert len(all_ids) == len(set(all_ids)) == 40
calls = [(row['Id'], operation) for row in base
         for operation in ('NativeSolve', 'ReferenceRoot', 'CertifyNative')]
calls += [(reference['Id'], 'ReferenceRoot')]
calls += [(name, operation) for name in wire for operation in ('NativeSolve', 'ReferenceRoot')]
calls += [(name, 'CertifyNative') for name in certificate]
assert len(calls) == 88
observed = {name: raw.decode() for name, raw in contents.items()
            if name.endswith(('.json', '.stdout', '.stderr', '.log'))}
assert any('31 passed in 5.65s' in text for text in observed.values())
assert any('No module named pytest' in text for text in observed.values())
result = {'SourceCommit': PIN, 'ContractCommit': CONTRACT,
          'ContractIdentity': identity(contract_raw), 'ArchiveManifest': identity(manifest_raw),
          'Archive': rows, 'OriginalBytes': sum(row['Bytes'] for row in rows),
          'StoredBytes': sum(row['StoredBytes'] for row in rows),
          'SourcesAtPassingAttempt': sources,
          'ExactBaseLiterals': base, 'ReferenceControl': reference,
          'WireIds': wire, 'CertificateIds': certificate,
          'StaticExpectedCallPlan': calls, 'OriginalChecks': observed,
          'AdapterOrNumericalExecutionByReviewer': False}
with (OUT / 'audit-observation.json').open('x') as stream:
    json.dump(result, stream, indent=2)
    stream.write('\n')
print(json.dumps({'Records': len(rows), 'SourcePins': len(sources), 'Ids': len(all_ids),
                  'PlannedCalls': len(calls), 'RawBytes': result['OriginalBytes'],
                  'StoredBytes': result['StoredBytes']}))
