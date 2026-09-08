"""Finite retained-word transfer/literal inventory; never launches a process or opens dump memory."""
from __future__ import annotations

import ast
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from hidden_switch_retained_artifacts import MIB, check_identity, regular_bytes, sha
from hidden_switch_transfer_inputs import FLAGS, loaded_inputs, require
from hidden_switch_transfer_shapes import classify_word

MAX_RECORD = 2 * MIB
MAX_WORD = 8192
MAX_OUTPUT = 32 * MIB


def utc():
    return datetime.now(timezone.utc).isoformat()


def failure(stage, error):
    return {"Stage": stage, "Code": type(error).__name__, "Detail": str(error)[:4096],
            "SecondaryNotes": [str(note)[:1024] for note in getattr(error, "__notes__", [])[:8]]}


def encode(value, limit):
    raw = json.dumps(value, ensure_ascii=True, allow_nan=False, separators=(",", ":")).encode("ascii") + b"\n"
    if len(raw) > limit:
        raise ValueError("inventory output exceeds its declared byte bound")
    return raw


def guarded_close(stream, primary=None):
    if stream is None:
        return None
    try:
        stream.close()
    except Exception as error:  # noqa: BLE001 - close failure is explicit and cannot replace the first failure
        if primary is not None:
            primary.add_note("secondary output close: " + type(error).__name__ + ": " + str(error)[:1024])
        return error
    return None


def exclusive_bytes(path, raw):
    stream = None; primary = None
    try:
        stream = path.open("xb")
        if stream.write(raw) != len(raw):
            raise OSError("short inventory output write")
        stream.flush(); os.fsync(stream.fileno())
    except Exception as error:
        primary = error
        raise
    finally:
        cleanup = guarded_close(stream, primary)
        if primary is None and cleanup is not None:
            raise cleanup


class Publisher:
    def __init__(self, attempt):
        self.attempt = Path(attempt); self.journal = None; self.charged = 0
        self.journal = (self.attempt / "journal.jsonl").open("xb")

    def charge(self, raw):
        if len(raw) > MAX_OUTPUT - MAX_RECORD - self.charged:
            raise ValueError("inventory aggregate output budget exceeded; terminal reserve retained")
        self.charged += len(raw)  # include attempted bytes even if a write fails

    def checkpoint(self, value):
        raw = encode(value, MAX_RECORD); self.charge(raw)
        if self.journal.write(raw) != len(raw):
            raise OSError("short inventory journal write")
        self.journal.flush(); os.fsync(self.journal.fileno())

    def method(self, role, value):
        require(re.fullmatch(r"method-[0-9]{3}", role) is not None, "invalid method output name")
        raw = encode(value, MAX_RECORD); self.charge(raw)
        exclusive_bytes(self.attempt / (role + ".json"), raw)
        return {"File": role + ".json", "Bytes": len(raw), "Sha256": sha(raw)}

    def close(self):
        stream = self.journal; self.journal = None
        return guarded_close(stream)


def source_inventory(directory):
    """Pin the finite local import closure as source bytes; no policy or diagnostic function is called."""
    directory = Path(directory)
    pending = [Path(__file__).name]; seen = {}; order = []
    while pending:
        name = pending.pop(0)
        if name in seen:
            continue
        require(re.fullmatch(r"[a-z_]+\.py", name) is not None and len(seen) < 24, "local source import roster exceeds its finite grammar/count")
        module = sys.modules.get(name[:-3])
        if module is not None:
            require(Path(module.__file__).resolve() == (directory / name).resolve(), "loaded helper source path differs from pinned local file")
        raw = regular_bytes(directory / name, 256 * 1024)
        record = {"File": name, "Bytes": len(raw), "Sha256": sha(raw)}
        seen[name] = raw; order.append(record)
        tree = ast.parse(raw, filename=name)
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
                module = node.module
                # Only these already local research helpers are possible local imports.
                if module.startswith(("hidden_switch_", "inspect_hidden_switch_", "probe_hidden_switch_", "capture_hidden_switch_", "decode_hidden_switch_", "map_hidden_switch_", "analyze_hidden_switch_")):
                    require(re.fullmatch(r"[a-z_]+", module) is not None, "unexpected nested local helper import")
                    pending.append(module + ".py")
    return order


def classified_method(prepared, ranges, known, state, checkpoint):
    method = prepared["Method"]; block = prepared["Compiler"]; decoded = prepared["Decoded"]
    words = [int(row["Word"], 16) for row in block["Instructions"]]
    report = {"Role": method["Role"], "Method": method, "Reflection": prepared["Reflection"],
              "DacMetadata": prepared["DacMetadata"], "PhysicalReadIdentity": prepared["PhysicalReadIdentity"],
              "CompilerName": block["Name"], "Words": [], "UnconsumedLiteralDeclarations": [],
              "Complete": False, "ObservedExecution": False, **FLAGS}
    state["Active"] = report
    used_literals = set()
    for index, (compiled, decoded_word) in enumerate(zip(block["Instructions"], decoded, strict=True)):
        locator = {"Stage": "word-classification", "Role": method["Role"], "Offset": compiled["Offset"]}
        state["Locator"] = locator
        row = {"Role": method["Role"], "Offset": compiled["Offset"], "Decoded": decoded_word, "Compiler": compiled, "Shape": None}
        report["Words"].append(row)  # selected input survives a classifier or publication refusal
        shape = classify_word(words, index, method["Address"] + compiled["Offset"], decoded_word["Instruction"],
                              compiled["Operands"], block["Literals"], ranges, known)
        row["Shape"] = shape
        encode(row, MAX_WORD)
        state["Words"] += 1
        state["Kinds"][shape["Kind"]] += 1
        state["UnresolvedWords"] += bool(shape["Unresolved"])
        if shape["Literal"] is not None and shape["Literal"].get("Label"):
            used_literals.add(shape["Literal"]["Label"])
        if "StructuralFailure" in shape:
            raise ValueError(shape["StructuralFailure"])
    report["UnconsumedLiteralDeclarations"] = [{"Label": label, "ExpectedHex": value, "PhysicalBinding": False,
                                               "Unresolved": "compiler-declaration-without-matched-supported-literal-word"}
                                              for label, value in block["Literals"].items() if label not in used_literals]
    report["Complete"] = True
    # This publication seam is deliberately after the complete in-memory method.
    checkpoint({"Kind": "method-computed", "Role": method["Role"], "Words": len(report["Words"]), "ObservedExecution": False, **FLAGS})
    return report


def terminal_record(state, primary, complete, pins, sources, cleanup):
    return {"Kind": "finite-retained-transfer-inventory", "Complete": complete, "Failure": primary,
            "StartedAtUtc": state["StartedAtUtc"], "FinishedAtUtc": utc(), "SourceCommit": state["SourceCommit"],
            "Methods": len(state["Completed"]), "Words": state["Words"], "Kinds": dict(state["Kinds"]),
            "UnresolvedWords": state["UnresolvedWords"], "CompletedMethods": state["Completed"],
            "ActiveDiagnostic": state["Active"], "Locator": state["Locator"], "Inputs": pins, "Sources": sources,
            "Unprepared": state["Unprepared"], "ExtraCompilerBlocks": state["ExtraCompilerBlocks"],
            "CleanupFailures": cleanup, "InputsUnchanged": state["InputsUnchanged"], "ObservedExecution": False,
            "RawDumpOpened": False, "NewMemoryQueries": 0, "SourceDraws": 0, **FLAGS}


def bounded_terminal(report):
    try:
        return encode(report, MAX_RECORD), report
    except ValueError as error:
        report = {**report, "Complete": False, "Failure": report["Failure"] or failure("terminal-output-bound", error),
                  "ActiveDiagnostic": None, "Inputs": [], "Sources": [], "Unprepared": [], "ExtraCompilerBlocks": [],
                  "MetadataOmitted": True, "OmittedInputPins": len(report["Inputs"]), "OmittedSources": len(report["Sources"]),
                  "OmittedActiveWords": len((report["ActiveDiagnostic"] or {}).get("Words", []))}
        return encode(report, MAX_RECORD), report


def run(root, attempt, source_commit):
    owned = False; publisher = None; store = None; primary = None; cleanup = []; pins = []; sources = []
    state = {"StartedAtUtc": utc(), "SourceCommit": source_commit, "Locator": {"Stage": "attempt-create"}, "Active": None,
             "Completed": [], "Words": 0, "Kinds": Counter(), "UnresolvedWords": 0,
             "Unprepared": [], "ExtraCompilerBlocks": [], "InputsUnchanged": False}

    def locator(value):
        state["Locator"] = value

    def observed(pin):
        pins.append(pin)  # available even if store construction/checkpoint fails
        publisher.checkpoint({"Kind": "input-identity", "Identity": pin})

    try:
        require(re.fullmatch(r"[0-9a-f]{40}", source_commit) is not None, "requires an exact externally recorded source commit")
        os.mkdir(attempt); owned = True; publisher = Publisher(attempt)
        publisher.checkpoint({"Kind": "start", "StartedAtUtc": state["StartedAtUtc"], "SourceCommit": source_commit,
                              "ExpectedMethods": 130, "ExpectedWords": 8665, "RawDumpOpened": False, **FLAGS})
        locator({"Stage": "source-identities"})
        sources = source_inventory(Path(__file__).parent)
        publisher.checkpoint({"Kind": "source-identities", "Sources": sources})
        loaded = loaded_inputs(root, observed, locator); store = loaded["Store"]
        state["Unprepared"] = loaded["Unprepared"]; state["ExtraCompilerBlocks"] = loaded["ExtraCompilerBlocks"]
        publisher.checkpoint({"Kind": "unresolved-rosters", "Unprepared": state["Unprepared"], "ExtraCompilerBlocks": state["ExtraCompilerBlocks"], **FLAGS})
        for prepared in loaded["Methods"]:
            report = classified_method(prepared, loaded["Ranges"], loaded["KnownCells"], state, publisher.checkpoint)
            locator({"Stage": "method-publication", "Role": report["Role"], "Offset": None})
            record = publisher.method(report["Role"], report)
            state["Completed"].append(record); state["Active"] = None
        require(len(state["Completed"]) == 130 and state["Words"] == 8665, "complete inventory cardinality differs")
        locator({"Stage": "input-recheck"})
        store.recheck()
        for pin in sources:
            check_identity(regular_bytes(Path(__file__).with_name(pin["File"]), 256 * 1024), pin["Bytes"], pin["Sha256"])
        state["InputsUnchanged"] = True
    except Exception as error:  # noqa: BLE001 - retain original collector/publication failure and actual available active diagnostic
        primary = failure(state["Locator"]["Stage"], error)
    finally:
        if publisher is not None:
            try:
                error = publisher.close()
            except Exception as close_error:  # noqa: BLE001 - cleanup exceptions cannot bypass independent terminal retention
                error = close_error
            if error is not None:
                cleanup.append(failure("journal-close", error))
        complete = primary is None and not cleanup and state["InputsUnchanged"]
        report = terminal_record(state, primary, complete, pins, sources, cleanup)
        if owned:
            try:
                raw, report = bounded_terminal(report)
                exclusive_bytes(Path(attempt) / "outcome.json", raw)
            except Exception as error:  # noqa: BLE001 - independent compact attempt after failed terminal publication
                report["Complete"] = False
                report["PublicationFailure"] = failure("terminal-publication", error)
                try:
                    exclusive_bytes(Path(attempt) / "terminal-failure.json", encode({"Complete": False, "Failure": primary,
                                    "PublicationFailure": report["PublicationFailure"], "Locator": state["Locator"],
                                    "Methods": len(state["Completed"]), "Words": state["Words"], **FLAGS}, 16384))
                except Exception as secondary:  # noqa: BLE001 - preserve first failure if independent publication also fails
                    report["SecondaryPublicationFailure"] = failure("secondary-terminal-publication", secondary)
    return report


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("usage: inventory_hidden_switch_transfers.py retained-base exclusive-attempt source-commit", file=sys.stderr)
        sys.exit(2)
    outcome = run(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
    try:
        print(json.dumps({key: outcome[key] for key in ["Kind", "Complete", "Failure", "Methods", "Words", "UnresolvedWords", *FLAGS]}))
    except Exception:  # noqa: BLE001 - console is secondary to independent owned outcome; no new success claim
        sys.exit(2)
    sys.exit(0 if outcome["Complete"] else 2)
