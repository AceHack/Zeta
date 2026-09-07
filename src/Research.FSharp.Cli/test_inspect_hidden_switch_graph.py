"""Synthetic capture-admission witnesses; no debugger process or policy is run."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("capture_under_test", Path(__file__).with_name("inspect_hidden_switch_graph.py"))
MODULE = importlib.util.module_from_spec(SPEC)
with patch.dict(sys.modules, {"lldb": SimpleNamespace()}):
    SPEC.loader.exec_module(MODULE)


class Error:
    def Success(self):
        return True


class Region:
    def IsReadable(self):
        return True

    def IsExecutable(self):
        return True

    def GetRegionBase(self):
        return 4096

    def GetRegionEnd(self):
        return 8192


class Instruction:
    def __init__(self, offset, mode):
        self.offset = offset
        self.mode = mode

    def IsValid(self):
        return True

    def GetAddress(self):
        return SimpleNamespace(GetLoadAddress=lambda _: 4096 + self.offset * 4 + (4 if self.mode == "address" else 0))

    def GetByteSize(self):
        return 8 if self.mode == "width" else 4

    def GetData(self, _target):
        return SimpleNamespace(GetUnsignedInt8=lambda _error, offset: (b"\x1f\x20\x03\xd5"[offset] ^ (1 if self.mode == "bytes" else 0)))

    def GetMnemonic(self, _target):
        return "nop"

    def GetOperands(self, _target):
        return ""

    def GetComment(self, _target):
        return ""


class Instructions(list):
    def GetSize(self):
        return len(self)


class GraphCaptureTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name)
        self.original = MODULE.lldb
        MODULE.lldb = SimpleNamespace(SBError=Error, SBMemoryRegionInfo=Region, SBAddress=lambda address, _target: address, eStateExited=10, eStateDetached=9)
        self.process = SimpleNamespace(GetMemoryRegionInfo=lambda *_: Error(), ReadMemory=lambda _address, size, _error: b"\x1f\x20\x03\xd5" * (size // 4))
        self.method = {"Prepared": True, "Callable": "0000000000001000", "Type": "Hand", "Name": "fixture"}

    def tearDown(self):
        MODULE.lldb = self.original
        self.directory.cleanup()

    def target(self, mode):
        return SimpleNamespace(ReadInstructions=lambda *_: Instructions(Instruction(i, mode) for i in range(15 if mode == "partial" else 16)))

    def test_valid_prefix_has_matching_bytes_but_never_admits_body(self):
        rows = MODULE._entries(self.target("valid"), self.process, {"Methods": [self.method]}, self.path)
        self.assertTrue(rows[0]["Captured"])
        self.assertFalse(rows[0]["BodyResolved"])
        self.assertEqual(16, len(rows[0]["DecodedPrefix"]))
        self.assertTrue((self.path / "prefix-0000-raw.json").is_file())
        self.assertTrue((self.path / "prefix-0000-decoded.json").is_file())

    def test_partial_discontinuous_wide_or_changed_decode_refuses_and_keeps_raw(self):
        for mode in ("partial", "address", "width", "bytes"):
            with self.subTest(mode=mode):
                path = self.path / mode
                path.mkdir()
                with self.assertRaises(RuntimeError):
                    MODULE._entries(self.target(mode), self.process, {"Methods": [self.method]}, path)
                self.assertTrue((path / "prefix-0000-raw.json").is_file())
                self.assertFalse((path / "prefix-0000-decoded.json").exists())

    def test_later_refusal_keeps_earlier_actual_prefix(self):
        modes = iter(("valid", "partial"))
        target = SimpleNamespace(ReadInstructions=lambda *_: self.target(next(modes)).ReadInstructions())
        with self.assertRaises(RuntimeError):
            MODULE._entries(target, self.process, {"Methods": [self.method, self.method]}, self.path)
        self.assertTrue((self.path / "prefix-0000-decoded.json").is_file())
        self.assertTrue((self.path / "prefix-0001-raw.json").is_file())

    def test_async_restoration_failure_does_not_erase_primary_failure(self):
        host, dll = self.path / "host", self.path / "task.dll"
        for path in (host, dll, dll.with_suffix(".runtimeconfig.json"), dll.with_suffix(".deps.json")):
            path.write_bytes(b"fixture")
        def set_async(value):
            if not value:
                raise RuntimeError("secondary restore witness")
        def target(_path):
            raise RuntimeError("primary target witness")
        debugger = SimpleNamespace(GetVersionString=lambda: "synthetic", GetAsync=lambda: False, SetAsync=set_async, CreateTarget=target)
        errors = []
        result = SimpleNamespace(SetError=errors.append)
        attempt = self.path / "attempt"
        MODULE.capture(debugger, f"{host} {dll} {attempt}", result, None)
        outcome = json.loads((attempt / "outcome.json").read_text())
        self.assertFalse(outcome["Complete"])
        self.assertEqual("primary target witness", outcome["Failure"]["Detail"])
        self.assertEqual("secondary restore witness", outcome["SecondaryFailures"][0]["Detail"])

    def test_existing_attempt_refuses_without_writing(self):
        attempt = self.path / "existing"
        attempt.mkdir()
        sentinel = attempt / "sentinel"
        sentinel.write_bytes(b"owned earlier")
        errors = []
        MODULE.capture(SimpleNamespace(), f"host task.dll {attempt}", SimpleNamespace(SetError=errors.append), None)
        self.assertTrue(errors)
        self.assertEqual([sentinel], list(attempt.iterdir()))
        self.assertEqual(b"owned earlier", sentinel.read_bytes())

    def test_completion_is_process_bound_and_exclusive(self):
        path = self.path / "native.jsonl.complete"
        MODULE._complete(path, 12345)
        self.assertEqual(b"graph-capture-complete:12345\n", path.read_bytes())
        with self.assertRaises(FileExistsError):
            MODULE._complete(path, 67890)
        self.assertEqual(b"graph-capture-complete:12345\n", path.read_bytes())
        for invalid in (True, 0, -1, "12345"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                MODULE._complete(self.path / "invalid", invalid)
        self.assertFalse((self.path / "invalid").exists())


if __name__ == "__main__":
    unittest.main()
