from __future__ import annotations

from dataclasses import replace
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_certificate as c
from zeta_interp import hidden_switch_compiled_ieee as s
from zeta_interp import hidden_switch_compiled_outer_negatives as outer
from zeta_interp import hidden_switch_compiled_reference as reference


@pytest.fixture(scope="module")
def certificate() -> c.VerifiedCertificate:
    bindings = {"ProtocolSha256": c.PROTOCOL_SHA256, "hand-validation": "0" * 64}
    built = c.build_certificate(bindings)
    assert isinstance(built, s.Success)
    result = c.verify_certificate(built.value, bindings)
    assert isinstance(result, s.Success)
    return result.value


def _witness(cert: c.VerifiedCertificate) -> dict[str, Any]:
    return {
        "Input": {"QBits": ["0000000000000000", f"{cert.EpsilonBits:016X}"]},
        "ActualAction": 0,
        "Mutation": {"Kind": "inclusive-epsilon-comparison", "Action": 1},
    }


def test_exact_supplied_q_and_executed_mutation_scope(
    certificate: c.VerifiedCertificate, monkeypatch: pytest.MonkeyPatch
) -> None:
    observed: list[object] = []
    original = reference.select_bits

    def select(values: object) -> s.Result[int]:
        observed.append(values)
        return original(values)

    monkeypatch.setattr(reference, "select_bits", select)
    result = outer.replay_selector_tie(_witness(certificate), certificate)
    assert isinstance(result, s.Success)
    assert observed == [(0, certificate.EpsilonBits)]
    assert result.value.DifferenceBits == f"{certificate.EpsilonBits:016X}"
    assert result.value.ActualAction == 0 and result.value.MutantAction == 1
    assert result.value.MutantRefusalCode == "SelectorAction"
    assert result.value.Scope == "one-supplied-q-strict-epsilon-witness"
    assert result.value.NativeExecutionAndOuterAdmission.startswith("not-performed")


@pytest.mark.parametrize("action", [1, False, 0.0, "0", None])
def test_wrong_or_untyped_actual_action_refuses(
    certificate: c.VerifiedCertificate, action: object
) -> None:
    witness = _witness(certificate)
    witness["ActualAction"] = action
    result = outer.replay_selector_tie(witness, certificate)
    assert isinstance(result, s.Failure) and result.Code == "ReferenceRefusal"


@pytest.mark.parametrize("action", [0, True, 1.0, "1", None])
def test_mutant_must_actually_differ_with_exact_integer_type(
    certificate: c.VerifiedCertificate, action: object
) -> None:
    witness = _witness(certificate)
    witness["Mutation"]["Action"] = action
    assert isinstance(outer.replay_selector_tie(witness, certificate), s.Failure)


@pytest.mark.parametrize(
    "change", ["negative-zero", "epsilon-successor", "swap", "tuple", "short"]
)
def test_fixed_exact_q_roster_refuses_changes(
    certificate: c.VerifiedCertificate, change: str
) -> None:
    witness = _witness(certificate)
    bits = witness["Input"]["QBits"]
    if change == "negative-zero":
        bits[0] = "8000000000000000"
    elif change == "epsilon-successor":
        bits[1] = f"{certificate.EpsilonBits + 1:016X}"
    elif change == "swap":
        bits.reverse()
    elif change == "tuple":
        witness["Input"]["QBits"] = tuple(bits)
    else:
        bits.pop()
    assert isinstance(outer.replay_selector_tie(witness, certificate), s.Failure)


@pytest.mark.parametrize("where", ["top", "input", "mutation", "kind"])
def test_no_extra_fields_or_relabeling(
    certificate: c.VerifiedCertificate, where: str
) -> None:
    witness = _witness(certificate)
    if where == "top":
        witness["Passed"] = True
    elif where == "input":
        witness["Input"]["Passed"] = True
    elif where == "mutation":
        witness["Mutation"]["Passed"] = True
    else:
        witness["Mutation"]["Kind"] = "unchanged-control"
    assert isinstance(outer.replay_selector_tie(witness, certificate), s.Failure)


def test_forged_opaque_certificate_refuses(certificate: c.VerifiedCertificate) -> None:
    assert isinstance(
        outer.replay_selector_tie(_witness(certificate), replace(certificate)),
        s.Failure,
    )


def test_injected_inclusive_reference_cannot_validate_positive_control(
    certificate: c.VerifiedCertificate, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(reference, "select_bits", lambda _values: s.Success(1))
    result = outer.replay_selector_tie(_witness(certificate), certificate)
    assert isinstance(result, s.Failure) and result.Code == "SelectorControl"


def test_injected_permissive_action_checker_cannot_claim_mutant_refusal(
    certificate: c.VerifiedCertificate, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        outer, "_selection", lambda action, _expected: s.Success(action)
    )
    result = outer.replay_selector_tie(_witness(certificate), certificate)
    assert isinstance(result, s.Failure) and result.Code == "SelectorMutantVacuity"
