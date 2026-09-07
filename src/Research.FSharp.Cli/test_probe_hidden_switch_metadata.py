"""Synthetic metadata/custody admission only; no helper or dump query."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from capture_hidden_switch_dump import identity
from probe_hidden_switch_metadata import (
    cleanup_owned,
    copied_module,
    output_admission,
    read_json,
    wait_helper,
)


class ProbeMetadataTests(unittest.TestCase):
    def test_copied_module_requires_exact_retained_and_native_file_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            original, copied = root / "original.dll", root / "copied.dll"
            original.write_bytes(b"exact captured file"); copied.write_bytes(original.read_bytes())
            row = {"Original": identity(original), "Copy": identity(copied)}
            inputs = {"TargetCustody": [row]}
            ready = {"ManagedImages": [{"Identity": {**row["Original"], "Available": True}, "Mvid": "owned-mvid"}]}
            self.assertEqual(copied_module(inputs, ready, original), {**row, "Mvid": "owned-mvid"})
            ready["ManagedImages"].append(ready["ManagedImages"][0])
            with self.assertRaises(ValueError):
                copied_module(inputs, ready, original)
            ready["ManagedImages"].pop()
            copied.write_bytes(b"different")
            with self.assertRaises(ValueError):
                copied_module(inputs, ready, original)

    def test_current_complete_extent_admission_refuses_history_cold_and_scope_changes(self):
        methods = [{"Role": role, "Address": 4096 * (index + 1), "Bytes": 16, "Token": 0x06000001 + index,
                    "Signature": role + "()"} for index, role in enumerate(["predict", "condition", "select"])]
        rows = [{"Role": method["Role"], "Query": method["Address"], "Token": method["Token"], "Signature": method["Signature"],
                 "NativeCode": method["Address"], "HotStart": method["Address"], "HotSize": method["Bytes"], "ColdStart": 0, "ColdSize": 0} for method in methods]
        report = {"Complete": True, "Failure": None, "Cleanup": [], "Methods": rows,
                  "RuntimeAdmitted": False, "BodyResolved": False, "ClosureAdmitted": False, "PhysicalCodeVerifiedByHelper": False}
        output_admission(report, methods)
        for key, value in [("NativeCode", 9999), ("HotSize", 20), ("ColdSize", 4), ("ColdSize", False), ("Signature", "different")]:
            changed = copy.deepcopy(report); changed["Methods"][0][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                output_admission(changed, methods)
        changed = copy.deepcopy(report); changed["RuntimeAdmitted"] = True
        with self.assertRaises(ValueError):
            output_admission(changed, methods)

    def test_metadata_read_and_completed_process_outputs_have_bounds(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            file = root / "metadata.json"
            file.write_text(json.dumps({"Observed": 1}))
            self.assertEqual(read_json(file, 64), {"Observed": 1})
            with self.assertRaises(ValueError):
                read_json(file, 1)
            (root / "helper.stdout.log").write_bytes(b"12345")
            with self.assertRaises(ValueError):
                wait_helper(SimpleNamespace(poll=lambda: 0), root, limit=4)
            with patch("probe_hidden_switch_metadata.time.monotonic", side_effect=[0, 2]), self.assertRaises(TimeoutError):
                wait_helper(SimpleNamespace(poll=lambda: None), root, seconds=1)

    def test_owned_process_join_precedes_real_stream_closes_and_keeps_secondary_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            events = []
            actual = (Path(directory) / "stdout.log").open("xb")
            actual.write(b"retained prefix")

            class CloseError:
                def close(self):
                    actual.close()
                    events.append("close")
                    raise OSError("real close completed then failed")

            class Process:
                pid = 999999

                def poll(self):
                    return None

                def wait(self, timeout):
                    self.assert_timeout = timeout
                    events.append("join")
                    raise TimeoutError("owned join fixture")

            process = Process()
            with patch("probe_hidden_switch_metadata.os.killpg", side_effect=lambda *_: events.append("kill")):
                errors = cleanup_owned(process, [("stdout-close", CloseError())])
            self.assertEqual(events, ["kill", "join", "close"])
            self.assertEqual([row["Stage"] for row in errors], ["helper-cleanup", "stdout-close"])
            self.assertEqual(process.assert_timeout, 5)
            self.assertEqual((Path(directory) / "stdout.log").read_bytes(), b"retained prefix")


if __name__ == "__main__":
    unittest.main()
