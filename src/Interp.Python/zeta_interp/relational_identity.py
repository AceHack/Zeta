"""Independent exact regeneration of the registered relational-receipt panel.

The verifier is a fixture table, never a cryptographic implementation. This
module reads no native outputs while regenerating its expected semantic panel.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, replace
from fractions import Fraction
from hashlib import sha256
from itertools import combinations, permutations, product
from math import isfinite
from pathlib import Path
from typing import Any


@dataclass(frozen=True, order=True)
class Receipt:
    EventId: str
    Actor: str
    Counterparty: str
    Interaction: str
    Channel: str
    Claim: str
    Weight: int
    Parents: tuple[str, ...]


@dataclass(frozen=True)
class Occurrence:
    position: int
    clock: int
    receipt: Receipt
    attestation: str


@dataclass(frozen=True)
class View:
    observer: str
    occurrences: tuple[Occurrence, ...]


RECEIPTS = (
    Receipt("e0", "A", "B", "i0", "vision", "color", 1, ()),
    Receipt("e1", "A", "B", "i1", "vision", "color", -1, ("e0",)),
    Receipt("e2", "B", "A", "i0", "vision", "color", 1, ("e0",)),
    Receipt("e3", "A", "B", "i2", "receipt", "ack", 1, ("e1", "e2")),
)
EXPECTED = tuple(r.EventId for r in RECEIPTS)
TABLE = {(r, "fixture-" + r.EventId) for r in RECEIPTS}


def view(observer: str, receipts: tuple[Receipt, ...]) -> View:
    return View(
        observer,
        tuple(
            Occurrence(i, i, r, "fixture-" + r.EventId) for i, r in enumerate(receipts)
        ),
    )


def authenticate(table: set[tuple[Receipt, str]], item: Occurrence) -> str:
    if item.attestation == "unavailable":
        return "unavailable"
    return "accepted" if (item.receipt, item.attestation) in table else "rejected"


def wire_invariant(
    receipts: set[Receipt], pairs: set[tuple[str, str]]
) -> dict[str, Any]:
    balances: Counter[tuple[str, str, str, str]] = Counter()
    for r in receipts:
        balances[r.Actor, r.Counterparty, r.Channel, r.Claim] += r.Weight
    return {
        "Receipts": [
            {**asdict(r), "Parents": list(r.Parents)} for r in sorted(receipts)
        ],
        "CausalPairs": [list(p) for p in sorted(pairs)],
        "Claims": [
            list(key) + [str(weight)]
            for key, weight in sorted(balances.items())
            if weight
        ],
    }


def compare(
    name: str,
    table: set[tuple[Receipt, str]],
    cut: tuple[str, ...],
    left: View,
    right: View,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "Name": name,
        "Status": "",
        "Expected": sorted(set(cut)),
        "RepeatedLeft": 0,
        "RepeatedRight": 0,
        "Invariant": [],
    }
    for field in (
        "MissingLeft",
        "MissingRight",
        "UnverifiedLeft",
        "UnverifiedRight",
        "RejectedLeft",
        "RejectedRight",
        "Conflicts",
        "BoundaryParents",
    ):
        out[field] = []
    cut_set = set(cut)
    for v in (left, right):
        if len(v.occurrences) > 256 or any(
            o.receipt.EventId not in cut_set for o in v.occurrences
        ):
            out["Status"] = "refused-input"
            return out
        if len({o.position for o in v.occurrences}) != len(v.occurrences) or any(
            o.position < 0 for o in v.occurrences
        ):
            out["Status"] = "refused-coordinates"
            return out
    accepted_views: list[list[Occurrence]] = []
    union: set[Receipt] = set()
    unknown = False
    rejected = False
    for suffix, v in (("Left", left), ("Right", right)):
        normalized = [
            replace(
                o,
                receipt=replace(
                    o.receipt, Parents=tuple(sorted(set(o.receipt.Parents)))
                ),
            )
            for o in v.occurrences
        ]
        accepted = [o for o in normalized if authenticate(table, o) == "accepted"]
        accepted_views.append(accepted)
        accepted_ids = {o.receipt.EventId for o in accepted}
        unverified = {
            o.receipt.EventId
            for o in normalized
            if authenticate(table, o) == "unavailable"
        }
        invalid = {
            o.receipt.EventId
            for o in normalized
            if authenticate(table, o) == "rejected"
        }
        out["Missing" + suffix] = sorted(
            cut_set - {o.receipt.EventId for o in normalized}
        )
        out["Unverified" + suffix] = sorted(unverified)
        out["Rejected" + suffix] = sorted(invalid)
        out["Repeated" + suffix] = len(accepted) - len({o.receipt for o in accepted})
        unknown |= not cut_set <= accepted_ids or bool(unverified)
        rejected |= bool(invalid)
        union.update(o.receipt for o in accepted)
    grouped: dict[str, set[Receipt]] = defaultdict(set)
    parents: dict[str, set[str]] = defaultdict(set)
    for r in union:
        grouped[r.EventId].add(r)
        parents[r.EventId].update(r.Parents)
    out["Conflicts"] = sorted(
        event for event, contents in grouped.items() if len(contents) > 1
    )
    out["BoundaryParents"] = sorted(
        {p for values in parents.values() for p in values} - cut_set
    )
    unknown |= bool(out["BoundaryParents"])
    # DFS from each event provides an algorithm independent of the native pivot closure.
    pairs: set[tuple[str, str]] = set()
    for target in grouped:
        frontier = list(parents[target])
        visited: set[str] = set()
        while frontier:
            ancestor = frontier.pop()
            if ancestor in visited or ancestor not in grouped:
                continue
            visited.add(ancestor)
            pairs.add((ancestor, target))
            frontier.extend(parents[ancestor])
    cycle = any(a == b for a, b in pairs)
    if not out["Conflicts"] and not cycle:
        for items in accepted_views:
            positions: dict[str, int] = {}
            for o in items:
                positions[o.receipt.EventId] = min(
                    o.position, positions.get(o.receipt.EventId, o.position)
                )
            if any(
                a in positions and b in positions and positions[a] >= positions[b]
                for a, b in pairs
            ):
                empty = compare(name, set(), (), View("A", ()), View("B", ()))
                empty.update(
                    Status="refused-coordinates", Expected=sorted(cut_set), Invariant=[]
                )
                return empty
    if out["Conflicts"]:
        out["Status"] = "authenticated-conflict"
    elif cycle:
        out["Status"] = "authenticated-causal-cycle"
    elif rejected:
        out["Status"] = "authentication-rejected"
    elif unknown:
        out["Status"] = "unknown-coverage"
    else:
        out["Status"] = "consistent-on-declared-cut"
        out["Invariant"] = [wire_invariant(union, pairs)]
    return out


def transport_panel() -> dict[str, Any]:
    left = view("A", RECEIPTS)
    invariant = compare("", TABLE, EXPECTED, left, left)["Invariant"][0]
    arrivals = list(permutations(EXPECTED))
    topologies = [
        order
        for order in arrivals
        if all(
            order.index(parent) < order.index(r.EventId)
            for r in RECEIPTS
            for parent in r.Parents
        )
    ]
    by_id = {r.EventId: r for r in RECEIPTS}
    checks = 0
    for order in topologies:
        original = view("B", tuple(by_id[event] for event in order))
        by_event = {o.receipt.EventId: o for o in original.occurrences}
        for arrival, offset, scale in product(arrivals, (-1000, 0, 1000), (1, 7)):
            shuffled = View("B", tuple(by_event[event] for event in arrival))
            moved = View(
                "B",
                tuple(
                    replace(
                        o, position=3 * o.position + 5, clock=offset + scale * o.clock
                    )
                    for o in shuffled.occurrences
                ),
            )
            assert compare("", TABLE, EXPECTED, left, moved)["Invariant"] == [invariant]
            restored = View(
                "B",
                tuple(
                    replace(
                        o,
                        position=(o.position - 5) // 3,
                        clock=(o.clock - offset) // scale,
                    )
                    for o in moved.occurrences
                ),
            )
            assert restored == shuffled
            intermediate = tuple(
                replace(o, position=o.position + 3, clock=o.clock + 11)
                for o in moved.occurrences
            )
            successive = View(
                "B",
                tuple(
                    replace(o, position=7 * o.position, clock=5 * o.clock)
                    for o in intermediate
                ),
            )
            direct = View(
                "B",
                tuple(
                    replace(o, position=7 * (o.position + 3), clock=5 * (o.clock + 11))
                    for o in moved.occurrences
                ),
            )
            assert successive == direct
            assert compare("", TABLE, EXPECTED, left, direct)["Invariant"] == [
                invariant
            ]
            checks += 1
    return {
        "ArrivalOrders": len(arrivals),
        "TopologicalOrders": [list(o) for o in topologies],
        "Checks": checks,
        "InverseChecks": checks,
        "CompositionChecks": checks,
        "Invariant": invariant,
    }


def mutation_panel() -> list[dict[str, Any]]:
    left, right = view("A", RECEIPTS), view("B", RECEIPTS)

    def update(v: View, event: str, **fields: Any) -> View:
        return replace(
            v,
            occurrences=tuple(
                replace(o, **fields) if o.receipt.EventId == event else o
                for o in v.occurrences
            ),
        )

    def omit(v: View, event: str) -> View:
        return replace(
            v, occurrences=tuple(o for o in v.occurrences if o.receipt.EventId != event)
        )

    changed = replace(RECEIPTS[2], Claim="green")
    forked = update(right, "e2", receipt=changed, attestation="fixture-fork")
    fork_table = TABLE | {(changed, "fixture-fork")}
    cyclic = replace(RECEIPTS[0], Parents=("e3",))
    cycle_table = TABLE | {(cyclic, "fixture-cycle")}
    boundary = replace(RECEIPTS[0], Parents=("outside",))
    boundary_table = TABLE | {(boundary, "fixture-boundary")}
    alternate = replace(RECEIPTS[2], EventId="e4", Channel="auditory")
    extended = RECEIPTS + (alternate,)
    fabricated = tuple(
        Receipt(
            f"f{actor}-{counterparty}",
            f"fake{actor}",
            f"fake{counterparty}",
            f"pair{a}-{b}",
            "fixture",
            "exchange",
            1,
            (),
        )
        for a, b in combinations(range(4), 2)
        for actor, counterparty in ((a, b), (b, a))
    )
    fabricated_table = {(r, "fixture-" + r.EventId) for r in fabricated}
    return [
        compare("baseline", TABLE, EXPECTED, left, right),
        compare(
            "identical-replay",
            TABLE,
            EXPECTED,
            left,
            replace(
                right,
                occurrences=right.occurrences
                + (replace(right.occurrences[0], position=10, clock=99),),
            ),
        ),
        compare(
            "changed-payload-old-attestation",
            TABLE,
            EXPECTED,
            left,
            update(right, "e2", receipt=changed),
        ),
        compare(
            "substituted-key",
            TABLE,
            EXPECTED,
            left,
            update(right, "e2", receipt=replace(RECEIPTS[2], Actor="C")),
        ),
        compare("authenticated-fork", fork_table, EXPECTED, left, forked),
        compare(
            "authenticated-causal-cycle",
            cycle_table,
            EXPECTED,
            update(left, "e0", receipt=cyclic, attestation="fixture-cycle"),
            update(right, "e0", receipt=cyclic, attestation="fixture-cycle"),
        ),
        compare("missing-parent", TABLE, EXPECTED, left, omit(right, "e0")),
        compare("omitted-expected-event", TABLE, EXPECTED, left, omit(right, "e3")),
        compare(
            "unavailable-verifier",
            TABLE,
            EXPECTED,
            left,
            update(right, "e2", attestation="unavailable"),
        ),
        compare(
            "conflict-with-missing-coverage",
            fork_table,
            EXPECTED,
            left,
            omit(forked, "e3"),
        ),
        compare(
            "different-observation-channel",
            TABLE | {(alternate, "fixture-e4")},
            EXPECTED + ("e4",),
            view("A", extended),
            view("B", extended),
        ),
        compare("coherent-fabricated-counterparties", TABLE, EXPECTED, left, right),
        compare(
            "coherent-fabricated-complete-graph",
            fabricated_table,
            tuple(r.EventId for r in fabricated),
            view("A", fabricated),
            view("B", fabricated),
        ),
        compare(
            "unverified-alternative-with-covered-id",
            TABLE,
            EXPECTED,
            left,
            replace(
                right,
                occurrences=right.occurrences
                + (
                    replace(
                        right.occurrences[2],
                        position=10,
                        receipt=changed,
                        attestation="unavailable",
                    ),
                ),
            ),
        ),
        compare(
            "open-causal-boundary",
            boundary_table,
            EXPECTED,
            update(left, "e0", receipt=boundary, attestation="fixture-boundary"),
            update(right, "e0", receipt=boundary, attestation="fixture-boundary"),
        ),
        compare(
            "causal-coordinate-reversal",
            TABLE,
            EXPECTED,
            left,
            replace(
                right,
                occurrences=tuple(
                    replace(o, position=3 - o.position) for o in right.occurrences
                ),
            ),
        ),
        compare(
            "coordinate-collision",
            TABLE,
            EXPECTED,
            left,
            replace(
                right,
                occurrences=tuple(replace(o, position=0) for o in right.occurrences),
            ),
        ),
        compare("empty-cut", set(), (), view("A", ()), view("B", ())),
    ]


def entropy_panel() -> list[dict[str, Any]]:
    panels: list[tuple[str, list[tuple[int, ...]]]] = [
        ("independent", list(product(range(2), repeat=3))),
        ("copies", [(a, a, a) for a in range(2)]),
        ("inversion", [(a, 1 - a, a) for a in range(2)]),
        (
            "pairwise-independent-xor",
            [(a, b, a ^ b) for a, b in product(range(2), repeat=2)],
        ),
    ]
    output = []
    for name, rows in panels:
        n = len(rows)
        maximum = Fraction(max(Counter(rows).values()), n)
        pairwise = all(
            Fraction(sum(row[a] == x and row[b] == y for row in rows), n)
            == Fraction(sum(row[a] == x for row in rows), n)
            * Fraction(sum(row[b] == y for row in rows), n)
            for a, b in combinations(range(3), 2)
            for x, y in product(range(2), repeat=2)
        )
        premise = True
        for column in range(3):
            prefixes = {row[:column] for row in rows}
            for prefix in prefixes:
                group = [row for row in rows if row[:column] == prefix]
                premise &= max(
                    Counter(row[column] for row in group).values()
                ) * 2 <= len(group)
        denominator = maximum.denominator // maximum.numerator
        assert denominator > 0 and denominator & (denominator - 1) == 0
        output.append(
            {
                "Name": name,
                "Outcomes": [list(row) for row in rows],
                "MaximumProbability": [
                    str(maximum.numerator),
                    str(maximum.denominator),
                ],
                "JointMinEntropyBits": denominator.bit_length() - 1,
                "PairwiseIndependent": pairwise,
                "OneBitConditionalPremise": premise,
            }
        )
    return output


def scaling_panel() -> list[dict[str, Any]]:
    output = []
    for n, shape in product(
        (0, 1, 2, 3, 4, 8, 16, 32, 64), ("empty", "complete", "path", "star", "cycle")
    ):
        if shape == "complete":
            pairs = set(combinations(range(n), 2))
        elif shape == "path":
            pairs = {(i, i + 1) for i in range(n - 1)}
        elif shape == "star":
            pairs = {(0, i) for i in range(1, n)}
        elif shape == "cycle" and n >= 3:
            pairs = {(min(i, (i + 1) % n), max(i, (i + 1) % n)) for i in range(n)}
        else:
            pairs = set()
        baseline, relational = n * 32, len(pairs) * 8
        total = baseline + relational
        multiplier = Fraction(total, baseline) if baseline else None
        output.append(
            {
                "Name": f"{shape}-{n}",
                "Identities": n,
                "Required": len(pairs),
                "Observed": max(0, len(pairs) - 1),
                "Missing": int(bool(pairs)),
                "Baseline": str(baseline),
                "Relational": str(relational),
                "Total": str(total),
                "Multiplier": [str(multiplier.numerator), str(multiplier.denominator)]
                if multiplier
                else [],
            }
        )
    return output


def chsh(a: list[dict[str, int]], b: list[dict[str, int]]) -> float:
    buckets: dict[tuple[int, int], list[int]] = defaultdict(list)
    for ra, rb in zip(a, b, strict=True):
        buckets[ra["Setting"], rb["Setting"]].append(ra["Outcome"] * rb["Outcome"])
    return sum(
        ((-1 if key == (0, 1) else 1) * sum(values) / len(values))
        for key, values in buckets.items()
    )


def baseline_panel() -> list[dict[str, Any]]:
    a = [0, 0, 1, 1, 0, 0, 1, 1]
    code = [0, 1, 0, 1, 0, 1, 0, 1]
    chsh_a = [{"Setting": i // 2 % 2, "Outcome": 1} for i in range(8)]
    local = [{"Setting": i % 2, "Outcome": 1} for i in range(8)]
    conducted = [
        {"Setting": i % 2, "Outcome": -1 if i % 4 == 1 else 1} for i in range(8)
    ]
    cases = [
        ("exact-replay", True, a, local),
        ("inverted-replay", True, [1 - x for x in a], local),
        ("shared-seed-orthogonal-code", True, code, local),
        ("independent-finite-collision", False, a, local),
        ("distinct-controller-transcript", False, code, local),
        ("one-controller-same-transcript", True, code, local),
        ("conducted-chsh", True, code, conducted),
    ]
    output = []
    for name, shared, b, rounds in cases:
        correlation = abs(
            2 * sum(x == y for x, y in zip(a, b, strict=True)) / len(a) - 1
        )
        flag = correlation >= 0.8
        signature = (
            "accepted"
            if all(
                authenticate(TABLE, item) == "accepted"
                for item in view("A", RECEIPTS).occurrences
            )
            else "rejected"
        )
        output.append(
            {
                "Name": name,
                "SharedController": shared,
                "BitsA": a,
                "BitsB": b,
                "ChshA": chsh_a,
                "ChshB": rounds,
                "Correlation": correlation,
                "ReplayFlag": flag,
                "SignatureOnly": signature,
                "ReceiptStatus": compare(
                    "", TABLE, EXPECTED, view("A", RECEIPTS), view("B", RECEIPTS)
                )["Status"],
                "Spectrum": [max(abs(chsh(chsh_a, rounds)), abs(chsh(rounds, chsh_a)))],
                "ReplayFalsePositive": flag and not shared,
                "ReplayFalseNegative": shared and not flag,
            }
        )
    return output


def semantic_panel() -> dict[str, Any]:
    return {
        "Transport": transport_panel(),
        "Mutations": mutation_panel(),
        "Entropy": entropy_panel(),
        "Scaling": scaling_panel(),
        "Baselines": baseline_panel(),
    }


def semantic_equal(actual: Any, expected: Any) -> bool:
    """Match the wire schema while admitting JSON integers for floating statistics."""
    if isinstance(expected, bool):
        return type(actual) is bool and actual == expected
    if isinstance(expected, int):
        return type(actual) is int and actual == expected
    if isinstance(expected, float):
        return type(actual) in (int, float) and isfinite(actual) and actual == expected
    if isinstance(expected, dict):
        return (
            type(actual) is dict
            and actual.keys() == expected.keys()
            and all(
                semantic_equal(actual[key], value) for key, value in expected.items()
            )
        )
    if isinstance(expected, list):
        return (
            type(actual) is list
            and len(actual) == len(expected)
            and all(semantic_equal(a, b) for a, b in zip(actual, expected, strict=True))
        )
    return type(actual) is type(expected) and actual == expected


def verify_saved(
    saved: dict[str, Any], root: Path, *, check_source_snapshot: bool = True
) -> dict[str, Any]:
    if (
        saved.get("Protocol") != "relational-identity-v1"
        or saved.get("SourceArchive")
        != "archive/relational-identity-20260906-source-v4"
    ):
        raise ValueError("unexpected protocol or source archive")
    if saved.get("ProtocolCommit") != "4f470f40e":
        raise ValueError("unexpected preregistration commit")
    source_commit = saved.get("SourceCommit")
    if (
        not isinstance(source_commit, str)
        or len(source_commit) != 40
        or any(character not in "0123456789abcdef" for character in source_commit)
    ):
        raise ValueError("invalid resolved source commit")
    if check_source_snapshot:
        resolved = (
            subprocess.check_output(
                [
                    "git",
                    "rev-parse",
                    "refs/tags/" + saved["SourceArchive"] + "^{commit}",
                ],
                cwd=root,
            )
            .decode()
            .strip()
        )
        if source_commit != resolved:
            raise ValueError("resolved source archive differs from receipt")
    expected_paths = {
        "docs/research/relational-identity/2026-09-06-protocol.md",
        "docs/research/relational-identity/2026-09-06-clarification.md",
        "docs/research/relational-identity/2026-09-06-source-repairs.md",
        "src/Research.FSharp/RelationalIdentity.fs",
        "src/Research.FSharp/RelationalIdentityExperiment.fs",
        "src/Research.FSharp/run-relational-identity.fsx",
        "src/Interp.Python/zeta_interp/relational_identity.py",
        "src/Core/AntiSybil.fs",
        "src/Core/CoordinationSpectrum.fs",
    }
    hashes = saved.get("SourceHashes", [])
    if (
        not isinstance(hashes, list)
        or len(hashes) != len(expected_paths)
        or any(
            not isinstance(row, dict)
            or row.keys() != {"Path", "Sha256"}
            or not isinstance(row["Path"], str)
            for row in hashes
        )
        or {row["Path"] for row in hashes} != expected_paths
    ):
        raise ValueError("source hash coverage differs from registered files")
    for row in hashes:
        digest = row.get("Sha256")
        if (
            not isinstance(digest, str)
            or len(digest) != 64
            or any(character not in "0123456789ABCDEF" for character in digest)
        ):
            raise ValueError("invalid source SHA256: " + row["Path"])
        if check_source_snapshot and (
            sha256((root / row["Path"]).read_bytes()).hexdigest().upper() != digest
        ):
            raise ValueError("source hash mismatch: " + row["Path"])
        if check_source_snapshot:
            archived = subprocess.check_output(
                ["git", "show", source_commit + ":" + row["Path"]], cwd=root
            )
            if sha256(archived).hexdigest().upper() != digest:
                raise ValueError(
                    "source differs from immutable archive: " + row["Path"]
                )
    expected = semantic_panel()
    if not semantic_equal(saved.get("Semantic"), expected):
        raise ValueError(
            "native receipt differs from independently regenerated semantic panel"
        )
    return {
        "Protocol": "relational-identity-independent-replay-v1",
        "SourceArchive": saved["SourceArchive"],
        "SourceCommit": source_commit,
        "ExactSemanticMatch": True,
        "SourceSnapshotVerified": check_source_snapshot,
        "TransportChecks": expected["Transport"]["Checks"],
        "MutationCases": len(expected["Mutations"]),
        "EntropyCases": len(expected["Entropy"]),
        "ScalingCases": len(expected["Scaling"]),
        "BaselineCases": len(expected["Baselines"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipt", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("refusing to overwrite replay output")
    root = Path(__file__).resolve().parents[3]
    result = verify_saved(json.loads(args.receipt.read_text()), root)
    result["NativeReceiptSha256"] = (
        sha256(args.receipt.read_bytes()).hexdigest().upper()
    )
    args.output.write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main()
