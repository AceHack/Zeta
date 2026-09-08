"""Read retained evidence only; no task-module import or fixture execution."""
from pathlib import Path
import gzip
import hashlib
import io
import json
import os
import stat
import subprocess
import tarfile

ROOT = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
BASE = ROOT / 'docs/research/hidden-switch-compiled-validation/2026-09-07/file-replay'
SOURCE = 'e6238f8acc89c4d619c6631f0cb0111aa9258c20'
CASES = ('artifact/symlink-path', 'artifact/truncated-gzip', 'storage/control',
         'storage/reused-attempt', 'storage/reused-file', 'storage/partial-write',
         'storage/changed-read')

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
blobs = {}
stored_total = raw_total = original_matches = 0
for row in manifest['Artifacts']:
    stored = (BASE / row['File']).read_bytes()
    assert len(stored) == row['StoredBytes'] and sha(stored) == row['StoredSha256']
    raw = gzip.decompress(stored)
    assert len(raw) == row['Bytes'] and sha(raw) == row['Sha256']
    assert row['Source'] not in blobs
    blobs[row['Source']] = raw
    stored_total += len(stored)
    raw_total += len(raw)
    original = ROOT / '.git' / row['Source']
    if original.is_file():
        assert original.read_bytes() == raw
        original_matches += 1
    if row['Source'].startswith('actual-store/'):
        actual = ROOT / '.git/compiled-file-replay-actual-1' / row['Source'].split('/', 1)[1]
        assert actual.read_bytes() == raw
        original_matches += 1

source_versions = 0
for group in manifest['SourceGroups']:
    for row in group['Files']:
        raw = subprocess.check_output(['git', 'show', group['SourceCommit'] + ':' + row['File']], cwd=ROOT)
        assert len(raw) == row['Bytes'] and sha(raw) == row['Sha256']
        assert blobs[group['SourceCommit'][:8] + '/' + Path(row['File']).name] == raw
        source_versions += 1

inventory_entries = regular_bytes = 0
for tree in manifest['FixtureTrees']:
    name = tree['Name']
    rows = json.loads(blobs[name + '-inventory.json'])
    assert len(rows) == tree['Entries']
    assert sum(row['Bytes'] for row in rows if row['Kind'] == 'regular') == tree['RegularBytes']
    with tarfile.open(fileobj=io.BytesIO(blobs[name + '-retained.tar']), mode='r:') as archive:
        members = archive.getmembers()
        by_name = {member.name: member for member in members}
        assert len(by_name) == len(members) == len(rows) + 1
        assert by_name[name].isdir()
        for row in rows:
            relative = row['File']
            assert not Path(relative).is_absolute() and '..' not in Path(relative).parts
            member = by_name[name + '/' + relative]
            local = ROOT / '.git' / name / relative
            info = local.lstat()
            kind = 'regular' if stat.S_ISREG(info.st_mode) else 'directory' if stat.S_ISDIR(info.st_mode) else 'symlink' if stat.S_ISLNK(info.st_mode) else 'other'
            assert kind == row['Kind'] and stat.S_IMODE(info.st_mode) == row['Mode'] == member.mode
            assert info.st_size == row['Bytes']
            if kind == 'regular':
                assert member.isfile() and member.size == row['Bytes']
                reader = archive.extractfile(member)
                assert reader is not None
                data = reader.read()
                assert sha(data) == row['Sha256'] and local.read_bytes() == data
                regular_bytes += len(data)
            elif kind == 'directory':
                assert member.isdir()
            elif kind == 'symlink':
                assert member.issym() and member.linkname == row['Target'] == os.readlink(local)
            else:
                assert stat.S_ISFIFO(info.st_mode) and member.isfifo() and member.size == 0
                # The two retained FIFO refusal fixtures are metadata only; never open them.
            inventory_entries += 1

receipt = json.loads(blobs['compiled-file-replay-actual-1-receipt.json'])
assert receipt['SourceCommit'] == SOURCE and receipt['Failure'] is None
assert (receipt['ProducerOperations'], receipt['ReplayOperations'], receipt['MatchedCases']) == (11, 11, 7)
final = fields(receipt['StoreFinalization'], 'Finalized')
assert len(receipt['Calls']) == 56
role_values = {}
role_bytes = {}
store_return_bytes = 0
for index, row in enumerate(receipt['Calls']):
    pin = row['ActualStoreReturn']
    assert pin['File'] == f'{index:03d}.json'
    raw = (ROOT / '.git/compiled-file-replay-actual-1-store-returns' / pin['File']).read_bytes()
    assert len(raw) == pin['Bytes'] and sha(raw) == pin['Sha256']
    store_return_bytes += len(raw)
    returned = fields(json.loads(raw), 'Stored')
    attempt = fields(returned['Attempt'], 'RecordAttempt')
    expected = fields(attempt['Expected'], 'Artifact')
    same(expected, fields(returned['Artifact'], 'Artifact'))
    path = ROOT / '.git' / expected['File']
    data = path.read_bytes()
    assert expected['Encoding'] == 'identity'
    assert len(data) == expected['Bytes'] == expected['StoredBytes']
    assert sha(data) == expected['Sha256'] == expected['StoredSha256']
    assert attempt['Sequence'] == index and attempt['Failure'] is None
    supplied = fields(attempt['Supplied'])
    assert supplied['Role'] == row['Role'] and row['Role'] not in role_values
    read = fields(attempt['Read'], 'CallObservation')
    write = fields(attempt['Write'], 'CallObservation')
    assert read['Raised'] is None and write['Raised'] is None
    assert rawbytes(fields(read['Returned'], 'Admitted')['value']) == data
    assert fields(write['Returned'], 'Admitted')['value'] == len(data)
    if attempt['Encoding'] is None:
        assert rawbytes(supplied['Value']) == data
        value = data
    else:
        encoder = fields(attempt['Encoding'], 'CallObservation')
        assert encoder['Raised'] is None
        assert rawbytes(fields(encoder['Returned'], 'Admitted')['value']) == data
        value = json.loads(data)
        same(value, supplied['Value'])
    role_values[row['Role']] = value
    role_bytes[row['Role']] = data

pins = role_values['source-pins']
assert pins['SourceCommit'] == SOURCE
for pin in pins['SourceFiles']:
    raw = subprocess.check_output(['git', 'show', SOURCE + ':' + pin['File']], cwd=ROOT)
    assert len(raw) == pin['Bytes'] and sha(raw) == pin['Sha256']
    assert (ROOT / pin['File']).read_bytes() == raw

case_summary = []
for case_index, case_id in enumerate(CASES):
    record = fields(role_values[f'recorded-case-{case_index:02d}'], 'RecordedFileCase')
    replay = fields(role_values[f'actual-replay-{case_index:02d}'], 'FileReplay')
    assert record['CaseId'] == case_id == replay['FixedCaseId']
    assert replay['Failure'] is None and replay['CaseMatched'] is True
    assert replay['CompletedOperations'] == replay['MatchedCalls'] == len(record['Calls']) == len(replay['Calls'])
    assert replay['OuterSourceAndRuntimeAdmission'] == 'not-performed'
    same(replay['Recorded'], role_values[f'recorded-case-{case_index:02d}'])
    preparation = fields(replay['Preparation'])
    assert preparation['RaisedType'] is None and preparation['RaisedDetail'] is None
    prepared = fields(preparation['Returned'], 'PreparedFileFixture')
    assert prepared['Root'] == replay['ReplayParent'] + '/' + case_id.replace('/', '-')
    producer_root = replay['ProducerRoot']
    assert producer_root != prepared['Root'] and not prepared['Root'].startswith(producer_root + '/') and not producer_root.startswith(prepared['Root'] + '/')
    codes = []
    for index, replay_call in enumerate(replay['Calls']):
        producer = fields(role_values[f'producer-observation-{case_index:02d}-{index}'], 'FileCallObservation')
        actual = fields(fields(replay_call)['Actual'])
        assert actual['RaisedType'] is None and actual['RaisedDetail'] is None
        observation = fields(actual['Returned'], 'FileCallObservation')
        assert producer['CompletedOperation'] == observation['CompletedOperation'] == 1
        assert producer['Failure'] is None and observation['Failure'] is None
        same(producer['ActualResult'], observation['ActualResult'])
        same(producer['ActualResult'], role_values[f'producer-result-{case_index:02d}-{index}'])
        recorded_call = fields(record['Calls'][index], 'RecordedCall')
        assert rawbytes(recorded_call['ResultRaw']) == role_bytes[f'producer-result-{case_index:02d}-{index}']
        comparison = fields(fields(replay_call)['Comparison'])
        assert comparison['Matched'] is True
        for key in ('ActualEncoding', 'RecordedEncoding'):
            value = fields(fields(comparison[key])['Returned'], 'Admitted')['value']
            assert rawbytes(value) == rawbytes(recorded_call['ResultRaw'])
        result = producer['ActualResult']
        codes.append(fields(result).get('code', 'admitted'))
    case_summary.append({'CaseId': case_id, 'Calls': len(record['Calls']), 'OutcomeCodes': codes})

final_artifact = fields(final['Artifact'], 'Artifact')
final_bytes = (ROOT / '.git' / final_artifact['File']).read_bytes()
assert len(final_bytes) == final_artifact['Bytes'] == final_artifact['StoredBytes']
assert sha(final_bytes) == final_artifact['Sha256'] == final_artifact['StoredSha256']
final_attempt = fields(final['Attempt'], 'RecordAttempt')
assert final_attempt['Failure'] is None
same(fields(final_attempt['Expected'], 'Artifact'), final_artifact)
for key in ('Encoding', 'Read'):
    observed = fields(final_attempt[key], 'CallObservation')
    assert observed['Raised'] is None
    assert rawbytes(fields(observed['Returned'], 'Admitted')['value']) == final_bytes
final_write = fields(final_attempt['Write'], 'CallObservation')
assert final_write['Raised'] is None
assert fields(final_write['Returned'], 'Admitted')['value'] == len(final_bytes)
after = fields(final['After'], 'Snapshot')
assert after['PrimaryFailure'] is None and after['FinalizationStarted'] is True
assert len(after['Artifacts']) == 57 and after['ReservedSlots'] == 57
journal = json.loads(final_bytes)
assert journal['PrimaryFailure'] is None and len(journal['Artifacts']) == len(journal['Attempts']) == 56
for index, (artifact, attempt, call) in enumerate(zip(journal['Artifacts'], journal['Attempts'], receipt['Calls'], strict=True)):
    assert attempt['Sequence'] == index and attempt['Role'] == call['Role']
    assert attempt['Failure'] is None
    data = (ROOT / '.git' / artifact['File']).read_bytes()
    assert len(data) == artifact['Bytes'] and sha(data) == artifact['Sha256']
assert role_values['scoped-outcome'] == dict(SourceCommit=SOURCE, ProducerOperations=11,
    ReplayOperations=11, MatchedCases=7, CompleteScopedSlice=True, CompleteOuterConformance=False,
    RuntimeAdmitted=False, ImplementationArchiveCreated=False, RegisteredSourcesGenerated=False)

print(json.dumps({'ManifestBytes': len(manifest_raw), 'ManifestSha256': sha(manifest_raw),
 'Artifacts': len(manifest['Artifacts']), 'StoredBytes': stored_total, 'OriginalBytes': raw_total,
 'AvailableOriginalRecordsMatched': original_matches, 'SourceVersions': source_versions,
 'CapturedSourcePins': len(pins['SourceFiles']), 'FixtureTrees': len(manifest['FixtureTrees']),
 'InventoryEntries': inventory_entries, 'InventoryRegularBytes': regular_bytes,
 'StoreRecords': len(receipt['Calls']), 'FinalJournalBytes': len(final_bytes), 'FinalizationVerified': True, 'StoreReturnBytes': store_return_bytes,
 'ProducerOperations': 11, 'ReplayOperations': 11, 'MatchedCases': 7,
 'CaseSummary': case_summary, 'NoFixtureExecution': True, 'NoFullOuterOrRuntimeAdmission': True}, indent=2))
