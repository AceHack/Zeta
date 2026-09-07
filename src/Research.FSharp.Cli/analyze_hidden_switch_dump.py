"""One gated, local-DAC query attempt for three physically bound hand methods."""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import queue
import re
import signal
import stat
import subprocess
import sys
import threading
import time
from pathlib import Path

from capture_hidden_switch_dump import identity, utc, write
from hidden_switch_dump_memory import MachCore
from inspect_hidden_switch_bodies import parse_blocks, stub_cell


class OutputLimitError(ValueError):
    """The retained output prefix reached a declared collector bound."""


class Session:
    STDOUT_LIMIT = 4 * 1024 * 1024
    AUXILIARY_LIMIT = 8 * 1024 * 1024
    QUEUE_LIMIT = 128
    LINE_LIMIT = 65536

    def __init__(self, tool, dump, attempt):
        self.attempt = attempt
        self.count = 0
        self.deadline = time.monotonic() + 120
        self.lines = queue.Queue(maxsize=self.QUEUE_LIMIT)
        self.reader_failure = None
        self.stdout_bytes = 0
        self.stdout_observed_bytes = 0
        self.reader_finished = threading.Event()
        self.publication_failures = []
        self.stdout = (attempt / "analyzer.stdout.log").open("xb")
        self.stderr = None
        self.process = None
        self.reader = None
        try:
            self.stderr = (attempt / "analyzer.stderr.log").open("xb")
            environment = os.environ.copy()
            removed = [key for key in ["HOME", "DOTNET_DIAGNOSTIC_EXTENSIONS"] if key in environment]
            for key in removed:
                environment.pop(key)
            environment.update({"COREHOST_TRACE": "1", "COREHOST_TRACEFILE": str(attempt / "analyzer-host.log")})
            args = [str(tool), "analyze", str(dump)]
            write(attempt / "analyzer-start.json", {"Arguments": args, "StartedAtUtc": utc(),
                  "RemovedEnvironmentKeys": removed, "ParentEnvironmentUnchanged": True,
                  "HostTrace": str(attempt / "analyzer-host.log"), "TotalDeadlineSeconds": 120, "CommandDeadlineSeconds": 15,
                  "StdoutByteLimit": self.STDOUT_LIMIT, "QueueLineLimit": self.QUEUE_LIMIT,
                  "LineByteLimit": self.LINE_LIMIT, "AuxiliaryFileByteLimit": self.AUXILIARY_LIMIT,
                  "AuxiliaryLimitScope": "stderr/host trace polled during commands and cleanup; not a filesystem quota; overshoot retained"})
            self.process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                            stderr=self.stderr, cwd=attempt, env=environment, start_new_session=True)
            self.reader = threading.Thread(target=self._read, daemon=True)
            self.reader.start()
        except BaseException:
            try:
                cleanup = self.close()
                write(attempt / "constructor-cleanup.json", {"CleanupFailures": cleanup})
            except Exception as error:  # noqa: BLE001 - do not replace constructor's primary failure
                self.publication_failures.append(str(error))
            raise

    def _read(self):
        try:
            while line := self.process.stdout.readline(self.LINE_LIMIT + 1):
                self.stdout_observed_bytes += len(line)
                retained = line[:max(0, self.STDOUT_LIMIT - self.stdout_bytes)]
                self.stdout.write(retained)
                self.stdout.flush()
                self.stdout_bytes += len(retained)
                if len(retained) != len(line) or len(line) > self.LINE_LIMIT:
                    raise OutputLimitError("stdout cumulative/line limit; exact available bounded prefix retained")
                try:
                    self.lines.put_nowait(line)
                except queue.Full as error:
                    raise OutputLimitError("stdout bounded queue filled; disk prefix retained") from error
        except Exception as error:  # noqa: BLE001 - report owned stream failure to main driver
            self.reader_failure = error
        finally:
            self.reader_finished.set()

    def check_output(self):
        if self.reader_failure is not None:
            raise self.reader_failure
        for name in ["analyzer.stderr.log", "analyzer-host.log"]:
            file = self.attempt / name
            if file.exists() and file.stat().st_size > self.AUXILIARY_LIMIT:
                raise OutputLimitError(name + " exceeded declared polled byte limit; overshoot retained")

    def command(self, command):
        index = self.count
        self.count += 1
        prefix = self.attempt / f"command-{index:02d}"
        write(Path(str(prefix) + ".json"), {"Command": command, "StartedAtUtc": utc()})
        if command is not None:
            self.process.stdin.write((command + "\n").encode("utf-8"))
            self.process.stdin.flush()
        deadline = min(self.deadline, time.monotonic() + 15)
        data = bytearray()
        complete = False
        primary = None
        try:
            while time.monotonic() < deadline:
                self.check_output()
                try:
                    line = self.lines.get(timeout=0.1)
                except queue.Empty:
                    if self.reader_finished.is_set():
                        self.check_output()
                        raise ValueError("analyzer EOF before command delimiter")
                    continue
                data.extend(line)
                if len(data) > 1024 * 1024 or len(line) > 65536:
                    raise ValueError("analyzer output exceeded declared command bound")
                if line.strip() == b"<END_COMMAND_ERROR>":
                    raise ValueError("analyzer command error delimiter")
                if line.strip() == b"<END_COMMAND_OUTPUT>":
                    complete = True
                    return data.decode("utf-8", errors="strict")
            raise TimeoutError("analyzer command exceeded bounded deadline")
        except BaseException as error:
            primary = error
            raise
        finally:
            suffix = ".txt" if complete else ".partial.txt"
            try:
                with Path(str(prefix) + suffix).open("xb") as stream:
                    stream.write(data)
                    stream.flush()
                    os.fsync(stream.fileno())
            except Exception as error:  # preserve established command failure
                self.publication_failures.append(str(error))
                if primary is None:
                    raise

    def close(self):
        errors = []
        reader_alive = False
        if self.process is not None:
            try:
                if self.process.poll() is None:
                    self.process.stdin.write(b"exit\n")
                    self.process.stdin.flush()
                    deadline = time.monotonic() + 5
                    while self.process.poll() is None and time.monotonic() < deadline:
                        self.check_output()
                        time.sleep(0.05)
                    if self.process.poll() is None:
                        raise TimeoutError("analyzer did not exit within cleanup deadline")
            except Exception as error:  # noqa: BLE001 - all exit/report failures still reach owned kill
                errors.append(str(error))
            if self.process.poll() is None:
                try:
                    with contextlib.suppress(ProcessLookupError):
                        os.killpg(self.process.pid, signal.SIGKILL)
                except OSError as error:
                    errors.append(str(error))
                try:
                    self.process.wait(timeout=5)
                except subprocess.SubprocessError as error:
                    errors.append(str(error))
            if self.reader is not None:
                try:
                    self.reader.join(timeout=5)
                except RuntimeError as error:
                    errors.append(str(error))
                reader_alive = self.reader.is_alive()
                if reader_alive:
                    errors.append("analyzer stdout reader did not finish")
            for pipe in [self.process.stdin] + ([] if reader_alive else [self.process.stdout]):
                if pipe is not None:
                    try:
                        pipe.close()
                    except OSError as error:
                        errors.append(str(error))
            try:
                self.check_output()
            except Exception as error:  # noqa: BLE001 - retain final output bound/reader failure
                errors.append(str(error))
            if self.process.returncode != 0:
                errors.append(f"analyzer exit was {self.process.returncode}")
        # A failed join cannot justify closing streams still owned by a reader.
        # Retain that cleanup failure instead of blocking on another thread's lock.
        for file in ([] if reader_alive else [self.stdout]) + [self.stderr]:
            if file is not None:
                try:
                    file.close()
                except OSError as error:
                    errors.append(str(error))
        return errors


def metadata(info):
    return {"Device": info.st_dev, "Inode": info.st_ino, "Size": info.st_size,
            "Mode": info.st_mode, "MtimeNs": info.st_mtime_ns, "CtimeNs": info.st_ctime_ns}


def unchanged_descriptor(stream, path, expected):
    if metadata(os.fstat(stream.fileno())) != expected or metadata(path.stat()) != expected:
        raise ValueError("held dump descriptor or its pathname metadata changed")


def descriptor_identity(stream, path, expected):
    info = os.fstat(stream.fileno())
    if not stat.S_ISREG(info.st_mode):
        raise ValueError("dump descriptor is not a regular file")
    expected_size = expected["Bytes"]
    if type(expected_size) is not int or not 0 < expected_size <= 8 * 1024**3 or info.st_size != expected_size:
        raise ValueError("dump initial size differs from admitted captured size/bound")
    snapshot = metadata(info)
    digest = hashlib.sha256()
    stream.seek(0)
    remaining = expected_size
    deadline = time.monotonic() + 120
    while remaining:
        if time.monotonic() >= deadline:
            raise TimeoutError("dump hashing exceeded its checked 120-second deadline")
        block = stream.read(min(1024 * 1024, remaining))
        if not block or len(block) > remaining:
            raise ValueError("dump read did not preserve admitted captured size")
        digest.update(block)
        remaining -= len(block)
    if time.monotonic() >= deadline:
        raise TimeoutError("dump hashing exceeded its checked 120-second deadline")
    if stream.read(1):
        raise ValueError("dump grew past admitted captured size")
    actual = {"File": str(path), "Bytes": info.st_size, "Sha256": digest.hexdigest().upper()}
    unchanged_descriptor(stream, path, snapshot)
    if actual != expected:
        raise ValueError("held local-only dump differs from captured byte identity")
    stream.seek(0)
    return snapshot


def admit_tool(tool, pins):
    resolved = tool.resolve(strict=True)
    matching = [pin for pin in pins if pin["File"] == str(resolved) and resolved.name == "dotnet-dump"]
    if len(matching) != 1 or identity(resolved) != matching[0]:
        raise ValueError("actual analyzer launch executable is not the captured tool identity")
    return resolved


def command_payload(text, command):
    lines = text.splitlines()
    if not lines or lines[0] != "> " + command or lines[-1] != "<END_COMMAND_OUTPUT>":
        raise ValueError("missing exact command echo or terminal marker")
    payload = lines[1:-1]
    if any(line.startswith(("> ", "<END_COMMAND_")) for line in payload):
        raise ValueError("duplicate command echo or embedded terminal marker")
    return payload


def empty_symbols(text, command):
    lines = [line for line in command_payload(text, command) if line]
    if lines != ["Current symbol store settings:"]:
        raise ValueError("symbol-store output does not prove an empty store")


def admit_clrpath(text, runtime, setting):
    command = "setclrpath " + str(runtime) if setting else "setclrpath"
    expected = ("Set load path for DAC/DBI to '" if setting else "Load path for DAC/DBI: '") + str(runtime) + "'"
    if [line for line in command_payload(text, command) if line] != [expected]:
        raise ValueError("local DAC path acknowledgement differs from exact declared grammar")


def one_field(lines, name):
    values = [line.split(":", 1)[1].strip() for line in lines
              if re.fullmatch(r"\s*" + re.escape(name) + r":.*", line)]
    if len(values) != 1:
        raise ValueError("missing/duplicate anchored field: " + name)
    return values[0]


def admit_runtime(text, runtime, require_dac):
    lines = command_payload(text, "runtimes")
    headers = [line for line in lines if re.match(r"^\*?#\d+ ", line)]
    if len(headers) != 1 or not re.fullmatch(r"#\d+ \.NET Core runtime .+ at [0-9A-Fa-f]{16} size [0-9A-Fa-f]{8} index .+", headers[0]):
        raise ValueError("runtime metadata does not name one ordinary .NET Core runtime")
    if one_field(lines, "Runtime module path") != str(runtime / "libcoreclr.dylib") or one_field(lines, "Runtime module directory") != str(runtime):
        raise ValueError("runtime metadata paths differ from pinned target runtime")
    if require_dac:
        dac = one_field(lines, "DAC")
        if dac not in [str(runtime / "libmscordaccore.dylib") + suffix for suffix in [" (verify)", " (don't verify)"]]:
            raise ValueError("cached DAC metadata differs from exact local path/verification grammar")
        return dac
    return None


def admit_method(text, method, body):
    lines = command_payload(text, f"ip2md {body:016X}")
    name = one_field(lines, "Name")
    if not re.fullmatch(re.escape(method["Type"] + "." + method["Name"]) + r"\([^\r\n]*\)", name):
        raise ValueError("DAC method name is not the exact selected method signature")
    code, token = one_field(lines, "CodeAddr"), one_field(lines, "mdToken")
    if not re.fullmatch(r"(?:0x)?[0-9a-fA-F]+", code) or not re.fullmatch(r"(?:0x)?[0-9a-fA-F]+", token) or int(code, 16) != body or int(token, 16) != method["Token"]:
        raise ValueError("DAC method token/code address differs from physical candidate")




def physical_method(memory, method, block, attempt):
    name = method["Name"]
    address = int(method["Callable"], 16)
    stub, stub_record = memory.read(address, 8)
    write(attempt / f"physical-{name}-stub.json", {"Method": method, "Stub": stub_record})
    cell = stub_cell(stub, address)
    pointer, cell_record = memory.read(cell, 8)
    write(attempt / f"physical-{name}-cell.json", {"Method": method, "Cell": cell_record})
    body = int.from_bytes(pointer, "little")
    if body % 4:
        raise ValueError("resolved body is not ARM64 aligned")
    raw, body_record = memory.read(body, block["Bytes"])
    write(attempt / f"physical-{name}-body.json", {"Method": method, "Body": body_record})
    row = {"Method": method, "Stub": stub_record, "Cell": cell_record, "Body": body_record,
           "CompilerBytes": block["Bytes"], "CompilerSha256": hashlib.sha256(bytes.fromhex(block["Hex"])).hexdigest().upper(),
           "CompilerMatchesPhysical": raw.hex().upper() == block["Hex"], "BodyResolved": False}
    write(attempt / f"physical-{name}.json", row)
    if not row["CompilerMatchesPhysical"]:
        raise ValueError("physical body bytes differ from compiler-declared candidate")
    return body


def run(capture, attempt, tool):
    session = None
    dump_stream = None
    dump_snapshot = None
    owned = False
    stage = "attempt-create"
    result = {"Kind": "offline-extent-feasibility", "Complete": False, "Failure": None,
              "RuntimeAdmitted": False, "BodyResolved": False, "ClosureAdmitted": False}
    try:
        os.mkdir(attempt)
        owned = True
        write(attempt / "start.json", {**result, "StartedAtUtc": utc(),
              "MethodRoster": ["predict", "condition", "select"], "MethodType": "Zeta.Research.HiddenSwitchPolicy",
              "HashDeadlineSeconds": 120, "HashDeadlineScope": "checked between bounded regular-file reads; not a kernel I/O cancellation guarantee",
              "DumpPremise": "held descriptor hashes and physical reads; stable immutable local file/path during analyzer's separate open; no hostile namespace or in-place-write snapshot guarantee"})
        stage = "capture-identity"
        captured = json.loads((capture / "outcome.json").read_text())
        dump = capture / "graph.core"
        if captured.get("Complete") is not True or captured.get("InputsUnchanged") is not True or captured.get("CleanupFailures") != []:
            raise ValueError("requires a complete unchanged owned capture")
        dump_stream = dump.open("rb")
        dump_snapshot = descriptor_identity(dump_stream, dump, captured["LocalOnlyDump"])
        write(attempt / "dump-descriptor.json", dump_snapshot)
        ready = json.loads((capture / "ready-observed.json").read_text())["Ready"]
        inputs = json.loads((capture / "inputs.json").read_text())
        for pin in inputs["Pins"]:
            if identity(Path(pin["File"])) != pin:
                raise ValueError("captured source/tool/runtime input changed")
        tool = admit_tool(tool, inputs["Pins"])
        write(attempt / "launch-tool.json", identity(tool))
        helpers = [Path(__file__).resolve(), Path(__file__).with_name("hidden_switch_dump_memory.py"),
                   Path(__file__).with_name("inspect_hidden_switch_bodies.py")]
        write(attempt / "inputs.json", {"LocalOnlyDump": captured["LocalOnlyDump"],
              "Helpers": [identity(path) for path in helpers], "CaptureMetadata": [identity(capture / name) for name in ["outcome.json", "ready-observed.json", "inputs.json", "jit.log"]]})
        stage = "physical-method-backing"
        blocks = parse_blocks((capture / "jit.log").read_text())
        methods = []
        if dump_stream is not None:
            memory = MachCore(dump_stream, dump_snapshot["Size"])
            write(attempt / "physical-format.json", memory.header)
            for name in ["predict", "condition", "select"]:
                entries = [entry for entry in ready["Methods"] if entry["Type"] == "Zeta.Research.HiddenSwitchPolicy" and entry["Name"] == name]
                candidates = [block for block in blocks if block["Name"].startswith("Zeta.Research.HiddenSwitchPolicy:" + name + "(")]
                if len(entries) != 1 or entries[0]["Prepared"] is not True or len(candidates) != 1:
                    raise ValueError("declared method lacks unique prepared entry and compiler block")
                method, block = entries[0], candidates[0]
                methods.append((method, physical_method(memory, method, block, attempt)))
        unchanged_descriptor(dump_stream, dump, dump_snapshot)
        stage = "analyzer-start"
        session = Session(tool, dump, attempt)
        session.command(None)
        stage = "symbols-disable"
        empty_symbols(session.command("setsymbolserver -disable"), "setsymbolserver -disable")
        empty_symbols(session.command("setsymbolserver"), "setsymbolserver")
        stage = "local-dac-path"
        runtime = Path("/Users/acehack/.local/share/mise/dotnet-root/shared/Microsoft.NETCore.App/10.0.11")
        admit_clrpath(session.command("setclrpath " + str(runtime)), runtime, True)
        admit_clrpath(session.command("setclrpath"), runtime, False)
        stage = "runtime-before"
        admit_runtime(session.command("runtimes"), runtime, False)
        for method, body in methods:
            stage = "ip2md-" + method["Name"]
            info = session.command(f"ip2md {body:016X}")
            admit_method(info, method, body)
            stage = "clru-" + method["Name"]
            disassembly = session.command(f"clru -n -o {body:016X}")
            payload = command_payload(disassembly, f"clru -n -o {body:016X}")
            if not any(re.fullmatch(re.escape(method["Type"] + "." + method["Name"]) + r"\([^\r\n]*\)", line.strip()) for line in payload):
                raise ValueError("disassembly does not name the selected method/address")
        stage = "runtime-after"
        after = session.command("runtimes")
        dac = runtime / "libmscordaccore.dylib"
        cached_dac = admit_runtime(after, runtime, True)
        write(attempt / "dac-observed.json", {"Identity": identity(dac), "TargetRuntime": str(runtime), "CachedDacLine": cached_dac,
              "Scope": "cached path and file identity only; analyzer acceptance is not proof of source/binary/version equivalence"})
        result["Complete"] = True
        result["Scope"] = "three bound method queries captured; complete extent interpretation and executing closure remain independent review obligations"
    except Exception as error:  # noqa: BLE001 - preserve exact bounded diagnostic refusal
        result["Failure"] = {"Stage": stage, "Code": type(error).__name__, "Detail": str(error)}
    finally:
        cleanup = []
        if session is not None:
            try:
                cleanup = session.close()
            except Exception as error:  # noqa: BLE001 - cleanup cannot replace primary failure
                cleanup.append(str(error))
            result["CommandPublicationFailures"] = session.publication_failures
        if dump_stream is not None:
            try:
                if dump_snapshot is not None:
                    unchanged_descriptor(dump_stream, capture / "graph.core", dump_snapshot)
            except Exception as error:  # noqa: BLE001 - retain post-analysis identity refusal
                cleanup.append(str(error))
            finally:
                try:
                    dump_stream.close()
                except OSError as error:
                    cleanup.append(str(error))
        if session is not None:
            result["OutputCapture"] = {"ObservedStdoutBytes": session.stdout_observed_bytes,
                                       "RetainedStdoutBytes": session.stdout_bytes,
                                       "ReaderFailure": None if session.reader_failure is None else str(session.reader_failure)}
        result["CleanupFailures"] = cleanup
        if cleanup:
            result["Complete"] = False
            if result["Failure"] is None:
                result["Failure"] = {"Stage": "cleanup", "Code": "CleanupError", "Detail": "; ".join(cleanup)}
        result["FinishedAtUtc"] = utc()
        if owned:
            try:
                write(attempt / "outcome.json", result)
            except Exception as error:  # noqa: BLE001 - preserve primary diagnostic error on storage failure
                result["Complete"] = False
                result["PublicationFailure"] = str(error)
        print(json.dumps(result))
    return 0 if result["Complete"] else 2


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("requires captured dump directory, absent analysis directory and exact dotnet-dump executable")
    raise SystemExit(run(*(Path(value).absolute() for value in sys.argv[1:])))
