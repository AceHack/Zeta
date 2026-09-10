"""Read pinned Git/archive data only; do not extract or replay workloads."""
import collections
import hashlib
import io
import json
from pathlib import Path
import subprocess
import zlib

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-oracle-grounding-publication-20260908')
PIN = 'e6fd8fab2bbc2b2b119f6b475761af27830b5daf'
OBJECT_REPO = REPO


def git(*args):
    return subprocess.check_output(['git', '-C', str(OBJECT_REPO), *args])


def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}


def tree(ref):
    rows = git('ls-tree', '-r', '-z', ref).split(b'\0')
    return dict(row.split(b'\t', 1)[::-1] for row in rows if row)


def blob(path):
    raw = subprocess.check_output(['git', '-C', str(REPO), 'show', PIN + ':' + path])
    assert raw == (REPO / path).read_bytes(), path
    return raw


output = {'Source': PIN, 'Archives': []}
for pr, folder, expected_members, obs, expected_success in [
    (17045, 'magnet-history', 61, 'complete-observation-7', 89),
    (17048, 'oracle-grounding-publication', 101, 'observation-10', 90),
]:
    OBJECT_REPO = (Path('/Users/acehack/.zeta/agents/codex/Zeta-compiled-evidence-publication-20260907') if pr == 17045 else REPO)
    basepath = f'docs/research/{folder}/2026-09-08/pr-{pr}/'
    manifest_raw = blob(basepath + 'manifest.json')
    manifest = json.loads(manifest_raw)
    stored = blob(basepath + 'custody.tar.gz')
    assert identity(stored) == {'Bytes': manifest['StoredBytes'], 'Sha256': manifest['StoredSha256']}
    decoder = zlib.decompressobj(31)
    raw = decoder.decompress(stored, manifest['TarBytes'] + 1)
    assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
    assert identity(raw) == {'Bytes': manifest['TarBytes'], 'Sha256': manifest['TarSha256']}
    rows = manifest.get('Members', manifest.get('Records'))
    names = [r.get('Path', r.get('Member')) for r in rows]
    assert len(names) == len(set(names)) == expected_members
    import tarfile
    records = {}
    originals = 0
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        members = archive.getmembers()
        assert [m.name for m in members] == names
        for member, row in zip(members, rows):
            assert member.isfile() and not member.name.startswith('/') and '..' not in Path(member.name).parts
            content = archive.extractfile(member).read()
            assert identity(content) == {'Bytes': row['Bytes'], 'Sha256': row['Sha256']}
            records[member.name] = content
            original = OBJECT_REPO / row.get('Original', '.git/' + member.name)
            if original.is_file():
                assert original.read_bytes() == content, str(original)
                originals += 1
    def load(name):
        return json.loads(records[f'pr-{pr}-' + name])
    proof = load('main-proof-1/proof.json')
    head, merge = proof['Head'], proof['Merge']
    parent = git('rev-parse', merge + '^').decode().strip()
    assert parent == proof.get('Parent', proof.get('MergeParent'))
    mergebase = git('merge-base', parent, head).decode().strip()
    trees = {ref: tree(ref) for ref in (mergebase, parent, head, merge)}
    bt, pt, ht, mt = (trees[x] for x in (mergebase, parent, head, merge))
    # Independent whole-tree composition: no file-content merge was needed.
    composed = {}
    for name in set(bt) | set(pt) | set(ht):
        b, p, h = bt.get(name), pt.get(name), ht.get(name)
        if p == h or h == b:
            chosen = p
        elif p == b:
            chosen = h
        else:
            raise AssertionError(('Nontrivial three-way path', name))
        if chosen is not None:
            composed[name] = chosen
    assert composed == mt
    actual_tree = git('rev-parse', merge + '^{tree}').decode().strip()
    assert actual_tree == proof.get('ExpectedThreeWayTree', proof.get('ExpectedWholeTree'))
    assert actual_tree == proof.get('ActualTree', proof.get('MergedWholeTree'))
    assert proof['ObservedMain'] == merge
    subprocess.check_call(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', merge, PIN])
    paths = git('diff', '--no-renames', '--name-only', '-z', parent, merge).split(b'\0')[:-1]
    assert [p.decode() for p in paths] == [r['Path'] for r in proof['Paths']]
    for row in proof['Paths']:
        path = row['Path'].encode()
        entry = mt.get(path, b'').decode()
        if pr == 17045:
            full = entry + '\t' + row['Path'] if entry else ''
            assert row['MergeEntry'] == row['MainEntry'] == full and row['Matches'] is True
        else:
            assert row['Expected'] == row['Merged'] == row['ObservedMain'] == entry
    response = load(obs + '/0-response.json')
    assert response['ok'] is True
    result = json.loads(response['value'])['data']['repository']['pullRequest']
    assert result['headRefOid'] == head
    threads = result['reviewThreads']
    assert not threads['pageInfo']['hasNextPage']
    assert len(threads['nodes']) == threads['totalCount']
    assert all(t['isResolved'] for t in threads['nodes'])
    commit = result['commits']['nodes'][0]['commit']
    assert commit['oid'] == head
    contexts = commit['statusCheckRollup']['contexts']
    assert not contexts['pageInfo']['hasNextPage']
    assert len(contexts['nodes']) == contexts['totalCount'] == expected_success + 2
    counts = collections.Counter((r.get('status'), r.get('conclusion')) for r in contexts['nodes'])
    assert counts == {('COMPLETED', 'SUCCESS'): expected_success, ('COMPLETED', 'SKIPPED'): 2}
    inv = load('merge-invocation-1.json' if pr == 17045 else 'merge-1/invocation.json')
    argv = inv['Argv']
    assert argv[1:6] == ['pr', 'merge', str(pr), '--squash', '--match-head-commit']
    assert argv[6] == head and argv[7] == '--body-file' and len(argv) == 9
    process = inv if pr == 17045 else load('merge-1/process.json')
    assert process['Exit'] == 0
    assert records[f'pr-{pr}-merge-1.stderr' if pr == 17045 else f'pr-{pr}-merge-1/stderr'] == b''
    extra = {}
    if pr == 17045:
        source = git('show', merge + ':docs/ip-questionable/2026-09-08-magnet-paradox-memory-history-transcript.md')
        marker = b'<!-- BEGIN USER-SUPPLIED TRANSCRIPT -->\n````text\n'
        assert source.count(marker) == 1
        transcript = source.split(marker)[1].split(b'````\n<!-- END USER-SUPPLIED TRANSCRIPT -->')[0]
        assert identity(transcript) == {k: proof['TranscriptPayload'][k] for k in ('Bytes', 'Sha256')}
        assert transcript[:5] == b'0:00\n'
        assert identity(transcript[5:])['Sha256'] == 'd5bb0ce914152bc439fbc683f59522443b5904b2e685a24973603cd63865c148'
        extra['Transcript'] = identity(transcript)
    output['Archives'].append({
        'PR': pr, 'Manifest': identity(manifest_raw), 'Stored': identity(stored),
        'Tar': identity(raw), 'Members': len(records), 'PayloadBytes': sum(map(len, records.values())),
        'MatchingAvailableOriginals': originals, 'Head': head, 'Merge': merge,
        'Parent': parent, 'Base': mergebase, 'WholeTree': actual_tree,
        'IndependentSimpleThreeWayEquals': True, 'PathsNoRenames': len(paths),
        'RawSuccess': expected_success, 'RawSkipped': 2, 'UnresolvedThreads': 0,
        'MergeInvocation': inv, 'MergeProcess': process, **extra,
    })
changed = git('diff', '--name-only', '-z', 'b6bb61f2b255093790f8bdf84dc1b6f0f612f4d9', PIN).split(b'\0')[:-1]
assert len(changed) == 9 and all(p.startswith(b'docs/') for p in changed)
output['PublicationFiles'] = [{'Path': p.decode(), **identity(blob(p.decode()))} for p in changed]
print(json.dumps(output, indent=2))
