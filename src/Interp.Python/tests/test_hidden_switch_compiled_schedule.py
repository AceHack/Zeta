"""Schedule counterexamples without source generation, policy or timing calls."""

from __future__ import annotations

import copy
from dataclasses import asdict

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_schedule as schedule


def rows() -> list[dict[str, object]]:
    return [asdict(row) for row in schedule.cost_schedule()]


def test_complete_roster_totals_keep_choice_and_episode_boundaries_separate() -> None:
    result = schedule.admit_cost_schedule(rows())
    assert isinstance(result, a.Admitted)
    count = result.value
    assert (count.Rows, count.ChoiceOnlyRows, count.WholeEpisodeRows) == (50, 30, 20)
    assert (count.WarmupCalls, count.MeasuredCalls) == (6_720, 1_740_800)
    assert (count.WarmupEpisodes, count.MeasuredEpisodes) == (160, 1_280)
    assert count.Scope == "fifty-cost-row-headers-only"
    assert count.TimingRuntimeAndOuterAdmission == "not-performed-by-pure-schedule"
    spec = schedule.cost_schedule()
    assert sum(r.MeasuredCalls for r in spec[:20]) == 1_310_720
    assert sum(r.MeasuredCalls for r in spec[20:30]) == 409_600
    assert sum(r.MeasuredCalls for r in spec[30:]) == 20_480
    assert all(r.WarmupEpisodes == r.MeasuredEpisodes == 0 for r in spec[:30])
    assert all(
        r.WarmupCalls == 16 * r.WarmupEpisodes
        and r.MeasuredCalls == 16 * r.MeasuredEpisodes
        for r in spec[30:]
    )


@pytest.mark.parametrize(
    ("index", "expected"),
    [
        (0, ("ordinary-choice", 0, "effective", "native-recursive")),
        (3, ("ordinary-choice", 0, "null", "compiled-guarded")),
        (4, ("ordinary-choice", 1, "effective", "compiled-guarded")),
        (7, ("ordinary-choice", 1, "null", "native-recursive")),
        (19, ("ordinary-choice", 4, "null", "compiled-guarded")),
        (20, ("boundary-choice", 0, "stress", "native-recursive")),
        (22, ("boundary-choice", 1, "stress", "compiled-guarded")),
        (29, ("boundary-choice", 4, "stress", "compiled-guarded")),
        (30, ("whole-episode", 0, "effective", "native-recursive")),
        (34, ("whole-episode", 1, "effective", "compiled-guarded")),
        (49, ("whole-episode", 4, "null", "compiled-guarded")),
    ],
)
def test_fixed_position_witnesses(
    index: int, expected: tuple[str, int, str, str]
) -> None:
    row = schedule.cost_schedule()[index]
    assert (row.Mode, row.Replicate, row.Panel, row.Strategy) == expected
    assert row.Index == index


@pytest.mark.parametrize("index", range(50))
def test_each_row_is_checked_and_no_late_replacement_is_hidden(index: int) -> None:
    changed = rows()
    changed[index]["MeasuredCalls"] = -1
    result = schedule.admit_cost_schedule(changed)
    assert isinstance(result, schedule.ScheduleRefused)
    assert result.CompletedRows == index
    assert result.path == f"Schedule[{index}].MeasuredCalls"


@pytest.mark.parametrize("key", tuple(asdict(schedule.cost_schedule()[0])))
def test_each_header_field_is_load_bearing(key: str) -> None:
    changed = rows()
    changed[-1][key] = None
    result = schedule.admit_cost_schedule(changed)
    assert isinstance(result, schedule.ScheduleRefused)
    assert result.path == "Schedule[49]." + key and result.CompletedRows == 49


@pytest.mark.parametrize(
    "key",
    [
        "Index",
        "Replicate",
        "WarmupCalls",
        "MeasuredCalls",
        "WarmupEpisodes",
        "MeasuredEpisodes",
    ],
)
def test_booleans_cannot_impersonate_integer_headers(key: str) -> None:
    changed = rows()
    changed[0][key] = False
    result = schedule.admit_cost_schedule(changed)
    assert isinstance(result, schedule.ScheduleRefused)
    assert result.path == "Schedule[0]." + key


def test_reordering_is_rejected_even_after_restamping_indices() -> None:
    for first, second in ((0, 1), (0, 2), (4, 5), (19, 20), (29, 30), (48, 49)):
        changed = rows()
        changed[first], changed[second] = changed[second], changed[first]
        changed[first]["Index"], changed[second]["Index"] = first, second
        result = schedule.admit_cost_schedule(changed)
        assert isinstance(result, schedule.ScheduleRefused)
        assert result.CompletedRows == first


def test_missing_extra_duplicate_and_malformed_rows_refuse() -> None:
    valid = rows()
    malformed: list[object] = [None, tuple(valid), valid[:-1], valid + [valid[-1]]]
    for key in ("extra", "missing", "duplicate", "row-type"):
        changed = copy.deepcopy(valid)
        if key == "extra":
            changed[2]["Passed"] = True
        elif key == "missing":
            del changed[2]["WarmupCalls"]
        elif key == "duplicate":
            changed[2] = changed[1]
        else:
            changed[2] = {}  # Wrong exact object shape, without a type escape.
        malformed.append(changed)
    assert all(
        isinstance(schedule.admit_cost_schedule(value), schedule.ScheduleRefused)
        for value in malformed
    )


def test_observation_counts_and_old_prelude_calls_cannot_replace_service_counts() -> (
    None
):
    for index, field, incorrect in (
        (30, "WarmupCalls", 136),
        (30, "MeasuredCalls", 1088),
        (0, "WarmupCalls", 128 + 2304),
    ):
        changed = rows()
        changed[index][field] = incorrect
        assert isinstance(
            schedule.admit_cost_schedule(changed), schedule.ScheduleRefused
        )
