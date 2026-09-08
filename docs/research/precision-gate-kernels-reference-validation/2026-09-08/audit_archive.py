"""Offline identity audit only; no project imports or vector execution."""

import gzip
import hashlib
import json
import subprocess
import sys
from pathlib import Path


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    repo = Path(sys.argv[1]).resolve(strict=True)
    base = Path(__file__).resolve().parent
    manifest_raw = (base / "manifest.json").read_bytes()
    manifest = json.loads(manifest_raw)
    originals = {}
    stored_paths = set()
    for row in manifest["Records"]:
        assert row["Original"] not in originals, row["Original"]
        assert row["Stored"] not in stored_paths, row["Stored"]
        stored_paths.add(row["Stored"])
        stored = (base / row["Stored"]).read_bytes()
        assert len(stored) == row["StoredBytes"], row["Stored"]
        assert sha(stored) == row["StoredSha256"], row["Stored"]
        assert row["Encoding"] == "gzip", row["Stored"]
        raw = gzip.decompress(stored)
        assert len(raw) == row["OriginalBytes"], row["Original"]
        assert sha(raw) == row["OriginalSha256"], row["Original"]
        originals[row["Original"]] = raw
    assert len(originals) == 34
    assert stored_paths == {
        str(path.relative_to(base)) for path in (base / "artifacts").iterdir()
    }

    def git_bytes(commit: str, path: str) -> bytes:
        return subprocess.run(
            ["git", "show", f"{commit}:{path}"],
            cwd=repo,
            check=True,
            capture_output=True,
        ).stdout

    for filename, folder in (
        ("precision_gate_kernels_reference.py", "zeta_interp"),
        ("test_precision_gate_kernels_reference.py", "tests"),
    ):
        path = f"src/Interp.Python/{folder}/{filename}"
        pinned = git_bytes(manifest["SourceCommit"], path)
        assert pinned == (repo / path).read_bytes(), path
        assert (
            pinned == originals[f"precision-gate-reference-attempt-2/{filename}.source"]
        ), path
    source = originals[
        "precision-gate-reference-attempt-2/precision_gate_kernels_reference.py.source"
    ]
    assert source == originals["precision-gate-vector-capture-1/source.py"]
    plan = git_bytes(
        manifest["PlanCommit"],
        "docs/research/2026-09-08-precision-gate-kernels-reference.md",
    )
    assert plan == originals["fixed-plan-3888d9a6b.md"]
    vector_row = manifest["ReferenceVectorCopy"]
    vector_raw = (base / vector_row["Path"]).read_bytes()
    assert len(vector_raw) == vector_row["Bytes"]
    assert sha(vector_raw) == vector_row["Sha256"]
    assert vector_raw == originals["precision-gate-vector-capture-1.stdout"]
    assert originals["precision-gate-vector-capture-1.stderr"] == b""
    vector = json.loads(vector_raw)
    returned_raw = originals["precision-gate-vector-capture-1/actual-return.json"]
    returned = json.loads(returned_raw)
    assert returned == {"Kind": "success", "Value": vector}
    outcomes = [row["Outcome"]["Kind"] for row in vector["Rows"]]
    assert len(outcomes) == 24
    assert outcomes.count("success") == 17
    assert outcomes.count("refused") == 7
    observed = json.loads(
        originals["precision-gate-vector-capture-1/observations.json"]
    )
    assert observed["SourceBytes"] == len(source)
    assert observed["SourceSha256"] == sha(source)
    assert observed["SourceCommit"] == manifest["SourceCommit"]
    assert observed["ReturnBytes"] == len(returned_raw)
    assert observed["ReturnSha256"] == sha(returned_raw)
    assert observed["SourceUnchangedAfter"] is True
    assert observed["FullRuntimeClosureAdmitted"] is False
    assert observed["NativeComparisonPerformed"] is False
    for attempt, expected in ((1, [0, 1, 0, 1]), (2, [0, 0, 0, 0])):
        commands = json.loads(
            originals[f"precision-gate-reference-attempt-{attempt}/commands.json"]
        )
        assert [row["Name"] for row in commands] == ["pytest", "mypy", "ruff", "format"]
        assert [row["ExitCode"] for row in commands] == expected
    print(
        json.dumps(
            {
                "Schema": "zeta.precision-gate-reference-archive-audit.v1",
                "ManifestSha256": sha(manifest_raw),
                "ArtifactPairs": len(originals),
                "OriginalBytes": sum(
                    row["OriginalBytes"] for row in manifest["Records"]
                ),
                "StoredBytes": sum(row["StoredBytes"] for row in manifest["Records"]),
                "PinnedSourceFiles": 2,
                "VectorRows": len(outcomes),
                "VectorSuccesses": outcomes.count("success"),
                "VectorRefusals": outcomes.count("refused"),
                "Scope": "offline archive identity audit; no project import or execution",
                "Passed": True,
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
