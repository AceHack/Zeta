"""Independent exact replay and deliberately corrupted receipt controls."""

import json
import subprocess
from copy import deepcopy
from dataclasses import replace
from hashlib import sha256
from pathlib import Path

import pytest

from zeta_interp import relational_identity as r

ROOT = Path(__file__).resolve().parents[3]
RECEIPT = ROOT / "src/Research.FSharp/relational-identity-results.json"


def test_saved_native_receipt_matches_independent_regeneration() -> None:
    result = r.verify_saved(
        json.loads(RECEIPT.read_text()), ROOT, check_source_snapshot=False
    )
    assert result["ExactSemanticMatch"]
    assert result["TransportChecks"] == 288
    assert result["MutationCases"] == 18


@pytest.mark.parametrize(
    "field",
    [
        "entropy",
        "coverage",
        "controller",
        "hashes",
        "extra_hash",
        "invariant",
        "archive",
        "boolean_count",
        "numeric_boolean",
        "boolean_statistic",
        "extra_semantic",
    ],
)
def test_corrupted_receipt_is_rejected(field: str) -> None:
    saved = deepcopy(json.loads(RECEIPT.read_text()))
    if field == "entropy":
        saved["Semantic"]["Entropy"][3]["JointMinEntropyBits"] = 3
    elif field == "coverage":
        saved["Semantic"]["Mutations"][6]["Status"] = "consistent-on-declared-cut"
    elif field == "controller":
        saved["Semantic"]["Baselines"][5]["SharedController"] = False
    elif field == "hashes":
        saved["SourceHashes"][0]["Sha256"] = "00"
    elif field == "extra_hash":
        saved["SourceHashes"].append(saved["SourceHashes"][0])
    elif field == "invariant":
        saved["Semantic"]["Transport"]["Invariant"]["Claims"] = []
    elif field == "boolean_count":
        saved["Semantic"]["Mutations"][0]["RepeatedLeft"] = False
    elif field == "numeric_boolean":
        saved["Semantic"]["Baselines"][0]["SharedController"] = 1
    elif field == "boolean_statistic":
        saved["Semantic"]["Baselines"][0]["Correlation"] = True
    elif field == "extra_semantic":
        saved["Semantic"]["unregistered"] = 0
    else:
        saved["SourceArchive"] = "unregistered-source"
    with pytest.raises(ValueError):
        r.verify_saved(saved, ROOT, check_source_snapshot=False)


def test_independent_fork_diagnostics_are_arrival_invariant() -> None:
    first = replace(r.RECEIPTS[0], Parents=("outside-a",))
    second = replace(r.RECEIPTS[0], Parents=("outside-b",))
    table = {(first, "first"), (second, "second")}
    occurrences = (
        r.Occurrence(0, 0, first, "first"),
        r.Occurrence(1, 1, second, "second"),
    )
    forward = r.View("A", occurrences)
    backward = r.View("A", occurrences[::-1])
    a = r.compare("fork", table, ("e0",), forward, forward)
    b = r.compare("fork", table, ("e0",), backward, backward)
    assert a == b
    assert a["BoundaryParents"] == ["outside-a", "outside-b"]
    assert a["RepeatedLeft"] == 0
    assert a["Status"] == "authenticated-conflict"


def test_pairwise_independence_is_not_joint_entropy_additivity() -> None:
    row = r.entropy_panel()[3]
    assert row["PairwiseIndependent"]
    assert not row["OneBitConditionalPremise"]
    assert row["MaximumProbability"] == ["1", "4"]
    assert row["JointMinEntropyBits"] == 2


def test_strict_replay_checks_a_supplied_source_snapshot(tmp_path: Path) -> None:
    # Build an explicitly current test snapshot, not a claim that history changed.
    saved = json.loads(RECEIPT.read_text())
    for row in saved["SourceHashes"]:
        content = (ROOT / row["Path"]).read_bytes()
        path = tmp_path / row["Path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        row["Sha256"] = sha256(content).hexdigest().upper()

    def git(*arguments: str) -> bytes:
        return subprocess.check_output(
            [
                "git",
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@example.invalid",
                *arguments,
            ],
            cwd=tmp_path,
            stderr=subprocess.DEVNULL,
        )

    git("init", "--quiet")
    git("add", ".")
    git("commit", "--quiet", "-m", "Synthetic source snapshot fixture")
    git("tag", saved["SourceArchive"])
    saved["SourceCommit"] = git("rev-parse", "HEAD").decode().strip()
    assert r.verify_saved(saved, tmp_path)["SourceSnapshotVerified"]
    path = tmp_path / saved["SourceHashes"][0]["Path"]
    path.write_bytes(path.read_bytes() + b"changed")
    with pytest.raises(ValueError, match="source hash mismatch"):
        r.verify_saved(saved, tmp_path)
    altered = deepcopy(saved)
    altered["SourceHashes"][0]["Sha256"] = sha256(path.read_bytes()).hexdigest().upper()
    with pytest.raises(ValueError, match="source differs from immutable archive"):
        r.verify_saved(altered, tmp_path)
    historical = r.verify_saved(saved, tmp_path, check_source_snapshot=False)
    assert historical["ExactSemanticMatch"]
    assert not historical["SourceSnapshotVerified"]
    # Semantic replay can run without any current source files. Schema remains checked.
    assert r.verify_saved(saved, tmp_path / "absent", check_source_snapshot=False)[
        "ExactSemanticMatch"
    ]


def test_unavailable_alternative_remains_unknown_when_event_id_is_covered() -> None:
    left, right = r.view("A", r.RECEIPTS), r.view("B", r.RECEIPTS)
    alternative = replace(
        right.occurrences[2],
        position=10,
        receipt=replace(r.RECEIPTS[2], Claim="alternative"),
        attestation="unavailable",
    )
    result = r.compare(
        "unknown",
        r.TABLE,
        r.EXPECTED,
        left,
        replace(right, occurrences=right.occurrences + (alternative,)),
    )
    assert result["Status"] == "unknown-coverage"
    assert result["UnverifiedRight"] == ["e2"]
    assert result["Invariant"] == []


def test_reports_name_the_declared_cut_even_when_incomplete_or_refused() -> None:
    cases = {row["Name"]: row for row in r.mutation_panel()}
    for name in ("missing-parent", "causal-coordinate-reversal"):
        assert cases[name]["Expected"] == ["e0", "e1", "e2", "e3"]
