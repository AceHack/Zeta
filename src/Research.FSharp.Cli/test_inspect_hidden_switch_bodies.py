"""Hand-authored candidate admission witnesses; no target or policy executes."""

import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace

SPEC = importlib.util.spec_from_file_location("body_under_test", Path(__file__).with_name("inspect_hidden_switch_bodies.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
BLOCK = "; Assembly listing for method Hand:choose():int (FullOpts)\nG_M000_IG01: ;; offset=0x0000\n        D2800020          mov     x0, #1\n        D65F03C0          ret     lr\n; Total bytes of code 8\n"


class BodyTests(unittest.TestCase):
    def test_compiler_declared_span_keeps_exact_instruction_bytes(self):
        block = MODULE.parse_blocks(BLOCK)[0]
        self.assertEqual("200080D2C0035FD6", block["Hex"])
        self.assertEqual(8, block["Bytes"])
        self.assertEqual([0, 4], [x["Offset"] for x in block["Instructions"]])

    def test_truncation_wrong_offsets_sizes_or_missing_blocks_refuse(self):
        for value in ("", BLOCK.replace("Total bytes of code 8", "Total bytes of code 12"), BLOCK.replace("offset=0x0000", "offset=0x0004"), BLOCK.replace("G_M000_IG01: ;; offset=0x0000\n", ""), BLOCK.replace("D2800020", "D280020"), BLOCK.split("; Total")[0]):
            with self.subTest(value=value), self.assertRaises(ValueError):
                MODULE.parse_blocks(value)

    def test_stub_literal_signed_displacement_and_register_shape(self):
        # The observed x11 literal-load/branch shape, plus a negative displacement.
        self.assertEqual(0x5000, MODULE.stub_cell(bytes.fromhex("0B00025860011FD6"), 0x1000))
        self.assertEqual(0x0FF8, MODULE.stub_cell((0x58FFFFCB).to_bytes(4, "little") + bytes.fromhex("60011FD6"), 0x1000))
        for raw in (b"", bytes.fromhex("0C00025860011FD6"), bytes.fromhex("0B00025880011FD6")):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                MODULE.stub_cell(raw, 0x1000)

    def test_region_bounds_and_execute_permission_precede_read(self):
        reads = []
        region = SimpleNamespace(IsReadable=lambda: True, IsExecutable=lambda: False, GetRegionBase=lambda: 0x1000, GetRegionEnd=lambda: 0x2000)
        error = SimpleNamespace(Success=lambda: True)
        lldb = SimpleNamespace(SBMemoryRegionInfo=lambda: region, SBError=lambda: error)
        process = SimpleNamespace(GetMemoryRegionInfo=lambda *_: error, ReadMemory=lambda *args: reads.append(args))
        for address, size, executable in [(0x1000, 8, True), (0x1FFC, 8, False), (0x1000, 0, False), (0x0FFF, 4, False)]:
            with self.subTest(address=address, size=size), self.assertRaises(ValueError):
                MODULE._read(lldb, process, address, size, executable)
        self.assertEqual([], reads)

    def test_mismatched_actual_body_keeps_mapping_and_raw_before_refusal(self):
        error = SimpleNamespace(Success=lambda: True)
        region = SimpleNamespace(IsReadable=lambda: True, IsExecutable=lambda: True, GetRegionBase=lambda: 0x1000, GetRegionEnd=lambda: 0x10000)
        memory = {0x1000: bytes.fromhex("0B00025860011FD6"), 0x5000: (0x6000).to_bytes(8, "little"), 0x6000: bytes(8)}
        process = SimpleNamespace(GetMemoryRegionInfo=lambda *_: error, ReadMemory=lambda address, size, _error: memory[address][:size])
        lldb = SimpleNamespace(SBMemoryRegionInfo=lambda: region, SBError=lambda: error)
        artifacts = {}
        report = {"Methods": [{"Prepared": True, "Type": "Hand", "Name": "choose", "Callable": "0000000000001000"}]}
        with self.assertRaisesRegex(ValueError, "actual target bytes"):
            MODULE.capture(lldb, None, process, report, MODULE.parse_blocks(BLOCK), artifacts.__setitem__)
        self.assertEqual({"body-0000-mapping.json", "body-0000-raw.json"}, set(artifacts))
        self.assertEqual("0000000000006000", artifacts["body-0000-mapping.json"]["Target"])

    def literal_fixture(self, mode="valid"):
        text = BLOCK.replace("D2800020          mov     x0, #1", "5C000040          ldr     d0, [@RWD00]").replace("; Total", "RWD00 dq 3D719799812DEA11h ; epsilon\n; Total")
        if mode == "annotation":
            text = text.replace("[@RWD00]", "[unresolved]").replace("RWD00 dq 3D719799812DEA11h ; epsilon\n", "")
        if mode == "vector":
            text = text.replace("5C000040", "9C000040").replace("ldr     d0", "ldr     q0").replace("3D719799812DEA11h ; epsilon", "0000000000000001h, 0000000400000001h")
        block = MODULE.parse_blocks(text)[0]
        raw = bytes.fromhex(block["Hex"])
        pointer_reads = []
        memory = {0x1000: bytes.fromhex("0B00025860011FD6"), 0x5000: (0x6000).to_bytes(8, "little"), 0x6000: raw, 0x6008: (0x3D719799812DEA11).to_bytes(8, "little")}
        if mode == "literal":
            memory[0x6008] = bytes(8)
        if mode == "vector":
            memory[0x6008] = bytes.fromhex("01000000000000000100000004000000")
        def read(address, size, _error):
            if address == 0x5000:
                pointer_reads.append(address)
                if mode == "pointer" and len(pointer_reads) > 1:
                    return (0x7000).to_bytes(8, "little")
            return memory[address][:size]
        error = SimpleNamespace(Success=lambda: True)
        region = SimpleNamespace(IsReadable=lambda: True, IsExecutable=lambda: True, GetRegionBase=lambda: 0x1000, GetRegionEnd=lambda: 0x10000)
        lldb = SimpleNamespace(SBMemoryRegionInfo=lambda: region, SBError=lambda: error, SBAddress=lambda address, _target: address)
        process = SimpleNamespace(GetMemoryRegionInfo=lambda *_: error, ReadMemory=read)
        class Instructions(list):
            def GetSize(self):
                return len(self)
        def instruction(i):
            data = raw[i * 4:i * 4 + 4]
            return SimpleNamespace(IsValid=lambda: True, GetAddress=lambda: SimpleNamespace(GetLoadAddress=lambda _: 0x6000 + 4 * i), GetByteSize=lambda: 4, GetData=lambda _: SimpleNamespace(GetUnsignedInt8=lambda _error, offset: data[offset]), GetMnemonic=lambda _: "ldr" if i == 0 else "ret", GetOperands=lambda _: "d0, 0x6008" if i == 0 else "lr", GetComment=lambda _: "")
        target = SimpleNamespace(ReadInstructions=lambda *_: Instructions(instruction(i) for i in range(2)))
        report = {"Methods": [{"Prepared": True, "Type": "Hand", "Name": "choose", "Callable": "0000000000001000"}]}
        return lldb, target, process, report, [block]

    def test_complete_candidate_binds_actual_double_literal_without_runtime_admission(self):
        artifacts = {}
        rows = MODULE.capture(*self.literal_fixture(), artifacts.__setitem__)
        self.assertEqual("11EA2D819997713D", rows[0]["Literals"][0]["Hex"])
        self.assertEqual("0000000000006008", rows[0]["Literals"][0]["Address"])
        self.assertEqual(2, rows[0]["IndependentDecodedInstructions"])
        self.assertFalse(rows[0]["RuntimeAdmitted"])
        self.assertFalse(rows[0]["BodyResolved"])
        self.assertFalse(rows[0]["ClosureAdmitted"])
        self.assertIn("body-0000-candidate.json", artifacts)

    def test_changed_literal_pointer_or_absent_annotation_refuses_after_retaining_evidence(self):
        for mode in ("literal", "pointer", "annotation"):
            artifacts = {}
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                MODULE.capture(*self.literal_fixture(mode), artifacts.__setitem__)
            self.assertIn("body-0000-mapping.json", artifacts)
            self.assertIn("body-0000-decoded.json", artifacts)
            self.assertNotIn("body-0000-candidate.json", artifacts)
            if mode != "annotation":
                self.assertIn("body-0000-literal-0001.json", artifacts)

    def test_vector_literal_binds_both_words_at_its_actual_width(self):
        artifacts = {}
        rows = MODULE.capture(*self.literal_fixture("vector"), artifacts.__setitem__)
        literal = rows[0]["Literals"][0]
        self.assertEqual(16, literal["Bytes"])
        self.assertEqual("01000000000000000100000004000000", literal["Hex"])
        self.assertEqual(literal["Hex"], literal["CompilerHex"])


if __name__ == "__main__":
    unittest.main()
