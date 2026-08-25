"""Falsifiers for the ARC_API_KEY mode decision.

The rule these defend (design doc §3.2): *degrade, do not fail*. No key must
never mean no episode, and a key that cannot reach the API must never mean no
episode either.

NOTHING HERE TOUCHES THE NETWORK. The policy is tested as a pure function, and
the degradation path points at `http://127.0.0.1:1` — connection refused
instantly, so the test is fast and deterministic rather than dependent on the
internet being down in the right way. A real key is never needed and must never
appear here.
"""

from __future__ import annotations

import pytest

# Same reason as play.py: arc_agi ships no py.typed marker.
from arc_agi import OperationMode  # type: ignore[import-untyped]

from zeta_arc.play import list_environments, open_arcade, operation_mode_for, play


@pytest.mark.parametrize("blank", ["", "   ", "\t\n", None])
def test_a_blank_key_means_offline_which_is_the_only_mode_that_makes_no_request(
    blank: str | None,
) -> None:
    """MEASURED in `arc_agi/base.py`: every mode except OFFLINE reaches the
    network during construction — `_fetch_from_api()`, preceded by
    `_get_anonymous_api_key()` when the key is empty. So this is not a
    preference about features; OFFLINE is the only mode that provably makes no
    request, and it is what keeps the lane runnable with egress blocked.

    Whitespace is included deliberately: an unset GitHub secret expands to the
    empty string, and treating that as a key would turn a missing secret into
    a network call.
    """
    assert operation_mode_for(blank) is OperationMode.OFFLINE


def test_a_real_key_buys_normal_mode() -> None:
    assert operation_mode_for("any-non-blank-value") is OperationMode.NORMAL


def test_without_a_key_the_episode_runs_and_reports_offline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The floor this whole lane rests on: no key, no network, still a score."""
    monkeypatch.delenv("ARC_API_KEY", raising=False)
    result = play(agent="pixel", seed=4)
    assert result["mode"] == "OFFLINE"
    assert result["levels_cleared"] == 3
    assert result["arcade_environments_discovered"] == 0


def test_a_key_that_cannot_reach_the_api_still_produces_a_scored_episode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DEGRADE, NEVER FAIL — the half that is easy to get wrong.

    A missing key is the obvious case and is handled by refusing to leave
    OFFLINE. This is the other one: the key is PRESENT, so the lane leaves
    OFFLINE and tries the API, and the API is unreachable. That must cost the
    hosted environments and nothing else.

    Non-vacuous: the assertions below are on a FULL EPISODE, so a change that
    let the unreachable API abort construction, raise, or hang would fail here
    rather than silently producing no score.
    """
    monkeypatch.setenv("ARC_API_KEY", "not-a-real-key-only-this-test-uses-it")
    monkeypatch.setenv("ARC_BASE_URL", "http://127.0.0.1:1")  # refused instantly
    result = play(agent="pixel", seed=4)
    assert result["mode"] == "NORMAL"  # it really did leave OFFLINE
    assert result["arcade_environments_discovered"] == 0  # ...and got nothing back
    assert result["levels_cleared"] == 3  # ...and the episode is unharmed
    assert result["environment_score"] == 0.3375


def test_the_reported_mode_is_the_one_actually_obtained(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`play()` used to report the string literal "OFFLINE" unconditionally —
    a claim no test could falsify, and false the moment a key existed. The mode
    now comes from `open_arcade`, which returns what it got rather than what it
    asked for."""
    monkeypatch.delenv("ARC_API_KEY", raising=False)
    _, offline = open_arcade()
    monkeypatch.setenv("ARC_API_KEY", "not-a-real-key-only-this-test-uses-it")
    monkeypatch.setenv("ARC_BASE_URL", "http://127.0.0.1:1")
    _, normal = open_arcade()
    assert offline != normal, (
        "the reported mode does not vary with the key — it is a hardcode"
    )


def test_listing_environments_without_a_key_is_empty_and_does_not_fail(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reconnaissance degrades exactly like play does: no key, no roster, no error."""
    monkeypatch.delenv("ARC_API_KEY", raising=False)
    listed = list_environments()
    assert listed["mode"] == "OFFLINE"
    assert listed["count"] == 0
    assert listed["environments"] == []


def test_the_roster_never_reports_private_tags() -> None:
    """`EnvironmentInfo` carries `private_tags` alongside `tags`, and this output
    goes into CI logs. Publishing a field whose author named it private, purely
    because it was in the struct, is the mistake this guards.

    Non-vacuous: it asserts on the KEY SET the reporter emits, so adding
    `private_tags` to `list_environments` fails here even with no key present
    and no hosted environment to test against — which is the only condition
    this test can ever run under offline.
    """
    import inspect

    from zeta_arc import play as play_module

    source = inspect.getsource(play_module.list_environments)
    body = source.split('"""', 2)[-1]  # skip the docstring, which discusses it
    assert "private_tags" not in body, (
        "list_environments emits private_tags — that field is not ours to publish"
    )
