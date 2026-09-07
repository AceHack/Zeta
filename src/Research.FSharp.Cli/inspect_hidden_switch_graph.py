"""LLDB-owned initial graph feasibility capture, never a runtime certificate.

Load using LLDB's command-script import, then invoke hs-graph with the exact
file-backed dotnet host, task DLL and a nonexistent attempt directory. This
initial collector keeps entry/stub bytes and independent decoding; it does not
invent resolved body bounds, accept guards or launch registered study streams.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shlex
import time
import xml.etree.ElementTree as ET

import lldb


def _write(path: Path, value: object) -> None:
    with path.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, allow_nan=False)
        handle.write("\n")


def _file(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    return {
        "File": str(path),
        "Bytes": len(data),
        "Sha256": hashlib.sha256(data).hexdigest().upper(),
    }


def _complete(path: Path, process_id: int) -> None:
    if type(process_id) is not int or process_id <= 0:
        raise ValueError("completion requires the actual positive process ID")
    data = f"graph-capture-complete:{process_id}\n".encode("ascii")
    with path.open("xb") as handle:
        written = handle.write(data)
        if written != len(data):
            raise RuntimeError("completion file write was partial")
        handle.flush()
        os.fsync(handle.fileno())


def _state(process: lldb.SBProcess) -> dict[str, object]:
    return {
        "State": int(process.GetState()),
        "ProcessId": int(process.GetProcessID()),
        "ExitStatus": int(process.GetExitStatus()),
        "ExitDescription": process.GetExitDescription(),
        "Threads": [
            {
                "ThreadId": int(thread.GetThreadID()),
                "StopReason": int(thread.GetStopReason()),
                "StopDescription": thread.GetStopDescription(256),
            }
            for thread in process
        ],
    }


def _ready(path: Path) -> dict[str, object] | None:
    if not path.exists():
        return None
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue  # the live writer may still be writing its final line
        if value.get("Kind") == "graph-hand-failed":
            raise RuntimeError(f"native graph refusal: {value.get('Failure')}")
        if value.get("Kind") == "graph-hand-ready":
            return value
    return None


def _wait(process: lldb.SBProcess, predicate, seconds: float, stage: str):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        value = predicate()
        if value:
            return value
        if process.GetState() in (lldb.eStateExited, lldb.eStateCrashed, lldb.eStateDetached):
            raise RuntimeError(f"{stage}: process stopped before completion: {_state(process)}")
        time.sleep(0.025)
    raise TimeoutError(f"{stage}: {seconds}s operational deadline exceeded")


def _entries(target: lldb.SBTarget, process: lldb.SBProcess, report: dict[str, object], attempt: Path):
    rows = []
    for index, method in enumerate(report["Methods"]):
        if not method["Prepared"]:
            row = {"Method": method, "Captured": False, "Reason": method["Refusal"]}
            _write(attempt / f"prefix-{index:04d}-refused.json", row)
            rows.append(row)
            continue
        address = int(method["Callable"], 16)
        region = lldb.SBMemoryRegionInfo()
        error = process.GetMemoryRegionInfo(address, region)
        if not error.Success() or not region.IsReadable():
            raise RuntimeError(f"entry memory region refused for {method['Type']}:{method['Name']}: {error}")
        count = min(64, int(region.GetRegionEnd()) - address) & ~3
        if address % 4 or count < 4:
            raise RuntimeError("entry region has fewer than four readable bytes")
        error = lldb.SBError()
        raw = process.ReadMemory(address, count, error)
        if not error.Success() or len(raw) != count:
            raise RuntimeError(f"entry memory read refused: {error}")
        _write(attempt / f"prefix-{index:04d}-raw.json", {"Method": method, "CallablePrefixBytes": raw.hex().upper(), "PrefixSha256": hashlib.sha256(raw).hexdigest().upper(), "RegionBase": f"{region.GetRegionBase():016X}", "RegionEnd": f"{region.GetRegionEnd():016X}"})
        instructions = target.ReadInstructions(lldb.SBAddress(address, target), count // 4)
        decoded = []
        if instructions.GetSize() != count // 4:
            raise RuntimeError("independent decoder returned a partial prefix")
        for offset, instruction in enumerate(instructions):
            observed_address = instruction.GetAddress().GetLoadAddress(target)
            if not instruction.IsValid() or observed_address != address + 4 * offset or instruction.GetByteSize() != 4:
                raise RuntimeError("independent decoder returned a discontinuous or non-ARM64-width prefix")
            data = instruction.GetData(target)
            decoded_bytes = []
            for byte_offset in range(4):
                error = lldb.SBError()
                decoded_bytes.append(data.GetUnsignedInt8(error, byte_offset))
                if not error.Success():
                    raise RuntimeError(f"independent instruction-byte read refused: {error}")
            if bytes(decoded_bytes) != raw[4 * offset:4 * offset + 4]:
                raise RuntimeError("independent decoder bytes differ from separate process memory read")
            decoded.append({
                "Address": f"{instruction.GetAddress().GetLoadAddress(target):016X}",
                "ByteSize": int(instruction.GetByteSize()),
                "Bytes": bytes(decoded_bytes).hex().upper(),
                "Mnemonic": instruction.GetMnemonic(target),
                "Operands": instruction.GetOperands(target),
                "Comment": instruction.GetComment(target),
            })
        row = {
            "Method": method,
            "Captured": True,
            "CallablePrefixBytes": raw.hex().upper(),
            "PrefixSha256": hashlib.sha256(raw).hexdigest().upper(),
            "RegionBase": f"{region.GetRegionBase():016X}",
            "RegionEnd": f"{region.GetRegionEnd():016X}",
            "RegionReadable": bool(region.IsReadable()),
            "RegionExecutable": bool(region.IsExecutable()),
            "IndependentDecoder": "LLDB SBTarget.ReadInstructions",
            "DecodedPrefix": decoded,
            "BodyResolved": False,
            "Reason": "initial callable/stub prefix only; no method-body range inferred",
        }
        _write(attempt / f"prefix-{index:04d}-decoded.json", row)
        rows.append(row)
    return rows


def capture(debugger, command, result, _internal_dict):
    """Launch one owned process; every unexpected outcome remains a failed attempt."""
    process = None
    attempt = None
    owned_attempt = False
    stage = "arguments"
    outcome = {"Kind": "graph-feasibility", "Complete": False, "RuntimeAdmitted": False}
    initial_async = None
    try:
        args = shlex.split(command)
        if len(args) != 3:
            raise ValueError("requires exact dotnet host, DLL, and nonexistent attempt directory")
        host, dll, attempt = (Path(value).absolute() for value in args)
        stage = "attempt-create"
        os.mkdir(attempt)  # atomic ownership; existing directories refuse
        owned_attempt = True
        stage = "start-metadata"
        report_path = attempt / "native.jsonl"
        jit_path = attempt / "jit.log"
        environment = {
            "DOTNET_TieredCompilation": "0",
            "DOTNET_TieredPGO": "0",
            "DOTNET_ReadyToRun": "0",
            "DOTNET_JitDisasm": "Zeta.Research.HiddenSwitchPolicy*:* Zeta.Research.HiddenSwitchCompiledPolicy*:* Zeta.Research.HiddenSwitchObservation*:* Zeta.Research.HiddenSwitchCompiledReceipt*:*",
            "DOTNET_JitDisasmSummary": "1",
            "DOTNET_JitDisasmWithCodeBytes": "1",
            "DOTNET_JitStdOutFile": str(jit_path),
        }
        _write(attempt / "start.json", {
            "Kind": "graph-feasibility-start",
            "Host": str(host), "Dll": str(dll), "Arguments": [str(dll), "graph-hand", str(report_path)],
            "StartupEnvironment": environment,
            "OtherRuntimeEnvironmentKeys": sorted(key for key in os.environ if key.startswith(("DOTNET_", "COMPlus_", "CORECLR_", "COR_", "DYLD_")) and key not in environment),
            "LLDBVersion": debugger.GetVersionString(),
            "DeadlineSeconds": {"StartupReady": 60, "Interrupt": 10, "Exit": 30},
            "Completion": {"File": str(report_path) + ".complete", "NativeDeadlineSeconds": 120, "Meaning": "exclusive process-bound marker written only after capture while owned target is stopped"},
            "Scope": "launch support only, not attach support; no runtime admission or registered streams",
        })
        stage = "input-identity"
        helper = Path(__file__).resolve()
        root = helper.parents[2]
        project = helper.with_name("HiddenSwitchCompiled.fsproj")
        sources = [project, root / "Directory.Build.props", root / "Directory.Packages.props", root / "global.json", root / "src/Core/Result.fs"]
        for item in ET.fromstring(project.read_bytes()).iter("Compile"):
            source = (project.parent / item.attrib["Include"]).resolve()
            source.relative_to(root)
            sources.append(source)
        _write(attempt / "inputs.json", {"Files": [_file(host), _file(dll), _file(helper), _file(dll.with_suffix(".runtimeconfig.json")), _file(dll.with_suffix(".deps.json"))] + [_file(source) for source in sources], "SourceSnapshotMeaning": "working source bytes and observed built artifacts; not a source-to-binary theorem or published implementation archive"})
        stage = "launch"
        initial_async = debugger.GetAsync()
        debugger.SetAsync(True)
        target = debugger.CreateTarget(str(host))
        if not target.IsValid():
            raise RuntimeError("LLDB refused the exact host target")
        launch = lldb.SBLaunchInfo([str(dll), "graph-hand", str(report_path)])
        launch.SetWorkingDirectory(str(dll.parent))
        launch.SetEnvironmentEntries([f"{key}={value}" for key, value in environment.items()], True)
        if not launch.AddOpenFileAction(1, str(attempt / "stdout.log"), False, True):
            raise RuntimeError("stdout file action refused")
        if not launch.AddOpenFileAction(2, str(attempt / "stderr.log"), False, True):
            raise RuntimeError("stderr file action refused")
        error = lldb.SBError()
        process = target.Launch(launch, error)
        if not error.Success() or not process.IsValid():
            raise RuntimeError(f"LLDB process launch refused: {error}")
        stage = "startup-ready"
        report = _wait(process, lambda: _ready(report_path), 60, stage)
        _write(attempt / "ready-state.json", _state(process))
        if report["ProcessId"] != process.GetProcessID() or report["SourceDraws"] != 0:
            raise RuntimeError("native PID/source-draw binding differs")
        stage = "interrupt"
        process.SendAsyncInterrupt()
        _wait(process, lambda: process.GetState() == lldb.eStateStopped, 10, stage)
        _write(attempt / "stopped-state.json", _state(process))
        stage = "entry-prefixes"
        entries = _entries(target, process, report, attempt)
        _write(attempt / "entry-prefixes.json", entries)
        stage = "resume"
        completion = Path(str(report_path) + ".complete")
        _complete(completion, int(process.GetProcessID()))
        _write(attempt / "completion.json", _file(completion))
        error = process.Continue()
        if not error.Success():
            raise RuntimeError(f"resume refused: {error}")
        stage = "exit"
        _wait(process, lambda: process.GetState() == lldb.eStateExited, 30, stage)
        if process.GetExitStatus() != 0:
            raise RuntimeError(f"native graph process failed: {_state(process)}")
        outcome.update(Complete=True, Process=_state(process), EntryCount=len(entries), BodyAdmission="pending explicit stub resolution, complete spans and call-graph review")
        result.AppendMessage(f"graph feasibility prefixes retained at {attempt}; runtime not admitted")
    except Exception as error:
        outcome["Failure"] = {"Stage": stage, "Type": type(error).__name__, "Detail": str(error)}
        result.SetError(f"{stage}: {type(error).__name__}: {error}")
    finally:
        secondary = []
        def note(stage_name, operation):
            try:
                return operation()
            except Exception as error:
                secondary.append({"Stage": stage_name, "Type": type(error).__name__, "Detail": str(error)})
                return None
        valid = note("cleanup-valid", lambda: process is not None and process.IsValid())
        state = note("cleanup-state", lambda: process.GetState()) if valid else None
        if valid and state not in (lldb.eStateExited, lldb.eStateDetached):
            cleanup = note("cleanup-kill", lambda: process.Kill())
            end = time.monotonic() + 5
            while state not in (lldb.eStateExited, lldb.eStateDetached) and time.monotonic() < end:
                state = note("cleanup-join", lambda: process.GetState())
                if state is None:
                    break
                time.sleep(0.025)
            outcome["Cleanup"] = {"KillSuccess": note("cleanup-result", lambda: cleanup.Success()) if cleanup is not None else False, "Observed": note("cleanup-final-state", lambda: _state(process)), "JoinDeadlineSeconds": 5, "Scope": "owned LLDB process only; no general descendant isolation claim"}
            if state not in (lldb.eStateExited, lldb.eStateDetached):
                secondary.append({"Stage": "cleanup-join", "Type": "Incomplete", "Detail": "owned process did not reach a terminal state"})
        if initial_async is not None:
            note("restore-debugger-async", lambda: debugger.SetAsync(initial_async))
        if secondary:
            outcome["Complete"] = False
            outcome["SecondaryFailures"] = secondary
            note("report-secondary", lambda: result.SetError(f"secondary capture/cleanup refusal; retained primary outcome: {outcome}"))
        if owned_attempt:
            try:
                _write(attempt / "outcome.json", outcome)
            except Exception as error:
                try:
                    result.SetError(f"outcome retention failed: {error}; original outcome: {outcome}")
                except Exception:
                    print(f"outcome retention/reporting failed; original outcome: {outcome}")


def __lldb_init_module(debugger, _internal_dict):
    debugger.HandleCommand("command script add -f inspect_hidden_switch_graph.capture hs-graph")
