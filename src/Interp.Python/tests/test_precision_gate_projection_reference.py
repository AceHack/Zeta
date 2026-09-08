"""Independent source fixtures; no native results or final roster execution."""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from fractions import Fraction
from typing import Any

import pytest

from zeta_interp import precision_gate_projection_intervals as iv
from zeta_interp import precision_gate_projection_reference as ref

BINDINGS = {
    "ProtocolSha256": ref.PROTOCOL_SHA256,
    "src/independent-fixture.py": "A" * 64,
}


def raw_input(
    t: str = "1",
    u: str = "0",
    k: str = "0.75",
    c: str = "1",
    *,
    profile: str = "default",
) -> bytes:
    return json.dumps(
        {
            "Schema": "zeta.precision-projection.input.v1",
            "Id": "unit/independent",
            "Parameters": dict(zip(("T", "U", "K", "C"), (t, u, k, c), strict=True)),
            "Profile": profile,
        },
        separators=(",", ":"),
    ).encode()


def call(raw: bytes, bindings: object = BINDINGS) -> ref.ReceiptResult:
    return ref.reference_root(
        raw,
        bindings,
        expected_input_sha256=hashlib.sha256(raw).hexdigest().upper(),
        expected_case_id="unit/independent",
    )


def receipt(result: ref.ReceiptResult) -> dict[str, Any]:
    assert type(result) is ref.Success
    return result.Value


def bounds(value: dict[str, str]) -> tuple[Fraction, Fraction]:
    return Fraction(Decimal(value["Lower"])), Fraction(Decimal(value["Upper"]))


@pytest.mark.parametrize(
    ("t", "u", "k", "c", "m", "v"),
    [
        ("1", "0", "0.75", "1", Fraction(-1, 4), Fraction(1, 2)),
        ("2", "-1", "3.75", "2", Fraction(-1, 8), Fraction(1, 4)),
        ("0.125", "0", "-0.125", "0.125", Fraction(-2), Fraction(4)),
    ],
)
def test_exact_centers_and_rigorous_width(
    t: str, u: str, k: str, c: str, m: Fraction, v: Fraction
) -> None:
    assert Fraction(k) == Fraction(t) * (m - Fraction(u)) + Fraction(c)
    actual = receipt(call(raw_input(t, u, k, c)))
    assert actual["Outcome"]["Kind"] == "enclosure", actual["Outcome"]
    for name, expected in (("Mean", m), ("Variance", v), ("LogRatio", Fraction(0))):
        lower, upper = bounds(actual["Outcome"]["Value"][name])
        assert lower <= expected <= upper
        if name != "LogRatio":
            assert upper - lower <= Fraction(1, 10**50)
    assert actual["Counters"]["Starts"] == 1
    assert actual["Counters"]["ParameterPreparations"] == len(actual["Contexts"])
    assert (
        actual["Counters"]["BracketAdmissions"]
        == actual["Counters"]["MomentEvaluations"]
    )
    assert actual["Counters"]["TranscendentalEntries"] <= 4096
    assert [row["Sequence"] for row in actual["Trace"]] == list(
        range(1, len(actual["Trace"]) + 1)
    )


def test_unconstructed_target_budget_retains_actual_bracket() -> None:
    actual = receipt(call(raw_input(k="0", profile="reference-one")))
    assert actual["Outcome"]["Kind"] == "refused"
    assert actual["Outcome"]["Failure"]["Code"] == "IterationLimit"
    assert actual["Counters"]["MidpointAttempts"] == 1
    assert actual["Counters"]["MidpointEvaluations"] == 1
    assert actual["Counters"]["BracketAdmissions"] == 2
    assert actual["Outcome"]["Partial"]["Mean"] is not None
    assert any(
        row["Stage"] == "midpoint" and row["Phi"] is not None for row in actual["Trace"]
    )


def test_default_noncenter_encloses_stationarity_without_zero_shortcut() -> None:
    actual = receipt(call(raw_input(k="0")))
    assert actual["Outcome"]["Kind"] == "enclosure"
    lower, upper = bounds(actual["Outcome"]["Value"]["LogRatio"])
    assert Fraction(-1) < lower < upper < 0
    # Independent 320-digit interval evaluation of the stationary mean identity.
    arithmetic = iv.make_arithmetic(320)
    assert type(arithmetic) is iv.Success
    enclosure = actual["Outcome"]["Value"]["LogRatio"]
    ex = arithmetic.Value.exp(
        iv.Interval(Decimal(enclosure["Lower"]), Decimal(enclosure["Upper"]))
    )
    assert type(ex) is iv.Success
    mlo, mhi = bounds(actual["Outcome"]["Value"]["Mean"])
    assert mlo <= -Fraction(ex.Value.Upper) <= mhi
    assert mlo <= -Fraction(ex.Value.Lower) <= mhi
    assert actual["Counters"]["MidpointAttempts"] > 1


@pytest.mark.parametrize(
    "literal",
    [
        "+1",
        "01",
        "1.",
        ".1",
        "1E0",
        " 1",
        "1\n",
        "1e401",
        "1e-401",
        "1e" + "9" * 120,
        "１",
        "NaN",
        "Infinity",
    ],
)
def test_fixed_decimal_grammar_refuses_before_numeric_entry(literal: str) -> None:
    actual = receipt(call(raw_input(u=literal)))
    assert actual["Outcome"]["Kind"] == "refused"
    assert actual["Outcome"]["Failure"]["Code"] == "Wire"
    assert actual["Counters"]["Starts"] == 0
    assert actual["Target"] is None
    assert actual["Contexts"] == []


@pytest.mark.parametrize("literal", ["0e+400", "-0e-400", "1e+0", "1e0001"])
def test_admitted_exponent_syntax(literal: str) -> None:
    actual = receipt(call(raw_input(u=literal, profile="reference-one")))
    assert actual["Counters"]["Starts"] == 1
    assert actual["Target"]["RequestedParameters"]["U"] == literal


@pytest.mark.parametrize("coefficient", ["T", "C"])
def test_rendered_zero_domain_retains_requested_delta(coefficient: str) -> None:
    parsed = json.loads(raw_input())
    parsed["Parameters"][coefficient] = "1e-400"
    actual = receipt(call(json.dumps(parsed).encode()))
    assert actual["Outcome"]["Failure"]["Code"] == "Domain"
    assert actual["Counters"]["Starts"] == 1
    assert actual["Counters"]["ParameterPreparations"] == 0
    assert actual["Target"]["TargetBits"][coefficient] == "0000000000000000"
    assert actual["Target"]["ConversionDelta"][coefficient] == {
        "Num": "-1",
        "Den": "1" + "0" * 400,
    }


@pytest.mark.parametrize("literal", ["-0", "-1e-400", "1e-400"])
def test_signed_rendered_u_zero_remains_valid(literal: str) -> None:
    actual = receipt(call(raw_input(u=literal)))
    assert actual["Outcome"]["Kind"] == "enclosure"
    assert actual["Target"]["TargetBits"]["U"] == (
        "8000000000000000" if literal.startswith("-") else "0000000000000000"
    )
    assert actual["Target"]["DyadicTarget"]["U"] == {"Num": "0", "Den": "1"}


def test_overflow_never_manufactures_finite_target() -> None:
    actual = receipt(call(raw_input(u="1e400")))
    assert actual["Outcome"]["Failure"]["Code"] == "NumericalRange"
    assert actual["Target"] is None
    assert actual["Counters"]["Starts"] == 0


@pytest.mark.parametrize(
    "raw", [b'{"Schema":0,"Schema":1}', b'{"Schema":NaN}', b"\xff", b"[]", b"{}"]
)
def test_strict_raw_refusal(raw: bytes) -> None:
    actual = receipt(call(raw))
    assert actual["Outcome"]["Failure"]["Code"] == "Wire"
    assert actual["Counters"]["Starts"] == 0


def test_boolean_parameter_and_unknown_key_refuse() -> None:
    parsed = json.loads(raw_input())
    parsed["Parameters"]["T"] = True
    assert (
        receipt(call(json.dumps(parsed).encode()))["Outcome"]["Failure"]["Code"]
        == "Wire"
    )
    parsed["Parameters"]["T"] = "1"
    parsed["Unknown"] = 0
    assert (
        receipt(call(json.dumps(parsed).encode()))["Outcome"]["Failure"]["Code"]
        == "Wire"
    )


@pytest.mark.parametrize(
    "bindings",
    [
        {},
        {"ProtocolSha256": "0" * 64},
        {"ProtocolSha256": ref.PROTOCOL_SHA256, "../escape": "A" * 64},
        {"ProtocolSha256": ref.PROTOCOL_SHA256, "x": True},
    ],
)
def test_independent_caller_metadata_failure_is_not_receipt(bindings: object) -> None:
    actual = call(raw_input(), bindings)
    assert type(actual) is ref.Failure
    assert actual.Code == "SourceMismatch"


def test_wrong_independent_input_hash_never_enters_solver(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def forbidden(*args: object) -> None:
        pytest.fail("solver entered before independent hash admission")

    monkeypatch.setattr(ref._Root, "solve", forbidden)
    result = ref.reference_root(
        raw_input(),
        BINDINGS,
        expected_input_sha256="0" * 64,
        expected_case_id="unit/independent",
    )
    assert type(result) is ref.Failure
    assert result.Code == "TargetMismatch"


def test_returned_receipt_survives_encoding_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw = raw_input()

    def broken(*args: object, **kwargs: object) -> object:
        raise OSError("owned injected encoder refusal")

    monkeypatch.setattr(json.JSONEncoder, "iterencode", broken)
    actual = call(raw)
    assert type(actual) is ref.ReceiptFailure
    assert actual.Failure.Stage == "encoding"
    assert actual.Receipt["Outcome"]["Kind"] == "enclosure"
    assert actual.Receipt["Counters"]["MomentEvaluations"] > 0


def test_complete_receipt_size_refusal_retains_numeric_return(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ref, "RESULT_LIMIT", 256)
    actual = call(raw_input())
    assert type(actual) is ref.ReceiptFailure
    assert actual.Failure.Code == "ResultTooLarge"
    assert actual.Receipt["Outcome"]["Kind"] == "enclosure"


def test_actual_midpoint_fault_keeps_prior_proved_moments(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    real = ref._Root.phi

    def fail_after_endpoints(self: ref._Root, point: Decimal) -> iv.Interval:
        if self.stage == "midpoint":
            raise OSError("owned injected numeric failure")
        return real(self, point)

    monkeypatch.setattr(ref._Root, "phi", fail_after_endpoints)
    actual = receipt(call(raw_input(k="0")))
    assert actual["Outcome"]["Failure"]["Code"] == "Unexpected"
    assert actual["Counters"]["MidpointEvaluations"] == 1
    assert actual["Outcome"]["Partial"]["Mean"] is not None
    assert actual["Trace"][-2]["Stage"] == "midpoint"
    assert actual["Trace"][-2]["Failure"]["Code"] == "Unexpected"


def test_precision_retry_preserves_entry_counters(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = iv.Arithmetic.midpoint
    seen = 0

    def once(self: iv.Arithmetic, value: object) -> iv.Result[Decimal]:
        nonlocal seen
        seen += 1
        if seen == 1:
            return iv.Failure(
                "ResolutionLimit", "parameters", "Midpoint", "owned stagnation fixture"
            )
        return original(self, value)

    monkeypatch.setattr(iv.Arithmetic, "midpoint", once)
    actual = receipt(call(raw_input(k="0")))
    assert actual["Outcome"]["Kind"] == "enclosure"
    assert [context["Precision"] for context in actual["Contexts"]] == [80, 160]
    assert actual["Counters"]["PrecisionEscalations"] == 1
    assert actual["Counters"]["EndpointEvaluations"] == 4
    assert (
        actual["Counters"]["MidpointEvaluations"]
        == actual["Counters"]["MidpointAttempts"]
    )
    retries = [row for row in actual["Trace"] if row["Recoverable"]]
    assert len(retries) == 1
    assert retries[0]["Failure"]["Code"] == "ResolutionLimit"
    assert (
        actual["Counters"]["TranscendentalEntries"]
        > actual["Counters"]["MidpointEvaluations"]
    )


def test_all_precision_stagnations_refuse_with_prior_prefix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def blocked(self: iv.Arithmetic, value: object) -> iv.Result[Decimal]:
        return iv.Failure(
            "ResolutionLimit", "parameters", "Midpoint", "owned fixed stagnation"
        )

    monkeypatch.setattr(iv.Arithmetic, "midpoint", blocked)
    actual = receipt(call(raw_input(k="0")))
    assert actual["Outcome"]["Kind"] == "refused"
    assert actual["Outcome"]["Failure"]["Code"] == "ResolutionLimit"
    assert [context["Precision"] for context in actual["Contexts"]] == [80, 160, 320]
    assert actual["Counters"]["PrecisionEscalations"] == 2
    assert actual["Counters"]["MidpointAttempts"] == 1
    assert actual["Counters"]["MidpointEvaluations"] == 0
    assert actual["Counters"]["BracketAdmissions"] == 3
    assert actual["Outcome"]["Partial"]["LogRatio"] is not None


def test_empty_proof_intersection_cannot_replace_prior_bounds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = iv.intersect
    calls = 0

    def empty(left: object, right: object) -> iv.Result[iv.Interval]:
        nonlocal calls
        calls += 1
        if calls == 2:
            return iv.Failure(
                "EmptyIntersection",
                "parameters",
                "Intersection",
                "owned disjoint proof",
            )
        return original(left, right)

    monkeypatch.setattr(iv, "intersect", empty)
    actual = receipt(call(raw_input(k="0")))
    assert actual["Outcome"]["Failure"]["Code"] == "EmptyIntersection"
    assert actual["Counters"]["BracketAdmissions"] == 1
    assert actual["Counters"]["MidpointEvaluations"] == 1
    assert actual["Outcome"]["Partial"]["Mean"] is not None


def encode_bits(value: Fraction | int) -> str:
    from zeta_interp import hidden_switch_compiled_ieee as ieee

    rounded = ieee.round_fraction(Fraction(value))
    assert type(rounded) is ieee.Success
    encoded = ieee.format_bits(rounded.value)
    assert type(encoded) is ieee.Success
    return encoded.value


def synthetic_candidate(raw: bytes) -> dict[str, Any]:
    """Python-produced analytic center, never a native-run receipt fixture."""
    from decimal import Context

    context = Context(prec=100)
    # t=c=1,u=0,k=3/4,m=-1/4,v=1/2. F=47/32 + ln(2)/2.
    objective = Fraction(47, 32) + Fraction(context.ln(Decimal(2))) / 2
    stages = [
        "input",
        "parameters",
        "left-endpoint",
        "right-endpoint",
        "midpoint",
        "reconstruction",
        "objective",
    ]
    return {
        "Schema": "zeta.precision-projection.native.v1",
        "CaseId": "unit/independent",
        "InputSha256": hashlib.sha256(raw).hexdigest().upper(),
        "Bindings": dict(BINDINGS),
        "Outcome": {
            "Kind": "candidate",
            "Value": {
                "TargetBits": dict(
                    zip(
                        ("T", "U", "K", "C"),
                        map(
                            encode_bits,
                            (Fraction(1), Fraction(0), Fraction(3, 4), Fraction(1)),
                        ),
                        strict=True,
                    )
                ),
                "LogRatioBits": encode_bits(0),
                "RatioBits": encode_bits(1),
                "RBits": encode_bits(1),
                "MeanBits": encode_bits(Fraction(-1, 4)),
                "VarianceBits": encode_bits(Fraction(1, 2)),
                "Bracket": {"LowerBits": encode_bits(-1), "UpperBits": encode_bits(0)},
                "Stop": "rounded-zero",
                "OriginalObjective": {
                    "ValueBits": encode_bits(objective),
                    "DerivativeMeanBits": encode_bits(0),
                    "DerivativeVarianceBits": encode_bits(0),
                },
            },
        },
        "Counters": {
            "Starts": 1,
            "PhiEntries": 3,
            "MidpointAttempts": 1,
            "BracketUpdates": 0,
            "LogEntries": 3,
            "ExpEntries": 3,
            "ObjectiveEntries": 1,
        },
        "Trace": [
            {
                "Sequence": i,
                "Stage": stage,
                "Attempt": 1 if stage == "midpoint" else 0,
                "PointBits": encode_bits(-1 if stage == "left-endpoint" else 0)
                if stage in ("left-endpoint", "right-endpoint", "midpoint")
                else None,
                "PhiBits": encode_bits(-1 if stage == "left-endpoint" else 0)
                if stage in ("left-endpoint", "right-endpoint", "midpoint")
                else None,
                "LowerBits": encode_bits(-1) if stage != "input" else None,
                "UpperBits": encode_bits(0) if stage != "input" else None,
                "Failure": None,
            }
            for i, stage in enumerate(stages, 1)
        ],
    }


def certify(raw: bytes, candidate: dict[str, Any]) -> ref.ReceiptResult:
    return ref.certify_native(
        raw,
        json.dumps(candidate).encode(),
        BINDINGS,
        expected_input_sha256=hashlib.sha256(raw).hexdigest().upper(),
        expected_case_id="unit/independent",
    )


def test_synthetic_certificate_compares_all_seven_leaves() -> None:
    raw = raw_input()
    candidate = synthetic_candidate(raw)
    native_bytes = json.dumps(candidate).encode()
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"] == {
        "Kind": "certified",
        "TargetScope": "exact-native-dyadic",
        "NativeTrajectoryCertified": False,
        "GraphApplicationPerformed": False,
    }
    assert actual["NativeRaw"] == {
        "BytesHex": native_bytes.hex(),
        "Bytes": len(native_bytes),
        "Sha256": hashlib.sha256(native_bytes).hexdigest().upper(),
    }
    assert [row["Field"] for row in actual["LeafChecks"]] == [
        "MeanBits",
        "VarianceBits",
        "RatioBits",
        "RBits",
        "OriginalObjective.ValueBits",
        "OriginalObjective.DerivativeMeanBits",
        "OriginalObjective.DerivativeVarianceBits",
    ]
    assert actual["Counters"]["LeafChecks"] == 7
    assert actual["Counters"]["ReferenceRootCalls"] == 1
    assert (
        actual["Counters"]["CoordinateIntervalCalls"]
        == actual["Counters"]["ObjectiveIntervalCalls"]
        == 1
    )
    assert actual["Counters"]["CertificateTranscendentalEntries"] <= 6
    assert actual["Coordinates"]["Kind"] == actual["Objective"]["Kind"] == "returned"
    assert actual["CertificateContext"] == actual["Reference"]["Contexts"][-1]
    assert (
        actual["Coordinates"]["Context"]
        == actual["Objective"]["Context"]
        == actual["CertificateContext"]
    )
    json.dumps(actual, allow_nan=False)


@pytest.mark.parametrize(
    ("field", "replacement", "expected", "count"),
    [
        ("MeanBits", Fraction(1024), "NotCloseToMinimum", 1),
        ("VarianceBits", Fraction(4), "NotCloseToMinimum", 2),
        ("RatioBits", Fraction(2), "InconsistentCoordinate", 3),
        ("RBits", Fraction(2), "InconsistentCoordinate", 4),
        ("ValueBits", Fraction(10), "ObjectiveMismatch", 5),
        ("DerivativeMeanBits", Fraction(1), "ObjectiveMismatch", 6),
        ("DerivativeVarianceBits", Fraction(1), "ObjectiveMismatch", 7),
    ],
)
def test_each_numeric_leaf_refuses_and_preserves_complete_returns(
    field: str, replacement: Fraction, expected: str, count: int
) -> None:
    raw = raw_input()
    candidate = synthetic_candidate(raw)
    target = candidate["Outcome"]["Value"]
    if field in ("ValueBits", "DerivativeMeanBits", "DerivativeVarianceBits"):
        target = target["OriginalObjective"]
    target[field] = encode_bits(replacement)
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"]["Kind"] == "refused"
    assert actual["Outcome"]["Failure"]["Code"] == expected
    assert actual["Counters"]["LeafChecks"] == count
    assert actual["LeafChecks"][-1]["Passed"] is False
    assert actual["Reference"]["Outcome"]["Kind"] == "enclosure"
    assert actual["CertificateContext"] == actual["Reference"]["Contexts"][-1]
    if count >= 5:
        assert set(actual["Objective"]["Value"]) == {
            "Value",
            "DerivativeMean",
            "DerivativeVariance",
        }
    elif count >= 3:
        assert set(actual["Coordinates"]["Value"]) == {"Ratio", "R"}
        assert actual["Objective"] is None
    else:
        assert actual["Coordinates"] is None
        assert actual["Counters"]["CertificatePreparations"] == 0


@pytest.mark.parametrize("field", ["RatioBits", "RBits", "VarianceBits"])
@pytest.mark.parametrize(
    "bits", ["0000000000000000", "8000000000000000", "8000000000000001"]
)
def test_positive_family_not_admitted_by_absolute_tolerance(
    field: str, bits: str
) -> None:
    raw = raw_input()
    candidate = synthetic_candidate(raw)
    candidate["Outcome"]["Value"][field] = bits
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"]["Failure"]["Code"] == "CandidateShape"
    assert actual["Counters"]["ReferenceRootCalls"] == 0


def test_r_reference_uses_independent_exp_not_native_q() -> None:
    raw = raw_input()
    candidate = synthetic_candidate(raw)
    delta = Fraction(19, 10**13)
    candidate["Outcome"]["Value"]["RatioBits"] = encode_bits(1 + delta)
    candidate["Outcome"]["Value"]["RBits"] = encode_bits(1 - delta)
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"]["Kind"] == "certified"
    assert bounds(actual["Coordinates"]["Value"]["R"]) == (Fraction(1), Fraction(1))


@pytest.mark.parametrize(
    "mutation",
    [
        "binding",
        "target-sign",
        "extra",
        "counter-bool",
        "sequence-bool",
        "failure-bool",
        "objective-missing",
        "reversed-bracket",
        "outside-bracket",
        "nonfinite-bits",
    ],
)
def test_exact_native_shape_and_binding_mutations(mutation: str) -> None:
    raw = raw_input()
    candidate = synthetic_candidate(raw)
    value = candidate["Outcome"]["Value"]
    if mutation == "binding":
        candidate["Bindings"]["ProtocolSha256"] = "0" * 64
    elif mutation == "target-sign":
        value["TargetBits"]["U"] = "8000000000000000"
    elif mutation == "extra":
        value["Extra"] = 0
    elif mutation == "counter-bool":
        candidate["Counters"]["Starts"] = True
    elif mutation == "sequence-bool":
        candidate["Trace"][0]["Sequence"] = True
    elif mutation == "failure-bool":
        candidate["Trace"][0]["Failure"] = False
    elif mutation == "objective-missing":
        del value["OriginalObjective"]["DerivativeMeanBits"]
    elif mutation == "reversed-bracket":
        value["Bracket"] = {"LowerBits": encode_bits(1), "UpperBits": encode_bits(-1)}
    elif mutation == "outside-bracket":
        value["Bracket"] = {"LowerBits": encode_bits(-2), "UpperBits": encode_bits(-1)}
    else:
        value["MeanBits"] = "7FF0000000000000"
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"]["Kind"] == "refused"
    assert actual["Counters"]["ReferenceRootCalls"] == 0


def test_actual_independent_root_called_each_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = ref.reference_root
    calls = 0

    def observed(*args: object, **kwargs: object) -> ref.ReceiptResult:
        nonlocal calls
        calls += 1
        return original(*args, **kwargs)

    monkeypatch.setattr(ref, "reference_root", observed)
    raw = raw_input()
    assert (
        receipt(certify(raw, synthetic_candidate(raw)))["Outcome"]["Kind"]
        == "certified"
    )
    assert (
        receipt(certify(raw, synthetic_candidate(raw)))["Outcome"]["Kind"]
        == "certified"
    )
    assert calls == 2


def test_no_candidate_keeps_original_refusal_without_root_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw = raw_input()
    candidate = synthetic_candidate(raw)
    failure = {
        "Code": "ObjectiveRefusal",
        "Stage": "objective",
        "Field": "objective",
        "Message": "owned fixture",
        "OriginalKernelFailure": {
            "Kind": "NumericalFailure",
            "Field": "exponential",
            "Detail": "owned original detail",
        },
    }
    candidate["Outcome"] = {
        "Kind": "refused",
        "Failure": failure,
        "Partial": {
            "Target": None,
            "Parameters": None,
            "Bracket": None,
            "Candidate": None,
            "OriginalObjective": {
                "Kind": "refused",
                "Failure": failure["OriginalKernelFailure"],
            },
        },
    }

    candidate["Outcome"]["Partial"]["Target"] = ref._input(
        raw, "unit/independent"
    ).Snapshot
    candidate["Trace"][-1]["Failure"] = failure

    def forbidden(*args: object, **kwargs: object) -> ref.ReceiptResult:
        pytest.fail("no-candidate invoked root")

    monkeypatch.setattr(ref, "reference_root", forbidden)
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"] == {"Kind": "no-candidate", "NativeFailure": failure}
    assert actual["Reference"] is None
    candidate["Bindings"]["ProtocolSha256"] = "0" * 64
    assert (
        receipt(certify(raw, candidate))["Outcome"]["Failure"]["Code"]
        == "SourceMismatch"
    )


def test_reference_refusal_retained_not_certified(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    real = ref.reference_root

    def refusal(*args: object, **kwargs: object) -> ref.ReceiptResult:
        result = real(*args, **kwargs)
        assert isinstance(result, ref.Success)
        result.Value["Outcome"] = {
            "Kind": "refused",
            "Failure": {
                "Code": "IterationLimit",
                "Stage": "midpoint",
                "Field": None,
                "Message": "owned stub refusal",
                "OriginalKernelFailure": None,
            },
            "Partial": result.Value["Outcome"]["Value"],
        }
        return result

    monkeypatch.setattr(ref, "reference_root", refusal)
    raw = raw_input()
    actual = receipt(certify(raw, synthetic_candidate(raw)))
    assert actual["Outcome"]["Failure"]["Code"] == "NoRootEnclosure"
    assert actual["Reference"]["Outcome"]["Failure"]["Code"] == "IterationLimit"
    assert actual["Coordinates"] is None


def test_maximum_endpoint_distance_not_midpoint_or_overlap(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    real = ref._Post.objective

    def changed(
        self: ref._Post, target: dict[str, iv.Interval], m: iv.Interval, v: iv.Interval
    ) -> dict[str, iv.Interval]:
        result = real(self, target, m, v)
        result["DerivativeMean"] = iv.Interval(Decimal("-3e-12"), Decimal(0))
        return result

    monkeypatch.setattr(ref._Post, "objective", changed)
    raw = raw_input()
    actual = receipt(certify(raw, synthetic_candidate(raw)))
    assert actual["Outcome"]["Failure"]["Code"] == "ObjectiveMismatch"
    assert actual["Counters"]["LeafChecks"] == 6
    assert actual["Objective"]["Value"]["DerivativeVariance"] is not None


@pytest.mark.parametrize("raised", [False, True])
def test_objective_partial_return_before_late_failure_is_retained(
    monkeypatch: pytest.MonkeyPatch, raised: bool
) -> None:
    original = ref._Post.div
    calls = 0

    def failed(self: ref._Post, x: iv.Interval, y: iv.Interval) -> iv.Interval:
        nonlocal calls
        if self.stage == "objective":
            calls += 1
            if calls == 6:
                if raised:
                    raise OSError("owned late derivative failure")
                return self.take(
                    iv.Failure(
                        "NumericalRange",
                        "parameters",
                        "last division",
                        "owned returned refusal",
                    )
                )
        return original(self, x, y)

    monkeypatch.setattr(ref._Post, "div", failed)
    raw = raw_input()
    actual = receipt(certify(raw, synthetic_candidate(raw)))
    assert actual["Outcome"]["Kind"] == "refused"
    assert actual["Objective"]["Kind"] == ("raised" if raised else "refused")
    assert actual["Objective"]["Partial"]["Value"] is not None
    assert actual["Objective"]["Partial"]["DerivativeMean"] is not None
    assert actual["Objective"]["Partial"]["DerivativeVariance"] is None
    assert actual["Counters"]["ObjectiveIntervalCalls"] == 1
    assert actual["Counters"]["LeafChecks"] == 4


def test_coordinate_partial_survives_returned_arithmetic_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def broken(self: ref._Post, x: iv.Interval, y: iv.Interval) -> iv.Interval:
        return self.take(
            iv.Failure(
                "NumericalRange",
                "parameters",
                "product",
                "owned coordinate product refusal",
            )
        )

    monkeypatch.setattr(ref._Post, "mul", broken)
    raw = raw_input()
    actual = receipt(certify(raw, synthetic_candidate(raw)))
    assert actual["Coordinates"]["Kind"] == "refused"
    assert actual["Coordinates"]["Partial"]["Ratio"] is not None
    assert actual["Coordinates"]["Partial"]["R"] is None
    assert actual["Objective"] is None


def test_final_encoding_failure_keeps_complete_actual_objective(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw = raw_input()
    native_raw = json.dumps(synthetic_candidate(raw)).encode()
    original = json.JSONEncoder.iterencode

    def broken(self: json.JSONEncoder, value: object, _one_shot: bool = False) -> Any:
        if (
            isinstance(value, dict)
            and value.get("Schema") == "zeta.precision-projection.certificate.v1"
        ):
            raise OSError("owned final encoding fault")
        return original(self, value, _one_shot)

    monkeypatch.setattr(json.JSONEncoder, "iterencode", broken)
    actual = ref.certify_native(
        raw,
        native_raw,
        BINDINGS,
        expected_input_sha256=hashlib.sha256(raw).hexdigest().upper(),
        expected_case_id="unit/independent",
    )
    assert isinstance(actual, ref.ReceiptFailure)
    assert actual.Failure.Stage == "encoding"
    assert actual.Receipt["Outcome"]["Kind"] == "certified"
    assert set(actual.Receipt["Objective"]["Value"]) == {
        "Value",
        "DerivativeMean",
        "DerivativeVariance",
    }
    assert actual.Receipt["Counters"]["LeafChecks"] == 7


def test_midpoint_retry_survives_intervening_initial_sign_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    midpoint = iv.Arithmetic.midpoint
    phi = ref._Root.phi

    def first_stagnates(self: iv.Arithmetic, value: object) -> iv.Result[Decimal]:
        if self.Spec.Precision == 80:
            return iv.Failure(
                "ResolutionLimit", "parameters", "Midpoint", "owned initial stagnation"
            )
        return midpoint(self, value)

    def middle_sign_unresolved(self: ref._Root, point: Decimal) -> iv.Interval:
        result = phi(self, point)
        if self.a.Spec.Precision == 160 and self.stage == "right-endpoint":
            return iv.Interval(Decimal(-1), Decimal(1))
        return result

    monkeypatch.setattr(iv.Arithmetic, "midpoint", first_stagnates)
    monkeypatch.setattr(ref._Root, "phi", middle_sign_unresolved)
    actual = receipt(call(raw_input(k="0", profile="reference-one")))
    assert actual["Counters"]["PrecisionEscalations"] == 2
    assert actual["Counters"]["MidpointAttempts"] == 1
    assert actual["Counters"]["MidpointEvaluations"] == 1
    assert actual["Outcome"]["Failure"]["Code"] == "IterationLimit"
    assert actual["Counters"]["BracketAdmissions"] == 3


def test_second_context_refusal_uses_registered_failure_stage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    factory = iv.make_arithmetic
    midpoint = iv.Arithmetic.midpoint

    def second_refuses(
        precision: object, *, transcendental_limit: object = 4096
    ) -> iv.Result[iv.Arithmetic]:
        if precision == 160:
            return iv.Failure(
                "Domain", "parameters", "Context", "owned actual factory refusal"
            )
        return factory(precision, transcendental_limit=transcendental_limit)

    def first_stagnates(self: iv.Arithmetic, value: object) -> iv.Result[Decimal]:
        if self.Spec.Precision == 80:
            return iv.Failure(
                "ResolutionLimit", "parameters", "Midpoint", "owned first stagnation"
            )
        return midpoint(self, value)

    monkeypatch.setattr(iv, "make_arithmetic", second_refuses)
    monkeypatch.setattr(iv.Arithmetic, "midpoint", first_stagnates)
    actual = receipt(call(raw_input(k="0")))
    assert actual["Outcome"]["Failure"]["Stage"] == "parameters"
    assert actual["Counters"]["ParameterPreparations"] == 2
    assert [context["Precision"] for context in actual["Contexts"]] == [80]
    assert actual["Outcome"]["Partial"]["Mean"] is not None
    assert actual["Trace"][-2]["Stage"] == "parameters"
    assert actual["Trace"][-2]["Precision"] is None


def test_input_ceiling_precedes_hash_and_numeric_work(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entered: list[str] = []

    def forbidden_hash(*args: object, **kwargs: object) -> Any:
        entered.append("hash")
        raise AssertionError("oversized input reached hash")

    def forbidden_solver(*args: object, **kwargs: object) -> None:
        entered.append("solver")
        raise AssertionError("oversized input reached solver")

    raw = b" " * 65537
    monkeypatch.setattr(hashlib, "sha256", forbidden_hash)
    monkeypatch.setattr(ref._Root, "solve", forbidden_solver)
    actual = ref.reference_root(
        raw,
        BINDINGS,
        expected_input_sha256="0" * 64,
        expected_case_id="unit/independent",
    )
    assert isinstance(actual, ref.Failure)
    assert actual.Code == "Wire"
    assert entered == []


def test_first_factory_failure_has_no_invented_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def refuses(
        precision: object, *, transcendental_limit: object = 4096
    ) -> iv.Result[iv.Arithmetic]:
        return iv.Failure(
            "Domain", "parameters", "Context", "owned first factory refusal"
        )

    monkeypatch.setattr(iv, "make_arithmetic", refuses)
    actual = receipt(call(raw_input()))
    assert actual["Outcome"]["Failure"]["Stage"] == "parameters"
    assert (
        actual["Counters"]["Starts"] == actual["Counters"]["ParameterPreparations"] == 1
    )
    assert actual["Contexts"] == []
    assert actual["Trace"][-2]["Stage"] == "parameters"
    assert actual["Trace"][-2]["Precision"] is None
    assert actual["Counters"]["TranscendentalEntries"] == 0


def test_iteration_budget_is_midpoint_failure_without_phantom_entry() -> None:
    actual = receipt(call(raw_input(k="0", profile="reference-one")))
    assert actual["Outcome"]["Failure"]["Code"] == "IterationLimit"
    assert actual["Outcome"]["Failure"]["Stage"] == "midpoint"
    assert actual["Counters"]["MidpointAttempts"] == 1
    assert actual["Counters"]["MidpointEvaluations"] == 1
    assert len([row for row in actual["Trace"] if row["Stage"] == "midpoint"]) == 1


def test_original_objective_nonstationary_against_independent_series() -> None:
    from math import factorial

    # Independent positive-term bounds, never a native/point-reference value.
    count = 180
    exp_lower = sum((Fraction(2**i, factorial(i)) for i in range(count)), Fraction(0))
    exp_upper = exp_lower + Fraction(2**count, factorial(count)) / (
        1 - Fraction(2, count + 1)
    )
    log_lower = 2 * sum(
        (Fraction(1, 3 ** (2 * j + 1) * (2 * j + 1)) for j in range(count)), Fraction(0)
    )
    log_upper = log_lower + Fraction(2, 3 ** (2 * count + 1) * (2 * count + 1)) / (
        1 - Fraction(1, 9)
    )
    arithmetic = iv.make_arithmetic(80, transcendental_limit=6)
    assert isinstance(arithmetic, iv.Success)
    post = ref._Post(arithmetic.Value)
    target = {
        name: post.point(number)
        for name, number in zip(("T", "U", "K", "C"), (2, -1, 3, 1), strict=True)
    }
    actual = post.objective(target, post.point(1), post.point(2))
    exact_bounds = {
        "Value": (3 + exp_lower - log_upper / 2, 3 + exp_upper - log_lower / 2),
        "DerivativeMean": (1 + exp_lower, 1 + exp_upper),
        "DerivativeVariance": (
            Fraction(3, 4) + exp_lower / 2,
            Fraction(3, 4) + exp_upper / 2,
        ),
    }
    for field, (lower, upper) in exact_bounds.items():
        assert (
            Fraction(actual[field].Lower)
            <= lower
            <= upper
            <= Fraction(actual[field].Upper)
        )
    assert actual["DerivativeMean"].Lower > 8
    assert arithmetic.Value.TranscendentalEntries == 4


def test_candidate_x_not_substituted_for_independent_root_or_coordinate() -> None:
    raw = raw_input()
    candidate = synthetic_candidate(raw)
    candidate["Outcome"]["Value"]["LogRatioBits"] = encode_bits(Fraction(-1, 2))
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"]["Failure"]["Code"] == "InconsistentCoordinate"
    assert actual["Counters"]["LeafChecks"] == 3
    assert actual["Reference"]["Outcome"]["Kind"] == "enclosure"


@pytest.mark.parametrize("encoding_failure", [False, True])
def test_normal_root_api_failure_preserved_before_certificate_packaging(
    monkeypatch: pytest.MonkeyPatch, encoding_failure: bool
) -> None:
    from dataclasses import asdict

    raw = raw_input()
    native_raw = json.dumps(synthetic_candidate(raw)).encode()
    original_failure = ref.Failure(
        "SourceMismatch",
        "input",
        "Bindings.owned-helper",
        "actual nested caller refusal, retained verbatim",
    )
    calls: list[object] = []

    def returns_failure(*args: object, **kwargs: object) -> ref.ReceiptResult:
        calls.append(original_failure)
        return original_failure

    monkeypatch.setattr(ref, "reference_root", returns_failure)
    if encoding_failure:

        def refuses_encoding(*args: object, **kwargs: object) -> Any:
            raise OSError("owned subsequent certificate encoding failure")

        monkeypatch.setattr(json.JSONEncoder, "iterencode", refuses_encoding)
    actual = ref.certify_native(
        raw,
        native_raw,
        BINDINGS,
        expected_input_sha256=hashlib.sha256(raw).hexdigest().upper(),
        expected_case_id="unit/independent",
    )
    # The focused fail-before/pass-after capture retains the whole actual return.
    print("ACTUAL_PUBLIC_RETURN", repr(actual))
    if encoding_failure:
        assert isinstance(actual, ref.ReceiptFailure)
        actual_receipt = actual.Receipt
        assert actual.Failure.Stage == "encoding"
    else:
        actual_receipt = receipt(actual)
    assert actual_receipt["Outcome"] == {
        "Kind": "refused",
        "Failure": asdict(original_failure),
    }
    assert calls == [original_failure]
    assert actual_receipt["Reference"] is None
    assert actual_receipt["Counters"]["ReferenceRootCalls"] == 1
    assert actual_receipt["Coordinates"] is None
    assert actual_receipt["Objective"] is None


@pytest.mark.parametrize(
    "mutation",
    [
        "empty",
        "missing-parameters",
        "reordered",
        "duplicate-midpoint",
        "wrong-attempt",
        "late-row",
        "zero-mid-count",
        "zero-phi-count",
        "zero-exp-count",
        "zero-log-count",
        "wrong-update-count",
        "missing-point",
        "missing-phi",
        "unused-point",
        "unpaired-bracket",
        "missing-bracket",
    ],
)
def test_native_candidate_requires_complete_structural_trace(mutation: str) -> None:
    raw = raw_input()
    candidate = synthetic_candidate(raw)
    trace = candidate["Trace"]
    counters = candidate["Counters"]
    if mutation == "empty":
        trace.clear()
        counters.update(
            PhiEntries=0,
            MidpointAttempts=0,
            BracketUpdates=0,
            LogEntries=0,
            ExpEntries=0,
        )
    elif mutation == "missing-parameters":
        del trace[1]
    elif mutation == "reordered":
        trace[1], trace[2] = trace[2], trace[1]
    elif mutation == "duplicate-midpoint":
        trace.insert(5, dict(trace[4]))
        counters.update(
            MidpointAttempts=2, PhiEntries=4, ExpEntries=4, BracketUpdates=1
        )
    elif mutation == "wrong-attempt":
        trace[4]["Attempt"] = 2
    elif mutation == "late-row":
        trace.append(dict(trace[0]))
    elif mutation == "zero-mid-count":
        counters["MidpointAttempts"] = 0
    elif mutation == "zero-phi-count":
        counters["PhiEntries"] = 0
    elif mutation == "zero-exp-count":
        counters["ExpEntries"] = 0
    elif mutation == "zero-log-count":
        counters["LogEntries"] = 0
    elif mutation == "wrong-update-count":
        counters["BracketUpdates"] = 1
    elif mutation == "missing-point":
        trace[2]["PointBits"] = None
    elif mutation == "missing-phi":
        trace[4]["PhiBits"] = None
    elif mutation == "unused-point":
        trace[1]["PointBits"] = encode_bits(0)
    elif mutation == "unpaired-bracket":
        trace[3]["LowerBits"] = None
    else:
        trace[3]["LowerBits"] = trace[3]["UpperBits"] = None
    for index, row in enumerate(trace, 1):
        row["Sequence"] = index
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"]["Kind"] == "refused"
    assert actual["Outcome"]["Failure"]["Code"] == "CandidateShape"
    assert actual["Counters"]["ReferenceRootCalls"] == 0


def synthetic_refusal(
    raw: bytes, stage: str = "objective", code: str = "ObjectiveRefusal"
) -> dict[str, Any]:
    candidate = synthetic_candidate(raw)
    trace = candidate["Trace"]
    stop = next(i for i, row in enumerate(trace) if row["Stage"] == stage)
    candidate["Trace"] = trace[: stop + 1]
    failure = {
        "Code": code,
        "Stage": stage,
        "Field": "owned",
        "Message": "synthetic actual-prefix fixture",
        "OriginalKernelFailure": None,
    }
    candidate["Trace"][-1]["Failure"] = failure
    candidate["Outcome"] = {
        "Kind": "refused",
        "Failure": failure,
        "Partial": {
            "Target": ref._input(raw, "unit/independent").Snapshot,
            "Parameters": None,
            "Bracket": None,
            "Candidate": None,
            "OriginalObjective": None,
        },
    }
    return candidate


@pytest.mark.parametrize(
    "mutation",
    [
        "empty",
        "failure-missing",
        "failure-substitution",
        "earlier-failure",
        "failure-stage",
        "missing-stage",
        "extra-row",
        "wrong-phi",
        "wrong-objective",
    ],
)
def test_native_refusal_requires_real_ending_prefix(mutation: str) -> None:
    raw = raw_input()
    candidate = synthetic_refusal(raw)
    trace = candidate["Trace"]
    if mutation == "empty":
        trace.clear()
    elif mutation == "failure-missing":
        trace[-1]["Failure"] = None
    elif mutation == "failure-substitution":
        trace[-1]["Failure"] = {
            **trace[-1]["Failure"],
            "Message": "different observed failure",
        }
    elif mutation == "earlier-failure":
        trace[1]["Failure"] = dict(trace[-1]["Failure"])
    elif mutation == "failure-stage":
        failure = {**candidate["Outcome"]["Failure"], "Stage": "parameters"}
        trace[-1]["Failure"] = failure
        candidate["Outcome"]["Failure"] = failure
    elif mutation == "missing-stage":
        del trace[2]
    elif mutation == "extra-row":
        trace.append({**trace[0], "Failure": candidate["Outcome"]["Failure"]})
    elif mutation == "wrong-phi":
        candidate["Counters"]["PhiEntries"] = 0
    else:
        candidate["Counters"]["ObjectiveEntries"] = 0
    for index, row in enumerate(trace, 1):
        row["Sequence"] = index
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"]["Kind"] == "refused"
    assert actual["Outcome"]["Failure"]["Code"] == "CandidateShape"
    assert actual["Counters"]["ReferenceRootCalls"] == 0


@pytest.mark.parametrize(
    "kind",
    [
        "input",
        "domain",
        "left",
        "right",
        "mid-before",
        "resolution",
        "mid-phi",
        "mid-after",
        "budget",
        "reconstruction",
        "objective",
    ],
)
def test_source_confirmed_normal_refusal_prefixes_are_admitted(kind: str) -> None:
    # Abstract source-ledger fixtures; the claimed floating failure is not replayed.
    raw = raw_input(profile="native-one" if kind == "budget" else "default")
    stage = {
        "input": "input",
        "domain": "parameters",
        "left": "left-endpoint",
        "right": "right-endpoint",
        "reconstruction": "reconstruction",
        "objective": "objective",
    }.get(kind, "midpoint")
    code = {
        "input": "Wire",
        "domain": "Domain",
        "right": "NoRoundedBracket",
        "resolution": "ResolutionLimit",
        "budget": "IterationLimit",
        "objective": "ObjectiveRefusal",
    }.get(kind, "NumericalRange")
    candidate = synthetic_refusal(raw, stage, code)
    counts = candidate["Counters"]
    counts.update(ObjectiveEntries=int(kind == "objective"))
    last = candidate["Trace"][-1]
    if kind == "input":
        for name in counts:
            counts[name] = 0
        candidate["Outcome"]["Partial"]["Target"] = None
    elif kind == "domain":
        counts.update(
            LogEntries=0,
            PhiEntries=0,
            ExpEntries=0,
            MidpointAttempts=0,
            BracketUpdates=0,
        )
        last["LowerBits"] = last["UpperBits"] = None
    elif kind in ("left", "right"):
        counts.update(
            PhiEntries=1 if kind == "left" else 2,
            ExpEntries=1 if kind == "left" else 2,
            MidpointAttempts=0,
            BracketUpdates=0,
        )
        if kind == "left":
            last["PhiBits"] = None
    elif kind in ("mid-before", "resolution"):
        counts.update(PhiEntries=2, ExpEntries=2, BracketUpdates=0)
        last["PhiBits"] = None
        if kind == "mid-before":
            last["PointBits"] = None
    elif kind == "mid-phi":
        last["PhiBits"] = None
    elif kind in ("mid-after", "budget"):
        counts["BracketUpdates"] = 1
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"] == {
        "Kind": "no-candidate",
        "NativeFailure": candidate["Outcome"]["Failure"],
    }
    assert actual["Counters"]["ReferenceRootCalls"] == 0


@pytest.mark.parametrize("kind", ["two-midpoints", "rounded-width"])
def test_complete_candidate_counter_alternatives(kind: str) -> None:
    raw = raw_input()
    candidate = synthetic_candidate(raw)
    if kind == "two-midpoints":
        second = {**candidate["Trace"][4], "Attempt": 2}
        candidate["Trace"].insert(5, second)
        candidate["Counters"].update(
            MidpointAttempts=2, PhiEntries=4, ExpEntries=4, BracketUpdates=1
        )
    else:
        candidate["Outcome"]["Value"]["Stop"] = "rounded-width"
        candidate["Counters"]["BracketUpdates"] = 1
    for index, row in enumerate(candidate["Trace"], 1):
        row["Sequence"] = index
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"]["Kind"] == "certified"
    assert actual["Outcome"]["NativeTrajectoryCertified"] is False


def test_unexpected_native_prefix_does_not_invent_primitive_completion() -> None:
    raw = raw_input()
    candidate = synthetic_refusal(raw, "left-endpoint", "Unexpected")
    candidate["Counters"].update(
        PhiEntries=0,
        ExpEntries=0,
        MidpointAttempts=0,
        BracketUpdates=0,
        ObjectiveEntries=0,
    )
    candidate["Trace"][-1]["PointBits"] = candidate["Trace"][-1]["PhiBits"] = None
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"]["Kind"] == "no-candidate"
    assert actual["Outcome"]["NativeFailure"]["Code"] == "Unexpected"
    assert actual["Counters"]["ReferenceRootCalls"] == 0


@pytest.mark.parametrize(
    "code", ["NoRoundedBracket", "IterationLimit", "ResolutionLimit"]
)
def test_native_stage_specific_refusal_cannot_move_to_objective(code: str) -> None:
    raw = raw_input()
    candidate = synthetic_refusal(raw, "objective", code)
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"]["Failure"]["Code"] == "CandidateShape"
    assert actual["Counters"]["ReferenceRootCalls"] == 0


def test_native_pre_phi_arithmetic_failure_has_no_completed_point() -> None:
    raw = raw_input()
    candidate = synthetic_refusal(raw, "midpoint", "NumericalRange")
    candidate["Counters"].update(
        PhiEntries=2, ExpEntries=2, BracketUpdates=0, ObjectiveEntries=0
    )
    candidate["Trace"][-1]["PhiBits"] = None
    actual = receipt(certify(raw, candidate))
    assert actual["Outcome"]["Failure"]["Code"] == "CandidateShape"
    assert actual["Counters"]["ReferenceRootCalls"] == 0
