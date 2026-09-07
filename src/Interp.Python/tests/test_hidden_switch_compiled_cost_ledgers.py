from __future__ import annotations

from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_cost_ledgers as ledgers
from zeta_interp import hidden_switch_compiled_schedule as schedule


def _stamp(seconds: int) -> str:
    return (datetime(2026, 9, 7, tzinfo=UTC) + timedelta(seconds=seconds)).isoformat()


def _fixture() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    headers = [asdict(row) for row in schedule.cost_schedule()]
    rows: list[dict[str, Any]] = []
    for index, header in enumerate(headers):
        native = header["Strategy"] == "native-recursive"
        rows.append(
            {
                "Index": index,
                "StartedAtUtc": _stamp(2 * index + 1),
                "FinishedAtUtc": _stamp(2 * index + 2),
                "Timing": {
                    "WallNs": 100 if native else 50,
                    "CpuNs": 0,
                    "AllocatedBytes": 200 if native else 100,
                    "GcBefore": [2 * index, 0, 0],
                    "GcAfter": [2 * index + 1, 0, 0],
                    "GcDelta": [1, 0, 0],
                },
            }
        )
    return headers, rows


def _run(
    headers: object,
    rows: object,
    *,
    start: object = _stamp(0),
    end: object = _stamp(101),
) -> a.Admitted[ledgers.CostLedgerReplay] | ledgers.CostLedgerRefused:
    return ledgers.admit_cost_ledgers(
        headers, rows, prelude_finished_at_utc=start, cost_finished_at_utc=end
    )


def _accepted(
    result: a.Admitted[ledgers.CostLedgerReplay] | ledgers.CostLedgerRefused,
) -> ledgers.CostLedgerReplay:
    assert isinstance(result, a.Admitted), result
    return result.value


def _ratio(
    result: ledgers.CostLedgerReplay, mode: str, panel: str, metric: str
) -> ledgers.CostRatio:
    found = [
        row
        for row in result.Ratios
        if (row.Mode, row.Panel, row.Metric) == (mode, panel, metric)
    ]
    assert len(found) == 1
    return found[0]


def test_complete_schedule_exact_halves_and_partial_scope() -> None:
    result = _accepted(_run(*_fixture()))
    assert result.CompletedRows == 50
    assert len(result.Ratios) == 15
    assert sum(row.Required for row in result.Ratios) == 4
    assert result.RequiredCostCondition == "met"
    assert result.Scope == "fifty-cost-ledger-projections-only"
    assert result.OutputBoundaryAndRuntimeAdmission.startswith("not-performed")
    wall = _ratio(result, "ordinary-choice", "effective", "WallNs")
    assert wall.Ratio == ledgers.RationalPair(50, 100)
    assert wall.AtMostHalf is True
    assert wall.Reason is None
    # UTC intervals are one second; the independent monotonic ledger is 100 ns.
    # No equality between those clock domains is asserted by the protocol.


@pytest.mark.parametrize("index", range(50))
def test_every_ledger_position_is_checked_and_retains_prefix(index: int) -> None:
    headers, rows = _fixture()
    rows[index]["Timing"]["AllocatedBytes"] = True
    result = _run(headers, rows)
    assert isinstance(result, ledgers.CostLedgerRefused)
    assert result.CompletedRows == index
    assert result.path == f"Ledgers[{index}].Timing.AllocatedBytes"


@pytest.mark.parametrize("count", [0, 49, 51])
def test_no_truncated_or_extra_ledger_roster(count: int) -> None:
    headers, rows = _fixture()
    actual = (rows + [rows[-1]])[:count]
    result = _run(headers, actual)
    assert isinstance(result, ledgers.CostLedgerRefused)
    assert result.code == "ledger-roster" and result.CompletedRows == 0


@pytest.mark.parametrize("value", [True, 17.0, "17", 18, -1])
def test_exact_index_not_coercion(value: object) -> None:
    headers, rows = _fixture()
    rows[17]["Index"] = value
    result = _run(headers, rows)
    assert isinstance(result, ledgers.CostLedgerRefused)
    assert result.CompletedRows == 17 and result.path == "Ledgers[17].Index"


def test_exact_fields_schedule_and_restamped_order() -> None:
    headers, rows = _fixture()
    rows[17]["Passed"] = True
    result = _run(headers, rows)
    assert isinstance(result, ledgers.CostLedgerRefused)
    assert result.CompletedRows == 17 and result.code == "fields"
    headers, rows = _fixture()
    headers[1], headers[2] = headers[2], headers[1]
    headers[1]["Index"], headers[2]["Index"] = 1, 2
    result = _run(headers, rows)
    assert isinstance(result, ledgers.CostLedgerRefused)
    assert result.CompletedRows == 0 and result.code == "schedule-value"
    headers, rows = _fixture()
    rows[17], rows[18] = rows[18], rows[17]
    rows[17]["Index"], rows[18]["Index"] = 17, 18
    result = _run(headers, rows)
    assert isinstance(result, ledgers.CostLedgerRefused)
    assert result.CompletedRows == 18 and result.code == "ledger-chronology"


def test_prelude_end_phase_end_and_overlap() -> None:
    headers, rows = _fixture()
    for start, end, prefix in [
        (_stamp(2), _stamp(101), 0),
        (_stamp(0), _stamp(99), 49),
    ]:
        result = _run(headers, rows, start=start, end=end)
        assert isinstance(result, ledgers.CostLedgerRefused)
        assert result.CompletedRows == prefix and result.code == "ledger-chronology"
    rows[17]["StartedAtUtc"] = rows[16]["StartedAtUtc"]
    result = _run(headers, rows)
    assert isinstance(result, ledgers.CostLedgerRefused)
    assert result.CompletedRows == 17


def test_submicrosecond_overlap_is_not_rounded_away() -> None:
    headers, rows = _fixture()
    rows[16]["FinishedAtUtc"] = "2026-09-07T00:00:34.0000002Z"
    rows[17]["StartedAtUtc"] = "2026-09-07T00:00:34.0000001Z"
    result = _run(headers, rows)
    assert isinstance(result, ledgers.CostLedgerRefused)
    assert result.CompletedRows == 17 and result.code == "ledger-chronology"


def test_gc_cross_row_decrease_refuses_even_when_local_delta_is_valid() -> None:
    headers, rows = _fixture()
    rows[17]["Timing"].update(GcBefore=[0, 0, 0], GcAfter=[1, 0, 0], GcDelta=[1, 0, 0])
    result = _run(headers, rows)
    assert isinstance(result, ledgers.CostLedgerRefused)
    assert result.CompletedRows == 17 and result.code == "ledger-gc-chronology"


@pytest.mark.parametrize("bad", [0, -1, 1.5, True, a.INT64_MAX + 1, float("nan")])
def test_measured_wall_admission_at_last_row(bad: object) -> None:
    headers, rows = _fixture()
    rows[49]["Timing"]["WallNs"] = bad
    result = _run(headers, rows)
    assert isinstance(result, ledgers.CostLedgerRefused)
    assert result.CompletedRows == 49 and result.path.endswith("WallNs")


def test_ratio_of_medians_cannot_be_replaced_by_median_of_ratios() -> None:
    headers, rows = _fixture()
    native = iter([1, 2, 100, 101, 102])
    compiled = iter([500, 501, 49, 50, 51])
    for header, row in zip(headers, rows, strict=True):
        if header["Mode"] == "ordinary-choice" and header["Panel"] == "effective":
            row["Timing"]["WallNs"] = next(
                native if header["Strategy"] == "native-recursive" else compiled
            )
    result = _accepted(_run(headers, rows))
    ratio = _ratio(result, "ordinary-choice", "effective", "WallNs")
    assert ratio.Ratio == ledgers.RationalPair(51, 100)
    assert ratio.AtMostHalf is False and result.RequiredCostCondition == "not-met"
    # Three paired ratios are <= 1/2; the required ratio of medians is 51/100.


def test_panels_are_never_pooled() -> None:
    headers, rows = _fixture()
    for header, row in zip(headers, rows, strict=True):
        if header["Mode"] == "ordinary-choice":
            native = header["Strategy"] == "native-recursive"
            row["Timing"]["WallNs"] = (
                (100 if native else 1)
                if header["Panel"] == "effective"
                else (10 if native else 9)
            )
    result = _accepted(_run(headers, rows))
    assert result.RequiredCostCondition == "not-met"
    assert _ratio(
        result, "ordinary-choice", "null", "WallNs"
    ).Ratio == ledgers.RationalPair(9, 10)


def test_unbounded_half_comparison_and_zero_numerator() -> None:
    headers, rows = _fixture()
    for header, row in zip(headers, rows, strict=True):
        native = header["Strategy"] == "native-recursive"
        row["Timing"]["WallNs"] = a.INT64_MAX if native else a.INT64_MAX // 2 + 1
        row["Timing"]["AllocatedBytes"] = 200 if native else 0
    result = _accepted(_run(headers, rows))
    assert result.RequiredCostCondition == "not-met"
    allocation = _ratio(result, "ordinary-choice", "effective", "AllocatedBytes")
    assert allocation.Ratio == ledgers.RationalPair(0, 200)
    assert allocation.AtMostHalf is True and allocation.Reason is None


def test_descriptive_missing_ratios_and_required_allocation_refusal() -> None:
    headers, rows = _fixture()
    for header, row in zip(headers, rows, strict=True):
        if header["Strategy"] == "native-recursive":
            row["Timing"]["AllocatedBytes"] = 0
    result = _accepted(_run(headers, rows))
    assert result.CompletedRows == 50 and result.RequiredCostCondition == "refused"
    assert len(result.Ratios) == 15
    for ratio in result.Ratios:
        if ratio.Metric == "CpuNs":
            assert ratio.Ratio is None and ratio.Reason == "zero-native-cpu"
        if ratio.Metric == "AllocatedBytes":
            assert ratio.Ratio is None and ratio.Reason == "zero-native-allocation"
            assert ratio.AtMostHalf is None
            assert ratio.CompiledMedian == 100 and ratio.NativeMedian == 0
