from __future__ import annotations

import dataclasses
import hashlib
import json
from collections.abc import Callable
from typing import cast

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_bindings as bindings
from zeta_interp import hidden_switch_compiled_conformance as c
from zeta_interp import hidden_switch_compiled_record_encoding as encoding
from zeta_interp import hidden_switch_compiled_reference as reference
from zeta_interp import hidden_switch_compiled_static_fixtures as fixtures
from zeta_interp import hidden_switch_compiled_static_replay as r


@pytest.fixture(scope="module")
def context() -> bindings.BindingContext:
    # Explicit synthetic caller context; this test does not admit source/runtime.
    return bindings.BindingContext(a.PROTOCOL_SHA256, "1" * 40, "2" * 64, "3" * 64)


def encoded(value: object) -> bytes:
    result = encoding.encode_public_result(value, maximum_bytes=r.MAX_RESULT_BYTES)
    assert isinstance(result, a.Admitted), result
    return result.value


def produce(context: bindings.BindingContext) -> tuple[r.RecordedCase, ...]:
    """Owned Python-produced fixtures, distinct from their subsequent replay."""
    result = []
    specs = {row.CaseId: row for row in c.case_specs()}
    for case_id in fixtures.STATIC_CASE_IDS:
        prepared = fixtures.prepare_static_case(case_id, context=context)
        assert isinstance(prepared, a.Admitted)
        row = prepared.value
        calls = []
        for index, spec in enumerate(specs[case_id].Calls):
            actual = fixtures.execute_static_call(
                case_id, index, row.Inputs, row.SupportingArtifacts
            )
            calls.append(
                r.RecordedCall(spec.Operation, spec.InputRoles, encoded(actual))
            )
        result.append(
            r.RecordedCase(case_id, row.Inputs, row.SupportingArtifacts, tuple(calls))
        )
    return tuple(result)


@pytest.fixture(scope="module")
def rows(context: bindings.BindingContext) -> tuple[r.RecordedCase, ...]:
    return produce(context)


def change_call(
    rows: tuple[r.RecordedCase, ...],
    case_id: str,
    index: int,
    change: Callable[[r.RecordedCall], r.RecordedCall],
) -> tuple[r.RecordedCase, ...]:
    changed = list(rows)
    position = next(i for i, row in enumerate(rows) if row.CaseId == case_id)
    calls = list(changed[position].Calls)
    calls[index] = change(calls[index])
    changed[position] = dataclasses.replace(changed[position], Calls=tuple(calls))
    return tuple(changed)


def test_all_actual_calls_and_preparations_are_fresh_and_complete(
    rows: tuple[r.RecordedCase, ...],
    context: bindings.BindingContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    prepared: list[str] = []
    executed: list[tuple[str, int, object]] = []
    preparation = fixtures.prepare_static_case
    execution = fixtures.execute_static_call

    def prepare(case_id: object, *, context: object) -> object:
        assert type(case_id) is str
        prepared.append(case_id)
        return preparation(case_id, context=context)

    def execute(
        case_id: object,
        index: object,
        inputs: tuple[c.NamedInput, ...],
        support: tuple[fixtures.SupportingArtifact, ...],
    ) -> object:
        assert type(case_id) is str and type(index) is int
        value = execution(case_id, index, inputs, support)
        executed.append((case_id, index, value))
        return value

    monkeypatch.setattr(fixtures, "prepare_static_case", prepare)
    monkeypatch.setattr(fixtures, "execute_static_call", execute)
    result = r.replay_static_cases(rows, context=context)
    assert isinstance(result, r.StaticReplaySucceeded), result
    assert result.Counts == r.Counts(32, 36, 36, 36, 32)
    assert prepared == list(fixtures.STATIC_CASE_IDS)
    assert [(row.CaseId, row.CallIndex) for row in result.Calls] == [
        (case, index) for case, index, _ in executed
    ]
    for recorded, (_, _, actual) in zip(result.Calls, executed, strict=True):
        assert recorded.Actual is not None and recorded.Actual.Result is actual
        assert recorded.Matched and recorded.RecordedParsing is not None
    assert result.Records is rows
    assert result.OuterSourceAndRuntimeAdmission == "not-performed"


def test_result_json_whitespace_preserves_original_bytes_and_hashes(
    rows: tuple[r.RecordedCase, ...], context: bindings.BindingContext
) -> None:
    variants = tuple(
        dataclasses.replace(
            row,
            Calls=tuple(
                dataclasses.replace(call, ResultRaw=b" \n" + call.ResultRaw + b"\t ")
                for call in row.Calls
            ),
        )
        for row in rows
    )
    result = r.replay_static_cases(variants, context=context)
    assert isinstance(result, r.StaticReplaySucceeded)
    for capture in result.Calls:
        assert isinstance(capture.Recorded, r.RecordedCall)
        raw = capture.Recorded.ResultRaw
        assert raw.startswith(b" \n") and capture.RawIdentity == r.ByteIdentity(
            len(raw), hashlib.sha256(raw).hexdigest().upper()
        )


@pytest.mark.parametrize("replacement", [False, 0.0])
def test_same_value_bool_or_float_cannot_replace_integer_zero(
    rows: tuple[r.RecordedCase, ...],
    context: bindings.BindingContext,
    replacement: object,
) -> None:
    def mutate(call: r.RecordedCall) -> r.RecordedCall:
        tree = json.loads(call.ResultRaw)
        tree["Fields"]["value"]["Fields"]["Count"] = replacement
        return dataclasses.replace(call, ResultRaw=encoded(tree))

    result = r.replay_static_cases(
        change_call(rows, "json/control", 0, mutate), context=context
    )
    assert isinstance(result, r.StaticReplayFailed)
    assert result.Failure.code == "static-result-mismatch"
    assert result.Counts == r.Counts(1, 1, 1, 0, 0)
    assert result.Calls[0].Actual is not None


def test_integer_one_and_float_one_are_distinct_in_late_result(
    rows: tuple[r.RecordedCase, ...], context: bindings.BindingContext
) -> None:
    def mutate(call: r.RecordedCall) -> r.RecordedCall:
        tree = json.loads(call.ResultRaw)
        assert tree["Fields"]["value"]["WallNs"] == 1
        tree["Fields"]["value"]["WallNs"] = 1.0
        return dataclasses.replace(call, ResultRaw=encoded(tree))

    result = r.replay_static_cases(
        change_call(rows, "resources/control", 0, mutate), context=context
    )
    assert isinstance(result, r.StaticReplayFailed)
    assert result.Counts == r.Counts(27, 28, 28, 27, 26)
    assert result.Calls[-1].Actual is not None


def test_signed_zero_and_lexical_negative_zero_are_preserved(
    rows: tuple[r.RecordedCase, ...],
    context: bindings.BindingContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = fixtures.execute_static_call
    actual = a.Admitted(-0.0)

    def execute(
        case_id: object,
        index: object,
        inputs: tuple[c.NamedInput, ...],
        support: tuple[fixtures.SupportingArtifact, ...],
    ) -> object:
        return (
            actual
            if case_id == "json/control"
            else original(case_id, index, inputs, support)
        )

    monkeypatch.setattr(fixtures, "execute_static_call", execute)
    negative = encoded(actual).replace(b"-0.0", b"-0")
    admitted = change_call(
        rows,
        "json/control",
        0,
        lambda call: dataclasses.replace(call, ResultRaw=negative),
    )
    assert isinstance(
        r.replay_static_cases(admitted, context=context), r.StaticReplaySucceeded
    )
    positive = change_call(
        rows,
        "json/control",
        0,
        lambda call: dataclasses.replace(call, ResultRaw=encoded(a.Admitted(0.0))),
    )
    refused = r.replay_static_cases(positive, context=context)
    assert isinstance(refused, r.StaticReplayFailed)
    assert (
        refused.Calls[0].Actual is not None and refused.Calls[0].Actual.Result is actual
    )
    assert refused.Failure.code == "static-result-mismatch"


@pytest.mark.parametrize(
    "raw", [b'{"x":0,"x":0}', b'{"x":NaN}', b'{"x":Infinity}', b"{", b"\xff"]
)
def test_late_bad_json_keeps_the_actual_return_and_entire_prefix(
    rows: tuple[r.RecordedCase, ...], context: bindings.BindingContext, raw: bytes
) -> None:
    changed = change_call(
        rows,
        "resources/half-threshold",
        1,
        lambda call: dataclasses.replace(call, ResultRaw=raw),
    )
    result = r.replay_static_cases(changed, context=context)
    assert isinstance(result, r.StaticReplayFailed)
    assert result.Failure.code == "static-recorded-json"
    assert result.Counts == r.Counts(32, 36, 36, 35, 31)
    last = result.Calls[-1]
    assert last.Actual is not None and last.Actual.Result == a.Admitted(
        {
            "Numerator": 9007199254740993,
            "Denominator": 18014398509481984,
            "AtMostHalf": False,
        }
    )
    assert last.Recorded is changed[-1].Calls[1]
    assert last.RecordedParsing is not None and isinstance(
        last.RecordedParsing.Returned, a.Refused
    )
    assert last.RawIdentity == r.ByteIdentity(
        len(raw), hashlib.sha256(raw).hexdigest().upper()
    )


@pytest.mark.parametrize(
    "kind,counts,code",
    [
        ("missing-case", r.Counts(31, 34, 34, 34, 31), "static-missing-case"),
        ("extra-case", r.Counts(32, 36, 36, 36, 32), "static-extra-case"),
        ("missing-call", r.Counts(32, 35, 35, 35, 31), "static-missing-call"),
        ("extra-call", r.Counts(32, 36, 36, 36, 31), "static-extra-call"),
        ("duplicate-case", r.Counts(32, 34, 34, 34, 31), "static-case"),
    ],
)
def test_late_roster_faults_preserve_exact_replay_prefix(
    rows: tuple[r.RecordedCase, ...],
    context: bindings.BindingContext,
    kind: str,
    counts: r.Counts,
    code: str,
) -> None:
    changed = rows
    if kind == "missing-case":
        changed = rows[:-1]
    elif kind == "extra-case":
        changed = (*rows, rows[0])
    elif kind == "duplicate-case":
        changed = (*rows[:-1], rows[0])
    elif kind == "missing-call":
        changed = (*rows[:-1], dataclasses.replace(rows[-1], Calls=rows[-1].Calls[:-1]))
    elif kind == "extra-call":
        changed = (
            *rows[:-1],
            dataclasses.replace(rows[-1], Calls=(*rows[-1].Calls, rows[-1].Calls[0])),
        )
    result = r.replay_static_cases(changed, context=context)
    assert isinstance(result, r.StaticReplayFailed)
    assert result.Counts == counts and result.Failure.code == code
    assert len(result.Calls) == counts.StartedCalls


@pytest.mark.parametrize(
    "kind", ["input-whitespace", "input-order", "input-omitted", "input-duplicate"]
)
def test_exact_source_fixed_inputs_cannot_be_redefined(
    rows: tuple[r.RecordedCase, ...], context: bindings.BindingContext, kind: str
) -> None:
    index = 0 if kind == "input-whitespace" else 8
    selected = rows[index]
    inputs = list(selected.Inputs)
    if kind == "input-whitespace":
        inputs[0] = c.NamedInput(inputs[0].Role, b" " + inputs[0].Raw)
    elif kind == "input-order":
        inputs[0], inputs[1] = inputs[1], inputs[0]
    elif kind == "input-omitted":
        inputs.pop()
    else:
        inputs.append(inputs[0])
    changed = list(rows)
    changed[index] = dataclasses.replace(selected, Inputs=tuple(inputs))
    result = r.replay_static_cases(tuple(changed), context=context)
    assert (
        isinstance(result, r.StaticReplayFailed)
        and result.Failure.code == "static-inputs"
    )
    assert result.Counts.ReturnedCalls == (0 if index == 0 else 8)


@pytest.mark.parametrize(
    "kind", ["reordered", "omitted", "duplicate", "file", "stored", "original"]
)
def test_support_artifacts_are_complete_ordered_and_independently_fixed(
    rows: tuple[r.RecordedCase, ...], context: bindings.BindingContext, kind: str
) -> None:
    index = next(i for i, row in enumerate(rows) if row.CaseId == "links/control")
    support = list(rows[index].SupportingArtifacts)
    if kind == "reordered":
        support[0], support[1] = support[1], support[0]
    elif kind == "omitted":
        support.pop()
    elif kind == "duplicate":
        support.append(support[0])
    elif kind == "file":
        support[0] = dataclasses.replace(support[0], File="elsewhere.json")
    elif kind == "stored":
        support[0] = dataclasses.replace(support[0], Stored=b" " + support[0].Stored)
    else:
        support[0] = dataclasses.replace(
            support[0], Original=b" " + support[0].Original
        )
    changed = list(rows)
    changed[index] = dataclasses.replace(
        rows[index], SupportingArtifacts=tuple(support)
    )
    result = r.replay_static_cases(tuple(changed), context=context)
    assert (
        isinstance(result, r.StaticReplayFailed)
        and result.Failure.code == "static-support"
    )
    assert result.Counts == r.Counts(14, 14, 14, 14, 13)


def test_self_consistent_producer_context_does_not_define_replay_expectation(
    rows: tuple[r.RecordedCase, ...], context: bindings.BindingContext
) -> None:
    producer_context = dataclasses.replace(context, NumericCertificateSha256="4" * 64)
    other = produce(producer_context)
    assert isinstance(
        r.replay_static_cases(other, context=producer_context), r.StaticReplaySucceeded
    )
    result = r.replay_static_cases(other, context=context)
    assert isinstance(result, r.StaticReplayFailed)
    assert result.Failure.code == "static-inputs" and result.Counts.ReturnedCalls == 14


def test_actual_return_is_retained_before_actual_encoder_failure(
    rows: tuple[r.RecordedCase, ...],
    context: bindings.BindingContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    execute = fixtures.execute_static_call
    encode = encoding.encode_public_result
    marker: list[object] = []
    refusal = a.Refused("injected-encoder", "Actual", "after actual return")

    def call(
        case_id: object,
        index: object,
        inputs: tuple[c.NamedInput, ...],
        support: tuple[fixtures.SupportingArtifact, ...],
    ) -> object:
        result = execute(case_id, index, inputs, support)
        if case_id == "resources/half-threshold" and index == 1:
            marker.append(result)
        return result

    def transform(value: object, *, maximum_bytes: object) -> object:
        return (
            refusal
            if marker and value is marker[0]
            else encode(value, maximum_bytes=maximum_bytes)
        )

    monkeypatch.setattr(fixtures, "execute_static_call", call)
    monkeypatch.setattr(encoding, "encode_public_result", transform)
    result = r.replay_static_cases(rows, context=context)
    assert isinstance(result, r.StaticReplayFailed)
    assert result.Counts == r.Counts(32, 36, 36, 35, 31)
    last = result.Calls[-1]
    assert last.Actual is not None and last.Actual.Result is marker[0]
    assert last.ActualEncoding is not None and last.ActualEncoding.Returned is refusal
    assert last.RecordedParsing is None and last.RawIdentity is not None


def test_producer_tree_encoder_failure_retains_both_earlier_outcomes(
    rows: tuple[r.RecordedCase, ...],
    context: bindings.BindingContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = encoding.encode_public_result
    refusal = a.Refused("injected-tree-encoder", "Tree", "preserved")

    def transform(value: object, *, maximum_bytes: object) -> object:
        return (
            refusal
            if type(value) is dict
            else original(value, maximum_bytes=maximum_bytes)
        )

    monkeypatch.setattr(encoding, "encode_public_result", transform)
    result = r.replay_static_cases(rows, context=context)
    assert (
        isinstance(result, r.StaticReplayFailed)
        and result.Failure.code == "static-recorded-encoding"
    )
    capture = result.Calls[0]
    assert capture.Actual is not None and capture.ActualEncoding is not None
    assert capture.RecordedParsing is not None and isinstance(
        capture.RecordedParsing.Returned, a.Admitted
    )
    assert (
        capture.RecordedEncoding is not None
        and capture.RecordedEncoding.Returned is refusal
    )


@pytest.mark.parametrize(
    "change",
    [
        "wrong-refusal",
        "unexpected-success",
        "extra-field",
        "missing-field",
        "type-label",
    ],
)
def test_complete_public_result_is_compared_without_type_instantiation(
    rows: tuple[r.RecordedCase, ...], context: bindings.BindingContext, change: str
) -> None:
    def mutate(call: r.RecordedCall) -> r.RecordedCall:
        tree = json.loads(call.ResultRaw)
        if change == "wrong-refusal":
            tree["Fields"]["code"] = "another-refusal"
        elif change == "unexpected-success":
            return dataclasses.replace(call, ResultRaw=rows[0].Calls[0].ResultRaw)
        elif change == "extra-field":
            tree["Fields"]["Unexpected"] = 0
        elif change == "missing-field":
            del tree["Fields"]["detail"]
        else:
            tree["Type"] = "os.system"
        return dataclasses.replace(call, ResultRaw=encoded(tree))

    result = r.replay_static_cases(
        change_call(rows, "json/duplicate-key", 0, mutate), context=context
    )
    assert (
        isinstance(result, r.StaticReplayFailed)
        and result.Failure.code == "static-result-mismatch"
    )
    assert result.Counts == r.Counts(2, 2, 2, 1, 1)
    assert result.Calls[-1].Actual is not None and isinstance(
        result.Calls[-1].Actual.Result, a.Refused
    )


def test_producer_operation_never_selects_dispatch_and_real_return_is_retained(
    rows: tuple[r.RecordedCase, ...], context: bindings.BindingContext
) -> None:
    changed = change_call(
        rows,
        "json/control",
        0,
        lambda call: dataclasses.replace(call, Operation="__import__"),
    )
    result = r.replay_static_cases(changed, context=context)
    assert (
        isinstance(result, r.StaticReplayFailed)
        and result.Failure.code == "static-operation"
    )
    assert result.Counts == r.Counts(1, 1, 1, 0, 0)
    assert (
        result.Calls[0].Actual is not None
        and result.Calls[0].Actual.Operation == "json-fixture-pipeline"
    )


@pytest.mark.parametrize("raw", [b"x" * (r.MAX_RESULT_BYTES + 1), "{}", False])
def test_result_byte_admission_preserves_current_actual_return(
    rows: tuple[r.RecordedCase, ...], context: bindings.BindingContext, raw: object
) -> None:
    changed = change_call(
        rows,
        "json/control",
        0,
        lambda call: dataclasses.replace(call, ResultRaw=cast(bytes, raw)),
    )
    result = r.replay_static_cases(changed, context=context)
    assert (
        isinstance(result, r.StaticReplayFailed)
        and result.Failure.code == "static-result-bytes"
    )
    assert result.Calls[0].Actual is not None and result.Calls[0].RawIdentity is None
    assert result.Calls[0].Recorded is changed[0].Calls[0]


def test_failed_preparation_retains_earlier_calls_and_actual_helper_refusal(
    rows: tuple[r.RecordedCase, ...],
    context: bindings.BindingContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = fixtures.prepare_static_case
    refusal = a.Refused("injected-preparation", "Last", "actual returned failure")

    def prepare(case_id: object, *, context: object) -> object:
        return (
            refusal
            if case_id == "resources/half-threshold"
            else original(case_id, context=context)
        )

    monkeypatch.setattr(fixtures, "prepare_static_case", prepare)
    result = r.replay_static_cases(rows, context=context)
    assert isinstance(result, r.StaticReplayFailed)
    assert result.Counts == r.Counts(31, 34, 34, 34, 31)
    assert result.Preparations[-1].Observation.Returned is refusal


def test_raised_call_does_not_invent_a_return(
    rows: tuple[r.RecordedCase, ...],
    context: bindings.BindingContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = fixtures.execute_static_call

    def execute(
        case_id: object,
        index: object,
        inputs: tuple[c.NamedInput, ...],
        support: tuple[fixtures.SupportingArtifact, ...],
    ) -> object:
        if case_id == "resources/half-threshold" and index == 1:
            raise RuntimeError("injected before return")
        return original(case_id, index, inputs, support)

    monkeypatch.setattr(fixtures, "execute_static_call", execute)
    result = r.replay_static_cases(rows, context=context)
    assert isinstance(result, r.StaticReplayFailed)
    assert result.Counts == r.Counts(32, 36, 35, 35, 31)
    assert result.Calls[-1].Actual is None and result.Calls[-1].Raised == r.Raised(
        "builtins.RuntimeError", "injected before return"
    )


@pytest.mark.parametrize(
    "bad",
    [
        None,
        False,
        bindings.BindingContext(a.PROTOCOL_SHA256, "X" * 40, "2" * 64, "3" * 64),
    ],
)
def test_independent_context_is_required_before_case_calls(
    rows: tuple[r.RecordedCase, ...], bad: object
) -> None:
    result = r.replay_static_cases(rows, context=bad)
    assert isinstance(result, r.StaticReplayFailed) and result.Counts == r.Counts(
        0, 0, 0, 0, 0
    )


def test_no_policy_or_source_generation_is_called(
    rows: tuple[r.RecordedCase, ...],
    context: bindings.BindingContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for name in (
        "source_tapes",
        "run_episode",
        "evaluate_bits",
        "native_choice",
        "compiled_choice",
    ):
        monkeypatch.setattr(
            reference,
            name,
            lambda *args, **kwargs: pytest.fail("policy/source entrypoint was called"),
        )
    assert isinstance(
        r.replay_static_cases(rows, context=context), r.StaticReplaySucceeded
    )


@pytest.mark.parametrize(
    "roles", [(), ("original", "stored-identity", "descriptor-identity")]
)
def test_call_roles_are_not_producer_selected(
    rows: tuple[r.RecordedCase, ...],
    context: bindings.BindingContext,
    roles: tuple[str, ...],
) -> None:
    selected = next(row for row in rows if row.CaseId == "artifact/control")
    assert roles != selected.Calls[0].InputRoles
    changed = change_call(
        rows,
        "artifact/control",
        0,
        lambda call: dataclasses.replace(call, InputRoles=roles),
    )
    result = r.replay_static_cases(changed, context=context)
    assert (
        isinstance(result, r.StaticReplayFailed)
        and result.Failure.code == "static-operation"
    )
    assert result.Counts == r.Counts(9, 9, 9, 8, 8)
    assert result.Calls[-1].Actual is not None
    assert result.Calls[-1].Actual.InputRoles == selected.Calls[0].InputRoles


def test_complete_byteshex_value_is_compared_without_decoding_a_type_label(
    rows: tuple[r.RecordedCase, ...],
    context: bindings.BindingContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # An injected returned value exercises the generic result encoding boundary;
    # the source-fixed control ordinarily returns JsonFixture, not these bytes.
    original = fixtures.execute_static_call
    actual = a.Admitted(b"ABC")

    def execute(
        case_id: object,
        index: object,
        inputs: tuple[c.NamedInput, ...],
        support: tuple[fixtures.SupportingArtifact, ...],
    ) -> object:
        return (
            actual
            if case_id == "json/control"
            else original(case_id, index, inputs, support)
        )

    monkeypatch.setattr(fixtures, "execute_static_call", execute)
    canonical = encoded(actual)
    correct = change_call(
        rows,
        "json/control",
        0,
        lambda call: dataclasses.replace(call, ResultRaw=canonical),
    )
    assert isinstance(
        r.replay_static_cases(correct, context=context), r.StaticReplaySucceeded
    )
    tree = json.loads(canonical)
    assert tree["Fields"]["value"] == {"BytesHex": "414243"}
    tree["Fields"]["value"]["BytesHex"] = "414244"
    changed = change_call(
        rows,
        "json/control",
        0,
        lambda call: dataclasses.replace(call, ResultRaw=encoded(tree)),
    )
    result = r.replay_static_cases(changed, context=context)
    assert (
        isinstance(result, r.StaticReplayFailed)
        and result.Failure.code == "static-result-mismatch"
    )
    assert (
        result.Calls[0].Actual is not None and result.Calls[0].Actual.Result is actual
    )
