from pathlib import Path
from datetime import datetime, timezone
import hashlib,json,subprocess
writer=Path.cwd()
root=Path('/Users/acehack/.zeta/agents/codex/Zeta-projection-publication-20260908')
out=writer/'docs/research/mixed-message-epoch-implementation/2026-09-08/assembled-crash-review-1'
out.mkdir(parents=True,exist_ok=False)
def ident(raw): return {'Bytes':len(raw),'Sha256':hashlib.sha256(raw).hexdigest().upper()}
def put(name,raw):
 (out/name).write_bytes(raw)
 return {'File':name,**ident(raw)}
def git(*args): return subprocess.run(['git',*args],cwd=root,check=True,capture_output=True).stdout
start=datetime.now(timezone.utc).isoformat()
cut=git('rev-parse','1a71b4ff0^{commit}').decode().strip()
records={}
for name in ['stdout','stderr','completion.json','source-after.json']:
 p=root/'.git/mixed-assembled-gate-1/call-0'/name
 raw=p.read_bytes(); records[name]={'Original':str(p.relative_to(root)),**put('gate-'+name,raw)}
raw=(root/'.git/mixed-assembled-gate-1/sources.json').read_bytes(); records['sources']={'Original':'.git/mixed-assembled-gate-1/sources.json',**put('gate-sources.json',raw)}
source=[]
for i,name in enumerate(['src/Core.TypeScript/hygiene/preflight.ts','global.json','Directory.Build.props','Directory.Packages.props','tests/Tests.FSharp/Tests.FSharp.fsproj']):
 raw=git('show',cut+':'+name);source.append({'Path':name,**put(f'source-{i:02}.txt',raw)})
ips=Path.home()/'Library/Logs/DiagnosticReports/Tests.FSharp-2026-09-08-104234.ips'
raw=ips.read_bytes();data=json.loads(raw.split(b'\n',1)[1]);imgs=data['usedImages'];thread=data['threads'][data['faultingThread']]
frames=[]
for f in thread['frames']:
 im=imgs[f['imageIndex']]
 frames.append({'Image':im['name'],'ImageUuid':im['uuid'],'ImageOffset':f['imageOffset'],'Symbol':f.get('symbol'),'SymbolLocation':f.get('symbolLocation')})
runtime=Path('/Users/acehack/.local/share/mise/dotnet-root/shared/Microsoft.NETCore.App/10.0.11/libcoreclr.dylib')
observed=[]
for kind,p in [('Runtime',runtime),('Apphost',root/'tests/Tests.FSharp/bin/Release/net10.0/Tests.FSharp')]:
 before=p.stat();b=p.read_bytes();after=p.stat()
 argv=['/usr/bin/dwarfdump','--uuid',str(p)]
 r=subprocess.run(argv,capture_output=True,check=False)
 put(kind.lower()+'-uuid.stdout',r.stdout);put(kind.lower()+'-uuid.stderr',r.stderr)
 r.check_returncode()
 observed.append({'Kind':kind,'Path':str(p),'ObservedAtUtc':datetime.now(timezone.utc).isoformat(),**ident(b),'StatStable':(before.st_size,before.st_mtime_ns,before.st_ino)==(after.st_size,after.st_mtime_ns,after.st_ino),'UuidCommand':{'Argv':argv,'ExitCode':r.returncode,'StdoutFile':kind.lower()+'-uuid.stdout','StderrFile':kind.lower()+'-uuid.stderr'},'Limit':'Current file observation, not a digest of originally mapped process pages.'})
config=root/'tests/Tests.FSharp/bin/Release/net10.0/Tests.FSharp.runtimeconfig.json'
configid=put('current-runtimeconfig.json',config.read_bytes())
prior=writer/'docs/research/hidden-switch-validation/2026-09-07/root-main-crash-review.json';prevraw=prior.read_bytes();prev=json.loads(prevraw)
first7=frames[:7];past=prev['FaultingThread']['Frames'][:7]
comparison={key:all(a.get(key)==b.get(key) for a,b in zip(first7,past)) for key in ['Image','ImageUuid','ImageOffset','Symbol','SymbolLocation']}
completion=json.loads((out/'gate-completion.json').read_bytes())
lines=(out/'gate-stdout').read_text().splitlines()
record={'Scope':'Read-only selected crash-location audit. No test, build, solver, debugger, runtime/configuration change, or root-writer mutation. Raw IPS remains local only.','StartedAtUtc':start,'FinishedAtUtc':datetime.now(timezone.utc).isoformat(),'AssembledSourceCommit':cut,'RootGate':records,'GateCompletion':completion,'GateSelectedLines':[{'Line':i,'Text':l} for i,l in enumerate(lines,1) if 'Passed!' in l or 'FATAL ERROR' in l or 'Test process crashed' in l or 'PASS' in l or 'FAIL' in l],'SourceCopies':source,'IpsSource':{'LocalFileName':ips.name,**ident(raw),'RawBytesCommitted':False,'Selection':'Process/time, exception, faulting-thread frames and runtime image identity only; excludes incident IDs, responsible process, other threads/registers/environment.'},'Process':{k:data.get(k) for k in ['procName','pid','parentProc','parentPid','procLaunch','captureTime','procPath']},'Exception':data['exception'],'Termination':{k:data['termination'].get(k) for k in ['code','namespace','indicator']},'FaultingThread':{'Index':data['faultingThread'],'Name':thread.get('name'),'Frames':frames},'CurrentFiles':observed,'RuntimeConfig':configid,'PriorComparison':{'Path':str(prior.relative_to(writer)),**ident(prevraw),'FirstSevenFramesEqualByField':comparison,'RuntimeConfigHashEqual':prev['RuntimeConfig']['Sha256']==configid['Sha256'],'PriorCauseEstablished':False},'AttributionLimit':'OS procPath is privacy-redacted. Same project/apphost name, matching time interval/duration and image UUID support association with the gate; no original gate process tree or test sequence/TRX identifies its exact last/in-flight test. The apphost UUID alone is not a unique checkout identity.','Conclusion':'Tests.FSharp SIGSEGV in background server-GC is the observed fault location; deterministic cause and responsible test/source remain unresolved. Preserve the failed gate even if a later complete invocation succeeds.'}
put('observation.json',(json.dumps(record,indent=2)+'\n').encode())
put('extract.py',Path(__file__).read_bytes())
manifest=[]
for p in sorted(out.iterdir()): manifest.append({'File':p.name,**ident(p.read_bytes())})
put('inventory.json',(json.dumps(manifest,indent=2)+'\n').encode())
print(json.dumps({'SourceCommit':cut,'Files':len(manifest),'Path':str(out),'PriorFrames':comparison,'Runtime':observed[0],'Ips':record['IpsSource']},indent=2))
