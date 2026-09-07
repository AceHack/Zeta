"""Descriptor-relative, exclusive artifact I/O for compiled-study evidence.

The caller supplies a trusted root, which is resolved once. Each subsequent
artifact component is opened relative to held directory descriptors without
following symlinks. Reads bind the bytes actually read from one regular-file
descriptor. This is not a lock on future pathname/metadata changes or protection
against a hostile kernel. Failures retain any exclusively created output prefix.
"""

from __future__ import annotations

import os
import stat
import zlib
from pathlib import Path
from typing import Any

from zeta_interp.hidden_switch_compiled_admission import (
    INT64_MAX,
    Admission,
    Admitted,
    Refused,
    artifact_descriptor,
    bind_artifact_bytes,
    integer,
    relative_artifact_path,
)


def _directory(root: Path) -> Admission[int]:
    if not isinstance(root, Path) or not root.is_absolute():
        return Refused("root", "root", "requires an absolute caller-admitted directory")
    if (
        not all(
            hasattr(os, name) for name in ("O_NOFOLLOW", "O_DIRECTORY", "O_NONBLOCK")
        )
        or os.open not in os.supports_dir_fd
        or os.mkdir not in os.supports_dir_fd
    ):
        return Refused(
            "filesystem-platform",
            "root",
            "descriptor no-follow directory opens unavailable",
        )
    descriptor: int | None = None
    try:
        canonical = root.resolve(strict=True)
        descriptor = os.open(
            canonical.anchor, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
        )
        for component in canonical.parts[1:]:
            child = os.open(
                component,
                os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                dir_fd=descriptor,
            )
            os.close(descriptor)
            descriptor = child
        return Admitted(descriptor)
    except (OSError, RuntimeError) as error:
        if descriptor is not None:
            os.close(descriptor)
        return Refused("filesystem-root", "root", str(error))


def _parent(root: Path, relative: Any) -> Admission[tuple[int, str]]:
    path = relative_artifact_path(relative, "File")
    if isinstance(path, Refused):
        return path
    anchor = _directory(root)
    if isinstance(anchor, Refused):
        return anchor
    descriptor = anchor.value
    components = path.value.split("/")
    try:
        for component in components[:-1]:
            child = os.open(
                component,
                os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                dir_fd=descriptor,
            )
            os.close(descriptor)
            descriptor = child
        return Admitted((descriptor, components[-1]))
    except OSError as error:
        os.close(descriptor)
        return Refused("filesystem-parent", path.value, str(error))


def create_directory(root: Path, relative: str) -> Admission[str]:
    """Create exactly one new directory; existing attempts are never reused."""
    parent = _parent(root, relative)
    if isinstance(parent, Refused):
        return parent
    descriptor, leaf = parent.value
    try:
        os.mkdir(leaf, mode=0o700, dir_fd=descriptor)
        os.fsync(descriptor)
        return Admitted(relative)
    except FileExistsError:
        return Refused(
            "existing-output",
            relative,
            "directory already exists; retained without modification",
        )
    except OSError as error:
        return Refused("directory-write", relative, str(error))
    finally:
        os.close(descriptor)


def write_exclusive(root: Path, relative: str, raw: bytes) -> Admission[int]:
    """Write and sync one fresh file, retaining a prefix if an OS write fails."""
    if type(raw) is not bytes:
        return Refused("write-bytes", relative, "requires exact bytes")
    parent = _parent(root, relative)
    if isinstance(parent, Refused):
        return parent
    directory, leaf = parent.value
    descriptor: int | None = None
    try:
        descriptor = os.open(
            leaf,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
            0o600,
            dir_fd=directory,
        )
        written = 0
        view = memoryview(raw)
        while written < len(raw):
            count = os.write(descriptor, view[written:])
            if count <= 0:
                return Refused(
                    "write-progress",
                    relative,
                    f"write stopped after {written} bytes; prefix retained",
                )
            written += count
        os.fsync(descriptor)
        os.fsync(directory)
        return Admitted(written)
    except FileExistsError:
        return Refused(
            "existing-output",
            relative,
            "file already exists; retained without modification",
        )
    except OSError as error:
        return Refused("file-write", relative, str(error))
    finally:
        if descriptor is not None:
            os.close(descriptor)
        os.close(directory)


def read_exact(
    root: Path, relative: str, *, expected_bytes: int, maximum_bytes: int
) -> Admission[bytes]:
    """Read one regular descriptor with exact length and stable observed metadata."""
    for result in (
        integer(expected_bytes, 0, INT64_MAX, "Bytes"),
        integer(maximum_bytes, 0, INT64_MAX, "MaximumBytes"),
    ):
        if isinstance(result, Refused):
            return result
    if expected_bytes > maximum_bytes:
        return Refused(
            "file-bound", relative, "declared file exceeds the caller's admission bound"
        )
    parent = _parent(root, relative)
    if isinstance(parent, Refused):
        return parent
    directory, leaf = parent.value
    descriptor: int | None = None
    try:
        descriptor = os.open(
            leaf, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory
        )
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode) or before.st_size != expected_bytes:
            return Refused(
                "regular-file-length",
                relative,
                "requires a regular file of the exact declared size",
            )
        chunks = []
        total = 0
        while total <= expected_bytes:
            chunk = os.read(descriptor, min(1024 * 1024, expected_bytes + 1 - total))
            if not chunk:
                break
            chunks.append(chunk)
            total += len(chunk)
        after = os.fstat(descriptor)
        names = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")
        if total != expected_bytes or any(
            getattr(before, name) != getattr(after, name) for name in names
        ):
            return Refused(
                "file-changed",
                relative,
                "length or observed file identity changed during read",
            )
        return Admitted(b"".join(chunks))
    except OSError as error:
        return Refused("file-read", relative, str(error))
    finally:
        if descriptor is not None:
            os.close(descriptor)
        os.close(directory)


def read_artifact(
    root: Path,
    descriptor: Any,
    *,
    maximum_stored_bytes: int,
    maximum_original_bytes: int,
) -> Admission[bytes]:
    checked = artifact_descriptor(descriptor, "Artifact")
    if isinstance(checked, Refused):
        return checked
    row = checked.value
    limit = integer(maximum_original_bytes, 0, INT64_MAX, "MaximumOriginalBytes")
    if isinstance(limit, Refused):
        return limit
    if row["Bytes"] > maximum_original_bytes:
        return Refused(
            "artifact-bound",
            row["File"],
            "original bytes exceed the caller's admission bound",
        )
    read = read_exact(
        root,
        row["File"],
        expected_bytes=row["StoredBytes"],
        maximum_bytes=maximum_stored_bytes,
    )
    if isinstance(read, Refused):
        return read
    stored = read.value
    original = stored
    if row["Encoding"] == "gzip":
        try:
            decoder = zlib.decompressobj(wbits=31)
            original = decoder.decompress(stored, row["Bytes"] + 1)
        except zlib.error as error:
            return Refused("artifact-gzip", row["File"], str(error))
        if not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:
            return Refused(
                "artifact-gzip",
                row["File"],
                "incomplete, oversized or trailing gzip data",
            )
    binding = bind_artifact_bytes(row, stored, original, row["File"])
    if isinstance(binding, Refused):
        return binding
    return Admitted(original)
