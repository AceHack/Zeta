"""Finite pure-mapping counterexamples; no dump, helper or study target."""
import copy
import unittest

from map_hidden_switch_methods import map_methods


class MethodMappingTests(unittest.TestCase):
    def fixture(self):
        rows = [{"Mvid": "fixed", "Token": 0x06000001 + index, "Type": "Owned", "Name": name,
                 "Prepared": prepared, "Refusal": None if prepared else "open generic"}
                for index, (name, prepared) in enumerate([("predict", True), ("template", False)])]
        block = {"Name": "Owned:predict() (FullOpts)", "Bytes": 4, "Hex": "00000000", "Literals": {}}
        return {"Complete": True, "SourceDraws": 0, "Methods": rows}, [block]

    def test_exact_mapping_retains_unprepared_and_unmapped_compiler_obligations(self):
        ready, blocks = self.fixture()
        blocks.append({**blocks[0], "Name": "Owned:template[int]() (FullOpts)"})
        result = map_methods(ready, blocks, (2, 1, 1))
        self.assertTrue(result["Complete"])
        self.assertEqual(result["Rows"][1]["Outcome"]["Kind"], "unprepared")
        self.assertEqual(result["UnmappedCompilerBlocks"][0]["Name"], blocks[1]["Name"])
        self.assertFalse(result["ClosureAdmitted"])
        self.assertEqual(result["ExplicitDumpRangeReads"], 0)

    def test_missing_duplicate_or_changed_compiler_block_retains_every_row(self):
        ready, blocks = self.fixture()
        for variant in [[], blocks * 2, [{**blocks[0], "Name": "Owned:different()"}], [{**blocks[0], "Bytes": 8}]]:
            with self.subTest(blocks=variant):
                result = map_methods(ready, variant, (2, 1, 1))
                self.assertFalse(result["Complete"])
                self.assertEqual(len(result["Rows"]), 2)
                self.assertEqual(result["Rows"][0]["Outcome"]["Kind"], "refused")
                self.assertEqual(result["Rows"][1]["Outcome"]["Kind"], "unprepared")

    def test_duplicate_token_and_unprepared_without_refusal_remain_failed(self):
        ready, blocks = self.fixture()
        duplicate = copy.deepcopy(ready)
        duplicate["Methods"][1]["Token"] = duplicate["Methods"][0]["Token"]
        self.assertFalse(map_methods(duplicate, blocks, (2, 1, 1))["Complete"])
        ready["Methods"][1]["Refusal"] = ""
        self.assertFalse(map_methods(ready, blocks, (2, 1, 1))["Complete"])


if __name__ == "__main__":
    unittest.main()
