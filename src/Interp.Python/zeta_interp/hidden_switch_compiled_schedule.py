"""Exact fifty-row cost schedule, independent of native execution and timing.

Calls count action-service invocations, not observations or the old-runner
prelude. The caller must still admit actual records, warmups, inputs, chronology,
resources, runtime and source identities. This pure schedule never creates a
tape, executes a policy, opens a file or makes a cost claim.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

from . import hidden_switch_compiled_admission as a


@dataclass(frozen=True, slots=True)
class CostRow:
    Index: int
    Mode: str
    Replicate: int
    Panel: str
    Strategy: str
    WarmupCalls: int
    MeasuredCalls: int
    WarmupEpisodes: int
    MeasuredEpisodes: int


@dataclass(frozen=True, slots=True)
class ScheduleCounts:
    Rows: int
    ChoiceOnlyRows: int
    WholeEpisodeRows: int
    WarmupCalls: int
    MeasuredCalls: int
    WarmupEpisodes: int
    MeasuredEpisodes: int
    Scope: str = "fifty-cost-row-headers-only"
    TimingRuntimeAndOuterAdmission: str = "not-performed-by-pure-schedule"


@dataclass(frozen=True)
class ScheduleRefused(a.Refused):
    CompletedRows: int


def cost_schedule() -> tuple[CostRow, ...]:
    """Preserve mode/panel order; rotate only each replicate's two strategies."""
    rows: list[CostRow] = []
    strategies = ("native-recursive", "compiled-guarded")
    for mode in ("ordinary-choice", "boundary-choice", "whole-episode"):
        panels = ("stress",) if mode == "boundary-choice" else ("effective", "null")
        warm_calls, measured_calls = (
            (160, 40_960) if mode == "boundary-choice" else (128, 65_536)
        )
        warm_episodes = measured_episodes = 0
        if mode == "whole-episode":
            warm_calls, measured_calls = 128, 1_024
            warm_episodes, measured_episodes = 8, 64
        for replicate in range(5):
            for panel in panels:
                for strategy_index in (replicate % 2, (replicate + 1) % 2):
                    rows.append(
                        CostRow(
                            len(rows),
                            mode,
                            replicate,
                            panel,
                            strategies[strategy_index],
                            warm_calls,
                            measured_calls,
                            warm_episodes,
                            measured_episodes,
                        )
                    )
    return tuple(rows)


def admit_cost_schedule(rows: object) -> a.Admitted[ScheduleCounts] | ScheduleRefused:
    """Require all fifty exact headers with no missing, extra or reordered row.

    Whole-episode call counts are 16 times episode counts; their 17 observations
    belong to separate actual trace admission. No old-runner setup call is
    included in these headers or totals. Failures retain the checked row prefix.
    """
    if type(rows) is not list or len(rows) != 50:
        return ScheduleRefused(
            "schedule-roster", "Schedule", "requires all fifty ordered row headers", 0
        )
    completed = choice_rows = warm_calls = measured_calls = warm_episodes = (
        measured_episodes
    ) = 0
    for index, (expected, actual) in enumerate(zip(cost_schedule(), rows, strict=True)):
        path = f"Schedule[{index}]"
        fields = asdict(expected)
        if type(actual) is not dict or actual.keys() != fields.keys():
            return ScheduleRefused(
                "schedule-fields",
                path,
                "requires exactly the nine declared header fields",
                completed,
            )
        for key, value in fields.items():
            if type(actual[key]) is not type(value) or actual[key] != value:
                return ScheduleRefused(
                    "schedule-value",
                    path + "." + key,
                    "header differs from the fixed registered schedule",
                    completed,
                )
        # Add actual admitted values. These are still declared header counts,
        # not proof that the native service executed that many calls.
        warm_calls += actual["WarmupCalls"]
        measured_calls += actual["MeasuredCalls"]
        warm_episodes += actual["WarmupEpisodes"]
        measured_episodes += actual["MeasuredEpisodes"]
        choice_rows += actual["Mode"] != "whole-episode"
        completed += 1
    return a.Admitted(
        ScheduleCounts(
            completed,
            choice_rows,
            completed - choice_rows,
            warm_calls,
            measured_calls,
            warm_episodes,
            measured_episodes,
        )
    )
