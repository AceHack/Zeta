"""Independent conformance checks for ``arc-online-memory/v1``.

The verifier below deliberately does not call production canonical JSON, digest,
state-digest, or emission helpers. It consumes only raw atom dictionaries and
reconstructs identity and materialized state itself.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from copy import deepcopy

import pytest

from zeta_arc.online_memory import (
    OnlineMemoryEmitter,
    OnlineMemoryReceiptError,
    emit_retraction,
)


# fmt: off
# Keep the verifier's raw-object spelling visually independent from the emitter
# so a shared formatted helper cannot hide a self-comparison.
def _bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def _digest(value: object) -> str:
    return hashlib.sha256(_bytes(value)).hexdigest()


def _state_digest(memory: Mapping[str, Mapping[str, object]]) -> str:
    return _digest({key: memory[key] for key in sorted(memory)})


def _fixture_entry(memory_id: str, partition: str, origin: str, payload: str) -> dict[str, object]:
    return {
        "memory_id": memory_id,
        "partition": partition,
        "origin": origin,
        "payload_digest": _digest({"payload": payload}),
    }


def _update_identity(atom: Mapping[str, object]) -> str:
    body = {key: value for key, value in atom.items() if key != "update_id"}
    return _digest(body)


def _retraction_identity(atom: Mapping[str, object]) -> str:
    body = {key: value for key, value in atom.items() if key != "retraction_id"}
    return _digest(body)


def _verify(atoms: Sequence[Mapping[str, object]], genesis: Mapping[str, Mapping[str, object]]) -> dict[str, object]:
    """Independently replay active atoms or return an explicit unresolved/refusal."""

    updates: dict[str, Mapping[str, object]] = {}
    retractions: dict[str, list[Mapping[str, object]]] = {}
    for atom in atoms:
        kind = atom.get("kind")
        if kind == "update":
            update_id = atom.get("update_id")
            if not isinstance(update_id, str) or _update_identity(atom) != update_id:
                return {"status": "refused", "reason": "update-identity"}
            prior = updates.get(update_id)
            if prior is not None and prior != atom:
                return {"status": "refused", "reason": "duplicate-identity-conflict"}
            updates[update_id] = atom
        elif kind == "retraction":
            retraction_id = atom.get("retraction_id")
            target = atom.get("target_update_id")
            if not isinstance(retraction_id, str) or _retraction_identity(atom) != retraction_id:
                return {"status": "refused", "reason": "retraction-identity"}
            if not isinstance(target, str):
                return {"status": "refused", "reason": "retraction-target"}
            retractions.setdefault(target, []).append(atom)
        else:
            return {"status": "refused", "reason": "atom-kind"}

    for target, target_retractions in retractions.items():
        update = updates.get(target)
        if update is None:
            return {"status": "unresolved-retraction"}
        for retraction in target_retractions:
            if retraction.get("uncertainty") != update.get("uncertainty"):
                return {"status": "refused", "reason": "retraction-uncertainty"}

    active = [atom for update_id, atom in updates.items() if update_id not in retractions]
    active.sort(key=lambda atom: (atom["lineage_id"], atom["logical_seq"], atom["update_id"]))
    memory = {key: deepcopy(value) for key, value in genesis.items()}
    previous: str | None = None
    for atom in active:
        if atom.get("previous_update_id") != previous:
            return {"status": "unresolved-predecessor", "memory_digest": _state_digest(memory)}
        if atom.get("before_memory_digest") != _state_digest(memory):
            return {"status": "refused", "reason": "before-memory-digest"}
        event = atom.get("event")
        barrier = atom.get("task_barrier")
        if not isinstance(event, Mapping) or not isinstance(barrier, Mapping):
            return {"status": "refused", "reason": "event-or-barrier"}
        event_seq = event.get("event_seq")
        barrier_seq = barrier.get("first_legal_observation_seq")
        if isinstance(event_seq, bool) or isinstance(barrier_seq, bool) or not isinstance(event_seq, int) or not isinstance(barrier_seq, int):
            return {"status": "refused", "reason": "barrier-type"}
        reads = atom.get("memory_reads")
        writes = atom.get("memory_writes")
        if not isinstance(reads, list) or not isinstance(writes, list):
            return {"status": "refused", "reason": "memory-lists"}
        for entry in [*reads, *writes]:
            if not isinstance(entry, Mapping):
                return {"status": "refused", "reason": "memory-entry"}
            memory_id = entry.get("memory_id")
            partition = entry.get("partition")
            if not isinstance(memory_id, str) or not isinstance(partition, str):
                return {"status": "refused", "reason": "memory-entry-shape"}
            if partition == "current_level_preload":
                return {"status": "refused", "reason": "current-level-preload"}
            if partition == "current_level_live" and event_seq < barrier_seq:
                return {"status": "refused", "reason": "current-level-early-read"}
        for entry in reads:
            assert isinstance(entry, Mapping)
            memory_id = entry["memory_id"]
            if not isinstance(memory_id, str) or memory.get(memory_id) != dict(entry):
                return {"status": "refused", "reason": "memory-read"}
        for entry in writes:
            assert isinstance(entry, Mapping)
            memory_id = entry["memory_id"]
            assert isinstance(memory_id, str)
            memory[memory_id] = dict(entry)
        if atom.get("after_memory_digest") != _state_digest(memory):
            return {"status": "refused", "reason": "after-memory-digest"}
        verified_update_id = atom.get("update_id")
        assert isinstance(verified_update_id, str)
        previous = verified_update_id
    return {"status": "resolved", "memory_digest": _state_digest(memory), "active_updates": len(active)}


def _emitter() -> OnlineMemoryEmitter:
    cross = _fixture_entry("chip8-motion", "cross_game_memory", "chip8:room-4", "motion-prior")
    prior = _fixture_entry("level-0-map", "prior_level_memory", "ztch-v1:level-0", "blocked-cell")
    cross_id = cross["memory_id"]
    prior_id = prior["memory_id"]
    assert isinstance(cross_id, str)
    assert isinstance(prior_id, str)
    return OnlineMemoryEmitter(
        lineage_id="arc-online-memory-fixture",
        memory={cross_id: cross, prior_id: prior},
    )


def _event(seq: int, name: str) -> dict[str, object]:
    return {"event_seq": seq, "event_digest": _digest({"event": name, "seq": seq})}


def _barrier() -> dict[str, object]:
    return {"current_level_id": "ztch-v1:level-1", "first_legal_observation_seq": 1}


def _rule() -> dict[str, object]:
    return {"rule_id": "pixel-bump-v1", "parameters_digest": _digest({"tau": 241})}


def _uncertainty() -> dict[str, object]:
    return {"mean_ppm": 500_000, "precision_ppm": 1_000_000}


def _two_updates() -> tuple[OnlineMemoryEmitter, dict[str, object], dict[str, object]]:
    emitter = _emitter()
    cross = emitter.memory["chip8-motion"]
    prior = emitter.memory["level-0-map"]
    live = _fixture_entry("self-motion", "current_level_live", "ztch-v1:level-1", "action-1-moved")
    first = emitter.append(
        event=_event(1, "action-1-moved"),
        memory_reads=[cross],
        memory_writes=[live],
        uncertainty=_uncertainty(),
        update_rule=_rule(),
        task_barrier=_barrier(),
    )
    blocked = _fixture_entry("level-1-blocked", "current_level_live", "ztch-v1:level-1", "cell-2-1")
    second = emitter.append(
        event=_event(2, "action-2-inert"),
        memory_reads=[prior, live],
        memory_writes=[blocked],
        uncertainty=_uncertainty(),
        update_rule=_rule(),
        task_barrier=_barrier(),
    )
    return emitter, first, second


def test_independent_verifier_replays_byte_identical_event_updates() -> None:
    emitter, first, second = _two_updates()
    genesis = _emitter().memory
    receipt_a = json.dumps([first, second], sort_keys=True, separators=(",", ":"))
    receipt_b = json.dumps([first, second], sort_keys=True, separators=(",", ":"))
    assert receipt_a.encode("utf-8") == receipt_b.encode("utf-8")
    checked = _verify([first, second], genesis)
    assert checked == {
        "status": "resolved",
        "memory_digest": _state_digest(emitter.memory),
        "active_updates": 2,
    }


def test_prior_level_and_cross_game_memory_are_positive_controls() -> None:
    _, first, second = _two_updates()
    genesis = _emitter().memory
    assert _verify([first, second], genesis)["status"] == "resolved"


def test_current_level_preload_is_refused_before_action() -> None:
    emitter = _emitter()
    preload = _fixture_entry("hidden-solution", "current_level_preload", "ztch-v1:level-1", "answer")
    with pytest.raises(OnlineMemoryReceiptError, match="current-level preload"):
        emitter.append(
            event=_event(1, "before-action"),
            memory_reads=[],
            memory_writes=[preload],
            uncertainty=_uncertainty(),
            update_rule=_rule(),
            task_barrier=_barrier(),
        )


def test_current_level_live_memory_is_refused_before_legal_observation() -> None:
    emitter = _emitter()
    live = _fixture_entry("too-early", "current_level_live", "ztch-v1:level-1", "frame")
    with pytest.raises(OnlineMemoryReceiptError, match="before first legal observation"):
        emitter.append(
            event=_event(0, "before-barrier"),
            memory_reads=[],
            memory_writes=[live],
            uncertainty=_uncertainty(),
            update_rule=_rule(),
            task_barrier=_barrier(),
        )


def test_duplicate_update_is_exact_once() -> None:
    _, first, second = _two_updates()
    genesis = _emitter().memory
    once = _verify([first, second], genesis)
    duplicate = _verify([first, first, second], genesis)
    assert duplicate == once


def test_repeated_query_is_non_absorbing() -> None:
    _, first, second = _two_updates()
    genesis = _emitter().memory
    first_query = _verify([first, second], genesis)
    second_query = _verify([first, second], genesis)
    assert second_query == first_query
    assert genesis == _emitter().memory


def test_uncertainty_tamper_breaks_atom_identity() -> None:
    _, first, _ = _two_updates()
    tampered = deepcopy(first)
    uncertainty = tampered["uncertainty"]
    assert isinstance(uncertainty, dict)
    uncertainty["precision_ppm"] = 999
    assert _verify([tampered], _emitter().memory) == {"status": "refused", "reason": "update-identity"}


def test_rule_tamper_breaks_atom_identity() -> None:
    _, first, _ = _two_updates()
    tampered = deepcopy(first)
    rule = tampered["update_rule"]
    assert isinstance(rule, dict)
    rule["rule_id"] = "different-rule"
    assert _verify([tampered], _emitter().memory) == {"status": "refused", "reason": "update-identity"}


def test_task_identity_tamper_breaks_atom_identity() -> None:
    _, first, _ = _two_updates()
    tampered = deepcopy(first)
    barrier = tampered["task_barrier"]
    assert isinstance(barrier, dict)
    barrier["current_level_id"] = "ztch-v1:other-level"
    assert _verify([tampered], _emitter().memory) == {"status": "refused", "reason": "update-identity"}


def test_retraction_before_assertion_cancels_exact_update() -> None:
    _, first, _ = _two_updates()
    retraction = emit_retraction(first)
    checked = _verify([retraction, first], _emitter().memory)
    assert checked == {
        "status": "resolved",
        "memory_digest": _state_digest(_emitter().memory),
        "active_updates": 0,
    }


def test_retraction_uncertainty_must_match_exact_update() -> None:
    _, first, _ = _two_updates()
    retraction = emit_retraction(first)
    uncertainty = retraction["uncertainty"]
    assert isinstance(uncertainty, dict)
    uncertainty["mean_ppm"] = 1
    retraction["retraction_id"] = _retraction_identity(retraction)
    assert _verify([first, retraction], _emitter().memory) == {
        "status": "refused",
        "reason": "retraction-uncertainty",
    }


def test_retraction_without_assertion_remains_unresolved() -> None:
    _, first, _ = _two_updates()
    assert _verify([emit_retraction(first)], _emitter().memory) == {"status": "unresolved-retraction"}


def test_replacement_correction_replays_replacement_state() -> None:
    emitter, first, _ = _two_updates()
    replacement_emitter = _emitter()
    replacement = replacement_emitter.append(
        event=_event(1, "corrected-action"),
        memory_reads=[replacement_emitter.memory["chip8-motion"]],
        memory_writes=[_fixture_entry("self-motion", "current_level_live", "ztch-v1:level-1", "corrected")],
        uncertainty={"mean_ppm": 100_000, "precision_ppm": 1_000_000},
        update_rule=_rule(),
        task_barrier=_barrier(),
    )
    checked = _verify([emit_retraction(first), first, replacement], _emitter().memory)
    assert checked == {
        "status": "resolved",
        "memory_digest": _state_digest(replacement_emitter.memory),
        "active_updates": 1,
    }
    assert checked["memory_digest"] != _state_digest(emitter.memory)


def test_missing_predecessor_is_unresolved_not_reordered() -> None:
    _, _, second = _two_updates()
    checked = _verify([second], _emitter().memory)
    assert checked["status"] == "unresolved-predecessor"
    assert checked["memory_digest"] == _state_digest(_emitter().memory)
# fmt: on
