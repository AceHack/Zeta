"""Synthetic core metadata/range witnesses; no process or real dump opened."""

import io
import struct
import unittest

from hidden_switch_dump_memory import MachCore


def core(segments):
    commands = len(segments) * 72
    header = struct.pack("<8I", 0xFEEDFACF, 0x0100000C, 0, 4, len(segments), commands, 0, 0)
    entries = b"".join(struct.pack("<II16s4Q4I", 0x19, 72, b"", address, virtual, offset, stored, 7, 5, 0, flags)
                       for address, virtual, offset, stored, flags in segments)
    return bytearray((header + entries).ljust(1024, b"\xAA"))


class PhysicalCoreTests(unittest.TestCase):
    def test_exact_stored_range_has_offset_and_bytes(self):
        raw = core([(0x1000, 64, 512, 32, 0)])
        raw[520:528] = bytes(range(8))
        parsed = MachCore(io.BytesIO(raw), len(raw))
        value, record = parsed.read(0x1008, 8)
        self.assertEqual(value, bytes(range(8)))
        self.assertEqual(record["FileOffset"], 520)
        self.assertTrue(record["PhysicalFileBacking"])

    def test_zero_fill_gap_overlap_and_partial_refuse(self):
        for segments, address, length in [
            ([(0x1000, 64, 512, 32, 0)], 0x1020, 1),
            ([(0x1000, 64, 512, 32, 0)], 0x0FFF, 2),
            ([(0x1000, 64, 512, 32, 0)], 0x2000, 8),
            ([(0x1000, 32, 512, 32, 0), (0x1010, 32, 544, 32, 0)], 0x1010, 8),
            ([(0x1000, 8, 512, 8, 0), (0x1008, 8, 520, 8, 0)], 0x1000, 16),
        ]:
            raw = core(segments)
            with self.assertRaises(ValueError):
                MachCore(io.BytesIO(raw), len(raw)).read(address, length)

    def test_highvm_other_flags_and_out_of_file_refuse(self):
        for segment in [(0x1000, 64, 512, 32, 1), (0x1000, 64, 512, 32, 2),
                        (0x1000, 64, 1000, 32, 0), ((1 << 64) - 1, 64, 512, 32, 0)]:
            raw = core([segment])
            with self.assertRaises(ValueError):
                MachCore(io.BytesIO(raw), len(raw))

    def test_header_command_and_metadata_backing_refuse(self):
        mutations = [(0, 0), (4, 0), (16, 0), (20, 8), (32, 0x31), (36, 64)]
        for offset, value in mutations:
            raw = core([(0x1000, 64, 512, 32, 0)])
            struct.pack_into("<I", raw, offset, value)
            with self.assertRaises(ValueError):
                MachCore(io.BytesIO(raw), len(raw))
        raw = core([(0x1000, 64, 40, 32, 0)])
        with self.assertRaises(ValueError):
            MachCore(io.BytesIO(raw), len(raw))

    def test_selected_length_type_and_short_read_refuse(self):
        raw = core([(0x1000, 64, 512, 32, 0)])
        stream = io.BytesIO(raw)
        parsed = MachCore(stream, len(raw))
        for address, length in [(True, 1), (0x1000, 0), (0x1000, 65537), ((1 << 64) - 1, 1)]:
            with self.assertRaises(ValueError):
                parsed.read(address, length)
        stream.truncate(514)
        with self.assertRaises(ValueError):
            parsed.read(0x1000, 8)


if __name__ == "__main__":
    unittest.main()
