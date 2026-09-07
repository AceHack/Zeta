"""Pure ARM64 shape and fake-memory witnesses; no target/policy executes."""

import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("calls_under_test", Path(__file__).with_name("inspect_hidden_switch_calls.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def movz(reg, value, chunk=0):
    return 0xD2800000 | (chunk << 21) | (value << 5) | reg


def movk(reg, value, chunk):
    return 0xF2800000 | (chunk << 21) | (value << 5) | reg


def shape():
    return [movz(2, 0xDAB8), movk(2, 0x804, 1), movk(2, 1, 2), 0xF9400042, 0xD63F0040]


class CallTests(unittest.TestCase):
    def test_consecutive_words_reconstruct_cell_and_registers(self):
        self.assertEqual({"Address": 0x10804DAB8, "StartIndex": 0, "BaseRegister": 2, "TargetRegister": 2}, MODULE.indirect_cell(shape(), 4))
        offset = shape()
        offset[-2] |= 3 << 10
        self.assertEqual(0x10804DAD0, MODULE.indirect_cell(offset, 4)["Address"])

    def test_rewritten_chunks_follow_actual_instruction_order(self):
        words = [movz(2, 1), movk(2, 3, 0), movk(2, 4, 0), 0xF9400042, 0xD63F0040]
        self.assertEqual(4, MODULE.indirect_cell(words, 4)["Address"])
        words = [movz(2, 9, 2), 0xF9400042, 0xD61F0040]
        self.assertEqual(9 << 32, MODULE.indirect_cell(words, 2)["Address"])

    def test_unknown_gaps_wrong_register_or_missing_movz_remain_unresolved(self):
        mutations = [shape()[1:], shape()[:2] + [0xD503201F] + shape()[3:], shape()[:-1] + [0xD63F0060], shape()[:3] + [0xB9400042] + shape()[4:]]
        for words in mutations:
            with self.subTest(words=words):
                self.assertIsNone(MODULE.indirect_cell(words, len(words) - 1))

    def test_direct_branch_sign_extension(self):
        self.assertEqual(0x1020, MODULE.direct_target(0x94000008, 0x1000))
        self.assertEqual(0x0FF8, MODULE.direct_target(0x17FFFFFE, 0x1000))
        self.assertIsNone(MODULE.direct_target(0xD63F0040, 0x1000))

    def test_cell_address_overflow_refuses_instead_of_inventing_arm64_address(self):
        words = [movz(2, 0xFFFF), movk(2, 0xFFFF, 1), movk(2, 0xFFFF, 2), movk(2, 0xFFFF, 3), 0xF9400442, 0xD63F0040]
        with self.assertRaisesRegex(ValueError, "overflows uint64"):
            MODULE.indirect_cell(words, 5)

    def test_guard_correspondence_retains_raw_and_repeat_without_layout_claim(self):
        bits = ["3FE0000000000000", "3FF0000000000000", "0000000000000000", "8000000000000000"]
        raw = b"".join(int(value, 16).to_bytes(8, "little") for value in bits)
        report = {"Guards": {"SameReference": True, "DataBytes": 32, "GetterBits": bits, "DataAddress": "0000000000001000"}}
        artifacts = {}
        row = MODULE.capture_guards(None, None, report, lambda *_: raw, artifacts.__setitem__)
        self.assertFalse(row["LayoutAdmitted"])
        self.assertEqual({"guard-data-raw.json", "guard-data-repeat.json"}, set(artifacts))
        for values in ([bytes(32)], [raw, bytes(32)]):
            artifacts = {}
            stream = iter(values)
            with self.assertRaises(ValueError):
                MODULE.capture_guards(None, None, report, lambda *_, stream=stream: next(stream), artifacts.__setitem__)
            self.assertIn("guard-data-raw.json", artifacts)

    def test_static_cell_capture_retains_unknown_and_changed_pointer(self):
        words = shape() + [0xD63F0060]
        block = {"Name": "Hand:choose():int", "Instructions": [{"Word": f"{word:08X}", "Offset": index * 4} for index, word in enumerate(words)]}
        body = {"Method": {"Type": "Hand", "Name": "choose"}, "CandidateStart": "0000000000006000", "CandidateEnd": "0000000000006018"}
        artifacts = {}
        reads = []
        def read(_lldb, _process, address, size, executable=False):
            reads.append((address, size, executable))
            return (0x6000).to_bytes(8, "little") if size == 8 else bytes(16)
        result = MODULE.capture_transfers(None, None, [body], [block], read, artifacts.__setitem__)
        self.assertEqual(2, len(result["Rows"]))
        self.assertTrue(result["Rows"][0]["ResolvedStaticShape"])
        self.assertEqual(0, result["Rows"][0]["CandidateRanges"][0]["Offset"])
        self.assertFalse(result["Rows"][0]["ObservedExecution"])
        self.assertIsNotNone(result["Rows"][1]["Failure"])
        self.assertEqual([(0x10804DAB8, 8, False), (0x6000, 16, True), (0x10804DAB8, 8, False)], reads)
        artifacts = {}
        replies = iter([(0x6000).to_bytes(8, "little"), bytes(16), (0x7000).to_bytes(8, "little")])
        result = MODULE.capture_transfers(None, None, [body], [block], lambda *_: next(replies), artifacts.__setitem__)
        self.assertIn("changed", result["Rows"][0]["Failure"])
        self.assertIn("call-0000-0004-mapping.json", artifacts)
        self.assertIn("call-0000-0004-repeat.json", artifacts)
        self.assertIn("call-0000-0004-refused.json", artifacts)


if __name__ == "__main__":
    unittest.main()
