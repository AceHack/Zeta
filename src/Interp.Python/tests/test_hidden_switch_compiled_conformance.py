from __future__ import annotations

import copy
import hashlib
from dataclasses import dataclass
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_conformance as c
from zeta_interp import hidden_switch_compiled_ieee as s


def _artifact(name: str) -> dict[str, Any]:
    digest = hashlib.sha256(b"{}").hexdigest().upper()
    return {
        "File": name,
        "Bytes": 2,
        "Sha256": digest,
        "Encoding": "identity",
        "StoredBytes": 2,
        "StoredSha256": digest,
    }


def _records() -> list[dict[str, Any]]:
    return [
        {
            "Index": index,
            "CaseId": spec.CaseId,
            "ControlId": spec.ControlId,
            "Inputs": [
                {
                    "Role": role,
                    "Artifact": _artifact(f"case-{index}/input-{ordinal}.json"),
                }
                for ordinal, role in enumerate(spec.InputRoles)
            ],
            "Calls": [
                {
                    "Sequence": ordinal,
                    "Operation": call.Operation,
                    "InputRoles": list(call.InputRoles),
                    "ResultArtifact": _artifact(f"case-{index}/result-{ordinal}.json"),
                }
                for ordinal, call in enumerate(spec.Calls)
            ],
        }
        for index, spec in enumerate(c.case_specs())
    ]


def _run(
    records: list[dict[str, Any]],
    *,
    complete: object = True,
    cases: object = 92,
    calls: object = 136,
) -> a.Admitted[c.CasePrefix] | c.CasePrefixRefused:
    return c.admit_case_prefix(
        records, {"Cases": cases, "Calls": calls}, complete=complete
    )


def test_reviewed_group_order_call_counts_and_control_dependencies() -> None:
    specs = c.case_specs()
    groups: dict[str, tuple[int, int]] = {}
    seen: set[str] = set()
    for spec in specs:
        group = spec.CaseId.split("/")[0]
        cases, calls = groups.get(group, (0, 0))
        groups[group] = (cases + 1, calls + len(spec.Calls))
        assert spec.ControlId is None or spec.ControlId in seen
        assert spec.CaseId not in seen
        seen.add(spec.CaseId)
    assert list(groups.items()) == [
        ("certificate", (31, 62)),
        ("semantic", (1, 1)),
        ("selector", (1, 1)),
        ("json", (8, 8)),
        ("artifact", (7, 8)),
        ("source", (7, 7)),
        ("python", (8, 8)),
        ("storage", (5, 9)),
        ("links", (8, 8)),
        ("choice", (5, 10)),
        ("schedule", (5, 5)),
        ("resources", (6, 9)),
    ]
    assert len(specs) == 92 and sum(len(spec.Calls) for spec in specs) == 136
    result = _run(_records())
    assert isinstance(result, a.Admitted), result
    assert result.value == c.CasePrefix(92, 136, 92)
    assert result.value.OutcomeReplay == "not-performed"


@pytest.mark.parametrize("index", [0, 30, 31, 32, 40, 47, 54, 62, 67, 75, 80, 85, 91])
def test_every_boundary_preserves_first_failed_case_and_call_prefix(index: int) -> None:
    records = _records()[: index + 1]
    specs = c.case_specs()
    prior_calls = sum(len(row.Calls) for row in specs[:index])
    records[-1]["Calls"] = records[-1]["Calls"][:1]
    result = _run(records, complete=False, cases=index, calls=prior_calls + 1)
    assert isinstance(result, a.Admitted), result
    assert result.value == c.CasePrefix(index, prior_calls + 1, index + 1)
    # The returned call does not itself promote the failed case to completion.
    records[-1]["Calls"][0]["ResultArtifact"]["Sha256"] = "wrong"
    failed = _run(records, complete=False, cases=index, calls=prior_calls + 1)
    assert isinstance(failed, c.CasePrefixRefused)
    assert failed.CheckedRows == index and failed.CheckedCalls == prior_calls


def test_failure_before_first_case_after_all_cases_and_with_no_returned_call() -> None:
    assert isinstance(_run([], complete=False, cases=0, calls=0), a.Admitted)
    assert isinstance(_run(_records(), complete=False), a.Admitted)
    records = _records()[:1]
    records[0]["Calls"] = []
    result = _run(records, complete=False, cases=0, calls=0)
    assert isinstance(result, a.Admitted) and result.value.RetainedCaseRows == 1


@pytest.mark.parametrize(
    "cases,calls,complete",
    [
        (True, 136, True),
        (92, 136.0, True),
        (92, 136, 1),
        (91, 135, True),
        (93, 136, False),
        (92, 137, False),
    ],
)
def test_counter_and_completion_domains_refuse_aliases(
    cases: object, calls: object, complete: object
) -> None:
    assert isinstance(
        _run(_records(), cases=cases, calls=calls, complete=complete),
        c.CasePrefixRefused,
    )


@pytest.mark.parametrize(
    "kind",
    [
        "case-id",
        "control",
        "index",
        "sequence",
        "operation",
        "role-order",
        "extra-field",
        "missing-call",
        "extra-call",
        "missing-input",
    ],
)
def test_last_case_cannot_rename_or_rewrite_the_fixed_operation_contract(
    kind: str,
) -> None:
    records = _records()
    row = records[-1]
    if kind == "case-id":
        row["CaseId"] = "resources/arbitrary-operation"
    elif kind == "control":
        row["ControlId"] = "resources/half-threshold"
    elif kind == "index":
        row["Index"] = 91.0
    elif kind == "sequence":
        row["Calls"][1]["Sequence"] = True
    elif kind == "operation":
        row["Calls"][1]["Operation"] = "eval"
    elif kind == "role-order":
        row["Calls"][1]["InputRoles"].reverse()
    elif kind == "extra-field":
        row["Calls"][1]["Passed"] = True
    elif kind == "missing-call":
        row["Calls"].pop()
    elif kind == "extra-call":
        row["Calls"].append(copy.deepcopy(row["Calls"][-1]))
    else:
        row["Inputs"].pop()
    result = _run(records)
    assert isinstance(result, c.CasePrefixRefused)
    assert result.CheckedRows == 91
    assert result.CheckedCalls in (134, 135)


def test_last_returned_call_prefix_is_counted_before_later_failure() -> None:
    records = _records()
    records[-1]["Calls"][1]["ResultArtifact"]["File"] = "../outside.json"
    result = _run(records)
    assert isinstance(result, c.CasePrefixRefused)
    assert (result.CheckedRows, result.CheckedCalls) == (91, 135)
    records = _records()
    result = _run(records, complete=False, calls=135)
    assert isinstance(result, c.CasePrefixRefused)
    assert result.code == "case-counts" and result.CheckedCalls == 136


def test_case_with_no_returned_result_cannot_be_counted_complete() -> None:
    records = _records()[:1]
    records[0]["Calls"] = records[0]["Calls"][:1]
    result = _run(records, complete=False, cases=1, calls=1)
    assert isinstance(result, c.CasePrefixRefused) and result.code == "case-calls"


@dataclass(frozen=True)
class NestedResult:
    Prefix: tuple[int, bool, bytes]
    Failure: a.Refused


def test_public_result_tree_retains_actual_types_and_all_nested_fields() -> None:
    actual = s.Success(
        NestedResult((0, False, b"\x00\xff"), a.Refused("code", "path", "detail"))
    )
    encoded = c.result_tree(actual)
    assert isinstance(encoded, a.Admitted), encoded
    assert encoded.value == {
        "Type": "zeta_interp.hidden_switch_compiled_ieee.Success",
        "Fields": {
            "value": {
                "Type": __name__ + ".NestedResult",
                "Fields": {
                    "Prefix": [0, False, {"BytesHex": "00FF"}],
                    "Failure": {
                        "Type": "zeta_interp.hidden_switch_compiled_admission.Refused",
                        "Fields": {"code": "code", "path": "path", "detail": "detail"},
                    },
                },
            }
        },
    }
    # Labels remain data, never imported/instantiated by the encoder.
    supplied = {"Type": "os.system", "Fields": {"command": "not executed"}}
    observed = c.result_tree(supplied)
    assert isinstance(observed, a.Admitted) and observed.value == supplied


@pytest.mark.parametrize(
    "bad", [object(), float("nan"), float("inf"), {1: "x"}, "\ud800", NestedResult]
)
def test_unserializable_result_is_a_refusal_not_stringified(bad: object) -> None:
    assert isinstance(c.result_tree(bad), a.Refused)


def test_shared_acyclic_objects_are_allowed_but_cycles_and_excess_depth_refuse() -> (
    None
):
    child = [1, 2]
    assert isinstance(c.result_tree([child, child]), a.Admitted)
    cycle: list[Any] = []
    cycle.append(cycle)
    result = c.result_tree(cycle)
    assert isinstance(result, a.Refused) and result.code == "result-cycle"
    value: Any = None
    for _ in range(130):
        value = [value]
    result = c.result_tree(value)
    assert isinstance(result, a.Refused) and result.code == "result-size"
