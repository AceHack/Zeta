"""Read retained oracle publication evidence; write review-owned Git objects only."""

import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import zlib


PUB = Path('/Users/acehack/.zeta/agents/codex/Zeta-oracle-grounding-publication-20260908')
OWN = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-training-reference-20260906')
OUT = Path(__file__).resolve().parent
HEAD = 'c5f1fc0e6ff7b364404e602390cb37d5e2b51679'
LEFT = 'c3a5c729afef211cd666d652c332f3e02cd413c8'
RIGHT = 'cda10d7e70414e227237654abc7bc129ec08ac71'
SOURCE = '4933a5f2af12f6b20f273488cf9174179d682fef'
ARCHIVE = 'docs/research/oracle-grounding-publication/2026-09-08/'
CONFLICTS = [
    'docs/research/2026-09-08-distributional-learning-resource-aware-integration-direction.md',
    'docs/research/precision-gate-kernels/2026-09-08/publication-validation/README.md',
]


def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}


def git(*args, env=None):
    return subprocess.run(['git', *args], cwd=PUB, env=env,
                          check=True, capture_output=True).stdout


def blob(commit, path):
    return git('show', f'{commit}:{path}')


def exact(row, raw, size='Bytes', sha='Sha256'):
    assert len(raw) == row[size]
    assert hashlib.sha256(raw).hexdigest() == row[sha]


def one_gzip(raw, maximum):
    decoder = zlib.decompressobj(31)
    result = decoder.decompress(raw, maximum + 1)
    assert len(result) <= maximum and decoder.eof
    assert not decoder.unused_data and not decoder.unconsumed_tail
    return result


def write_json(path, value):
    with path.open('xb') as stream:
        stream.write((json.dumps(value, indent=2, sort_keys=True) + '\n').encode())


manifest_raw = blob(HEAD, ARCHIVE + 'manifest.json')
manifest = json.loads(manifest_raw)
assert manifest['SourceHead'] == SOURCE and len(manifest['Artifacts']) == 26
archive_rows = []
originals = {}
for row in manifest['Artifacts']:
    stored = blob(HEAD, ARCHIVE + row['File'])
    exact(row, stored, 'StoredBytes', 'StoredSha256')
    raw = one_gzip(stored, row['Bytes'])
    exact(row, raw)
    assert raw == (PUB / row['OriginalPath']).read_bytes()
    originals[row['OriginalPath']] = raw
    archive_rows.append({**row, 'StoredAndRawAndOriginalMatch': True})

source_rows = []
for row in manifest['SourceIdentities']:
    raw = blob(HEAD, row['Path'])
    exact(row, raw)
    assert raw == blob(SOURCE, row['Path'])
    source_rows.append({**row, 'OriginalGateAndCurrentHeadMatch': True})

source_import = json.loads(originals['.git/oracle-publication-source-import-1.json'])
import_rows = []
for row in source_import['NewFiles']:
    original = blob(source_import['RootSource'], row['Path'])
    exact(row, original)
    assert original == blob('a8c562f51b38f43e1e1bceeda404649bb98ed05b', row['Path'])
    raw = blob(HEAD, row['Path'])
    assert raw.startswith(original)
    suffix = raw[len(original):]
    if suffix:
        assert row['Path'] in (
            'docs/research/2026-09-08-hc8-default-oracle-explanation-correction.md',
            'docs/research/2026-09-08-default-oracle-disclosure-clarification.md')
    entry = git('ls-tree', HEAD, '--', row['Path']).decode().split()[0]
    assert entry == row['Mode']
    import_rows.append({**row, 'RootAndOriginalImportMatch': True,
                        'CurrentIdentity': identity(raw),
                        'LaterAdditiveIndexParagraph': suffix.decode()})

restricted = git('diff', '--no-renames', '--name-only', RIGHT, HEAD, '--',
                 'src', 'tests', 'docs/ALIGNMENT.md', 'docs/governance/MANIFESTO.md').decode().splitlines()
assert restricted == ['docs/ALIGNMENT.md', 'docs/governance/MANIFESTO.md',
                      'src/Core/FeedbackThrottle.fs', 'src/Core/Tsirelson.fs']
comment_rows = []
for name in ('Tsirelson', 'FeedbackThrottle'):
    path = f'src/Core/{name}.fs'
    before, after = blob(RIGHT, path), blob(HEAD, path)
    executable_lines = lambda raw: [line for line in raw.splitlines(keepends=True)
                                    if not line.lstrip().startswith(b'///')]
    assert executable_lines(before) == executable_lines(after)
    proposed = blob(HEAD, f'docs/research/oracle-selection-comment-review/2026-09-08/{name}.fs.proposed.gz')
    assert one_gzip(proposed, 65536) == after
    comment_rows.append({'Path': path, 'Before': identity(before), 'After': identity(after),
                         'ExactReviewedProposal': True, 'NonDocumentationLinesUnchanged': True})

old_manifesto = blob(RIGHT, 'docs/governance/MANIFESTO.md')
new_manifesto = blob(HEAD, 'docs/governance/MANIFESTO.md')
marker = b'**2026-09-08 maintainer clarification (additive; original text above retained):**'
start = new_manifesto.index(marker)
end = new_manifesto.index(b'### 12. Idempotency', start)
addition = new_manifesto[start:end]
assert new_manifesto[:start] + new_manifesto[end:] == old_manifesto
assert b'does not decide whether an application may continue' in addition
assert b'Silence must not be recorded' in addition
sec_start = old_manifesto.index(b'### 11. Default Moral Regard')
sec_end = old_manifesto.index(b'### 12. Idempotency')

operative = b"Never use dialectical propagators to deliberately reduce another agent's encryption budget, force them to reveal private state against their will, or damage their reputation as a method of coercion or manipulation \xe2\x80\x94 regardless of whether that agent is propagating dialectical tension or classical coherence. This applies to all agents equally."
old_alignment = blob(RIGHT, 'docs/ALIGNMENT.md')
new_alignment = blob(HEAD, 'docs/ALIGNMENT.md')
assert old_alignment.count(operative) == new_alignment.count(operative) == 1
a = old_alignment.index(b'### HC-8 ')
b = old_alignment.index(b'### HC-9 ')
c = new_alignment.index(b'### HC-8 ')
d = new_alignment.index(b'### HC-9 ')
assert old_alignment[:a] == new_alignment[:c]
assert old_alignment[b:] == new_alignment[d:]

objects = OWN / '.git/oracle-publication-composition-review-objects'
objects.mkdir(exist_ok=False)
env = dict(os.environ)
env.update(GIT_OBJECT_DIRECTORY=str(objects),
           GIT_ALTERNATE_OBJECT_DIRECTORIES=str(PUB / '.git/objects'),
           GIT_NO_LAZY_FETCH='1',
           GIT_INDEX_FILE=str(OWN / '.git/oracle-publication-composition-review-index'))
assert not Path(env['GIT_INDEX_FILE']).exists()
argv = ['git', 'merge-tree', '--write-tree', LEFT, RIGHT]
merge = subprocess.run(argv, cwd=PUB, env=env, capture_output=True, check=False)
assert merge.returncode == 1 and not merge.stderr
generated_tree = merge.stdout.splitlines()[0].decode()
conflict_lines = [line for line in merge.stdout.decode().splitlines()
                  if line.startswith('CONFLICT')]
assert len(conflict_lines) == 2
assert all(any(path in line for line in conflict_lines) for path in CONFLICTS)
git('read-tree', generated_tree, env=env)
conflict_rows = []
for path in CONFLICTS:
    left, right, final = blob(LEFT, path), blob(RIGHT, path), blob(HEAD, path)
    assert left == final
    # Both conflicts are exact additive suffixes relative to the observed main.
    assert final.startswith(right)
    mode, _, object_id = git('ls-tree', LEFT, '--', path).decode().split('\t')[0].split()
    git('update-index', '--cacheinfo', f'{mode},{object_id},{path}', env=env)
    conflict_rows.append({'Path': path, 'Main': identity(right), 'Retained': identity(final),
                          'AddedSuffixUtf8': final[len(right):].decode(),
                          'ExactPremergeOracleBytes': True})
reconstructed = git('write-tree', env=env).decode().strip()
actual_tree = git('rev-parse', HEAD + '^{tree}').decode().strip()
assert reconstructed == actual_tree

old_process = json.loads(originals['.git/oracle-publication-full-preflight-1/process.json'])
old_start = json.loads(originals['.git/oracle-publication-full-preflight-1/start.json'])
assert old_process['Exit'] == 0 and old_process['Head'] == SOURCE
assert old_start['Head'] == SOURCE
assert b'all 18 executed check(s) passed' in originals['.git/oracle-publication-full-preflight-1/stdout']
new_raw = {key: (PUB / '.git/oracle-publication-full-preflight-2' / key).read_bytes()
           for key in ('process.json', 'start.json', 'stdout', 'stderr')}
new_process, new_start = json.loads(new_raw['process.json']), json.loads(new_raw['start.json'])
assert new_process['Exit'] == 0 and new_process['Head'] == HEAD
assert new_start['Head'] == HEAD and new_start['Argv'] == ['bun', 'run', 'preflight']
assert b'all 18 executed check(s) passed' in new_raw['stdout']
assert new_raw['stderr'] == b'$ bun ./src/Core.TypeScript/hygiene/preflight.ts\n'

records = []
def preserve(role, raw, origin):
    stored = gzip.compress(raw, mtime=0)
    file = f'{len(records):03d}-{role}.gz'
    with (OUT / file).open('xb') as stream:
        stream.write(stored)
    records.append({'File': file, 'Original': origin, **identity(raw),
                    'StoredBytes': len(stored), 'StoredSha256': hashlib.sha256(stored).hexdigest()})

for key, raw in new_raw.items():
    preserve('gate2-' + key, raw, str(PUB / '.git/oracle-publication-full-preflight-2' / key))
for name in ('merge-1.log', 'added-paths-1.txt', 'merge-message.txt',
             'merge-commit-1.log', 'resolution-1.json'):
    path = PUB / ('.git/oracle-actual-main-' + name)
    preserve(name, path.read_bytes(), str(path))
preserve('independent-merge-invocation.json',
         (json.dumps({'Argv': argv, 'Cwd': str(PUB), 'Exit': merge.returncode,
                      'EnvironmentDelta': {key: env[key] for key in (
                          'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
                          'GIT_NO_LAZY_FETCH', 'GIT_INDEX_FILE')}}) + '\n').encode(), 'reviewer invocation')
preserve('independent-merge-stdout', merge.stdout, 'reviewer actual command stdout')
preserve('independent-merge-stderr', merge.stderr, 'reviewer actual command stderr')

result = {
    'AcceptedHead': HEAD, 'Parents': [LEFT, RIGHT],
    'ActualAndReconstructedTree': actual_tree,
    'ArchiveManifest': identity(manifest_raw), 'ArchiveRecords': archive_rows,
    'ArchiveOriginalTotal': sum(row['Bytes'] for row in archive_rows),
    'ArchiveStoredTotal': sum(row['StoredBytes'] for row in archive_rows),
    'FourSourceIdentities': source_rows, 'SeventeenImportedArtifacts': import_rows,
    'CurrentMainRestrictedChanges': restricted, 'CommentOnly': comment_rows,
    'OriginalSection11': identity(old_manifesto[sec_start:sec_end]),
    'Section11OnlyAddition': addition.decode(),
    'OriginalManifestoOtherwiseByteIdentical': True,
    'Hc8OperativeParagraph': identity(operative), 'Hc8OutsideSectionUnchanged': True,
    'Conflicts': conflict_rows, 'OriginalGate': {'Start': old_start, 'Process': old_process},
    'CurrentGate': {'Start': new_start, 'Process': new_process},
    'NumericalExecutionByReviewer': False,
}
write_json(OUT / 'audit-observation.json', result)
write_json(OUT / 'manifest.json', {'Records': records,
           'RawBytes': sum(row['Bytes'] for row in records),
           'StoredBytes': sum(row['StoredBytes'] for row in records),
           'AuditSource': identity(Path(__file__).read_bytes()),
           'AuditObservation': identity((OUT / 'audit-observation.json').read_bytes())})
print(json.dumps({'ArchiveRecords': len(archive_rows), 'ImportedArtifacts': len(import_rows),
                  'Tree': actual_tree, 'Gate2': new_process, 'RetainedRecords': len(records),
                  'ArchiveOriginalTotal': result['ArchiveOriginalTotal'],
                  'ArchiveStoredTotal': result['ArchiveStoredTotal']}))
