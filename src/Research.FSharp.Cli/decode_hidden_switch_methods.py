"""Finite LLVM byte decoding of already physically matched method records; never opens a dump."""
from __future__ import annotations

import contextlib
import hashlib
import json
import os
import re
import signal
import stat
import subprocess
import sys
import time
from pathlib import Path

from capture_hidden_switch_dump import utc, write
from inspect_hidden_switch_bodies import parse_blocks
from probe_hidden_switch_metadata import output_admission, wait_helper

MANIFEST_BYTES = 289614
MANIFEST_SHA = "7C130526CB7981E209A5EF31AADA60194269BDE63213A1C4F91C3CCD25CBFE21"
TOOL_PINS = [
    ("/opt/homebrew/Cellar/llvm/23.1.0/bin/llvm-mc", 107432, "1E6100F8891F7C1F27DAF80CE98A5962331B555CEB7821E61C68211C40FD03D0"),
    ("/opt/homebrew/Cellar/llvm/23.1.0/lib/libLLVM.23.1.dylib", 169150736, "407F3A39E56A727EA161E95767EAFD96BDCD09071638F583BEFF0106BFFA34F5"),
    ("/opt/homebrew/Cellar/z3/5.1.0/lib/libz3.5.1.0.0.dylib", 15730544, "45344D6A38B6F75304433C2458D6FA16BC4907D426C96E2BEDF0A90603460422"),
    ("/opt/homebrew/Cellar/zstd/1.5.7_1/lib/libzstd.1.5.7.dylib", 649648, "E2847C4613B386683C234913AE3B7B04299254096CAF7616E3B3CD9BB97A39AB"),
]
MAX64 = (1 << 64) - 1
DECODER_FEATURES = ["+rcpc"]


def decoder_arguments():
    return [TOOL_PINS[0][0], "--disassemble", "--triple=aarch64-apple-darwin", "--mcpu=generic",
            "--mattr=" + ",".join(DECODER_FEATURES), "--show-encoding"]


@contextlib.contextmanager
def regular_stream(path, limit):
    """Nonblocking regular-descriptor admission; secondary close failure cannot mask a primary read failure."""
    flags = os.O_RDONLY | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    stream = None
    primary = None
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or not 0 <= before.st_size <= limit:
            raise ValueError("requires a regular local file within its finite size bound")
        stream = os.fdopen(fd, "rb"); fd = None
        yield stream, before
    except Exception as error:  # keep original read/admission error through descriptor close
        primary = error
        raise
    finally:
        try:
            if stream is not None:
                stream.close()
            elif fd is not None:
                os.close(fd)
        except Exception as error:  # cleanup-only failure refuses; primary remains first
            if primary is None:
                raise
            primary.add_note("secondary descriptor close: " + type(error).__name__ + ": " + str(error)[:1024])


def chunks(stream, before):
    remaining = before.st_size
    deadline = time.monotonic() + 10
    while remaining:
        if time.monotonic() >= deadline:
            raise TimeoutError("checked ten-second local-read deadline exceeded")
        raw = stream.read(min(1024**2, remaining))
        if not raw:
            raise ValueError("local file became short during reading")
        remaining -= len(raw)
        yield raw
    if time.monotonic() >= deadline:
        raise TimeoutError("checked ten-second local-read deadline exceeded")
    if stream.read(1):
        raise ValueError("local file grew while read")
    after = os.fstat(stream.fileno())
    if (before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (after.st_size, after.st_mtime_ns, after.st_ctime_ns):
        raise ValueError("held local file metadata changed while read")


def identity(path):
    with regular_stream(path, 256 * 1024**2) as (stream, before):
        digest = hashlib.sha256()
        for raw in chunks(stream, before):
            digest.update(raw)
    return {"File": str(path), "Bytes": before.st_size, "Sha256": digest.hexdigest().upper()}


def bounded_raw(path, limit):
    with regular_stream(path, limit) as (stream, before):
        return b"".join(chunks(stream, before))


def cleanup(process, streams):
    failures = []
    status = None
    if process is not None:
        try:
            running = process.poll() is None
        except Exception as error:  # noqa: BLE001 - failed status cannot bypass owned termination/closure
            failures.append({"Stage": "process-status", "Code": type(error).__name__, "Detail": str(error)[:4096]})
            running = True
        if running:
            try:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)
            except Exception as error:  # noqa: BLE001 - still attempt bounded join after a failed signal
                failures.append({"Stage": "process-kill", "Code": type(error).__name__, "Detail": str(error)[:4096]})
            try:
                process.wait(timeout=5)
            except Exception as error:  # noqa: BLE001 - stream close attempts still follow failed join
                failures.append({"Stage": "process-join", "Code": type(error).__name__, "Detail": str(error)[:4096]})
        try:
            status = {"ProcessId": process.pid, "ExitCode": process.returncode}
        except Exception as error:  # noqa: BLE001 - status reporting cannot skip terminal outcome
            failures.append({"Stage": "final-status", "Code": type(error).__name__, "Detail": str(error)[:4096]})
    for name, stream in streams:
        if stream is not None:
            try:
                stream.close()
            except Exception as error:  # noqa: BLE001 - every close is attempted once
                failures.append({"Stage": name, "Code": type(error).__name__, "Detail": str(error)[:4096]})
    return failures, status


def publish_terminal(attempt, outcome):
    try:
        write(attempt / "outcome.json", outcome)
    except Exception as error:  # noqa: BLE001 - retain primary refusal despite terminal storage failure
        outcome["Complete"] = False
        outcome["PublicationFailure"] = {"Code": type(error).__name__, "Detail": str(error)[:4096]}
    try:
        print(json.dumps({key: value for key, value in outcome.items() if key not in ["CompletedMethods", "ActiveDecodedPrefix"]}))
    except Exception as error:  # noqa: BLE001 - console failure is secondary, never the primary decoder failure
        outcome["Complete"] = False
        outcome["ConsoleFailure"] = {"Code": type(error).__name__, "Detail": str(error)[:4096]}
        try:
            write(attempt / "reporting-failure.json", outcome)
        except Exception as secondary:  # noqa: BLE001 - both failed channels preclude durable reporting; keep status in memory
            outcome["SecondaryPublicationFailure"] = {"Code": type(secondary).__name__, "Detail": str(secondary)[:4096]}


def checked_word(role, base, offset, raw):
    if (type(base) is not int or type(offset) is not int or base <= 0 or offset < 0
            or base % 4 or offset % 4 or len(raw) != 4 or base + offset > MAX64 - 4):
        raise ValueError("requires one aligned four-byte word at a checked runtime address")
    return {"Role": role, "Offset": offset, "Address": f"{base + offset:016X}", "Hex": raw.hex().upper()}


def atomic_input(words):
    if any(not re.fullmatch(r"[0-9A-F]{8}", row["Hex"]) for row in words):
        raise ValueError("atomic decoder input requires canonical four-byte words")
    return ("\n".join("[" + " ".join(f"0x{byte:02x}" for byte in bytes.fromhex(row["Hex"])) + "]" for row in words) + "\n").encode("ascii")


def decoded_rows(stdout, stderr, exit_code, words):
    if exit_code != 0 or stderr:
        raise ValueError("decoder exit/diagnostics refuse byte admission")
    lines = stdout.decode("ascii", errors="strict").splitlines()
    if len(lines) > 2 * len(words):
        raise ValueError("decoded text exceeds one instruction and at most one comment per word")
    cursor = 0
    for index, expected in enumerate(words):
        if cursor == len(lines):
            raise ValueError("decoded instruction cardinality differs from exact word count")
        line_number = cursor + 1
        line = lines[cursor]; cursor += 1
        if len(line) > 1024:
            raise ValueError(f"word {index} exceeds the decoded line bound")
        match = re.fullmatch(r"\s*([^;\r\n]+?)\s+; encoding: \[(0x[0-9a-f]{2},0x[0-9a-f]{2},0x[0-9a-f]{2},0x[0-9a-f]{2})\]", line)
        if match is None or not match[1].strip() or len(match[1]) > 512:
            raise ValueError(f"word {index} has unsupported text, fixup or concrete encoding shape")
        instruction = match[1].strip()
        if re.fullmatch(r"[a-z][a-z0-9.]*(?:[ \t]+[^;\r\n]*)?", instruction) is None:
            raise ValueError(f"word {index} contains an unsupported instruction/directive spelling")
        observed = bytes(int(token, 16) for token in match[2].split(","))
        if observed.hex().upper() != expected["Hex"]:
            raise ValueError(f"word {index} re-encoding differs from original physical/compiler bytes")
        comment = None
        if cursor < len(lines) and lines[cursor].lstrip().startswith(";"):
            comment = lines[cursor]
            immediate = re.fullmatch(r"mov[ \t]+([wx])(?:[0-9]|[12][0-9]|30), #(-?(?:0|[1-9][0-9]*))", instruction)
            annotation = re.fullmatch(r" {40}; =0x([0-9a-f]{1,16})", comment)
            if immediate is None or annotation is None:
                raise ValueError(f"word {index} has an unsupported standalone comment association")
            width = 32 if immediate[1] == "w" else 64
            if len(annotation[1]) > width // 4 or int(annotation[1], 16) != int(immediate[2]) % (1 << width):
                raise ValueError(f"word {index} immediate comment differs from its register-width operand")
            cursor += 1
        yield {**expected, "Instruction": instruction, "TextLine": line_number, "ImmediateComment": comment,
               "PrintedAddressMeaning": "chunk-relative/zero printer address; never a runtime target"}
    if cursor != len(lines):
        raise ValueError("decoded instruction cardinality or trailing text differs from exact word count")


def run(capture, mapped, retained, attempt):
    process = out = err = input_write = None
    owned = False
    stage = "attempt-create"
    active = []
    completed = []
    outcome = {"Kind": "finite-llvm-method-decoding", "Complete": False, "Failure": None,
               "RuntimeAdmitted": False, "BodyResolved": False, "ClosureAdmitted": False,
               "DumpAccess": False, "NewPolicyExecution": False}
    try:
        os.mkdir(attempt); owned = True
        write(attempt / "start.json", {**outcome, "StartedAtUtc": utc(), "Words": 8665, "Methods": 130,
              "ProcessSeconds": 30, "PolledOutputBytes": 2 * 1024**2, "Triple": "aarch64-apple-darwin", "Cpu": "generic", "Features": DECODER_FEATURES,
              "Scope": "byte decoding and exact re-encoding only; no interpreted runtime branch targets, CFG or arithmetic admission",
              "FilePremise": "stable local files; bounded hash chunks and checked deadlines do not cancel kernel I/O or provide hostile namespace/in-place-write isolation",
              "ReadFlags": {"NonblockingAvailable": hasattr(os, "O_NONBLOCK"), "NoFollowAvailable": hasattr(os, "O_NOFOLLOW")}})
        stage = "retained-inputs"
        raw_manifest = bounded_raw(retained, 512 * 1024)
        if len(raw_manifest) != MANIFEST_BYTES or hashlib.sha256(raw_manifest).hexdigest().upper() != MANIFEST_SHA:
            raise ValueError("requires the exact reviewed mapped130 evidence manifest")
        records = {row["OriginalLocalFile"]: row for row in json.loads(raw_manifest)["Records"]}
        pins = [identity(retained)]
        repo = Path(__file__).resolve().parents[2]

        def admitted(path, limit):
            key = str(path.relative_to(repo))
            expected = records[key]
            raw = bounded_raw(path, limit)
            if len(raw) != expected["Bytes"] or hashlib.sha256(raw).hexdigest().upper() != expected["Sha256"]:
                raise ValueError("raw metadata differs from retained original identity: " + key)
            pins.append(identity(path))
            return json.loads(raw)

        manifest = admitted(mapped / "helper-input.json", 256 * 1024)
        report = admitted(mapped / "helper-output.json", 1024**2)
        closed = admitted(mapped / "outcome.json", 65536)
        captured_inputs = admitted(mapped / "inputs.json", 1024**2)
        if closed.get("Complete") is not True or closed.get("CleanupFailures") != [] or closed.get("HelperProcess", {}).get("ExitCode") != 0:
            raise ValueError("requires the closed actual mapped extent attempt")
        output_admission(report, manifest["Methods"], manifest["Module"]["Original"]["File"])
        jit = capture / "jit.log"
        compiler_pin = next(pin for pin in captured_inputs["CaptureMetadata"] if pin["File"] == str(jit))
        jit_raw = bounded_raw(jit, 16 * 1024**2)
        if len(jit_raw) != compiler_pin["Bytes"] or hashlib.sha256(jit_raw).hexdigest().upper() != compiler_pin["Sha256"]:
            raise ValueError("compiler transcript differs from captured metadata")
        pins.append(identity(jit))
        blocks = parse_blocks(jit_raw.decode("utf-8", errors="strict"))
        methods, words = [], []
        for expected in manifest["Methods"]:
            physical = admitted(mapped / f"physical-{expected['Role']}.json", 65536)
            block = blocks[expected["CompilerBlockIndex"]]
            raw = bytes.fromhex(block["Hex"])
            if (physical.get("CompilerMatchesPhysical") is not True or physical["Body"]["Address"] != f"{expected['Address']:016X}"
                    or physical["Body"]["Bytes"] != len(raw) or block["Bytes"] != len(raw) or expected["Bytes"] != len(raw)
                    or block["Name"] != expected["CompilerName"] or physical["Body"]["Sha256"] != expected["BodySha256"]
                    or hashlib.sha256(raw).hexdigest().upper() != expected["BodySha256"]):
                raise ValueError("current physical/compiler candidate association differs")
            method_words = [checked_word(expected["Role"], expected["Address"], offset, raw[offset:offset + 4]) for offset in range(0, len(raw), 4)]
            words.extend(method_words); methods.append(expected)
            write(attempt / f"input-{expected['Role']}.json", {"Method": expected, "Words": method_words})
        if len(methods) != 130 or len(words) != 8665:
            raise ValueError("finite method/word roster changed")
        stage = "tool-identity"
        for file, size, digest in TOOL_PINS:
            actual = identity(Path(file))
            if actual != {"File": file, "Bytes": size, "Sha256": digest}:
                raise ValueError("decoder executable or declared linked-file identity differs")
            pins.append(actual)
        for name in ["decode_hidden_switch_methods.py", "capture_hidden_switch_dump.py", "inspect_hidden_switch_bodies.py", "probe_hidden_switch_metadata.py"]:
            pins.append(identity(Path(__file__).with_name(name)))
        if any(key.startswith("DYLD_") and value for key, value in os.environ.items()):
            raise ValueError("nonempty inherited DYLD overrides are outside the declared decoder environment")
        args = decoder_arguments()
        write(attempt / "inputs.json", {"Pins": pins, "Arguments": args, "SourceCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True, timeout=10).strip(),
              "EnvironmentDelta": {}, "NonemptyDyldOverrides": [], "Features": DECODER_FEATURES,
              "LinkedFileScope": "pinned declared Homebrew libraries; no actual load snapshot or complete system-library identity claim"})
        input_write = (attempt / "decoder.input").open("xb+")
        input_write.write(atomic_input(words)); input_write.flush(); os.fsync(input_write.fileno())
        stage = "decoder-process"
        input_write.seek(0)
        out = (attempt / "helper.stdout.log").open("xb"); err = (attempt / "helper.stderr.log").open("xb")
        process = subprocess.Popen(args, stdin=input_write, stdout=out, stderr=err, cwd=attempt, start_new_session=True)
        write(attempt / "process-start.json", {"ProcessId": process.pid, "StartedAtUtc": utc()})
        wait_helper(process, attempt, seconds=30, limit=2 * 1024**2)
        write(attempt / "process-finished.json", {"ProcessId": process.pid, "ExitCode": process.returncode, "FinishedAtUtc": utc()})
        stdout = bounded_raw(attempt / "helper.stdout.log", 2 * 1024**2)
        stderr = bounded_raw(attempt / "helper.stderr.log", 2 * 1024**2)
        stage = "decoded-byte-admission"
        sizes = {method["Role"]: method["Bytes"] // 4 for method in methods}
        for row in decoded_rows(stdout, stderr, process.returncode, words):
            active.append(row)
            if len(active) == sizes[row["Role"]]:
                write(attempt / f"decoded-{row['Role']}.json", {"Role": row["Role"], "Words": active, "ReEncodedBytesMatch": True,
                      "RuntimeAdmitted": False, "BodyResolved": False, "ClosureAdmitted": False})
                completed.append(row["Role"]); active = []
        if len(completed) != 130 or active:
            raise ValueError("decoded method grouping differs")
        if any(identity(Path(pin["File"])) != pin for pin in pins):
            raise ValueError("decoder inputs or tool files changed")
        outcome.update(Complete=True, Methods=130, Words=8665, Bytes=34660, InputsUnchanged=True)
    except Exception as error:  # noqa: BLE001 - retain first owned decoder/metadata refusal and available prefix
        outcome["Failure"] = {"Stage": stage, "Code": type(error).__name__, "Detail": str(error)[:4096], "SecondaryNotes": getattr(error, "__notes__", [])}
    finally:
        cleanup_failures, status = cleanup(process, [("input-writer-close", input_write), ("stdout-close", out), ("stderr-close", err)])
        outcome.update(CleanupFailures=cleanup_failures, CompletedMethods=completed, ActiveDecodedPrefix=active, FinishedAtUtc=utc(), Process=status)
        outcome["Complete"] = outcome["Complete"] and not cleanup_failures and outcome["Failure"] is None
        if owned:
            publish_terminal(attempt, outcome)
        else:
            try:
                print(json.dumps(outcome))
            except Exception as error:  # noqa: BLE001 - no owned directory exists for a second reporting channel
                outcome["ConsoleFailure"] = {"Code": type(error).__name__, "Detail": str(error)[:4096]}
    return 0 if outcome["Complete"] else 2


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit("requires capture metadata, accepted mapped attempt, exact retained manifest and absent decoder attempt")
    raise SystemExit(run(*(Path(value).absolute() for value in sys.argv[1:])))
