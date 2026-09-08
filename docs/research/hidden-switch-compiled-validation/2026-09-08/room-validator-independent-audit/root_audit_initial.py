"""Read coordinator archive and compare its exact streams with the independent capsule."""
import base64
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
IDENTITY = Path('/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906')
PIN = '6cd9a0803338eb878dc23a0fe0cc02d49487a89d'
BASE = 'docs/research/distributional-learning/2026-09-08/actual-zeta-rooms'
REF_PIN = '6fefd143eb1a89f69844b4160ee6d2e02f15c3b9'


def blob(root, pin, path):
    return subprocess.check_output(['git', 'show', pin + ':' + path], cwd=root)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


manifest_raw = blob(ROOT, PIN, BASE + '/manifest.json')
assert manifest_raw == (ROOT / BASE / 'manifest.json').read_bytes()
manifest = json.loads(manifest_raw)
assert manifest['ArtifactCount'] == len(manifest['Artifacts']) == 31
files = {}; stored_bytes = 0
for row in manifest['Artifacts']:
    name = row['File']
    assert name not in files and row['Encoding'] == 'gzip'
    stored = blob(ROOT, PIN, BASE + '/' + name)
    assert stored == (ROOT / BASE / name).read_bytes()
    assert len(stored) == row['StoredBytes'] and sha(stored) == row['StoredSha256']
    raw = gzip.decompress(stored)
    assert len(raw) == row['Bytes'] and sha(raw) == row['Sha256']
    files[name] = raw; stored_bytes += len(stored)
for source in manifest['SourceVersions']:
    assert files[source['Label'] + '.fsx.gz'] == blob(ROOT, source['Commit'], 'src/Research.FSharp/DistributionalLearningRooms.fsx')
assert files['protocol.md.gz'] == blob(ROOT, manifest['ProtocolCommit'], 'docs/research/2026-09-08-distributional-learning-small-room-protocol.md')
assert not files['distributional-room-attempt-1.stdout.gz']
assert len(files['distributional-room-attempt-1.stderr.gz']) == 647
assert b'FS3886' in files['distributional-room-attempt-1.stderr.gz'] and b'FS0001' in files['distributional-room-attempt-1.stderr.gz']
assert not files['distributional-room-attempt-2.stderr.gz']
first_ordinary = [json.loads(line) for line in files['distributional-room-attempt-2.stdout.gz'].splitlines()]
assert len(first_ordinary) == 26 and first_ordinary[-1]['Complete'] is True
assert first_ordinary[-1]['ObservedCheckpointCount'] == 25
prior = json.loads(files['distributional-room-fault-2-1.json.gz'])
assert prior['ExitCode'] == 0 and prior['TimedOut'] is False
assert prior['SourceCommit'] == '5475ec0f409076d379ad962c600db45b57e510a9'
assert files['distributional-room-fault-2-1.stdout.gz'] == files['distributional-room-fault-2-2.stdout.gz']
assert not files['distributional-room-fault-2-1.stderr.gz']

ref_doc = blob(IDENTITY, REF_PIN, 'docs/research/2026-09-08-distributional-learning-rooms-reference.md').decode()
ref = json.loads(gzip.decompress(base64.b64decode(''.join(re.findall(r'~~~text\n(.*?)\n~~~', ref_doc, re.S)[-1].split()), validate=True)))
reference_files = {r['Name']: bytes.fromhex(r['BytesHex']) for r in ref['Files']}
expected_runs = json.loads(reference_files['attempt-2/distributional-room-control-runs-2.json'])
assert manifest['FinalRuns'] == expected_runs == json.loads(files['distributional-room-control-runs-2.json.gz'])
for run in expected_runs:
    label = run['Label']; prefix = 'distributional-room-' + label + '-2'
    assert json.loads(files[prefix + '.json.gz']) == run
    for stream in ['stdout', 'stderr']:
        assert files[prefix + '.' + stream + '.gz'] == reference_files['attempt-2/' + label + '.' + stream]
assert files['run-distributional-room-controls-2.py.gz'] == reference_files['attempt-2/run-distributional-room-controls-2.py']
ordinary = json.loads(files['distributional-room-ordinary-2.stdout.gz'].splitlines()[-1])
assert manifest['RuntimeObservations'] == ordinary['Receipt']['Runtime']
assert manifest['CompleteRuntimeClosureAdmitted'] is False
assert manifest['RuntimeObservations']['CompleteRuntimeClosureAdmitted'] is False
assert manifest['RuntimeObservations']['LoadedAssemblies'][0] == manifest['RuntimeObservations']['LoadedAssemblies'][2]
tests = manifest['IntegratedReferenceTests']
assert tests['SourceCommit'] == 'ecb35bf73a669d2552af7d2dd53b1d94e4efc4c0'
assert tests['ExitCode'] == 0 and tests['Passed'] == 124 and tests['Seconds'] == 4.66
assert b'124 passed in 4.66s' in files['integrated-reference-tests-1.log.gz']
for relative in ['zeta_interp/distributional_learning_rooms_reference.py', 'tests/test_distributional_learning_rooms_reference.py']:
    path = 'src/Interp.Python/' + relative
    assert blob(ROOT, tests['SourceCommit'], path) == blob(IDENTITY, '40833d9e85796f22e500800389aa4a09ef672161', path)
print(json.dumps({'Status': 'passed', 'EvidenceCommit': PIN, 'ArtifactCount': len(files), 'StoredBytes': stored_bytes, 'OriginalBytes': sum(map(len, files.values())), 'ManifestBytes': len(manifest_raw), 'ManifestSha256': sha(manifest_raw), 'FinalNativeProcesses': len(expected_runs), 'IndependentCapsuleStreamsMatched': 10, 'SourceVersions': manifest['SourceVersions'], 'NativeProcessesByReviewer': 0, 'ValidatorInvocationsByReviewer': 0}, indent=2))
