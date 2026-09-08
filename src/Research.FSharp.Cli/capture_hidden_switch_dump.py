"""One local-only nonregistered graph dump; no debugger or memory analysis."""

from __future__ import annotations

import contextlib
import datetime
import hashlib
import json
import os
import shutil
import signal
import stat
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path


def utc():
    return datetime.datetime.now(datetime.UTC).isoformat()


def identity(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return {"File": str(path), "Bytes": path.stat().st_size,
            "Sha256": digest.hexdigest().upper()}


def write(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())


def custody_copy(source, destination):
    """Same regular descriptor supplies bytes/hash; explicit owned close retains first error."""
    original = copied = None
    primary = None
    cleanup = []
    result = None
    try:
        original = source.open("rb")
        before = os.fstat(original.fileno())
        if not stat.S_ISREG(before.st_mode) or not 0 < before.st_size <= 64 * 1024**2:
            raise ValueError("target custody requires a regular nonempty file of at most 64 MiB")
        digest = hashlib.sha256()
        remaining = before.st_size
        deadline = time.monotonic() + 10
        copied = destination.open("xb")
        while remaining:
            if time.monotonic() >= deadline:
                raise TimeoutError("target custody copy exceeded checked ten-second deadline")
            raw = original.read(min(1024 * 1024, remaining))
            if not raw:
                raise ValueError("target custody source became short")
            copied.write(raw)
            digest.update(raw)
            remaining -= len(raw)
        copied.flush()
        os.fsync(copied.fileno())
        after = os.fstat(original.fileno())
        fields = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")
        if original.read(1) or any(getattr(before, key) != getattr(after, key) for key in fields):
            raise ValueError("target custody descriptor changed during copy; partial copy retained")
        observed = source.stat()
        if any(getattr(before, key) != getattr(observed, key) for key in fields):
            raise ValueError("target custody pathname changed during copy; copied bytes retained")
        pin = {"File": str(source), "Bytes": before.st_size, "Sha256": digest.hexdigest().upper()}
        expected = {**pin, "File": str(destination)}
        if identity(destination) != expected:
            raise ValueError("exclusive target custody copy differs from captured bytes")
        result = {"Original": pin, "Copy": expected}

    except Exception as error:  # noqa: BLE001 - retain the first actual copy refusal
        primary = error
    finally:
        for name, stream in [("copy", copied), ("original", original)]:
            if stream is not None:
                try:
                    stream.close()
                except Exception as error:  # noqa: BLE001 - close exactly once without hiding the copy failure
                    cleanup.append({"Resource": name, "Code": type(error).__name__, "Detail": str(error)[:4096]})
        if cleanup and primary is None:
            primary = OSError("target custody cleanup failed after copy")
        if primary is not None:
            primary.custody_cleanup = cleanup
            raise primary
    return result


def target_custody(dll, attempt):
    directory = attempt / "target-files"
    os.mkdir(directory)
    files = sorted(dll.parent.glob("*.dll")) + [dll.with_suffix(".runtimeconfig.json"), dll.with_suffix(".deps.json")]
    if dll not in files or not 0 < len(files) <= 64 or len({p.name for p in files}) != len(files):
        raise ValueError("target custody requires a unique finite adjacent module/config roster")
    rows = []
    for index, source in enumerate(files):
        try:
            row = custody_copy(source, directory / source.name)
        except Exception as error:
            try:
                write(attempt / f"target-custody-{index:02d}-failure.json", {
                      "Source": str(source), "Code": type(error).__name__, "Detail": str(error)[:4096],
                      "CleanupFailures": getattr(error, "custody_cleanup", [])})
            except Exception as reporting:  # noqa: BLE001 - reporting cannot replace the established copy failure
                error.custody_reporting = {"Code": type(reporting).__name__, "Detail": str(reporting)[:4096]}
            raise
        rows.append(row)
        write(attempt / f"target-custody-{index:02d}.json", row)
    write(attempt / "target-custody.json", {"Records": rows,
          "Scope": "exclusive copies of exact adjacent target DLL/config bytes before launch; stable writer paths through analysis, not hostile namespace or in-place-write isolation"})
    return rows


def stop_owned(process):
    """Each child starts its own session; cleanup only that owned process group."""
    if process is not None and process.poll() is None:
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGKILL)
        process.wait(timeout=5)


def capture(host, dll, tool, attempt):
    target = collector = None
    owned = False
    cleanup = []
    stage = "attempt-create"
    outcome = {"Kind": "graph-dump-feasibility", "Complete": False,
               "RuntimeAdmitted": False, "BodyResolved": False,
               "ClosureAdmitted": False, "SourceDraws": 0, "Failure": None}
    dump = attempt / "graph.core"
    try:
        os.mkdir(attempt)
        owned = True
        write(attempt / "start.json", {**outcome, "StartedAtUtc": utc(),
              "TimeoutSeconds": {"Ready": 30, "Collect": 60, "TargetExit": 5},
              "ObservedDumpByteLimit": 8 * 1024**3,
              "LimitScope": "polled size refusal, not a filesystem quota; retain any overshoot/partial"})
        stage = "input-identities"
        if shutil.disk_usage(attempt).free < 12 * 1024**3:
            raise ValueError("requires 12 GiB available before the one owned dump attempt")
        runtime = host.parent / "shared/Microsoft.NETCore.App/10.0.11"
        inputs = [host, dll, Path(__file__).resolve(),
                  runtime / "libcoreclr.dylib", runtime / "libclrjit.dylib",
                  runtime / "libmscordaccore.dylib", tool.resolve()]
        inputs.extend(sorted(p for p in dll.parent.glob("*.dll") if p != dll))
        inputs.extend([dll.with_suffix(".runtimeconfig.json"), dll.with_suffix(".deps.json")])
        tool_package = tool.parent / ".store/dotnet-dump/9.0.661903/dotnet-dump/9.0.661903/tools/net8.0/any"
        inputs.extend(sorted(tool_package.glob("*.dll")))
        inputs.extend([tool_package / "dotnet-dump.runtimeconfig.json", tool_package / "dotnet-dump.deps.json"])
        inputs.extend(sorted((tool_package / "osx-arm64").glob("*.dylib")))
        host_candidates = []
        for version in ["8.0.0", "10.0.11"]:
            candidate = host.parent / "shared/Microsoft.NETCore.App" / version
            host_candidates.extend([candidate / name for name in ["libcoreclr.dylib", "libclrjit.dylib", "libhostpolicy.dylib"]])
        inputs.extend(host_candidates)
        root = Path(__file__).resolve().parents[2]
        project = root / "src/Research.FSharp.Cli/HiddenSwitchCompiled.fsproj"
        inputs.append(project)
        inputs.extend((project.parent / item.attrib["Include"]).resolve()
                      for item in ET.parse(project).iter("Compile"))
        custody = target_custody(dll, attempt)
        pins = [identity(p) for p in inputs]
        if any(row["Original"] not in pins for row in custody):
            raise ValueError("target custody differs from independently recorded prelaunch pins")
        flags = {"DOTNET_TieredCompilation": "0", "DOTNET_TieredPGO": "0", "DOTNET_ReadyToRun": "0",
                 "DOTNET_JitDisasm": "Zeta.Research.HiddenSwitchPolicy*:* Zeta.Research.HiddenSwitchCompiledPolicy*:* Zeta.Research.HiddenSwitchObservation*:* Zeta.Research.HiddenSwitchCompiledReceipt*:* Zeta.Research.HiddenSwitchCompiledSelector*:* Zeta.Research.HiddenSwitchCompiledCertificate:depth* Zeta.Research.HiddenSwitchCompiledGraph:prepare* Zeta.Research.HiddenSwitchCompiledGraph+prepare*:*",
                 "DOTNET_JitDisasmSummary": "1", "DOTNET_JitDisasmWithCodeBytes": "1",
                 "DOTNET_JitStdOutFile": str(attempt / "jit.log")}
        env = os.environ.copy()
        env.update(flags)
        native = attempt / "native.jsonl"
        target_args = [str(host), str(dll), "graph-hand", str(native)]
        collect_args = [str(tool), "collect", "--process-id", "PENDING", "--type", "Full", "--output", str(dump)]
        collector_flags = {"COREHOST_TRACE": "1", "COREHOST_TRACEFILE": str(attempt / "collector-host.log")}
        collector_env = os.environ.copy()
        collector_env.update(collector_flags)
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True, timeout=10).strip()
        write(attempt / "inputs.json", {"SourceCommit": commit, "Pins": pins,
              "TargetArguments": target_args, "StartupOverrides": flags, "TargetCustody": custody,
              "CollectorHostOverrides": collector_flags,
              "CollectorHostMeaning": "tool apphost/package and possible installed runtimes pinned separately; actual host selection requires retained host trace, not the target 10.0.11 label",
              "OtherRuntimeEnvironmentKeys": sorted(k for k in env if k.startswith(("DOTNET_", "COMPlus_", "CORECLR_", "COR_", "DYLD_")) and k not in flags),
              "Scope": "ready addresses precede IPC dump; the dump must rebind pointers/code, not a claimed identical LLDB stop"})
        stage = "target-launch"
        with contextlib.ExitStack() as files:
            out = files.enter_context((attempt / "target.stdout.log").open("xb"))
            err = files.enter_context((attempt / "target.stderr.log").open("xb"))
            target = subprocess.Popen(target_args, stdout=out, stderr=err, env=env, cwd=attempt, start_new_session=True)
            write(attempt / "target-started.json", {"ProcessId": target.pid, "StartedAtUtc": utc()})
            stage = "target-ready"
            deadline = time.monotonic() + 30
            ready = None
            while time.monotonic() < deadline:
                if target.poll() is not None:
                    raise ValueError(f"target exited before ready: {target.returncode}")
                if native.exists():
                    raw = native.read_bytes()
                    for line in raw.split(b"\n")[:-1]:
                        value = json.loads(line)
                        if value.get("Kind") == "graph-hand-ready":
                            ready = value
                if ready is not None:
                    break
                time.sleep(0.05)
            if ready is None or ready.get("ProcessId") != target.pid or ready.get("Complete") is not True:
                raise ValueError("missing complete ready record naming the owned target")
            write(attempt / "ready-observed.json", {"ObservedAtUtc": utc(), "ProcessId": target.pid,
                  "Ready": ready, "TargetStoppedByLLDB": False})
            stage = "dump-collect"
            collect_args[3] = str(target.pid)
            write(attempt / "collect-start.json", {"Arguments": collect_args, "StartedAtUtc": utc(),
                  "TargetContinuesReadyWait": True, "LocalOnlyDump": True})
            cout = files.enter_context((attempt / "collect.stdout.log").open("xb"))
            cerr = files.enter_context((attempt / "collect.stderr.log").open("xb"))
            collector = subprocess.Popen(collect_args, stdout=cout, stderr=cerr, env=collector_env, cwd=attempt, start_new_session=True)
            deadline = time.monotonic() + 60
            while collector.poll() is None:
                if time.monotonic() >= deadline:
                    raise TimeoutError("owned dump collection exceeded 60 seconds")
                if dump.exists() and dump.stat().st_size > 8 * 1024**3:
                    raise ValueError("observed dump exceeded the declared 8 GiB size limit")
                if target.poll() is not None:
                    raise ValueError("target exited during dump collection")
                time.sleep(0.1)
            write(attempt / "collect-finished.json", {"ExitCode": collector.returncode, "FinishedAtUtc": utc(),
                  "DumpBytes": dump.stat().st_size if dump.exists() else None})
            if collector.returncode != 0 or not dump.exists() or not 0 < dump.stat().st_size <= 8 * 1024**3:
                raise ValueError("collection did not produce a nonempty bounded dump with exit zero")
            stage = "target-completion"
            with Path(str(native) + ".complete").open("xb") as marker:
                marker.write(f"graph-capture-complete:{target.pid}\n".encode("ascii"))
                marker.flush()
                os.fsync(marker.fileno())
            target.wait(timeout=5)
            if target.returncode != 0:
                raise ValueError(f"owned target failed after completion: {target.returncode}")
            finished = [json.loads(line) for line in native.read_text().splitlines()
                        if json.loads(line).get("Kind") == "graph-hand-finished"]
            if len(finished) != 1 or finished[0].get("ProcessId") != target.pid or finished[0].get("Complete") is not True or finished[0].get("GuardPinReleased") is not True:
                raise ValueError("target did not retain its pin-release completion record")
            outcome["Complete"] = True
        stage = "post-target-identities"
        outcome["InputsUnchanged"] = all(identity(Path(pin["File"])) == pin for pin in pins)
        outcome["TargetCustodyUnchanged"] = all(identity(Path(row["Copy"]["File"])) == row["Copy"] for row in custody)
        if not outcome["TargetCustodyUnchanged"]:
            raise ValueError("one or more exclusive target custody copies changed")
        if not outcome["InputsUnchanged"]:
            raise ValueError("one or more pinned input bytes changed")
    except Exception as error:  # noqa: BLE001 - owned CLI boundary retains unexpected failure before cleanup
        outcome["Complete"] = False
        outcome["Failure"] = {"Stage": stage, "Code": type(error).__name__, "Detail": str(error)}
        outcome["CustodyCleanupFailures"] = getattr(error, "custody_cleanup", [])
        outcome["CustodyReportingFailure"] = getattr(error, "custody_reporting", None)
    finally:
        for name, process in [("collector", collector), ("target", target)]:
            try:
                stop_owned(process)
            except Exception as error:  # noqa: BLE001 - cleanup must not replace the primary failure
                cleanup.append({"Process": name, "Code": type(error).__name__, "Detail": str(error)})
        if cleanup:
            outcome["Complete"] = False
        outcome["CleanupFailures"] = cleanup
        outcome["FinishedAtUtc"] = utc()
        if owned:
            try:
                if dump.exists() and not cleanup:
                    # Post-direct-child snapshot, not general descendant quiescence.
                    # Hash after owned target/collector exit; never load or emit
                    # dump memory. Raw bytes remain local-only, including failures.
                    outcome["LocalOnlyDump"] = identity(dump)
                elif dump.exists():
                    outcome["LocalOnlyDump"] = {"File": str(dump), "Bytes": dump.stat().st_size,
                                                "Sha256": None, "Failure": "cleanup did not establish quiescence"}
            except Exception as error:  # noqa: BLE001 - preserve terminal publication refusal
                outcome["Complete"] = False
                outcome["DumpIdentityFailure"] = {"Stage": "dump-identity", "Code": type(error).__name__, "Detail": str(error)}
                if outcome["Failure"] is None:
                    outcome["Failure"] = outcome["DumpIdentityFailure"]
            try:
                write(attempt / "outcome.json", outcome)
            except Exception as error:  # noqa: BLE001 - retain failure even if terminal storage fails
                outcome["Complete"] = False
                outcome["PublicationFailure"] = {"Code": type(error).__name__, "Detail": str(error)}
        print(json.dumps(outcome))
    return 0 if outcome["Complete"] else 2


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit("requires exact host, DLL, dotnet-dump executable and absent attempt directory")
    raise SystemExit(capture(*(Path(value).absolute() for value in sys.argv[1:])))
