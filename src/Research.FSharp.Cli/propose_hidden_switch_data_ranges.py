"""Fixed archived-inventory admission and range proposal; no physical file or process query."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from hidden_switch_data_ranges import EXPECTED, derive_ranges
from hidden_switch_retained_artifacts import (
    RetainedStore,
    check_identity,
    regular_bytes,
    sha,
    strict_json,
)
from hidden_switch_transfer_inputs import (
    FLAGS,
    MANIFESTS,
    exact_int,
    full_flags_false,
    require,
)
from inventory_hidden_switch_transfers import (
    MAX_CONSOLE,
    MAX_RECORD,
    MAX_SECONDARY,
    Publisher,
    encode,
    exclusive_bytes,
    failure,
    source_inventory,
    utc,
)

INVENTORY_PIN = {"File": "transfer-inventory-attempt-1/manifest.json", "Bytes": 56373,
                 "Sha256": "87CCFFFF3EDBA26779FD00A936D8CF6EF6616B6745817EAF59611CE335208555"}
MAPPED_PIN = MANIFESTS[1]
INVENTORY = INVENTORY_PIN["File"]
MAPPED = MAPPED_PIN["File"]
INVENTORY_SOURCE = "370c110c93598874615efe60a5bed23ac6e5263d"
DUMP_IDENTITY = {"Bytes": 6208508456, "Sha256": "7584B8D3E56DAFA79CAE8C954C03C2587AC25134CAA970F67CE530FDE17D3709"}


def proposal_sources(directory, observed, locator):
    """Two explicit new entry files plus the reviewed twelve-file inventory import closure."""
    directory = Path(directory); rows = []
    for name in [Path(__file__).name, "hidden_switch_data_ranges.py"]:
        locator({"Stage": "source-identity", "File": name})
        module = sys.modules.get(name[:-3])
        if module is not None:
            require(Path(module.__file__).resolve() == (directory / name).resolve(), "proposal import path differs")
        raw = regular_bytes(directory / name, 256 * 1024)
        row = {"File": name, "Bytes": len(raw), "Sha256": sha(raw)}
        rows.append(row); observed(row)
    rows.extend(source_inventory(directory, observed, locator))
    require(len(rows) == 14 and len({row["File"] for row in rows}) == 14, "proposal local source roster differs")
    return rows


def admitted_header(report, helper, records):
    """Corroborate identities already accepted in the immutable archived inventory."""
    full_flags_false(report)
    require(report.get("Kind") == "finite-retained-transfer-inventory" and report.get("Complete") is True
            and report.get("Failure") is None and report.get("CleanupFailures") == []
            and report.get("InputsUnchanged") is True and report.get("ActiveDiagnostic") is None
            and report.get("SourceCommit") == INVENTORY_SOURCE, "inventory terminal status/source differs")
    require(all(exact_int(report.get(key), value) for key, value in [("Methods", 130), ("Words", 8665), ("UnresolvedWords", 8524),
            ("NewMemoryQueries", 0), ("SourceDraws", 0)]) and report.get("RawDumpOpened") is False
            and report.get("ObservedExecution") is False, "inventory cardinality/read scope differs")
    require(len(report["Unprepared"]) == 9 and len(report["ExtraCompilerBlocks"]) == 9, "unresolved inventory rosters differ")
    methods = helper["Methods"]
    require(isinstance(methods, list) and len(methods) == 130, "mapped method roster differs")
    roles = [method["Role"] for method in methods]
    require(all(isinstance(role, str) and re.fullmatch(r"method-[0-9]{3}", role) for role in roles)
            and roles == sorted(set(roles), key=lambda role: int(role[7:])), "mapped role order differs")
    completed = report["CompletedMethods"]
    require(isinstance(completed, list) and len(completed) == 130
            and [row["File"] for row in completed] == [role + ".json" for role in roles], "completed inventory order differs")
    actual = [name for name in records if re.fullmatch(r"method-[0-9]{3}\.json\.gz", name)]
    require(actual == [role + ".json.gz" for role in roles], "manifest method records are missing, extra or reordered")
    for row in completed:
        archived = records[row["File"] + ".gz"]
        require(type(row["Bytes"]) is int and row["Bytes"] == archived["Bytes"]
                and row["Sha256"] == archived["Sha256"], "completed method identity contradicts manifest")
    dump = helper["Dump"]
    require(isinstance(dump, dict) and set(dump) == {"File", "Bytes", "Sha256"}
            and isinstance(dump["File"], str) and Path(dump["File"]).is_absolute()
            and "\x00" not in dump["File"] and len(dump["File"]) <= 1024
            and exact_int(dump["Bytes"], DUMP_IDENTITY["Bytes"]) and dump["Sha256"] == DUMP_IDENTITY["Sha256"],
            "mapped inventory dump identity differs")
    return methods


def admitted_inputs(root, observed, locator, state, checkpoint):
    store = RetainedStore(root, [INVENTORY_PIN, MAPPED_PIN], observed)
    locator({"Stage": "inventory-outcome", "File": "outcome.json.gz"})
    report = store.json(INVENTORY, "outcome.json.gz")
    state["Inventory"] = {"Manifest": INVENTORY_PIN, "SourceCommit": report.get("SourceCommit")}
    locator({"Stage": "mapped-input", "File": "helper-input.json.gz"})
    helper = store.json(MAPPED, "helper-input.json.gz")
    # Bind the selected helper's two identities to the actual earlier inventory's input observations.
    require(isinstance(report["Inputs"], list) and len(report["Inputs"]) == 1072
            and len({(pin["Kind"], pin["File"]) for pin in report["Inputs"]}) == 1072, "inventory input roster differs")
    for pin in store.pins:
        if pin["File"].startswith("clrmd-mapped-attempt-1/"):
            require(sum(prior == pin for prior in report["Inputs"]) == 1, "selected mapped input lacks same-inventory identity")
    methods = admitted_header(report, helper, store.records[INVENTORY])
    state["DumpIdentity"] = helper["Dump"]
    state["Unprepared"] = report["Unprepared"]; state["ExtraCompilerBlocks"] = report["ExtraCompilerBlocks"]
    checkpoint({"Kind": "inventory-admitted", "Inventory": state["Inventory"], "DumpIdentity": state["DumpIdentity"],
                "Unprepared": state["Unprepared"], "ExtraCompilerBlocks": state["ExtraCompilerBlocks"], **FLAGS})
    loaded = []
    for expected, pin in zip(methods, report["CompletedMethods"], strict=True):
        role = expected["Role"]; locator({"Stage": "method-admission", "Role": role, "File": pin["File"] + ".gz"})
        raw = store.raw(INVENTORY, pin["File"] + ".gz")
        check_identity(raw, pin["Bytes"], pin["Sha256"])
        method = strict_json(raw)
        state["ActiveDiagnostic"] = method  # actual parsed prefix precedes admission/publication
        full_flags_false(method)
        require(method.get("Role") == role and method.get("Method") == expected and method.get("Complete") is True
                and method.get("ObservedExecution") is False and method.get("UnconsumedLiteralDeclarations") == []
                and isinstance(method.get("Words"), list) and len(method["Words"]) * 4 == expected["Bytes"],
                "inventory method/current metadata correspondence differs")
        loaded.append(method); state["CompletedMethods"].append(pin)
        checkpoint({"Kind": "method-admitted", "Identity": pin, "Role": role})
        state["ActiveDiagnostic"] = None
    require(len(loaded) == 130 and sum(len(row["Words"]) for row in loaded) == 8665, "complete admitted word roster differs")
    return store, loaded


def bounded_outcome(report):
    try:
        return encode(report, MAX_RECORD), report
    except ValueError as error:
        compact = {**report, "Complete": False, "Failure": report["Failure"] or failure("terminal-output-bound", error),
                   "Proposal": None, "ActiveDiagnostic": None, "Inputs": [], "Sources": [], "Unprepared": [], "ExtraCompilerBlocks": [],
                   "MetadataOmitted": True, "OmittedInputPins": len(report["Inputs"]), "OmittedSources": len(report["Sources"]),
                   "OmittedActiveWords": len((report["ActiveDiagnostic"] or {}).get("Words", []))}
        return encode(compact, MAX_RECORD), compact


def run(root, attempt, source_commit):
    owned = False; publisher = None; store = None; primary = None; cleanup = []; pins = []; sources = []
    state = {"StartedAtUtc": utc(), "SourceCommit": source_commit, "Locator": {"Stage": "attempt-create"},
             "Inventory": None, "DumpIdentity": None, "ActiveDiagnostic": None, "CompletedMethods": [],
             "Unprepared": [], "ExtraCompilerBlocks": [], "InputsUnchanged": False, "Proposal": None, "ProposalFile": None}

    def locator(value):
        state["Locator"] = value

    def observed(pin):
        pins.append(pin)
        publisher.checkpoint({"Kind": "input-identity", "Identity": pin})

    def observed_source(pin):
        sources.append(pin)
        publisher.checkpoint({"Kind": "source-identity", "Identity": pin})

    try:
        require(re.fullmatch(r"[0-9a-f]{40}", source_commit) is not None, "requires exact recorded source commit")
        os.mkdir(attempt); owned = True; publisher = Publisher(attempt)
        publisher.checkpoint({"Kind": "start", "Expected": dict(EXPECTED), "SourceCommit": source_commit,
                              "RawDumpOpened": False, "NewMemoryQueries": 0, **FLAGS})
        proposal_sources(Path(__file__).parent, observed_source, locator)
        store, methods = admitted_inputs(root, observed, locator, state, publisher.checkpoint)
        locator({"Stage": "pure-range-derivation"})
        proposal = derive_ranges(methods)  # fixed production counts; no fixture override
        state["Proposal"] = {**proposal, "Inventory": state["Inventory"], "DumpIdentity": state["DumpIdentity"]}
        locator({"Stage": "input-recheck"}); store.recheck()
        for pin in sources:
            check_identity(regular_bytes(Path(__file__).with_name(pin["File"]), 256 * 1024), pin["Bytes"], pin["Sha256"])
        state["InputsUnchanged"] = True
        locator({"Stage": "proposal-publication"})
        raw = encode(state["Proposal"], MAX_RECORD); publisher.charge(raw)
        exclusive_bytes(Path(attempt) / "proposal.json", raw)
        state["ProposalFile"] = {"File": "proposal.json", "Bytes": len(raw), "Sha256": sha(raw)}
        publisher.checkpoint({"Kind": "proposal-published", "Identity": state["ProposalFile"], **FLAGS})
    except Exception as error:  # noqa: BLE001 - outer fail-stop owns constructor/read/derive/checkpoint failures
        primary = failure(state["Locator"]["Stage"], error)
    finally:
        if publisher is not None:
            try:
                error = publisher.close()
            except Exception as close_error:  # noqa: BLE001 - independent terminal remains attempted
                error = close_error
            if error is not None:
                cleanup.append(failure("journal-close", error))
        report = {"Kind": "finite-data-range-proposal-collection", **state, "FinishedAtUtc": utc(),
                  "Complete": primary is None and not cleanup and state["ProposalFile"] is not None and state["InputsUnchanged"],
                  "Failure": primary, "Inputs": pins, "Sources": sources, "CleanupFailures": cleanup,
                  "ProposalOnly": True, "RawDumpOpened": False, "NewMemoryQueries": 0, "SourceDraws": 0,
                  "ObservedExecution": False, **FLAGS}
        if owned:
            try:
                raw, report = bounded_outcome(report)
                exclusive_bytes(Path(attempt) / "outcome.json", raw)
            except Exception as error:  # noqa: BLE001 - preserve the primary through separate terminal failure
                report["Complete"] = False; report["PublicationFailure"] = failure("terminal-publication", error)
                try:
                    exclusive_bytes(Path(attempt) / "terminal-failure.json", encode({"Complete": False, "Failure": primary,
                                    "PublicationFailure": report["PublicationFailure"], "Locator": state["Locator"],
                                    "Methods": len(state["CompletedMethods"]), "ProposalFile": state["ProposalFile"], **FLAGS}, MAX_SECONDARY))
                except Exception as secondary:  # noqa: BLE001 - the secondary publication cannot claim success
                    report["SecondaryPublicationFailure"] = failure("secondary-terminal-publication", secondary)
    return report


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("usage: propose_hidden_switch_data_ranges.py retained-base exclusive-attempt source-commit", file=sys.stderr)
        sys.exit(2)
    outcome = run(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
    try:
        raw = encode({key: outcome[key] for key in ["Kind", "Complete", "Failure", "ProposalFile", *FLAGS]}, MAX_CONSOLE)
        print(raw.decode("ascii"), end="")
    except Exception:  # noqa: BLE001 - console failure is secondary to the retained owned outcome
        sys.exit(2)
    sys.exit(0 if outcome["Complete"] else 2)
