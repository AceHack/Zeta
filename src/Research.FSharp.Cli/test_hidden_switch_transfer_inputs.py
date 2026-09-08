import copy
import unittest
from pathlib import Path

from hidden_switch_retained_artifacts import RetainedStore
from hidden_switch_transfer_inputs import (
    MANIFESTS,
    exact_record_roster,
    full_flags_false,
    mapping_association,
    physical_association,
)
from inspect_hidden_switch_bodies import parse_blocks
from map_hidden_switch_methods import map_methods


class TransferInputTests(unittest.TestCase):
    def test_exact_record_roster_rejects_missing_extra_and_reordering(self):
        names = ["decoded-method-000.json.gz", "decoded-method-002.json.gz"]
        roles = ["method-000", "method-002"]
        exact_record_roster(names, "decoded-", roles)
        for mutant in [names[:-1], names[::-1], names + ["decoded-method-003.json.gz"]]:
            with self.assertRaises(ValueError): exact_record_roster(mutant, "decoded-", roles)

    def roster(self):
        methods = []; blocks = []
        for index in range(130):
            count = 151 if index == 0 else 66
            methods.append({"Mvid": "fixed", "Token": 0x06000001 + index, "Type": "Fixture", "Name": f"method{index}",
                            "Prepared": True, "Refusal": None})
            raw = bytes.fromhex("1F2003D5") * count
            blocks.append({"Name": f"Fixture:method{index}()", "Bytes": len(raw), "Hex": raw.hex().upper(),
                           "Literals": {"RWD00": "0000000000000000"} if index < 10 else {}})
        for index in range(9):
            methods.append({"Mvid": "fixed", "Token": 0x06000100 + index, "Prepared": False, "Refusal": "unprepared fixture"})
            blocks.append({"Name": f"Extra:method{index}()", "Bytes": 4, "Hex": "1F2003D5", "Literals": {}})
        ready = {"Complete": True, "SourceDraws": 0, "Methods": methods}
        return ready, blocks, map_methods(ready, blocks)

    def test_exact_complete_roster_includes_unprepared_and_extras(self):
        ready, blocks, mapping = self.roster()
        selected = mapping_association(mapping, ready, blocks)
        self.assertEqual(len(selected), 130)
        self.assertEqual(len(mapping["UnmappedCompilerBlocks"]), 9)
        self.assertEqual(mapping["UnpreparedRows"], 9)

    def test_mapping_changes_never_silently_drop_a_row(self):
        ready, blocks, mapping = self.roster()
        mutants = []
        for key, value in [("RuntimeAdmitted", True), ("MappedRows", 129), ("UnpreparedRows", 0), ("DeclaredLiteralRecords", 9)]:
            mutants.append({**mapping, key: value})
        mutants += [{**mapping, "Rows": mapping["Rows"][:-1]}, {**mapping, "Rows": list(reversed(mapping["Rows"]))},
                    {**mapping, "UnmappedCompilerBlocks": []}]
        mutation = copy.deepcopy(mapping); mutation["Rows"][0]["Outcome"]["CompilerBlockIndex"] = 1; mutants.append(mutation)
        mutation = copy.deepcopy(mapping); mutation["Rows"][-1]["Outcome"]["Refusal"] = "changed"; mutants.append(mutation)
        for mutant in mutants:
            with self.subTest(keys=list(mutant)), self.assertRaises(ValueError): mapping_association(mutant, ready, blocks)
        with self.assertRaises(ValueError): mapping_association(mapping, {**ready, "Methods": ready["Methods"][::-1]}, blocks)

    def actual_one(self):
        # One already archived method fixture; no full 130-method inventory or dump read.
        base = Path(__file__).resolve().parents[2] / "docs/research/hidden-switch-compiled-validation/2026-09-07"
        store = RetainedStore(base, MANIFESTS)
        manifest = store.json(MANIFESTS[1]["File"], "helper-input.json.gz")
        mapping = store.json(MANIFESTS[2]["File"], "mapping.json.gz")
        blocks = parse_blocks(store.raw(MANIFESTS[3]["File"], "jit.log.gz").decode())
        physical = store.json(MANIFESTS[1]["File"], "physical-method-000.json.gz")
        cell = store.json(MANIFESTS[1]["File"], "physical-method-000-cell.json.gz")
        method = manifest["Methods"][0]; row = mapping["Rows"][0]; block = blocks[row["Outcome"]["CompilerBlockIndex"]]
        return method, row, block, physical, cell, manifest["Dump"]["Bytes"], manifest["Module"]["Mvid"]

    def test_actual_one_method_cell_and_current_extent_association(self):
        args = self.actual_one()
        record = physical_association(*args)
        self.assertEqual(record["Role"], "method-000")
        self.assertEqual(record["Bytes"], 8)
        self.assertEqual(record["Target"], args[0]["Address"])

    def test_actual_one_method_mutations_refuse_before_reuse(self):
        baseline = self.actual_one()
        for field, member, value in [(0, "Address", baseline[0]["Address"] + 4), (0, "Token", 0x06000001),
                                     (0, "CompilerBlockIndex", 0), (3, "CompilerMatchesPhysical", False),
                                     (4, "DecodedTarget", "0000000000000000"), (4, "TargetNonzeroAligned", False),
                                     (4, "NextRequestedBodyBytes", 4)]:
            args = copy.deepcopy(baseline); args[field][member] = value
            with self.subTest(field=field, member=member), self.assertRaises(ValueError): physical_association(*args)
        for member, value in [("Bytes", True), ("FileOffset", -1), ("PhysicalFileBacking", False), ("Sha256", "lowercase")]:
            args = copy.deepcopy(baseline); args[3]["Body"][member] = value
            with self.subTest(member=member), self.assertRaises(ValueError): physical_association(*args)
        args = list(copy.deepcopy(baseline)); args[-1] = "other-MVID"
        with self.assertRaises(ValueError): physical_association(*args)

    def test_missing_or_truthy_full_flags_refuse(self):
        for row in [{}, {"RuntimeAdmitted": 0, "BodyResolved": False, "ClosureAdmitted": False},
                    {"RuntimeAdmitted": False, "BodyResolved": True, "ClosureAdmitted": False}]:
            with self.assertRaises(ValueError): full_flags_false(row)


if __name__ == "__main__":
    unittest.main()
