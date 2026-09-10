"""Actual verifier outcomes for fixed prearchive malformed certificate inputs."""

from __future__ import annotations

import copy
import hashlib

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_certificate as c
from zeta_interp import hidden_switch_compiled_certificate_cases as cases
from zeta_interp import hidden_switch_compiled_ieee as s

BINDINGS = {"ProtocolSha256": c.PROTOCOL_SHA256, "hand/source.py": "0" * 64}


def value[T](result: s.Result[T]) -> T:
    assert isinstance(result, s.Success), result
    return result.value


@pytest.fixture(scope="module")
def corpus() -> cases.CertificateCaseSet:
    return value(cases.certificate_cases(BINDINGS))


def test_complete_fixed_corpus_executes_real_admission_and_preserves_bytes(
    corpus: cases.CertificateCaseSet,
) -> None:
    assert len(corpus.Cases) == len(cases.CASE_IDS) == 31
    assert tuple(row.CaseId for row in corpus.Cases) == cases.CASE_IDS
    assert len({row.Raw for row in corpus.Cases}) == 31
    for index, row in enumerate(corpus.Cases):
        assert type(row.Raw) is bytes
        assert row.Sha256 == hashlib.sha256(row.Raw).hexdigest().upper()
        assert row.Python == cases.python_outcome(row.Raw, BINDINGS)
        assert row.Python.Accepted is (index == 0)
    assert corpus.BaselineSha256 == corpus.Cases[0].Sha256
    assert corpus.Cases[0].Python.NumericCertificateSha256 == corpus.BaselineSha256
    assert corpus.Scope == "python-certificate-negative-corpus-only"
    assert corpus.NativeAdmission == "not-executed"


@pytest.mark.parametrize(
    ("name", "boundary", "code"),
    [
        (name, "numeric-certificate", "CertificateMismatch")
        for name in cases.CASE_IDS[1:25]
    ]
    + [
        ("duplicate-schema-key", "json", "json-duplicate"),
        ("nonfinite-index", "json", "json-nonfinite"),
        ("invalid-utf8", "json", "json-parse"),
        ("unpaired-surrogate", "json", "json-unicode"),
        ("empty-input", "json", "json-parse"),
        ("truncated-input", "json", "json-parse"),
    ],
)
def test_negative_rows_retain_concrete_boundary_refusals(
    corpus: cases.CertificateCaseSet, name: str, boundary: str, code: str
) -> None:
    row = next(item for item in corpus.Cases if item.CaseId == name)
    assert row.Python.Boundary == boundary
    assert row.Python.Code == code
    assert row.Python.Detail
    assert row.Python.NumericCertificateSha256 is None


def test_binding_changes_are_explicit_and_inputs_are_not_mutated() -> None:
    original = copy.deepcopy(BINDINGS)
    first = value(cases.certificate_cases(BINDINGS))
    assert BINDINGS == original
    second = value(cases.certificate_cases(dict(reversed(tuple(BINDINGS.items())))))
    assert first == second
    changed = value(
        cases.certificate_cases(dict(BINDINGS, **{"hand/source.py": "A" * 64}))
    )
    assert changed.BaselineSha256 != first.BaselineSha256
    assert changed.Cases[0].Raw != first.Cases[0].Raw
    assert all(row.Python.Accepted is (i == 0) for i, row in enumerate(changed.Cases))


def test_corpus_refuses_a_noop_mutation_instead_of_reporting_false_coverage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(cases, "_different_hash", lambda digest: digest)
    result = cases.certificate_cases(BINDINGS)
    assert isinstance(result, s.Failure)
    assert (
        result.Code == "CaseDisposition" and "wrong-protocol-binding" in result.Message
    )


@pytest.mark.parametrize(
    "bindings",
    [
        None,
        {},
        {"ProtocolSha256": "A" * 64},
        {"ProtocolSha256": c.PROTOCOL_SHA256},
        {"ProtocolSha256": c.PROTOCOL_SHA256, "source": True},
    ],
)
def test_invalid_or_unbound_source_maps_refuse(bindings: object) -> None:
    assert isinstance(cases.certificate_cases(bindings), s.Failure)


def test_mutated_failure_and_baseline_are_not_interchangeable(
    corpus: cases.CertificateCaseSet,
) -> None:
    valid = corpus.Cases[0]
    invalid = corpus.Cases[3]
    assert valid.Python != cases.python_outcome(invalid.Raw, BINDINGS)
    assert invalid.Python != cases.python_outcome(valid.Raw, BINDINGS)
    decoded = a.strict_json(valid.Raw)
    assert isinstance(decoded, a.Admitted)
    verified = value(c.verify_certificate(decoded.value, BINDINGS))
    assert verified.NumericSha256 == corpus.BaselineSha256
