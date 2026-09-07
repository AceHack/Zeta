"""Actual temporary Git-tree/current-file correspondence; no study execution."""

from __future__ import annotations

import hashlib
import os
import subprocess
from pathlib import Path
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_sources as source
from zeta_interp.hidden_switch_compiled_admission import Admitted, Refused


def git(root: Path, *args: str, raw: bytes | None = None) -> bytes:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(
        GIT_AUTHOR_NAME="Source fixture",
        GIT_AUTHOR_EMAIL="fixture@example.invalid",
        GIT_COMMITTER_NAME="Source fixture",
        GIT_COMMITTER_EMAIL="fixture@example.invalid",
    )
    return subprocess.run(
        ["git", "-C", str(root), *args],
        input=raw,
        capture_output=True,
        check=True,
        timeout=30,
        env=env,
    ).stdout


def commit_files(root: Path, files: dict[str, bytes], mode: str = "100644") -> str:
    entries = []
    for path, raw in sorted(files.items()):
        blob = git(root, "hash-object", "-w", "--stdin", raw=raw).strip()
        entries.append(mode.encode() + b" blob " + blob + b"\t" + path.encode() + b"\n")
    tree = git(root, "mktree", raw=b"".join(entries)).decode().strip()
    return (
        git(
            root,
            "-c",
            "commit.gpgsign=false",
            "commit-tree",
            tree,
            raw=b"Synthetic archive witness\n\nCo-Authored-By: Codex <noreply@openai.com>\n",
        )
        .decode()
        .strip()
    )


def row(path: str, raw: bytes) -> dict[str, Any]:
    return {
        "File": path,
        "Bytes": len(raw),
        "Sha256": hashlib.sha256(raw).hexdigest().upper(),
    }


@pytest.fixture
def archive(tmp_path: Path) -> tuple[Path, str, list[dict[str, Any]]]:
    root = tmp_path / "clone"
    root.mkdir()
    git(root, "init", "-q")
    files = {"a.py": b"source A\n", "b.py": b"source B\n"}
    commit = commit_files(root, files)
    for path, raw in files.items():
        (root / path).write_bytes(raw)
    return root, commit, [row(path, raw) for path, raw in files.items()]


def verify(archive: tuple[Path, str, list[dict[str, Any]]]) -> Any:
    root, commit, rows = archive
    return source.verify_source_files(
        root, commit, rows, expected_files=("a.py", "b.py")
    )


def test_actual_archive_and_current_bytes_are_both_required(archive: Any) -> None:
    root, commit, rows = archive
    result = verify(archive)
    assert isinstance(result, Admitted)
    assert tuple(x.File for x in result.value) == ("a.py", "b.py")
    assert all(x.Commit == commit and len(x.Blob) == 40 for x in result.value)
    (root / "b.py").write_bytes(b"changed!\n")
    refused = verify(archive)
    assert isinstance(refused, Refused) and refused.code == "source-bytes"
    changed_rows = [rows[0], row("b.py", b"changed!\n")]
    refused = verify((root, commit, changed_rows))
    assert isinstance(refused, Refused) and refused.code == "archive-hash"


@pytest.mark.parametrize(
    "mutation",
    [
        "empty",
        "missing",
        "duplicate",
        "reorder",
        "extra-key",
        "bool-size",
        "bad-path",
        "lower-hash",
    ],
)
def test_exact_complete_roster_and_descriptors(archive: Any, mutation: str) -> None:
    root, commit, original = archive
    rows = [dict(x) for x in original]
    if mutation == "empty":
        rows = []
    elif mutation == "missing":
        rows.pop()
    elif mutation == "duplicate":
        rows[1] = rows[0]
    elif mutation == "reorder":
        rows.reverse()
    elif mutation == "extra-key":
        rows[0]["Passed"] = True
    elif mutation == "bool-size":
        rows[0]["Bytes"] = True
    elif mutation == "bad-path":
        rows[0]["File"] = "../a.py"
    else:
        rows[0]["Sha256"] = rows[0]["Sha256"].lower()
    assert isinstance(verify((root, commit, rows)), Refused)
    assert isinstance(
        source.verify_source_files(root, commit, rows, expected_files=()), Refused
    )
    assert isinstance(
        source.verify_source_files(root, commit, rows, expected_files=("a.py", "a.py")),
        Refused,
    )


@pytest.mark.parametrize("commit", ["HEAD", "main:a.py", "0" * 39, "A" * 40, "0" * 40])
def test_ref_expressions_and_missing_commit_objects_refuse(
    archive: Any, commit: str
) -> None:
    root, _, rows = archive
    assert isinstance(verify((root, commit, rows)), Refused)


def test_a_blob_object_is_not_a_source_commit(archive: Any) -> None:
    root, _, rows = archive
    blob = (
        git(root, "hash-object", "-w", "--stdin", raw=b"not a commit").decode().strip()
    )
    refused = verify((root, blob, rows))
    assert isinstance(refused, Refused) and refused.code == "source-commit"


def test_git_replace_and_ambient_object_routing_cannot_substitute_commit(
    archive: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root, commit, _ = archive
    replacement = commit_files(root, {"a.py": b"replace A", "b.py": b"replace B"})
    git(root, "replace", commit, replacement)
    assert git(root, "show", commit + ":a.py") == b"replace A"
    monkeypatch.setenv("GIT_OBJECT_DIRECTORY", str(tmp_path / "missing-objects"))
    monkeypatch.setenv("GIT_DIR", str(tmp_path / "another-clone"))
    assert isinstance(verify(archive), Admitted)


def test_archived_symlink_and_actual_symlink_refuse(archive: Any) -> None:
    root, _, _ = archive
    linked_commit = commit_files(root, {"link.py": b"a.py"}, mode="120000")
    (root / "link.py").symlink_to(root / "a.py")
    refused = source.verify_source_files(
        root, linked_commit, [row("link.py", b"a.py")], expected_files=("link.py",)
    )
    assert isinstance(refused, Refused) and refused.code == "archive-file"
    (root / "b.py").unlink()
    (root / "b.py").symlink_to(root / "a.py")
    assert isinstance(verify(archive), Refused)


def test_missing_file_and_length_lie_refuse(archive: Any) -> None:
    root, commit, rows = archive
    altered = [dict(x) for x in rows]
    altered[0]["Bytes"] += 1
    refused = verify((root, commit, altered))
    assert isinstance(refused, Refused) and refused.code == "archive-length"
    (root / "a.py").unlink()
    assert isinstance(verify(archive), Refused)


def test_git_failure_stays_a_typed_refusal(
    archive: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    def unavailable(*args: Any, **kwargs: Any) -> Any:
        raise FileNotFoundError("injected unavailable Git")

    monkeypatch.setattr(subprocess, "run", unavailable)
    refused = verify(archive)
    assert isinstance(refused, Refused) and refused.code == "archive-command"


def test_nul_and_nonclone_roots_refuse(archive: Any, tmp_path: Path) -> None:
    _, commit, rows = archive
    for root in (Path("relative"), tmp_path, tmp_path / "bad\x00root"):
        assert isinstance(verify((root, commit, rows)), Refused)
