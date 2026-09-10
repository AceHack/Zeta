"""Verify pinned integration archive/source without extracting or running code."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import zlib

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
PIN = 'e133efe8324331d43187fd87c54bd4ea39c401f5'
OLD = '8100544b68573e00fa3e99aa51e94673ebbc25de'
BASE = 'docs/research/precision-gate-projection/2026-09-08/integrated-import-validation/'
MODULE = 'src/Interp.Python/zeta_interp/precision_gate_projection_run.py'
TEST = 'src/Interp.Python/tests/test_precision_gate_projection_run.py'

def blob(pin, path):
    return subprocess.run(['git', '-C', str(REPO), 'show', pin + ':' + path], capture_output=True, check=True).stdout

def ident(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest().upper()}

def checked(raw, row):
    assert ident(raw) == {'Bytes': row['Bytes'], 'Sha256': row['Sha256'].upper()}

manifest_raw = blob(PIN, BASE + 'manifest.json')
manifest = json.loads(manifest_raw)
packed = blob(PIN, BASE + manifest['Archive']['Path'])
checked(packed, manifest['Archive'])
decoder = zlib.decompressobj(31)
tar_raw = decoder.decompress(packed, 4 * 1024 * 1024)
assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
expected = {row['Path']: row for row in manifest['Members']}
assert len(expected) == len(manifest['Members']) == 41
raws = {}
with tarfile.open(fileobj=io.BytesIO(tar_raw), mode='r:') as archive:
    for member in archive:
        assert member.isfile() and member.name in expected and member.name not in raws
        assert member.size == expected[member.name]['Bytes'] < 2**21
        stream = archive.extractfile(member)
        assert stream is not None
        with stream:
            raw = stream.read(member.size + 1)
        checked(raw, expected[member.name])
        original = REPO / '.git' / (member.name if member.name != 'claim-push-1.log' else 'projection-driver-claim-push-1.log')
        assert original.read_bytes() == raw
        raws[member.name] = raw
assert set(raws) == set(expected)
source_tables = []
for number, pin in ((1, OLD), (2, PIN)):
    prefix = f'projection-integrated-python-tests-{number}/'
    start = json.loads(raws[prefix + 'start.json'])
    rows = start['Sources'] if number == 1 else start['Files']
    assert len(rows) == 12
    for index, row in enumerate(rows):
        copy = raws[prefix + f'source-{index:02d}.py']
        checked(copy, row)
        assert copy == blob(pin, row['Path'])
    source_tables.append({'Attempt': number, 'ActualSourceCut': pin, 'RecordedHead': start.get('Head', start.get('SourceHead')), 'Sources': rows})
print(json.dumps({'AcceptedRunnerCut': PIN, 'Manifest': ident(manifest_raw), 'Archive': ident(packed), 'TarBytes': len(tar_raw), 'Members': len(raws), 'MemberBytes': sum(len(r) for r in raws.values()), 'OriginalAlias': {'claim-push-1.log': '.git/projection-driver-claim-push-1.log'}, 'Module': ident(blob(PIN, MODULE)), 'Tests': ident(blob(PIN, TEST)), 'Sources': source_tables, 'Commands': {n: json.loads(r) for n,r in raws.items() if n.endswith('process.json')}, 'Outputs': {n: {'Identity':ident(r),'Tail':r.decode().splitlines()[-9:]} for n,r in raws.items() if n.endswith(('-stdout','-stderr','.log'))}, 'ArchiveExtracted':False,'ProjectCodeExecuted':False,'FinalNumericalRunExecuted':False},indent=2))
