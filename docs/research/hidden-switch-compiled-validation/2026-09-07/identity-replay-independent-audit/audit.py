"""Read retained identity evidence only; no task imports, fixture or child execution."""
from pathlib import Path
import gzip
import hashlib
import io
import json
import os
import stat
import subprocess
import tarfile

ROOT = Path('/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906')
BASE = ROOT / 'docs/research/hidden-switch-compiled-validation/2026-09-07/identity-replay-attempt-1'
SOURCE = 'd3bd541e1d043e199c4b54b5390450028473c1cd'

def sha(raw):
    return hashlib.sha256(raw).hexdigest().upper()

def same(left, right):
    assert json.dumps(left, sort_keys=True, allow_nan=False) == json.dumps(right, sort_keys=True, allow_nan=False)

def fields(row, suffix=None):
    assert set(row) == {'Fields', 'Type'}
    if suffix is not None:
        assert row['Type'].endswith('.' + suffix)
    return row['Fields']

def rawbytes(row):
    assert set(row) == {'BytesHex'}
    return bytes.fromhex(row['BytesHex'])

manifest_raw = (BASE / 'manifest.json').read_bytes()
manifest = json.loads(manifest_raw)
assert manifest['SourceCommit'] == SOURCE
blobs = {}
stored_total = original_total = 0
for row in manifest['Artifacts']:
    stored = (BASE / row['File']).read_bytes()
    assert len(stored) == row['StoredBytes'] and sha(stored) == row['StoredSha256']
    raw = gzip.decompress(stored)
    assert len(raw) == row['Bytes'] and sha(raw) == row['Sha256']
    assert row['File'][:-3] not in blobs
    blobs[row['File'][:-3]] = raw
    stored_total += len(stored); original_total += len(raw)
for pin in manifest['SourceFiles']:
    raw = subprocess.check_output(['git', 'show', SOURCE + ':' + pin['File']], cwd=ROOT)
    assert len(raw) == pin['Bytes'] and sha(raw) == pin['Sha256']
    assert (ROOT / pin['File']).read_bytes() == raw

tree_results = []
for tree in manifest['OwnedTrees']:
    inventory = json.loads(blobs[tree['Inventory'][:-3]])
    assert inventory['OriginalRoot'] == tree['OriginalRoot']
    local_root = Path(tree['OriginalRoot'])
    assert local_root.is_relative_to(ROOT / '.git/compiled-identity-replay-development')
    counts = dict(RegularFiles=0, FileBytes=0, Symlinks=0, Directories=0)
    with tarfile.open(fileobj=io.BytesIO(blobs[tree['Archive'][:-3]]), mode='r:') as archive:
        members = archive.getmembers(); by_name = {m.name: m for m in members}
        assert len(members) == len(by_name) == len(inventory['Entries'])
        for row in inventory['Entries']:
            name = row['File']; assert not Path(name).is_absolute() and '..' not in Path(name).parts
            member = by_name[name]; local = local_root / name; info = local.lstat()
            assert info.st_mode == row['Mode'] and member.mode == stat.S_IMODE(info.st_mode)
            if row['Kind'] == 'regular':
                assert member.isfile() and stat.S_ISREG(info.st_mode)
                stream = archive.extractfile(member); assert stream is not None
                raw = stream.read()
                assert len(raw) == info.st_size == row['Bytes'] == member.size
                assert sha(raw) == row['Sha256'] and local.read_bytes() == raw
                counts['RegularFiles'] += 1; counts['FileBytes'] += len(raw)
            elif row['Kind'] == 'directory':
                assert member.isdir() and stat.S_ISDIR(info.st_mode); counts['Directories'] += 1
            elif row['Kind'] == 'symlink':
                assert member.issym() and stat.S_ISLNK(info.st_mode)
                assert member.linkname == row['Target'] == os.readlink(local); counts['Symlinks'] += 1
            else:
                raise AssertionError('unexpected inventory type')
    assert all(counts[key] == tree[key] for key in counts)
    tree_results.append(dict(Archive=tree['Archive'], **counts))

validation = json.loads(blobs['validation.json'])
assert validation['SourceCommit'] == SOURCE
assert validation['ProducerFixtureReturns'] == validation['ProducerCompletedOperations'] == 15
assert validation['ReplayCounts'] == dict(StartedFixtures=15, ReturnedFixtures=15, CompletedOperations=15, MatchedCases=15)
assert validation['NativeLaunches'] == validation['PolicyCalls'] == 0 and validation['RegisteredSourceGeneration'] is False
for pin in validation['CapturedPublicResultFiles']:
    raw = blobs[pin['File']]; assert len(raw) == pin['Bytes'] and sha(raw) == pin['Sha256']
assert len(validation['CapturedPublicResultFiles']) == 32
for pin in (*validation['ObservedLoadedSources'], *validation['SuppliedChildSources']):
    raw = (ROOT / pin['File']).read_bytes()
    assert len(raw) == pin['Bytes'] and sha(raw) == pin['Sha256']

result = fields(json.loads(blobs['complete-replay.json']), 'IdentityReplaySucceeded')
assert fields(result['Counts'], 'Counts') == validation['ReplayCounts']
assert result['Scope'] == 'fifteen-fixed-identity-cases-only'
assert result['OuterSourceAndRuntimeAdmission'] == 'not-performed'
records = json.loads(blobs['recorded-fixtures.json'])
same(result['Records'], records)
assert len(result['Cases']) == len(records) == len(validation['ProducerRoots']) == 15
codes = []
for index, item in enumerate(result['Cases']):
    case = fields(item, 'CaseReplay'); assert case['Matched'] is True
    record = fields(records[index], 'RecordedIdentityCase')
    producer = fields(json.loads(blobs[f'producer-fixture-{index:02d}.json']), 'FixtureReady')
    fresh_raw = json.loads(blobs[f'replayed-fixture-{index:02d}.json'])
    fresh = fields(fresh_raw, 'FixtureReady')
    actual = fields(case['Actual'], 'Observation'); assert actual['Raised'] is None
    same(actual['Returned'], fresh_raw)
    same(case['Recorded'], records[index]); same(record['Inputs'], producer['Inputs'])
    assert producer['CompletedOperation'] == fresh['CompletedOperation'] == 1
    assert case['CaseId'] == record['CaseId'] == producer['CaseId'] == fresh['CaseId'] == validation['CaseIds'][index]
    original_root = validation['ProducerRoots'][index]['Root']
    assert producer['Root'] == original_root and fresh['Root'] == case['ReplayRoot']
    association = fields(case['Association'], 'Association')
    assert association['ProducerRoot'] == original_root and association['ReplayRoot'] == fresh['Root']
    pc = fields(producer['Call'], 'CallResult'); fc = fields(fresh['Call'], 'CallResult')
    assert record['Operation'] == pc['Operation'] == fc['Operation']
    assert record['InputRoles'] == pc['InputRoles'] == fc['InputRoles'] == ['fixture', 'expected']
    same(json.loads(rawbytes(record['ResultRaw'])), pc['Result'])
    if index < 7:
        same(pc['Result'], fc['Result'])
        assert record['ChildArtifacts'] == case['ChildReads'] == []
        assert association['ProducerPid'] is None and association['ReplayPid'] is None
        code = fields(pc['Result']).get('code', 'admitted')
    else:
        po = fields(pc['Result'], 'PythonChildOutcome'); fo = fields(fc['Result'], 'PythonChildOutcome')
        assert association['ProducerPid'] == fields(po['Process'])['Pid'] > 0
        assert association['ReplayPid'] == fields(fo['Process'])['Pid'] > 0
        assert len(record['ChildArtifacts']) == len(case['ChildReads']) == 3
        for child, read, role, name in zip(record['ChildArtifacts'], case['ChildReads'], ('stdout', 'stderr', 'trace'), ('process-0001.stdout', 'process-0001.stderr', 'child-trace.jsonl'), strict=True):
            supplied = fields(child, 'NamedInput'); observed = fields(read, 'ChildRead')
            assert supplied['Role'] == observed['Role'] == role and observed['File'] == name
            assert rawbytes(supplied['Raw']) == (Path(original_root) / name).read_bytes()
            reading = fields(observed['Outcome'], 'Observation'); assert reading['Raised'] is None
            assert rawbytes(fields(reading['Returned'], 'Admitted')['value']) == (Path(fresh['Root']) / name).read_bytes()
        for root_label, observed in ((original_root, po), (fresh['Root'], fo)):
            root_path = Path(root_label)
            stdout = json.loads((root_path / 'process-0001.stdout').read_bytes())
            trace = [json.loads(line) for line in (root_path / 'child-trace.jsonl').read_bytes().splitlines()]
            assert len(trace) == 2 and trace[0]['Kind'] == 'collector-entry' and trace[1]['Kind'] == 'collector-return'
            assert trace[0]['CaseId'] == case['CaseId'] and trace[0]['Entry'] == trace[1]['Return'] == 1
            same(stdout['Result'], observed['CollectorResult']); same(trace[1]['Result'], observed['CollectorResult'])
            assert (root_path / 'process-0001.stderr').read_bytes() == b''
        code = fields(po['CollectorResult']).get('Code', 'admitted')
    codes.append(dict(CaseId=case['CaseId'], Outcome=code))
print(json.dumps({'EvidenceCommit': '5a75a5eb05518394450dfd3631d0e27523b456c9',
 'SourceCommit': SOURCE, 'ManifestBytes': len(manifest_raw), 'ManifestSha256': sha(manifest_raw),
 'Artifacts': len(blobs), 'StoredBytes': stored_total, 'OriginalBytes': original_total,
 'SourcePins': len(manifest['SourceFiles']), 'OwnedTrees': tree_results,
 'CaptureResultReferences': len(validation['CapturedPublicResultFiles']),
 'ObservedLoadedModulePins': len(validation['ObservedLoadedSources']),
 'SuppliedChildSourcePins': len(validation['SuppliedChildSources']),
 'ProducerCompletedOperations': 15, 'ReplayCounts': validation['ReplayCounts'], 'Cases': codes,
 'NoFixtureOrChildExecution': True, 'CompleteOuterAndRuntimeAdmission': False}, indent=2))
