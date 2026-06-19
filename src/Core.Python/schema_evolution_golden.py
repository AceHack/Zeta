#!/usr/bin/env python3
"""Schema evolution golden vector conformance — Python oracle (#5 of 10).

Parses schema-golden-vectors.json, replays deltas, asserts value-equality.
Zero dependencies beyond stdlib (json, sys).
"""

import json
import sys


def apply_delta(schema: list[tuple[dict, int]], delta: dict) -> list[tuple[dict, int]]:
    """Apply a schema evolution delta. Retract at -1, insert at +1, drop weight=0."""
    # Build name → (field, weight) map
    m: dict[str, tuple[dict, int]] = {}
    for field, weight in schema:
        name = field["name"]
        if name in m:
            m[name] = (field, m[name][1] + weight)
        else:
            m[name] = (field, weight)

    for field in delta["retract"]:
        name = field["name"]
        if name in m:
            m[name] = (field, m[name][1] - 1)
        else:
            m[name] = (field, -1)

    for field in delta["insert"]:
        name = field["name"]
        if name in m:
            m[name] = (field, m[name][1] + 1)
        else:
            m[name] = (field, 1)

    # Drop zero-weight entries
    return [(field, w) for field, w in m.values() if w != 0]


def active_fields(schema: list[tuple[dict, int]]) -> list[dict]:
    return [field for field, w in schema if w > 0]


def sorted_field_names(schema: list[tuple[dict, int]]) -> list[str]:
    return sorted(f["name"] for f, w in schema if w > 0)


def main() -> int:
    if len(sys.argv) < 2:
        print(
            "Usage: python schema_evolution_golden.py <path-to-json>", file=sys.stderr
        )
        return 1

    with open(sys.argv[1]) as f:
        vectors = json.load(f)

    initial_fields = vectors["initialFields"]
    deltas = vectors["deltas"]
    expected_states = vectors["expectedReplayStates"]
    expected_final = vectors["expectedFinalState"]
    comm_pairs = vectors["commutativePairs"]

    # Initialize schema
    schema = [(field, 1) for field in initial_fields]

    # Replay deltas
    print("--- Replaying deltas ---")
    replay_states = []
    for i, delta in enumerate(deltas):
        schema = apply_delta(schema, delta)
        replay_states.append(schema)

        active = active_fields(schema)
        expected = expected_states[i]

        assert len(active) == expected["entryCount"], (
            f"Delta {i} count mismatch: expected {expected['entryCount']}, got {len(active)}"
        )
        print(f"  Delta {i}: {len(active)} fields ✓")

    # Final state
    print("--- Final state ---")
    final_names = sorted_field_names(schema)
    assert final_names == expected_final["fieldNames"], (
        f"Final names mismatch: {final_names} != {expected_final['fieldNames']}"
    )
    assert len(active_fields(schema)) == expected_final["fieldCount"]
    print(f"  Final: {len(final_names)} fields [{', '.join(final_names)}] ✓")

    # Commutativity
    print("--- Commutativity ---")
    initial_schema = [(field, 1) for field in initial_fields]
    for pair in comm_pairs:
        a, b = pair["deltaA"], pair["deltaB"]
        state_ab = apply_delta(apply_delta(initial_schema, deltas[a]), deltas[b])
        state_ba = apply_delta(apply_delta(initial_schema, deltas[b]), deltas[a])

        names_ab = sorted_field_names(state_ab)
        names_ba = sorted_field_names(state_ba)
        assert names_ab == names_ba, f"Deltas ({a},{b}) do not commute"
        print(f"  Deltas ({a},{b}) commute ✓")

    print("\nAll golden vectors passed! (Python oracle #5)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
