"""Bounded reads of a caller's exact retained-artifact roster; no dump or subprocess API.

The caller supplies immutable manifest identities and selects exact relative
record names. Metadata checks describe a stable writer tree, not hostile
namespace isolation or cancellation of blocked kernel I/O.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import stat
import time
import zlib
from pathlib import Path, PurePosixPath

MIB = 1024**2


def sha(raw):
    return hashlib.sha256(raw).hexdigest().upper()


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate retained JSON key")
            result[key] = value
        return result

    def constant(_):
        raise ValueError("nonfinite retained JSON constant")

    def finite_float(text):
        value = float(text)
        if not math.isfinite(value):
            raise ValueError("retained JSON exponent exceeds finite binary64 range")
        return value

    return json.loads(raw.decode("utf-8", errors="strict"), object_pairs_hook=pairs,
                      parse_constant=constant, parse_float=finite_float)


def relative_name(name):
    if (not isinstance(name, str) or not name or len(name) > 256 or "\\" in name or "\x00" in name
            or any(part in {"", ".", ".."} for part in name.split("/"))
            or PurePosixPath(name).is_absolute()):
        raise ValueError("retained artifact name is not a canonical relative POSIX path")
    return name


def check_identity(raw, count, digest):
    if type(count) is not int or count != len(raw) or not isinstance(digest, str) or re.fullmatch(r"[0-9A-F]{64}", digest) is None or sha(raw) != digest:
        raise ValueError("retained artifact length or SHA256 differs")


def regular_bytes(path, limit):
    """Admit the same nonblocking regular descriptor before reading initial size plus one."""
    if type(limit) is not int or limit < 0:
        raise ValueError("invalid local read limit")
    fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
    stream = None; primary = None
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or not 0 <= before.st_size <= limit:
            raise ValueError("retained input is not a regular file within its byte limit")
        stream = os.fdopen(fd, "rb"); fd = None
        remaining = before.st_size; parts = []; deadline = time.monotonic() + 10
        while remaining:
            if time.monotonic() >= deadline:
                raise TimeoutError("ten-second local read deadline exceeded")
            raw = stream.read(min(remaining, MIB))
            if not raw:
                raise ValueError("retained input became short")
            parts.append(raw); remaining -= len(raw)
        if time.monotonic() >= deadline:
            raise TimeoutError("ten-second local read deadline exceeded")
        if stream.read(1):
            raise ValueError("retained input grew")
        after = os.fstat(stream.fileno())
        if (before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (after.st_size, after.st_mtime_ns, after.st_ctime_ns):
            raise ValueError("held retained input metadata changed")
        return b"".join(parts)
    except Exception as error:  # preserve first read/admission failure through close
        primary = error
        raise
    finally:
        try:
            if stream is not None:
                stream.close()
            elif fd is not None:
                os.close(fd)
        except Exception as error:
            if primary is None:
                raise
            primary.add_note("secondary input close: " + type(error).__name__ + ": " + str(error)[:1024])


def inflate(stored, count):
    """Exactly one gzip member, at most declared original bytes plus one; never an unbounded flush."""
    if type(count) is not int or not 0 <= count <= 2 * MIB:
        raise ValueError("declared original size exceeds per-record limit")
    decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
    raw = decoder.decompress(stored, count + 1)
    if len(raw) != count or not decoder.eof or decoder.unconsumed_tail or decoder.unused_data:
        raise ValueError("gzip record is short, excessive, incomplete or has trailing members/data")
    return raw


class RetainedStore:
    def __init__(self, root, manifest_pins, checkpoint=lambda _: None):
        self.root = Path(root); self.manifests = {}; self.records = {}; self.cache = {}
        self.pins = []; self.original_bytes = 0; self.checkpoint = checkpoint
        if not 1 <= len(manifest_pins) <= 4:
            raise ValueError("requires one to four exact manifest identities")
        for pin in manifest_pins:
            name = relative_name(pin["File"])
            if name in self.manifests or not name.endswith("/manifest.json"):
                raise ValueError("duplicate or invalid manifest identity")
            raw = regular_bytes(self.root / name, 512 * 1024)
            check_identity(raw, pin["Bytes"], pin["Sha256"])
            self.original_bytes += len(raw)
            self.observe({"Kind": "manifest", "File": name, "Bytes": len(raw), "Sha256": sha(raw)})
            value = strict_json(raw)
            rows = value.get("Records") if isinstance(value, dict) else None
            if not isinstance(rows, list) or len(rows) > 4096:
                raise ValueError("manifest lacks a bounded Records array")
            selected = {}
            for row in rows:
                item = relative_name(row["File"])
                if item in selected or row.get("Encoding") != "gzip":
                    raise ValueError("duplicate record or unsupported retained encoding")
                selected[item] = row
            self.manifests[name] = value
            self.records[name] = selected

    def observe(self, pin):
        self.pins.append(pin)
        self.checkpoint(pin)

    def raw(self, manifest, name):
        relative_name(name)
        key = (manifest, name)
        if key in self.cache:
            return self.cache[key]
        if manifest not in self.records or name not in self.records[manifest]:
            raise ValueError("record is not an exact selected manifest entry")
        row = self.records[manifest][name]
        count, stored_count = row["Bytes"], row["StoredBytes"]
        if (type(count) is not int or not 0 <= count <= 2 * MIB or type(stored_count) is not int
                or not 0 <= stored_count <= 2 * MIB or len(self.cache) >= 600
                or self.original_bytes + count > 16 * MIB):
            raise ValueError("selected artifact budget exceeded")
        path = str(PurePosixPath(manifest).parent / name)
        stored = regular_bytes(self.root / path, 2 * MIB)
        check_identity(stored, stored_count, row["StoredSha256"])
        self.observe({"Kind": "stored-record", "File": path, "Bytes": stored_count, "Sha256": row["StoredSha256"]})
        raw = inflate(stored, count)
        check_identity(raw, count, row["Sha256"])
        self.original_bytes += count; self.cache[key] = raw
        self.observe({"Kind": "original-record", "File": path, "Bytes": count, "Sha256": row["Sha256"]})
        return raw

    def json(self, manifest, name):
        return strict_json(self.raw(manifest, name))

    def recheck(self):
        """Reread only already selected files; original bytes are bound through their stored hash."""
        for pin in self.pins:
            if pin["Kind"] == "original-record":
                continue
            raw = regular_bytes(self.root / pin["File"], 512 * 1024 if pin["Kind"] == "manifest" else 2 * MIB)
            check_identity(raw, pin["Bytes"], pin["Sha256"])
