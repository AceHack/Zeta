"""Verify coordinator archive bytes without extracting or executing members."""

import hashlib
import io
import json
import pathlib
import tarfile
import zlib

ROOT = pathlib.Path('/Users/acehack/.zeta/agents/codex/Zeta-oracle-grounding-publication-20260908')
PUB = pathlib.Path('/Users/acehack/.zeta/agents/codex/Zeta-compiled-evidence-publication-20260907')
OUT = pathlib.Path(__file__).resolve().parent
BASE = ROOT / 'docs/research/precision-gate-kernels/2026-09-08/pr-17041'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def identity(path):
    raw = path.read_bytes()
    return {'Path': str(path), 'Bytes': len(raw), 'Sha256': sha(raw)}


manifest = json.loads((BASE / 'manifest.json').read_bytes())
stored = (BASE / manifest['Archive']).read_bytes()
assert len(stored) == manifest['StoredBytes'] and sha(stored) == manifest['StoredSha256']
decoder = zlib.decompressobj(31)
raw = decoder.decompress(stored) + decoder.flush()
assert decoder.eof and not decoder.unused_data
assert len(raw) == manifest['TarBytes'] and sha(raw) == manifest['TarSha256']
declared = {row['Path']: row for row in manifest['Members']}
assert len(declared) == len(manifest['Members']) == 1450
seen = set()
with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
    for member in archive:
        assert member.isfile() and member.name not in seen
        assert not pathlib.PurePosixPath(member.name).is_absolute()
        assert '..' not in pathlib.PurePosixPath(member.name).parts
        row = declared[member.name]
        stream = archive.extractfile(member)
        assert stream is not None
        with stream:
            data = stream.read()
        assert member.size == len(data) == row['Bytes'] and sha(data) == row['Sha256']
        assert data == (PUB / '.git' / member.name).read_bytes()
        seen.add(member.name)
assert seen == set(declared)
assert (BASE / 'no-renames-proof.json').read_bytes() == (PUB / '.git/pr-17041-main-proof-2/proof.json').read_bytes()

prior = ROOT / 'docs/research/precision-gate-kernels/2026-09-08/publication-validation'
pm = json.loads((prior / 'manifest.json').read_bytes())
assert pm['Head'] == 'c1e6f0497afcc5078b03bfe8e797dc12e684cf58'
gate = {}
for row in pm['Artifacts']:
    if 'full-preflight-1' not in row['OriginalPath']:
        continue
    encoded = (prior / row['File']).read_bytes()
    assert len(encoded) == row['StoredBytes'] and sha(encoded) == row['StoredSha256']
    decoder = zlib.decompressobj(31)
    data = decoder.decompress(encoded) + decoder.flush()
    assert decoder.eof and not decoder.unused_data
    assert len(data) == row['Bytes'] and sha(data) == row['Sha256']
    gate[row['OriginalPath'].rsplit('/', 1)[1]] = data
assert len(gate) == 4
assert b'preflight: all 18 executed check(s) passed.' in gate['stdout']
push = (PUB / '.git/precision-publication-push-1.log').read_bytes()
assert b'preflight: all 16 executed check(s) passed.' in push

result = {
    'Scope': 'Read existing archive members without extraction; no numerical execution',
    'Manifest': identity(BASE / 'manifest.json'),
    'Archive': identity(BASE / 'custody.tar.gz'),
    'TarBytes': len(raw), 'TarSha256': sha(raw),
    'RegularMembersVerified': len(seen),
    'EveryMemberEqualsRetainedOriginal': True,
    'MemberBytes': sum(row['Bytes'] for row in declared.values()),
    'CorrectedProof': identity(BASE / 'no-renames-proof.json'),
    'ReceiptReadme': identity(BASE / 'README.md'),
    'PriorGateManifest': identity(prior / 'manifest.json'),
    'PriorGateSourceCut': pm['Head'],
    'PriorGateProcess': json.loads(gate['process.json']),
    'PriorGateStart': json.loads(gate['start.json']),
    'PriorGateStderr': gate['stderr'].decode(),
    'PriorGateAll18MarkerPresent': True,
    'NormalPushAll16MarkerPresent': True,
    'AuditSource': identity(pathlib.Path(__file__)),
}
data = (json.dumps(result, indent=2) + '\n').encode()
with (OUT / 'archive-result.json').open('xb') as stream:
    stream.write(data)
print(data.decode())
