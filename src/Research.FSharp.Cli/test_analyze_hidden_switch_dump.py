"""Synthetic driver admission and retention; no diagnostic tool or real dump."""

import gzip
import io
import json
import queue
import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from analyze_hidden_switch_dump import (
    OutputLimitError,
    Session,
    admit_clrpath,
    admit_method,
    admit_runtime,
    admit_tool,
    descriptor_identity,
    empty_symbols,
    physical_method,
    unchanged_descriptor,
)
from capture_hidden_switch_dump import identity


def response(command, payload):
    return f"> {command}\n{payload}\n<END_COMMAND_OUTPUT>\n"


class AnalyzerDriverTests(unittest.TestCase):
    def test_exact_echo_and_empty_symbol_payload(self):
        command = "setsymbolserver -disable"
        good = response(command, "Current symbol store settings:")
        empty_symbols(good, command)
        for bad in [good.replace("> ", "", 1), good.replace(command, "setsymbolserver", 1),
                    response(command, "Current symbol store settings:\n-> https://example.invalid"),
                    response(command, "> " + command + "\nCurrent symbol store settings:")]:
            with self.assertRaises(ValueError):
                empty_symbols(bad, command)

    def test_exact_dac_acknowledgements_and_unique_runtime_fields(self):
        runtime = Path("/fixed/10.0.11")
        admit_clrpath(response("setclrpath /fixed/10.0.11", "Set load path for DAC/DBI to '/fixed/10.0.11'"), runtime, True)
        admit_clrpath(response("setclrpath", "Load path for DAC/DBI: '/fixed/10.0.11'"), runtime, False)
        with self.assertRaises(ValueError):
            admit_clrpath(response("setclrpath", "Error while loading /fixed/10.0.11"), runtime, False)
        payload = "#0 .NET Core runtime 10.0.11 at 0000000100000000 size 00100000 index ABCD\n    Runtime module path: /fixed/10.0.11/libcoreclr.dylib\n    Runtime module directory: /fixed/10.0.11\n    DAC: /fixed/10.0.11/libmscordaccore.dylib (verify)"
        self.assertEqual(admit_runtime(response("runtimes", payload), runtime, True), "/fixed/10.0.11/libmscordaccore.dylib (verify)")
        for bad in [payload + "\n    DAC: /wrong", payload.replace("path: /fixed", "path: /wrong"),
                    payload + "\n#1 .NET Core runtime 8.0 at 0000000200000000 size 00100000 index ABCD",
                    payload.replace("DAC: ", "Error mentions DAC: ")]:
            with self.assertRaises(ValueError):
                admit_runtime(response("runtimes", bad), runtime, True)

    def test_method_identity_fields_are_unique_anchored_and_exact(self):
        method = {"Type": "Zeta.Research.HiddenSwitchPolicy", "Name": "predict", "Token": 0x06000001}
        command = "ip2md 0000000000001000"
        payload = "Method Name: Zeta.Research.HiddenSwitchPolicy.predict(Boolean, Double, Int32)\nmdToken: 0000000006000001\nIsJitted: yes\nCurrent CodeAddr: 0000000000001000\nVersion History:\n     CodeAddr: 0000000000001000  (Optimized)"
        admit_method(response(command, payload), method, 0x1000)
        for bad in [payload + "\nCurrent CodeAddr: 2000", payload.replace("predict(", "predictExtra("),
                    payload.replace("Method Name:", "Error mentions Method Name:"), payload.replace("6000001", "6000002"),
                    payload.replace("Current CodeAddr:", "CodeAddr:"),
                    payload.replace("Current CodeAddr: 0000000000001000", "Current CodeAddr: 0000000000002000"),
                    payload.replace("IsJitted: yes", "IsJitted: no")]:
            with self.assertRaises(ValueError):
                admit_method(response(command, bad), method, 0x1000)

    def test_retained_installed_ip2md_response_passes_exact_current_fields(self):
        root = Path(__file__).resolve().parents[2]
        record = root / "docs/research/hidden-switch-compiled-validation/2026-09-07/native-dump-analysis-attempt-1/command-06.txt.gz"
        method = {"Type": "Zeta.Research.HiddenSwitchPolicy", "Name": "predict", "Token": 100664469}
        raw = gzip.decompress(record.read_bytes()).decode("utf-8")
        admit_method(raw, method, 0x10B720A20)
        # A matching historical CodeAddr cannot authorize a different current body.
        changed = raw.replace("Current CodeAddr:     000000010b720a20", "Current CodeAddr:     000000010b720a24")
        with self.assertRaises(ValueError):
            admit_method(changed, method, 0x10B720A20)

    def test_hash_and_consumption_hold_one_descriptor_and_replacement_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "core"
            path.write_bytes(b"original bytes")
            expected = identity(path)
            with path.open("rb") as stream:
                snapshot = descriptor_identity(stream, path, expected)
                path.rename(Path(directory) / "original")
                path.write_bytes(b"different bytes")
                self.assertEqual(stream.read(), b"original bytes")
                with self.assertRaises(ValueError):
                    unchanged_descriptor(stream, path, snapshot)

    def test_hash_checks_initial_size_and_never_follows_a_producing_stream(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "core"
            path.write_bytes(b"four")
            expected = identity(path)
            with path.open("rb") as real:
                stream = Mock(wraps=real)
                with self.assertRaisesRegex(ValueError, "initial size"):
                    descriptor_identity(stream, path, {**expected, "Bytes": 5})
                stream.read.assert_not_called()
                stream.read.side_effect = lambda count: b"x" * count
                with self.assertRaisesRegex(ValueError, "grew past"):
                    descriptor_identity(stream, path, expected)
                self.assertEqual([call.args[0] for call in stream.read.call_args_list], [4, 1])
            with path.open("rb") as real, patch("analyze_hidden_switch_dump.time.monotonic", side_effect=[0, 121]), self.assertRaises(TimeoutError):
                descriptor_identity(real, path, expected)

    def test_launch_executable_must_be_the_captured_pin(self):
        with tempfile.TemporaryDirectory() as directory:
            tool = Path(directory).resolve() / "dotnet-dump"
            tool.write_bytes(b"captured")
            pins = [identity(tool)]
            self.assertEqual(admit_tool(tool, pins), tool)
            replacement = Path(directory) / "elsewhere"
            replacement.mkdir()
            other = replacement / "dotnet-dump"
            other.write_bytes(b"captured")
            with self.assertRaises(ValueError):
                admit_tool(other, pins)
            tool.write_bytes(b"changed")
            with self.assertRaises(ValueError):
                admit_tool(tool, pins)

    def test_physical_prefix_survives_dependent_body_refusal(self):
        method = {"Name": "predict", "Callable": "0000000000001000"}
        block = {"Bytes": 4, "Hex": "00000000"}
        memory = SimpleNamespace(read=Mock(side_effect=[
            (b"12345678", {"Address": "1000", "Bytes": 8}),
            ((0x3000).to_bytes(8, "little"), {"Address": "2000", "Bytes": 8}),
            ValueError("body missing from physical dump"),
        ]))
        with tempfile.TemporaryDirectory() as directory, patch("analyze_hidden_switch_dump.stub_cell", return_value=0x2000):
            attempt = Path(directory)
            with self.assertRaisesRegex(ValueError, "body missing"):
                physical_method(memory, method, block, attempt)
            self.assertEqual(json.loads((attempt / "physical-predict-stub.json").read_text())["Stub"]["Bytes"], 8)
            self.assertEqual(json.loads((attempt / "physical-predict-cell.json").read_text())["Cell"]["Address"], "2000")
            self.assertFalse((attempt / "physical-predict-body.json").exists())

    def test_metadata_prefix_does_not_override_eof_or_command_error(self):
        command = "u -n -o 0000000000001000"
        prefix = ("> " + command + "\nMethod signature\nBegin 0000000000001000, size fc\n").encode()
        for ending in [b"", b"<END_COMMAND_ERROR>\n"]:
            with tempfile.TemporaryDirectory() as directory:
                session = Session.__new__(Session)
                session.attempt = Path(directory)
                session.count = 0
                session.deadline = time.monotonic() + 1
                session.lines = queue.Queue(maxsize=128)
                for line in (prefix + ending).splitlines(keepends=True):
                    session.lines.put_nowait(line)
                session.reader_failure = None
                session.reader_finished = threading.Event()
                session.reader_finished.set()
                session.publication_failures = []
                session.process = SimpleNamespace(stdin=io.BytesIO())
                with self.assertRaises(ValueError):
                    session.command(command)
                self.assertEqual((session.attempt / "command-00.partial.txt").read_bytes(), prefix + ending)
                self.assertFalse((session.attempt / "command-00.txt").exists())

    def test_reader_bounds_cumulative_bytes_queue_and_auxiliary_files(self):
        for raw, byte_limit, queue_limit, retained in [(b"123456789\n", 6, 2, b"123456"), (b"first\nsecond\n", 100, 1, b"first\nsecond\n")]:
            session = Session.__new__(Session)
            session.STDOUT_LIMIT = byte_limit
            session.lines = queue.Queue(maxsize=queue_limit)
            session.reader_failure = None
            session.stdout_bytes = session.stdout_observed_bytes = 0
            session.reader_finished = threading.Event()
            session.process = SimpleNamespace(stdout=io.BytesIO(raw))
            session.stdout = io.BytesIO()
            session._read()
            self.assertIsInstance(session.reader_failure, OutputLimitError)
            self.assertTrue(session.reader_finished.is_set())
            self.assertEqual(session.stdout.getvalue(), retained)
            self.assertLessEqual(session.lines.qsize(), queue_limit)
        with tempfile.TemporaryDirectory() as directory:
            session.attempt = Path(directory)
            session.reader_failure = None
            session.AUXILIARY_LIMIT = 3
            (session.attempt / "analyzer.stderr.log").write_bytes(b"four")
            with self.assertRaisesRegex(OutputLimitError, "stderr"):
                session.check_output()


if __name__ == "__main__":
    unittest.main()
