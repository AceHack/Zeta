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


# Synthetic protocol fixtures only; these rows are not native execution evidence.
def synthetic_room_records() -> list[dict[str, Any]]:
    import copy

    records: list[dict[str, Any]] = []
    gaussian: list[dict[str, Any]] = [
        {
            "Id": name,
            "PrecisionMean": 0.0,
            "Precision": 1.0,
            "Mean": 0.0,
            "Variance": 1.0,
        }
        for name in ("P", "Q")
    ]
    consensus: list[dict[str, Any]] = [
        {
            "SuppliedCopies": count,
            "SourceId": "same-evidence",
            "ProvenanceEnforcedByApi": False,
            "Threshold": 2.5,
            "Outcome": outcome,
            "Precision": precision,
            "Mean": mean,
        }
        for count, outcome, precision, mean in [
            (1, "Undecided", 2.0, 0.5),
            (2, "ResolvedYes", 3.0, 2.0 / 3.0),
        ]
    ]
    soft: list[dict[str, Any]] = []
    budgets: list[dict[str, Any]] = []

    def add(category: str, identity: str, value: dict[str, Any]) -> None:
        records.append(
            {
                "Kind": "checkpoint",
                "Sequence": len(records) + 1,
                "Category": category,
                "Id": identity,
                "Value": copy.deepcopy(value),
            }
        )

    def snap(values: list[float]) -> dict[str, Any]:
        return {"Kind": "conditioned", "Posterior": values, "MaximumMass": max(values)}

    for row in gaussian:
        add("GaussianProjection", row["Id"], row)
    for row in consensus:
        add("RepeatedEvidenceConsensus", str(row["SuppliedCopies"]), row)
    posteriors = [
        ("P", [0.0, 0.5, 0.0, 0.5, 0.0], [0.0, 1.0 / 3.0, 0.0, 2.0 / 3.0, 0.0], None),
        (
            "Q",
            [0.125, 0.0, 0.75, 0.0, 0.125],
            [1.0 / 21.0, 0.0, 6.0 / 7.0, 0.0, 2.0 / 21.0],
            [0.5, 0.0, 0.0, 0.0, 0.5],
        ),
    ]
    for name, unit, conditioned, tail in posteriors:
        add("SoftValueConstructor", name, snap(unit))
        for lid, values in zip(
            ("unit", "soft", "tail"), (unit, conditioned, tail), strict=True
        ):
            row = {
                "Id": name + "/" + lid,
                "Outcome": {"Kind": "refused"} if values is None else snap(values),
            }
            soft.append(copy.deepcopy(row))
            add("SoftValueConditioning", row["Id"], row)
    shares = vector((3, 4), (1, 4))
    add("Inference", "two-candidates", {"Kind": "inferred", "PosteriorShares": shares})
    for capacity, taken, confidence, outcome in [
        (0, 0, 0.0, "RejectedWithBackpressure"),
        (6, 1, 0.5, "PartiallyAdmitted"),
        (12, 2, 1.0, "Admitted"),
    ]:
        for priority, order in [
            ("neutral", ["likely", "attended"]),
            ("attention-ten", ["attended", "likely"]),
        ]:
            identity = str(capacity) + "/" + priority
            for category, chosen_order in [
                ("PriorityPrediction", order),
                ("DirectPrediction", ["likely", "attended"]),
            ]:
                add(
                    category,
                    identity,
                    {
                        "PosteriorShares": shares,
                        "Best": "likely",
                        "Requested": chosen_order,
                        "Boarded": chosen_order[:taken],
                        "Deferred": chosen_order[taken:],
                        "RequestedBytes": 12,
                        "BoardedBytes": capacity,
                        "DeferredBytes": 12 - capacity,
                        "TankBeforeCharge": float(capacity),
                        "TankAfterCharge": 0.0,
                        "Outcome": outcome,
                        "Starved": capacity < 12,
                        "VisionConfidence": confidence,
                    },
                )
            mass = (
                wire(0)
                if capacity == 0
                else wire(1)
                if capacity == 12
                else wire(3 if priority == "neutral" else 1, 4)
            )
            budgets.append(
                {
                    "CapacityBytes": capacity,
                    "Priority": priority,
                    "PosteriorShares": shares,
                    "Best": "likely",
                    "Boarded": order[:taken],
                    "Deferred": order[taken:],
                    "RequestedBytes": 12,
                    "BoardedBytes": capacity,
                    "DeferredBytes": 12 - capacity,
                    "VisionConfidence": confidence,
                    "BoardedPosteriorMass": mass,
                    "SameBudgetReportAsDirect": priority == "neutral",
                }
            )
    receipt = {
        "Schema": "zeta.distributional-rooms.actual-zeta.v1",
        "FiniteReference": expected_receipt(),
        "ZetaObservations": {
            "GaussianProjection": gaussian,
            "RepeatedEvidenceConsensus": consensus,
            "SoftValueConditioning": soft,
            "BudgetAndPriority": budgets,
        },
        "Runtime": {
            "DotNetVersion": "synthetic-test-only",
            "LoadedAssemblies": [
                {"Name": name, "Bytes": 1, "Sha256": "0" * 64}
                for name in (
                    "Zeta.Core",
                    "Zeta.Bayesian",
                    "Zeta.Core",
                )
            ],
            "CompleteRuntimeClosureAdmitted": False,
        },
    }
    records.append(
        {
            "Kind": "terminal",
            "Schema": "zeta.distributional-rooms.run.v1",
            "Complete": True,
            "Failure": None,
            "Receipt": receipt,
            "ObservedCheckpointCount": 25,
            "WrittenCheckpointCount": 25,
            "PendingCheckpoint": None,
            "PendingCheckpointOmission": None,
        }
    )
    return records


def ndjson(records: list[dict[str, Any]]) -> bytes:
    return b"".join(
        (json.dumps(row, separators=(",", ":"), ensure_ascii=True) + "\n").encode()
        for row in records
    )


def control_records(
    count: int, failure: str = "InjectedCheckpointFailure"
) -> list[dict[str, Any]]:
    rows = synthetic_room_records()
    terminal = rows[-1]
    terminal.update(
        Complete=False,
        Failure=failure,
        Receipt=None,
        ObservedCheckpointCount=count,
        WrittenCheckpointCount=count,
    )
    return rows[:count] + [terminal]


def refused(raw: object, **kwargs: Any) -> r.RoomRunRefused:
    result = r.validate_room_ndjson(raw, **kwargs)
    assert isinstance(result, r.RoomRunRefused), result
    assert result.Raw is raw
    assert result.Custody == "external-caller-obligation-not-established"
    return result


def test_validated_full_synthetic_room_and_integral_double_tokens() -> None:
    raw = ndjson(synthetic_room_records())
    result = r.validate_room_ndjson(raw)
    assert isinstance(result, r.RoomRunValidated)
    assert (result.CheckedCheckpoints, result.FiniteRows, result.ZetaRows) == (
        25,
        10,
        16,
    )
    assert len(result.Records) == 26 and result.Ordinary is None
    integral_tokens = (
        raw.replace(b":0.0", b":0")
        .replace(b":1.0", b":1")
        .replace(b":2.0", b":2")
        .replace(b":3.0", b":3")
        .replace(b":6.0", b":6")
        .replace(b":12.0", b":12")
    )
    assert isinstance(r.validate_room_ndjson(integral_tokens), r.RoomRunValidated)


@pytest.mark.parametrize("count", [2, 12, 25])
def test_fault_controls_bind_validated_ordinary(count: int) -> None:
    ordinary, raw = ndjson(synthetic_room_records()), ndjson(control_records(count))
    result = r.validate_room_ndjson(raw, mode=f"fault-{count}", ordinary_raw=ordinary)
    assert isinstance(result, r.RoomRunValidated)
    assert (result.CheckedCheckpoints, result.FiniteRows, result.ZetaRows) == (
        count,
        0,
        0,
    )
    assert result.Ordinary is not None and result.Ordinary.Raw == ordinary
    assert (
        result.Raw.splitlines(keepends=True)[:count]
        == ordinary.splitlines(keepends=True)[:count]
    )


def test_invalid_control_zero_checkpoint_content_only() -> None:
    result = r.validate_room_ndjson(
        ndjson(control_records(0, "InvalidControlArguments")), mode="invalid-control"
    )
    assert isinstance(result, r.RoomRunValidated) and result.CheckedCheckpoints == 0


@pytest.mark.parametrize(
    "field,value",
    [
        ("Sequence", True),
        ("Sequence", 1.0),
        ("Id", "Q"),
        ("Category", "Other"),
        ("Extra", 0),
    ],
)
def test_exact_checkpoint_metadata(field: str, value: object) -> None:
    rows = synthetic_room_records()
    rows[0][field] = value
    failure = refused(ndjson(rows))
    assert failure.CheckedCheckpoints == 0 and len(failure.Records) == 1
    assert failure.CaseId == "GaussianProjection/P"


@pytest.mark.parametrize(
    "mutation",
    ["lost", "reordered", "duplicated", "after-terminal", "missing-terminal"],
)
def test_fixed_journal_roster_and_prefix(mutation: str) -> None:
    rows = synthetic_room_records()
    expected = {
        "lost": 4,
        "reordered": 0,
        "duplicated": 13,
        "after-terminal": 25,
        "missing-terminal": 25,
    }[mutation]
    if mutation == "lost":
        del rows[4]
    elif mutation == "reordered":
        rows[0], rows[1] = rows[1], rows[0]
    elif mutation == "duplicated":
        rows.insert(13, rows[12])
    elif mutation == "after-terminal":
        rows.append({"Kind": "checkpoint"})
    else:
        rows.pop()
    assert refused(ndjson(rows)).CheckedCheckpoints == expected


@pytest.mark.parametrize(
    "field,value",
    [
        ("Complete", False),
        ("Complete", 1),
        ("ObservedCheckpointCount", 24),
        ("WrittenCheckpointCount", True),
        ("Failure", "InjectedCheckpointFailure"),
        ("PendingCheckpoint", {}),
        ("PendingCheckpointOmission", {"Sequence": 26}),
        ("Receipt", None),
    ],
)
def test_complete_terminal_exactness(field: str, value: object) -> None:
    rows = synthetic_room_records()
    rows[-1][field] = value
    failure = refused(ndjson(rows))
    assert failure.CheckedCheckpoints == 25 and len(failure.Records) == 26


@pytest.mark.parametrize("row", [1, 3, 5])
def test_attention_full_report_differs_even_when_sets_match(row: int) -> None:
    rows = synthetic_room_records()
    rows[-1]["Receipt"]["ZetaObservations"]["BudgetAndPriority"][row][
        "SameBudgetReportAsDirect"
    ] = True
    assert "SameBudgetReportAsDirect" in refused(ndjson(rows)).Path


def test_false_vision_calibration_and_priority_posterior() -> None:
    rows = synthetic_room_records()
    rows[19]["Value"]["VisionConfidence"] = 0.25
    assert "VisionConfidence" in refused(ndjson(rows)).Path
    rows = synthetic_room_records()
    rows[-1]["Receipt"]["ZetaObservations"]["BudgetAndPriority"][3][
        "BoardedPosteriorMass"
    ] = wire(1, 2)
    assert "BoardedPosteriorMass" in refused(ndjson(rows)).Path
    rows = synthetic_room_records()
    rows[19]["Value"]["PosteriorShares"] = vector((1, 4), (3, 4))
    assert "PosteriorShares" in refused(ndjson(rows)).Path


def test_consensus_precision_not_independence() -> None:
    rows = synthetic_room_records()
    rows[3]["Value"]["ProvenanceEnforcedByApi"] = True
    assert "ProvenanceEnforcedByApi" in refused(ndjson(rows)).Path
    rows = synthetic_room_records()
    rows[3]["Value"]["Outcome"] = "Undecided"
    assert "Outcome" in refused(ndjson(rows)).Path


def test_soft_probability_sum_max_and_terminal_binding() -> None:
    rows = synthetic_room_records()
    rows[4]["Value"]["Posterior"][0] = -1e-15
    assert "Posterior" in refused(ndjson(rows)).Path
    rows = synthetic_room_records()
    rows[4]["Value"]["Posterior"] = [8e-13, 0.5 + 8e-13, 8e-13, 0.5 + 8e-13, 8e-13]
    rows[4]["Value"]["MaximumMass"] = 0.5 + 8e-13
    assert "sum" in refused(ndjson(rows)).Message
    rows = synthetic_room_records()
    rows[4]["Value"]["Posterior"] = [8e-13, 0.5 - 8e-13, 8e-13, 0.5 - 8e-13, 0.0]
    rows[4]["Value"]["MaximumMass"] = 0.5 + 8e-13
    assert "maximum" in refused(ndjson(rows)).Message
    rows = synthetic_room_records()
    terminal = rows[-1]["Receipt"]["ZetaObservations"]["SoftValueConditioning"][1][
        "Outcome"
    ]
    terminal["Posterior"][1] += 5e-13
    terminal["Posterior"][3] -= 5e-13
    failure = refused(ndjson(rows))
    assert failure.CheckedCheckpoints == 25 and "checkpoint/receipt" in failure.Message
    rows = synthetic_room_records()
    rows[11]["Value"]["Outcome"]["Posterior"].pop()
    failure = refused(ndjson(rows))
    assert (
        failure.CheckedCheckpoints == 11
        and failure.CaseId == "SoftValueConditioning/Q/tail"
    )


def test_exact_finite_and_runtime_metadata() -> None:
    rows = synthetic_room_records()
    rows[-1]["Receipt"]["FiniteReference"]["Distributions"][0]["ActionIndex"] = True
    assert "ActionIndex" in refused(ndjson(rows)).Path
    rows = synthetic_room_records()
    rows[-1]["Receipt"]["Runtime"]["CompleteRuntimeClosureAdmitted"] = True
    assert "CompleteRuntimeClosureAdmitted" in refused(ndjson(rows)).Path
    rows = synthetic_room_records()
    rows[-1]["Receipt"]["Runtime"]["LoadedAssemblies"][0]["Bytes"] = True
    assert "Bytes" in refused(ndjson(rows)).Path


@pytest.mark.parametrize(
    "field,value",
    [
        ("Receipt", {}),
        ("Failure", "ZeroEvidence"),
        ("WrittenCheckpointCount", 1),
        ("PendingCheckpoint", {}),
        ("Complete", True),
    ],
)
def test_bad_fault_terminal_not_prefix_success(field: str, value: object) -> None:
    rows = control_records(2)
    rows[-1][field] = value
    failure = refused(
        ndjson(rows), mode="fault-2", ordinary_raw=ndjson(synthetic_room_records())
    )
    assert failure.CheckedCheckpoints == 2 and isinstance(
        failure.Ordinary, r.RoomRunValidated
    )


def test_fault_prefix_raw_identity_and_ordinary_validity() -> None:
    ordinary, control = ndjson(synthetic_room_records()), ndjson(control_records(2))
    failure = refused(b" " + control, mode="fault-2", ordinary_raw=ordinary)
    assert failure.Code == "OrdinaryPrefixMismatch" and failure.CheckedCheckpoints == 0
    assert isinstance(r.validate_room_ndjson(b" " + ordinary), r.RoomRunValidated)
    assert (
        refused(control, mode="fault-2", ordinary_raw=b" " + ordinary).Code
        == "OrdinaryPrefixMismatch"
    )
    failure = refused(control, mode="fault-2", ordinary_raw=None)
    assert failure.Code == "InvalidOrdinary" and isinstance(
        failure.Ordinary, r.RoomRunRefused
    )
    invalid = synthetic_room_records()
    invalid[-1]["Complete"] = False
    failure = refused(control, mode="fault-2", ordinary_raw=ndjson(invalid))
    assert failure.CheckedCheckpoints == 0 and isinstance(
        failure.Ordinary, r.RoomRunRefused
    )
    assert failure.Ordinary.CheckedCheckpoints == 25


@pytest.mark.parametrize(
    "replacement,code",
    [
        (b"NaN", "NonFiniteJson"),
        (b"Infinity", "NonFiniteJson"),
        (b"-Infinity", "NonFiniteJson"),
        (b"1e999", "NonFiniteJson"),
        (b"-0", "ContentMismatch"),
    ],
)
def test_nonfinite_and_signed_zero_numeric(replacement: bytes, code: str) -> None:
    raw = ndjson(synthetic_room_records()).replace(
        b'"Mean":0.0', b'"Mean":' + replacement, 1
    )
    assert refused(raw).Code == code


def test_lexical_negative_zero_integer_counter() -> None:
    raw = ndjson(control_records(0, "InvalidControlArguments")).replace(
        b'"WrittenCheckpointCount":0', b'"WrittenCheckpointCount":-0'
    )
    assert refused(raw, mode="invalid-control").Code == "ContentMismatch"


def test_strict_json_utf8_duplicate_surrogate_depth() -> None:
    normal = ndjson(synthetic_room_records())
    duplicate = normal.replace(
        b'{"Kind":"checkpoint",', b'{"Kind":"checkpoint","Kind":"checkpoint",', 1
    )
    assert refused(duplicate).Code == "DuplicateKey"
    lines = normal.splitlines(keepends=True)
    lines[-1] = lines[-1].replace(
        b'"Complete":true', b'"Complete":true,"Complete":true'
    )
    failure = refused(b"".join(lines))
    assert (
        failure.Code == "DuplicateKey"
        and failure.CheckedCheckpoints == 25
        and len(failure.Records) == 25
    )
    assert (
        refused(normal.replace(b'"Id":"P"', b'"Id":"\\ud800"', 1)).Code
        == "InvalidUnicode"
    )
    assert refused(b"\xff\n").Code == "InvalidJson"
    assert refused(b'{"x":' + b"[" * 10000 + b"0" + b"]" * 10000 + b"}\n").Code in (
        "InvalidJson",
        "MissingCheckpoint",
    )


def test_exact_bounds_and_closed_lines() -> None:
    normal = ndjson(synthetic_room_records())
    lines = normal.splitlines(keepends=True)
    at_limit = lines.copy()
    at_limit[0] = at_limit[0][:-1] + b" " * (65536 - len(at_limit[0])) + b"\n"
    assert len(at_limit[0]) == 65536
    assert isinstance(r.validate_room_ndjson(b"".join(at_limit)), r.RoomRunValidated)
    assert refused(b" " + b"".join(at_limit)).Code == "LineBound"
    padded = lines.copy()
    remaining = 1048576 - sum(map(len, padded))
    for i in range(len(padded)):
        count = min(remaining, 65536 - len(padded[i]))
        padded[i] = padded[i][:-1] + b" " * count + b"\n"
        remaining -= count
    assert remaining == 0 and len(b"".join(padded)) == 1048576
    assert isinstance(r.validate_room_ndjson(b"".join(padded)), r.RoomRunValidated)
    assert refused(b" " + b"".join(padded)).Code == "ByteBound"
    assert refused(normal[:-1]).Code == "UnterminatedLine"
    assert refused(b"{}\n" * 66).Code == "MissingCheckpoint"
    assert refused(b"\n").Code == "InvalidJson"
    assert refused(b"").Code == "ByteBound"
    assert refused(None).Code == "InvalidBytes"
    assert isinstance(
        r.validate_room_ndjson(normal.replace(b"\n", b"\r\n")), r.RoomRunValidated
    )


def test_invalid_mode_and_irrelevant_ordinary_refuse() -> None:
    normal = ndjson(synthetic_room_records())
    assert refused(normal, mode="other").Code == "InvalidMode"
    assert refused(normal, ordinary_raw=normal).Code == "UnexpectedOrdinary"


def test_missing_field_reports_exact_first_location() -> None:
    rows = synthetic_room_records()
    del rows[0]["Value"]["Mean"]
    failure = refused(ndjson(rows))
    assert failure.Path == "Lines[0].Value.Mean" and failure.CheckedCheckpoints == 0
    rows = synthetic_room_records()
    del rows[-1]["Failure"]
    failure = refused(ndjson(rows))
    assert failure.Path == "Lines[25].Failure" and failure.CheckedCheckpoints == 25


@pytest.mark.parametrize("suffix", ["unterminated-terminal", "late-excess-lines"])
def test_late_framing_retains_validated_checkpoint_prefix(suffix: str) -> None:
    normal = ndjson(synthetic_room_records())
    raw = normal[:-1] if suffix == "unterminated-terminal" else normal + b"{}\n" * 40
    failure = refused(raw)
    assert failure.CheckedCheckpoints == 25
    assert len(failure.Records) == (25 if suffix == "unterminated-terminal" else 27)
    assert failure.Code == (
        "UnterminatedLine" if suffix == "unterminated-terminal" else "AfterTerminal"
    )


def test_type_selected_assembly_observations_repeat_core_exactly() -> None:
    import copy

    rows = synthetic_room_records()
    loaded = rows[-1]["Receipt"]["Runtime"]["LoadedAssemblies"]
    loaded[2] = copy.deepcopy(loaded[0])
    assert isinstance(r.validate_room_ndjson(ndjson(rows)), r.RoomRunValidated)
    loaded[2]["Sha256"] = "1" * 64
    failure = refused(ndjson(rows))
    assert failure.Path.endswith(".LoadedAssemblies[2].Sha256")
