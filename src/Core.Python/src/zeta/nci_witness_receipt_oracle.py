"""Independent finite NciNonUrgency TLC receipt checker.

This module validates one byte-pinned bounded TLC experiment. It emits neither a
policy score nor a consent, consensus, NCI-floor, or authority decision.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Literal, cast

MODEL_ID: Final = "NciNonUrgency"
MODEL_PATH: Final = Path("src/Core.TLA/specs/NciNonUrgency.tla")
CONFIG_PATH: Final = Path("src/Core.TLA/specs/NciNonUrgency.cfg")
REGISTRY_PATH: Final = Path("registry/tlc-models.json")
JAR_PATH: Final = Path("src/Core.TLA/tla2tools.jar")
BANNER: Final = "TLC2 Version 2026.05.18.174321 (rev: 8ba1027)"
COMPLETION: Final = "Model checking completed. No error has been found"
CANONICAL_ARGV: Final = (
    "cd src/Core.TLA/specs && java -Xms64m -Xmx4g -XX:+UseSerialGC -cp ../tla2tools.jar "
    "tlc2.TLC -metadir <ephemeral-directory> -workers 1 -config NciNonUrgency.cfg NciNonUrgency"
)
PIN: Final = {
    "modelSha256": "3444cb6e66904406460143a27fc8932f30aac4b4d78ad37d09f59dfc0822319f",
    "configSha256": "98e80eeef8949ffd598cd29cc7ad44dc70eae1636dea6f3cf2b7954bc62340b9",
    "registrySha256": "44f1ca2feb2c7ba9cab47f06d2fcd60c097ef6d55ed602299f0e1a645791de54",
    "jarSha256": "71546dff3897a01b0ee4fa64135d9f5e9384d2b7e47b3cc20a16b655b0eb4f86",
}
STATE_RE: Final = re.compile(r"([\d,]+) distinct states found")


@dataclass
class WitnessFailure(Exception):
    """A named refusal; Python exception propagation must set traceback fields."""

    kind: str
    detail: str

    def __str__(self) -> str:
        return f"{self.kind}: {self.detail}"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_record(value: object, name: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise WitnessFailure("refuse-registry-mismatch", f"{name} is not an object")
    return cast(dict[str, object], value)


def require_string(record: dict[str, object], key: str) -> str:
    value = record.get(key)
    if not isinstance(value, str):
        raise WitnessFailure("refuse-registry-mismatch", f"{key} is not a string")
    return value


def require_int(record: dict[str, object], key: str) -> int:
    value = record.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise WitnessFailure("refuse-registry-mismatch", f"{key} is not an integer")
    return value


def verify_pinned_subject(repo_root: Path) -> None:
    for relative, expected in (
        (MODEL_PATH, PIN["modelSha256"]),
        (CONFIG_PATH, PIN["configSha256"]),
        (REGISTRY_PATH, PIN["registrySha256"]),
        (JAR_PATH, PIN["jarSha256"]),
    ):
        path = repo_root / relative
        if not path.is_file() or sha256_file(path) != expected:
            raise WitnessFailure("refuse-identity-mismatch", str(relative))

    raw_registry: object = json.loads(
        (repo_root / REGISTRY_PATH).read_text(encoding="utf-8")
    )
    registry = require_record(raw_registry, "registry")
    models = registry.get("models")
    if not isinstance(models, list):
        raise WitnessFailure("refuse-registry-mismatch", "models is not a list")
    entries = [require_record(entry, "models[]") for entry in models]
    entry = next((item for item in entries if item.get("id") == MODEL_ID), None)
    if entry is None:
        raise WitnessFailure("refuse-unknown-witness", MODEL_ID)
    invocation = require_record(registry.get("invocation"), "invocation")
    toolchain = require_record(registry.get("toolchain"), "toolchain")
    actual = (
        require_string(entry, "module"),
        require_string(entry, "config"),
        require_string(entry, "expect"),
        require_int(entry, "exitCode"),
        require_string(entry, "tier"),
        require_string(entry, "deadlock"),
        require_int(entry, "distinctStates"),
        require_int(invocation, "workers"),
        require_string(toolchain, "jar"),
        require_string(toolchain, "jarSha256"),
        require_string(toolchain, "versionBanner"),
    )
    expected_fields = (
        MODEL_ID,
        "NciNonUrgency.cfg",
        "valid",
        0,
        "gate",
        "off-cfg",
        512,
        1,
        str(JAR_PATH),
        PIN["jarSha256"],
        BANNER,
    )
    if actual != expected_fields:
        raise WitnessFailure(
            "refuse-registry-mismatch", "NciNonUrgency registry pin differs"
        )


def receipt_object(repo_root: Path) -> dict[str, object]:
    verify_pinned_subject(repo_root)
    return {
        "schema": "zeta.nci-witness/v1",
        "modelId": MODEL_ID,
        "modelSha256": PIN["modelSha256"],
        "configSha256": PIN["configSha256"],
        "registrySha256": PIN["registrySha256"],
        "jarSha256": PIN["jarSha256"],
        "banner": BANNER,
        "argv": CANONICAL_ARGV,
        "expect": "valid",
        "exitCode": 0,
        "completion": COMPLETION,
        "distinctStates": 512,
        "checkedInvariants": ["TypeOK", "NoCoercion"],
        "checkedProperties": ["Responsive"],
        "scope": "bounded-three-traveler-event-budget-one-fairness-conditioned",
        "verdict": "witness-observed",
    }


def render_receipt(repo_root: Path) -> str:
    return json.dumps(receipt_object(repo_root), separators=(",", ":")) + "\n"


def verify_receipt(repo_root: Path, text: str) -> None:
    if text != render_receipt(repo_root):
        raise WitnessFailure(
            "refuse-receipt-mismatch",
            "receipt bytes differ from pinned canonical witness",
        )


def run_witness(
    repo_root: Path,
) -> tuple[
    Literal["witness-observed", "defer-checker-did-not-run", "refuse-verdict-mismatch"],
    str,
]:
    verify_pinned_subject(repo_root)
    process = subprocess.run(
        [
            "java",
            "-Xms64m",
            "-Xmx4g",
            "-XX:+UseSerialGC",
            "-cp",
            "../tla2tools.jar",
            "tlc2.TLC",
            "-metadir",
            str(repo_root / ".cache" / "tlc-nci-witness"),
            "-workers",
            "1",
            "-config",
            "NciNonUrgency.cfg",
            MODEL_ID,
        ],
        cwd=repo_root / "src/Core.TLA/specs",
        capture_output=True,
        check=False,
        encoding="utf-8",
    )
    output = process.stdout + process.stderr
    if any(
        marker in output
        for marker in (
            "Could not reserve enough space for object heap",
            "Error occurred during initialization of VM",
            "Unable to access jarfile",
            "OutOfMemoryError",
        )
    ):
        return "defer-checker-did-not-run", output.strip()
    states = STATE_RE.findall(output)
    if (
        process.returncode != 0
        or BANNER not in output
        or COMPLETION not in output
        or not states
        or int(states[-1].replace(",", "")) != 512
    ):
        return "refuse-verdict-mismatch", output.strip()
    return "witness-observed", render_receipt(repo_root)


if __name__ == "__main__":
    root = Path.cwd()
    outcome, detail = run_witness(root)
    if outcome != "witness-observed":
        print(f"{outcome}: {detail}", file=sys.stderr)
        raise SystemExit(1)
    sys.stdout.write(detail)
