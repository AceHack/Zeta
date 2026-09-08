"""Read retained PR17051 publication bytes; execute only bounded Git checks.

This fixed local audit uses normal Python assertions. It is not an admission
service for arbitrary archives or an assertions-disabled safety guarantee.
No audited helper, numerical module, driver, or test suite is executed.
"""

import collections
import datetime
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import tomllib


PUB = Path('/Users/acehack/.zeta/agents/codex/Zeta-projection-publication-20260908')
OWN = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-training-reference-20260906')
PACKET = 'docs/research/research-main-publication/2026-09-08/pr-17051'
CUT = '4fc4df58b031974f6f371f4cb1a58e19a630f33f'
CORRECTED = '6608fdacc5dce7da60cb0f61d004726b65d78ff0'
HEAD = '212758f124fbe7d42cf8073c7863fa99183c1d1a'
MERGE = 'f59b6e395603062882dd1fe69fa8247406842e4d'
BASE = '0d29df2db91b001bb1b7e39f6c55e906116f328b'
TREE = 'a32ee7be86a34c4a7cc39f99bd8b09243ef21ff9'
SOURCE = 'f33ac42959388344fc3c82058f165764954fa22d'
REGISTER = 'docs/research/2026-09-08-precision-gate-projection-integration-register.md'
HANDOFF = 'docs/handoffs/2026-09-08-vera-projection-and-composable-learning-continuation.md'
commands = []


def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest().upper()}


def git(*args, own=False):
    cwd = OWN if own else PUB
    env = os.environ.copy()
    env['GIT_OPTIONAL_LOCKS'] = '0'
    if own:
        env['GIT_ALTERNATE_OBJECT_DIRECTORIES'] = str(PUB / '.git/objects')
    argv = ['git', *args]
    start = datetime.datetime.now(datetime.UTC).isoformat()
    result = subprocess.run(argv, cwd=cwd, env=env, capture_output=True, timeout=30, check=False)
    commands.append({'Argv': argv, 'Cwd': str(cwd), 'Start': start,
                     'End': datetime.datetime.now(datetime.UTC).isoformat(),
                     'ExitCode': result.returncode, 'Stdout': identity(result.stdout),
                     'Stderr': identity(result.stderr),
                     'StderrText': result.stderr.decode('utf-8', errors='strict')})
    result.check_returncode()
    return result.stdout


def committed(path, cut=CUT):
    return git('show', cut + ':' + path)


manifest_raw = committed(PACKET + '/manifest.json')
archive_raw = committed(PACKET + '/custody.tar.gz')
manifest = json.loads(manifest_raw)
assert manifest['Schema'] == 'zeta.research-main-custody.v1'
assert (manifest['PR'], manifest['SourceHead'], manifest['Merge'], manifest['ObservedMain']) == (17051, HEAD, MERGE, MERGE)
assert identity(archive_raw) == {'Bytes': 338621, 'Sha256': '3C0845830B19D7ACBEBF80AFFC57B8A86DD6AEFD8F021ACF7FEF24FA7481C373'}
assert manifest['ArchiveBytes'] == len(archive_raw)
assert manifest['ArchiveSha256'] == identity(archive_raw)['Sha256']
assert manifest['Archive'] == 'custody.tar.gz'
local_manifest_raw = (PUB / PACKET / 'manifest.json').read_bytes()
assert local_manifest_raw == manifest_raw
local_archive_raw = (PUB / PACKET / 'custody.tar.gz').read_bytes()
assert local_archive_raw == archive_raw
corrected_manifest_raw = committed(PACKET + '/manifest.json', CORRECTED)
assert corrected_manifest_raw == manifest_raw
corrected_archive_raw = committed(PACKET + '/custody.tar.gz', CORRECTED)
assert corrected_archive_raw == archive_raw

expected = {row['ArchivePath']: row for row in manifest['Members']}
assert len(expected) == len(manifest['Members']) == manifest['MemberCount'] == 162
retained = {}
inventory = []
with tarfile.open(fileobj=io.BytesIO(archive_raw), mode='r:gz') as archive:
    members = archive.getmembers()
    assert len(members) == 162
    for member in members:
        path = PurePosixPath(member.name)
        assert member.isfile() and not path.is_absolute() and '..' not in path.parts
        assert path.parts[0] == 'originals' and member.name not in retained
        row = expected[member.name]
        assert 0 <= member.size == row['Bytes'] <= 2 * 1024 * 1024
        stream = archive.extractfile(member)
        assert stream is not None
        with stream:
            raw = stream.read(member.size + 1)
        assert identity(raw) == {'Bytes': row['Bytes'], 'Sha256': row['Sha256']}
        original = PurePosixPath(row['OriginalPath'])
        assert not original.is_absolute() and original.parts[0] == '.git' and '..' not in original.parts
        original_raw = (PUB / str(original)).read_bytes()
        assert original_raw == raw
        retained[member.name] = raw
        inventory.append({**row, 'LocalOriginalEqual': True})
assert set(retained) == set(expected)
assert sum(len(raw) for raw in retained.values()) == manifest['OriginalBytes'] == 3545216


def raw(name):
    return retained['originals/' + name]


def obj(name):
    return json.loads(raw(name))


def instant(value):
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))


final = obj('pr-17051-observation-final/stdout-0.json')
assert not final.get('errors')
pr = final['data']['repository']['pullRequest']
assert (pr['number'], pr['headRefOid'], pr['state'], pr['mergeable'], pr['mergeStateStatus']) == (17051, HEAD, 'OPEN', 'MERGEABLE', 'CLEAN')
assert pr['isDraft'] is False and pr['autoMergeRequest'] is None
contexts = pr['commits']['nodes'][0]['commit']['statusCheckRollup']['contexts']
threads = pr['reviewThreads']
assert contexts['pageInfo']['hasNextPage'] is False
assert threads['pageInfo']['hasNextPage'] is False
assert contexts['totalCount'] == len(contexts['nodes']) == 92
assert len({x['id'] for x in contexts['nodes']}) == 92
assert all(x['__typename'] == 'CheckRun' and x['status'] == 'COMPLETED' for x in contexts['nodes'])
conclusions = dict(collections.Counter(x['conclusion'] for x in contexts['nodes']))
assert conclusions == {'SKIPPED': 2, 'SUCCESS': 90}
assert threads['totalCount'] == len(threads['nodes']) == 1
thread = threads['nodes'][0]
assert thread['id'] == 'PRRT_kwDOSF9kNM6gLV_y'
assert thread['isResolved'] is True and thread['isOutdated'] is True
summary = obj('pr-17051-observation-final/summary.json')
assert summary['ContextCount'] == 92 and summary['Conclusions'] == conclusions
assert summary['Outstanding'] == summary['Unresolved'] == [] and summary['Pages'] == 1
observation_call = obj('pr-17051-observation-final/invocation-0.json')
assert observation_call['exit'] == 0 and raw('pr-17051-observation-final/stderr-0.txt') == b''
assert observation_call['argv'][:4] == ['/opt/homebrew/bin/gh', 'api', 'graphql', '--input']
request = obj('pr-17051-observation-final/request-0.json')
assert request['variables']['includeContexts'] is True and request['variables']['includeThreads'] is True

required = obj('pr-17051-merge-preparation-1/required.stdout')
rules = obj('pr-17051-merge-preparation-1/main-rules.stdout')
dependency = obj('pr-17051-merge-preparation-1/dependency-status.stdout')
assert len(required) == 1 and required[0]['name'] == 'gate (required)' and required[0]['state'] == 'SUCCESS'
assert any(x['name'] == 'gate (required)' and x['conclusion'] == 'SUCCESS' for x in contexts['nodes'])
status_rules = [r for r in rules if r['type'] == 'required_status_checks']
assert len(status_rules) == 1
assert status_rules[0]['parameters']['required_status_checks'] == [{'context': 'gate (required)', 'integration_id': 15368}]
assert dependency['status']['indicator'] == 'none' and dependency['incidents'] == []
components = {c['name']: c['status'] for c in dependency['components']}
assert all(components[n] == 'operational' for n in ('Git Operations', 'API Requests', 'Pull Requests', 'Actions'))
preparation_calls = [obj('pr-17051-merge-preparation-1/' + name + '-call.json') for name in ('required', 'main-rules', 'dependency-status')]
for name, call in zip(('required', 'main-rules', 'dependency-status'), preparation_calls, strict=True):
    assert call['exit'] == 0 and raw('pr-17051-merge-preparation-1/' + name + '.stderr') == b''
    assert instant(observation_call['end']) < instant(call['start']) < instant(call['end'])

merge_call = obj('pr-17051-merge-1/invocation.json')
merge_end = obj('pr-17051-merge-1/completion.json')
assert merge_call['argv'][:7] == ['/opt/homebrew/bin/gh', 'pr', 'merge', '17051', '--squash', '--match-head-commit', HEAD]
assert merge_call['argv'][7] == '--subject' and merge_call['argv'][9:] == ['--body-file', '.git/pr-17051-merge-1/body.md']
assert merge_end['exit'] == 0
assert raw('pr-17051-merge-1/stdout') == raw('pr-17051-merge-1/stderr') == b''
assert all(instant(c['end']) < instant(merge_call['start']) for c in preparation_calls)

proof = obj('pr-17051-main-proof-1/proof.json')
merged_pr = obj('pr-17051-main-proof-1/0-stdout')
assert merged_pr == proof['PR']
assert (merged_pr['number'], merged_pr['state'], merged_pr['headRefOid'], merged_pr['mergeCommit']['oid']) == (17051, 'MERGED', HEAD, MERGE)
assert merged_pr['mergedAt'] == '2026-09-08T10:11:44Z'
assert instant(merge_call['start']) < instant(merged_pr['mergedAt']) < instant(merge_end['end'])
calls = obj('pr-17051-main-proof-1/calls.json')
assert len(calls) == 18 and all(c['exit'] == 0 for c in calls)
assert instant(merge_end['end']) < instant(calls[0]['start'])
assert all(instant(c['start']) <= instant(c['end']) for c in calls)
assert all(instant(a['end']) <= instant(b['start']) for a, b in zip(calls, calls[1:]))
assert raw('pr-17051-main-proof-1/2-stdout') == (MERGE + '\n').encode()
assert proof['MergeParent'] == proof['Base'] == BASE and proof['ObservedMain'] == MERGE
observed_parent = git('rev-parse', MERGE + '^').decode().strip()
assert observed_parent == BASE
observed_base = git('merge-base', BASE, HEAD).decode().strip()
assert observed_base == BASE
# This is the sole Git object-writing operation, directed to our own clone.
recomputed = git('merge-tree', '--write-tree', BASE, HEAD, own=True).decode().strip()
assert recomputed == TREE == proof['ExpectedWholeTree'] == proof['MergedWholeTree']
observed_merge_tree = git('rev-parse', MERGE + '^{tree}').decode().strip()
assert observed_merge_tree == TREE
observed_head_tree = git('rev-parse', HEAD + '^{tree}').decode().strip()
assert observed_head_tree == TREE
git('merge-base', '--is-ancestor', MERGE, proof['ObservedMain'])
changed_raw = git('diff', '--no-renames', '--name-only', '-z', BASE, HEAD)
assert changed_raw == raw('pr-17051-main-proof-1/8-stdout')
paths = changed_raw.decode().split('\0')
assert paths[-1] == ''
paths = paths[:-1]
assert len(paths) == len(set(paths)) == 1063 == proof['ChangedPathCountNoRenames']
maps = []
for ordinal, tree in zip((9, 10, 11), (TREE, MERGE, proof['ObservedMain']), strict=True):
    tree_raw = git('ls-tree', '-r', '-z', tree, '--', *paths)
    assert tree_raw == raw(f'pr-17051-main-proof-1/{ordinal}-stdout')
    entries = [s.split('\t', 1) for s in tree_raw.decode().split('\0') if s]
    mapping = {path: value for value, path in entries}
    assert len(mapping) == len(entries)
    maps.append(mapping)
rows = [{'Path': p, 'Expected': maps[0].get(p), 'Merged': maps[1].get(p), 'ObservedMain': maps[2].get(p)} for p in paths]
assert rows == proof['Paths']
assert all(row['Expected'] == row['Merged'] == row['ObservedMain'] for row in rows)
assert proof['WholeTreeEqual'] is True and proof['AllPathsEqualOnObservedMain'] is True

view = obj('pr-17051-main-proof-1/shared-view.json')
assert view == {'Path': '/Users/acehack/Documents/src/repos/Zeta', 'BeforeClean': True,
                'Branch': 'main', 'AfterClean': True, 'Head': MERGE, 'MergeIsAncestor': True}
view_argv = [['git', 'status', '--porcelain'], ['git', 'branch', '--show-current'],
             ['git', 'pull', '--ff-only', 'origin', 'main'], ['git', 'status', '--porcelain'],
             ['git', 'rev-parse', 'HEAD'], ['git', 'merge-base', '--is-ancestor', MERGE, 'HEAD']]
assert [c['argv'] for c in calls[12:]] == view_argv
assert all(c['cwd'] == view['Path'] for c in calls[12:])
assert raw('pr-17051-main-proof-1/12-stdout') == raw('pr-17051-main-proof-1/15-stdout') == b''
assert raw('pr-17051-main-proof-1/13-stdout') == b'main\n'
assert raw('pr-17051-main-proof-1/16-stdout') == (MERGE + '\n').encode()
assert raw('pr-17051-main-proof-1/17-stdout') == b''

watch = obj('pr-17051-final-ci-watch-1/invocation.json')
watch_end = obj('pr-17051-final-ci-watch-1/completion.json')
assert watch['argv'] == ['/opt/homebrew/bin/gh', 'run', 'watch', '34211206223', '--exit-status', '--interval', '60']
assert watch_end['exit'] == 0 and raw('pr-17051-final-ci-watch-1/stderr.txt') == b''
assert instant(watch['start']) < instant(watch_end['end']) < instant(observation_call['start'])
assert '/actions/runs/34211206223/' in required[0]['link']

before = committed(REGISTER)
after = committed(REGISTER, CORRECTED)
assert b'strict mypy/format checks over all 14 projection source/test files.' in before
assert b'with the recorded mypy and format checks over all 14 projection\nsource/test files.' in after
assert before.replace(b'seconds and strict mypy/format checks over all 14 projection source/test files.',
                      b'seconds, with the recorded mypy and format checks over all 14 projection\nsource/test files.') == after
corrected_paths = git('diff', '--name-only', CUT, CORRECTED).decode().splitlines()
assert corrected_paths == [REGISTER]
typing_raw = (PUB / '.git/projection-assembled-python-gate-1/2-invocation.json').read_bytes()
typing_call = json.loads(typing_raw)
assert '--strict' not in typing_call['Argv'] and '--follow-imports=silent' in typing_call['Argv']
assert len([p for p in typing_call['Argv'] if p.endswith('.py')]) == 14
configuration_raw = committed('src/Interp.Python/pyproject.toml', SOURCE)
configuration = tomllib.loads(configuration_raw.decode())
assert 'strict' not in configuration['tool']['mypy']
for path in ('mypy.ini', '.mypy.ini', 'setup.cfg', 'pyproject.toml'):
    root_configuration_entry = git('ls-tree', '--name-only', SOURCE, '--', path)
    assert root_configuration_entry == b''
handoff = committed(HANDOFF)
corrected_handoff = committed(HANDOFF, CORRECTED)
assert handoff == corrected_handoff
assert b'compiled-controller investment stays paused' in handoff
assert b'It has not\nimplemented a new learning module or opened a dataset.' in handoff
assert b'reference IterationLimit and certificate NoRootEnclosure.' in handoff
assert b'6f5c62198aaee8f758d726e0c4c514f3bab57b9a' in handoff

result = {
    'Schema': 'zeta.pr17051-independent-publication-review.v1', 'Complete': True,
    'SourceCut': CUT, 'CorrectedCut': CORRECTED, 'Manifest': identity(manifest_raw),
    'Archive': identity(archive_raw), 'MemberCount': len(inventory),
    'OriginalBytes': 3545216, 'Members': inventory,
    'FinalConclusions': conclusions, 'ContextCount': 92, 'UnresolvedThreads': 0,
    'RetainedResolvedOutdatedThread': thread['id'], 'FinalObservation': observation_call,
    'RequiredChecks': required, 'Rules': rules, 'DependencyComponents': components,
    'PreparationCalls': preparation_calls, 'MergeInvocation': merge_call, 'MergeCompletion': merge_end,
    'MergedPR': merged_pr, 'RecomputedWholeTree': recomputed,
    'NoRenameChangedPaths': len(rows), 'DeletedPaths': sum(r['Expected'] is None for r in rows),
    'Paths': rows, 'HistoricalSharedView': view, 'HistoricalProofCalls': calls,
    'WorkflowWatch': watch, 'WorkflowWatchCompletion': watch_end,
    'WordingCorrection': {'Before': identity(before), 'After': identity(after),
                          'TypingInvocation': identity(typing_raw), 'Argv': typing_call['Argv'],
                          'HistoricalMypyConfiguration': identity(configuration_raw)},
    'Handoff': identity(handoff), 'ReviewerGitCalls': commands,
    'NumericalServicesExecuted': False, 'HistoricalWorkflowRerun': False,
    'NewProposalReReviewed': False, 'FutureMainImmutabilityClaimed': False,
}
print(json.dumps(result, indent=2) + '\n', end='')
