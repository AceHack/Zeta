"""Audit immutable process preparation/correction bytes; no project execution."""
import ast
import hashlib
import json
from pathlib import Path
import subprocess
import zlib

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-predictor-native-20260906')
OLD = 'b575e34bd5cda05176ee14f89aedb2fa10edbb96'
PIN = '8254c827044100df1646369f1b0143ec994d5a07'
PREP = '929a7e13afc302aa5d9a79ae7943d1607bb08557'
EVIDENCE = '59e1867c98b3620ae0af2c96fb5740a0ac8cd904'
BASE = 'docs/research/precision-gate-projection/2026-09-08/'
MODULE = 'src/Interp.Python/zeta_interp/precision_gate_projection_process.py'
TEST = 'src/Interp.Python/tests/test_precision_gate_projection_process.py'

def blob(pin, path):
    return subprocess.run(['git', '-C', str(REPO), 'show', pin + ':' + path], capture_output=True, check=True).stdout

def ident(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}

def checked(raw, row, prefix=''):
    assert ident(raw) == {'Bytes': row[prefix + 'Bytes'], 'Sha256': row[prefix + 'Sha256']}

archives = {}
summary = []
for cut, source, group, count in ((PREP, OLD, 'process-preparation-1', 66), (EVIDENCE, PIN, 'process-correction-1', 52)):
    manifest_raw = blob(cut, BASE + group + '/manifest.json')
    manifest = json.loads(manifest_raw)
    assert manifest['SourceCommit'] == source and len(manifest['Records']) == count
    raws = {}
    for row in manifest['Records']:
        name = row['File']
        assert Path(name).name == name and row['Bytes'] < 2**21
        packed = blob(cut, BASE + group + '/' + name)
        checked(packed, row, 'Stored')
        decoder = zlib.decompressobj(31)
        raw = decoder.decompress(packed, row['Bytes'] + 1)
        assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
        checked(raw, row)
        original = Path(row['OriginalPath'])
        assert original.is_relative_to(REPO / '.git') and original.read_bytes() == raw
        assert str(original) not in raws
        raws[str(original)] = raw
    assert len(manifest['Sources']) == 14
    for row in manifest['Sources']:
        checked(blob(source, row['Path']), row)
    archives[group] = raws
    summary.append({'Group': group, 'EvidenceCut': cut, 'SourceCut': source, 'Manifest': ident(manifest_raw), 'Records': count, 'RawBytes': sum(r['Bytes'] for r in manifest['Records']), 'StoredBytes': sum(r['StoredBytes'] for r in manifest['Records']), 'SourcePins': manifest['Sources'], 'CommandsAndMetadata': {n: json.loads(r) for n, r in raws.items() if n.endswith('.json')}, 'Outputs': {n: {'Identity': ident(r), 'Tail': r.decode().splitlines()[-8:]} for n, r in raws.items() if n.endswith(('stdout', 'stderr'))}})
for group, number, pin in (('process-preparation-1', 3, OLD), ('process-correction-1', 4, PIN)):
    for path in (MODULE, TEST):
        assert archives[group][str(REPO / f'.git/precision-projection-process-tests-{number}' / Path(path).name)] == blob(pin, path)
for kind in ('reader', 'receipt'):
    original = str(REPO / f'.git/precision-projection-process-{kind}-finding-1/precision_gate_projection_process.py')
    assert archives['process-correction-1'][original] == blob(OLD, MODULE)

def node(raw, name):
    rows = [n for n in ast.parse(raw).body if getattr(n, 'name', None) == name]
    assert len(rows) == 1
    return ast.dump(rows[0], include_attributes=False)
shared = ['ProcessFailure','FileIdentity','FileObservation','DependencyObservation','PreparedNative','NativeObservation','prepare_native','_admit_command','_bindings_bytes']
for name in shared:
    assert node(blob(OLD, MODULE), name) == node(blob(PIN, MODULE), name)
unchanged_native = ['src/Bayesian/PrecisionGateProjection.fs','src/Research.FSharp/PrecisionGateProjectionReplay.fsx']
for path in unchanged_native:
    assert blob(OLD, path) == blob(PIN, path)
print(json.dumps({'OriginalSourceCut': OLD, 'AcceptedCorrectionCut': PIN, 'CorrectionEvidenceCut': EVIDENCE, 'Module': ident(blob(PIN, MODULE)), 'Tests': ident(blob(PIN, TEST)), 'UnchangedDefinitions': shared, 'UnchangedNativePaths': unchanged_native, 'Archives': summary, 'ProjectCodeExecuted': False, 'FinalNumericalRunExecuted': False, 'CorrectedFullGateClaimed': False}, indent=2))
