from pathlib import Path
import subprocess, hashlib, json, gzip
p=Path('/Users/acehack/.zeta/agents/codex/Zeta-compiled-evidence-publication-20260907')
r=Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
pin='b65679674760e64bfe34e903646a2fd211d2420d'; before='19efca924f6765bbdd3b4017f707fa8f08302bd1'; base='5585c17c81e06878570bb1630786473e7fbec27f'
def git(*args): return subprocess.check_output(['git',*args],cwd=p)
def sha(b): return hashlib.sha256(b).hexdigest()
assert not git('diff','--name-only',before,pin,'--','src','tests')
changed=git('diff','--name-only',base,pin,'--','src','tests').decode().splitlines()
assert len(changed)==5
for name in changed: assert git('show',pin+':'+name)==git('show',before+':'+name)
claims=['docs/claims/task-distributional-learning-20260908.md','docs/claims/task-hidden-switch-compiled-20260907.md']
for name in claims:
 assert not git('ls-tree',pin,'--',name)
 assert (r/name).is_file() and 'active' in (r/name).read_text().lower()
folder=Path('docs/research/distributional-learning/2026-09-08/integration-validation');raw=(p/folder/'manifest.json').read_bytes();m=json.loads(raw)
assert raw==git('show',pin+':'+str(folder/'manifest.json'))
assert m['SourceCommit']=='3d1da6b9f7505924a804974100e2758184f0fe7c'
tot=[0,0]; logs={}
for a in m['Artifacts']:
 s=(p/folder/a['File']).read_bytes(); o=gzip.decompress(s)
 assert s==git('show',pin+':'+str(folder/a['File']))
 assert len(s)==a['StoredBytes'] and sha(s)==a['StoredSha256']
 assert len(o)==a['Bytes'] and sha(o)==a['Sha256']
 tot[0]+=len(s);tot[1]+=len(o);logs[a['File']]=o
assert b'all 18 executed check(s) passed' in logs['distributional-integration-full-preflight-1.log.gz']
assert b'all 16 executed check(s) passed' in logs['distributional-root-preservation-push-1.log.gz']
remote=logs['distributional-root-preservation-remote-1.txt.gz'].decode().splitlines()
assert len(remote)==4 and all(x.split()[0]==m['SourceCommit'] for x in remote)
gate=(p/'.git/distributional-publication-full-preflight-1.log').read_bytes()
assert b'all 18 executed check(s) passed' in gate
failed=(p/'.git/distributional-publication-parent-claim-omission-1.log').read_bytes()
assert all(name.encode() in failed for name in claims)
print(json.dumps({'Status':'passed','PublicationCut':pin,'FullGateSource':before,'NewSourceTestPaths':len(changed),'SourceChangesAfterGate':0,'ParentClaimsAbsentFromPublication':True,'RootClaimsPresent':True,'IntegrationArchiveRecords':len(m['Artifacts']),'IntegrationStoredBytes':tot[0],'IntegrationOriginalBytes':tot[1],'IntegrationManifestBytes':len(raw),'IntegrationManifestSha256':sha(raw),'PublicationGateBytes':len(gate),'PublicationGateSha256':sha(gate),'OriginalRemovalFailureBytes':len(failed),'OriginalRemovalFailureSha256':sha(failed)},indent=2))
