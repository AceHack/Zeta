"""Real filesystem refusal and retained-prefix witnesses; no study sources."""

from __future__ import annotations

import gzip
import hashlib
import os
from pathlib import Path
from typing import Any

import pytest
from zeta_interp import hidden_switch_compiled_storage as storage
from zeta_interp.hidden_switch_compiled_admission import Admitted, Refused


def descriptor(stored: bytes, original: bytes, encoding: str) -> dict[str, Any]:
    return {
        "File": "row.gz" if encoding == "gzip" else "row.bin",
        "Bytes": len(original),
        "Sha256": hashlib.sha256(original).hexdigest().upper(),
        "Encoding": encoding,
        "StoredBytes": len(stored),
        "StoredSha256": hashlib.sha256(stored).hexdigest().upper(),
    }


def test_exclusive_attempt_and_file_never_replace_existing_bytes(
    tmp_path: Path,
) -> None:
    assert isinstance(storage.create_directory(tmp_path, "attempt"), Admitted)
    assert isinstance(
        storage.write_exclusive(tmp_path, "attempt/row.bin", b"first"), Admitted
    )
    assert isinstance(storage.create_directory(tmp_path, "attempt"), Refused)
    assert isinstance(
        storage.write_exclusive(tmp_path, "attempt/row.bin", b"replacement"), Refused
    )
    assert (tmp_path / "attempt/row.bin").read_bytes() == b"first"
    assert storage.read_exact(
        tmp_path, "attempt/row.bin", expected_bytes=5, maximum_bytes=5
    ) == Admitted(b"first")


def test_failure_retains_partial_exclusive_write(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    original_write = os.write
    calls = 0

    def interrupted(fd: int, raw: Any) -> int:
        nonlocal calls
        calls += 1
        if calls == 1:
            return original_write(fd, raw[:3])
        raise OSError("injected write interruption")

    monkeypatch.setattr(os, "write", interrupted)
    result = storage.write_exclusive(tmp_path, "row.bin", b"original")
    assert isinstance(result, Refused)
    assert (tmp_path / "row.bin").read_bytes() == b"ori"
    assert isinstance(
        storage.write_exclusive(tmp_path, "row.bin", b"replacement"), Refused
    )
    assert (tmp_path / "row.bin").read_bytes() == b"ori"


def test_artifact_components_cannot_escape_through_parent_or_leaf_links(
    tmp_path: Path,
) -> None:
    root = tmp_path / "inside"
    outside = tmp_path / "outside"
    root.mkdir()
    outside.mkdir()
    (outside / "row.bin").write_bytes(b"outside")
    (root / "parent-link").symlink_to(outside, target_is_directory=True)
    (root / "leaf-link").symlink_to(outside / "row.bin")
    for relative in ("parent-link/row.bin", "leaf-link", "../outside/row.bin"):
        assert isinstance(
            storage.read_exact(root, relative, expected_bytes=7, maximum_bytes=7),
            Refused,
        )
        assert isinstance(storage.write_exclusive(root, relative, b"changed"), Refused)
    assert (outside / "row.bin").read_bytes() == b"outside"
    assert isinstance(storage.create_directory(root, "parent-link/new"), Refused)
    assert not (outside / "new").exists()


def test_nonregular_and_wrong_length_files_refuse_without_reading_fifo(
    tmp_path: Path,
) -> None:
    (tmp_path / "directory").mkdir()
    os.mkfifo(tmp_path / "fifo")
    (tmp_path / "row.bin").write_bytes(b"three")
    for relative, size in (
        ("directory", 0),
        ("fifo", 0),
        ("missing", 0),
        ("row.bin", 3),
    ):
        assert isinstance(
            storage.read_exact(
                tmp_path, relative, expected_bytes=size, maximum_bytes=100
            ),
            Refused,
        )
    assert isinstance(
        storage.read_exact(tmp_path, "row.bin", expected_bytes=5, maximum_bytes=4),
        Refused,
    )
    assert isinstance(
        storage.read_exact(tmp_path, "row.bin", expected_bytes=True, maximum_bytes=10),
        Refused,
    )


def test_same_length_inplace_change_is_not_an_admitted_read(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    file = tmp_path / "row.bin"
    file.write_bytes(b"original")
    original_read = os.read
    changed = False

    def racing(fd: int, length: int) -> bytes:
        nonlocal changed
        chunk = original_read(fd, min(length, 2))
        if not changed:
            changed = True
            file.write_bytes(b"modified")
        return chunk

    monkeypatch.setattr(os, "read", racing)
    assert isinstance(
        storage.read_exact(tmp_path, "row.bin", expected_bytes=8, maximum_bytes=8),
        Refused,
    )


def test_complete_hash_bound_gzip_and_identity_storage(tmp_path: Path) -> None:
    original = b"raw\xef\xbb\xbf\x00evidence\n" * 100
    for encoding, stored in (
        ("identity", original),
        ("gzip", gzip.compress(original, mtime=0)),
    ):
        row = descriptor(stored, original, encoding)
        (tmp_path / row["File"]).write_bytes(stored)
        assert storage.read_artifact(
            tmp_path,
            row,
            maximum_stored_bytes=len(stored),
            maximum_original_bytes=len(original),
        ) == Admitted(original)
        bad_hash = dict(row, Sha256="0" * 64)
        assert isinstance(
            storage.read_artifact(
                tmp_path,
                bad_hash,
                maximum_stored_bytes=len(stored),
                maximum_original_bytes=len(original),
            ),
            Refused,
        )
        assert isinstance(
            storage.read_artifact(
                tmp_path,
                row,
                maximum_stored_bytes=len(stored),
                maximum_original_bytes=len(original) - 1,
            ),
            Refused,
        )


def test_compressed_expansion_and_trailing_members_refuse(tmp_path: Path) -> None:
    original = b"x" * 4096
    for stored in (
        gzip.compress(original, mtime=0),
        gzip.compress(b"", mtime=0) + gzip.compress(b"", mtime=0),
    ):
        row = descriptor(stored, b"", "gzip")
        (tmp_path / "row.gz").write_bytes(stored)
        assert isinstance(
            storage.read_artifact(
                tmp_path,
                row,
                maximum_stored_bytes=len(stored),
                maximum_original_bytes=10,
            ),
            Refused,
        )


def test_empty_exclusive_file_is_valid_and_invalid_parent_is_not_created(
    tmp_path: Path,
) -> None:
    assert storage.write_exclusive(tmp_path, "empty", b"") == Admitted(0)
    assert storage.read_exact(
        tmp_path, "empty", expected_bytes=0, maximum_bytes=0
    ) == Admitted(b"")
    assert isinstance(storage.write_exclusive(tmp_path, "missing/row", b"x"), Refused)
    assert not (tmp_path / "missing").exists()
    assert isinstance(
        storage.read_exact(Path("relative"), "row", expected_bytes=0, maximum_bytes=0),
        Refused,
    )


def test_missing_nofollow_capability_refuses_before_creating_output(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delattr(os, "O_NOFOLLOW")
    assert isinstance(storage.write_exclusive(tmp_path, "row", b"x"), Refused)
    assert not (tmp_path / "row").exists()
