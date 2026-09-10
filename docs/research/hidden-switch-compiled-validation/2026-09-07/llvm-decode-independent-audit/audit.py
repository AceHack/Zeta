"""Audit retained LLVM text/bytes and prior metadata; never invoke a decoder or open a dump."""
from pathlib import Path
import gzip
import hashlib
import json
import re

ROOT = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-predictor-native-20260906')
BASE = ROOT / 'docs/research/hidden-switch-compiled-validation/2026-09-07/llvm-decode-attempt-3'

def sha(raw):
    return hashlib.sha256(raw).hexdigest().upper()

def file_hash(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest().upper()

manifest_raw = (BASE / 'manifest.json').read_bytes()
assert len(manifest_raw) == 108216 and sha(manifest_raw) == 'DDBAE0C9820E8D02B221466D1E3F9677A350A5CE4F7C66BD4D5158652ACFE8E7'
manifest = json.loads(manifest_raw)
assert manifest['SourceCommit'] == '20043d1408bfa3a515f5d59864ad858595044707'
blobs = {}
stored_total = original_total = 0
for row in manifest['Records']:
    stored = (BASE / row['File']).read_bytes()
    assert len(stored) == row['StoredBytes'] and sha(stored) == row['StoredSha256']
    raw = gzip.decompress(stored)
    assert len(raw) == row['Bytes'] and sha(raw) == row['Sha256']
    assert (ROOT / row['OriginalLocalFile']).read_bytes() == raw
    assert row['File'][:-3] not in blobs
    blobs[row['File'][:-3]] = raw
    stored_total += len(stored)
    original_total += len(raw)
inputs = json.loads(blobs['inputs.json'])
assert inputs['SourceCommit'] == manifest['ExecutionHead']
assert inputs['Arguments'][1:] == ['--disassemble', '--triple=aarch64-apple-darwin', '--mcpu=generic', '--mattr=+rcpc', '--show-encoding']
assert inputs['Features'] == ['+rcpc'] and inputs['EnvironmentDelta'] == {} and inputs['NonemptyDyldOverrides'] == []
for pin in inputs['Pins']:
    path = Path(pin['File'])
    assert path.stat().st_size == pin['Bytes'] and file_hash(path) == pin['Sha256']
assert len(inputs['Pins']) == 144
mapped = Path(next(pin['File'] for pin in inputs['Pins'] if Path(pin['File']).name == 'helper-output.json'))
metadata = json.loads(mapped.read_bytes())
by_role = {row['Role']: row for row in metadata['Methods']}
assert len(by_role) == 130
all_words = []
comments = 0
cursor = 0
lines = blobs['helper.stdout.log'].decode('ascii').splitlines()
assert blobs['helper.stderr.log'] == b''
method_inputs = sorted(name for name in blobs if name.startswith('input-method-'))
assert len(method_inputs) == 130
roles = []
for name in method_inputs:
    record = json.loads(blobs[name])
    method, words = record['Method'], record['Words']
    role = method['Role']; roles.append(role)
    decoded = json.loads(blobs['decoded-' + role + '.json'])
    assert decoded['Role'] == role and decoded['ReEncodedBytesMatch'] is True
    assert all(decoded[key] is False for key in ('BodyResolved', 'ClosureAdmitted', 'RuntimeAdmitted'))
    assert len(words) == len(decoded['Words']) == method['Bytes'] // 4
    data = b''.join(bytes.fromhex(word['Hex']) for word in words)
    assert sha(data) == method['BodySha256']
    physical = json.loads((mapped.parent / ('physical-' + role + '.json')).read_bytes())
    assert physical['CompilerMatchesPhysical'] is True
    assert physical['Body']['PhysicalFileBacking'] is True
    assert sha(data) == physical['Body']['Sha256'] and len(data) == physical['Body']['Bytes']
    assert method['Address'] == int(physical['Body']['Address'], 16)
    meta = by_role[role]
    assert meta['HotStart'] == meta['NativeCode'] == method['Address'] and meta['HotSize'] == method['Bytes']
    assert meta['ColdSize'] == 0 and meta['Token'] == method['Token']
    for offset, (word, row) in enumerate(zip(words, decoded['Words'], strict=True)):
        assert word['Role'] == role and word['Offset'] == 4 * offset
        assert int(word['Address'], 16) == method['Address'] + 4 * offset
        assert all(row[key] == word[key] for key in word)
        line = lines[cursor]; text_line = cursor + 1; cursor += 1
        match = re.fullmatch(r'\s*([^;]+?)\s+; encoding: \[(0x[0-9a-f]{2},0x[0-9a-f]{2},0x[0-9a-f]{2},0x[0-9a-f]{2})\]', line)
        assert match is not None
        assert bytes(int(part, 16) for part in match[2].split(',')) == bytes.fromhex(word['Hex'])
        assert row['Instruction'] == match[1].strip() and row['TextLine'] == text_line
        comment = None
        if cursor < len(lines) and lines[cursor].lstrip().startswith(';'):
            comment = lines[cursor]; cursor += 1; comments += 1
            annotation = re.fullmatch(r' {40}; =0x([0-9a-f]{1,16})', comment)
            immediate = re.fullmatch(r'mov\s+([wx])(?:[0-9]|[12][0-9]|30), #(-?[0-9]+)', row['Instruction'])
            assert annotation is not None and immediate is not None
            width = 32 if immediate[1] == 'w' else 64
            assert len(annotation[1]) <= width // 4
            assert int(annotation[1], 16) == int(immediate[2]) % (1 << width)
        assert row['ImmediateComment'] == comment
        assert row['PrintedAddressMeaning'] == 'chunk-relative/zero printer address; never a runtime target'
        all_words.append(word)
assert cursor == len(lines) and len(all_words) == 8665 and comments == 851
atomic = ('\n'.join('[' + ' '.join(f'0x{byte:02x}' for byte in bytes.fromhex(word['Hex'])) + ']' for word in all_words) + '\n').encode('ascii')
assert atomic == blobs['decoder.input']
outcome = json.loads(blobs['outcome.json'])
assert outcome['Complete'] is True and outcome['Failure'] is None and outcome['CleanupFailures'] == []
assert outcome['CompletedMethods'] == roles and outcome['ActiveDecodedPrefix'] == []
assert outcome['InputsUnchanged'] is True and outcome['Process']['ExitCode'] == 0
assert all(outcome[key] is False for key in ('BodyResolved', 'ClosureAdmitted', 'RuntimeAdmitted', 'DumpAccess', 'NewPolicyExecution'))
print(json.dumps({'SourceCommit': manifest['SourceCommit'], 'ExecutionHead': manifest['ExecutionHead'],
 'ManifestSha256': sha(manifest_raw), 'Records': len(blobs), 'StoredBytes': stored_total,
 'OriginalBytes': original_total, 'RecheckedFilePins': len(inputs['Pins']), 'Methods': len(roles),
 'Words': len(all_words), 'Bytes': 4 * len(all_words), 'RawComments': comments, 'TextLines': len(lines),
 'Process': outcome['Process'], 'FinishedAtUtc': outcome['FinishedAtUtc'],
 'PhysicalScope': 'retained read receipts and prior accepted mapping; no dump reread',
 'NoDecoderOrTargetExecution': True, 'FullAdmissionFlags': False}, indent=2))
