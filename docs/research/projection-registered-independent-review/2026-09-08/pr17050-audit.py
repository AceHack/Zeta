"""Independent bounded read-only custody check of the prior main receipt."""

import hashlib
import io
import json
import pathlib
import subprocess
import tarfile
import zlib
from collections import Counter

P = pathlib.Path('/Users/acehack/.zeta/agents/codex/Zeta-projection-publication-20260908')
G = pathlib.Path('/Users/acehack/.zeta/agents/codex/Zeta-oracle-grounding-publication-20260908')
D = P/'docs/research/research-main-publication/2026-09-08/pr-17050'


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def git(*args):
    return subprocess.run(['git',*args],cwd=G,capture_output=True,check=True).stdout.decode().strip()


m = json.loads((D/'manifest.json').read_bytes()); raw = (D/m['Archive']).read_bytes()
assert len(raw) == m['Bytes'] == 8623
assert sha(raw) == m['Sha256'] == 'E87FBCAA7E6EAB47BD577747A4D6385A2711D0252DA9EAFCD5044F6D4902A858'
gz=zlib.decompressobj(31); data=gz.decompress(raw,8*1024*1024)
assert gz.eof and not gz.unused_data and not gz.unconsumed_tail
expected={r['Path']:r for r in m['Members']}
assert len(expected)==len(m['Members'])==m['MemberCount']==55
records={}
with tarfile.open(fileobj=io.BytesIO(data),mode='r:') as tf:
    members=tf.getmembers(); assert len(members)==55 and {x.name for x in members}==set(expected)
    for member in members:
        assert member.isfile()
        r=expected[member.name]; b=tf.extractfile(member).read()
        assert len(b)==r['Bytes'] and sha(b)==r['Sha256']
        assert pathlib.Path(r['OriginalPath']).read_bytes()==b
        records[member.name]=b


def obj(n):
    return json.loads(records[n])


pr=obj('pr-17050-merge-preparation-1/graphql.stdout')['data']['repository']['pullRequest']
head='2d6161be620d6af3897a7651e11477753a4b7319'; merge='0d29df2db91b001bb1b7e39f6c55e906116f328b'
assert pr['headRefOid']==head and pr['state']=='OPEN' and not pr['isDraft']
assert not pr['reviewThreads']['pageInfo']['hasNextPage'] and pr['reviewThreads']['nodes']==[]
contexts=pr['commits']['nodes'][0]['commit']['statusCheckRollup']['contexts']
assert not contexts['pageInfo']['hasNextPage'] and len(contexts['nodes'])==contexts['totalCount']==91
counts=Counter(r['conclusion'] for r in contexts['nodes'])
assert counts=={'SUCCESS':88,'SKIPPED':3} and all(r['status']=='COMPLETED' for r in contexts['nodes'])
inv=obj('pr-17050-merge-1/invocation.json'); completion=obj('pr-17050-merge-1/completion.json')
assert inv['Argv'][1:7]==['pr','merge','17050','--squash','--match-head-commit',head]
assert completion['Exit']==0 and completion['FinishedUnix']>=inv['StartedUnix']
proof=obj('pr-17050-main-proof-1/proof.json')
assert proof['Head']==head and proof['Merge']==merge and proof['ObservedMain']==merge
assert proof['Base']==proof['MergeParent']==git('rev-parse',merge+'^')
assert git('merge-base',proof['Base'],head)==proof['Base']
assert git('rev-parse',head+'^{tree}')==git('rev-parse',merge+'^{tree}')==proof['ExpectedWholeTree']==proof['MergedWholeTree']=='ce3144e4055510aafecec30ff5d7dc95ff787e19'
paths=git('diff','--name-only','--no-renames',proof['Base'],head).splitlines()
assert paths==[r['Path'] for r in proof['Paths']] and len(paths)==proof['ChangedPathCountNoRenames']==17
for r in proof['Paths']:
    for commit,k in [(head,'Expected'),(merge,'Merged'),(proof['ObservedMain'],'ObservedMain')]:
        row=git('ls-tree',commit,'--',r['Path'])
        assert row.split('\t')[0]==r[k]
print(json.dumps({'Accepted':True,'Records':55,'PayloadBytes':sum(map(len,records.values())),
                  'ArchiveBytes':len(raw),'ArchiveSha256':sha(raw),'Head':head,'Merge':merge,
                  'ChangedPathsNoRenames':17,'WholeTree':proof['MergedWholeTree'],'ObservedChecks':dict(counts),
                  'Scope':'retained dated main receipt; no live API or historical CI rerun'},indent=2))
