"""Read frozen archives/Git/files only; do not import numerical project code."""
import ast
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile
import zlib

REPO = Path('/Users/acehack/.zeta/agents/codex/Zeta-projection-publication-20260908')
PIN = 'ba7c312d55233f507ecbbfd62e3c3fb733fd35a7'
SOURCE = 'f33ac42959388344fc3c82058f165764954fa22d'
GATE = '096b09126b1f489fc7720b69780263ef01485445'
EXPECTED = 'FE1F5BDF732FA6B08092887210552BA9CEF68D724E519C77958A282366A348E7'
BASE = 'docs/research/precision-gate-projection/2026-09-08/'
DRIVER = 'src/Interp.Python/zeta_interp/precision_gate_projection_driver.py'
SCRIPT = 'src/Research.FSharp/PrecisionGateProjectionReplay.fsx'
TEST = 'src/Interp.Python/tests/test_precision_gate_projection_driver.py'


def blob(pin, path):
    return subprocess.check_output(['git', '-C', str(REPO), 'show', pin + ':' + path])


def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest().upper()}


def archive(folder, filename, count):
    root = BASE + folder + '/'
    manifest_raw = blob(PIN, root + filename)
    manifest = json.loads(manifest_raw)
    packed = blob(PIN, root + 'custody.tar.gz')
    assert identity(packed) == {k: manifest['Archive'][k] for k in ('Bytes', 'Sha256')}
    assert packed == (REPO / root / 'custody.tar.gz').read_bytes()
    decoder = zlib.decompressobj(31)
    raw = decoder.decompress(packed, 128 * 1024 * 1024)
    assert decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail
    names = [row['Path'] for row in manifest['Members']]
    assert len(names) == len(set(names)) == count
    records = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as tar:
        members = tar.getmembers()
        assert [m.name for m in members] == names
        for m, row in zip(members, manifest['Members']):
            assert m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts
            value = tar.extractfile(m).read()
            assert identity(value) == {k: row[k] for k in ('Bytes', 'Sha256')}
            records[m.name] = value
    return records, {'Manifest': identity(manifest_raw), 'Stored': identity(packed),
                     'Tar': identity(raw), 'Members': count,
                     'PayloadBytes': sum(map(len, records.values()))}


implementation, implementation_summary = archive('implementation-source', 'archive-manifest.json', 59)
assembled, assembled_summary = archive('assembled-validation', 'manifest.json', 89)
for name, raw in assembled.items():
    assert (REPO / '.git' / name).read_bytes() == raw, name
manifest_raw = implementation['implementation-manifest.json']
assert identity(manifest_raw)['Sha256'] == EXPECTED
assert manifest_raw == blob(PIN, BASE + 'implementation-source/implementation-manifest.json')
assert blob(PIN, BASE + 'implementation-source/implementation-manifest.sha256') == (EXPECTED + '\n').encode()
manifest = json.loads(manifest_raw)
assert set(manifest) == {'Schema', 'ProtocolSha256', 'SourceFiles', 'NativeFiles'}
assert manifest['Schema'] == 'zeta.precision-projection.source-manifest.v1'
assert manifest['ProtocolSha256'] == '537054779BF9E0BFA9271B5CC56116FBC80B16C4A2BE9F1B5E3C022FE95A0F8E'
assert len(manifest_raw) == 9821 <= 65536
roster = next(ast.literal_eval(n.value) for n in ast.parse(blob(SOURCE, DRIVER)).body
              if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'SOURCE_PATHS' for t in n.targets))
assert [r['Path'] for r in manifest['SourceFiles']] == list(roster) and len(set(roster)) == 47
for row in manifest['SourceFiles']:
    assert set(row) == {'Path', 'Bytes', 'Sha256'}
    assert type(row['Bytes']) is int and 0 <= row['Bytes'] <= 8 * 1024 * 1024
    assert re.fullmatch('[0-9A-F]{64}', row['Sha256'])
    raw = implementation['sources/' + row['Path']]
    assert identity(raw) == {k: row[k] for k in ('Bytes', 'Sha256')}
    assert raw == blob(SOURCE, row['Path']) == blob(PIN, row['Path']) == (REPO / row['Path']).read_bytes()
assert sum(r['Bytes'] for r in manifest['SourceFiles']) <= 64 * 1024 * 1024
custody_raw = implementation['source-custody.json']
assert custody_raw == blob(PIN, BASE + 'implementation-source/source-custody.json')
custody = json.loads(custody_raw)
assert custody['SourceCommit'] == SOURCE and custody['NativeBuildGateCommit'] == GATE
roles = ['@host', SCRIPT, 'src/Core/bin/Release/net10.0/Zeta.Core.dll',
         'src/Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll',
         'src/Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll']
assert [r['Role'] for r in manifest['NativeFiles']] == roles
assert [r['Role'] for r in custody['NativeArchive']] == roles
for row, located in zip(manifest['NativeFiles'], custody['NativeArchive']):
    assert set(row) == {'Role', 'Bytes', 'Sha256'}
    assert type(row['Bytes']) is int and 0 <= row['Bytes'] <= 128 * 1024 * 1024
    assert re.fullmatch('[0-9A-F]{64}', row['Sha256'])
    raw = implementation[located['ArchivePath']]
    assert identity(raw) == {k: row[k] for k in ('Bytes', 'Sha256')} == {k: located[k] for k in ('Bytes', 'Sha256')}
    assert raw == Path(located['OriginalPath']).read_bytes()
assert implementation['freeze-source.py'] == (REPO / '.git/freeze-projection-source-1.py').read_bytes()
copied = sum(r['Bytes'] for r in manifest['NativeFiles'][1:])
driver_charge = 2 * (copied + len(manifest_raw) + 27 * (2 * 65536 + 2 * 1024 * 1024) + 4 * 1024 * 1024)
assert custody['Reservation'] == {'CopiedBytes': copied, 'ManifestBytes': len(manifest_raw),
    'DriverCombinedBytes': driver_charge, 'DriverSlots': 90,
    'InnerCombinedBytes': 256 * 1024 * 1024 - driver_charge, 'InnerJournalBytes': 8 * 1024 * 1024,
    'InnerSlots': 422, 'UnusedReservationsReclaimed': False}
assert copied == 10502579 and driver_charge == 149737504
changed = [p for p in roster if blob(GATE, p) != blob(SOURCE, p)]
assert changed == custody['SourceChangesSinceFullGate'] == [TEST]
old, new = blob(GATE, TEST), blob(SOURCE, TEST)
assert old.replace(b'import pytest\n\nfrom zeta_interp', b'import pytest\nfrom zeta_interp', 1) == new
assert len(old) == len(new) + 1
full_start = json.loads(assembled['projection-assembled-full-gate-1/start.json'])
full_end = json.loads(assembled['projection-assembled-full-gate-1/result.json'])
assert full_start['Head'] == full_end['EndHead'] == GATE
assert full_start['Status'] == full_end['EndStatus'] == ''
assert [r['Path'] for r in full_start['Sources']] == list(roster)
assert [r['Path'] for r in full_end['SourceComparisons']] == list(roster)
assert all(r['Equal'] is True for r in full_end['SourceComparisons'])
for row in full_start['Sources']:
    assert identity(blob(GATE, row['Path'])) == {k: row[k] for k in ('Bytes', 'Sha256')}
assert all(r['Exit'] == 0 for r in full_end['Results'])
assert b'all 18 executed check(s) passed' in assembled['projection-assembled-full-gate-1/0-stdout']
assert b'Format currently supports only C# and Visual Basic projects' in assembled['projection-assembled-full-gate-1/1-stderr']
python_cuts = []
for number, expected_exits, text in [(1, [1, 0, 0, 0], b'340 passed in 7.53s'), (2, [0, 0, 0, 0], b'340 passed in 7.07s')]:
    prefix = f'projection-assembled-python-gate-{number}/'
    start, end = (json.loads(assembled[prefix + p]) for p in ('start.json', 'result.json'))
    assert [r['Exit'] for r in end['Results']] == expected_exits
    assert len(start['Files']) == 14
    base_differences = []
    for index, row in enumerate(start['Files']):
        raw = assembled[prefix + f'source-{index:02}.py']
        assert identity(raw) == {k: row[k] for k in ('Bytes', 'Sha256')}
        if raw != blob(start['Head'], row['Path']):
            base_differences.append(row['Path'])
        if number == 1:
            assert raw == blob(start['Head'], row['Path'])
        if number == 2:
            assert raw == blob(SOURCE, row['Path'])
    assert base_differences == ([] if number == 1 else [TEST])
    assert text in assembled[prefix + '3-stdout']
    python_cuts.append({'RecordedBaseHead': start['Head'], 'ExecutedSnapshotDifferencesFromBase': base_differences, 'Files': 14, 'Exits': expected_exits,
                        'Pytest': text.decode(), 'Commands': end['Results']})
freeze = json.loads(blob(PIN, BASE + 'implementation-source/freeze-observation.json'))
for stream in ('stdout', 'stderr'):
    raw = blob(PIN, BASE + 'implementation-source/freeze.' + stream + '.txt')
    assert identity(raw)['Sha256'] == freeze[stream.title() + 'Sha256']
assert freeze['ExitCode'] == 0
print(json.dumps({'Publication': PIN, 'SourceCommit': SOURCE, 'InputManifest': identity(manifest_raw),
    'ImplementationArchive': implementation_summary, 'AssembledArchive': assembled_summary,
    'SourceRowsVerified': 47, 'NativeRolesVerified': 5, 'SourceUniqueOriginalFiles': 51,
    'AssembledOriginalFilesVerified': 89, 'Reservation': custody['Reservation'],
    'OnlySourceChangeSinceFullGate': changed, 'FullGate': full_end['Results'],
    'PythonCuts': python_cuts, 'FreezeExitObservation': freeze,
    'NoNumericalServicesInvokedByReview': True}, indent=2))
