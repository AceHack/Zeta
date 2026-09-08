"""Immutable source and retained file audit; no application imports or execution."""
import hashlib
import json
from pathlib import Path
import subprocess
import zlib

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
PIN = '459df91118b0065123cadf3f5bad4efa1195133b'
BASE = 'docs/research/precision-gate-projection/2026-09-08/comparison-criteria-validation/'

def blob(path):
    return subprocess.run(['git', '-C', str(REPO), 'show', PIN + ':' + path], capture_output=True, check=True).stdout

def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}

manifest_raw = blob(BASE + 'manifest.json')
manifest = json.loads(manifest_raw)
assert len(manifest['Records']) == 10
observations = []
raws = {}
for row in manifest['Records']:
    assert row['Stored'] not in raws and Path(row['Stored']).name == row['Stored']
    assert row['RawBytes'] <= 2**21
    packed = blob(BASE + row['Stored'])
    assert identity(packed) == {'Bytes': row['StoredBytes'], 'Sha256': row['StoredSha256']}
    decoder = zlib.decompressobj(31)
    raw = decoder.decompress(packed, row['RawBytes'] + 1)
    assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
    assert identity(raw) == {'Bytes': row['RawBytes'], 'Sha256': row['RawSha256']}
    path = REPO / row['Original']
    assert path.is_relative_to(REPO / '.git') and path.read_bytes() == raw
    raws[row['Stored']] = raw
    observations.append({'Original': row['Original'], 'Stored': row['Stored'], **identity(raw)})
source_pins = []
for path in ('src/Interp.Python/zeta_interp/precision_gate_projection_comparison.py', 'src/Interp.Python/tests/test_precision_gate_projection_comparison.py'):
    raw = blob(path)
    assert raw == raws[Path(path).name + '.gz']
    source_pins.append({'Path': path, **identity(raw)})
print(json.dumps({'SourceCommit': PIN, 'Manifest': identity(manifest_raw), 'Records': observations, 'OriginalBytes': sum(r['RawBytes'] for r in manifest['Records']), 'StoredBytes': sum(r['StoredBytes'] for r in manifest['Records']), 'SourcePins': source_pins, 'Start': json.loads(raws['start.json.gz']), 'Process': json.loads(raws['process.json.gz']), 'Outputs': {name: raw.decode() for name, raw in raws.items() if name[0].isdigit()}, 'ApplicationCodeExecuted': False}, indent=2))
