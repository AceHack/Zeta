import hashlib
import json
import pathlib
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timezone

base = pathlib.Path(__file__).resolve().parent
pin = '79d0c463f1b55624c874a11585f7e47731e8d675'
reported = 'e2f47b0110ed922f21a1522da67279133ce28f32'
result = {'StartedAtUtc': datetime.now(timezone.utc).isoformat(), 'Scope': 'Read-only public source retrieval and local metadata; no task execution or debugger attachment', 'PublicTagCommit': pin, 'InstalledReportedCommit': reported, 'Sources': []}
for name in ('runtimehandles.cpp', 'method.cpp'):
    url = f'https://raw.githubusercontent.com/dotnet/runtime/{pin}/src/coreclr/vm/{name}'
    with urllib.request.urlopen(url, timeout=30) as response:
        data = response.read()
        status = response.status
    tag_url = f'https://raw.githubusercontent.com/dotnet/runtime/v10.0.11/src/coreclr/vm/{name}'
    with urllib.request.urlopen(tag_url, timeout=30) as response:
        tag_data = response.read()
    result['Sources'].append({'Url': url, 'HttpStatus': status, 'Bytes': len(data), 'Sha256': hashlib.sha256(data).hexdigest(), 'TagUrl': tag_url, 'TagSourceBytesEqual': data == tag_data, 'RetainedSourceBody': False})
version = pathlib.Path('/Users/acehack/.local/share/mise/dotnet-root/shared/Microsoft.NETCore.App/10.0.11/.version').read_bytes()
(base / 'installed-version.txt').write_bytes(version)
result['VersionFile'] = {'Bytes': len(version), 'Sha256': hashlib.sha256(version).hexdigest()}
for name, command in [('sw-vers.txt', ['sw_vers']), ('uname.txt', ['uname', '-srm'])]:
    completed = subprocess.run(command, capture_output=True, check=False)
    (base / name).write_bytes(completed.stdout)
    result.setdefault('MetadataCommands', []).append({'Arguments': command, 'ExitCode': completed.returncode, 'StdoutFile': name, 'Stderr': completed.stderr.decode('utf-8', errors='strict')})
result['FinishedAtUtc'] = datetime.now(timezone.utc).isoformat()
(base / 'public-source-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
