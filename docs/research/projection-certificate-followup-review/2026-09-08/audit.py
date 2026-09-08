"""Read pinned source and custody only; execute no project or numerical code."""
import ast
import hashlib
import json
from pathlib import Path
import subprocess
import zlib

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906')
OLD = '51a96fa11bd7590af3d5ed45b6fb6ebfdca414fe'
RETURN = 'de7237aebc6694d285f0ddcd11fd6b085a11a017'
PIN = 'ae37ac066cd1e0e9e3181cfd0f4f4214dac77a77'
BASE = 'docs/research/precision-gate-projection-reference-validation/2026-09-08/'
MODULE = 'src/Interp.Python/zeta_interp/precision_gate_projection_reference.py'
TEST = 'src/Interp.Python/tests/test_precision_gate_projection_reference.py'

def blob(pin, path):
    return subprocess.run(['git', '-C', str(REPO), 'show', pin + ':' + path], capture_output=True, check=True).stdout

def ident(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}

def checked(raw, row, prefix=''):
    assert ident(raw) == {'Bytes': row[prefix + 'Bytes'], 'Sha256': row[prefix + 'Sha256']}

archives = {}
summary = []
for cut, group, expected in ((RETURN, 'root-return', 27), (PIN, 'trace', 54)):
    manifest_raw = blob(cut, BASE + group + '/manifest.json')
    manifest = json.loads(manifest_raw)
    assert len(manifest) == expected
    raws = {}
    for row in manifest:
        name = row['Stored']
        assert Path(name).name == name and name not in raws and row['Bytes'] < 2**21
        packed = blob(cut, BASE + group + '/' + name)
        checked(packed, row, 'Stored')
        decoder = zlib.decompressobj(31)
        raw = decoder.decompress(packed, row['Bytes'] + 1)
        assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
        checked(raw, row)
        path = REPO / row['Original']
        assert path.is_relative_to(REPO / '.git') and path.read_bytes() == raw
        raws[name] = raw
    tables = []
    for name, raw in raws.items():
        if name.endswith('sources.json.gz'):
            prefix = name.removesuffix('sources.json.gz')
            rows = json.loads(raw)
            for index, row in enumerate(rows):
                checked(raws[prefix + f'source-{index}.gz'], row)
            tables.append({'File': name, 'Rows': rows})
    archives[group] = raws
    commands = {n: json.loads(r) for n, r in raws.items() if n.endswith(('commands.json.gz', 'command.json.gz'))}
    outputs = {n: {'Identity': ident(r), 'LastLines': r.decode().splitlines()[-7:]} for n, r in raws.items() if n.endswith(('stdout.gz', 'stderr.gz'))}
    summary.append({'Group': group, 'Commit': cut, 'Manifest': ident(manifest_raw), 'Records': expected, 'RawBytes': sum(r['Bytes'] for r in manifest), 'StoredBytes': sum(r['StoredBytes'] for r in manifest), 'Tables': tables, 'Commands': commands, 'Outputs': outputs})
for group, prefix, cut in (('root-return', '03-', RETURN), ('trace', '06-', PIN)):
    for index, path in enumerate((MODULE, TEST)):
        assert archives[group][f'{prefix}source-{index}.gz'] == blob(cut, path)
assert archives['root-return']['01-source.py.gz'] == blob(OLD, MODULE)
assert archives['trace']['01-source.py.gz'] == blob(RETURN, MODULE)

def function(raw, name):
    matches = [n for n in ast.parse(raw).body if getattr(n, 'name', None) == name]
    assert len(matches) == 1
    return ast.dump(matches[0], include_attributes=False)
root_names = ['_Root', '_take', '_input', '_caller', 'reference_root']
for name in root_names:
    assert function(blob(OLD, MODULE), name) == function(blob(PIN, MODULE), name)
result = {'OriginalCertificateCut': OLD, 'RootReturnCorrection': RETURN, 'FinalCut': PIN, 'Module': ident(blob(PIN, MODULE)), 'Tests': ident(blob(PIN, TEST)), 'RootAstUnchangedFromAcceptedCut': root_names, 'Archives': summary, 'ProjectCodeExecuted': False, 'NumericalRosterExecuted': False}
print(json.dumps(result, indent=2))
