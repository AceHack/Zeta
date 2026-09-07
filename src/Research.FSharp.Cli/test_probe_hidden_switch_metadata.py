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
        report = {"Complete": True, "Failure": None, "Cleanup": [], "Methods": rows, "RequestedMethods": 3, "AvailableMethods": 3,
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




class MappedMetadataTests(unittest.TestCase):
    def test_mapped_plan_checks_captured_rows_and_compiler_bytes(self):
        import hashlib

        from probe_hidden_switch_metadata import mapped_plan
        rows, blocks = [], []
        for index in range(139):
            prepared = index < 130
            entry = {"Prepared": prepared, "Refusal": None if prepared else "open generic", "Name": f"method{index}"}
            if prepared:
                raw = bytes(264 if index < 129 else 604)
                block = {"Name": f"Owned:method{index}()", "Bytes": len(raw), "Hex": raw.hex().upper(), "Literals": {}}
                blocks.append(block)
                outcome = {"Kind": "mapped-candidate", "CompilerBlockIndex": index, "CompilerName": block["Name"],
                           "Bytes": len(raw), "Sha256": hashlib.sha256(raw).hexdigest().upper(), "DeclaredLiterals": {}}
            else:
                outcome = {"Kind": "unprepared", "Refusal": "open generic"}
            rows.append({"Index": index, "Input": entry, "Outcome": outcome})
        mapping = {"Complete": True, "Failures": [], "Rows": rows}
        ready = {"Methods": [row["Input"] for row in rows]}
        self.assertEqual(len(mapped_plan(mapping, ready, blocks)), 130)
        for mutate in [lambda value: value["Rows"].reverse(), lambda value: value["Rows"][0]["Input"].update(Name="changed"),
                       lambda value: value["Rows"][0]["Outcome"].update(Sha256="A" * 64),
                       lambda value: value["Rows"][130]["Outcome"].update(Refusal="changed")]:
            changed = copy.deepcopy(mapping); mutate(changed)
            with self.assertRaises(ValueError):
                mapped_plan(changed, ready, blocks)

    def test_mapped_physical_chain_keeps_identity_and_prefix_when_body_fails(self):
        from probe_hidden_switch_metadata import mapped_physical
        entry = {"Name": "Invoke", "Type": "Owned+Closure", "Callable": "0000000000001000", "Token": 0x06000001,
                 "Signature": "Int32 Invoke()", "IlHex": "2A"}
        row = {"Index": 7, "Input": entry, "Outcome": {"Sha256": "C" * 64, "CompilerBlockIndex": 0}}
        block = {"Bytes": 4, "Hex": "00000000", "Name": "Owned+Closure:Invoke()"}

        class Memory:
            def __init__(self, fail):
                self.fail, self.reads = fail, []

            def read(self, address, length):
                self.reads.append((address, length))
                if address == 0x1000:
                    raw = bytes.fromhex("4B00005860011FD6")
                elif address == 0x1008:
                    raw = (0x2000).to_bytes(8, "little")
                elif self.fail:
                    raise ValueError("selected body lacks physical backing")
                else:
                    raw = bytes(4)
                return raw, {"Address": f"{address:016X}", "Bytes": length, "PhysicalFileBacking": True}

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            failed = root / "failed"; failed.mkdir()
            memory = Memory(True)
            with self.assertRaises(ValueError):
                mapped_physical(memory, row, block, failed)
            self.assertEqual(memory.reads, [(0x1000, 8), (0x1008, 8), (0x2000, 4)])
            self.assertEqual(sorted(path.name for path in failed.iterdir()), ["physical-method-007-cell.json", "physical-method-007-stub.json"])
            self.assertEqual(json.loads((failed / "physical-method-007-stub.json").read_text())["Method"], entry)
            cell = json.loads((failed / "physical-method-007-cell.json").read_text())
            self.assertEqual((cell["DecodedTarget"], cell["TargetNonzeroAligned"], cell["NextRequestedBodyBytes"]), ("0000000000002000", True, 4))
            invalid = root / "invalid"; invalid.mkdir()
            original_read = Memory(False).read
            def unaligned(address, length):
                raw, metadata = original_read(address, length)
                return ((3).to_bytes(8, "little") if address == 0x1008 else raw), metadata
            with self.assertRaises(ValueError):
                mapped_physical(SimpleNamespace(read=unaligned), row, block, invalid)
            cell = json.loads((invalid / "physical-method-007-cell.json").read_text())
            self.assertEqual((cell["DecodedTarget"], cell["TargetNonzeroAligned"]), ("0000000000000003", False))
            success = root / "success"; success.mkdir()
            result = mapped_physical(Memory(False), row, block, success)
            self.assertEqual((result["Role"], result["Name"], result["Address"]), ("method-007", "Invoke", 0x2000))

    def test_mapped_output_requires_exact_nested_identity_and_full_signature(self):
        method = {"Role": "method-007", "Address": 0x2000, "Bytes": 4, "Token": 0x06000001, "DeclaringType": "Owned+Closure", "Name": "Invoke"}
        row = {"Role": method["Role"], "Query": method["Address"], "Token": method["Token"],
               "NativeCode": method["Address"], "HotStart": method["Address"], "HotSize": method["Bytes"], "ColdStart": 0, "ColdSize": 0,
               "DeclaringType": method["DeclaringType"], "Name": method["Name"], "Signature": "Owned+Closure.Invoke(Int32)", "ModuleName": "/owned/cli.dll"}
        report = {"Complete": True, "Failure": None, "Cleanup": [], "Methods": [row], "RequestedMethods": 1, "AvailableMethods": 1,
                  "RuntimeAdmitted": False, "BodyResolved": False, "ClosureAdmitted": False, "PhysicalCodeVerifiedByHelper": False}
        output_admission(report, [method], "/owned/cli.dll")
        for key, value in [("DeclaringType", "Owned.Closure"), ("Name", "wrong"), ("Token", False), ("Signature", ""), ("ModuleName", "/other/cli.dll")]:
            changed = copy.deepcopy(report); changed["Methods"][0][key] = value
            with self.assertRaises(ValueError):
                output_admission(changed, [method], "/owned/cli.dll")

    def test_output_count_headers_cannot_contradict_rows(self):
        for key, value in [("RequestedMethods", 130), ("AvailableMethods", False), ("AvailableMethods", -1)]:
            report = {"Complete": True, "Failure": None, "Cleanup": [], "Methods": [], "RequestedMethods": 0, "AvailableMethods": 0,
                      "RuntimeAdmitted": False, "BodyResolved": False, "ClosureAdmitted": False, "PhysicalCodeVerifiedByHelper": False}
            report[key] = value
            with self.assertRaises(ValueError):
                output_admission(report, [])


if __name__ == "__main__":
    unittest.main()
