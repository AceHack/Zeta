"""Check the corrected count proof as retained bytes against immutable trees."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import zlib

PUB = Path('/Users/acehack/.zeta/agents/codex/Zeta-compiled-evidence-publication-20260907')
CUT = '49e470bab8de5bbf8199846c778fdd18236ce02e'
FIRST = '83beb2933937da4bfa7c07b4367373da10479f3e'
OLD = '8cb522b2dab2fb50792a3d7ff6ef7f3af21f5e64'
OLD_BASE = '5585c17c81e06878570bb1630786473e7fbec27f'
OBSERVED = '6a1f5d43ad08f992bb8a0f80ac0c490ef4188d8a'
PREFIX = 'docs/research/distributional-learning/2026-09-08/publication-successor/'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=PUB)

def blob(cut, path):
    return git('show', cut + ':' + path)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def parse(raw):
    return json.loads(raw)

def tree(cut):
    result = {}
    for record in git('ls-tree', '-r', '-z', cut).split(b'\0'):
        if record:
            metadata, path = record.split(b'\t')
            mode, kind, object_id = metadata.decode().split()
            result[path.decode()] = {'Mode': mode, 'Type': kind, 'Object': object_id}
    return result

manifest_raw = blob(CUT, PREFIX + 'manifest.json')
manifest = parse(manifest_raw)
rows = manifest['Artifacts']
assert manifest['ArtifactCount'] == len(rows) == len({r['File'] for r in rows}) == 30
raws = {}
for row in rows:
    assert '/' not in row['File'] and row['Encoding'] == 'gzip' and 0 <= row['Bytes'] <= 2 * 1024 * 1024
    stored = blob(CUT, PREFIX + row['File'])
    assert len(stored) == row['StoredBytes'] and sha(stored) == row['StoredSha256']
    decoder = zlib.decompressobj(31)
    raw = decoder.decompress(stored, row['Bytes'] + 1)
    assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
    assert len(raw) == row['Bytes'] and sha(raw) == row['Sha256']
    raws[row['OriginalPath']] = raw
first_manifest = parse(blob(FIRST, PREFIX + 'manifest.json'))
for row in first_manifest['Artifacts']:
    assert blob(CUT, PREFIX + row['File']) == blob(FIRST, PREFIX + row['File'])
assert manifest['OriginalObservedRenameAwareDiffNameCount'] == 230
assert manifest['VerifiedChangedTreePathCount'] == 231
assert 'PublicationPathCount' not in manifest
assert raws['distributional-successor-tree-count-correction.json'] == b''
transcription = raws['distributional-successor-tree-count-failure-transcription.txt'].decode()
assert 'not original stderr bytes' in transcription and 'premature' in transcription
source = raws['distributional-successor-tree-count-correction-2.py']
stdout = raws['distributional-successor-tree-count-correction-2.stdout']
stderr = raws['distributional-successor-tree-count-correction-2.stderr']
process = parse(raws['distributional-successor-tree-count-correction-2.process.json'])
assert process == manifest['CountFollowup']['RepairedProcess']
assert process['ExitCode'] == 0 and stderr == b''
assert process['Command'] == ['python3', '.git/distributional-successor-tree-count-correction-2.py']
assert process['ScriptSha256'] == sha(source)
for label, raw in [('Stdout', stdout), ('Stderr', stderr)]:
    assert process[label + 'Bytes'] == len(raw) and process[label + 'Sha256'] == sha(raw)
assert len(stdout) == 96206
proof = parse(stdout)
assert proof['SuccessorHead'] == manifest['CountFollowup']['VerifiedSource'] == OBSERVED
assert proof['OriginalHead'] == OLD and proof['OriginalBase'] == OLD_BASE
assert proof['ChangedTreePaths'] == 231 and proof['RenameAwareDiffNames'] == 230
start, observed, finish = map(datetime.datetime.fromisoformat, [process['StartedAt'], proof['ObservedAt'], process['FinishedAt']])
assert start <= observed <= finish
old, base, current, final = map(tree, [OLD, OLD_BASE, OBSERVED, CUT])
paths = sorted(p for p in old.keys() | base.keys() if old.get(p) != base.get(p))
assert len(paths) == 231
expected = [{'Path': p, 'Original': old.get(p), 'Successor': current.get(p)} for p in paths]
assert proof['Rows'] == expected
changed = [r for r in expected if r['Original'] != r['Successor']]
assert proof['DeclaredExplanationAndImportedReviewDifferences'] == changed
assert [r['Path'] for r in changed] == manifest['CountFollowup']['ExpectedChangedDocumentation']
assert len(changed) == 2
for row in manifest['SourceFiles']:
    raw = blob(CUT, row['Path'])
    assert raw == blob(OLD, row['Path']) and len(raw) == row['Bytes'] and sha(raw) == row['Sha256']
assert not git('diff', '--name-only', FIRST, CUT, '--', 'src', 'tests')
assert set(p for p in final if p.startswith(PREFIX)) == {PREFIX + r['File'] for r in rows} | {PREFIX + 'README.md', PREFIX + 'manifest.json'}
print(json.dumps({
    'CorrectedCut': CUT, 'OriginalSuccessorCut': FIRST, 'ObservedProofCut': OBSERVED,
    'ManifestBytes': len(manifest_raw), 'ManifestSha256': sha(manifest_raw),
    'Records': 30, 'StoredBytes': sum(r['StoredBytes'] for r in rows), 'OriginalBytes': sum(r['Bytes'] for r in rows),
    'Original23StoredRecordsUnchanged': True, 'FailedFollowupEmptyStdoutPreserved': True,
    'FailureTextIsExplicitTranscription': True, 'ActualRepairProcess': process,
    'All231RetainedRowsMatchIndependentFullTrees': True,
    'ExpectedChangedDocumentation': [r['Path'] for r in changed],
    'FiveSourceFilesRemainUnchanged': True, 'ScientificOrProjectExecutionsByReviewer': 0,
    'SuccessorGithubOrMainAdmission': False,
}, indent=2))
