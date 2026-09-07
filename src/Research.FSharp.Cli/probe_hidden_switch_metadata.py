"""One bounded offline ClrMD attempt on three physically admitted hand methods."""
from __future__ import annotations

import contextlib
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from analyze_hidden_switch_dump import (
    descriptor_identity,
    physical_method,
    unchanged_descriptor,
)
from capture_hidden_switch_dump import identity, utc, write
from hidden_switch_dump_memory import MachCore
from inspect_hidden_switch_bodies import parse_blocks

# Previous actual runtime metadata is an expectation only for these identical installed bytes.
# Fresh runtime base comes from the new capture; the helper must independently match actual
# ClrInfo.Version/BuildId/current methods. No directory-name version inference is used.
RUNTIME_SHA = "10B24D0B11C7F6D838114744097BF10DF9B08B906AFC9016567631A1C009DFD0"
RUNTIME_VERSION = "10.0.1126.37416"
RUNTIME_BUILD = "6CB64FF242FF30EABC454640FA3B0D03"
SIGNATURES = {
    "predict": "Zeta.Research.HiddenSwitchPolicy.predict(Boolean, Double, Int32)",
    "condition": "Zeta.Research.HiddenSwitchPolicy.condition(Double, Int32)",
    "select": "Zeta.Research.HiddenSwitchPolicy.select(Double[])",
}


def read_json(path, limit):
    with path.open("rb") as stream:
        count = os.fstat(stream.fileno()).st_size
        if not 0 < count <= limit:
            raise ValueError("metadata file exceeds declared nonempty bound: " + path.name)
        raw = stream.read(count + 1)
        if len(raw) != count or os.fstat(stream.fileno()).st_size != count:
            raise ValueError("metadata file changed while read: " + path.name)
    return json.loads(raw)


def one(rows, predicate, description):
    matches = [row for row in rows if predicate(row)]
    if len(matches) != 1:
        raise ValueError("requires one " + description)
    return matches[0]


def copied_module(inputs, ready, dll):
    row = one(inputs["TargetCustody"], lambda row: row["Original"]["File"] == str(dll), "captured CLI custody row")
    for pin in [row["Original"], row["Copy"]]:
        if identity(Path(pin["File"])) != pin:
            raise ValueError("captured CLI original/copy identity changed")
    if row["Original"]["Sha256"] != row["Copy"]["Sha256"] or row["Original"]["Bytes"] != row["Copy"]["Bytes"]:
        raise ValueError("CLI custody copy differs")
    managed = one(ready["ManagedImages"], lambda image: image["Identity"]["File"] == str(dll), "native reflected CLI image")
    if managed["Identity"]["Sha256"] != row["Original"]["Sha256"] or managed["Identity"]["Bytes"] != row["Original"]["Bytes"]:
        raise ValueError("native reflected CLI bytes differ from custody")
    return {**row, "Mvid": managed["Mvid"]}


def output_admission(report, methods):
    if report.get("Complete") is not True or report.get("Failure") is not None or report.get("Cleanup") != []:
        raise ValueError("helper did not complete the three-method metadata slice")
    if any(report.get(key) is not False for key in ["RuntimeAdmitted", "BodyResolved", "ClosureAdmitted", "PhysicalCodeVerifiedByHelper"]):
        raise ValueError("helper admission scope changed")
    rows = report.get("Methods")
    if not isinstance(rows, list) or len(rows) != 3:
        raise ValueError("helper method cardinality differs")
    for expected, actual in zip(methods, rows, strict=True):
        exact = {"Role": expected["Role"], "Query": expected["Address"], "Token": expected["Token"],
                 "Signature": expected["Signature"], "NativeCode": expected["Address"],
                 "HotStart": expected["Address"], "HotSize": expected["Bytes"], "ColdStart": 0, "ColdSize": 0}
        if any(type(actual.get(key)) is not type(value) or actual.get(key) != value for key, value in exact.items()):
            raise ValueError("helper extent/identity does not match the exact physical candidate")


def check_outputs(attempt, limit=2 * 1024**2):
    for name in ["helper.stdout.log", "helper.stderr.log", "helper-output.json", "helper-output.json.jsonl", "helper-host.log"]:
        path = attempt / name
        if path.exists() and path.stat().st_size > limit:
            raise ValueError("metadata helper output exceeded polled byte limit: " + name)


def wait_helper(process, attempt, seconds=180, limit=2 * 1024**2):
    deadline = time.monotonic() + seconds
    while process.poll() is None:
        if time.monotonic() >= deadline:
            raise TimeoutError("metadata helper exceeded its process deadline")
        check_outputs(attempt, limit)
        time.sleep(0.05)
    check_outputs(attempt, limit)


def cleanup_owned(process, streams):
    """Attempt owned kill/join before closing each output once; return every cleanup error."""
    errors = []
    if process is not None and process.poll() is None:
        try:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
        except Exception as error:  # noqa: BLE001 - remaining owned close attempts must still occur
            errors.append({"Stage": "helper-cleanup", "Code": type(error).__name__, "Detail": str(error)[:4096]})
    for name, stream in streams:
        if stream is not None:
            try:
                stream.close()
            except Exception as error:  # noqa: BLE001 - never replace the prior process/refusal outcome
                errors.append({"Stage": name, "Code": type(error).__name__, "Detail": str(error)[:4096]})
    return errors


def run(capture, attempt, host, helper):
    owned = False
    process = stream = out = err = None
    cleanup = []
    stage = "attempt-create"
    outcome = {"Kind": "clrmd-physical-extent-feasibility", "Complete": False, "Failure": None,
               "RuntimeAdmitted": False, "BodyResolved": False, "ClosureAdmitted": False}
    try:
        os.mkdir(attempt)
        owned = True
        write(attempt / "start.json", {**outcome, "StartedAtUtc": utc(),
              "MethodRoster": list(SIGNATURES), "HelperSeconds": 180, "DumpHashSeconds": 120,
              "OutputLimitPerFile": 2 * 1024**2,
              "LimitScope": "process deadline and polled output limit; overshoot retained, not filesystem quota or kernel I/O cancellation",
              "DumpPremise": "immutable local captured file/path through both held physical descriptor and separate helper open; no hostile namespace/in-place-write isolation",
              "RuntimeExpectation": {"ImageSha256": RUNTIME_SHA, "Version": RUNTIME_VERSION, "BuildId": RUNTIME_BUILD,
                                     "Meaning": "prior observed metadata expectation for identical installed bytes, rechecked against fresh dump"}})
        stage = "capture-custody"
        captured = read_json(capture / "outcome.json", 65536)
        if any(captured.get(key) is not True for key in ["Complete", "InputsUnchanged", "TargetCustodyUnchanged"]) or captured.get("CleanupFailures") != []:
            raise ValueError("requires one complete fresh capture with exact retained target copies")
        inputs = read_json(capture / "inputs.json", 1024**2)
        ready = read_json(capture / "ready-observed.json", 4 * 1024**2)["Ready"]
        if host != Path(inputs["TargetArguments"][0]) or identity(host) not in inputs["Pins"]:
            raise ValueError("actual helper host differs from captured host identity")
        for pin in inputs["Pins"]:
            if identity(Path(pin["File"])) != pin:
                raise ValueError("captured source/module/runtime/tool bytes changed")
        for row in inputs["TargetCustody"]:
            if identity(Path(row["Copy"]["File"])) != row["Copy"]:
                raise ValueError("a target custody copy changed")
        dll = Path(inputs["TargetArguments"][1])
        module = copied_module(inputs, ready, dll)
        runtime_dir = host.parent / "shared/Microsoft.NETCore.App/10.0.11"
        runtime_image = identity(runtime_dir / "libcoreclr.dylib")
        if runtime_image["Sha256"] != RUNTIME_SHA:
            raise ValueError("installed runtime bytes do not match declared version/build expectation")
        native = one(ready["NativeImages"]["Images"], lambda image: image["Name"] == runtime_image["File"], "captured runtime dyld row")
        if native["Identity"]["Sha256"] != runtime_image["Sha256"]:
            raise ValueError("captured dyld file identity differs from current pinned runtime")
        stage = "helper-identities"
        if helper.name != "Zeta.Research.HiddenSwitchMetadata.dll":
            raise ValueError("requires the declared isolated helper assembly")
        files = sorted(helper.parent.glob("*.dll")) + [helper.with_suffix(".deps.json"), helper.with_suffix(".runtimeconfig.json"), helper.parent / "dependencies.json"]
        if not 0 < len(files) <= 32 or helper not in files:
            raise ValueError("helper module/config roster is outside its finite limit")
        files.extend([host] + [runtime_dir / name for name in ["libcoreclr.dylib", "libclrjit.dylib", "libmscordaccore.dylib", "libhostpolicy.dylib", "System.Private.CoreLib.dll"]])
        source_dir = Path(__file__).resolve().parent
        files.extend([source_dir / name for name in ["probe_hidden_switch_metadata.py", "analyze_hidden_switch_dump.py", "capture_hidden_switch_dump.py", "hidden_switch_dump_memory.py", "inspect_hidden_switch_bodies.py"]])
        files.extend(sorted((source_dir / "MetadataProbe").glob("*.fs")))
        files.extend([source_dir / "MetadataProbe/HiddenSwitchMetadata.fsproj", source_dir / "MetadataProbe/dependencies.json", source_dir.parent / "Core/Result.fs"])
        helper_pins = [identity(path) for path in files]
        write(attempt / "inputs.json", {"CaptureMetadata": [identity(capture / name) for name in ["outcome.json", "inputs.json", "ready-observed.json", "jit.log"]],
              "HelperSourcesModulesAndHost": helper_pins, "ModuleCustody": module,
              "Scope": "copy/file pins separate from actual helper loaded-image observations; framework resolution is not a complete load-closure proof"})
        stage = "physical-backing"
        dump = capture / "graph.core"
        stream = dump.open("rb")
        snapshot = descriptor_identity(stream, dump, captured["LocalOnlyDump"])
        write(attempt / "held-dump.json", {"Identity": captured["LocalOnlyDump"], "Descriptor": snapshot})
        memory = MachCore(stream, snapshot["Size"])
        write(attempt / "physical-format.json", memory.header)
        # Compiler output is metadata, bounded independently of local-only dump bytes.
        jit = capture / "jit.log"
        if jit.stat().st_size > 16 * 1024**2:
            raise ValueError("compiler transcript exceeds declared 16-MiB bound")
        blocks = parse_blocks(jit.read_text())
        methods = []
        for role, signature in SIGNATURES.items():
            entry = one(ready["Methods"], lambda row, role=role: row["Type"] == "Zeta.Research.HiddenSwitchPolicy" and row["Name"] == role, "prepared reflected " + role)
            block = one(blocks, lambda row, role=role: row["Name"].startswith("Zeta.Research.HiddenSwitchPolicy:" + role + "("), "compiler block " + role)
            if entry["Prepared"] is not True or entry["Mvid"] != module["Mvid"]:
                raise ValueError("reflected method is unprepared or from a different captured module")
            address = physical_method(memory, entry, block, attempt)
            methods.append({"Role": role, "Address": address, "Bytes": block["Bytes"], "Token": entry["Token"], "Signature": signature,
                            "BodySha256": hashlib.sha256(bytes.fromhex(block["Hex"])).hexdigest().upper()})
        unchanged_descriptor(stream, dump, snapshot)
        manifest = {"Dump": captured["LocalOnlyDump"], "Dac": identity(runtime_dir / "libmscordaccore.dylib"),
                    "Runtime": {"Image": runtime_image, "ImageBase": int(native["Header"], 16), "Version": RUNTIME_VERSION, "BuildId": RUNTIME_BUILD},
                    "Module": module, "Methods": methods}
        write(attempt / "helper-input.json", manifest)
        stage = "helper-process"
        args = [str(host), str(helper), str(attempt / "helper-input.json"), str(attempt / "helper-output.json")]
        overrides = {"COREHOST_TRACE": "1", "COREHOST_TRACEFILE": str(attempt / "helper-host.log")}
        env = os.environ.copy(); env.update(overrides)
        write(attempt / "helper-start.json", {"Arguments": args, "StartedAtUtc": utc(), "Overrides": overrides,
              "OtherRuntimeEnvironmentKeys": sorted(key for key in env if key.startswith(("DOTNET_", "COMPlus_", "CORECLR_", "COR_", "DYLD_"))),
              "Ownership": "one owned direct child/session; no general descendant quiescence guarantee"})
        out = (attempt / "helper.stdout.log").open("xb")
        err = (attempt / "helper.stderr.log").open("xb")
        process = subprocess.Popen(args, stdout=out, stderr=err, cwd=attempt, env=env, start_new_session=True)
        write(attempt / "helper-started.json", {"ProcessId": process.pid, "StartedAtUtc": utc()})
        wait_helper(process, attempt)
        write(attempt / "helper-finished.json", {"ProcessId": process.pid, "ExitCode": process.returncode, "FinishedAtUtc": utc()})
        if process.returncode != 0:
            raise ValueError("metadata helper refused or failed; exact output retained")
        stage = "output-admission"
        report = read_json(attempt / "helper-output.json", 1024**2)
        output_admission(report, methods)
        unchanged_descriptor(stream, dump, snapshot)
        if any(identity(Path(pin["File"])) != pin for pin in helper_pins + inputs["Pins"]):
            raise ValueError("prelaunch helper/target inputs changed")
        if any(identity(Path(row["Copy"]["File"])) != row["Copy"] for row in inputs["TargetCustody"]):
            raise ValueError("target custody changed after helper query")
        outcome.update({"Complete": True, "PhysicalCandidateBytes": sum(row["Bytes"] for row in methods), "ComparedCurrentHotExtents": len(methods),
                        "Scope": "three exact DAC current extents corresponding to independently stored physical candidate bytes; full closure remains unadmitted"})
    except Exception as error:  # noqa: BLE001 - owned diagnostic boundary retains every actual refusal
        outcome["Failure"] = {"Stage": stage, "Code": type(error).__name__, "Detail": str(error)[:4096]}
    finally:
        cleanup = cleanup_owned(process, [("stdout-close", out), ("stderr-close", err), ("dump-close", stream)])
        outcome["CleanupFailures"] = cleanup
        outcome["Complete"] = outcome["Complete"] and not cleanup and outcome["Failure"] is None
        outcome["FinishedAtUtc"] = utc()
        outcome["HelperProcess"] = None if process is None else {"ProcessId": process.pid, "ExitCode": process.poll()}
        if owned:
            try:
                write(attempt / "outcome.json", outcome)
            except Exception as error:  # noqa: BLE001 - report storage refusal without replacing first failure
                outcome["Complete"] = False
                outcome["PublicationFailure"] = {"Code": type(error).__name__, "Detail": str(error)[:4096]}
        print(json.dumps(outcome))
    return 0 if outcome["Complete"] else 2


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit("requires fresh capture, absent attempt, exact host and isolated metadata DLL")
    raise SystemExit(run(*(Path(value).absolute() for value in sys.argv[1:])))
