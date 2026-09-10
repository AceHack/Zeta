"""Read-only registered-1 custody and exact recorded-comparison audit.

No project imports, service calls, native launches, exp/log evaluation or solver
reruns. Fractions only check arithmetic relations between retained values.
"""

import ast
import copy
import hashlib
import io
import json
import math
import pathlib
import struct
import subprocess
import tarfile
import zlib
from collections import Counter
from datetime import datetime
from fractions import Fraction

P = pathlib.Path('/Users/acehack/.zeta/agents/codex/Zeta-projection-publication-20260908')
A = P / '.git/projection-final-attempts/registered-1'
C = P / '.git/projection-final-execution-1'
D = P / 'docs/research/precision-gate-projection/2026-09-08/registered-1'
SOURCE = 'f33ac42959388344fc3c82058f165764954fa22d'
EXECUTED = '4937d7468446599e966adc65c0ca1e9be54472aa'
MANIFEST_SHA = 'FE1F5BDF732FA6B08092887210552BA9CEF68D724E519C77958A282366A348E7'
PROTOCOL_SHA = '537054779BF9E0BFA9271B5CC56116FBC80B16C4A2BE9F1B5E3C022FE95A0F8E'
report = {'Scope': 'retained-data-only; no numerical service or process rerun'}


def sha(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def pairs(rows):
    result = {}
    for k, v in rows:
        assert k not in result, ('duplicate JSON key', k)
        result[k] = v
    return result


def bad_constant(s):
    raise ValueError(s)


def finite_float(s):
    v = float(s)
    assert math.isfinite(v)
    return v


def decode(raw):
    return json.loads(raw.decode('utf-8', 'strict'), object_pairs_hook=pairs,
                      parse_constant=bad_constant, parse_float=finite_float)


def read(path):
    assert path.is_file() and not path.is_symlink(), path
    raw = path.read_bytes()
    assert len(raw) <= 64 * 1024 * 1024, path
    return raw


def load(path):
    return decode(read(path))


def unwrap(v):
    # Inspect the already retained public encoding; never instantiate a type.
    if isinstance(v, dict):
        if set(v) == {'Type', 'Fields'}:
            assert isinstance(v['Type'], str)
            return unwrap(v['Fields'])
        return {k: unwrap(x) for k, x in v.items()}
    if isinstance(v, list):
        return [unwrap(x) for x in v]
    return v


def git_blob(commit, path):
    return subprocess.run(['git', 'show', f'{commit}:{path}'], cwd=P,
                          check=True, capture_output=True).stdout


def interval(x):
    assert set(x) == {'Lower', 'Upper'}
    lo, hi = Fraction(x['Lower']), Fraction(x['Upper'])
    assert lo <= hi
    return lo, hi


def ratio(x):
    assert set(x) == {'Num', 'Den'}
    n, d = int(x['Num']), int(x['Den'])
    assert d > 0
    f = Fraction(n, d)
    assert str(f.numerator) == x['Num'] and str(f.denominator) == x['Den']
    return f


def bits(x):
    assert len(x) == 16 and x == x.upper()
    n = int(x, 16)
    e = (n >> 52) & 2047
    assert e != 2047
    m = n & ((1 << 52) - 1)
    if e:
        m |= 1 << 52
    power = (e - 1023 - 52) if e else -1074
    return (-1 if n >> 63 else 1) * Fraction(m) * Fraction(2) ** power


def encbits(v):
    return struct.pack('>d', v).hex().upper()


def canonical(v):
    return (json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=True) + '\n').encode()


archive_manifest = load(D / 'manifest.json')
stored = read(D / 'custody.tar.gz')
assert len(stored) == archive_manifest['Bytes'] == 6397793
assert sha(stored) == archive_manifest['Sha256'] == '04C079901CEA886500CFD0A5912CD812A997268803FAE3F0DAD4F8EDE65A8167'
gz = zlib.decompressobj(31)
tar_raw = gz.decompress(stored, 64 * 1024 * 1024)
assert gz.eof and not gz.unused_data and not gz.unconsumed_tail
expected = {r['Path']: r for r in archive_manifest['Members']}
assert len(expected) == len(archive_manifest['Members']) == archive_manifest['MemberCount'] == 336
payload = 0
archive_bytes = {}
with tarfile.open(fileobj=io.BytesIO(tar_raw), mode='r:') as tf:
    members = tf.getmembers()
    assert len(members) == 336 and {m.name for m in members} == set(expected)
    for m in members:
        assert m.isfile() and not pathlib.PurePosixPath(m.name).is_absolute()
        assert '..' not in pathlib.PurePosixPath(m.name).parts
        r = expected[m.name]
        raw = tf.extractfile(m).read()
        assert len(raw) == m.size == r['Bytes'] and sha(raw) == r['Sha256']
        assert raw == read(pathlib.Path(r['OriginalPath'])), m.name
        payload += len(raw)
        archive_bytes[m.name] = raw
assert payload == archive_manifest['PayloadBytes']
actual_paths = sorted(str(p.relative_to(A)) for p in A.rglob('*') if p.is_file())
archived_paths = sorted(n.removeprefix('attempt/') for n in expected if n.startswith('attempt/'))
assert actual_paths == archived_paths and len(actual_paths) == 328
assert sum(len(archive_bytes['attempt/' + n]) for n in actual_paths) == 21527800
assert read(D / 'observation.json') in archive_bytes.values()
report['Archive'] = {'Members': 336, 'OriginalPathsMatched': 336, 'AttemptFiles': 328,
                     'AttemptFileBytes': 21527800, 'PayloadBytes': payload,
                     'StoredBytes': len(stored), 'StoredSha256': sha(stored),
                     'TarBytes': len(tar_raw), 'TarSha256': sha(tar_raw)}

manifest_raw = read(A / 'manifest.json')
assert len(manifest_raw) == 9821 and sha(manifest_raw) == MANIFEST_SHA
manifest = decode(manifest_raw)
source_rows = manifest['SourceFiles']
native_rows = manifest['NativeFiles']
assert len(source_rows) == 47 and len({x['Path'] for x in source_rows}) == 47
assert len(native_rows) == 5 and len({x['Role'] for x in native_rows}) == 5
bindings = {x['Path']: x['Sha256'] for x in source_rows} | {'ProtocolSha256': PROTOCOL_SHA}
for r in source_rows:
    raw = read(P / r['Path'])
    assert len(raw) == r['Bytes'] and sha(raw) == r['Sha256']
    assert raw == git_blob(SOURCE, r['Path']) == git_blob(EXECUTED, r['Path'])
assert read(A / 'source-snapshot-1.json') == read(A / 'source-snapshot-2.json')
snapshot = unwrap(load(A / 'source-snapshot-1.json'))
assert snapshot['Complete'] is True and snapshot['Failure'] is None
assert [r['Expected'] for r in snapshot['Files']] == source_rows
for r in snapshot['Files']:
    assert r['Matched'] is True and r['Raised'] is r['Refusal'] is None
    assert (r['ActualBytes'], r['ActualSha256']) == (r['Expected']['Bytes'], r['Expected']['Sha256'])
assert len(snapshot['Modules']) == 14
for r in snapshot['Modules']:
    assert r['File'] == r['Origin']
    path = pathlib.Path(r['File']).relative_to(P).as_posix()
    assert path in bindings and sha(read(P / path)) == bindings[path]
report['Sources'] = {'Rows': 47, 'GitCut': SOURCE, 'ExecutedCut': EXECUTED,
                     'Modules': 14, 'SnapshotSha256': sha(read(A / 'source-snapshot-1.json'))}

outer = unwrap(load(A / 'outer-final.json'))
terminal_descriptor = outer['Run']['Terminal']
terminal = load(A / terminal_descriptor['File'])
journal = unwrap(load(A / outer['Run']['FinalJournal']['File']))
descriptors = {}


def scan(v):
    if isinstance(v, dict):
        if set(v) == {'File', 'Bytes', 'Sha256', 'StoredBytes', 'StoredSha256', 'Encoding'}:
            assert v['Encoding'] == 'identity'
            path = pathlib.PurePosixPath(v['File'])
            assert not path.is_absolute() and '..' not in path.parts
            raw = read(A / path)
            assert len(raw) == v['Bytes'] == v['StoredBytes']
            assert sha(raw) == v['Sha256'] == v['StoredSha256']
            if v['File'] in descriptors:
                assert descriptors[v['File']] == v
            descriptors[v['File']] = v
        for child in v.values():
            scan(child)
    elif isinstance(v, list):
        for child in v:
            scan(child)


for obj in (outer, terminal, journal):
    scan(obj)
assert len(descriptors) == 242
assert terminal['PrimaryFailure'] is None and terminal['Pending'] == []
assert terminal['RosterCollected'] is terminal['ExpectedOutcomesPassed'] is True
assert outer['Failure'] is None and outer['SecondaryFailures'] == []
assert outer['RuntimeClosureAdmitted'] is outer['SourceToMachineAdmitted'] is False
assert outer['Run']['CollectionAndCriteriaPassed'] is True
assert outer['Run']['Counters'] == terminal['Counters']
assert outer['Run']['CoreCertified'] == terminal['CoreCertified']
assert outer['Run']['Pending'] == [] and outer['Run']['PrimaryFailure'] is None
assert outer['Run']['SecondaryFailureCount'] == 0
assert outer['SetupFinalJournal'] is None
reservation = outer['Reservation']
assert reservation['CopiedBytes'] == 10502579 and reservation['ManifestBytes'] == 9821
driver = 2 * (10502579 + 9821 + 27 * (65536 + 65536 + 2097152) + 4 * 1048576)
assert driver == reservation['DriverCombinedBytes'] == 149737504
assert reservation['DriverSlots'] == 90 and reservation['UnusedReservationsReclaimed'] is False
assert reservation['Inner'] == journal['Limits'] == {'Artifacts': 422, 'CombinedBytes': 118697952, 'FinalJournalBytes': 8388608}
assert driver + journal['Limits']['CombinedBytes'] == 256 * 1024 * 1024
assert 90 + 422 == 512
assert len(journal['Attempts']) == len(journal['Artifacts']) == 237
assert journal['PrimaryFailure'] is None
record_bytes = 0
for i, r in enumerate(journal['Attempts']):
    assert r['Sequence'] == i and r['File'] == f'records/record-{i:06}.bin'
    assert r['Expected'] == journal['Artifacts'][i] == descriptors[r['File']]
    n = r['Expected']['Bytes']
    assert r['Failure'] is None and r['ReservedSlot'] is True
    assert r['ReservedRawBytes'] == r['ReservedStoredBytes'] == n
    assert r['Write']['Operation'] == 'write_exclusive' and r['Write']['Raised'] is None
    assert r['Write']['Returned'] == {'value': n}
    assert r['ReadObservation'] == {'Bytes': n, 'Kind': 'admitted-byte-observation',
                                    'Operation': 'read_artifact', 'Sha256': r['Expected']['Sha256']}
    record_bytes += n
assert journal['ReservedRawBytes'] == journal['ReservedStoredBytes'] == record_bytes + 4194304 == 14382753
assert journal['ReservedSlots'] == 238 <= 422
assert 2 * 14382753 <= 118697952
assert read(A / 'records/final-journal.json').__len__() <= 4194304
report['Retention'] = {'DistinctDescriptorPaths': len(descriptors), 'NumberedRecords': 237,
                       'NumberedRecordBytes': record_bytes, 'InnerReservedEach': 14382753,
                       'InnerReservedSlots': 238, 'DriverReservedCombined': driver,
                       'InnerLimitCombined': 118697952, 'NoRefund': True}

# Parse only fixed literal Case constructor data; never import or execute source.
tree = ast.parse(read(P / 'src/Interp.Python/zeta_interp/precision_gate_projection_cases.py'))
constants = {}
for node in tree.body:
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        name = node.targets[0].id
        if name in ('CSTAR', 'WIRE_IDS', 'CERTIFICATE_IDS'):
            constants[name] = ast.literal_eval(node.value)
        elif name in ('BASE_CASES', 'REFERENCE_LIMIT'):
            calls = node.value.elts if isinstance(node.value, ast.Tuple) else [node.value]
            values = []
            for call in calls:
                assert isinstance(call, ast.Call) and call.func.id == 'Case' and not call.keywords
                values.append([constants[a.id] if isinstance(a, ast.Name) else ast.literal_eval(a) for a in call.args])
            constants[name] = values
base = constants['BASE_CASES']
ref_limit = constants['REFERENCE_LIMIT'][0]
wire_ids = constants['WIRE_IDS']
mutant_ids = constants['CERTIFICATE_IDS']
roster = [(c[0], op) for c in base for op in ('NativeSolve', 'ReferenceRoot', 'CertifyNative')]
roster += [(ref_limit[0], 'ReferenceRoot')]
roster += [(c, op) for c in wire_ids for op in ('NativeSolve', 'ReferenceRoot')]
roster += [(c, 'CertifyNative') for c in mutant_ids]
assert len(roster) == 88 and len({r[0] for r in roster}) == 40
assert len(base) == 21 and len(wire_ids) == 6 and len(mutant_ids) == 12
inputs = {}
for row in base + [ref_limit]:
    cid, t, u, k, c, _class, *profile = row
    inputs[cid] = canonical({'Schema': 'zeta.precision-projection.input.v1', 'Id': cid,
                             'Parameters': dict(T=t, U=u, K=k, C=c), 'Profile': profile[0] if profile else 'default'})
for cid in wire_ids:
    obj = decode(inputs['core/unconstructed'])
    if cid == 'wire/t-boolean': obj['Parameters']['T'] = True
    if cid == 'wire/u-NaN': obj['Parameters']['U'] = 'NaN'
    if cid == 'wire/u-infinity': obj['Parameters']['U'] = 'Infinity'
    if cid == 'wire/missing-c': del obj['Parameters']['C']
    if cid == 'wire/unknown-field': obj['Unexpected'] = 0
    raw = canonical(obj)
    if cid == 'wire/duplicate-t': raw = raw.replace(b'"T":"1"', b'"T":"1","T":"1"')
    inputs[cid] = raw
for cid in mutant_ids:
    inputs[cid] = inputs['core/unconstructed']

entries = terminal['Entries']
assert [(e['CaseId'], e['Operation']) for e in entries] == roster
core = [c[0] for c in base if c[5] == 'core']
assert len(core) == 12 and terminal['CoreCertified'] == core
receipts = {}
native_raw = {}
observations = []
outcomes = []
leaves = []
roots = []
record_order = []
mutations = []
baseline_raw = read(A / terminal['Baseline']['File'])


def check_target(target, raw_input):
    obj = decode(raw_input)
    assert target['RequestedParameters'] == obj['Parameters']
    for k, text in obj['Parameters'].items():
        b = target['TargetBits'][k]
        assert b == encbits(float(text))
        assert ratio(target['DyadicTarget'][k]) == bits(b)
        assert ratio(target['ConversionDelta'][k]) == bits(b) - Fraction(text)


def check_root(r):
    trace = r['Trace']
    counters = r['Counters']
    assert [x['Sequence'] for x in trace] == list(range(1, len(trace) + 1))
    assert counters['MidpointAttempts'] <= 256 and counters['TranscendentalEntries'] <= 4096
    assert counters['PrecisionEscalations'] <= 2 and counters['ParameterPreparations'] <= 3
    assert [x['Precision'] for x in r['Contexts']] in ([], [80], [80, 160], [80, 160, 320])
    assert counters['ParameterPreparations'] == len([x for x in trace if x['Stage'] == 'parameters'])
    assert counters['EndpointEvaluations'] == len([x for x in trace if x['Stage'] in ('left-endpoint', 'right-endpoint')])
    assert counters['MidpointEvaluations'] == len([x for x in trace if x['Stage'] == 'midpoint' and x['Phi'] is not None])
    kind = r['Outcome']['Kind']
    if kind == 'enclosure':
        v = r['Outcome']['Value']
        lo, hi = interval(v['LogRatio'])
        ml, mh = interval(v['Mean'])
        vl, vh = interval(v['Variance'])
        assert vl > 0 and mh - ml <= Fraction(1, 10**50) and vh - vl <= Fraction(1, 10**50)
        moment = [x for x in trace if x['Stage'] == 'moments'][-1]
        assert moment['Mean'] == v['Mean'] and moment['Variance'] == v['Variance'] and moment['After'] == v['LogRatio']
        assert interval(moment['M1'])[0] <= ml <= mh <= interval(moment['M1'])[1]
        assert interval(moment['M2'])[0] <= ml <= mh <= interval(moment['M2'])[1]
        assert trace[-1]['Stage'] == 'terminal' and trace[-1]['Failure'] is None
    else:
        assert trace[-1]['Failure'] == r['Outcome']['Failure']
    roots.append({'CaseId': r['CaseId'], 'Kind': kind, 'Counters': counters, 'TraceRows': len(trace)})


for i, e in enumerate(entries):
    cid, op = roster[i]
    assert e['Index'] == i
    assert e['Entered'] is e['CompleteReceipt'] is e['ReceiptRetained'] is True
    arts = e['Artifacts']
    record_order += [x['File'] for x in arts]
    raw_input = read(A / arts[0]['File'])
    assert raw_input == inputs[cid]
    assert len(arts) == (2 if op == 'ReferenceRoot' else 3)
    raw = read(A / arts[-1]['File'])
    r = decode(raw)
    receipts[(cid, op)] = r
    numeric_id = 'core/unconstructed' if cid in (*wire_ids, *mutant_ids) else cid
    assert r['CaseId'] == numeric_id and r['Bindings'] == bindings and r['InputSha256'] == sha(raw_input)
    assert r['Schema'] == {'NativeSolve': 'zeta.precision-projection.native.v1',
                           'ReferenceRoot': 'zeta.precision-projection.reference.v1',
                           'CertifyNative': 'zeta.precision-projection.certificate.v1'}[op]
    assert all(type(v) is int and v >= 0 for v in r['Counters'].values())
    kind = r['Outcome']['Kind']
    failure = r['Outcome'].get('Failure', r['Outcome'].get('NativeFailure'))
    if failure is not None:
        assert set(failure) == {'Code', 'Stage', 'Field', 'Message', 'OriginalKernelFailure'}
        assert failure['Code'] not in ('Unexpected', 'ResultTooLarge')
    code = failure['Code'] if failure else None
    assessment = unwrap(e['Assessment'])['value']
    assert (assessment['CaseId'], assessment['Operation'], assessment['Kind'], assessment['FailureCode']) == (cid, op, kind, code)
    assert assessment['Abnormal'] is False
    if cid in core:
        assert kind == {'NativeSolve': 'candidate', 'ReferenceRoot': 'enclosure', 'CertifyNative': 'certified'}[op]
    if cid.startswith('domain/'):
        assert code == 'Domain'
        assert failure['Stage'] == ('input' if op == 'ReferenceRoot' else 'parameters')
    if cid in wire_ids:
        assert kind == 'refused' and code == 'Wire' and failure['Stage'] == 'input'
        assert all(v == 0 for v in r['Counters'].values())
    if (cid, op) in (('limit/native-midpoints', 'NativeSolve'), ('limit/reference-midpoints', 'ReferenceRoot')):
        assert code == 'IterationLimit' and failure['Stage'] == 'midpoint' and r['Counters']['MidpointAttempts'] == 1
    if cid in mutant_ids:
        assert kind == 'refused' and failure is not None
    if op == 'NativeSolve':
        native_raw[cid] = raw
        obs = unwrap(load(A / arts[1]['File']))
        assert obs['Complete'] is obs['LaunchAttempted'] is obs['DirectChildClosed'] is obs['ReadersClosed'] is True
        assert type(obs['ChildPid']) is int and obs['ChildPid'] > 0
        assert obs['ExitCode'] == obs['CleanupExitCode'] == 0 and obs['Failure'] is None and obs['Cleanup'] == []
        for prefix in ('Stdout', 'Stderr'):
            assert obs[prefix + 'Eof'] is True and obs[prefix + 'Failure'] is None and obs[prefix + 'LimitExceeded'] is False
            assert len(bytes.fromhex(obs[prefix]['BytesHex'])) <= 65536
        assert obs['Stderr'] == {'BytesHex': ''}
        producer = decode(bytes.fromhex(obs['Stdout']['BytesHex']))
        assert producer == obs['Producer']
        assert producer['Complete'] is producer['ReceiptAvailable'] is True
        assert producer['Failure'] is producer['ApiFailure'] is None and producer['Cleanup'] == []
        assert producer['Counters'] == r['Counters'] and producer['TraceRows'] == len(r['Trace']) and producer['ReceiptKind'] == kind
        call = A / f'native-call-{i:03}'
        assert read(call / 'input.json') == raw_input and read(call / 'receipt.json') == raw
        assert load(call / 'bindings.json') == bindings
        assert obs['Argv'] == [str(pathlib.Path('/Users/acehack/.local/share/mise/dotnet-root/dotnet')), 'fsi', '--exec',
                                str(A / 'native-custody/src/Research.FSharp/PrecisionGateProjectionReplay.fsx'),
                                str(call / 'input.json'), sha(raw_input), numeric_id,
                                str(call / 'bindings.json'), str(call / 'receipt.json')]
        for rfile in obs['InputFiles'] + [obs['Output']]:
            content = read(pathlib.Path(rfile['Path']))
            assert (len(content), sha(content)) == (rfile['Bytes'], rfile['Sha256'])
        assert producer['InputFiles'] == obs['InputFiles'] and producer['Output'] == obs['Output']
        assert len(obs['Dependencies']) == 5 and len(producer['AssemblyFiles']) == 2
        for dep, pin in zip(obs['Dependencies'], native_rows, strict=True):
            assert dep['Role'] == pin['Role']
            for key in ('Original', 'Before', 'After'):
                val = dep[key]
                assert (val['Bytes'], val['Sha256']) == (pin['Bytes'], pin['Sha256'])
                content = read(pathlib.Path(val['Path']))
                assert len(content) == pin['Bytes'] and sha(content) == pin['Sha256']
            if pin['Role'] == '@host':
                assert dep['Copy'] is dep['Producer'] is None
            else:
                assert dep['Copy'] == dep['Before'] == dep['After']
                assert dep['Copy']['Path'] == str(A / 'native-custody' / pin['Role'])
                expected_producer = next((x for x in producer['AssemblyFiles'] if x['Path'] == dep['Copy']['Path']), None)
                assert dep['Producer'] == expected_producer
        times = [datetime.fromisoformat(obs[k]) for k in ('StartedAtUtc', 'LaunchStartedAtUtc', 'FinishedAtUtc')]
        assert times == sorted(times)
        if observations: assert datetime.fromisoformat(observations[-1]['FinishedAtUtc']) <= times[0]
        observations.append({k: obs[k] for k in ('ChildPid', 'StartedAtUtc', 'LaunchStartedAtUtc', 'FinishedAtUtc', 'ExitCode', 'DirectChildClosed')})
        trace = r['Trace']; n = r['Counters']['MidpointAttempts']
        assert [x['Sequence'] for x in trace] == list(range(1, len(trace)+1))
        assert [x['Attempt'] for x in trace if x['Stage'] == 'midpoint'] == list(range(1, n+1))
        assert r['Counters']['PhiEntries'] == r['Counters']['ExpEntries']
        if kind == 'candidate':
            v = r['Outcome']['Value']
            assert [x['Stage'] for x in trace] == ['input', 'parameters', 'left-endpoint', 'right-endpoint'] + ['midpoint']*n + ['reconstruction', 'objective']
            assert all(x['Failure'] is None for x in trace)
            assert r['Counters']['Starts'] == r['Counters']['ObjectiveEntries'] == 1
            assert r['Counters']['LogEntries'] == 3 and r['Counters']['PhiEntries'] == 2+n
            assert r['Counters']['BracketUpdates'] == n-(v['Stop']=='rounded-zero')
            assert bits(v['VarianceBits']) > 0 and bits(v['RatioBits']) > 0 and bits(v['RBits']) > 0
            assert bits(v['Bracket']['LowerBits']) <= bits(v['LogRatioBits']) <= bits(v['Bracket']['UpperBits'])
        else: assert trace[-1]['Failure'] == failure
    elif op == 'ReferenceRoot':
        check_root(r)
        if r['Target'] is not None: check_target(r['Target'], raw_input)
    else:
        supplied = read(A / arts[1]['File'])
        assert r['NativeRaw'] == {'BytesHex': supplied.hex(), 'Bytes': len(supplied), 'Sha256': sha(supplied)}
        if cid not in mutant_ids:
            assert supplied == native_raw[cid]
        else:
            modified = copy.deepcopy(decode(baseline_raw))
            v = modified['Outcome']['Value']
            changed_field = None
            field_map = {'cert/log-ratio': 'LogRatioBits', 'cert/ratio': 'RatioBits', 'cert/r': 'RBits'}
            objective_map = {'cert/objective': 'ValueBits', 'cert/mean-gradient': 'DerivativeMeanBits', 'cert/variance-gradient': 'DerivativeVarianceBits'}
            if cid == 'cert/mean': v['MeanBits'] = '4090000000000000'; changed_field = 'MeanBits'
            elif cid == 'cert/variance-zero': v['VarianceBits'] = '0000000000000000'; changed_field = 'VarianceBits'
            elif cid in field_map:
                f = field_map[cid]; v[f] = encbits(float(bits(v[f]) + 1)); changed_field = f
            elif cid in objective_map:
                f = objective_map[cid]; v['OriginalObjective'][f] = encbits(float(bits(v['OriginalObjective'][f]) + 1)); changed_field = 'OriginalObjective.'+f
            elif cid == 'cert/target-zero-sign': v['TargetBits']['U'] = '8000000000000000'; changed_field = 'TargetBits.U'
            elif cid == 'cert/source-binding': modified['Bindings']['ProtocolSha256'] = '0'*64; changed_field = 'Bindings.ProtocolSha256'
            elif cid == 'cert/missing-objective': del v['OriginalObjective']; changed_field = 'OriginalObjective'
            elif cid == 'cert/reversed-bracket':
                v['Bracket']['LowerBits'],v['Bracket']['UpperBits'] = v['Bracket']['UpperBits'],v['Bracket']['LowerBits']; changed_field = 'Bracket'
            assert decode(supplied) == modified and supplied == canonical(modified) and supplied != baseline_raw
            mutations.append({'CaseId':cid, 'ChangedField':changed_field, 'SuppliedSha256':sha(supplied), 'Failure':failure})
        if r['Target'] is not None: check_target(r['Target'], raw_input)
        if r['Reference'] is not None:
            check_root(r['Reference'])
            assert r['Reference'] == receipts[('core/unconstructed' if cid in mutant_ids else cid, 'ReferenceRoot')]
        if kind == 'no-candidate':
            assert r['Outcome']['NativeFailure'] == decode(supplied)['Outcome']['Failure']
            assert r['Reference'] is r['Coordinates'] is r['Objective'] is None
            assert r['Counters']['ReferenceRootCalls'] == 0
        if r['CertificateContext'] is not None:
            assert r['CertificateContext'] == r['Reference']['Contexts'][-1]
        value = decode(supplied)['Outcome'].get('Value')
        field_roster = ['MeanBits','VarianceBits','RatioBits','RBits','OriginalObjective.ValueBits','OriginalObjective.DerivativeMeanBits','OriginalObjective.DerivativeVarianceBits']
        assert [x['Field'] for x in r['LeafChecks']] == field_roster[:len(r['LeafChecks'])]
        assert r['Counters']['LeafChecks'] == len(r['LeafChecks']) <= 7
        for leaf in r['LeafChecks']:
            field = leaf['Field']; encoded = value
            for part in field.split('.'): encoded = encoded[part]
            assert encoded == leaf['NativeBits']
            n = bits(encoded); lo,hi = interval(leaf['ReferenceInterval'])
            tol = Fraction(1,10**12)*(1+(max(abs(lo),abs(hi)) if field.startswith('OriginalObjective.') else abs(n)))
            assert ratio(leaf['Tolerance']) == tol
            assert leaf['Passed'] is (max(abs(n-lo),abs(n-hi)) <= tol)
            if field == 'MeanBits': expected_iv = r['Reference']['Outcome']['Value']['Mean']
            elif field == 'VarianceBits': expected_iv = r['Reference']['Outcome']['Value']['Variance']
            elif field in ('RatioBits','RBits'): expected_iv = r['Coordinates']['Value'][field.removesuffix('Bits')]
            else: expected_iv = r['Objective']['Value'][field.split('.')[1].removesuffix('Bits')]
            assert leaf['ReferenceInterval'] == expected_iv
            leaves.append({'CaseId':cid, 'Field':field, 'Passed':leaf['Passed'], 'DistanceOverTolerance':str(max(abs(n-lo),abs(n-hi))/tol)})
        for name,counter in [('Coordinates','CoordinateIntervalCalls'),('Objective','ObjectiveIntervalCalls')]:
            assert r['Counters'][counter] == (r[name] is not None)
            if r[name] is not None:
                assert r[name]['Context'] == r['CertificateContext'] and r[name]['Kind'] == 'returned'
        assert r['Counters']['CertificateTranscendentalEntries'] <= 6
        if kind == 'certified':
            assert r['Outcome'] == {'Kind':'certified','TargetScope':'exact-native-dyadic','NativeTrajectoryCertified':False,'GraphApplicationPerformed':False}
            assert len(r['LeafChecks']) == 7 and all(x['Passed'] for x in r['LeafChecks'])
            assert r['Counters']['ReferenceRootCalls'] == r['Counters']['CertificatePreparations'] == r['Counters']['Starts'] == 1
        if r['LeafChecks'] and r['LeafChecks'][-1]['Passed'] is False:
            assert all(x['Passed'] for x in r['LeafChecks'][:-1]) and failure['Field'] == r['LeafChecks'][-1]['Field']
    outcomes.append({'Index':i,'CaseId':cid,'Operation':op,'Kind':kind,'Failure':failure,'Counters':r['Counters']})

assert record_order == [f'records/record-{i:06}.bin' for i in range(236)]
assert len(observations) == len({o['ChildPid'] for o in observations}) == 27
assert baseline_raw == native_raw['core/unconstructed']
assert receipts[('core/unconstructed','CertifyNative')]['Outcome']['Kind'] == 'certified'
assert roster.index(('core/unconstructed','CertifyNative')) == 23 < 76 == roster.index((mutant_ids[0],'CertifyNative'))
counts = Counter(x['Kind'] for x in outcomes)
assert counts == {'candidate':13,'enclosure':15,'certified':12,'refused':40,'no-candidate':8}
assert terminal['Counters'] == {'Checked':88,'CompleteReceipts':88,'Entered':88,'NativeChildrenClosed':27,'NativeChildrenStarted':27,'NativeLaunchAttempts':27,'Planned':88,'Raised':0,'RetainedReceipts':88,'Returned':88}
report['Outcomes'] = outcomes
report['OutcomeCounts'] = dict(counts)
report['Processes'] = observations
report['RecordedLeafChecks'] = leaves
report['RecordedRootChecks'] = roots
report['Mutations'] = mutations
report['Baseline'] = {'NativeArtifact':terminal['Baseline'],'CertifiedSlot':23,'FirstMutationSlot':76}

invocation = load(C/'invocation.json')
completion = load(C/'completion.json')
prerequisites = load(C/'prerequisites.json')
assert completion['ExitCode'] == 0 and completion['ElapsedSeconds'] == 40.66178766702069
assert read(C/'stderr.txt') == b''
assert len(read(C/'stdout.txt')) == 282
locator = load(C/'stdout.txt')
assert locator['Complete'] is True
assert datetime.fromisoformat(observations[0]['StartedAtUtc']).timestamp() >= invocation['StartedUnix']
assert datetime.fromisoformat(observations[-1]['FinishedAtUtc']).timestamp() <= completion['FinishedUnix']
report['Coordinator'] = {'Invocation':invocation,'Completion':completion,'Locator':locator,
                         'PrerequisiteSha256':sha(read(C/'prerequisites.json')),
                         'HelperSha256':sha(read(P/'.git/projection-final-execution-1.py'))}
report['Accepted'] = True
print(json.dumps(report, indent=2, sort_keys=True))
