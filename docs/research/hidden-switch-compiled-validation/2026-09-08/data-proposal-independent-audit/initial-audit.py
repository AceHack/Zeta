"""Audit retained proposal metadata only; no project import, raw dump or process launch."""
from collections import Counter
from datetime import datetime
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-predictor-native-20260906')
BASE = Path('docs/research/hidden-switch-compiled-validation/2026-09-07')
EVIDENCE = 'a0293cdddd778e95f883b91ea4cd0b7dab021ef1'
EXECUTION = 'af6c1935c5240097b459d0508e204609d60855d7'
SOURCE = 'a80211d357d548d97caf850f367543abfbf91638'
FLAGS = ['RuntimeAdmitted', 'BodyResolved', 'ClosureAdmitted']


def sha(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def git(pin, path):
    return subprocess.check_output(['git', 'show', pin + ':' + str(path)], cwd=ROOT)


def same(left, right):
    return json.dumps(left, sort_keys=True, separators=(',', ':')) == json.dumps(right, sort_keys=True, separators=(',', ':'))


def identity(raw, size, digest):
    assert len(raw) == size and sha(raw) == digest.upper()


def archive(folder, pin):
    directory = BASE / folder
    raw = (ROOT / directory / 'manifest.json').read_bytes()
    assert raw == git(pin, directory / 'manifest.json')
    manifest = json.loads(raw)
    return raw, manifest, {row['File']: row for row in manifest['Records']}


cache = {}
def read_record(folder, table, name, pin):
    key = (folder, name)
    if key in cache:
        return cache[key]
    record = table[name]
    path = BASE / folder / name
    stored = (ROOT / path).read_bytes()
    assert stored == git(pin, path)
    identity(stored, record['StoredBytes'], record['StoredSha256'])
    raw = gzip.decompress(stored)
    identity(raw, record['Bytes'], record['Sha256'])
    cache[key] = (stored, raw)
    return stored, raw


manifest_raw, manifest, table = archive('data-proposal-attempt-2', EVIDENCE)
identity(manifest_raw, 6248, '64DB2CAE0E76FCBF7DE3C3EDD5825A215D61EFC19A8ECE778C3BC73D7445942A')
assert manifest['SourceCommit'] == SOURCE and manifest['ExecutionHead'] == EXECUTION
files = {name: read_record('data-proposal-attempt-2', table, name, EVIDENCE)[1] for name in table}
assert len(files) == 12 and sum(map(len, files.values())) == 381147
assert sum(row['StoredBytes'] for row in table.values()) == 63538
proposal = json.loads(files['proposal.json.gz']); outcome = json.loads(files['outcome.json.gz'])
invocation = json.loads(files['hidden-switch-data-proposal-attempt-2-invocation.json.gz'])
completion = json.loads(files['hidden-switch-data-proposal-attempt-2-completion.json.gz'])
identity(files['proposal.json.gz'], 87278, '7A30217E5686294E1FFD02593703D5E7348C1A528A7BB88620BB83373E745D07')
assert same(outcome['Proposal'], proposal)
assert outcome['ProposalFile'] == manifest['Summary']['ProposalFile']
assert outcome['Complete'] is True and outcome['Failure'] is None and outcome['CleanupFailures'] == []
assert outcome['InputsUnchanged'] is True and outcome['ActiveDiagnostic'] is None
assert all(outcome[f] is False and proposal[f] is False for f in FLAGS)
assert outcome['RawDumpOpened'] is False and outcome['NewMemoryQueries'] == outcome['SourceDraws'] == 0
assert proposal['ProposalOnly'] is True and proposal['ObservedExecution'] is False
assert proposal['Inventory'] == outcome['Inventory'] and proposal['DumpIdentity'] == outcome['DumpIdentity']
assert proposal['DumpIdentity']['Bytes'] == 6208508456
assert proposal['DumpIdentity']['Sha256'] == '7584B8D3E56DAFA79CAE8C954C03C2587AC25134CAA970F67CE530FDE17D3709'
# The path in DumpIdentity is never opened.
assert invocation['SourceCommit'] == SOURCE and invocation['ExecutionHead'] == EXECUTION
assert all(invocation[f] is False for f in FLAGS)
assert invocation['OuterHarness']['Sha256'] == sha(files['run-data-proposal-attempt-2.py.gz']) == '741927F2980759CF50DEBDBB561D9BF801B673D63F64DE67CF603CD062577FFF'
assert invocation['Python']['Bytes'] == 18090720 and invocation['PythonIdentityByteLimit'] == 32 * 1024 * 1024
assert completion['ProcessId'] == 71479 and completion['ExitCode'] == completion['MainWaitExitCode'] == completion['CleanupWaitExitCode'] == 0
assert completion['DirectChildClosed'] is True and completion['SourcePinsUnchanged'] is True
assert completion['OuterFailure'] is None and completion['CleanupFailures'] == []
assert completion['ElapsedSeconds'] < 60
state = completion['AvailablePrefix']
assert same(state['ObservedSourcePins'], state['SourcePins']) and same(state['PostlaunchSourcePins'], state['SourcePins'])
assert len(state['SourcePins']) == 16
assert invocation['Arguments'] == state['Arguments']
assert datetime.fromisoformat(invocation['StartedAtUtc']) <= datetime.fromisoformat(outcome['StartedAtUtc']) < datetime.fromisoformat(outcome['FinishedAtUtc']) <= datetime.fromisoformat(completion['FinishedAtUtc'])
assert not files['hidden-switch-data-proposal-attempt-2.stderr.log.gz']
assert not files['hidden-switch-data-proposal-launcher-attempt-2-tool-stderr.log.gz']
assert same(json.loads(files['hidden-switch-data-proposal-launcher-attempt-2-tool-stdout.log.gz']), completion)

manifests = {}
for folder, count, digest in [
    ('transfer-inventory-attempt-1', 56373, '87CCFFFF3EDBA26779FD00A936D8CF6EF6616B6745817EAF59611CE335208555'),
    ('clrmd-mapped-attempt-1', 289614, '7C130526CB7981E209A5EF31AADA60194269BDE63213A1C4F91C3CCD25CBFE21'),
]:
    raw, value, records = archive(folder, EXECUTION)
    identity(raw, count, digest)
    manifests[folder] = (raw, records)
pins = outcome['Inputs']
assert len(pins) == 266 and len({(p['Kind'], p['File']) for p in pins}) == 266
for pin in pins:
    folder, name = pin['File'].split('/', 1)
    manifest_bytes, records = manifests[folder]
    if pin['Kind'] == 'manifest':
        assert name == 'manifest.json'; actual = manifest_bytes
    else:
        stored, original = read_record(folder, records, name, EXECUTION)
        assert pin['Kind'] in ['stored-record', 'original-record']
        actual = stored if pin['Kind'] == 'stored-record' else original
    identity(actual, pin['Bytes'], pin['Sha256'])
assert sum(p['Bytes'] for p in pins if p['Kind'] != 'stored-record') == 8155384
assert len([p for p in pins if p['Kind'] == 'original-record']) == 132
for pin in outcome['Sources']:
    raw = git(SOURCE, 'src/Research.FSharp.Cli/' + pin['File'])
    identity(raw, pin['Bytes'], pin['Sha256'])
assert len(outcome['Sources']) == 14
for pin in state['SourcePins']:
    identity(git(SOURCE, pin['File']), pin['Bytes'], pin['Sha256'])

inventory_table = manifests['transfer-inventory-attempt-1'][1]
prior = json.loads(read_record('transfer-inventory-attempt-1', inventory_table, 'outcome.json.gz', EXECUTION)[1])
assert same(prior['CompletedMethods'], outcome['CompletedMethods'])
assert same(prior['Unprepared'], outcome['Unprepared']) and len(outcome['Unprepared']) == 9
assert same(prior['ExtraCompilerBlocks'], outcome['ExtraCompilerBlocks']) and len(outcome['ExtraCompilerBlocks']) == 9
cells = {}; literals = {}; word_count = 0; kinds = Counter(); unresolved = 0
for method_index, descriptor in enumerate(outcome['CompletedMethods']):
    method_raw = read_record('transfer-inventory-attempt-1', inventory_table, descriptor['File'] + '.gz', EXECUTION)[1]
    identity(method_raw, descriptor['Bytes'], descriptor['Sha256'])
    method = json.loads(method_raw)
    for index, row in enumerate(method['Words']):
        shape = row['Shape']; kinds[shape['Kind']] += 1; unresolved += bool(shape['Unresolved']); word_count += 1
        pc = method['Method']['Address'] + 4 * index
        assert row['Offset'] == 4 * index and int(row['Decoded']['Address'], 16) == pc
        site = {'MethodOrder': method_index, 'Role': method['Role'], 'Offset': row['Offset'], 'Word': shape['Word'], 'Decoded': row['Decoded'], 'Compiler': row['Compiler']}
        cell = shape['StaticCell']
        if cell is not None and cell['PhysicalValueReused'] is False:
            construction = [int(word, 16) for word in cell['Words']]
            assert cell['Words'] == [r['Shape']['Word'] for r in method['Words'][cell['StartIndex']:index + 1]]
            first = construction[0]; reg = first & 31
            assert first & 0xFF800000 == 0xD2800000
            value = ((first >> 5) & 65535) << (((first >> 21) & 3) * 16)
            for move in construction[1:-2]:
                assert move & 0xFF800000 == 0xF2800000 and move & 31 == reg
                shift = ((move >> 21) & 3) * 16
                value = (value & ~(65535 << shift)) | (((move >> 5) & 65535) << shift)
            load, branch = construction[-2:]
            assert load & 0xFFC00000 == 0xF9400000 and (load >> 5) & 31 == reg
            target_reg = load & 31
            assert branch & 0xFFFFFC1F in [0xD61F0000, 0xD63F0000] and (branch >> 5) & 31 == target_reg
            address = value + ((load >> 10) & 4095) * 8
            assert address == int(cell['Address'], 16) and cell['BaseRegister'] == reg and cell['TargetRegister'] == target_reg
            assert shape['Targets'] == []
            site['Construction'] = cell
            cells.setdefault(address, {'Kind': 'cell', 'Address': f'{address:016X}', 'Bytes': 8, 'ExpectedHex': None, 'Uses': []})['Uses'].append(site)
        literal = shape['Literal']
        if literal is not None:
            word = int(shape['Word'], 16); immediate = (word >> 5) & 0x7FFFF
            if immediate & (1 << 18): immediate -= 1 << 19
            address = pc + immediate * 4
            assert address == int(literal['Address'], 16) and address not in literals
            assert {0x5C000000: 8, 0x9C000000: 16}[word & 0xFF000000] == literal['Bytes']
            assert literal['PhysicalBinding'] is False and len(bytes.fromhex(literal['ExpectedHex'])) == literal['Bytes']
            assert re.findall(r'\[@(RWD\d+)\]', row['Compiler']['Operands']) == [literal['Label']]
            site['Label'] = literal['Label']
            literals[address] = {'Kind': 'literal', 'Address': f'{address:016X}', 'Bytes': literal['Bytes'], 'ExpectedHex': literal['ExpectedHex'], 'Uses': [site]}
expected = [cells[a] for a in sorted(cells)] + [literals[a] for a in sorted(literals)]
assert same(expected, proposal['Ranges'])
assert word_count == 8665 and unresolved == 8524 and len(cells) == 43 and len(literals) == 10
assert sum(len(r['Uses']) for r in cells.values()) == 134
ordered = sorted(expected, key=lambda r: int(r['Address'], 16))
for previous, current in zip(ordered, ordered[1:]):
    assert int(previous['Address'], 16) + previous['Bytes'] <= int(current['Address'], 16)
assert sum(r['Bytes'] for r in expected) == 496 and sum(r['Bytes'] for r in literals.values()) == 152
journal = [json.loads(line) for line in files['journal.jsonl.gz'].splitlines()]
assert len(journal) == 413
assert Counter(row['Kind'] for row in journal) == {'start': 1, 'source-identity': 14, 'input-identity': 266, 'inventory-admitted': 1, 'method-admitted': 130, 'proposal-published': 1}
assert [r['Identity'] for r in journal if r['Kind'] == 'input-identity'] == pins
assert [r['Identity'] for r in journal if r['Kind'] == 'source-identity'] == outcome['Sources']
assert [r['Identity'] for r in journal if r['Kind'] == 'method-admitted'] == outcome['CompletedMethods']
assert journal[-1]['Identity'] == outcome['ProposalFile']
print(json.dumps({'Status': 'passed', 'EvidenceCommit': EVIDENCE, 'OutputRecords': 12, 'StoredBytes': 63538, 'OriginalBytes': 381147, 'ProposalBytes': 87278, 'ProposalSha256': sha(files['proposal.json.gz']), 'Methods': len(outcome['CompletedMethods']), 'Words': word_count, 'Ranges': len(expected), 'Cells': len(cells), 'CellSites': 134, 'Literals': len(literals), 'LiteralBytes': 152, 'SelectedBytes': 496, 'InputRecords': 132, 'InputIdentities': len(pins), 'OriginalInputBytes': 8155384, 'JournalRows': len(journal), 'UnresolvedWords': unresolved, 'PriorKinds': dict(kinds), 'RawDumpReadsByReviewer': 0, 'ProjectHelperCallsByReviewer': 0, 'NewProcessesByReviewer': 0}, indent=2))
