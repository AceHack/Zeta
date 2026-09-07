"""Strict physical-file backing for bounded, explicitly selected core ranges."""

from __future__ import annotations

import hashlib
import struct
from dataclasses import dataclass

MAX64 = (1 << 64) - 1


@dataclass(frozen=True)
class Segment:
    address: int
    size: int
    offset: int
    stored: int


class MachCore:
    """Reads only format/segment metadata, then caller-selected physical bytes.

    The caller owns the stream and immutable-file premise. There is no module
    image fallback, zero filling or broad memory/stack/heap search.
    """

    def __init__(self, stream, file_bytes):
        self.stream = stream
        self.file_bytes = file_bytes
        stream.seek(0)
        raw = stream.read(32)
        if len(raw) != 32:
            raise ValueError("short Mach-O header")
        magic, cpu, subtype, kind, count, command_bytes, flags, reserved = struct.unpack("<8I", raw)
        if (magic, cpu, subtype, kind, flags, reserved) != (0xFEEDFACF, 0x0100000C, 0, 4, 0, 0):
            raise ValueError("requires supported little-endian64 ARM64 MH_CORE header")
        if not 1 <= count <= 4096 or not count * 8 <= command_bytes <= 1024 * 1024 or 32 + command_bytes > file_bytes:
            raise ValueError("invalid or unsupported command-table bounds")
        end = 32 + command_bytes
        cursor = 32
        segments = []
        for _ in range(count):
            stream.seek(cursor)
            command_header = stream.read(8)
            if len(command_header) != 8:
                raise ValueError("short load-command header")
            command, size = struct.unpack("<II", command_header)
            if size < 8 or size % 8 or cursor + size > end:
                raise ValueError("invalid load-command size")
            if command == 0x19:  # LC_SEGMENT_64
                if size < 72:
                    raise ValueError("short segment command")
                tail = stream.read(64)
                if len(tail) != 64:
                    raise ValueError("short segment header")
                _, address, virtual, offset, stored, maximum, protection, sections, segment_flags = struct.unpack("<16s4Q4I", tail)
                if sections != 0 or size != 72:
                    raise ValueError("section-bearing core segments are unsupported")
                if segment_flags != 0:
                    # Includes SG_HIGHVM: file bytes can occupy the high end,
                    # so the ordinary vmaddr-relative mapping cannot be used.
                    raise ValueError("unsupported segment flags, including SG_HIGHVM")
                if maximum & ~7 or protection & ~7:
                    raise ValueError("unsupported segment protection flags")
                if address + virtual > MAX64 or offset + stored > MAX64 or offset + stored > file_bytes or stored > virtual:
                    raise ValueError("segment virtual/file range exceeds bounds")
                if stored and offset < end:
                    raise ValueError("segment data overlaps core format metadata")
                segments.append(Segment(address, virtual, offset, stored))
            elif command not in (4, 5):  # LC_THREAD / LC_UNIXTHREAD; skip state bytes.
                raise ValueError("unsupported core load command")
            cursor += size
        if cursor != end or not segments:
            raise ValueError("command traversal does not match exact header extent")
        self.segments = tuple(segments)
        self.header = {"Format": "MachO64-LE-ARM64-MH_CORE", "Commands": count,
                       "CommandBytes": command_bytes, "Segments": len(segments)}

    def read(self, address, length):
        if type(address) is not int or type(length) is not int or not 0 <= address <= MAX64 or not 1 <= length <= 65536 or address + length > MAX64:
            raise ValueError("selected range must be a bounded uint64 interval of1..65536 bytes")
        matches = [segment for segment in self.segments
                   if address < segment.address + segment.size and segment.address < address + length]
        if len(matches) != 1:
            raise ValueError("selected range has absent, overlapping or multiple segment backing")
        segment = matches[0]
        relative = address - segment.address
        if relative < 0 or relative + length > segment.stored:
            raise ValueError("selected range is partial or zero-filled, not fully stored")
        offset = segment.offset + relative
        self.stream.seek(offset)
        raw = self.stream.read(length)
        if len(raw) != length:
            raise ValueError("short physical core-file read")
        return raw, {"Address": f"{address:016X}", "Bytes": length, "FileOffset": offset,
                     "Sha256": hashlib.sha256(raw).hexdigest().upper(), "PhysicalFileBacking": True}
