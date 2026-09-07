"""Exact certificate witnesses and adversarial hand mutations; no source tapes."""

import copy
from dataclasses import replace
from fractions import Fraction as F

import pytest
from zeta_interp import hidden_switch_compiled_certificate as c
from zeta_interp import hidden_switch_compiled_ieee as s

BINDINGS = {"ProtocolSha256": c.PROTOCOL_SHA256, "hand/source.py": "A" * 64}


def value[T](result: s.Result[T]) -> T:
    assert isinstance(result, s.Success), result
    return result.value


def rational(raw) -> F:
    return F(int(raw["Num"]), int(raw["Den"]))


@pytest.fixture(scope="module")
def certificate():
    return value(c.build_certificate(BINDINGS))


def test_complete_ordered_contingent_roster_including_duplicates():
    for effect in (True, False):
        for depth, count, child_count in ((1, 2, 0), (2, 8, 2), (3, 128, 8)):
            vectors = value(c.alpha_vectors(effect, depth))
            assert len(vectors) == count
            assert [a.Action for a in vectors] == [0] * (count // 2) + [1] * (
                count // 2
            )
            if child_count:
                expected = [
                    (action, zero, one)
                    for action in (0, 1)
                    for zero in range(child_count)
                    for one in range(child_count)
                ]
                assert [
                    (a.Action, a.ZeroChild, a.OneChild) for a in vectors
                ] == expected
            else:
                assert [a.Values for a in vectors] == [
                    (F(0), F(1)),
                    (F(-1, 4), F(-1, 4)),
                ]
    depth2 = value(c.alpha_vectors(True, 2))
    assert depth2[0].Values == (F(1, 8), F(15, 8))
    assert depth2[1].Values == (F(-3, 64), F(67, 64))
    assert depth2[3].Values == (F(-1, 4), F(3, 4))
    assert depth2[4].Values == (F(5, 8), F(-1, 8))
    assert depth2[7].Values == (F(-1, 2), F(-1, 2))
    depth3 = value(c.alpha_vectors(True, 3))
    assert len({a.Values for a in depth3}) < len(depth3)


@pytest.mark.parametrize(
    ("effect", "depth", "prior", "expected"),
    [
        (True, 3, F(0), (F(39, 64), F(45, 32))),
        (True, 3, F(1), (F(85, 32), F(23, 64))),
        (False, 3, F(0), (F(11, 32), F(3, 32))),
        (False, 3, F(1), (F(85, 32), F(45, 32))),
        (True, 2, F(1, 5), (F(19, 40), F(19, 40))),
    ],
)
def test_independent_hidden_state_expectations(effect, depth, prior, expected):
    assert value(c.oracle_q(prior, effect, depth)) == expected


def test_all_endpoint_margins_and_full_domain_gaps(certificate):
    assert [(m["Effect"], m["Depth"]) for m in certificate["Models"]] == [
        (e, d) for e in (True, False) for d in (1, 2, 3)
    ]
    for model in certificate["Models"]:
        for action in (0, 1):
            pieces = [p for p in model["Envelopes"] if p["Action"] == action]
            assert rational(pieces[0]["Left"]) == 0
            assert rational(pieces[-1]["Right"]) == 1
            for piece in pieces:
                assert all(rational(x) >= 0 for x in piece["EndpointMargins"])
                # There is one margin per endpoint and per complete root roster.
                assert len(piece["EndpointMargins"]) == len(model["Candidates"])
        assert all(rational(g["Slope"]) < 0 for g in model["GapPieces"])
    assert [rational(d["Error"]) for d in certificate["Bounds"]["Depths"]] == [
        F(0),
        F(266, 1 << 48),
        F(1592, 1 << 48),
    ]
    assert [rational(d["Rho"]) for d in certificate["Bounds"]["Depths"]] == [
        F(1, 1 << 48),
        F(533, 1 << 48),
        F(3185, 1 << 48),
    ]


def test_inward_guards_and_neighbors_checked_as_exact_rationals(certificate):
    admitted = value(c.verify_certificate(certificate, BINDINGS))
    for row, guard in zip(certificate["Guards"], admitted.Guards):
        read = lambda field, row=row: value(
            s.exact_fraction(value(s.parse_bits(row[field])))
        )
        assert read("SmaxBits") < rational(row["Rminus"]) <= read("SnextBits")
        assert read("HprevBits") < rational(row["Rplus"]) <= read("HminBits")
        assert guard.SmaxBits < guard.HminBits
    assert c._admitted(admitted) is admitted
    forged = replace(admitted, EpsilonBits=0)
    refusal = s._capture(lambda: c._admitted(forged))
    assert isinstance(refusal, s.Failure)


@pytest.mark.parametrize(
    "mutation",
    [
        "extra",
        "source",
        "epsilon",
        "model",
        "expression",
        "missing-candidate",
        "reorder",
        "candidate-value",
        "bool-index",
        "missing-interval",
        "margin",
        "rho",
        "guard",
        "strictness",
        "noncanonical-rational",
    ],
)
def test_named_certificate_mutations_refuse(certificate, mutation):
    raw = copy.deepcopy(certificate)
    if mutation == "extra":
        raw["Passed"] = True
    elif mutation == "source":
        raw["Bindings"]["hand/source.py"] = "B" * 64
    elif mutation == "epsilon":
        raw["Model"]["EpsilonBits"] = "0000000000000000"
    elif mutation == "model":
        raw["Model"]["Drift"] = {"Num": "1", "Den": "4"}
    elif mutation == "expression":
        raw["ExpressionGraph"][9] = "immediate+(zero+one)"
    elif mutation == "missing-candidate":
        raw["Models"][2]["Candidates"].pop()
    elif mutation == "reorder":
        raw["Models"][2]["Candidates"].reverse()
    elif mutation == "candidate-value":
        raw["Models"][2]["Candidates"][0]["Values"][0] = {"Num": "0", "Den": "1"}
    elif mutation == "bool-index":
        raw["Models"][0]["Candidates"][0]["Index"] = False
    elif mutation == "missing-interval":
        raw["Models"][2]["Envelopes"].pop()
    elif mutation == "margin":
        raw["Models"][2]["Envelopes"][0]["EndpointMargins"][0] = {
            "Num": "1",
            "Den": "1",
        }
    elif mutation == "rho":
        raw["Bounds"]["Depths"][1]["Rho"] = {"Num": "532", "Den": str(1 << 48)}
    elif mutation == "guard":
        raw["Guards"][0]["SmaxBits"] = raw["Guards"][0]["HminBits"]
    elif mutation == "strictness":
        raw["Guards"][0]["Relations"][0] = "Smax<=Rminus<Snext"
    elif mutation == "noncanonical-rational":
        raw["Model"]["Drift"] = {"Num": "2", "Den": "16"}
    assert isinstance(c.verify_certificate(raw, BINDINGS), s.Failure), mutation


def test_public_invalid_inputs_return_typed_refusals():
    for bindings in (
        None,
        {},
        {"ProtocolSha256": "A" * 64},
        {"ProtocolSha256": c.PROTOCOL_SHA256, "bad": True},
    ):
        assert isinstance(c.build_certificate(bindings), s.Failure)
    for effect, depth in ((1, 1), (True, True), (False, 0), (False, 4)):
        assert isinstance(c.alpha_vectors(effect, depth), s.Failure)
    for prior in (0.5, True, F(-1), F(2)):
        assert isinstance(c.oracle_q(prior, True, 3), s.Failure)
    for raw in (None, [], {}, True):
        assert isinstance(c.verify_certificate(raw, BINDINGS), s.Failure)
