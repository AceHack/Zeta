"""Synthetic metadata and real-file publication witnesses; no actual range derivation."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import propose_hidden_switch_data_ranges as subject
from hidden_switch_retained_artifacts import sha


def fixture():
    methods = [{"Role": f"method-{index:03d}", "Bytes": 4 * (66 if index < 129 else 151)} for index in range(130)]
    rows = [{"Role": item["Role"], "Method": item, "Complete": True, "ObservedExecution": False,
             "Words": [None] * (item["Bytes"] // 4), "UnconsumedLiteralDeclarations": [], **subject.FLAGS} for item in methods]
    raw = {row["Role"] + ".json.gz": json.dumps(row).encode() for row in rows}
    records = {name: {"Bytes": len(value), "Sha256": sha(value)} for name, value in raw.items()}
    inputs = [{"Kind": "fixture", "File": str(index)} for index in range(1069)]
    selected = [dict(Kind="manifest", **subject.MAPPED_PIN),
                {"Kind": "stored-record", "File": "clrmd-mapped-attempt-1/helper-input.json.gz", "Bytes": 1, "Sha256": "A" * 64},
                {"Kind": "original-record", "File": "clrmd-mapped-attempt-1/helper-input.json.gz", "Bytes": 2, "Sha256": "B" * 64}]
    report = {"Kind": "finite-retained-transfer-inventory", "Complete": True, "Failure": None, "CleanupFailures": [],
              "InputsUnchanged": True, "ActiveDiagnostic": None, "SourceCommit": subject.INVENTORY_SOURCE,
              "Methods": 130, "Words": 8665, "UnresolvedWords": 8524, "NewMemoryQueries": 0, "SourceDraws": 0,
              "RawDumpOpened": False, "ObservedExecution": False, "Unprepared": [{}] * 9, "ExtraCompilerBlocks": [{}] * 9,
              "CompletedMethods": [{"File": name[:-3], **pin} for name, pin in records.items()], "Inputs": inputs + selected, **subject.FLAGS}
    helper = {"Methods": methods, "Dump": {"File": "/never-open-this-fixture/graph.core", **subject.DUMP_IDENTITY}}
    return report, helper, records, raw, selected


class FakeStore:
    def __init__(self, root, manifests, observed):
        self.report, self.helper, records, self.raws, self.pins = fixture()
        if manifests != [subject.INVENTORY_PIN, subject.MAPPED_PIN]:
            raise AssertionError("production manifest pins differ")
        self.records = {subject.INVENTORY: records}
        self.observed = observed
        for pin in self.pins:
            observed(pin)

    def json(self, manifest, name):
        if (manifest, name) == (subject.INVENTORY, "outcome.json.gz"):
            return self.report
        if (manifest, name) == (subject.MAPPED, "helper-input.json.gz"):
            return self.helper
        raise AssertionError("unexpected metadata name")

    def raw(self, manifest, name):
        if manifest != subject.INVENTORY:
            raise AssertionError("unexpected manifest")
        self.observed({"Kind": "original-record", "File": name, **self.records[manifest][name]})
        return self.raws[name]

    def recheck(self):
        pass


class ProposalTests(unittest.TestCase):
    def test_header_requires_closed_exact_false_scope(self):
        report, helper, records, _, _ = fixture()
        self.assertEqual(subject.admitted_header(report, helper, records), helper["Methods"])
        for key, value in [("Complete", False), ("Failure", {}), ("CleanupFailures", [{}]), ("InputsUnchanged", False),
                           ("SourceCommit", "0" * 40), ("Methods", True), ("Words", 8664), ("UnresolvedWords", 0),
                           ("RawDumpOpened", True), ("SourceDraws", True), ("ObservedExecution", True), *[(key, True) for key in subject.FLAGS]]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                subject.admitted_header({**report, key: value}, helper, records)

    def test_omitted_extra_reordered_and_identity_mismatched_methods_refuse(self):
        report, helper, records, _, _ = fixture()
        for mode in ["omitted", "extra", "reordered", "hash", "size", "duplicate-role", "manifest-extra", "manifest-order"]:
            changed = copy.deepcopy(report); mapped = copy.deepcopy(helper); table = copy.deepcopy(records)
            if mode == "omitted": changed["CompletedMethods"].pop()
            if mode == "extra": changed["CompletedMethods"].append(changed["CompletedMethods"][0])
            if mode == "reordered": changed["CompletedMethods"].reverse()
            if mode == "hash": changed["CompletedMethods"][0]["Sha256"] = "F" * 64
            if mode == "size": changed["CompletedMethods"][0]["Bytes"] = True
            if mode == "duplicate-role": mapped["Methods"][1]["Role"] = mapped["Methods"][0]["Role"]
            if mode == "manifest-extra": table["method-999.json.gz"] = table["method-000.json.gz"]
            if mode == "manifest-order": table = dict(reversed(list(table.items())))
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                subject.admitted_header(changed, mapped, table)

    def test_dump_identity_only_exact_metadata_never_opened(self):
        report, helper, records, _, _ = fixture()
        for key, value in [("Bytes", 1), ("Bytes", True), ("Sha256", "0" * 64), ("File", "relative"), ("File", "/a\x00b")]:
            changed = copy.deepcopy(helper); changed["Dump"][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                subject.admitted_header(report, changed, records)
        with patch.object(Path, "open", side_effect=AssertionError("metadata cannot open dump")):
            self.assertEqual(subject.admitted_header(report, helper, records), helper["Methods"])

    def test_selected_input_association_and_all_completed_rows(self):
        state = {"CompletedMethods": []}; pins = []; events = []; locations = []
        with patch.object(subject, "RetainedStore", FakeStore):
            store, methods = subject.admitted_inputs("unused", pins.append, locations.append, state, events.append)
        self.assertIsInstance(store, FakeStore)
        self.assertEqual(len(methods), 130)
        self.assertEqual(sum(len(row["Words"]) for row in methods), 8665)
        self.assertEqual(len(state["CompletedMethods"]), 130)
        self.assertEqual(state["DumpIdentity"]["File"], "/never-open-this-fixture/graph.core")
        self.assertIsNone(state["ActiveDiagnostic"])
        self.assertEqual(len(events), 131)

    def test_wrong_same_inventory_pin_refuses_before_any_method(self):
        class ChangedStore(FakeStore):
            def __init__(self, *args):
                super().__init__(*args)
                self.report["Inputs"][-1] = {**self.report["Inputs"][-1], "Sha256": "C" * 64}
        state = {"CompletedMethods": []}
        with patch.object(subject, "RetainedStore", ChangedStore), self.assertRaisesRegex(ValueError, "same-inventory"):
            subject.admitted_inputs("unused", lambda _: None, lambda _: None, state, lambda _: None)
        self.assertEqual(state["CompletedMethods"], [])

    def test_current_method_survives_checkpoint_failure(self):
        state = {"CompletedMethods": []}
        def checkpoint(row):
            if row["Kind"] == "method-admitted":
                raise OSError("first method checkpoint")
        with patch.object(subject, "RetainedStore", FakeStore), self.assertRaisesRegex(OSError, "first method checkpoint"):
            subject.admitted_inputs("unused", lambda _: None, lambda _: None, state, checkpoint)
        self.assertEqual(state["ActiveDiagnostic"]["Role"], "method-000")
        self.assertEqual(state["CompletedMethods"][0]["File"], "method-000.json")

    def test_sources_have_all_fourteen_unique_actual_file_pins(self):
        observed = []; locations = []
        rows = subject.proposal_sources(Path(subject.__file__).parent, observed.append, locations.append)
        self.assertEqual(rows, observed)
        self.assertEqual(len(rows), 14)
        self.assertEqual(rows[0]["File"], Path(subject.__file__).name)
        self.assertEqual(rows[1]["File"], "hidden_switch_data_ranges.py")

    def test_source_identity_survives_its_checkpoint_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            attempt = Path(directory) / "owned"
            def sources(_, observed, locator):
                locator({"Stage": "source-identity", "File": "actual.py"})
                observed({"File": "actual.py", "Bytes": 7, "Sha256": "A" * 64})
                raise AssertionError("must stop at checkpoint")
            original = subject.Publisher.checkpoint
            def checkpoint(publisher, row):
                if row["Kind"] == "source-identity":
                    raise OSError("source checkpoint")
                original(publisher, row)
            with patch.object(subject, "proposal_sources", sources), patch.object(subject.Publisher, "checkpoint", checkpoint):
                report = subject.run("unused", attempt, "a" * 40)
            self.assertFalse(report["Complete"])
            self.assertEqual(report["Sources"][0]["Bytes"], 7)
            self.assertEqual(report["Failure"]["Detail"], "source checkpoint")
            self.assertEqual(json.loads((attempt / "outcome.json").read_bytes()), report)

    def test_actual_publication_path_uses_default_derivation_and_preserves_after_journal_failure(self):
        original = subject.Publisher.checkpoint
        def checkpoint(publisher, row):
            if row["Kind"] == "proposal-published":
                raise OSError("proposal checkpoint")
            original(publisher, row)
        with tempfile.TemporaryDirectory() as directory:
            attempt = Path(directory) / "owned"
            proposal = {"Ranges": [], "ProposalOnly": True, **subject.FLAGS}
            with patch.object(subject, "proposal_sources", return_value=[]), patch.object(subject, "RetainedStore", FakeStore), \
                    patch.object(subject, "derive_ranges", return_value=proposal) as derive, \
                    patch.object(subject.Publisher, "checkpoint", checkpoint):
                report = subject.run("unused", attempt, "a" * 40)
            derive.assert_called_once()
            self.assertEqual(len(derive.call_args.args), 1)
            self.assertEqual(derive.call_args.kwargs, {})
            self.assertFalse(report["Complete"])
            self.assertEqual(report["Failure"]["Detail"], "proposal checkpoint")
            self.assertEqual(sha((attempt / "proposal.json").read_bytes()), report["ProposalFile"]["Sha256"])
            self.assertEqual(json.loads((attempt / "outcome.json").read_bytes())["Proposal"], report["Proposal"])

    def test_first_failure_survives_cleanup_and_independent_final_write_failure(self):
        original_close = subject.Publisher.close
        def close(publisher):
            original_close(publisher)
            return OSError("secondary close")
        original_write = subject.exclusive_bytes
        def write(path, raw):
            if path.name == "outcome.json": raise OSError("secondary final write")
            original_write(path, raw)
        with tempfile.TemporaryDirectory() as directory:
            attempt = Path(directory) / "owned"
            with patch.object(subject, "proposal_sources", side_effect=ValueError("first source failure")), \
                    patch.object(subject.Publisher, "close", close), patch.object(subject, "exclusive_bytes", write):
                report = subject.run("unused", attempt, "a" * 40)
            self.assertFalse(report["Complete"])
            self.assertEqual(report["Failure"]["Detail"], "first source failure")
            self.assertEqual(report["CleanupFailures"][0]["Detail"], "secondary close")
            self.assertEqual(report["PublicationFailure"]["Detail"], "secondary final write")
            self.assertEqual(json.loads((attempt / "terminal-failure.json").read_bytes())["Failure"], report["Failure"])

    def test_existing_attempt_is_not_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            attempt = Path(directory); marker = attempt / "untouched"; marker.write_bytes(b"keep")
            report = subject.run("unused", attempt, "a" * 40)
            self.assertFalse(report["Complete"])
            self.assertEqual(list(attempt.iterdir()), [marker])
            self.assertEqual(marker.read_bytes(), b"keep")

    def test_oversized_active_diagnostic_refuses_with_explicit_omission(self):
        report = {"Complete": True, "Failure": None, "Proposal": None, "ActiveDiagnostic": {"Words": ["x" * subject.MAX_RECORD]},
                  "Inputs": [{}], "Sources": [{}], "Unprepared": [], "ExtraCompilerBlocks": [], **subject.FLAGS}
        raw, result = subject.bounded_outcome(report)
        self.assertLessEqual(len(raw), subject.MAX_RECORD)
        self.assertFalse(result["Complete"])
        self.assertTrue(result["MetadataOmitted"])
        self.assertEqual(result["OmittedActiveWords"], 1)
        self.assertEqual(result["Failure"]["Stage"], "terminal-output-bound")


if __name__ == "__main__":
    unittest.main()
