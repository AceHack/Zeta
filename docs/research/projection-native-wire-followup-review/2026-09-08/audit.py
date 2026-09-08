"""Verify retained native wire records without executing project code."""
import hashlib
import json
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET
import zlib

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-predictor-native-20260906')
OLD = 'bf2da44b94e770d21add73ce53dacb8fb34259bf'
SOURCE = 'e3b87af8f33f09476e939ebbc4f78360c3aa7d1d'
PIN = '763578f7b91bdd2b720b6c7f16da5e12d2597c32'
BASE = 'docs/research/precision-gate-projection/2026-09-08/native-surrogate-1/'
MODULE = 'src/Bayesian/PrecisionGateProjection.fs'
TEST = 'tests/Bayesian.Tests/PrecisionGateProjection.Tests.fs'
REPLAY = 'src/Research.FSharp/PrecisionGateProjectionReplay.fsx'

def blob(pin, path):
    return subprocess.run(['git', '-C', str(REPO), 'show', pin + ':' + path], capture_output=True, check=True).stdout

def ident(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}

def checked(raw, row, prefix=''):
    assert ident(raw) == {'Bytes': row[prefix + 'Bytes'], 'Sha256': row[prefix + 'Sha256']}

manifest_raw = blob(PIN, BASE + 'manifest.json')
manifest = json.loads(manifest_raw)
assert manifest['SourceCommit'] == SOURCE and manifest['HistoricalSourceCommit'] == OLD
assert len(manifest['Records']) == 16 and manifest['FinalComparisonRun'] is False
raws = {}
for row in manifest['Records']:
    name = row['File']
    assert Path(name).name == name and row['Bytes'] < 2**21
    packed = blob(PIN, BASE + name)
    checked(packed, row, 'Stored')
    decoder = zlib.decompressobj(31)
    raw = decoder.decompress(packed, row['Bytes'] + 1)
    assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
    checked(raw, row)
    original = Path(row['OriginalPath'])
    assert original.is_relative_to(REPO / '.git') and original.read_bytes() == raw
    key = original.parent.name + '/' + original.name
    assert key not in raws
    raws[key] = raw
observations = []
ns = {'t': 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010'}
for number, expected_exit, total, passed in ((1, 1, 1, 0), (2, 0, 41, 41)):
    prefix = f'precision-projection-native-surrogate-{number}/'
    invocation = json.loads(raws[prefix + 'invocation.json'])
    completion = json.loads(raws[prefix + 'completion.json'])
    assert completion['ExitCode'] == expected_exit
    for row in invocation['Sources']:
        checked(raws[prefix + Path(row['Path']).name], row)
    if number == 1:
        assert raws[prefix + Path(MODULE).name] == blob(OLD, MODULE)
    else:
        for path in (MODULE, TEST):
            assert raws[prefix + Path(path).name] == blob(SOURCE, path)
        assert raws[prefix + 'stderr'] == b''
    trxs = [raw for name, raw in raws.items() if name.startswith(prefix) and name.endswith('.trx')]
    assert len(trxs) == 1
    document = ET.fromstring(trxs[0])
    counters = document.find('t:ResultSummary/t:Counters', ns).attrib
    assert int(counters['total']) == total and int(counters['executed']) == total
    assert int(counters['passed']) == passed and int(counters['failed']) == total - passed
    results = document.findall('t:Results/t:UnitTestResult', ns)
    assert len(results) == total
    assert sum(row.attrib['outcome'] == 'Passed' for row in results) == passed
    failures = [row.find('t:Output/t:ErrorInfo/t:Message', ns).text for row in results if row.attrib['outcome'] != 'Passed']
    observations.append({'Number': number, 'Invocation': invocation, 'Completion': completion, 'TrxCounters': counters, 'TrxResults': [r.attrib for r in results], 'FailureMessages': failures, 'Stdout': ident(raws[prefix + 'stdout']), 'Stderr': ident(raws[prefix + 'stderr'])})
old, new = blob(OLD, MODULE), blob(SOURCE, MODULE)
start = b'    let private stringField '
end = b'    let private admitInput '
def split(raw):
    before, remaining = raw.split(start, 1)
    middle, after = remaining.split(end, 1)
    return before, middle, after
assert split(old)[::2] == split(new)[::2]
assert blob(OLD, REPLAY) == blob(SOURCE, REPLAY)
gate = json.loads(raws['.git/precision-projection-native-surrogate-doc-gate-1.json'])
checked(raws['.git/precision-projection-native-surrogate-doc-gate-1.md'], gate)
print(json.dumps({'SourceCommit': SOURCE, 'EvidenceCommit': PIN, 'HistoricalSourceCommit': OLD, 'Manifest': ident(manifest_raw), 'Records': len(manifest['Records']), 'RawBytes': sum(r['Bytes'] for r in manifest['Records']), 'StoredBytes': sum(r['StoredBytes'] for r in manifest['Records']), 'Module': ident(new), 'Tests': ident(blob(SOURCE, TEST)), 'OnlyStringFieldChanged': True, 'ReplayUnchanged': ident(blob(SOURCE, REPLAY)), 'Observations': observations, 'DocGateToolObservation': gate, 'ProjectCodeExecuted': False, 'FinalRosterExecuted': False}, indent=2))
