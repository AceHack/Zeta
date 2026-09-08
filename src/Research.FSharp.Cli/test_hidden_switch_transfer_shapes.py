"""Pure finite word/metadata fixtures; no retained inventory or memory query."""

import hashlib
import unittest

from hidden_switch_transfer_shapes import (
    CONDITIONS,
    classify_word,
    control_location,
    known_cells_admitted,
    ranges_admitted,
    signed,
)


class TransferShapeTests(unittest.TestCase):
    def ranges(self):
        return [{"Role": "caller", "Start": 0x1000, "Bytes": 0x100}, {"Role": "callee", "Start": 0x3000, "Bytes": 16}]

    def one(self, word, text, pc=0x1000, operands="", literals=None):
        return classify_word([word], 0, pc, text, operands, literals or {}, self.ranges(), {})

    def cell(self):
        return {"Role": "callee", "Address": 0x2000, "Bytes": 8, "Target": 0x3000,
                "Sha256": hashlib.sha256(bytes.fromhex("0030000000000000")).hexdigest().upper()}

    def test_signed_fields_and_invalid_metadata(self):
        for bits in [14, 19, 26]:
            self.assertEqual(signed(0, bits), 0)
            self.assertEqual(signed((1 << (bits - 1)) - 1, bits), (1 << (bits - 1)) - 1)
            self.assertEqual(signed(1 << (bits - 1), bits), -(1 << (bits - 1)))
            self.assertEqual(signed((1 << bits) - 1, bits), -1)
            for value in [True, -1, 1 << bits]:
                with self.assertRaises(ValueError):
                    signed(value, bits)

    def test_range_entry_interior_outside_and_half_open_end(self):
        ranges = ranges_admitted(self.ranges())
        self.assertEqual(control_location(0x1000, ranges)["Membership"], "entry")
        self.assertEqual(control_location(0x1004, ranges)["Offset"], 4)
        self.assertEqual(control_location(0x1100, ranges)["Membership"], "outside-retained-code")
        for target in [0, -4, 0x1001, 1 << 64]:
            with self.assertRaises(ValueError):
                control_location(target, ranges)
        for extra in [{"Role": "other", "Start": 0x1004, "Bytes": 4}, {"Role": "caller", "Start": 0x4000, "Bytes": 4}]:
            with self.assertRaises(ValueError):
                ranges_admitted(ranges + [extra])

    def test_direct_signed_destinations_ignore_printer_addresses(self):
        for linked in [False, True]:
            for delta in [0, 4, -4, ((1 << 25) - 1) * 4, -(1 << 25) * 4]:
                word = (0x94000000 if linked else 0x14000000) | ((delta // 4) & 0x03FFFFFF)
                row = self.one(word, ("bl" if linked else "b") + " #999999999999", pc=0x100000000)
                self.assertNotIn("StructuralFailure", row)
                self.assertEqual(int(row["Targets"][0]["Address"], 16), 0x100000000 + delta)
                self.assertEqual(row["Kind"], "call-direct" if linked else "jump-direct")
                self.assertEqual(row["Continuation"] is not None, linked)
                self.assertFalse(row["ObservedExecution"])

    def test_overflow_underflow_and_mnemonic_mismatch_preserve_word_and_attempt(self):
        underflow = self.one(0x17FFFFFE, "b #-8", pc=4)
        self.assertIn("StructuralFailure", underflow)
        self.assertEqual(underflow["AttemptedTargetIntegers"], [-4])
        overflow = self.one(0x14000001, "b #4", pc=(1 << 64) - 4)
        self.assertIn("StructuralFailure", overflow)
        self.assertEqual(overflow["AttemptedTargetIntegers"], [1 << 64])
        mismatch = self.one(0x94000000, "b #0")
        self.assertIn("StructuralFailure", mismatch)
        self.assertEqual(mismatch["Word"], "94000000")

    def test_all_supported_condition_codes_and_unsupported_variants(self):
        for condition, name in enumerate(CONDITIONS):
            row = self.one(0x54FFFFE0 | condition, "b." + name + " #-4")
            self.assertEqual(row["Condition"], name)
            self.assertEqual([int(item["Address"], 16) for item in row["Targets"]], [0xFFC, 0x1004])
        for word, text in [(0x5400000E, "b.al #0"), (0x5400000F, "b.nv #0"), (0x54000010, "bc.eq #0")]:
            row = self.one(word, text)
            self.assertEqual(row["Kind"], "unsupported")
            self.assertTrue(row["Unresolved"])
            self.assertEqual(row["Targets"], [])

    def test_compare_zero_and_test_bit_registers_and_immediates(self):
        for sf in [0, 1]:
            for nonzero in [0, 1]:
                word = 0x34000000 | (sf << 31) | (nonzero << 24) | (0x7FFFF << 5) | 7
                row = self.one(word, ("cbnz" if nonzero else "cbz") + " ignored-printer-target")
                self.assertEqual(row["Register"], "x7" if sf else "w7")
                self.assertEqual(int(row["Targets"][0]["Address"], 16), 0xFFC)
                bit = 63 if sf else 31
                word = 0x36000000 | (sf << 31) | (nonzero << 24) | ((bit & 31) << 19) | (1 << 5) | 6
                row = self.one(word, "tbnz" if nonzero else "tbz")
                self.assertEqual(row["Bit"], bit)
                self.assertEqual(row["Register"], "x6" if sf else "w6")
                self.assertEqual(int(row["Targets"][0]["Address"], 16), 0x1004)

    def test_returns_traps_auth_and_system_do_not_invent_fallthrough(self):
        for word, text, kind in [(0xD65F03C0, "ret", "return"), (0xD4200000, "brk #0", "trap"),
                                 (0x00000042, "udf #66", "trap"), (0xD69F03E0, "eret", "unsupported"),
                                 (0xD71F0800, "braa x0, x0", "unsupported"), (0xD4000001, "svc #0", "unsupported"),
                                 (0xD61F03E0, "br xzr", "unsupported"), (0xD65F03E0, "ret xzr", "unsupported")]:
            row = self.one(word, text)
            self.assertEqual(row["Kind"], kind)
            self.assertIsNone(row["Continuation"])
            self.assertEqual(row["Targets"], [])
            self.assertTrue(row["Unresolved"])

    def test_known_cell_exact_identity_and_corruptions(self):
        cell = self.cell()
        admitted = known_cells_admitted([cell], self.ranges())
        self.assertEqual(admitted[0x2000]["Target"], 0x3000)
        for changed in [{**cell, "Bytes": 4}, {**cell, "Bytes": 8.0}, {**cell, "Target": 0x3004},
                        {**cell, "Sha256": "0" * 64}, {**cell, "Role": "absent"}, {**cell, "Address": 0x2001}]:
            with self.assertRaises(ValueError):
                known_cells_admitted([changed], self.ranges())
        with self.assertRaises(ValueError):
            known_cells_admitted([cell, cell], self.ranges())

    def test_static_cell_reuse_is_distinct_from_unknown_value_and_execution(self):
        words = [0xD2840008, 0xF9400110, 0xD63F0200]
        known = known_cells_admitted([self.cell()], self.ranges())
        row = classify_word(words, 2, 0x1008, "blr x16", "", {}, self.ranges(), known)
        self.assertEqual(row["StaticCell"]["Address"], "0000000000002000")
        self.assertTrue(row["StaticCell"]["PhysicalValueReused"])
        self.assertEqual(row["Targets"][0]["Role"], "callee")
        self.assertIn("indirect-execution-and-target-set-not-established", row["Unresolved"])
        unknown = classify_word(words, 2, 0x1008, "blr x16", "", {}, self.ranges(), {})
        self.assertFalse(unknown["StaticCell"]["PhysicalValueReused"])
        self.assertEqual(unknown["Targets"], [])
        for changed in [[0xD2840009, *words[1:]], [*words[:1], 0xF9400130, words[2]], [0xD503201F, *words[1:]]]:
            row = classify_word(changed, 2, 0x1008, "blr x16", "", {}, self.ranges(), known)
            self.assertIsNone(row["StaticCell"])
            self.assertIn("unsupported-indirect-dependency", row["Unresolved"])

    def test_literal_outside_code_remains_prospective_data(self):
        row = self.one(0x5C008000, "ldr d0, #4096", operands="d0, [@RWD00]", literals={"RWD00": "1122334455667788"})
        self.assertEqual(row["Literal"]["Address"], "0000000000002000")
        self.assertEqual(row["Literal"]["Bytes"], 8)
        self.assertEqual(row["Literal"]["ExpectedHex"], "1122334455667788")
        self.assertFalse(row["Literal"]["PhysicalBinding"])
        self.assertNotIn("control-target-outside-retained-code", row["Unresolved"])
        self.assertEqual(row["Targets"], [])

    def test_literal_opcode_requires_exact_supported_annotation_and_width(self):
        cases = [(0x5C000000, "", {}), (0x5C000000, "[@RWD00]", {}),
                 (0x5C000000, "[@RWD00] [@RWD00]", {"RWD00": "00" * 8}),
                 (0x5C000000, "[@RWD00]", {"RWD00": "00" * 16}),
                 (0x58000000, "[@RWD00]", {"RWD00": "00" * 8})]
        for word, operands, literals in cases:
            row = self.one(word, "ldr", operands=operands, literals=literals)
            self.assertIsNone(row["Literal"]["ExpectedHex"])
            self.assertGreaterEqual(len(row["Unresolved"]), 2)
            self.assertFalse(row["Literal"]["PhysicalBinding"])
        row = self.one(0x9C000000, "ldr", operands="[@RWD00]", literals={"RWD00": "00" * 16})
        self.assertEqual(row["Literal"]["Bytes"], 16)
        wrong_opcode = self.one(0xD2800000, "mov", operands="[@RWD00]", literals={"RWD00": "00" * 8})
        self.assertIn("compiler-literal-label-without-literal-opcode", wrong_opcode["Unresolved"])

    def test_unknown_rows_continue_pure_accounting_and_keep_full_flags_false(self):
        rows = [self.one(word, text) for word, text in [(0xD69F03E0, "eret"), (0x91000000, "add"), (0xD4200000, "brk")]]
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[1]["Kind"], "ordinary-instruction-effects-uninspected")
        self.assertTrue(all(row["Unresolved"] for row in rows))
        for row in rows:
            self.assertTrue(all(row[key] is False for key in ["ObservedExecution", "RuntimeAdmitted", "BodyResolved", "ClosureAdmitted"]))


if __name__ == "__main__":
    unittest.main()
