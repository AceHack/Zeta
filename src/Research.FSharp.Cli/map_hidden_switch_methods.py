"""Freeze a finite reflection/compiler roster without reading a dump or executing policy."""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

from capture_hidden_switch_dump import identity, utc, write
from inspect_hidden_switch_bodies import parse_blocks
from probe_hidden_switch_metadata import read_json

COUNTS = (139, 130, 9)


def map_methods(ready, blocks, counts=COUNTS):
    methods = ready["Methods"]
    if ready.get("Complete") is not True or ready.get("SourceDraws") != 0 or len(methods) != counts[0]:
        raise ValueError("ready completion/source-draw/count boundary differs")
    rows, seen, consumed, failures = [], set(), set(), []
    for index, method in enumerate(methods):
        row = {"Index": index, "Input": method, "Outcome": None}
        rows.append(row)
        try:
            key = (method["Mvid"], method["Token"])
            if key in seen or type(method["Token"]) is not int or method["Token"] >> 24 != 6:
                raise ValueError("duplicate or non-method-definition module/token identity")
            seen.add(key)
            if type(method["Prepared"]) is not bool:
                raise ValueError("prepared marker is not boolean")
            if not method["Prepared"]:
                if not isinstance(method.get("Refusal"), str) or not method["Refusal"]:
                    raise ValueError("unprepared row lacks its actual refusal")
                row["Outcome"] = {"Kind": "unprepared", "Refusal": method["Refusal"],
                                  "Meaning": "explicit observation; no irrelevance or absent executed specialization is inferred"}
                continue
            candidates = [(i, block) for i, block in enumerate(blocks)
                          if block["Name"].startswith(method["Type"] + ":" + method["Name"] + "(")]
            if len(candidates) != 1:
                raise ValueError("prepared row lacks exactly one compiler block")
            block_index, block = candidates[0]
            if block_index in consumed:
                raise ValueError("compiler block already consumed by another reflected identity")
            if type(block["Bytes"]) is not int or not 0 < block["Bytes"] <= 65536 or block["Bytes"] % 4:
                raise ValueError("compiler candidate exceeds the planned aligned physical range bound")
            raw = bytes.fromhex(block["Hex"])
            if len(raw) != block["Bytes"]:
                raise ValueError("compiler candidate byte count differs")
            consumed.add(block_index)
            row["Outcome"] = {"Kind": "mapped-candidate", "CompilerBlockIndex": block_index,
                              "CompilerName": block["Name"], "Bytes": len(raw),
                              "Sha256": hashlib.sha256(raw).hexdigest().upper(),
                              "DeclaredLiterals": block["Literals"],
                              "Meaning": "compiler-sized candidate only; no physical/current-extent/call-closure admission"}
        except (KeyError, TypeError, ValueError) as error:
            failure = {"Stage": "method-mapping", "Index": index, "Code": type(error).__name__, "Detail": str(error)}
            failures.append(failure)
            row["Outcome"] = {"Kind": "refused", "Failure": failure}
    mapped = sum(row["Outcome"]["Kind"] == "mapped-candidate" for row in rows)
    unprepared = sum(row["Outcome"]["Kind"] == "unprepared" for row in rows)
    if (len(rows), mapped, unprepared) != counts:
        failures.append({"Stage": "roster-counts", "Index": None, "Code": "cardinality", "Detail": "observed/mapped/unprepared counts differ from the declared finite roster"})
    extra = [{"CompilerBlockIndex": index, "Name": block["Name"], "Bytes": block["Bytes"],
              "Sha256": hashlib.sha256(bytes.fromhex(block["Hex"])).hexdigest().upper(),
              "Meaning": "unmapped emitted block; retained obligation, not dismissed as irrelevant"}
             for index, block in enumerate(blocks) if index not in consumed]
    return {"Kind": "prepared-method-compiler-mapping", "Complete": not failures, "Failures": failures,
            "ObservedRows": len(rows), "MappedRows": mapped, "UnpreparedRows": unprepared,
            "MappedBytes": sum(row["Outcome"].get("Bytes", 0) for row in rows),
            "MaximumCandidateBytes": max((row["Outcome"].get("Bytes", 0) for row in rows), default=0),
            "DeclaredLiteralRecords": sum(len(row["Outcome"].get("DeclaredLiterals", {})) for row in rows),
            "Rows": rows, "UnmappedCompilerBlocks": extra,
            "RuntimeAdmitted": False, "BodyResolved": False, "ClosureAdmitted": False,
            "ExplicitDumpRangeReads": 0, "MetadataQueries": 0}


def run(capture, attempt):
    owned = False
    report = None
    stage = "attempt-create"
    try:
        os.mkdir(attempt)
        owned = True
        write(attempt / "start.json", {"StartedAtUtc": utc(), "Scope": "retained reflection/JIT metadata only; no dump access or target/helper launch", "ExpectedCounts": COUNTS})
        stage = "input-identities"
        inputs = [capture / name for name in ["inputs.json", "ready-observed.json", "jit.log", "outcome.json"]]
        sources = [Path(__file__).resolve(), Path(__file__).with_name("inspect_hidden_switch_bodies.py"),
                   Path(__file__).with_name("capture_hidden_switch_dump.py"), Path(__file__).with_name("probe_hidden_switch_metadata.py")]
        pins = [identity(path) for path in inputs + sources]
        write(attempt / "inputs.json", {"Pins": pins, "SourceCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True, timeout=10).strip()})
        closed = read_json(capture / "outcome.json", 65536)
        if closed.get("Complete") is not True or closed.get("InputsUnchanged") is not True or closed.get("TargetCustodyUnchanged") is not True:
            raise ValueError("requires the complete fresh custody capture")
        ready = read_json(capture / "ready-observed.json", 4 * 1024**2)["Ready"]
        jit = capture / "jit.log"
        if jit.stat().st_size > 16 * 1024**2:
            raise ValueError("compiler transcript exceeds declared sixteen-MiB limit")
        stage = "mapping"
        report = map_methods(ready, parse_blocks(jit.read_text()))
        if any(identity(Path(pin["File"])) != pin for pin in pins):
            raise ValueError("mapping input/source bytes changed")
        write(attempt / "mapping.json", report)
        write(attempt / "outcome.json", {"Complete": report["Complete"], "FinishedAtUtc": utc(), "Mapping": identity(attempt / "mapping.json"), "InputsUnchanged": True})
        print(json.dumps({key: value for key, value in report.items() if key not in ["Rows", "UnmappedCompilerBlocks"]}))
        return 0 if report["Complete"] else 2
    except Exception as error:  # noqa: BLE001 - retain owned finite mapping failure without a dump query
        failure = {"Stage": stage, "Code": type(error).__name__, "Detail": str(error)[:4096]}
        if owned:
            try:
                write(attempt / "failure.json", {"Complete": False, "Failure": failure, "AvailableMapping": report})
            except Exception as secondary:  # noqa: BLE001 - keep original mapping/publication failure
                failure["PublicationFailure"] = {"Code": type(secondary).__name__, "Detail": str(secondary)[:4096]}
        print(json.dumps(failure))
        return 2


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("requires captured metadata directory and absent mapping directory; no dump is opened")
    raise SystemExit(run(*(Path(value).absolute() for value in sys.argv[1:])))
