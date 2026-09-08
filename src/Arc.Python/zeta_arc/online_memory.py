"""Canonical, score-free online-memory receipt emission for the ARC lane.

This is deliberately not a learner or a policy. It records a lawful memory
update after an interaction so an independently authored verifier can replay the
declared causal chain, inspect memory provenance, and reject pre-observation
current-level payload. The emitted carrier is ordinary canonical JSON bytes.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass

CONTRACT_VERSION = "arc-online-memory/v1"

# fmt: off
# The carrier spelling mirrors the frozen contract fields; keep it stable for
# direct raw-byte review instead of allowing unrelated formatting churn.
_PARTITIONS = frozenset(
    {
        "cross_game_memory",
        "prior_level_memory",
        "current_level_live",
        "current_level_preload",
        "static_program",
        "runner_metadata",
    }
)


class OnlineMemoryReceiptError(ValueError):
    """A malformed or task-boundary-violating memory receipt input."""


def canonical_bytes(value: object) -> bytes:
    """Encode one JSON value with the receipt's declared canonical spelling."""

    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def digest(value: object) -> str:
    """SHA-256 of canonical receipt bytes."""

    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def _require_string(value: object, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise OnlineMemoryReceiptError(f"{field} must be a non-empty string")
    return value


def _require_int(value: object, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise OnlineMemoryReceiptError(f"{field} must be an integer")
    return value


def _entry_id(entry: Mapping[str, object]) -> str:
    return _require_string(entry.get("memory_id"), "memory_id")


def _validate_entry(entry: Mapping[str, object], event_seq: int, barrier_seq: int) -> None:
    memory_id = _entry_id(entry)
    partition = _require_string(entry.get("partition"), f"{memory_id}.partition")
    if partition not in _PARTITIONS:
        raise OnlineMemoryReceiptError(f"{memory_id}.partition is unknown: {partition}")
    _require_string(entry.get("origin"), f"{memory_id}.origin")
    _require_string(entry.get("payload_digest"), f"{memory_id}.payload_digest")
    if partition == "current_level_preload":
        raise OnlineMemoryReceiptError(
            f"{memory_id} is current-level preload and cannot enter the receipt"
        )
    if partition == "current_level_live" and event_seq < barrier_seq:
        raise OnlineMemoryReceiptError(
            f"{memory_id} is current-level live memory before first legal observation"
        )


def _validate_uncertainty(uncertainty: Mapping[str, object]) -> None:
    _require_int(uncertainty.get("mean_ppm"), "uncertainty.mean_ppm")
    precision = _require_int(uncertainty.get("precision_ppm"), "uncertainty.precision_ppm")
    if precision <= 0:
        raise OnlineMemoryReceiptError("uncertainty.precision_ppm must be positive")


def _memory_digest(memory: Mapping[str, Mapping[str, object]]) -> str:
    return digest({key: memory[key] for key in sorted(memory)})


def emit_update(
    *,
    lineage_id: str,
    logical_seq: int,
    previous_update_id: str | None,
    previous_memory: Mapping[str, Mapping[str, object]],
    event: Mapping[str, object],
    memory_reads: Sequence[Mapping[str, object]],
    memory_writes: Sequence[Mapping[str, object]],
    uncertainty: Mapping[str, object],
    update_rule: Mapping[str, object],
    task_barrier: Mapping[str, object],
) -> dict[str, object]:
    """Emit one asserted online-memory update without scoring an agent.

    ``previous_memory`` is caller-owned state. The function creates a new
    immutable atom and never mutates the supplied mapping.
    """

    _require_string(lineage_id, "lineage_id")
    if logical_seq <= 0:
        raise OnlineMemoryReceiptError("logical_seq must be positive")
    if previous_update_id is not None:
        _require_string(previous_update_id, "previous_update_id")
    event_seq = _require_int(event.get("event_seq"), "event.event_seq")
    _require_string(event.get("event_digest"), "event.event_digest")
    barrier_seq = _require_int(task_barrier.get("first_legal_observation_seq"), "task_barrier.first_legal_observation_seq")
    _require_string(task_barrier.get("current_level_id"), "task_barrier.current_level_id")
    if barrier_seq <= 0:
        raise OnlineMemoryReceiptError("task_barrier.first_legal_observation_seq must be positive")
    _validate_uncertainty(uncertainty)
    _require_string(update_rule.get("rule_id"), "update_rule.rule_id")
    _require_string(update_rule.get("parameters_digest"), "update_rule.parameters_digest")

    before = {key: deepcopy(value) for key, value in previous_memory.items()}
    for key, entry in before.items():
        if key != _entry_id(entry):
            raise OnlineMemoryReceiptError(f"previous_memory key {key} differs from entry memory_id")
        _validate_entry(entry, event_seq, barrier_seq)

    for entry in memory_reads:
        _validate_entry(entry, event_seq, barrier_seq)
        memory_id = _entry_id(entry)
        if memory_id not in before:
            raise OnlineMemoryReceiptError(f"memory read {memory_id} is absent from prior memory")
        if before[memory_id] != dict(entry):
            raise OnlineMemoryReceiptError(f"memory read {memory_id} does not match prior memory")

    after = {key: deepcopy(value) for key, value in before.items()}
    for entry in memory_writes:
        _validate_entry(entry, event_seq, barrier_seq)
        memory_id = _entry_id(entry)
        after[memory_id] = deepcopy(dict(entry))

    body: dict[str, object] = {
        "contract_version": CONTRACT_VERSION,
        "kind": "update",
        "lineage_id": lineage_id,
        "logical_seq": logical_seq,
        "previous_update_id": previous_update_id,
        "before_memory_digest": _memory_digest(before),
        "after_memory_digest": _memory_digest(after),
        "event": dict(event),
        "memory_reads": [dict(entry) for entry in memory_reads],
        "memory_writes": [dict(entry) for entry in memory_writes],
        "uncertainty": dict(uncertainty),
        "update_rule": dict(update_rule),
        "task_barrier": dict(task_barrier),
        "weight": 1,
    }
    return {**body, "update_id": digest(body)}


def emit_retraction(update: Mapping[str, object]) -> dict[str, object]:
    """Emit the exact ``−1`` counterpart of one asserted update atom."""

    target = _require_string(update.get("update_id"), "update.update_id")
    uncertainty = update.get("uncertainty")
    if not isinstance(uncertainty, Mapping):
        raise OnlineMemoryReceiptError("update.uncertainty must be an object")
    _validate_uncertainty(uncertainty)
    body: dict[str, object] = {
        "contract_version": CONTRACT_VERSION,
        "kind": "retraction",
        "target_update_id": target,
        "uncertainty": dict(uncertainty),
        "weight": -1,
    }
    return {**body, "retraction_id": digest(body)}


@dataclass
class OnlineMemoryEmitter:
    """A minimal mutable convenience wrapper over immutable update atoms."""

    lineage_id: str
    memory: dict[str, dict[str, object]]
    previous_update_id: str | None = None
    logical_seq: int = 0

    def append(
        self,
        *,
        event: Mapping[str, object],
        memory_reads: Sequence[Mapping[str, object]],
        memory_writes: Sequence[Mapping[str, object]],
        uncertainty: Mapping[str, object],
        update_rule: Mapping[str, object],
        task_barrier: Mapping[str, object],
    ) -> dict[str, object]:
        """Append one lawful update and advance this emitter's local state."""

        atom = emit_update(
            lineage_id=self.lineage_id,
            logical_seq=self.logical_seq + 1,
            previous_update_id=self.previous_update_id,
            previous_memory=self.memory,
            event=event,
            memory_reads=memory_reads,
            memory_writes=memory_writes,
            uncertainty=uncertainty,
            update_rule=update_rule,
            task_barrier=task_barrier,
        )
        for entry in memory_writes:
            self.memory[_entry_id(entry)] = deepcopy(dict(entry))
        self.previous_update_id = _require_string(atom.get("update_id"), "atom.update_id")
        self.logical_seq += 1
        return atom
# fmt: on
