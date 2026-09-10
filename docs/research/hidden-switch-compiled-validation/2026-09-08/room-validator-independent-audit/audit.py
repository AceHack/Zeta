"""Read-only archive/source correspondence; imports no project or validator code."""
import base64
from datetime import datetime
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess

IDENTITY = Path('/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906')
ROOT = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
DOC = 'docs/research/2026-09-08-distributional-learning-rooms-reference.md'
PIN = '6fefd143eb1a89f69844b4160ee6d2e02f15c3b9'
INITIAL = '6512494eb359645c3038235e9cd6498a4235fe6e'
FINAL = '40833d9e85796f22e500800389aa4a09ef672161'
NATIVE = '2af8d581016d6c5a903aaba0335a3e73c8d5ac9b'
MODES = ['ordinary', 'fault-2', 'fault-12', 'fault-25', 'invalid-control']
COUNTS = [25, 2, 12, 25, 0]


def digest(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def blob(root, commit, name):
    return subprocess.check_output(['git', 'show', commit + ':' + name], cwd=root)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


doc = blob(IDENTITY, PIN, DOC)
assert doc == (IDENTITY / DOC).read_bytes()
text = doc.decode('utf-8')
metadata = json.loads(re.findall(r'~~~json\n(.*?)\n~~~', text, re.S)[-1])
stored = base64.b64decode(''.join(re.findall(r'~~~text\n(.*?)\n~~~', text, re.S)[-1].split()), validate=True)
assert len(stored) == metadata['StoredBytes'] == 157783
assert digest(stored) == metadata['StoredSha256'] == '1DA3D9C6BE9C62598E24518C2E4637067B557FCEB9562C32ACD63AD49A87043C'
capsule = gzip.decompress(stored)
assert len(capsule) == metadata['CapsuleBytes'] == 1650374
assert digest(capsule) == metadata['CapsuleSha256'] == 'E3DE5F8DBE0AC45911BFF612FC22B53821BD537049B9A20E88AC58F3B78ABF76'
archive = json.loads(capsule)
assert archive['Schema'] == 'zeta.distributional-rooms.validation-archive.v1'
assert metadata['InitialValidatorSource'] == INITIAL
assert metadata['CorrectedValidatorSource'] == FINAL
assert metadata['SuppliedNativeSource'] == NATIVE
files = {}
for row in archive['Files']:
    assert set(row) == {'Name', 'Bytes', 'Sha256', 'BytesHex'}
    name = row['Name']
    assert not name.startswith('/') and all(part not in ('', '.', '..') for part in name.split('/'))
    assert name not in files
    raw = bytes.fromhex(row['BytesHex'])
    assert len(raw) == row['Bytes'] and digest(raw) == row['Sha256']
    files[name] = raw
assert len(files) == metadata['Files'] == 78
assert sum(map(len, files.values())) == metadata['OriginalFileBytes'] == 819460

native_source = blob(ROOT, NATIVE, 'src/Research.FSharp/DistributionalLearningRooms.fsx')
comparisons = 0
attempt_results = []
for attempt, pin in [('attempt-1', INITIAL), ('attempt-2', FINAL)]:
    def raw(name):
        return files[attempt + '/' + name]

    def decoded(name):
        return json.loads(raw(name))

    assert raw('reference.py') == blob(IDENTITY, pin, 'src/Interp.Python/zeta_interp/distributional_learning_rooms_reference.py')
    assert raw('tests.py') == blob(IDENTITY, pin, 'src/Interp.Python/tests/test_distributional_learning_rooms_reference.py')
    assert raw('native-source.fsx') == native_source
    summary = decoded('summary.json')
    assert summary['ReferenceSourceCommit'] == pin and summary['SuppliedNativeSourceCommit'] == NATIVE
    assert [r['Mode'] for r in summary['Runs']] == MODES
    artifact_names = []
    for artifact in summary['Artifacts']:
        actual = raw(artifact['File'])
        assert len(actual) == artifact['Bytes'] and digest(actual) == artifact['Sha256']
        artifact_names.append(artifact['File'])
        comparisons += 1
    assert len(artifact_names) == len(set(artifact_names)) == 22
    assert set(artifact_names + ['summary.json']) == {n.split('/', 1)[1] for n in files if n.startswith(attempt + '/')}
    ordinary_result = decoded('ordinary.validation.json')
    ordinary_lines = raw('ordinary.stdout').splitlines(keepends=True)
    native_runs = decoded('distributional-room-control-runs-2.json')
    assert [r['Label'] for r in native_runs] == MODES
    prior_finish = None
    for mode, count, observation, native in zip(MODES, COUNTS, summary['Runs'], native_runs, strict=True):
        result = decoded(mode + '.validation.json')
        fields = result['Fields']
        content = raw(mode + '.stdout')
        assert set(fields['Raw']) == {'BytesHex'} and bytes.fromhex(fields['Raw']['BytesHex']) == content
        assert fields['Custody'] == 'external-caller-obligation-not-established'
        assert result['Type'].rsplit('.', 1)[1] == observation['Type']
        assert fields['CheckedCheckpoints'] == observation['CheckedCheckpoints']
        assert fields.get('Code') == observation['Code'] and fields.get('Path') == observation['Path']
        lines = content.splitlines(keepends=True)
        records = [json.loads(line) for line in lines]
        assert len(records) == count + 1 and content.endswith(b'\n')
        terminal = records[-1]
        assert terminal['ObservedCheckpointCount'] == terminal['WrittenCheckpointCount'] == count
        assert terminal['PendingCheckpoint'] is None and terminal['PendingCheckpointOmission'] is None
        assert terminal['Complete'] is (mode == 'ordinary')
        if mode.startswith('fault-'):
            assert lines[:count] == ordinary_lines[:count]
            assert canonical(fields['Ordinary']) == canonical(ordinary_result)
        else:
            assert fields['Ordinary'] is None
        if attempt == 'attempt-2' or mode == 'invalid-control':
            assert observation['Type'] == 'RoomRunValidated' and fields['Mode'] == mode
            assert fields['CheckedCheckpoints'] == count and fields['Sha256'] == digest(content)
            assert canonical(fields['Records']) == canonical(records)
            assert fields['FiniteRows'] == (10 if mode == 'ordinary' else 0)
            assert fields['ZetaRows'] == (16 if mode == 'ordinary' else 0)
        else:
            assert observation['Type'] == 'RoomRunRefused'
            expected_records = records if mode == 'ordinary' else []
            assert canonical(fields['Records']) == canonical(expected_records)
            assert fields['CheckedCheckpoints'] == (25 if mode == 'ordinary' else 0)
            assert fields['Code'] == ('ContentMismatch' if mode == 'ordinary' else 'InvalidOrdinary')
            assert fields['Path'].endswith('Lines[25].Receipt.Runtime.LoadedAssemblies[2].Name')
        assert native['SourceCommit'] == NATIVE and native['SourceSha256'].upper() == digest(native_source)
        assert native['TimedOut'] is False and native['ExitCode'] == (0 if mode == 'ordinary' else 2)
        for stream in ['Stdout', 'Stderr']:
            observed = raw(mode + '.' + stream.lower())
            assert len(observed) == native[stream + 'Bytes'] and digest(observed) == native[stream + 'Sha256'].upper()
        assert not raw(mode + '.stderr')
        start, finish = (datetime.fromisoformat(native[k]) for k in ['StartedAt', 'FinishedAt'])
        assert start < finish and (prior_finish is None or prior_finish <= start)
        prior_finish = finish
        expected_command = ['dotnet', 'fsi', '--exec', 'src/Research.FSharp/DistributionalLearningRooms.fsx']
        if mode.startswith('fault-'):
            expected_command += ['--fault-after-checkpoint', mode.split('-')[1]]
        elif mode == 'invalid-control':
            expected_command += ['--not-a-control']
        assert native['Command'] == expected_command
        suffix = {'ordinary': 'ordinary', 'fault-2': 'fault-2', 'fault-12': 'fault-12', 'fault-25': 'fault-25', 'invalid-control': 'invalid-control'}[mode]
        assert content == (ROOT / '.git' / ('distributional-room-' + suffix + '-2.stdout')).read_bytes()
    finite = decoded('ordinary.stdout'.replace('stdout', 'validation.json'))['Fields']['Records'][-1]['Receipt']['FiniteReference']
    assert canonical(finite) == canonical(decoded('unchanged-reference.json'))
    assert digest(raw('unchanged-reference.json')) == '3DF866A0745ED6873933BE5B9119FB596CDFB5FA722A0D76F545C7FDB8A3A2D4'
    attempt_results.append(summary['Runs'])

for name in ['native-source.fsx', 'distributional-room-control-runs-2.json', 'run-distributional-room-controls-2.py', 'unchanged-reference.json'] + [mode + suffix for mode in MODES for suffix in ['.stdout', '.stderr']]:
    assert files['attempt-1/' + name] == files['attempt-2/' + name]
assert files['prior-native-fault/distributional-room-fault-2-1.stdout'] == files['attempt-2/fault-2.stdout']
assert files['development/capture-stdout.txt'] == files['attempt-1/summary.json']
assert files['development/capture-repair-stdout.txt'] == files['attempt-2/summary.json']
assert not files['development/capture-stderr.txt'] and not files['development/capture-repair-stderr.txt']
print(json.dumps({'Status': 'passed', 'EvidenceCommit': PIN, 'Files': len(files), 'OriginalFileBytes': sum(map(len, files.values())), 'CapsuleBytes': len(capsule), 'StoredBytes': len(stored), 'SummaryArtifactReferences': comparisons, 'AttemptResults': attempt_results, 'ValidatorInvocationsByReviewer': 0, 'NativeProcessesByReviewer': 0}, indent=2))
