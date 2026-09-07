"""Bounded encoding of actual public results in the reviewed evidence convention.

This streams the same Type/Fields/BytesHex projection as conformance.result_tree
without first materializing every projected string/byte field. The quota is for
one complete ASCII JSON record including its newline, not an attempt's aggregate
retention quota. Labels do not instantiate or authenticate a producer type.
"""

from __future__ import annotations

import dataclasses
import json
import math
from typing import Any, cast

from . import hidden_switch_compiled_admission as a

MAX_RECORD_BYTES = 256 * 1024 * 1024
MAX_FIELD_BYTES = 16 * 1024 * 1024
MAX_NODES = 100_000
MAX_DEPTH = 128
CHUNK_CHARACTERS = 512
MAX_KEY_CHARACTERS = 4096
MAX_INTEGER_BITS = 13_600


class _Stop(Exception):
    def __init__(self, refusal: a.Refused):
        super().__init__(refusal.detail)
        self.refusal = refusal


class _Encoder:
    def __init__(self, maximum: int):
        self.maximum = maximum
        self.output = bytearray()
        self.nodes = 0
        self.ancestors: set[int] = set()

    def refuse(self, code: str, path: str, detail: str) -> None:
        raise _Stop(a.Refused(code, path, detail))

    def require(self, count: int, path: str) -> None:
        if count > self.maximum - len(self.output):
            self.refuse(
                "record-byte-bound", path, "encoded record exceeds its byte quota"
            )

    def emit(self, raw: bytes, path: str) -> None:
        self.require(len(raw), path)
        self.output.extend(raw)

    def string(self, value: str, path: str) -> None:
        self.emit(b'"', path)
        field_bytes = 0
        # Each temporary encoded slice is at most 6144 ASCII bytes plus quotes.
        # Surrogate pairs are represented as real Unicode scalar values in input;
        # any unpaired Python surrogate is refused, even though JSON would escape it.
        for start in range(0, len(value), CHUNK_CHARACTERS):
            part = value[start : start + CHUNK_CHARACTERS]
            try:
                field_bytes += len(part.encode("utf-8", errors="strict"))
            except UnicodeEncodeError:
                self.refuse("result-unicode", path, "unpaired result surrogate")
            if field_bytes > MAX_FIELD_BYTES:
                self.refuse("result-size", path, "result string exceeds bound")
            expanded = sum(
                2
                if char in '\\"\b\t\n\f\r'
                else 1
                if 0x20 <= ord(char) <= 0x7E
                else 6
                if ord(char) <= 0xFFFF
                else 12
                for char in part
            )
            self.require(expanded, path)
            self.emit(json.dumps(part, ensure_ascii=True)[1:-1].encode("ascii"), path)
        self.emit(b'"', path)

    def visit(self, item: object, path: str, depth: int) -> None:
        self.nodes += 1
        if self.nodes > MAX_NODES or depth > MAX_DEPTH:
            self.refuse(
                "result-size", path, "public result exceeds finite encoding bounds"
            )
        if item is None:
            self.emit(b"null", path)
            return
        if type(item) is bool:
            self.emit(b"true" if item else b"false", path)
            return
        if type(item) is int:
            if item.bit_length() > MAX_INTEGER_BITS:
                self.refuse(
                    "result-size",
                    path,
                    "integer exceeds bounded decimal encoding domain",
                )
            # A cheap lower bound refuses huge integer spellings before conversion.
            # Python's configured decimal-conversion limit remains enforced too.
            if max(1, (abs(item).bit_length() - 1) * 3 // 10) > self.maximum - len(
                self.output
            ):
                self.refuse(
                    "record-byte-bound",
                    path,
                    "integer spelling exceeds remaining quota",
                )
            try:
                raw = str(item).encode("ascii")
            except ValueError:
                self.refuse(
                    "result-integer",
                    path,
                    "integer exceeds runtime decimal encoding limit",
                )
                return
            self.emit(raw, path)
            return
        if type(item) is float:
            if not math.isfinite(item):
                self.refuse("result-number", path, "nonfinite result number")
            self.emit(json.dumps(item, allow_nan=False).encode("ascii"), path)
            return
        if type(item) is str:
            self.string(item, path)
            return
        if type(item) is bytes:
            if len(item) > MAX_FIELD_BYTES:
                self.refuse("result-size", path, "result bytes exceed bound")
            self.emit(b'{"BytesHex":"', path)
            for start in range(0, len(item), CHUNK_CHARACTERS):
                self.require(2 * min(CHUNK_CHARACTERS, len(item) - start), path)
                self.emit(
                    item[start : start + CHUNK_CHARACTERS]
                    .hex()
                    .upper()
                    .encode("ascii"),
                    path,
                )
            self.emit(b'"}', path)
            return
        marker = id(item)
        if marker in self.ancestors:
            self.refuse("result-cycle", path, "cyclic result cannot be encoded")
        self.ancestors.add(marker)
        try:
            if type(item) in (tuple, list):
                values = cast(tuple[object, ...] | list[object], item)
                if len(values) > MAX_NODES - self.nodes:
                    self.refuse(
                        "result-size",
                        path,
                        "result container exceeds remaining node bound",
                    )
                self.emit(b"[", path)
                for index, child in enumerate(values):
                    if index:
                        self.emit(b",", path)
                    self.visit(child, f"{path}[{index}]", depth + 1)
                self.emit(b"]", path)
                return
            if type(item) is dict:
                self.mapping(item, path, depth)
                return
            if not isinstance(item, type) and dataclasses.is_dataclass(item):
                fields = dataclasses.fields(item)
                if len(fields) > MAX_NODES - self.nodes:
                    self.refuse(
                        "result-size", path, "result fields exceed remaining node bound"
                    )
                # Sorting labels matches the recorder's canonical JSON convention.
                self.emit(b'{"Fields":{', path)
                for index, field in enumerate(sorted(fields, key=lambda row: row.name)):
                    if index:
                        self.emit(b",", path)
                    self.string(field.name, path + ".<field>")
                    self.emit(b":", path)
                    self.visit(
                        getattr(item, field.name), path + "." + field.name, depth + 1
                    )
                self.emit(b'},"Type":', path)
                kind = type(item)
                self.string(kind.__module__ + "." + kind.__qualname__, path + ".<type>")
                self.emit(b"}", path)
                return
            self.refuse(
                "result-type",
                path,
                "unsupported public result value; no implicit string conversion",
            )
        finally:
            self.ancestors.remove(marker)

    def mapping(self, item: dict[Any, Any], path: str, depth: int) -> None:
        if len(item) > (MAX_NODES - self.nodes) // 2:
            self.refuse(
                "result-size", path, "result mapping exceeds remaining node bound"
            )
        if any(type(key) is not str for key in item):
            self.refuse("result-key", path, "JSON result key must be text")
        if any(len(key) > MAX_KEY_CHARACTERS for key in item):
            self.refuse("result-size", path, "result key exceeds finite sorting bound")
        self.emit(b"{", path)
        for index, key in enumerate(sorted(item)):
            if index:
                self.emit(b",", path)
            self.visit(key, path + ".<key>", depth + 1)
            self.emit(b":", path)
            child_path = path + ("." + key if len(key) <= 128 else f".<key-{index}>")
            self.visit(item[key], child_path, depth + 1)
        self.emit(b"}", path)


def encode_public_result(
    value: object, *, maximum_bytes: object = MAX_RECORD_BYTES
) -> a.Admission[bytes]:
    """Return a complete bounded canonical record, or a typed first refusal.

    Output bytes are capped before each append. At successful return the final
    immutable bytes conversion can briefly coexist with the capped bytearray;
    this is a logical output bound, not an exact process peak-memory limit.
    Caller-owned input objects and Python runtime overhead are outside the quota.
    """
    checked = a.integer(maximum_bytes, 1, MAX_RECORD_BYTES, "MaximumBytes")
    if isinstance(checked, a.Refused):
        return checked
    encoder = _Encoder(checked.value)
    try:
        encoder.visit(value, "$", 0)
        encoder.emit(b"\n", "$")
    except _Stop as error:
        return error.refusal
    except (AttributeError, TypeError, ValueError, RuntimeError) as error:
        return a.Refused("result-observation", "$", str(error))
    return a.Admitted(bytes(encoder.output))
