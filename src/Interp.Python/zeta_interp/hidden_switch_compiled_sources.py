"""Bind a caller-enumerated source roster to immutable Git blobs and actual files.

The caller supplies the reviewed full commit and complete ordered file roster.
This module proves byte correspondence for those files only. It neither discovers
an unspecified dependency closure nor admits loaded code, runtime, tags or phases.
The local Git executable/object database and the caller's clone root are trusted.
"""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .hidden_switch_compiled_admission import (
    Admission,
    Admitted,
    Refused,
    exact_keys,
    integer,
    relative_artifact_path,
    sha256,
)
from .hidden_switch_compiled_storage import read_exact

MAXIMUM_SOURCE_BYTES = 32 * 1024 * 1024
MAXIMUM_SOURCE_FILES = 256
_OBJECT = re.compile(r"[0-9a-f]{40}\Z")


@dataclass(frozen=True, slots=True)
class SourceFile:
    File: str
    Commit: str
    Blob: str
    Bytes: int
    Sha256: str


def _git(repository: Path, arguments: list[str]) -> Admission[bytes]:
    # Ambient Git routing/replacement/config variables must not redirect this
    # read. No shell, hook, checkout, filter, object write or network is used.
    environment = {
        key: value for key, value in os.environ.items() if not key.startswith("GIT_")
    }
    try:
        result = subprocess.run(
            [
                "git",
                "--no-replace-objects",
                "--no-lazy-fetch",
                "--literal-pathspecs",
                f"--git-dir={repository / '.git'}",
                f"--work-tree={repository}",
                *arguments,
            ],
            capture_output=True,
            check=False,
            timeout=30,
            env=environment,
        )
    except (OSError, subprocess.SubprocessError) as error:
        return Refused("archive-command", "Repository", str(error))
    if result.returncode != 0:
        return Refused(
            "archive-command",
            "Repository",
            f"git {arguments[0]} exited {result.returncode}: "
            + result.stderr[:4096].decode("utf-8", errors="backslashreplace"),
        )
    return Admitted(result.stdout)


def _roster(
    rows: Any, expected_files: tuple[str, ...]
) -> Admission[list[dict[str, Any]]]:
    if (
        type(expected_files) is not tuple
        or not 1 <= len(expected_files) <= MAXIMUM_SOURCE_FILES
        or any(type(path) is not str for path in expected_files)
        or len(set(expected_files)) != len(expected_files)
        or type(rows) is not list
        or len(rows) != len(expected_files)
    ):
        return Refused(
            "source-roster",
            "Files",
            "requires the complete unique nonempty reviewed roster",
        )
    admitted = []
    for index, (raw, expected) in enumerate(zip(rows, expected_files, strict=True)):
        path = f"Files[{index}]"
        row = exact_keys(raw, frozenset(("File", "Bytes", "Sha256")), path)
        if isinstance(row, Refused):
            return row
        record = row.value
        for check in (
            relative_artifact_path(record["File"], path + ".File"),
            integer(record["Bytes"], 0, MAXIMUM_SOURCE_BYTES, path + ".Bytes"),
            sha256(record["Sha256"], path + ".Sha256"),
        ):
            if isinstance(check, Refused):
                return check
        if record["File"] != expected:
            return Refused(
                "source-order",
                path + ".File",
                "differs from the reviewed file at this position",
            )
        admitted.append(record)
    return Admitted(admitted)


def verify_source_files(
    repository: Path,
    commit: str,
    rows: Any,
    *,
    expected_files: tuple[str, ...],
) -> Admission[tuple[SourceFile, ...]]:
    """Compare all declared regular-file blobs and current descriptor-read bytes."""
    if type(commit) is not str or _OBJECT.fullmatch(commit) is None:
        return Refused(
            "source-commit",
            "Commit",
            "requires a full lowercase SHA1 commit, never a ref or expression",
        )
    roster = _roster(rows, expected_files)
    if isinstance(roster, Refused):
        return roster
    if (
        not isinstance(repository, Path)
        or not repository.is_absolute()
        or "\x00" in str(repository)
    ):
        return Refused(
            "repository",
            "Repository",
            "requires an absolute caller-admitted clone root",
        )
    try:
        root = repository.resolve(strict=True)
        metadata = root / ".git"
        if metadata.is_symlink() or not metadata.is_dir():
            return Refused(
                "repository",
                "Repository",
                "requires an ordinary clone with a local .git directory",
            )
    except (OSError, RuntimeError, ValueError) as error:
        return Refused("repository", "Repository", str(error))
    kind = _git(root, ["cat-file", "-t", commit])
    if isinstance(kind, Refused):
        return kind
    if kind.value != b"commit\n":
        return Refused("source-commit", "Commit", "the supplied object is not a commit")
    admitted = []
    for row in roster.value:
        path = row["File"]
        tree = _git(root, ["ls-tree", "-z", commit, "--", path])
        if isinstance(tree, Refused):
            return tree
        entry = re.fullmatch(
            rb"(100644|100755) blob ([0-9a-f]{40})\t([^\x00]+)\x00", tree.value
        )
        if entry is None or entry[3] != path.encode("ascii"):
            return Refused(
                "archive-file",
                path,
                "requires exactly the named regular-file blob in the supplied commit",
            )
        blob = entry[2].decode("ascii")
        size = _git(root, ["cat-file", "-s", blob])
        if isinstance(size, Refused):
            return size
        if size.value != f"{row['Bytes']}\n".encode("ascii"):
            return Refused(
                "archive-length",
                path,
                "archived length differs from the reviewed descriptor",
            )
        archived = _git(root, ["cat-file", "blob", blob])
        if isinstance(archived, Refused):
            return archived
        if (
            len(archived.value) != row["Bytes"]
            or hashlib.sha256(archived.value).hexdigest().upper() != row["Sha256"]
        ):
            return Refused(
                "archive-hash",
                path,
                "archived bytes differ from the reviewed descriptor",
            )
        current = read_exact(
            root, path, expected_bytes=row["Bytes"], maximum_bytes=MAXIMUM_SOURCE_BYTES
        )
        if isinstance(current, Refused):
            return current
        if current.value != archived.value:
            return Refused(
                "source-bytes",
                path,
                "actual file bytes differ from the immutable archived blob",
            )
        admitted.append(
            SourceFile(path, commit, blob, len(current.value), row["Sha256"])
        )
    return Admitted(tuple(admitted))
