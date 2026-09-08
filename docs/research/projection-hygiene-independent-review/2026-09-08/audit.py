"""Read-only source/AST/TOML and existing validation custody audit."""

import ast
import hashlib
import io
import json
import pathlib
import subprocess
import tarfile
import tomllib
import zlib

P = pathlib.Path('/Users/acehack/.zeta/agents/codex/Zeta-projection-publication-20260908')
D = P/'docs/research/precision-gate-projection/2026-09-08/publication-hygiene'
CUT = '809bc57bafe847d58e8387b9a4858c52300271f5'
SOURCE = 'f33ac42959388344fc3c82058f165764954fa22d'


def sha(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def git(*args):
    return subprocess.run(['git',*args],cwd=P,capture_output=True,check=True).stdout


def blob(commit,path):
    return git('show',f'{commit}:{path}')


m = json.loads((D/'manifest.json').read_bytes())
stored = (D/'custody.tar.gz').read_bytes()
assert len(stored)==m['Bytes']==693866
assert sha(stored)==m['Sha256']=='1313EA5CB4C6E2305985BB19778935C6887C12ABC0FABBFECB5AC8413FC6BF92'
gz=zlib.decompressobj(31);raw=gz.decompress(stored,16*1024*1024)
assert gz.eof and not gz.unused_data and not gz.unconsumed_tail
expected={r['Path']:r for r in m['Members']}
assert len(expected)==len(m['Members'])==m['MemberCount']==135
records={}
with tarfile.open(fileobj=io.BytesIO(raw),mode='r:') as tf:
    members=tf.getmembers()
    assert len(members)==135 and {x.name for x in members}==set(expected)
    for member in members:
        assert member.isfile()
        row=expected[member.name]; b=tf.extractfile(member).read()
        assert len(b)==row['Bytes']==member.size and sha(b)==row['Sha256']
        assert pathlib.Path(row['OriginalPath']).read_bytes()==b
        records[member.name]=b
for name in ('manifest.json','custody.tar.gz','changed-identities.json'):
    assert (D/name).read_bytes()==blob(CUT,str((D/name).relative_to(P)))

source_manifest=json.loads((P/'docs/research/precision-gate-projection/2026-09-08/implementation-source/implementation-manifest.json').read_bytes())
assert sha((P/'docs/research/precision-gate-projection/2026-09-08/implementation-source/implementation-manifest.json').read_bytes())=='FE1F5BDF732FA6B08092887210552BA9CEF68D724E519C77958A282366A348E7'
changes=[]
for row in source_manifest['SourceFiles']:
    path=row['Path']; before=records['projection-lint-cwd-correction-1/before/'+path]
    after=records['projection-lint-cwd-correction-1/after/'+path]
    assert len(before)==row['Bytes'] and sha(before)==row['Sha256']
    assert before==blob(SOURCE,path)==blob(CUT+'^',path)
    assert after==blob(CUT,path)==(P/path).read_bytes()
    if before!=after:
        if path.endswith('.py'):
            assert '/tests/test_precision_gate_projection_' in path
            assert after==before.replace(b'import pytest\nfrom zeta_interp',b'import pytest\n\nfrom zeta_interp',1)
            assert ast.dump(ast.parse(before),include_attributes=False)==ast.dump(ast.parse(after),include_attributes=False)
        else:
            assert path=='src/Interp.Python/pyproject.toml'
            old=tomllib.loads(before.decode()); new=tomllib.loads(after.decode())
            assert new['tool'].pop('ruff')=={'lint':{'isort':{'known-first-party':['zeta_interp']}}}
            assert old==new
        changes.append({'Path':path,'BeforeBytes':len(before),'BeforeSha256':sha(before),'AfterBytes':len(after),'AfterSha256':sha(after)})
assert len(changes)==8
changed_source=git('diff','--name-only','--no-renames',CUT+'^',CUT,'--','src').decode().splitlines()
assert sorted(changed_source)==sorted(r['Path'] for r in changes)
assert git('diff',CUT+'^',CUT,'--','src/Bayesian','src/Research.FSharp','src/Interp.Python/zeta_interp')==b''


def obj(path):
    return json.loads(records[path])


prefix='projection-lint-cwd-correction-1/'
commands=[]
for name,exit_code,fragment in (
    ('package-before',1,'Found 7 errors.'),
    ('root-lint',0,'All checks passed!'),
    ('package-lint',0,'All checks passed!'),
    ('package-format',0,'114 files already formatted'),
    ('package-mypy',0,'Success: no issues found in 113 source files'),
    ('component-pytest',0,'340 passed in 6.95s'),
):
    inv=obj(prefix+name+'.invocation.json'); completion=obj(prefix+name+'.completion.json')
    stdout=records[prefix+name+'.stdout.txt']; stderr=records[prefix+name+'.stderr.txt']
    assert completion['ExitCode']==exit_code and fragment.encode() in stdout and stderr==b''
    assert completion['FinishedUnix']>=inv['StartedUnix']
    assert inv['Cwd']==str(P/('src/Interp.Python' if name.startswith('package-') else ''))
    assert inv['EnvironmentOverride']=={'PYTHONPATH':str(P/'src/Interp.Python')}
    commands.append({'Name':name,'Invocation':inv,'Completion':completion,'StdoutSha256':sha(stdout)})
raw_ci=records['pr-17051-interp-failure-2/stdout.log']
assert len(raw_ci)==997561
assert b'2286 passed, 1 warning in 257.69s' in raw_ci
assert b'Found 7 errors.' in raw_ci and b'Process completed with exit code 1.' in raw_ci
assert raw_ci.count(b'I001 [*]')==7
assert records['pr-17051-interp-failure-1/stdout.log']==b''
assert b'terminal escape sequences' in records['pr-17051-interp-failure-1/stderr.txt']
assert records['pr-17051-interp-failure-2/stderr.txt']==b''
print(json.dumps({'AcceptedSourceAndCustody':True,'ReviewedCut':CUT,'ArchiveMembers':135,
                  'ArchiveBytes':len(stored),'ArchiveSha256':sha(stored),'OriginalPayloadBytes':sum(map(len,records.values())),
                  'SourceRowsBeforeAfter':47,'UnchangedRows':39,'ChangedRows':changes,
                  'PythonAstIdentical':7,'OnlyTomlDelta':'tool.ruff.lint.isort.known-first-party=[zeta_interp]',
                  'RecordedChecks':commands,'RawCiBytes':len(raw_ci),'RawCiSha256':sha(raw_ci),
                  'Scope':'No test, lint, numerical service or registered workload rerun by reviewer'},indent=2))
