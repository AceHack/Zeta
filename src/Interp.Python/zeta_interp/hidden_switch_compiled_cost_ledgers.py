"""Admit all cost ledger projections and derive exact median cost conditions.

This is a pure partial admission boundary. No timing is collected, no policy is
run, and no file is opened. Actual warmups, outputs, invocation counts, resource
measurement boundaries, sources and runtimes still require separate admission.
UTC chronology is checked independently of monotonic elapsed-wall measurements.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import gcd
from typing import Literal

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_schedule as schedule

LEDGER_FIELDS = frozenset(("Index", "StartedAtUtc", "FinishedAtUtc", "Timing"))
METRICS = ("WallNs", "CpuNs", "AllocatedBytes")


@dataclass(frozen=True, slots=True)
class RationalPair:
    Numerator: int
    Denominator: int


@dataclass(frozen=True, slots=True)
class CanonicalRatio:
    Num: str
    Den: str


@dataclass(frozen=True, slots=True)
class DescriptiveRatio:
    Numerator: int
    Denominator: int
    Ratio: CanonicalRatio | None
    Reason: str | None


def descriptive_ratio(
    numerator: object, denominator: object, kind: object, path: str
) -> a.Admission[DescriptiveRatio]:
    """Exact resource ratios, including declared zero-denominator meanings."""
    if type(kind) is not str or kind not in ("wall", "cpu", "allocation"):
        return a.Refused("ratio-kind", path, "requires wall, cpu or allocation")
    checked_numerator = a.integer(numerator, 0, a.INT64_MAX, path + ".Numerator")
    if isinstance(checked_numerator, a.Refused):
        return checked_numerator
    checked_denominator = a.integer(denominator, 0, a.INT64_MAX, path + ".Denominator")
    if isinstance(checked_denominator, a.Refused):
        return checked_denominator
    n, d = checked_numerator.value, checked_denominator.value
    if d == 0:
        if kind == "wall":
            return a.Refused(
                "zero-native-wall",
                path,
                "measured native wall denominator must be positive",
            )
        return a.Admitted(DescriptiveRatio(n, d, None, "zero-native-" + kind))
    factor = gcd(n, d)
    return a.Admitted(
        DescriptiveRatio(n, d, CanonicalRatio(str(n // factor), str(d // factor)), None)
    )


@dataclass(frozen=True, slots=True)
class CostRatio:
    Mode: str
    Panel: str
    Metric: str
    CompiledMedian: int
    NativeMedian: int
    Ratio: RationalPair | None
    Reason: str | None
    Required: bool
    AtMostHalf: bool | None


@dataclass(frozen=True, slots=True)
class CostLedgerReplay:
    CompletedRows: int
    Ratios: tuple[CostRatio, ...]
    RequiredCostCondition: Literal["met", "not-met", "refused"]
    Scope: str = "fifty-cost-ledger-projections-only"
    OutputBoundaryAndRuntimeAdmission: str = "not-performed-by-pure-ledger-checker"


@dataclass(frozen=True)
class CostLedgerRefused(a.Refused):
    CompletedRows: int


def _failure(result: a.Refused, completed: int) -> CostLedgerRefused:
    return CostLedgerRefused(result.code, result.path, result.detail, completed)


def admit_cost_ledgers(
    schedule_rows: object,
    ledger_rows: object,
    *,
    prelude_finished_at_utc: object,
    cost_finished_at_utc: object,
) -> a.Admitted[CostLedgerReplay] | CostLedgerRefused:
    """Validate the complete fixed roster before deriving any median condition.

    ``prelude_finished_at_utc`` denotes the end of all three cost setup stages.
    These timestamps are caller-supplied projections; the caller must bind them
    to actual admitted envelopes. Zero required native allocation medians refuse
    the cost condition, while retaining every valid ledger and descriptive ratio.
    That outcome makes no assertion about separately admitted action equivalence.
    """
    checked_schedule = schedule.admit_cost_schedule(schedule_rows)
    if isinstance(checked_schedule, a.Refused):
        return _failure(checked_schedule, 0)
    bounds = a.interval(
        prelude_finished_at_utc, cost_finished_at_utc, "CostAfterPrelude"
    )
    if isinstance(bounds, a.Refused):
        return _failure(bounds, 0)
    if type(ledger_rows) is not list or len(ledger_rows) != 50:
        return CostLedgerRefused(
            "ledger-roster", "Ledgers", "requires all fifty ledger projections", 0
        )

    previous_finish, cost_finish = bounds.value
    previous_gc: list[int] | None = None
    values: dict[tuple[str, str, str, str], list[int]] = {}
    for index, (header, candidate) in enumerate(
        zip(schedule.cost_schedule(), ledger_rows, strict=True)
    ):
        path = f"Ledgers[{index}]"
        checked = a.exact_keys(candidate, LEDGER_FIELDS, path)
        if isinstance(checked, a.Refused):
            return _failure(checked, index)
        row = checked.value
        checked_index = a.integer(row["Index"], index, index, path + ".Index")
        if isinstance(checked_index, a.Refused):
            return _failure(checked_index, index)
        interval = a.interval(row["StartedAtUtc"], row["FinishedAtUtc"], path)
        if isinstance(interval, a.Refused):
            return _failure(interval, index)
        start, finish = interval.value
        if start < previous_finish or finish > cost_finish:
            return CostLedgerRefused(
                "ledger-chronology",
                path,
                "rows must follow prelude and prior row and finish within cost phase",
                index,
            )
        checked_timing = a.timing(row["Timing"], path + ".Timing", measured=True)
        if isinstance(checked_timing, a.Refused):
            return _failure(checked_timing, index)
        timing = checked_timing.value
        before: list[int] = timing["GcBefore"]
        after: list[int] = timing["GcAfter"]
        if previous_gc is not None and any(
            current < prior for current, prior in zip(before, previous_gc, strict=True)
        ):
            return CostLedgerRefused(
                "ledger-gc-chronology",
                path + ".Timing.GcBefore",
                "process generation counts cannot decrease between measured rows",
                index,
            )
        for metric in METRICS:
            key = (header.Mode, header.Panel, header.Strategy, metric)
            values.setdefault(key, []).append(timing[metric])
        previous_finish, previous_gc = finish, after

    ratios: list[CostRatio] = []
    for mode in ("ordinary-choice", "boundary-choice", "whole-episode"):
        panels = ("stress",) if mode == "boundary-choice" else ("effective", "null")
        for panel in panels:
            for metric in METRICS:
                # Exact schedule admission supplies precisely five values per
                # key. Sort only within this mode/panel/strategy/metric group.
                native = sorted(values[(mode, panel, "native-recursive", metric)])[2]
                compiled = sorted(values[(mode, panel, "compiled-guarded", metric)])[2]
                required = mode == "ordinary-choice" and metric != "CpuNs"
                descriptive = descriptive_ratio(
                    compiled,
                    native,
                    {"WallNs": "wall", "CpuNs": "cpu", "AllocatedBytes": "allocation"}[
                        metric
                    ],
                    f"Ratios.{mode}.{panel}.{metric}",
                )
                if isinstance(descriptive, a.Refused):
                    return _failure(descriptive, len(ledger_rows))
                pair = (
                    RationalPair(compiled, native)
                    if descriptive.value.Ratio is not None
                    else None
                )
                at_most_half: bool | None = None
                if required:
                    half = a.half_median(
                        values[(mode, panel, "compiled-guarded", metric)],
                        values[(mode, panel, "native-recursive", metric)],
                        f"Required.{mode}.{panel}.{metric}",
                    )
                    if isinstance(half, a.Refused):
                        if half.code != "zero-native-median" or native != 0:
                            return _failure(half, len(ledger_rows))
                    else:
                        at_most_half = half.value["AtMostHalf"] is True
                ratios.append(
                    CostRatio(
                        mode,
                        panel,
                        metric,
                        compiled,
                        native,
                        pair,
                        descriptive.value.Reason,
                        required,
                        at_most_half,
                    )
                )
    required_ratios = [ratio for ratio in ratios if ratio.Required]
    condition: Literal["met", "not-met", "refused"]
    if any(ratio.Ratio is None for ratio in required_ratios):
        condition = "refused"
    elif all(ratio.AtMostHalf is True for ratio in required_ratios):
        condition = "met"
    else:
        condition = "not-met"
    return a.Admitted(CostLedgerReplay(len(ledger_rows), tuple(ratios), condition))
