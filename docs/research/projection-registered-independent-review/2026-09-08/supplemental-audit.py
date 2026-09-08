"""Read-only preparation, coordinator and published-summary associations."""

import hashlib
import json
import pathlib
import subprocess
from fractions import Fraction

P = pathlib.Path('/Users/acehack/.zeta/agents/codex/Zeta-projection-publication-20260908')
A = P / '.git/projection-final-attempts/registered-1'
C = P / '.git/projection-final-execution-1'
D = P / 'docs/research/precision-gate-projection/2026-09-08/registered-1'
CUT = '61f8e14ba9f89e790dce635ce5c86db5c619b63c'


def read(p):
    return p.read_bytes()


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def load(p):
    return json.loads(read(p))


def un(v):
    if isinstance(v, dict):
        return un(v['Fields']) if set(v) == {'Type', 'Fields'} else {k:un(x) for k,x in v.items()}
    if isinstance(v, list):
        return [un(x) for x in v]
    return v


manifest = load(A / 'manifest.json')
outer = un(load(A / 'outer-final.json'))
terminal = load(A / outer['Run']['Terminal']['File'])
prepared = un(load(A / 'prepared-native.json'))
assert prepared['Complete'] is True and prepared['Failure'] is None and prepared['Cleanup'] == []
assert len(prepared['Dependencies']) == 5 and len(prepared['CreatedFiles']) == 4
assert prepared['Root'] == str(A/'native-custody')
for dep, pin in zip(prepared['Dependencies'], manifest['NativeFiles'], strict=True):
    assert dep['Role'] == pin['Role']
    assert dep['Before'] is dep['After'] is dep['Producer'] is None
    assert (dep['Original']['Bytes'],dep['Original']['Sha256']) == (pin['Bytes'],pin['Sha256'])
    if pin['Role'] == '@host':
        assert dep['Copy'] is None and dep['Original'] == prepared['Host']
    else:
        assert dep['Copy']['Path'] == str(A/'native-custody'/pin['Role'])
        raw = read(pathlib.Path(dep['Copy']['Path']))
        assert (len(raw),sha(raw)) == (pin['Bytes'],pin['Sha256'])
assert prepared['CreatedFiles'] == [d['Copy']['Path'] for d in prepared['Dependencies'][1:]]
assert prepared['Script'] == prepared['Dependencies'][1]['Copy']
assert prepared['References'] == [d['Role'] for d in prepared['Dependencies'][2:]]
slots = [e['Index'] for e in terminal['Entries'] if e['Operation']=='NativeSolve']
assert outer['NativeCallPaths'] == [f'native-call-{i:03}/{leaf}' for i in slots for leaf in ('input.json','bindings.json','receipt.json')]
assert len(outer['NativeCallPaths']) == 81
assert all((A/p).is_file() for p in outer['NativeCallPaths'])
assert all(x['Complete'] for x in outer['AttemptedPublications'])
assert [x['Expected'] for x in outer['AttemptedPublications']] == outer['Artifacts']

inv = load(C/'invocation.json'); pre = load(C/'prerequisites.json'); comp = load(C/'completion.json')
assert pre['ExecutedHead'] == '4937d7468446599e966adc65c0ca1e9be54472aa' and pre['Status'] == ''
assert pre['ManifestSha256'] == outer['ManifestSha256']
assert inv['Cwd'] == str(P) and inv['EnvironmentOverride'] == {'PYTHONPATH':str(P/'src/Interp.Python')}
assert inv['Argv'] == [outer['Python']['Executable'],'-m','zeta_interp.precision_gate_projection_driver',
                       '--source-root',str(P),'--manifest',str(P/'docs/research/precision-gate-projection/2026-09-08/implementation-source/implementation-manifest.json'),
                       '--manifest-sha256',outer['ManifestSha256'],'--output-parent',str(A.parent),
                       '--attempt','registered-1','--dotnet',prepared['Host']['Path']]
expected_files = [{'Path':str(P/x['Path']),'Bytes':x['Bytes'],'Sha256':x['Sha256']} for x in manifest['SourceFiles']]
expected_files += [d['Original'] for d in prepared['Dependencies']]
assert pre['FileObservations'] == expected_files
assert len(pre['RemoteObservations']) == 2
for obs,key,branch in zip(pre['RemoteObservations'],('SourcePublication','ArchiveAdmission'),
                          ('codex/scalar-projection-evaluation-20260908','codex/compiled-runtime-admission-review-20260907'),strict=True):
    ref = 'refs/heads/'+branch
    assert obs['Argv'] == ['git','ls-remote','origin',ref]
    assert obs['ExitCode'] == 0 and obs['Stderr'] == '' and obs['Stdout'] == pre[key]+'\t'+ref+'\n'
    assert obs['StartedUnix'] <= obs['FinishedUnix'] < inv['StartedUnix'] < comp['FinishedUnix']

published = load(D/'observation.json')
assert published['Invocation'] == inv and published['Completion'] == comp
assert published['Counters'] == terminal['Counters'] and published['CoreCertified'] == terminal['CoreCertified']
assert len(published['Rows']) == 88
for row,e in zip(published['Rows'],terminal['Entries'],strict=True):
    assessment = un(e['Assessment'])['value']
    assert row == {'Index':e['Index'],'CaseId':e['CaseId'],'Operation':e['Operation'],
                    'Kind':assessment['Kind'],'FailureCode':assessment['FailureCode'],
                    'Expected':assessment['Expected'],'CoreCertified':assessment['CoreCertified'],'Artifacts':e['Artifacts']}
for name in ['README.md','manifest.json','custody.tar.gz','observation.json']:
    relative = str((D/name).relative_to(P))
    blob = subprocess.run(['git','show',f'{CUT}:{relative}'],cwd=P,capture_output=True,check=True).stdout
    assert blob == read(D/name)
result_path = 'docs/research/2026-09-08-precision-gate-projection-registered-results.md'
assert subprocess.run(['git','show',f'{CUT}:{result_path}'],cwd=P,capture_output=True,check=True).stdout == read(P/result_path)

# Seven source-fixed analytically constructed centers, checking only exact
# rational containment in the already returned enclosures (no solver call).
analytic = []
for e in terminal['Entries']:
    if e['Operation'] != 'ReferenceRoot' or e['CaseId'] not in (
        'core/center','core/displaced','core/small-ratio','core/large-ratio',
        'core/small-scale','core/large-scale','core/wide-variance'):
        continue
    r = load(A/e['Artifacts'][-1]['File'])
    parameters = r['Target']['RequestedParameters']
    t,c = Fraction(parameters['T']),Fraction(parameters['C'])
    v = 1/(t+c); m = -v/2
    assert t*(m-Fraction(parameters['U'])) - Fraction(parameters['K']) + c == 0
    for field,value in [('Mean',m),('Variance',v)]:
        bounds = r['Outcome']['Value'][field]
        assert Fraction(bounds['Lower']) <= value <= Fraction(bounds['Upper'])
    analytic.append({'CaseId':e['CaseId'],'Mean':str(m),'Variance':str(v)})
assert len(analytic) == 7
print(json.dumps({'Accepted':True,'ArchiveCut':CUT,'PreparedCopies':4,'NativeCallPaths':81,
                  'PrelaunchSourceAndNativeObservations':52,'PrelaunchRemoteObservations':2,
                  'DerivedRowsMatched':88,'AnalyticCenterContainments':analytic},indent=2))
