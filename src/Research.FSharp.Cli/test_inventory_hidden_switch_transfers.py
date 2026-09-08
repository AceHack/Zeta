import json
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest.mock import patch

from hidden_switch_transfer_inputs import FLAGS
from hidden_switch_transfer_shapes import ranges_admitted
from inventory_hidden_switch_transfers import (
    FINAL_RESERVE,
    MAX_CONSOLE,
    MAX_RECORD,
    MAX_SECONDARY,
    MAX_WORD,
    Publisher,
    bounded_terminal,
    classified_method,
    encode,
    exclusive_bytes,
    run,
    source_inventory,
    terminal_record,
)


class TransferInventoryTests(unittest.TestCase):
    def fixture(self, words=None, text=None):
        words = [0x14000001, 0xD4200000, 0xD503201F] if words is None else words
        text = ["b #4", "brk #0", "nop"] if text is None else text
        block = {"Name": "Fixture:method()", "Literals": {"RWD00": "0000000000000000"},
                 "Instructions": [{"Offset": i * 4, "Word": f"{word:08X}", "Mnemonic": name.split()[0], "Operands": ""}
                                  for i, (word, name) in enumerate(zip(words, text, strict=True))]}
        method = {"Role": "method-000", "Address": 0x1000, "Bytes": len(words) * 4}
        decoded = [{"Offset": i * 4, "Address": f"{0x1000+i*4:016X}", "Instruction": name,
                    "Hex": word.to_bytes(4,"little").hex().upper(), "ImmediateComment": None}
                   for i, (word, name) in enumerate(zip(words, text, strict=True))]
        return {"Method": method, "Compiler": block, "Decoded": decoded, "Reflection": {}, "DacMetadata": {}, "PhysicalReadIdentity": {}}

    def state(self):
        return {"Active": None, "Locator": {}, "Words": 0, "Kinds": Counter(), "UnresolvedWords": 0,
                "Completed": [], "StartedAtUtc": "fixed", "SourceCommit": "0"*40,
                "Unprepared": [], "ExtraCompilerBlocks": [], "InputsUnchanged": False}

    def ranges(self, prepared):
        return ranges_admitted([{"Role": "method-000", "Start": 0x1000, "Bytes": prepared["Method"]["Bytes"]}])

    def test_unsupported_rows_continue_and_traps_have_no_invented_successor(self):
        prepared = self.fixture(); state = self.state(); events = []
        report = classified_method(prepared, self.ranges(prepared), {}, state, events.append)
        self.assertTrue(report["Complete"]); self.assertEqual(len(report["Words"]), 3)
        self.assertEqual(state["Words"], 3); self.assertEqual(state["UnresolvedWords"], 2)
        trap = report["Words"][1]["Shape"]; self.assertEqual(trap["Kind"], "trap")
        self.assertEqual(trap["Targets"], []); self.assertIsNone(trap["Continuation"])
        self.assertEqual(report["Words"][2]["Shape"]["Kind"], "unsupported")
        self.assertEqual(len(report["UnconsumedLiteralDeclarations"]), 1)
        self.assertTrue(all(report[key] is False for key in FLAGS))

    def test_structural_word_keeps_attempted_target_and_stops(self):
        prepared = self.fixture([0x14000001, 0x14000001], ["ret", "b #4"]); state = self.state()
        with self.assertRaises(ValueError): classified_method(prepared, self.ranges(prepared), {}, state, lambda _: None)
        self.assertEqual(len(state["Active"]["Words"]), 1)
        self.assertIn("StructuralFailure", state["Active"]["Words"][0]["Shape"])
        self.assertEqual(state["Locator"]["Offset"], 0)

    def test_checkpoint_failure_keeps_actual_computed_method(self):
        prepared = self.fixture(); state = self.state()
        def fail(_): raise OSError("journal failed")
        with self.assertRaises(OSError): classified_method(prepared, self.ranges(prepared), {}, state, fail)
        self.assertTrue(state["Active"]["Complete"])
        self.assertEqual(state["Active"]["Words"][0]["Shape"]["Targets"][0]["Address"], "0000000000001004")
        self.assertEqual(len(state["Active"]["Words"]), 3)

    def test_independent_final_output_retains_active_prefix_on_broken_journal(self):
        prepared = self.fixture(); loaded = {"Store": None, "Methods": [prepared], "Ranges": self.ranges(prepared),
                                             "KnownCells": {}, "Unprepared": [{"Refusal": "fixed"}], "ExtraCompilerBlocks": [{"Name": "extra"}]}
        original = Publisher.checkpoint
        def checkpoint(publisher, value):
            if value["Kind"] == "method-computed": raise OSError("primary journal refusal")
            return original(publisher, value)
        with tempfile.TemporaryDirectory() as root:
            attempt = Path(root) / "attempt"
            with patch("inventory_hidden_switch_transfers.loaded_inputs", return_value=loaded), patch("inventory_hidden_switch_transfers.source_inventory", return_value=[]), patch.object(Publisher, "checkpoint", checkpoint):
                report = run(Path(root), attempt, "0"*40)
            retained = json.loads((attempt / "outcome.json").read_text())
            self.assertEqual(report, retained)
            self.assertFalse(report["Complete"])
            self.assertEqual(report["Failure"]["Detail"], "primary journal refusal")
            self.assertEqual(len(report["ActiveDiagnostic"]["Words"]), 3)
            self.assertEqual(report["ActiveDiagnostic"]["Words"][0]["Shape"]["Targets"][0]["Address"], "0000000000001004")
            self.assertEqual(report["Unprepared"], loaded["Unprepared"])

    def test_constructor_prefix_survives_callback_failure(self):
        def load(_, observed, locator):
            locator({"Stage": "input-fixture"}); observed({"Kind": "original-record", "Sha256": "fixed"})
            raise AssertionError("must stop first")
        original = Publisher.checkpoint
        def checkpoint(publisher, value):
            if value["Kind"] == "input-identity": raise OSError("identity checkpoint failed")
            return original(publisher, value)
        with tempfile.TemporaryDirectory() as root, patch("inventory_hidden_switch_transfers.loaded_inputs", side_effect=load), patch("inventory_hidden_switch_transfers.source_inventory", return_value=[]), patch.object(Publisher, "checkpoint", checkpoint):
            report = run(Path(root), Path(root) / "attempt", "0"*40)
            self.assertEqual(report["Inputs"], [{"Kind": "original-record", "Sha256": "fixed"}])
            self.assertEqual(report["Failure"]["Detail"], "identity checkpoint failed")

    def test_complete_synthetic_8665_word_inventory_keeps_all_unresolved_rows(self):
        prepared = []
        for index in range(130):
            count = 151 if index == 0 else 66
            item = self.fixture([0xD503201F] * count, ["nop"] * count)
            item["Method"].update(Role=f"method-{index:03d}", Address=0x1000 + index * 0x1000)
            prepared.append(item)
        class Store:
            def recheck(self): pass
        loaded = {"Store": Store(), "Methods": prepared, "Ranges": ranges_admitted([
            {"Role": item["Method"]["Role"], "Start": item["Method"]["Address"], "Bytes": item["Method"]["Bytes"]} for item in prepared]),
            "KnownCells": {}, "Unprepared": [{"Refusal": "fixture"}] * 9, "ExtraCompilerBlocks": [{"Name": "fixture"}] * 9}
        with tempfile.TemporaryDirectory() as root, patch("inventory_hidden_switch_transfers.loaded_inputs", return_value=loaded), patch("inventory_hidden_switch_transfers.source_inventory", return_value=[]):
            report = run(Path(root), Path(root) / "attempt", "0"*40)
            self.assertTrue(report["Complete"]); self.assertEqual(report["Words"], 8665)
            self.assertEqual(report["Methods"], 130); self.assertEqual(report["UnresolvedWords"], 8665)
            self.assertEqual(report["Kinds"], {"unsupported": 8665})
            self.assertEqual(len(report["Unprepared"]), 9); self.assertEqual(len(report["ExtraCompilerBlocks"]), 9)
            self.assertTrue(all(report[key] is False for key in FLAGS))

    def test_secondary_cleanup_failure_does_not_replace_primary_or_skip_final(self):
        original_close = Publisher.close
        def close(publisher):
            original_close(publisher); raise OSError("secondary close")
        with tempfile.TemporaryDirectory() as root, patch("inventory_hidden_switch_transfers.source_inventory", side_effect=ValueError("primary source")), patch.object(Publisher, "close", close):
            attempt = Path(root) / "attempt"; report = run(Path(root), attempt, "0"*40)
            self.assertEqual(report["Failure"]["Detail"], "primary source")
            self.assertEqual(report["CleanupFailures"][0]["Detail"], "secondary close")
            self.assertTrue((attempt / "outcome.json").is_file())

    def test_publication_budget_reserves_terminal_and_counts_delimiter(self):
        with tempfile.TemporaryDirectory() as root:
            publisher = Publisher(Path(root))
            try:
                with patch("inventory_hidden_switch_transfers.MAX_OUTPUT", FINAL_RESERVE + 2), self.assertRaises(ValueError):
                    publisher.checkpoint({})  # three bytes including the newline
                self.assertEqual(publisher.charged, 0)
            finally:
                self.assertIsNone(publisher.close())

    def test_aggregate_budget_reserves_failed_terminal_and_console_bytes(self):
        self.assertEqual(FINAL_RESERVE, MAX_RECORD + MAX_SECONDARY + MAX_CONSOLE)
        with tempfile.TemporaryDirectory() as root:
            publisher = Publisher(Path(root))
            try:
                with patch("inventory_hidden_switch_transfers.MAX_OUTPUT", FINAL_RESERVE + 3):
                    publisher.checkpoint({})
                    self.assertEqual(publisher.charged, 3)
                    with self.assertRaises(ValueError): publisher.checkpoint({})
                self.assertLessEqual(publisher.charged + MAX_RECORD + MAX_SECONDARY + MAX_CONSOLE, FINAL_RESERVE + 3)
            finally:
                self.assertIsNone(publisher.close())

    def test_word_and_terminal_bounds_are_explicit_refusals(self):
        with self.assertRaises(ValueError): encode({"Detail": "x" * MAX_WORD}, MAX_WORD)
        state = self.state(); state["Active"] = {"Words": [{"Detail": "x" * MAX_RECORD}]}
        primary = {"Stage": "first", "Code": "refused"}
        report = terminal_record(state, primary, False, [], [], [])
        raw, bounded = bounded_terminal(report)
        self.assertLessEqual(len(raw), MAX_RECORD)
        self.assertEqual(bounded["Failure"], primary); self.assertTrue(bounded["MetadataOmitted"])
        self.assertEqual(bounded["OmittedActiveWords"], 1); self.assertFalse(bounded["Complete"])

    def test_exclusive_output_does_not_replace_and_preserves_first_error(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "output"; exclusive_bytes(path, b"first")
            with self.assertRaises(FileExistsError): exclusive_bytes(path, b"second")
            self.assertEqual(path.read_bytes(), b"first")
            real_open = Path.open
            def wrapped(path, mode):
                stream = real_open(path, mode)
                class Stream:
                    def write(self, raw): return stream.write(raw)
                    def flush(self): return stream.flush()
                    def fileno(self): return stream.fileno()
                    def close(self):
                        stream.close(); raise OSError("secondary close")
                return Stream()
            with patch.object(Path, "open", wrapped), patch("inventory_hidden_switch_transfers.os.fsync", side_effect=OSError("primary fsync")), self.assertRaises(OSError) as result:
                exclusive_bytes(Path(root) / "failed", b"value")
            self.assertEqual(str(result.exception), "primary fsync")
            self.assertIn("secondary close", result.exception.__notes__[0])

    def test_existing_attempt_is_refused_without_mutation(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root); sentinel = path / "sentinel"; sentinel.write_bytes(b"fixed")
            report = run(path, path, "0"*40)
            self.assertFalse(report["Complete"]); self.assertEqual(report["Failure"]["Code"], "FileExistsError")
            self.assertEqual(sorted(p.name for p in path.iterdir()), ["sentinel"])

    def test_source_inventory_includes_transitive_import_bytes(self):
        pins = source_inventory(Path(__file__).parent)
        names = {pin["File"] for pin in pins}
        self.assertIn("analyze_hidden_switch_dump.py", names)
        self.assertIn("hidden_switch_dump_memory.py", names)
        self.assertIn("hidden_switch_retained_artifacts.py", names)
        self.assertLessEqual(len(pins), 24)

    def test_source_prefix_survives_later_file_and_current_checkpoint_failure(self):
        real_inventory = source_inventory
        with tempfile.TemporaryDirectory() as root:
            directory = Path(root) / "sources"; directory.mkdir()
            raw = b"from hidden_switch_missing import value\n"
            (directory / "inventory_hidden_switch_transfers.py").write_bytes(raw)
            def fixture_inventory(_, observed, locator):
                with patch.dict(sys.modules, {"inventory_hidden_switch_transfers": None}):
                    return real_inventory(directory, observed, locator)
            with patch("inventory_hidden_switch_transfers.source_inventory", side_effect=fixture_inventory):
                report = run(Path(root), Path(root) / "attempt", "0"*40)
            self.assertFalse(report["Complete"])
            self.assertEqual(len(report["Sources"]), 1)
            self.assertEqual(report["Sources"][0]["Bytes"], len(raw))
            self.assertEqual(report["Locator"]["File"], "hidden_switch_missing.py")
            self.assertEqual(report["Failure"]["Code"], "FileNotFoundError")
        original = Publisher.checkpoint
        def fail_current(publisher, value):
            if value["Kind"] == "source-identity": raise OSError("source checkpoint failed")
            return original(publisher, value)
        with tempfile.TemporaryDirectory() as root, patch.object(Publisher, "checkpoint", fail_current):
            report = run(Path(root), Path(root) / "attempt", "0"*40)
            self.assertEqual(len(report["Sources"]), 1)
            self.assertEqual(report["Sources"][0]["File"], "inventory_hidden_switch_transfers.py")
            self.assertEqual(report["Failure"]["Detail"], "source checkpoint failed")


if __name__ == "__main__":
    unittest.main()
