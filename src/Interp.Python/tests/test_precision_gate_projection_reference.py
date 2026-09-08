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
