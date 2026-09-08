"""Fixed exact room controls; expected values are independent literal arithmetic."""

from __future__ import annotations

import json
from fractions import Fraction as F
from typing import Any, cast

import pytest

from zeta_interp import distributional_learning_rooms_reference as r


def ok[T](result: r.Result[T]) -> T:
    assert isinstance(result, r.Success), result
    return result.Value


def p() -> r.Distribution:
    return ok(r.distribution((-2, -1, 0, 1, 2), (0, F(1, 2), 0, F(1, 2), 0)))


def q() -> r.Distribution:
    return ok(r.distribution((-2, -1, 0, 1, 2), (F(1, 8), 0, F(3, 4), 0, F(1, 8))))


def wire(numerator: int, denominator: int = 1) -> dict[str, str]:
    return {"Num": str(numerator), "Den": str(denominator)}


def vector(*values: int | tuple[int, int]) -> list[dict[str, str]]:
    return [wire(*v) if isinstance(v, tuple) else wire(v) for v in values]


def expected_receipt() -> dict[str, Any]:
    pm = vector(0, (1, 2), 0, (1, 2), 0)
    qm = vector((1, 8), 0, (3, 4), 0, (1, 8))
    likelihoods = [
        vector(1, 1, 1, 1, 1),
        vector((1, 4), (1, 2), (3, 4), 1, (1, 2)),
        vector(1, 0, 0, 0, 1),
    ]
    condition_values = [
        ("P", "unit", wire(1), pm),
        ("P", "soft", wire(3, 4), vector(0, (1, 3), 0, (2, 3), 0)),
        ("P", "tail", None, None),
        ("Q", "unit", wire(1), qm),
        ("Q", "soft", wire(21, 32), vector((1, 21), 0, (6, 7), 0, (2, 21))),
        ("Q", "tail", wire(1, 4), vector((1, 2), 0, 0, 0, (1, 2))),
    ]
    return {
        "Schema": "zeta.distributional-rooms.reference.v1",
        "Support": vector(-2, -1, 0, 1, 2),
        "Actions": ["steady", "tail-exposed"],
        "Utilities": [vector(0, 0, 0, 0, 0), vector(-7, 1, 1, 1, -7)],
        "TailEvent": {"Kind": "absolute-greater-than", "Threshold": wire(3, 2)},
        "Distributions": [
            {
                "Id": "P",
                "Mass": pm,
                "Mean": wire(0),
                "SecondMoment": wire(1),
                "Variance": wire(1),
                "TailProbability": wire(0),
                "ExpectedUtilities": vector(0, 1),
                "ActionIndex": 1,
                "Action": "tail-exposed",
            },
            {
                "Id": "Q",
                "Mass": qm,
                "Mean": wire(0),
                "SecondMoment": wire(1),
                "Variance": wire(1),
                "TailProbability": wire(1, 4),
                "ExpectedUtilities": vector(0, -1),
                "ActionIndex": 0,
                "Action": "steady",
            },
        ],
        "Transport": {
            "Convention": "source-index-to-destination-index",
            "Permutation": [1, 2, 3, 4, 0],
            "Inverse": [4, 0, 1, 2, 3],
            "Rows": [
                {
                    "Id": "P/cycle",
                    "Distribution": "P",
                    "ForwardMass": vector(0, 0, (1, 2), 0, (1, 2)),
                    "RecoveredMass": pm,
                    "ForwardMean": wire(1),
                    "ForwardVariance": wire(1),
                },
                {
                    "Id": "Q/cycle",
                    "Distribution": "Q",
                    "ForwardMass": vector((1, 8), (1, 8), 0, (3, 4), 0),
                    "RecoveredMass": qm,
                    "ForwardMean": wire(3, 8),
                    "ForwardVariance": wire(79, 64),
                },
            ],
        },
        "Conditioning": [
            {
                "Id": name + "/" + lid,
                "Distribution": name,
                "LikelihoodId": lid,
                "Likelihood": likelihoods[i % 3],
                "Outcome": {
                    "Kind": "refused",
                    "Code": "ZeroEvidence",
                    "Message": "conditioning evidence is zero",
                }
                if evidence is None
                else {
                    "Kind": "conditioned",
                    "Evidence": evidence,
                    "Posterior": posterior,
                },
            }
            for i, (name, lid, evidence, posterior) in enumerate(condition_values)
        ],
    }


def test_full_exact_receipt_and_deterministic_json() -> None:
    actual = ok(r.reference_receipt())
    expected = expected_receipt()
    # Canonical byte comparison also distinguishes bool/int and numeric/string types.
    assert json.dumps(actual, sort_keys=True) == json.dumps(expected, sort_keys=True)
    assert actual == ok(r.reference_receipt())
    assert json.loads(json.dumps(actual)) == expected


def test_every_rational_in_receipt_is_canonical() -> None:
    def walk(value: object) -> None:
        if type(value) is dict:
            if set(value) == {"Num", "Den"}:
                assert ok(r.encode_rational(ok(r.decode_rational(value)))) == value
            else:
                for child in value.values():
                    walk(child)
        elif type(value) is list:
            for child in value:
                walk(child)

    walk(ok(r.reference_receipt()))


def test_equal_moments_do_not_determine_tail_utility() -> None:
    ps, qs = ok(r.moments(p(), F(3, 2))), ok(r.moments(q(), F(3, 2)))
    assert (ps.Mean, ps.SecondMoment, ps.Variance) == (F(0), F(1), F(1))
    assert (qs.Mean, qs.SecondMoment, qs.Variance) == (F(0), F(1), F(1))
    assert (ps.TailProbability, qs.TailProbability) == (F(0), F(1, 4))
    utilities = ((0, 0, 0, 0, 0), (-7, 1, 1, 1, -7))
    pd = ok(r.decide(p(), ("steady", "tail-exposed"), utilities))
    qd = ok(r.decide(q(), ("steady", "tail-exposed"), utilities))
    assert pd == r.Decision((F(0), F(1)), 1, "tail-exposed")
    assert qd == r.Decision((F(0), F(-1)), 0, "steady")
    assert pd.ExpectedUtilities[1] != sum(utilities[1])  # unweighted mutant


def test_population_variance_is_not_second_moment() -> None:
    shifted = ok(r.distribution((1, 2), (F(1, 2), F(1, 2))))
    actual = ok(r.moments(shifted, 1))
    assert actual == r.Moments(F(3, 2), F(5, 2), F(1, 4), F(1, 2))
    assert actual.Variance != actual.SecondMoment


def test_tail_is_strict_and_ties_use_first_action() -> None:
    assert ok(r.moments(p(), 1)).TailProbability == 0
    assert ok(r.moments(p(), 0)).TailProbability == 1
    assert ok(r.moments(q(), 2)).TailProbability == 0
    assert ok(r.decide(p(), ("first", "second"), ((0,) * 5, (0,) * 5))).ActionIndex == 0


@pytest.mark.parametrize("prior", [p, q])
def test_transport_direction_inverse_mass_and_moments(prior: Any) -> None:
    source = prior()
    perm, inverse = (1, 2, 3, 4, 0), (4, 0, 1, 2, 3)
    assert all(inverse[perm[i]] == i and perm[inverse[i]] == i for i in range(5))
    moved = ok(r.transport(source, perm, inverse))
    assert sum(moved.Mass) == sum(source.Mass) == 1
    assert ok(r.transport(moved, inverse, perm)) == source
    assert moved != ok(r.transport(source, inverse, perm))  # reversed-direction mutant
    assert ok(r.moments(moved, 0)).Mean != ok(r.moments(source, 0)).Mean


@pytest.mark.parametrize("prior", [p, q])
def test_condition_unit_identity_and_exact_normalization(prior: Any) -> None:
    source = prior()
    unit = ok(r.condition(source, (1,) * 5))
    assert unit.Evidence == 1 and unit.Posterior == source
    likelihood = (F(1, 4), F(1, 2), F(3, 4), F(1), F(1, 2))
    actual = ok(r.condition(source, likelihood))
    products = tuple(m * v for m, v in zip(source.Mass, likelihood, strict=True))
    assert actual.Evidence == sum(products)
    assert sum(actual.Posterior.Mass) == 1
    assert actual.Posterior.Mass != products  # omitted normalization
    assert actual.Posterior.Mass != tuple(v / sum(likelihood) for v in likelihood)
    assert actual.Posterior.Mass != (F(1, 5),) * 5
    assert all(
        a == b / actual.Evidence
        for a, b in zip(actual.Posterior.Mass, products, strict=True)
    )


def test_zero_evidence_is_not_a_posterior() -> None:
    assert r.condition(p(), (1, 0, 0, 0, 1)) == r.Failure(
        "ZeroEvidence", "conditioning evidence is zero"
    )
    actual = ok(r.condition(q(), (1, 0, 0, 0, 1)))
    assert actual.Evidence == F(1, 4)
    assert actual.Posterior.Mass == (F(1, 2), F(0), F(0), F(0), F(1, 2))
    assert r.condition(q(), (0,) * 5) == r.Failure(
        "ZeroEvidence", "conditioning evidence is zero"
    )


@pytest.mark.parametrize("value", [0, 1, -7, F(1, 2), F(-41, 152)])
def test_rational_roundtrip(value: int | F) -> None:
    assert ok(r.decode_rational(ok(r.encode_rational(value)))) == value


@pytest.mark.parametrize(
    "value",
    [
        None,
        [],
        {},
        {"Num": "0", "Den": "1", "Extra": 0},
        {"Num": 1, "Den": "1"},
        {"Num": True, "Den": "1"},
        {"Num": "-0", "Den": "1"},
        {"Num": "+1", "Den": "1"},
        {"Num": "01", "Den": "1"},
        {"Num": " 1", "Den": "1"},
        {"Num": "1", "Den": "0"},
        {"Num": "1", "Den": "-2"},
        {"Num": "1", "Den": "02"},
        {"Num": "2", "Den": "4"},
        {"Num": "0", "Den": "2"},
        {"Num": "1", "Den": 1.0},
    ],
)
def test_rational_wire_refusals(value: object) -> None:
    assert isinstance(r.decode_rational(value), r.Failure)


@pytest.mark.parametrize("value", [True, False, 0.0, float("nan"), "1/2", None])
def test_exact_value_refusals(value: object) -> None:
    assert isinstance(r.encode_rational(value), r.Failure)


@pytest.mark.parametrize(
    "support,mass",
    [
        ([], ()),
        ((), ()),
        ((0,), ()),
        ((0, 0), (F(1, 2), F(1, 2))),
        ((1, 0), (F(1, 2), F(1, 2))),
        ((0, 1), (-1, 2)),
        ((0, 1), (F(1, 4), F(1, 4))),
        ((True,), (1,)),
        ((0.0,), (1,)),
        ((0,), (True,)),
        ((0,), (1.0,)),
        ((0,), [1]),
    ],
)
def test_distribution_admission(support: object, mass: object) -> None:
    assert isinstance(r.distribution(support, mass), r.Failure)


def test_forged_records_are_revalidated_at_every_operation() -> None:
    forged = r.Distribution((F(0), F(1)), (F(-1), F(2)))
    results = [
        r.moments(forged, 0),
        r.decide(forged, ("a",), ((0, 1),)),
        r.transport(forged, (1, 0), (1, 0)),
        r.condition(forged, (1, 1)),
    ]
    assert all(isinstance(result, r.Failure) for result in results)
    malformed = r.Distribution(cast(Any, None), cast(Any, None))
    assert isinstance(r.moments(malformed, 0), r.Failure)
    assert isinstance(r.condition(None, (1,)), r.Failure)


@pytest.mark.parametrize(
    "permutation,inverse",
    [
        ((0,), (0,)),
        ((0, 0, 2, 3, 4), (0, 1, 2, 3, 4)),
        ((0, 1, 2, 3, 5), (0, 1, 2, 3, 4)),
        ((False, 1, 2, 3, 4), (0, 1, 2, 3, 4)),
        ((1, 2, 3, 4, 0), (0, 1, 2, 3, 4)),
        ([0, 1, 2, 3, 4], (0, 1, 2, 3, 4)),
    ],
)
def test_transport_refuses_invalid_bijection_or_inverse(
    permutation: object, inverse: object
) -> None:
    assert isinstance(r.transport(p(), permutation, inverse), r.Failure)


@pytest.mark.parametrize(
    "likelihood",
    [
        (1,),
        (-1, 1, 1, 1, 1),
        (2, 1, 1, 1, 1),
        (True, 1, 1, 1, 1),
        (1.0, 1, 1, 1, 1),
        [1] * 5,
    ],
)
def test_likelihood_admission(likelihood: object) -> None:
    assert isinstance(r.condition(p(), likelihood), r.Failure)


@pytest.mark.parametrize(
    "actions,utilities",
    [
        ((), ()),
        (("",), ((0,) * 5,)),
        (("a", "a"), ((0,) * 5,) * 2),
        ((True,), ((0,) * 5,)),
        (("a",), ()),
        (("a",), ((0,),)),
        (("a",), ((True,) * 5,)),
        (("a",), ((0.0,) * 5,)),
        (["a"], ((0,) * 5,)),
    ],
)
def test_decision_admission(actions: object, utilities: object) -> None:
    assert isinstance(r.decide(p(), actions, utilities), r.Failure)


@pytest.mark.parametrize("threshold", [-1, True, 1.0])
def test_tail_threshold_admission(threshold: object) -> None:
    assert isinstance(r.moments(p(), threshold), r.Failure)


def test_interpreter_integer_text_limit_is_a_typed_refusal() -> None:
    import sys

    original = sys.get_int_max_str_digits()
    try:
        sys.set_int_max_str_digits(640)
        assert isinstance(r.encode_rational(10**641), r.Failure)
        assert isinstance(
            r.decode_rational({"Num": "1" + "0" * 641, "Den": "1"}), r.Failure
        )
    finally:
        sys.set_int_max_str_digits(original)
