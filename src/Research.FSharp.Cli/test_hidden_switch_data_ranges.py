import copy
import unittest

from hidden_switch_data_ranges import EXPECTED, derive_ranges
from hidden_switch_transfer_inputs import FLAGS
from hidden_switch_transfer_shapes import classify_word, ranges_admitted


class DataRangeTests(unittest.TestCase):
    def fixture(self, literal_targets=(0x4000, 0x5000)):
        base = 0x1000
        code = [0xD2800001 | (0x6000 << 5), 0xF9400021, 0xD63F0020] * 2
        for index, (prefix, target) in enumerate(zip([0x5C000000, 0x9C000000], literal_targets, strict=True), start=6):
            code.append(prefix | (((target - (base + index * 4)) // 4 & 0x7FFFF) << 5))
        names = ["mov x1, #24576", "ldr x1, [x1]", "blr x1"] * 2 + ["ldr d0, #0", "ldr q0, #0"]
        literals = {"RWD00": "00" * 8, "RWD08": "01" * 16}
        ranges = ranges_admitted([{"Role": "method-000", "Start": base, "Bytes": len(code) * 4}])
        rows = []
        for index, (word, name) in enumerate(zip(code, names, strict=True)):
            operand = "d0, [@RWD00]" if index == 6 else "q0, [@RWD08]" if index == 7 else ""
            shape = classify_word(code, index, base + index * 4, name, operand, literals, ranges, {})
            rows.append({"Role": "method-000", "Offset": index * 4,
                         "Decoded": {"Offset": index * 4, "Address": f"{base+index*4:016X}", "Hex": word.to_bytes(4,"little").hex().upper(), "Instruction": name},
                         "Compiler": {"Offset": index * 4, "Word": f"{word:08X}", "Operands": operand}, "Shape": shape})
        return [{"Role": "method-000", "Method": {"Role": "method-000", "Address": base, "Bytes": len(code)*4},
                 "Complete": True, "ObservedExecution": False, "Words": rows, **FLAGS}]

    def counts(self):
        return {"Methods": 1, "Words": 8, "CellSites": 2, "Cells": 1, "Literals": 2, "Bytes": 32}

    def test_cells_first_address_order_and_original_site_order(self):
        result = derive_ranges(self.fixture(), self.counts())
        self.assertEqual([row["Address"] for row in result["Ranges"]], ["0000000000006000", "0000000000004000", "0000000000005000"])
        cell = result["Ranges"][0]
        self.assertIsNone(cell["ExpectedHex"])
        self.assertEqual([row["Offset"] for row in cell["Uses"]], [8, 20])
        self.assertEqual(result["Bytes"], 32)
        self.assertTrue(result["ProposalOnly"]); self.assertEqual(result["NewMemoryQueries"], 0)
        self.assertTrue(all(result[key] is False for key in FLAGS))

    def test_production_counts_are_fixed_and_immutable(self):
        self.assertEqual(dict(EXPECTED), {"Methods":130,"Words":8665,"CellSites":134,"Cells":43,"Literals":10,"Bytes":496})
        with self.assertRaises(TypeError): EXPECTED["Cells"] = 1
        with self.assertRaises(ValueError): derive_ranges(self.fixture())

    def test_same_kind_partial_and_cross_kind_overlaps_refuse(self):
        for targets in [(0x4000, 0x4004), (0x6000, 0x5000), (0x4000, 0x5FFC)]:
            with self.subTest(targets=targets), self.assertRaises(ValueError): derive_ranges(self.fixture(targets), self.counts())

    def test_literal_repeated_address_and_width_label_value_refuse(self):
        with self.assertRaises(ValueError): derive_ranges(self.fixture((0x4000,0x4000)), self.counts())
        for key, value in [("Bytes", 16), ("Bytes", True), ("Label", "RWD01"), ("ExpectedHex", "00"), ("PhysicalBinding", True)]:
            methods = self.fixture(); methods[0]["Words"][6]["Shape"]["Literal"][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): derive_ranges(methods, self.counts())

    def test_cell_address_and_dependency_changes_refuse(self):
        for key, value in [("Address", "0000000000007000"), ("Address", "0000000000006001"), ("StartIndex", 1),
                           ("TargetRegister", 2), ("BaseRegister", 2), ("Words", [])]:
            methods = self.fixture(); methods[0]["Words"][2]["Shape"]["StaticCell"][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError): derive_ranges(methods, self.counts())

    def test_word_and_method_reordering_or_omission_refuse(self):
        methods = self.fixture(); methods[0]["Words"] = methods[0]["Words"][::-1]
        with self.assertRaises(ValueError): derive_ranges(methods, self.counts())
        methods = self.fixture(); methods[0]["Words"].pop()
        with self.assertRaises(ValueError): derive_ranges(methods, self.counts())
        methods = self.fixture(); methods += copy.deepcopy(methods)
        with self.assertRaises(ValueError): derive_ranges(methods, {**self.counts(), "Methods":2})

    def test_targets_or_changed_bytes_cannot_become_unknown_cell_proposal(self):
        for field, value in [("Targets", [{"Address":"0000000000007000"}]), ("ObservedExecution", True), ("RuntimeAdmitted", True), ("Word", "D63F0040")]:
            methods = self.fixture(); methods[0]["Words"][2]["Shape"][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError): derive_ranges(methods, self.counts())
        methods = self.fixture(); methods[0]["Words"][2]["Shape"]["StaticCell"]["PhysicalValueReused"] = True
        with self.assertRaises(ValueError): derive_ranges(methods, self.counts())

    def test_every_count_is_load_bearing(self):
        for key in self.counts():
            counts = self.counts(); counts[key] += 1
            with self.subTest(key=key), self.assertRaises(ValueError): derive_ranges(self.fixture(), counts)


if __name__ == "__main__":
    unittest.main()
