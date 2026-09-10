"""Audit retained PR17041 metadata and local Git trees; no numerical work."""

import collections
import gzip
import hashlib
import json
import pathlib
import subprocess

PUB = pathlib.Path('/Users/acehack/.zeta/agents/codex/Zeta-compiled-evidence-publication-20260907')
REVIEW = pathlib.Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-training-reference-20260906')
OUT = pathlib.Path(__file__).resolve().parent
HELD = []


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read(path):
    raw = path.read_bytes()
    assert len(raw) <= 2 * 1024 * 1024
    HELD.append({'Path': str(path), 'Bytes': len(raw), 'Sha256': sha(raw)})
    return raw


def git(*args):
    p = subprocess.run(['git', *args], cwd=PUB, capture_output=True, timeout=30, check=True)
    assert p.stderr == b''
    return p.stdout


base = PUB / '.git/pr-17041-main-proof-1'
proof = json.loads(read(base / 'proof.json'))
assert proof['Head'] == '7aeaf5687fa7668c770ba60e438c193a58a6af21'
assert proof['Merge'] == proof['ObservedMain'] == '155d45e32d01152004a03862213550ada96fb036'
assert proof['Parent'] == 'd35c2b35d1b06d04427a9a4f6972bd1331305af8'
assert proof['ExpectedThreeWayTree'] == proof['ActualTree'] == 'ea55686f5cb2a8005ce1cc831fb876d86df28ad6'
paths = [row['Path'] for row in proof['Paths']]
assert len(paths) == len(set(paths)) == 346
assert all(row['MatchesObservedMain'] is True for row in proof['Paths'])
for stem, value in [('expected-tree', proof['ExpectedThreeWayTree']),
                    ('actual-tree', proof['ActualTree']), ('observed-main', proof['ObservedMain']),
                    ('merge-parent', proof['Parent'])]:
    assert read(base / (stem + '.stdout')) == (value + '\n').encode()
    assert read(base / (stem + '.stderr')) == b''
assert read(base / 'paths.stdout').decode().splitlines() == paths
assert read(base / 'paths.stderr') == b''
assert read(base / 'ancestry.stdout') == read(base / 'ancestry.stderr') == b''

full = git('diff', '--no-renames', '--name-only', proof['Parent'], proof['Merge']).decode().splitlines()
missing = sorted(set(full) - set(paths))
assert len(full) == len(set(full)) == 347
assert missing == ['workitems/081M1ZCHPWV087G0R002GG2PKY-publish-distributional-learning-controls-and-privacy-grant-r.md']
assert not set(paths) - set(full)
assert git('diff', '--name-only', proof['Parent'], proof['Merge']).decode().splitlines() == paths
merge_base = git('merge-base', proof['Parent'], proof['Head']).decode().strip()
assert git('diff', '--no-renames', '--name-only', merge_base, proof['Head']).decode().splitlines() == full


def tree(ref):
    raw = git('ls-tree', '-r', '-z', ref, '--', *full)
    rows = {}
    for row in raw.split(b'\0'):
        if row:
            _, path = row.split(b'\t', 1)
            rows[path.decode()] = row + b'\n'
    return rows


published, observed = tree(proof['Merge']), tree(proof['ObservedMain'])
for index, path in enumerate(paths):
    for scope, source in [('merge', published), ('main', observed)]:
        assert read(base / f'path-{index}-{scope}.stdout') == source.get(path, b'')
        assert read(base / f'path-{index}-{scope}.stderr') == b''
assert all(published.get(path) == observed.get(path) for path in full)
assert all(path not in published and path not in observed for path in missing)
corrected = json.loads(read(PUB / '.git/pr-17041-main-proof-2/proof.json'))
for key in ['Head', 'Merge', 'ObservedMain', 'Parent', 'ActualTree', 'ExpectedThreeWayTree']:
    assert corrected[key] == proof[key]
assert corrected['PathsArgv'] == ['git', 'diff', '--no-renames', '--name-only', proof['Parent'], proof['Merge']]
assert [row['Path'] for row in corrected['Paths']] == full
for row in corrected['Paths']:
    assert row['Matches'] is True
    assert row['MergeEntry'] == published.get(row['Path'], b'').decode().removesuffix('\n')
    assert row['MainEntry'] == observed.get(row['Path'], b'').decode().removesuffix('\n')
assert git('rev-parse', proof['Merge'] + '^{tree}').decode().strip() == proof['ActualTree']
assert git('rev-parse', proof['Merge'] + '^').decode().strip() == proof['Parent']
git('merge-base', '--is-ancestor', proof['Merge'], proof['ObservedMain'])

own = REVIEW / '.git/pr17041-review-tree-1'
independent = json.loads(read(own / 'invocation.json'))
assert independent['ReturnCode'] == 0
assert independent['Argv'] == ['git', 'merge-tree', '--write-tree', proof['Parent'], proof['Head']]
assert read(own / 'stdout') == (proof['ActualTree'] + '\n').encode()
assert read(own / 'stderr') == b''

obsdir = PUB / '.git/pr-17041-complete-observation-7'
request = json.loads(read(obsdir / '0-request.json'))
assert request['body']['variables']['number'] == 17041
raw_response = json.loads(read(obsdir / '0-response.json'))
assert raw_response['ok'] is True
response = json.loads(raw_response['value'])
assert not response.get('errors')
pr = response['data']['repository']['pullRequest']
assert pr['headRefOid'] == proof['Head'] and pr['state'] == 'OPEN'
assert pr['commits']['nodes'][0]['commit']['oid'] == proof['Head']
contexts = pr['commits']['nodes'][0]['commit']['statusCheckRollup']['contexts']
nodes = contexts['nodes']
assert contexts['totalCount'] == len(nodes) == len({row['id'] for row in nodes}) == 92
assert contexts['pageInfo']['hasNextPage'] is False
assert all(row['status'] == 'COMPLETED' for row in nodes)
counts = dict(collections.Counter(row['conclusion'] for row in nodes))
assert counts == {'SKIPPED': 2, 'SUCCESS': 89, 'FAILURE': 1}
assert [row['name'] for row in nodes if row['conclusion'] == 'FAILURE'] == ['drift (loud)']
assert [row['conclusion'] for row in nodes if row['name'] == 'gate (required)'] == ['SUCCESS']
assert pr['reviewThreads'] == {'totalCount': 0, 'pageInfo': {'hasNextPage': False, 'endCursor': None}, 'nodes': []}
summary = json.loads(read(obsdir / 'result.json'))
assert summary['calls'] == 1 and summary['result']['ok'] is True
assert summary['result']['value']['checks'] == {'ok': 91, 'inProgress': 0, 'pending': 0, 'failed': 1}
assert json.loads(read(PUB / '.git/pr-17041-bounded-gate-7.json')) == summary['result']
assert read(PUB / '.git/pr-17041-bounded-gate-7.stderr') == b''

rules = json.loads(read(PUB / '.git/pr-17041-main-rules-2.json'))
required = [r['parameters']['required_status_checks'] for r in rules if r['type'] == 'required_status_checks']
assert required == [[{'context': 'gate (required)', 'integration_id': 15368}]]
status = json.loads(read(PUB / '.git/pr-17041-githubstatus-2.json'))
assert status['status']['indicator'] == 'none' and not status['incidents']
drift = read(PUB / '.git/pr-17041-drift-loud-1.log')
assert b'29/58 executions failed (50.0%)' in drift
assert b'PUBLICATION OFF BY DECISION' in drift
assert b'EXIT 1 -- a drift signal is at its loudest band.' in drift
assert b'EXIT 0 -- main has a recent completed verdict' in drift
assert b'NOT in the `gate (required)` floor' in drift
merged = json.loads(read(PUB / '.git/pr-17041-merged-1.json'))
assert merged['headRefOid'] == proof['Head'] and merged['mergeCommit']['oid'] == proof['Merge']
assert merged['state'] == 'MERGED' and merged['mergedAt'] == '2026-09-08T05:24:19Z'
assert read(PUB / '.git/pr-17041-merge-1.stdout') == b''
assert read(PUB / '.git/pr-17041-merge-1.stderr') == b''
assert len(HELD) <= 1500 and sum(row['Bytes'] for row in HELD) <= 8 * 1024 * 1024

result = {
    'Scope': 'Retained metadata and local Git object audit only; no numerical execution',
    'Head': proof['Head'], 'Merge': proof['Merge'], 'MergeParent': proof['Parent'],
    'MergeBase': merge_base, 'ObservedMain': proof['ObservedMain'],
    'IndependentThreeWayTree': proof['ActualTree'], 'ThreeWayTreeMatches': True,
    'OriginalRenameAwarePaths': len(paths), 'OriginalRowsMatchGit': True,
    'NoRenamesChangedPaths': len(full), 'AllNoRenamesPathsMatchObservedMain': True,
    'CorrectedProofRowsMatchGit': True,
    'OriginalMissingPathChecks': missing, 'MissingOldPathAbsentInMergeAndObservedMain': True,
    'RawCheckConclusions': counts, 'UnresolvedReviewThreads': 0,
    'RulesRequiredChecks': required, 'RequiredNameObservedSuccessful': True,
    'CheckAppIdentityPresentInObservation': False,
    'ObservationTime': summary['observedAt'], 'MergedAt': merged['mergedAt'],
    'NormalMergeArgvAndExitSource': 'Coordinator tool observation; not derivable from empty redirected streams',
    'InputIdentities': HELD,
    'AuditSource': {'File': 'audit.py', 'Bytes': pathlib.Path(__file__).stat().st_size,
                    'Sha256': sha(pathlib.Path(__file__).read_bytes())},
}
raw = (json.dumps(result, indent=2) + '\n').encode()
stored = gzip.compress(raw, mtime=0)
with (OUT / 'result.json.gz').open('xb') as stream:
    stream.write(stored)
with (OUT / 'result-identity.json').open('xb') as stream:
    stream.write((json.dumps({'OriginalBytes': len(raw), 'OriginalSha256': sha(raw),
                             'StoredBytes': len(stored), 'StoredSha256': sha(stored)}, indent=2) + '\n').encode())
print(json.dumps({k: v for k, v in result.items() if k != 'InputIdentities'}))
print('Retained input identities:', len(HELD), 'bytes:', sum(row['Bytes'] for row in HELD))
