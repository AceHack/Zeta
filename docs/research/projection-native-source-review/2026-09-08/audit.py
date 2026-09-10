"""Read immutable Git blobs and retained custody only; no project imports or runs."""
import zlib
import hashlib
import json
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-predictor-native-20260906')
SOURCE = 'bf2da44b94e770d21add73ce53dacb8fb34259bf'
EVIDENCE = 'cb0e899b0527d85b0d86f4e99288b64bb854b109'
BASE = 'docs/research/precision-gate-projection/2026-09-08/'

def blob(pin, path):
    return subprocess.run(['git', '-C', str(REPO), 'show', f'{pin}:{path}'], check=True, capture_output=True).stdout

def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}

def unpack(packed, size):
    decoder = zlib.decompressobj(31)
    raw = decoder.decompress(packed, size + 1)
    assert len(raw) == size and decoder.eof
    assert not decoder.unused_data and not decoder.unconsumed_tail
    return raw

def check(raw, row, prefix=''):
    assert identity(raw) == {'Bytes': row[prefix + 'Bytes'], 'Sha256': row[prefix + 'Sha256']}

manifest_raw = blob(EVIDENCE, BASE + 'native-preparation-2/manifest.json')
manifest = json.loads(manifest_raw)
assert manifest['SourceCommit'] == SOURCE
assert len(manifest['Records']) == 86 and len(manifest['Sources']) == 14
assert manifest['FinalRegisteredComparisonRun'] is False and manifest['ReferenceOutputsRead'] is False
raws = {}
for index, row in enumerate(manifest['Records'], 1):
    assert row['Index'] == index and row['File'] not in raws
    assert Path(row['File']).name == row['File'] and row['Bytes'] <= 2**21
    packed = blob(EVIDENCE, BASE + 'native-preparation-2/' + row['File'])
    check(packed, row, 'Stored')
    raw = unpack(packed, row['Bytes'])
    check(raw, row)
    original = Path(row['OriginalPath'])
    assert original.is_relative_to(REPO / '.git')
    assert original.read_bytes() == raw
    raws[row['File']] = raw
for row in manifest['Sources']:
    check(blob(SOURCE, row['Path']), row)

first_raw = blob(EVIDENCE, BASE + 'native-preparation-1/manifest.json')
first = json.loads(first_raw)
assert first['Complete'] is False and first['Failure']['ExitCode'] == 1
for row in first['Records']:
    packed = blob(EVIDENCE, BASE + 'native-preparation-1/' + row['File'])
    check(packed, row, 'Stored')
    check(unpack(packed, row['Bytes']), row)

def one(suffix):
    matches = [raw for name, raw in raws.items() if name.endswith(suffix)]
    assert len(matches) == 1, suffix
    return matches[0]

observations = []
for name in ('native-build-1', 'native-build-2', 'native-tests-1', 'native-tests-2', 'native-tests-3', 'native-tests-4', 'replay-startup-1', 'replay-startup-2'):
    prefix = 'precision-projection-' + name
    invocation = json.loads(one(prefix + '-invocation.json.gz'))
    completion = json.loads(one(prefix + '-completion.json.gz'))
    stdout, stderr = (one(prefix + '-' + stream + '.gz') for stream in ('stdout', 'stderr'))
    observations.append({'Name': name, 'Invocation': invocation, 'Completion': completion, 'Stdout': identity(stdout), 'Stderr': identity(stderr)})
trx_results = []
for attempt, expected in ((2, 29), (4, 34)):
    root = ET.fromstring(one(f'precision-projection-native-tests-{attempt}-projection.trx.gz'))
    ns = {'t': 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010'}
    counters = root.find('t:ResultSummary/t:Counters', ns).attrib
    results = root.findall('t:Results/t:UnitTestResult', ns)
    assert len(results) == expected and all(r.attrib['outcome'] == 'Passed' for r in results)
    assert int(counters['total']) == int(counters['passed']) == expected
    trx_results.append({'Attempt': attempt, 'Counters': counters, 'ActualPassedRows': len(results)})

for file, path in [('PrecisionGateProjection.fs', 'src/Bayesian/PrecisionGateProjection.fs'), ('PrecisionGateProjection.Tests.fs', 'tests/Bayesian.Tests/PrecisionGateProjection.Tests.fs')]:
    assert one('precision-projection-native-tests-4-' + file + '.gz') == blob(SOURCE, path)
replay_source = blob(SOURCE, 'src/Research.FSharp/PrecisionGateProjectionReplay.fsx')
assert one('precision-projection-replay-startup-2-PrecisionGateProjectionReplay.fsx.gz') == replay_source
replay_test = one('precision-projection-native-tests-4-PrecisionGateProjectionReplay.fsx.gz')
# Only the previously uncompiled INTERACTIVE main qualification changed after the linked tests.
assert (replay_test.replace(b'let stdout = Console.OpenStandardOutput()', b'let stdout = System.Console.OpenStandardOutput()').replace(b'\nEnvironment.Exit exitCode', b'\nSystem.Environment.Exit exitCode')) == replay_source
startup = json.loads(one('precision-projection-replay-startup-2-stdout.gz'))
assert startup['Complete'] is False and startup['Failure']['Code'] == 'Arguments'
assert startup['ReceiptAvailable'] is False and startup['Counters'] is None
assert startup['InputFiles'] == startup['AssemblyFiles'] == [] and startup['Cleanup'] == []
assert one('precision-projection-replay-startup-2-stderr.gz') == b''
result = {'SourceCommit': SOURCE, 'EvidenceCommit': EVIDENCE, 'Manifest': identity(manifest_raw), 'Records': len(raws), 'OriginalBytes': sum(len(r) for r in raws.values()), 'StoredBytes': sum(r['StoredBytes'] for r in manifest['Records']), 'SourcePins': manifest['Sources'], 'IncompleteFirstManifest': identity(first_raw), 'IncompleteFirstRecords': len(first['Records']), 'ObservedCommands': observations, 'TestResults': trx_results, 'CorrectedStartup': startup, 'ProjectCodeExecutedByAudit': False, 'FinalComparisonPerformedByAudit': False}
print(json.dumps(result, indent=2, ensure_ascii=True))
