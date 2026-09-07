"""Pure outer-conformance witnesses, distinct from complete envelope admission.

The supplied-Q witness checks actual retained selector outputs against the
independent binary64 selector. It does not execute native code, open artifacts,
admit an executing graph or certify a whole negative-conformance envelope.
"""

from __future__ import annotations

from dataclasses import dataclass

from . import hidden_switch_compiled_certificate as c
from . import hidden_switch_compiled_ieee as s
from . import hidden_switch_compiled_reference as r
from . import hidden_switch_compiled_replay as replay


@dataclass(frozen=True, slots=True)
class SelectorTieReplay:
    NumericCertificateSha256: str
    QBits: tuple[str, str]
    DifferenceBits: str
    ActualAction: int
    MutantAction: int
    MutantRefusalCode: str
    Scope: str = "one-supplied-q-strict-epsilon-witness"
    NativeExecutionAndOuterAdmission: str = "not-performed-by-pure-witness-replay"


def _selection(action: object, expected: int) -> s.Result[int]:
    if type(action) is not int or action != expected:
        return s.Failure(
            "SelectorAction", "action differs from independent strict selection"
        )
    return s.Success(action)


def replay_selector_tie(
    witness: object, certificate: object
) -> s.Result[SelectorTieReplay]:
    """Replay the positive strict tie and reject its executed >= mutation.

    Both native outputs must be supplied by the actual source-reviewed witness.
    The independent selector is called on the retained Q inputs; the same
    action-checking boundary is applied to actual and mutant outputs. A forged
    numeric certificate or a mutant that does not differ cannot earn coverage.
    """

    def operation() -> SelectorTieReplay:
        admitted = c._admitted(certificate)
        row = replay._object(
            witness, {"Input", "ActualAction", "Mutation"}, "SelectorWitness"
        )
        input_row = replay._object(row["Input"], {"QBits"}, "SelectorWitness.Input")
        zero_text, epsilon_text = "0000000000000000", f"{admitted.EpsilonBits:016X}"
        expected_q: list[c.Json] = [zero_text, epsilon_text]
        retained_q = replay._array(input_row["QBits"], 2, "SelectorWitness.Input.QBits")
        replay._same(expected_q, retained_q, "SelectorWitness.Input.QBits")
        bits = tuple(
            replay._need(s.parse_bits(value), f"SelectorWitness.Input.QBits[{index}]")
            for index, value in enumerate(retained_q)
        )
        difference = replay._need(s.sub(bits[1], bits[0]), "SelectorWitness.Difference")
        comparison = replay._need(
            s.compare(difference, admitted.EpsilonBits), "SelectorWitness.Comparison"
        )
        strict = replay._need(r.select_bits(bits), "SelectorWitness.Reference")
        if comparison != 0 or strict != 0:
            raise s._Refusal(
                "SelectorControl",
                "positive control must be an exact strict tie selecting harvest",
            )
        actual = replay._need(
            _selection(row["ActualAction"], strict), "SelectorWitness.ActualAction"
        )
        mutation = replay._object(
            row["Mutation"], {"Kind", "Action"}, "SelectorWitness.Mutation"
        )
        replay._same(
            "inclusive-epsilon-comparison",
            mutation["Kind"],
            "SelectorWitness.Mutation.Kind",
        )
        mutant = int(comparison >= 0)
        replay._same(mutant, mutation["Action"], "SelectorWitness.Mutation.Action")
        refused = _selection(mutation["Action"], strict)
        if not isinstance(refused, s.Failure):
            raise s._Refusal(
                "SelectorMutantVacuity",
                "the supplied mutation must fail the same strict action boundary",
            )
        return SelectorTieReplay(
            admitted.NumericSha256,
            (zero_text, epsilon_text),
            f"{difference:016X}",
            actual,
            mutant,
            refused.Code,
        )

    return s._capture(operation)
