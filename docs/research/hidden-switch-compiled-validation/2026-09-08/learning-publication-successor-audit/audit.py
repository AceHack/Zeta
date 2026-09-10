"""Independent complete-tree and retained-CI audit, without project execution."""
import hashlib
import json
from pathlib import Path
import subprocess
import zlib

PUB = Path('/Users/acehack/.zeta/agents/codex/Zeta-compiled-evidence-publication-20260907')
OLD = '8cb522b2dab2fb50792a3d7ff6ef7f3af21f5e64'
OLD_BASE = '5585c17c81e06878570bb1630786473e7fbec27f'
NEW = '83beb2933937da4bfa7c07b4367373da10479f3e'
BASE = '4d69d7a8cf77fed897c11bb179713ca67692c22f'
PREFIX = 'docs/research/distributional-learning/2026-09-08/publication-successor/'
NOTE = 'docs/research/2026-09-08-distributional-learning-controls-publication.md'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=PUB)

def blob(commit, path):
    return git('show', commit + ':' + path)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def pairs(items):
    result = {}
    for key, value in items:
        assert key not in result
        result[key] = value
    return result

def parse(raw):
    return json.loads(raw, object_pairs_hook=pairs)

def tree(commit):
    result = {}
    for row in git('ls-tree', '-r', '-z', commit).split(b'\0'):
        if row:
            entry, path = row.split(b'\t')
            result[path.decode()] = entry.decode()
    return result

manifest_raw = blob(NEW, PREFIX + 'manifest.json')
manifest = parse(manifest_raw)
rows = manifest['Artifacts']
assert manifest['ArtifactCount'] == len(rows) == 23
assert manifest['OriginalHead'] == OLD and manifest['SuccessorBase'] == BASE
assert manifest['OriginalPr'] == 17021
assert manifest['ObservedCommitTotal'] == 278 and manifest['ApiCommitMessagesSupplied'] == 250
assert len({r['File'] for r in rows}) == 23
raws = {}
for row in rows:
    assert '/' not in row['File'] and row['Encoding'] == 'gzip'
    stored = blob(NEW, PREFIX + row['File'])
    assert len(stored) == row['StoredBytes'] and sha(stored) == row['StoredSha256']
    assert 0 <= row['Bytes'] <= 2 * 1024 * 1024
    decoder = zlib.decompressobj(31)
    raw = decoder.decompress(stored, row['Bytes'] + 1)
    assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
    assert len(raw) == row['Bytes'] and sha(raw) == row['Sha256']
    raws[row['OriginalPath']] = raw
assert len(raws) == 23
old, old_base, new, base = map(tree, [OLD, OLD_BASE, NEW, BASE])
original_changed = {p for p in old.keys() | old_base.keys() if old.get(p) != old_base.get(p)}
new_changed = {p for p in new.keys() | base.keys() if new.get(p) != base.get(p)}
assert len(original_changed) == 231 and len(new_changed) == 256
reported = parse(raws['distributional-successor-tree-before-docs-1.json'])
assert reported['Original'] == OLD and reported['OriginalBase'] == OLD_BASE and reported['SuccessorBase'] == BASE
assert reported['Mismatches'] == []
assert len(reported['PublicationPaths']) == manifest['PublicationPathCount'] == 230
renamed_from = 'workitems/081M1Z5ZW1T087G0R0002KPWJ8-publish-reviewed-compiled-replay-and-native-custody-evidence.md'
assert original_changed - set(reported['PublicationPaths']) == {renamed_from}
assert not set(reported['PublicationPaths']) - original_changed
assert renamed_from not in old and renamed_from not in new and renamed_from in old_base
changed_again = sorted(p for p in original_changed if new.get(p) != old.get(p))
assert changed_again == [NOTE]
archive_files = {PREFIX + row['File'] for row in rows} | {PREFIX + 'manifest.json', PREFIX + 'README.md'}
assert new_changed - original_changed == archive_files
assert all(new.get(p) == base.get(p) for p in new.keys() | base.keys() if p not in original_changed | archive_files)
assert git('show', '-s', '--format=%P', NEW).decode().strip() == BASE
assert b'finite publication claim was subsequently released' in blob(NEW, NOTE)
assert b'e8d41b2ed632b7abd5d6f0fe1905a882ec356f70' in blob(NEW, NOTE)
for name in ['task-distributional-publication-20260908.md', 'task-distributional-learning-20260908.md', 'task-hidden-switch-compiled-20260907.md']:
    assert 'docs/claims/' + name not in new
assert raws['distributional-successor-status-before-1.txt'] == b''
assert b'all 16 executed check(s) passed' in raws['distributional-publication-push-1.log']
assert OLD.encode() in raws['distributional-publication-remote-1.txt']
log = raws['pr-17021-agencysignature-failure-1.log'].decode()
for token in ['REFUSED (UNMEASURED)', '250 commit message(s)', '278 commits', 'Process completed with exit code 3']:
    assert token in log
request = parse(raws['pr-17021-complete-observation-1/0-request.json'])
assert request['body']['variables']['number'] == 17021
response = parse(raws['pr-17021-complete-observation-1/0-response.json'])
assert response['ok'] is True
pr = parse(response['value'])['data']['repository']['pullRequest']
assert pr['number'] == 17021 and pr['headRefOid'] == OLD
assert pr['state'] == 'OPEN' and pr['mergeCommit'] is None and pr['autoMergeRequest'] is None
assert pr['reviewThreads']['totalCount'] == 0 and pr['reviewThreads']['pageInfo']['hasNextPage'] is False
commit = pr['commits']['nodes'][0]['commit']
assert commit['oid'] == OLD
contexts = commit['statusCheckRollup']['contexts']
assert contexts['totalCount'] == len(contexts['nodes']) == 85 and contexts['pageInfo']['hasNextPage'] is False
assert len({r['id'] for r in contexts['nodes']}) == 85
failed = [r for r in contexts['nodes'] if r.get('conclusion') == 'FAILURE']
assert len(failed) == 1 and failed[0]['name'] == 'agencysignature (PR body)'
assert sum(r['status'] == 'IN_PROGRESS' for r in contexts['nodes']) == 37
observed = parse(raws['pr-17021-complete-observation-1/result.json'])
assert observed['calls'] == 1 and observed['result'] == parse(raws['pr-17021-bounded-gate-1.json'])
assert observed['result']['value']['gate'] == 'blocked'
assert observed['result']['value']['checks'] == {'ok': 47, 'inProgress': 37, 'pending': 0, 'failed': 1}
source_rows = manifest['SourceFiles']
assert len(source_rows) == 5
for row in source_rows:
    raw = blob(NEW, row['Path'])
    assert raw == blob(OLD, row['Path']) and len(raw) == row['Bytes'] and sha(raw) == row['Sha256']
assert {p for p in new_changed if p.startswith(('src/', 'tests/'))} == {r['Path'] for r in source_rows}
print(json.dumps({
    'ReviewedSuccessor': NEW, 'SoleParent': BASE, 'OriginalPublication': OLD,
    'ManifestBytes': len(manifest_raw), 'ManifestSha256': sha(manifest_raw),
    'Records': 23, 'StoredBytes': sum(r['StoredBytes'] for r in rows), 'OriginalBytes': sum(r['Bytes'] for r in rows),
    'AllSingleMemberGzipAndHashesMatch': True,
    'RenameAwareReportedNames': 230, 'ActualOriginalChangedTreePaths': 231,
    'AdditionalVerifiedDeletion': renamed_from, 'OriginalPathsDifferentOnlyAt': changed_again,
    'NewArchivePaths': 25, 'NewChangedTreePaths': 256, 'AllOtherBaseEntriesPreserved': True,
    'FiveSourceFilesUnchanged': source_rows, 'FiniteClaimTenseCorrected': True,
    'RecordedFailedPr': 17021, 'RecordedCoverageCounts': {'Supplied': 250, 'Total': 278},
    'CompleteRecordedCheckContexts': 85, 'RecordedGate': 'blocked',
    'SuccessorGithubOrMainAdmission': False, 'ScientificOrProjectExecutionsByReviewer': 0,
}, indent=2))
