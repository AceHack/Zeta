"""Read committed replay records only; never import or execute the replayer."""

import gzip
import hashlib
import json
import subprocess
from pathlib import Path

REFERENCE = Path('/Users/acehack/.zeta/agents/codex/Zeta-relational-identity-20260906')
NATIVE = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-predictor-native-20260906')
ROOT = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
BASE = Path('docs/research/hidden-switch-compiled-validation/2026-09-07')
EVIDENCE = 'cb86d8085a2f9c0e86ccb99c28c35915867d6097'


def digest(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def blob(repo, commit, file):
    return subprocess.check_output(['git', 'show', commit + ':' + str(file)], cwd=repo)


def check(raw, row, prefix=''):
    assert len(raw) == row[prefix + 'Bytes']
    assert digest(raw) == row[prefix + 'Sha256'].upper(), (row, prefix, digest(raw))


def fields(value):
    assert type(value) is dict and set(value) == {'Type', 'Fields'}
    return value['Fields']


def raw_bytes(value):
    assert type(value) is dict and set(value) == {'BytesHex'}
    return bytes.fromhex(value['BytesHex'])


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True, allow_nan=False).encode()


def load_bundle(name):
    base = BASE / name
    encoded = (REFERENCE / base / 'manifest.json').read_bytes()
    assert encoded == blob(REFERENCE, EVIDENCE, base / 'manifest.json')
    manifest = json.loads(encoded)
    content = {}
    for row in manifest['Artifacts']:
        file = base / row['File']
        stored = (REFERENCE / file).read_bytes()
        assert stored == blob(REFERENCE, EVIDENCE, file)
        check(stored, row, 'Stored')
        raw = gzip.decompress(stored)
        check(raw, row)
        assert row['File'] not in content
        content[row['File']] = raw
    return manifest, content, {'File': str(base / 'manifest.json'), 'Bytes': len(encoded), 'Sha256': digest(encoded),
                               'Records': len(content), 'OriginalBytes': sum(len(v) for v in content.values()),
                               'StoredBytes': sum(r['StoredBytes'] for r in manifest['Artifacts'])}


input_manifest, inputs, input_summary = load_bundle('native-replay-inputs')
original_commit = input_manifest['OriginalPreservationCommit']
for item in input_manifest['Artifacts']:
    original = blob(ROOT, original_commit, item['OriginalFile'])
    check(original, item, 'Stored')
    assert gzip.decompress(original) == inputs[item['File']]

summaries = []
normal_hashes = []
for name in ['native-replay-attempt-1', 'native-replay-repair']:
    manifest, content, summary = load_bundle(name)
    source = manifest['SourceCommit']
    source_rows = {row['File']: row for row in manifest['SourceFiles']}
    assert len(source_rows) == 15
    for row in source_rows.values():
        check(blob(REFERENCE, source, row['File']), row)
    for row in manifest['NativeBoundarySources']:
        raw = blob(NATIVE, row['SourceCommit'], row['File'])
        check(raw, row)
        assert raw == content[row['Snapshot']]
    validation = json.loads(content['validation.json.gz'])
    assert validation['SourceCommit'] == source
    assert validation['NewNativeLaunches'] == validation['StandalonePolicyRuns'] == 0
    assert validation['RegisteredSourceGeneration'] is False
    for row in validation['ObservedLoadedSources']:
        assert row['Bytes'] == source_rows[row['File']]['Bytes']
        assert row['Sha256'] == source_rows[row['File']]['Sha256']
    for row in validation['CapturedPublicResults']:
        check(content[row['File'] + '.gz'], row)
    records = json.loads(content['recorded-cases.json.gz'])
    evidence = json.loads(content['independent-native-evidence.json.gz'])
    assert len(records) == 38 and sum(len(fields(r)['Calls']) for r in records) == 74
    assert len(evidence) == 31
    native_reports = [raw_bytes(fields(r)['RawReport']) for r in evidence]
    assert len(set(map(digest, native_reports))) == 31
    input_reports = [v for k, v in inputs.items() if k != 'bindings.json.gz']
    assert sorted(map(digest, native_reports)) == sorted(map(digest, input_reports))
    producer_returns = producer_pending = 0
    for case_index, case_tree in enumerate(records):
        case = fields(case_tree)
        for call_index, call_tree in enumerate(case['Calls']):
            observed = json.loads(content[f'producer-{case_index:02d}-{call_index}.json.gz'])
            producer = fields(observed)
            assert producer['CaseId'] == case['CaseId'] and producer['CallIndex'] == call_index
            call = fields(call_tree)
            if producer['CompletedOperation'] == 1:
                producer_returns += 1
                actual = fields(producer['Call'])
                assert actual['Operation'] == call['Operation'] and actual['InputRoles'] == call['InputRoles']
                assert canonical(actual['Result']) == canonical(json.loads(raw_bytes(call['ResultRaw'])))
            else:
                assert producer['CompletedOperation'] == 0 and observed['Type'].endswith('.NativeCallPending')
                producer_pending += 1
    assert (producer_returns, producer_pending) == (43, 31)
    runs = []
    for run in validation['Runs']:
        raw = content[run['Name'] + '-replay.json.gz']
        result = json.loads(raw)
        value = fields(result)
        counts = fields(value['Counts'])
        assert result['Type'].endswith('.' + run['Type']) and counts == run['Counts']
        if run['Name'] in ['complete', 'pending', 'missing-native-final']:
            assert canonical(value['Records']) == canonical(records)
        returned = compared = matched = pending = 0
        for item in value['Calls']:
            call = fields(item)
            if call['Dispatch'] is not None:
                obs = fields(call['Dispatch'])
                returned += obs['Raised'] is None
            matched += call['Matched'] and call['Dispatch'] is not None
            compared += call['Matched'] and call['Evidence'] is not None
            pending += call['Pending']
            if call['Matched']:
                actual = fields(fields(call['ActualEncoding'])['Returned'])['value']
                recorded = fields(fields(call['RecordedEncoding'])['Returned'])['value']
                assert raw_bytes(actual) == raw_bytes(recorded)
                assert canonical(json.loads(raw_bytes(actual))) == canonical(json.loads(raw_bytes(fields(call['Recorded'])['ResultRaw'])))
        assert (returned, matched, compared, pending) == (counts['PythonReturned'], counts['PythonMatched'], counts['NativeCompared'], counts['NativePending'])
        if run['Name'] in ['normal-dispatch-refusal', 'malformed-nested-call']:
            assert (counts['PythonStarted'], returned, matched) == (1, 1, 0)
            assert len(value['Calls']) == 1 and value['Failure'] is not None
        runs.append({'Name': run['Name'], 'Counts': counts, 'Bytes': len(raw), 'Sha256': digest(raw)})
    normal_hashes.append([digest(content[k + '-replay.json.gz']) for k in ['complete', 'pending', 'missing-native-final']])
    summary.update(SourceCommit=source, SourceFiles=15, NativeSourceSnapshots=3,
                   ObservedLoadedSources=len(validation['ObservedLoadedSources']),
                   PublicResultReferences=len(validation['CapturedPublicResults']),
                   ProducerReturned=producer_returns, ProducerPending=producer_pending, Runs=runs)
    summaries.append(summary)
    del content

assert normal_hashes[0] == normal_hashes[1]
result = {'EvidenceCommit': EVIDENCE, 'Scope': 'Committed bytes, exact source snapshots and retained result/count associations only; no project imports or replay execution',
          'Bundles': summaries, 'OriginalNativeInputs': input_summary, 'NormalRunBytesIdenticalAcrossRepair': True,
          'PublicResultReferences': sum(s['PublicResultReferences'] for s in summaries), 'Passed': True}
Path(__file__).with_name('result.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
