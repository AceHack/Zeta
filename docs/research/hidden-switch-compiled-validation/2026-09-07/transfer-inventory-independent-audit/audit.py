"""Read retained files only; import no project code and run no collector or probe."""
from pathlib import Path
from collections import Counter
import gzip
import hashlib
import json
import subprocess

NATIVE = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-predictor-native-20260906')
BASE = Path('docs/research/hidden-switch-compiled-validation/2026-09-07')
SOURCE = '370c110c93598874615efe60a5bed23ac6e5263d'
EXECUTION = 'ed95d32fcd01bc54e6c4c904baa68e8f83c792d5'
EVIDENCE = 'a489e850847e240e131e502aa745c69899a146ba'
FLAGS = ('RuntimeAdmitted', 'BodyResolved', 'ClosureAdmitted')

def sha(raw):
    return hashlib.sha256(raw).hexdigest().upper()

def git_bytes(commit, path):
    return subprocess.run(['git', 'show', commit + ':' + str(path)], cwd=NATIVE, capture_output=True, check=True).stdout

def checked(raw, size, digest):
    assert len(raw) == size and sha(raw) == digest, (size, len(raw), digest, sha(raw))
    return raw

def archive(folder, commit):
    path = BASE / folder / 'manifest.json'
    raw = (NATIVE / path).read_bytes()
    assert raw == git_bytes(commit, path)
    manifest = json.loads(raw)
    records = {}
    for row in manifest['Records']:
        filename = row['File']
        assert filename not in records
        stored_path = path.parent / filename
        stored = (NATIVE / stored_path).read_bytes()
        assert stored == git_bytes(commit, stored_path), filename
        checked(stored, row['StoredBytes'], row['StoredSha256'])
        records[filename] = checked(gzip.decompress(stored), row['Bytes'], row['Sha256'])
    return manifest, records, {'Manifest': str(path), 'Bytes': len(raw), 'Sha256': sha(raw), 'Records': len(records), 'StoredBytes': sum(r['StoredBytes'] for r in manifest['Records']), 'OriginalBytes': sum(r['Bytes'] for r in manifest['Records'])}

def false_flags(value):
    assert all(value[k] is False for k in FLAGS)

prep, prepared_records, preparation = archive('transfer-inventory-retention-preparation', EXECUTION)
manifest, records, result = archive('transfer-inventory-attempt-1', EVIDENCE)
assert prep['SourceCommit'] == SOURCE == manifest['SourceCommit']
assert manifest['ExecutionHead'] == EXECUTION
assert len(prep['SourcePins']) == 14 and len(records) == 139
for pin in prep['SourcePins']:
    checked(git_bytes(SOURCE, pin['File']), pin['Bytes'], pin['Sha256'])
    checked((NATIVE / pin['File']).read_bytes(), pin['Bytes'], pin['Sha256'])
old = json.loads(prepared_records['transfer-inventory-retention-witness.json.gz'])
checked(git_bytes(old['SourceCommit'], old['SourceFile']), old['SourceBytes'], old['SourceSha256'])
assert old['Budget']['PossibleTotalBytes'] > old['Budget']['DeclaredBytes']
assert len(old['SourcePrefix']['ObservedReads']) == 1 and old['SourcePrefix']['ReturnedSources'] == []
assert old['SourcePrefix']['FailureCode'] == 'FileNotFoundError'
assert prepared_records['transfer-inventory-retention-witness.stderr.log.gz'] == b''

outcome = json.loads(records['outcome.json.gz'])
invocation = json.loads(records['hidden-switch-transfer-inventory-attempt-1-invocation.json.gz'])
completion = json.loads(records['hidden-switch-transfer-inventory-attempt-1-completion.json.gz'])
summary = json.loads(records['hidden-switch-transfer-inventory-attempt-1-summary.json.gz'])
assert summary == manifest['Summary']
assert invocation['SourcePins'] == prep['SourcePins']
assert invocation['SourceCommit'] == SOURCE and invocation['ExecutionHead'] == EXECUTION
assert invocation['Arguments'][1:] == [str(NATIVE / 'src/Research.FSharp.Cli/inventory_hidden_switch_transfers.py'), str(NATIVE / BASE), str(NATIVE / '.git/hidden-switch-transfer-inventory-attempt-1'), SOURCE]
checked(records['run-transfer-inventory-attempt-1.py.gz'], invocation['OuterHarness']['Bytes'], invocation['OuterHarness']['Sha256'])
assert completion['ExitCode'] == 0 and completion['OuterFailure'] is None and completion['SourcePinsUnchanged'] is True
assert records['hidden-switch-transfer-inventory-attempt-1.stderr.log.gz'] == b''
assert outcome['Complete'] is True and outcome['Failure'] is None and outcome['CleanupFailures'] == []
assert outcome['ActiveDiagnostic'] is None and outcome['InputsUnchanged'] is True
assert outcome['ObservedExecution'] is False and outcome['RawDumpOpened'] is False and outcome['NewMemoryQueries'] == outcome['SourceDraws'] == 0
false_flags(outcome); false_flags(invocation)
assert invocation['StartedAtUtc'] <= outcome['StartedAtUtc'] <= outcome['FinishedAtUtc'] <= completion['FinishedAtUtc']
console = json.loads(records['hidden-switch-transfer-inventory-attempt-1.stdout.log.gz'])
assert all(console[k] == outcome[k] for k in console)

# Verify exactly the selected input identities. Never open OriginalLocalFile or raw dump.
input_cache = {}
input_manifests = {}
original_count = original_bytes = 0
for pin in outcome['Inputs']:
    filename = pin['File']; kind = pin['Kind']
    if kind == 'manifest':
        p = BASE / filename
        raw = (NATIVE / p).read_bytes(); assert raw == git_bytes(EXECUTION, p)
        checked(raw, pin['Bytes'], pin['Sha256'])
        input_manifests[str(Path(filename).parent)] = {r['File']: r for r in json.loads(raw)['Records']}
        input_cache[filename] = raw; original_bytes += len(raw)
    elif kind == 'stored-record':
        p = BASE / filename
        raw = (NATIVE / p).read_bytes(); assert raw == git_bytes(EXECUTION, p)
        checked(raw, pin['Bytes'], pin['Sha256'])
        row = input_manifests[str(Path(filename).parent)][Path(filename).name]
        assert row['StoredBytes'] == pin['Bytes'] and row['StoredSha256'] == pin['Sha256']
        original = checked(gzip.decompress(raw), row['Bytes'], row['Sha256'])
        input_cache[filename] = original
    else:
        assert kind == 'original-record'
        raw = input_cache[filename]; checked(raw, pin['Bytes'], pin['Sha256'])
        original_count += 1; original_bytes += len(raw)
assert len(outcome['Inputs']) == 1072 and original_count == 534 and original_bytes == 7164913
assert len(input_manifests) == 4
for pin in outcome['Sources']:
    checked(git_bytes(SOURCE, 'src/Research.FSharp.Cli/' + pin['File']), pin['Bytes'], pin['Sha256'])
assert len(outcome['Sources']) == 12

def input_json(folder, name):
    return json.loads(input_cache[folder + '/' + name])

mapped_input = input_json('clrmd-mapped-attempt-1', 'helper-input.json.gz')
mapped_output = input_json('clrmd-mapped-attempt-1', 'helper-output.json.gz')
mapping = input_json('clrmd-mapping-attempt-1', 'mapping.json.gz')
mapping_rows = [r for r in mapping['Rows'] if r['Outcome']['Kind'] == 'mapped-candidate']
assert outcome['Unprepared'] == [r for r in mapping['Rows'] if r['Outcome']['Kind'] == 'unprepared']
assert outcome['ExtraCompilerBlocks'] == mapping['UnmappedCompilerBlocks']
assert len(outcome['Unprepared']) == len(outcome['ExtraCompilerBlocks']) == 9
method_rows = [json.loads(records[r['File'] + '.gz']) for r in outcome['CompletedMethods']]
assert len(method_rows) == len(mapped_input['Methods']) == 130
ranges = [(r['Address'], r['Address'] + r['Bytes'], r['Role']) for r in mapped_input['Methods']]

def membership(row):
    address = int(row['Address'], 16)
    matched = [(lo, role) for lo, hi, role in ranges if lo <= address < hi]
    assert len(matched) <= 1
    if not matched:
        assert row == {'Address': f'{address:016X}', 'Membership': 'outside-retained-code', 'Role': None, 'Offset': None}
    else:
        lo, role = matched[0]
        assert row == {'Address': f'{address:016X}', 'Membership': 'entry' if address == lo else 'interior', 'Role': role, 'Offset': address-lo}

kinds = Counter(); reasons = Counter(); target_counts = Counter(); cells = set(); unknown_cells = set(); literals = set()
words = unresolved = literal_bytes = reused = static = indirect_unsupported = comments = 0
for index, (method, expected, mapping_row) in enumerate(zip(method_rows, mapped_input['Methods'], mapping_rows, strict=True)):
    ref = outcome['CompletedMethods'][index]; checked(records[ref['File'] + '.gz'], ref['Bytes'], ref['Sha256'])
    assert method['Method'] == expected
    assert method['Reflection'] == mapping_row['Input']
    assert method['DacMetadata'] == mapped_output['Methods'][index]
    role = expected['Role']; assert method['Role'] == role
    assert method['PhysicalReadIdentity'] == input_json('clrmd-mapped-attempt-1', 'physical-' + role + '.json.gz')
    decoded = input_json('llvm-decode-attempt-3', 'decoded-' + role + '.json.gz')
    raw_input = input_json('llvm-decode-attempt-3', 'input-' + role + '.json.gz')
    assert raw_input['Method'] == expected and method['CompilerName'] == expected['CompilerName']
    assert method['Complete'] is True and method['ObservedExecution'] is False and method['UnconsumedLiteralDeclarations'] == []
    false_flags(method)
    assert len(method['Words']) * 4 == expected['Bytes']
    assembled = bytearray()
    for i, (row, original_decoded) in enumerate(zip(method['Words'], decoded['Words'], strict=True)):
        assert row['Role'] == role and row['Offset'] == i*4
        assert row['Decoded'] == original_decoded
        pc = expected['Address'] + i*4
        word = int(row['Compiler']['Word'],16); raw_word = word.to_bytes(4,'little');assembled.extend(raw_word)
        assert row['Compiler']['Offset'] == i*4 and raw_word.hex().upper() == row['Decoded']['Hex']
        shape = row['Shape']; false_flags(shape)
        assert shape['Word'] == row['Compiler']['Word'] and shape['Address'] == f'{pc:016X}'
        assert shape['ObservedExecution'] is False and 'StructuralFailure' not in shape
        words += 1; unresolved += bool(shape['Unresolved']); kinds[shape['Kind']] += 1; reasons.update(shape['Unresolved'])
        comments += row['Decoded']['ImmediateComment'] is not None
        for target in shape['Targets']:
            membership(target);target_counts[target['Membership']] += 1
        if shape['Continuation'] is not None: membership(shape['Continuation'])
        cell = shape['StaticCell']
        if cell is not None:
            static += 1;cells.add(cell['Address'])
            assert cell['Words'] == [x['Compiler']['Word'] for x in method['Words'][cell['StartIndex']:i+1]]
            if cell['PhysicalValueReused']:
                reused += 1
                candidates = [p['PhysicalReadIdentity'] for p in method_rows if p['PhysicalReadIdentity']['Cell']['Address'] == cell['Address']]
                assert len(candidates) == 1
                physical = candidates[0]; address = int(physical['Body']['Address'],16)
                checked(address.to_bytes(8,'little'), physical['Cell']['Bytes'], physical['Cell']['Sha256'])
                assert shape['Targets'][0]['Address'] == physical['Body']['Address']
            else:
                unknown_cells.add(cell['Address']);assert shape['Targets'] == []
        elif shape['Kind'] in ('call-indirect','jump-indirect'):
            indirect_unsupported += 1; assert shape['Targets'] == []
        literal = shape['Literal']
        if literal is not None:
            literal_bytes += literal['Bytes'];literals.add(literal['Address'])
            assert literal['PhysicalBinding'] is False
            assert len(bytes.fromhex(literal['ExpectedHex'])) == literal['Bytes']
        if shape['Kind'] in ('return','trap','ordinary-instruction-effects-uninspected'):
            assert shape['Targets'] == [] and shape['Continuation'] is None
    checked(bytes(assembled), expected['Bytes'], expected['BodySha256'])
assert words == outcome['Words'] == 8665 and unresolved == outcome['UnresolvedWords'] == 8524
assert kinds == outcome['Kinds'] == summary['Kinds']
assert reasons == summary['UnresolvedReasons'] and target_counts == summary['ControlTargetMembership']
assert (static, reused, len(cells), len(unknown_cells), indirect_unsupported, len(literals), literal_bytes, comments) == (191,57,67,43,39,10,152,851)
assert sum(m['Method']['Bytes'] for m in method_rows) == 34660
journal = [json.loads(line) for line in records['journal.jsonl.gz'].splitlines()]
assert len(journal) == 1217
assert [r['Identity'] for r in journal if r['Kind'] == 'source-identity'] == outcome['Sources']
assert [r['Identity'] for r in journal if r['Kind'] == 'input-identity'] == outcome['Inputs']
assert [r['Role'] for r in journal if r['Kind'] == 'method-computed'] == [m['Role'] for m in method_rows]
assert journal[-1]['Role'] == method_rows[-1]['Role']
assert sum(len(records[r['File']+'.gz']) for r in outcome['CompletedMethods']) + len(records['journal.jsonl.gz']) + len(records['outcome.json.gz']) == 7939523
result.update({'EvidenceCommit':EVIDENCE,'SourceCommit':SOURCE,'ExecutionHead':EXECUTION,'Preparation':preparation,'Methods':130,'Words':words,'BodyBytes':34660,'UnresolvedWords':unresolved,'Kinds':dict(kinds),'Reasons':dict(reasons),'TargetMembership':dict(target_counts),'StaticCellSites':static,'ReusedCellSites':reused,'DistinctCells':len(cells),'DistinctUnknownCells':len(unknown_cells),'UnsupportedIndirectSites':indirect_unsupported,'UnboundLiteralAddresses':len(literals),'ExpectedLiteralBytes':literal_bytes,'ImmediateComments':comments,'SelectedOriginalInputs':original_count,'SelectedOriginalInputBytes':original_bytes,'SourcePins':12,'OuterSourceTestPins':14,'JournalRows':len(journal),'Scope':'Independent retained-byte, source, row-association and count audit; no project import/classifier rerun or new process/dump/decoder/target query.'})
Path(__file__).with_name('result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
