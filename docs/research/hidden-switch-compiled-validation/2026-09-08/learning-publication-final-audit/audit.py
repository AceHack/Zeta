"""Independent retained-byte audit; no project imports or scientific execution."""
import base64
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import zlib

PUB = Path('/Users/acehack/.zeta/agents/codex/Zeta-compiled-evidence-publication-20260907')
ROOT = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
ARCHIVE = 'f2031ff923527d3d5c116043b794e09c627662f8'
LATEST = '8cb522b2dab2fb50792a3d7ff6ef7f3af21f5e64'
GATE = '19efca924f6765bbdd3b4017f707fa8f08302bd1'
CONTROLS = 'b65679674760e64bfe34e903646a2fd211d2420d'
BASE = '5585c17c81e06878570bb1630786473e7fbec27f'
DIRECTORY = 'docs/research/distributional-learning/2026-09-08/publication-validation/'
OLD = 'docs/research/distributional-learning/2026-09-08/actual-zeta-rooms/'

def git(*args, repo=PUB):
    return subprocess.check_output(['git', *args], cwd=repo)

def blob(commit, path, repo=PUB):
    return git('show', commit + ':' + path, repo=repo)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def pairs(items):
    result = {}
    for key, value in items:
        assert key not in result, ('duplicate-key', key)
        result[key] = value
    return result

def parse(raw):
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))

def unpack(stored, row):
    assert row['Encoding'] == 'gzip'
    assert len(stored) == row['StoredBytes'] and sha(stored) == row['StoredSha256']
    assert 0 <= row['Bytes'] <= 8 * 1024 * 1024
    decoder = zlib.decompressobj(31)
    raw = decoder.decompress(stored, row['Bytes'] + 1)
    assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
    assert len(raw) == row['Bytes'] and sha(raw) == row['Sha256']
    return raw

manifest_raw = blob(ARCHIVE, DIRECTORY + 'manifest.json')
manifest = parse(manifest_raw)
artifacts = manifest['Artifacts']
assert manifest['ArtifactCount'] == len(artifacts) == 46
assert len({r['File'] for r in artifacts}) == 46
names = git('ls-tree', '-r', '--name-only', ARCHIVE, '--', DIRECTORY).decode().splitlines()
assert set(names) == {DIRECTORY + r['File'] for r in artifacts} | {DIRECTORY + 'manifest.json', DIRECTORY + 'README.md'}
raws = {}
for row in artifacts:
    assert '/' not in row['File'] and row['File'].endswith('.gz')
    raws[row['File'][:-3]] = unpack(blob(ARCHIVE, DIRECTORY + row['File']), row)
assert manifest['FullGateSource'] == GATE and manifest['ActualControlsSource'] == CONTROLS
assert manifest['FullGate'] == {'ExitCode': 0, 'PassedChecks': 18}
assert manifest['FocusedReferenceTests'] == {'ExitCode': 0, 'Passed': 124, 'Seconds': 29.92}
assert manifest['CompleteRuntimeClosureAdmitted'] is False

def observed_bytes(value):
    assert set(value) == {'Encoding', 'Bytes', 'Sha256', 'Data'} and value['Encoding'] == 'base64'
    raw = base64.b64decode(value['Data'], validate=True)
    assert len(raw) == value['Bytes'] and sha(raw).upper() == value['Sha256'].upper()
    return raw

byte_descriptors = 0

def walk(value):
    global byte_descriptors
    if isinstance(value, dict):
        if value.get('Encoding') == 'base64':
            observed_bytes(value)
            byte_descriptors += 1
        else:
            for child in value.values():
                walk(child)
    elif isinstance(value, list):
        for child in value:
            walk(child)

labels = ['ordinary', 'fault-2', 'fault-12', 'fault-25', 'invalid-control']
counts = [25, 2, 12, 25, 0]
runs = parse(raws['distributional-publication-room-control-runs-1.json'])
assert runs == manifest['ActualProcessRuns'] and [r['Label'] for r in runs] == labels
replays = parse(raws['distributional-publication-replay-results-1.json'])
assert [r['Label'] for r in replays] == labels
ordinary_bytes = raws['distributional-publication-room-ordinary-1.stdout']
ordinary_lines = ordinary_bytes.splitlines(keepends=True)
ordinary_return = replays[0]['Return']
previous_finish = None
comparisons = []
old_manifest = parse(blob(ARCHIVE, OLD + 'manifest.json'))
old_rows = {r['File']: r for r in old_manifest['Artifacts']}
for index, (label, count, run, replay) in enumerate(zip(labels, counts, runs, replays, strict=True)):
    prefix = 'distributional-publication-room-' + label + '-1'
    raw = raws[prefix + '.stdout']
    stderr = raws[prefix + '.stderr']
    assert parse(raws[prefix + '.json']) == run
    assert run['SourceCommit'] == CONTROLS
    assert run['SourceSha256'] == 'a895af74c2c4619df31aa6d6b7cfd255bb53c256969db2f3d48b0bd30bcf5766'
    assert run['TimedOut'] is False and run['ExitCode'] == (0 if index == 0 else 2)
    assert run['StdoutBytes'] == len(raw) and run['StdoutSha256'] == sha(raw)
    assert stderr == b'' and run['StderrBytes'] == 0 and run['StderrSha256'] == sha(stderr)
    command = ['dotnet', 'fsi', '--exec', 'src/Research.FSharp/DistributionalLearningRooms.fsx']
    if label.startswith('fault-'):
        command += ['--fault-after-checkpoint', str(count)]
    elif label == 'invalid-control':
        command += ['--not-a-control']
    assert run['Command'] == command
    start, finish = (datetime.datetime.fromisoformat(run[k]) for k in ['StartedAt', 'FinishedAt'])
    assert start.tzinfo is not None and finish >= start
    assert previous_finish is None or start >= previous_finish
    previous_finish = finish
    lines = raw.splitlines(keepends=True)
    assert all(line.endswith(b'\n') for line in lines) and len(lines) == count + 1
    records = [parse(line) for line in lines]
    assert [r['Sequence'] for r in records[:-1]] == list(range(1, count + 1))
    assert all(r['Kind'] == 'checkpoint' for r in records[:-1])
    assert lines[:count] == ordinary_lines[:count]
    terminal = records[-1]
    assert terminal['Kind'] == 'terminal' and terminal['Schema'] == 'zeta.distributional-rooms.run.v1'
    assert terminal['ObservedCheckpointCount'] == terminal['WrittenCheckpointCount'] == count
    assert terminal['PendingCheckpoint'] is None and terminal['PendingCheckpointOmission'] is None
    assert terminal['Complete'] is (index == 0)
    assert terminal['Failure'] == (None if index == 0 else 'InvalidControlArguments' if count == 0 else 'InjectedCheckpointFailure')
    if index:
        assert terminal['Receipt'] is None
    individual = parse(raws['distributional-publication-replay-' + label + '-1.json'])
    assert replay == individual and replay['Return']['Type'] == 'RoomRunValidated'
    fields = replay['Return']['Fields']
    assert fields['Mode'] == label and fields['CheckedCheckpoints'] == count
    assert observed_bytes(fields['Raw']) == raw and fields['Sha256'].upper() == sha(raw).upper()
    assert fields['Records'] == records
    assert fields['FiniteRows'] == (10 if index == 0 else 0) and fields['ZetaRows'] == (16 if index == 0 else 0)
    assert fields['Ordinary'] == (ordinary_return if label.startswith('fault-') else None)
    assert fields['Custody'] == 'external-caller-obligation-not-established'
    walk(individual)
    old_name = 'distributional-room-' + label + '-2.stdout.gz'
    old_raw = unpack(blob(ARCHIVE, OLD + old_name), old_rows[old_name])
    old_records = [parse(line) for line in old_raw.splitlines()]
    if index == 0:
        assert records[:-1] == old_records[:-1]
        receipt, old_receipt = terminal['Receipt'], old_records[-1]['Receipt']
        assert set(receipt) == set(old_receipt) == {'Schema', 'FiniteReference', 'ZetaObservations', 'Runtime'}
        assert all(receipt[k] == old_receipt[k] for k in ['Schema', 'FiniteReference', 'ZetaObservations'])
        assert receipt['Runtime']['CompleteRuntimeClosureAdmitted'] is False
        assemblies = receipt['Runtime']['LoadedAssemblies']
        assert [a['Name'] for a in assemblies] == ['Zeta.Core', 'Zeta.Bayesian', 'Zeta.Core']
        assert assemblies[0] == assemblies[2]
    else:
        assert raw == old_raw
    comparisons.append({'Label': label, 'Checkpoints': count, 'ExitCode': run['ExitCode'], 'StdoutBytes': len(raw), 'StdoutSha256': sha(raw), 'ActualReturnType': replay['Return']['Type'], 'PriorEngineeringContentsMatch': True})
walk(replays)

source_rows = manifest['SourceFiles']
assert len(source_rows) == 5
expected_sources = {r['Path'] for r in source_rows}
for cut in [GATE, CONTROLS, ARCHIVE, LATEST]:
    for row in source_rows:
        raw = blob(cut, row['Path'])
        assert len(raw) == row['Bytes'] and sha(raw) == row['Sha256']
changed = git('diff', '--name-only', BASE, LATEST, '--', 'src', 'tests').decode().splitlines()
assert set(changed) == expected_sources
assert not git('diff', '--name-only', GATE, LATEST, '--', 'src', 'tests')
claims = ['docs/claims/task-distributional-learning-20260908.md', 'docs/claims/task-hidden-switch-compiled-20260907.md']
for path in claims:
    assert blob(GATE, path)
    assert not git('ls-tree', '-r', '--name-only', '70e81a8e2cd0b75e6acdb1d43baeb2f9dfcdba0f', '--', path)
    assert not git('ls-tree', '-r', '--name-only', LATEST, '--', path)
    assert blob('e2503d3b3fcbfc1359c64486d02782140009f7e0', path, ROOT)
finite = 'docs/claims/task-distributional-publication-20260908.md'
assert blob(ARCHIVE, finite)
assert not git('ls-tree', '-r', '--name-only', LATEST, '--', finite)
assert b'changes staged in the index' in raws['distributional-publication-parent-claim-omission-1.log']
gate = raws['distributional-publication-full-preflight-1.log'].decode()
assert len([line for line in gate.splitlines() if line.startswith('▶ ') and line.endswith('PASS')]) == 18
assert 'all 18 executed check(s) passed' in gate
assert b'124 passed in 29.92s' in raws['distributional-publication-reference-tests-1.log']

result = {
    'ArchiveCommit': ARCHIVE, 'FinalPublicationScopeCut': LATEST,
    'ManifestBytes': len(manifest_raw), 'ManifestSha256': sha(manifest_raw),
    'Artifacts': len(artifacts), 'StoredBytes': sum(r['StoredBytes'] for r in artifacts),
    'OriginalBytes': sum(r['Bytes'] for r in artifacts), 'AllSingleMemberGzipAndHashesMatch': True,
    'ReadmeSha256': sha(blob(ARCHIVE, DIRECTORY + 'README.md')),
    'Runs': comparisons, 'VerifiedBase64DescriptorOccurrences': byte_descriptors,
    'FullGateSource': GATE, 'FullGateObservedPassedChecks': 18,
    'ActualControlsSource': CONTROLS, 'FocusedReferenceTestsObservedPassed': 124,
    'FiveSourceFiles': source_rows, 'SourceFilesUnchangedAcrossFourCuts': True,
    'ParentClaimsRemovedAt70e81AndRemainInRoot': True, 'FiniteClaimRemovedBeforeLatestCut': True,
    'OrdinaryActualRuntime': replays[0]['Return']['Fields']['Records'][-1]['Receipt']['Runtime'],
    'StudyOrValidatorExecutionsByReviewer': 0, 'NewScientificAdmission': False,
}
print(json.dumps(result, indent=2, ensure_ascii=True))
