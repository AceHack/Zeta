"""Capture the fixed mathematical vectors from exact committed source.

This records source/interpreter observations, not a source-to-bytecode theorem.
The output directory must not exist. No native process or random input is used.
"""

from __future__ import annotations

import hashlib
import importlib
import json
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def main() -> int:
    repo = Path(sys.argv[1]).resolve(strict=True)
    output = Path(sys.argv[2])
    output.mkdir()
    source_commit = "9e6be94a0ec2b153ba63e100463f91418ceed4fe"
    source_path = "src/Interp.Python/zeta_interp/precision_gate_kernels_reference.py"
    actual_path = repo / source_path
    expected = subprocess.run(
        ["git", "show", source_commit + ":" + source_path],
        cwd=repo,
        capture_output=True,
        check=True,
    ).stdout
    before = actual_path.read_bytes()
    if before != expected:
        raise RuntimeError("current source differs from the fixed source commit")
    with (output / "source.py").open("xb") as handle:
        handle.write(before)
    sys.path.insert(0, str(repo / "src/Interp.Python"))
    module = importlib.import_module("zeta_interp.precision_gate_kernels_reference")
    if Path(module.__file__).resolve(strict=True) != actual_path:
        raise RuntimeError("imported another reference source")
    started = datetime.now(timezone.utc).isoformat()
    returned = module.reference_vectors()
    finished = datetime.now(timezone.utc).isoformat()
    is_success = type(returned) is module.Success
    result = (
        {"Kind": "success", "Value": returned.Value}
        if is_success
        else {
            "Kind": "refused",
            "Failure": {
                "Code": returned.Code,
                "Field": returned.Field,
                "Message": returned.Message,
            },
        }
    )
    raw_return = (
        json.dumps(result, sort_keys=True, indent=2, allow_nan=False) + "\n"
    ).encode()
    with (output / "actual-return.json").open("xb") as handle:
        handle.write(raw_return)
    after = actual_path.read_bytes()
    metadata = {
        "SourceCommit": source_commit,
        "SourcePath": source_path,
        "SourceBytes": len(before),
        "SourceSha256": digest(before),
        "SourceUnchangedAfter": before == after,
        "ImportedFile": module.__file__,
        "ImportedSpecOrigin": module.__spec__.origin,
        "ImportedLoader": type(module.__loader__).__module__
        + "."
        + type(module.__loader__).__qualname__,
        "Interpreter": sys.executable,
        "InterpreterResolved": str(Path(sys.executable).resolve(strict=True)),
        "InterpreterSha256": digest(Path(sys.executable).read_bytes()),
        "Version": sys.version,
        "Platform": platform.platform(),
        "StartedAtUtc": started,
        "FinishedAtUtc": finished,
        "ReturnedType": type(returned).__module__ + "." + type(returned).__qualname__,
        "ReturnBytes": len(raw_return),
        "ReturnSha256": digest(raw_return),
        "FullRuntimeClosureAdmitted": False,
        "NativeComparisonPerformed": False,
    }
    with (output / "observations.json").open("x") as handle:
        json.dump(metadata, handle, sort_keys=True, indent=2)
        handle.write("\n")
    if not is_success or before != after:
        return 1
    rows = returned.Value["Rows"]
    if len(rows) != 24:
        return 1
    print(json.dumps(returned.Value, sort_keys=True, indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
