"""Fixed projection execution adapter; source snapshots are not machine-code proof.

The raw manifest/hash is an independently supplied premise. Only the reviewed
fixed roster is dispatched. Driver and Store reservations share one ceiling;
complete actual returns remain in memory before bounded reference publication.
"""

from __future__ import annotations

import hashlib
import re
import sys
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from functools import partial
from pathlib import Path
from types import ModuleType
from typing import Any, NoReturn

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_record_encoding as encoding
from . import hidden_switch_compiled_record_store as store
from . import hidden_switch_compiled_storage as storage
from . import precision_gate_projection_comparison as criteria
from . import precision_gate_projection_process as process
from . import precision_gate_projection_run as runner

MANIFEST_CAP = 64 * 1024
SOURCE_CAP = 8 * 1024 * 1024
SOURCE_TOTAL = 64 * 1024 * 1024
METADATA_CAP = 1024 * 1024
TOTAL_BYTES = 256 * 1024 * 1024
TOTAL_SLOTS = 512
DRIVER_SLOTS = 90
JOURNAL_BYTES = 8 * 1024 * 1024
TERMINAL_RESERVE = 2 * 1024 * 1024
NATIVE_CALLS = 27
SCHEMA = "zeta.precision-projection.source-manifest.v1"
DRIVER_NAME = "zeta_interp.precision_gate_projection_driver"
_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}\Z")
_SHA = re.compile(r"[0-9A-F]{64}\Z")
SOURCE_PATHS = (
    "src/Interp.Python/zeta_interp/precision_gate_projection_run.py",
    "src/Interp.Python/zeta_interp/precision_gate_projection_cases.py",
    "src/Interp.Python/zeta_interp/precision_gate_projection_comparison.py",
    "src/Interp.Python/zeta_interp/precision_gate_projection_process.py",
    "src/Interp.Python/zeta_interp/precision_gate_projection_reference.py",
    "src/Interp.Python/zeta_interp/precision_gate_projection_intervals.py",
    "src/Interp.Python/zeta_interp/hidden_switch_compiled_admission.py",
    "src/Interp.Python/zeta_interp/hidden_switch_compiled_ieee.py",
    "src/Interp.Python/zeta_interp/hidden_switch_compiled_record_encoding.py",
    "src/Interp.Python/zeta_interp/hidden_switch_compiled_record_store.py",
    "src/Interp.Python/zeta_interp/hidden_switch_compiled_storage.py",
    "src/Interp.Python/zeta_interp/__init__.py",
    "src/Interp.Python/zeta_interp/activations.py",
    "src/Research.FSharp/PrecisionGateProjectionReplay.fsx",
    "src/Bayesian/PrecisionGateProjection.fs",
    "src/Bayesian/PrecisionGateKernels.fs",
    "src/Bayesian/Message.fs",
    "src/Core/Result.fs",
    "src/Core/ProbabilitySemiring.fs",
    "Directory.Build.props",
    "Directory.Packages.props",
    "global.json",
    ".mise.toml",
    "Zeta.sln",
    "src/Bayesian/Bayesian.fsproj",
    "src/Core/Core.fsproj",
    "src/Core.Abstractions/Zeta.Core.Abstractions.csproj",
    "src/Core.FSharp.ZetaId/Zeta.Core.FSharp.ZetaId.fsproj",
    "src/Core.FSharp.Yaml/Zeta.Core.FSharp.Yaml.fsproj",
    "src/Core.TypeScript/ace/build-graph.json",
    "src/Interp.Python/pyproject.toml",
    "src/Interp.Python/uv.lock",
    "tests/Bayesian.Tests/Bayesian.Tests.fsproj",
    "tests/Bayesian.Tests/PrecisionGateProjection.Tests.fs",
    "tests/Bayesian.Tests/PrecisionGateKernels.Tests.fs",
    "src/Interp.Python/tests/test_precision_gate_projection_run.py",
    "src/Interp.Python/tests/test_precision_gate_projection_cases.py",
    "src/Interp.Python/tests/test_precision_gate_projection_comparison.py",
    "src/Interp.Python/tests/test_precision_gate_projection_reference.py",
    "src/Interp.Python/tests/test_precision_gate_projection_intervals.py",
    "docs/research/2026-09-08-precision-gate-projection-proposed-contract.md",
    "docs/research/2026-09-08-precision-gate-projection-decimal-admission-clarification.md",
    "docs/research/2026-09-08-precision-gate-projection-rendered-zero-clarification.md",
    "docs/DECISIONS/2026-09-08-density-consistent-precision-gate-kernels.md",
    "src/Interp.Python/zeta_interp/precision_gate_projection_driver.py",
    "src/Interp.Python/tests/test_precision_gate_projection_driver.py",
    "src/Interp.Python/tests/test_precision_gate_projection_process.py",
)
NATIVE_ROLES = (
    "@host",
    process.SCRIPT,
    "src/Core/bin/Release/net10.0/Zeta.Core.dll",
    "src/Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll",
    "src/Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll",
)
METADATA_ROLES = (
    "source-snapshot-1.json",
    "prepared-native.json",
    "source-snapshot-2.json",
    "outer-final.json",
)


@dataclass(frozen=True, slots=True)
class SourceFile:
    Path: str
    Bytes: int
    Sha256: str


@dataclass(frozen=True, slots=True)
class NativeFile:
    Role: str
    Bytes: int
    Sha256: str


@dataclass(frozen=True, slots=True)
class Manifest:
    Sources: tuple[SourceFile, ...]
    Native: tuple[NativeFile, ...]
    Bindings: tuple[tuple[str, str], ...]


@dataclass(frozen=True, slots=True)
class Reservation:
    CopiedBytes: int
    ManifestBytes: int
    DriverCombinedBytes: int
    DriverSlots: int
    Inner: store.Limits
    UnusedReservationsReclaimed: bool = False


@dataclass(frozen=True, slots=True)
class ModuleObservation:
    Name: str
    Key: str
    File: str
    Origin: str


@dataclass(frozen=True, slots=True)
class SourceRead:
    Expected: SourceFile
    Read: store.CallObservation
    ActualBytes: int | None
    ActualSha256: str | None
    Matched: bool


@dataclass(frozen=True, slots=True)
class SourceSnapshot:
    Complete: bool
    Modules: tuple[ModuleObservation, ...]
    Reads: tuple[SourceRead, ...]
    Failure: a.Refused | None


@dataclass(slots=True)
class Publication:
    File: str
    Cap: int
    Encoding: store.CallObservation | None = None
    Expected: store.Artifact | None = None
    Write: store.CallObservation | None = None
    Read: store.CallObservation | None = None
    Complete: bool = False


@dataclass(frozen=True, slots=True)
class DriverResult:
    ManifestRaw: object
    ExpectedManifestSha256: object
    SourceRoot: str | None
    AttemptRoot: str | None
    AttemptOwned: bool
    Reservation: Reservation | None
    Admission: store.CallObservation | None
    Sources: tuple[store.CallObservation, ...]
    Preparation: store.CallObservation | None
    StoreOpen: store.CallObservation | None
    Run: store.CallObservation | None
    SetupFinalization: store.CallObservation | None
    Publications: tuple[Publication, ...]
    Calls: tuple[store.CallObservation, ...]
    Failure: a.Refused | None
    SecondaryFailures: tuple[a.Refused, ...]
    Complete: bool
    Scope: str = "current-source-snapshots-and-direct-process-custody-only"
    ManifestRead: store.CallObservation | None = None
    FullRunResultPublication: str = "memory-only; outer publication contains references"


class _Stop(Exception):
    pass


def _refuse(code: str, path: str, message: str) -> NoReturn:
    raise _AdmissionStop(a.Refused(code, path, message))


class _AdmissionStop(Exception):
    def __init__(self, failure: a.Refused):
        self.failure = failure


def _keys(value: object, names: tuple[str, ...], path: str) -> dict[str, Any]:
    if type(value) is not dict or set(value) != set(names):
        _refuse("manifest-fields", path, "exact member set required")
    return value


def _identity(row: dict[str, Any], cap: int, path: str) -> None:
    if type(row["Bytes"]) is not int or not 0 <= row["Bytes"] <= cap:
        _refuse("manifest-length", path, "bounded non-bool integer required")
    if type(row["Sha256"]) is not str or _SHA.fullmatch(row["Sha256"]) is None:
        _refuse("manifest-hash", path, "uppercase SHA256 required")


def admit_manifest(raw: object, expected_sha256: object) -> a.Admission[Manifest]:
    """Caller expectation is external; exact bytes and bound precede hashing."""
    try:
        if type(raw) is not bytes or len(raw) > MANIFEST_CAP:
            _refuse("manifest-bytes", "Manifest", "exact bytes within 64 KiB required")
        if type(expected_sha256) is not str or not _SHA.fullmatch(expected_sha256):
            _refuse(
                "manifest-expectation",
                "Manifest",
                "independent uppercase SHA256 required",
            )
        if hashlib.sha256(raw).hexdigest().upper() != expected_sha256:
            _refuse(
                "manifest-identity", "Manifest", "independently expected bytes differ"
            )
        decoded = a.strict_json(raw, maximum_bytes=MANIFEST_CAP)
        if isinstance(decoded, a.Refused):
            return decoded
        value = _keys(
            decoded.value,
            ("Schema", "ProtocolSha256", "SourceFiles", "NativeFiles"),
            "Manifest",
        )
        if value["Schema"] != SCHEMA or type(value["Schema"]) is not str:
            _refuse("manifest-schema", "Manifest.Schema", "fixed schema required")
        if value["ProtocolSha256"] != criteria.PROTOCOL_SHA256:
            _refuse(
                "manifest-protocol",
                "Manifest.ProtocolSha256",
                "registered protocol required",
            )
        sources = value["SourceFiles"]
        if type(sources) is not list or len(sources) != len(SOURCE_PATHS):
            _refuse(
                "manifest-roster",
                "SourceFiles",
                "complete ordered 47-path roster required",
            )
        parsed: list[SourceFile] = []
        total = 0
        for index, (item, path) in enumerate(zip(sources, SOURCE_PATHS, strict=True)):
            row = _keys(item, ("Path", "Bytes", "Sha256"), f"SourceFiles[{index}]")
            if type(row["Path"]) is not str or row["Path"] != path:
                _refuse(
                    "manifest-roster",
                    f"SourceFiles[{index}].Path",
                    "fixed ordered path required",
                )
            _identity(row, SOURCE_CAP, path)
            total += row["Bytes"]
            if total > SOURCE_TOTAL:
                _refuse("source-total", path, "source reads exceed 64 MiB")
            parsed.append(SourceFile(path, row["Bytes"], row["Sha256"]))
        bindings = {
            "ProtocolSha256": value["ProtocolSha256"],
            **{row.Path: row.Sha256 for row in parsed},
        }
        checked = criteria.validate_bindings(bindings)
        if isinstance(checked, a.Refused):
            return checked
        protocol_path = (
            "docs/research/2026-09-08-precision-gate-projection-proposed-contract.md"
        )
        if bindings[protocol_path] != criteria.PROTOCOL_SHA256:
            _refuse(
                "manifest-protocol",
                protocol_path,
                "protocol source and reserved hash must agree",
            )
        native = value["NativeFiles"]
        if type(native) is not list or len(native) != len(NATIVE_ROLES):
            _refuse(
                "native-roster", "NativeFiles", "five exact native identities required"
            )
        pins: list[NativeFile] = []
        for index, (item, role) in enumerate(zip(native, NATIVE_ROLES, strict=True)):
            row = _keys(item, ("Role", "Bytes", "Sha256"), f"NativeFiles[{index}]")
            if type(row["Role"]) is not str or row["Role"] != role:
                _refuse(
                    "native-roster",
                    f"NativeFiles[{index}].Role",
                    "fixed ordered role required",
                )
            _identity(row, process.FILE_CAP, role)
            pins.append(NativeFile(role, row["Bytes"], row["Sha256"]))
        script = next(row for row in parsed if row.Path == process.SCRIPT)
        if (pins[1].Bytes, pins[1].Sha256) != (script.Bytes, script.Sha256):
            _refuse(
                "script-identity",
                process.SCRIPT,
                "source and native script identities differ",
            )
        return a.Admitted(Manifest(tuple(parsed), tuple(pins), tuple(bindings.items())))
    except _AdmissionStop as error:
        return error.failure
    except Exception as error:  # noqa: BLE001 - typed public admission boundary
        return a.Refused(
            "manifest-unexpected", "Manifest", f"{type(error).__name__}: {error}"
        )


def _reserve(manifest: Manifest, raw_bytes: int) -> a.Admission[Reservation]:
    copied = sum(row.Bytes for row in manifest.Native[1:])
    charge = 2 * (
        copied
        + raw_bytes
        + NATIVE_CALLS * (2 * MANIFEST_CAP + process.RECEIPT_CAP)
        + 4 * METADATA_CAP
    )
    inner = store.Limits(
        TOTAL_BYTES - charge, JOURNAL_BYTES, TOTAL_SLOTS - DRIVER_SLOTS
    )
    if inner.CombinedBytes <= JOURNAL_BYTES + TERMINAL_RESERVE or inner.Artifacts < 3:
        return a.Refused(
            "reservation",
            "Driver",
            "journal, terminal and nonzero ordinary room must remain",
        )
    return a.Admitted(Reservation(copied, raw_bytes, charge, DRIVER_SLOTS, inner))


def _observe(operation: str, callback: Callable[[], object]) -> store.CallObservation:
    try:
        return store.CallObservation(operation, callback(), None)
    except Exception as error:  # noqa: BLE001 - retain actual raised outcome
        return store.CallObservation(
            operation,
            None,
            store.Raised(
                type(error).__module__ + "." + type(error).__qualname__, str(error)
            ),
        )


def _loaded(
    source_root: Path,
) -> tuple[tuple[ModuleObservation, ...], a.Refused | None]:
    observed: list[ModuleObservation] = []
    for relative in SOURCE_PATHS:
        prefix = "src/Interp.Python/zeta_interp/"
        if not relative.startswith(prefix):
            continue
        stem = relative[len(prefix) : -3]
        name = "zeta_interp" if stem == "__init__" else "zeta_interp." + stem
        key = name
        module = sys.modules.get(key)
        main = sys.modules.get("__main__")
        if (
            name == DRIVER_NAME
            and isinstance(main, ModuleType)
            and getattr(getattr(main, "__spec__", None), "name", None) == name
        ):
            if module is not None and module is not main:
                return tuple(observed), a.Refused(
                    "module-duplicate", name, "alternate driver entry is loaded"
                )
            module, key = main, "__main__"
        if type(module) is not ModuleType:
            return tuple(observed), a.Refused(
                "module-missing", name, "actual file-backed module required"
            )
        actual = getattr(module, "__file__", None)
        origin = getattr(getattr(module, "__spec__", None), "origin", None)
        if type(actual) is not str or type(origin) is not str:
            return tuple(observed), a.Refused(
                "module-origin", name, "actual file and spec origin required"
            )
        observed.append(ModuleObservation(name, key, actual, origin))
        expected = source_root / relative
        if Path(actual) != expected or Path(origin) != expected:
            return tuple(observed), a.Refused(
                "module-root", name, "loaded file/origin belongs to another path"
            )
    return tuple(observed), None


def _source_snapshot(source_root: Path, manifest: Manifest) -> SourceSnapshot:
    modules: tuple[ModuleObservation, ...] = ()
    reads: list[SourceRead] = []
    try:
        modules, failure = _loaded(source_root)
        if failure is not None:
            return SourceSnapshot(False, modules, (), failure)
        for expected in manifest.Sources:
            call = _observe(
                "source-read/" + expected.Path,
                partial(
                    storage.read_exact,
                    source_root,
                    expected.Path,
                    expected_bytes=expected.Bytes,
                    maximum_bytes=SOURCE_CAP,
                ),
            )
            reads.append(SourceRead(expected, call, None, None, False))
            actual_bytes = None
            actual_sha = None
            matched = False
            result = call.Returned
            if (
                call.Raised is None
                and type(result) is a.Admitted
                and type(result.value) is bytes
            ):
                actual_bytes = len(result.value)
                actual_sha = hashlib.sha256(result.value).hexdigest().upper()
                matched = (actual_bytes, actual_sha) == (
                    expected.Bytes,
                    expected.Sha256,
                )
            reads[-1] = SourceRead(expected, call, actual_bytes, actual_sha, matched)
            if not matched:
                failure = (
                    result
                    if isinstance(result, a.Refused)
                    else a.Refused(
                        "source-identity",
                        expected.Path,
                        "actual bounded source read did not match",
                    )
                )
                return SourceSnapshot(False, modules, tuple(reads), failure)
        return SourceSnapshot(True, modules, tuple(reads), None)
    except Exception as error:  # noqa: BLE001 - preserve completed read prefix
        return SourceSnapshot(
            False,
            modules,
            tuple(reads),
            a.Refused(
                "source-unexpected", "Sources", f"{type(error).__name__}: {error}"
            ),
        )


def _snapshot_report(snapshot: SourceSnapshot) -> dict[str, object]:
    return {
        "Complete": snapshot.Complete,
        "Modules": snapshot.Modules,
        "Failure": snapshot.Failure,
        "Files": tuple(
            {
                "Expected": row.Expected,
                "ActualBytes": row.ActualBytes,
                "ActualSha256": row.ActualSha256,
                "Matched": row.Matched,
                "Raised": row.Read.Raised,
                "Refusal": row.Read.Returned
                if isinstance(row.Read.Returned, a.Refused)
                else None,
            }
            for row in snapshot.Reads
        ),
        "ActualReadReturns": "memory-only; source bytes remain in independently preserved archive",
    }


@dataclass(slots=True)
class _Driver:
    raw: object
    expected: object
    source: Path | None = None
    attempt: Path | None = None
    owned: bool = False
    reservation: Reservation | None = None
    admission: store.CallObservation | None = None
    sources: list[store.CallObservation] = field(default_factory=list)
    preparation: store.CallObservation | None = None
    opened: store.CallObservation | None = None
    run: store.CallObservation | None = None
    setup_finalization: store.CallObservation | None = None
    publications: list[Publication] = field(default_factory=list)
    calls: list[store.CallObservation] = field(default_factory=list)
    failure: a.Refused | None = None
    secondary: list[a.Refused] = field(default_factory=list)

    def fail(self, failure: a.Refused) -> None:
        if self.failure is None:
            self.failure = failure
        else:
            self.secondary.append(failure)

    def stop(self, code: str, path: str, detail: str) -> NoReturn:
        self.fail(a.Refused(code, path, detail))
        raise _Stop

    def observe(
        self, name: str, callback: Callable[[], object]
    ) -> store.CallObservation:
        call = _observe(name, callback)
        self.calls.append(call)
        return call

    def returned(self, call: store.CallObservation) -> object:
        if call.Raised is not None:
            self.stop("driver-raised", call.Operation, call.Raised.Message)
        return call.Returned

    def put(self, path: str, value: object, *, raw: bool = False) -> None:
        assert self.attempt is not None and self.owned and self.reservation is not None
        attempt = self.attempt
        cap = MANIFEST_CAP if path == "manifest.json" else METADATA_CAP
        if path not in ("manifest.json", *METADATA_ROLES) or any(
            row.File == path for row in self.publications
        ):
            self.stop(
                "publication-roster", path, "one write per fixed reserved role required"
            )
        row = Publication(path, cap)
        self.publications.append(row)
        row.Encoding = self.observe(
            "encode/" + path,
            lambda: (
                a.Admitted(value)
                if raw and type(value) is bytes and len(value) <= cap
                else encoding.encode_public_result(value, maximum_bytes=cap)
            ),
        )
        result = self.returned(row.Encoding)
        if isinstance(result, a.Refused):
            self.fail(result)
            raise _Stop
        if (
            type(result) is not a.Admitted
            or type(result.value) is not bytes
            or len(result.value) > cap
        ):
            self.stop(
                "driver-encoding",
                path,
                "complete bounded bytes unavailable; actual value remains in memory",
            )
        blob = result.value
        digest = hashlib.sha256(blob).hexdigest().upper()
        row.Expected = store.Artifact(
            path, len(blob), digest, "identity", len(blob), digest
        )
        row.Write = self.observe(
            "write/" + path, lambda: storage.write_exclusive(attempt, path, blob)
        )
        written = self.returned(row.Write)
        if isinstance(written, a.Refused):
            self.fail(written)
            raise _Stop
        if (
            type(written) is not a.Admitted
            or type(written.value) is not int
            or written.value != len(blob)
        ):
            self.stop("driver-write", path, "exclusive output did not complete")
        row.Read = self.observe(
            "read/" + path,
            lambda: storage.read_exact(
                attempt, path, expected_bytes=len(blob), maximum_bytes=cap
            ),
        )
        read = self.returned(row.Read)
        if isinstance(read, a.Refused):
            self.fail(read)
            raise _Stop
        if (
            type(read) is not a.Admitted
            or type(read.value) is not bytes
            or read.value != blob
        ):
            self.stop("driver-readback", path, "actual readback differs or refused")
        row.Complete = True

    def result(self) -> DriverResult:
        outer = next(
            (row for row in self.publications if row.File == "outer-final.json"), None
        )
        run = (
            self.run.Returned
            if self.run is not None and self.run.Raised is None
            else None
        )
        complete = (
            self.failure is None
            and type(run) is runner.RunResult
            and run.CollectionAndCriteriaPassed
            and outer is not None
            and outer.Complete
        )
        return DriverResult(
            self.raw,
            self.expected,
            str(self.source) if self.source else None,
            str(self.attempt) if self.attempt else None,
            self.owned,
            self.reservation,
            self.admission,
            tuple(self.sources),
            self.preparation,
            self.opened,
            self.run,
            self.setup_finalization,
            tuple(self.publications),
            tuple(self.calls),
            self.failure,
            tuple(self.secondary),
            complete,
        )


def _root(value: object, field_name: str) -> Path:
    if not isinstance(value, Path) or not value.is_absolute() or "\x00" in str(value):
        _refuse("driver-path", field_name, "absolute canonical Path required")
    if value.resolve(strict=True) != value or not value.is_dir():
        _refuse("driver-path", field_name, "existing canonical directory required")
    return value


def _run_links(result: object) -> dict[str, object] | None:
    if type(result) is not runner.RunResult:
        return None
    terminal = result.Terminal
    terminal_artifact = (
        terminal[1].Artifact
        if type(terminal) is tuple
        and len(terminal) == 2
        and type(terminal[1]) is store.Stored
        else None
    )
    final = result.Finalization
    journal = final.Artifact if type(final) is store.Finalized else None
    return {
        "Counters": result.Counters,
        "Pending": result.Pending,
        "CoreCertified": result.CoreCertified,
        "PrimaryFailure": result.PrimaryFailure,
        "SecondaryFailureCount": len(result.SecondaryFailures),
        "Terminal": terminal_artifact,
        "FinalJournal": journal,
        "CollectionAndCriteriaPassed": result.CollectionAndCriteriaPassed,
        "FullRunResult": "memory-only; consult linked inner artifacts for durable scope",
    }


def _outer(state: _Driver) -> dict[str, object]:
    actual = (
        state.run.Returned
        if state.run is not None and state.run.Raised is None
        else None
    )
    native_paths: list[str] = []
    if type(actual) is runner.RunResult:
        for row in actual.Entries:
            if row.Operation == "NativeSolve":
                native_paths.extend(
                    f"native-call-{row.Index:03}/{name}"
                    for name in ("input.json", "bindings.json", "receipt.json")
                )
    return {
        "Schema": "zeta.precision-projection.driver.v1",
        "SnapshotBeforeFinalPublication": True,
        "Reservation": state.reservation,
        "ManifestSha256": state.expected,
        "SourceRoot": str(state.source),
        "AttemptRoot": str(state.attempt),
        "Failure": state.failure,
        "SecondaryFailures": tuple(state.secondary),
        "Artifacts": tuple(row.Expected for row in state.publications if row.Complete),
        "AttemptedPublications": tuple(
            {"File": row.File, "Expected": row.Expected, "Complete": row.Complete}
            for row in state.publications
        ),
        "Run": _run_links(actual),
        "SetupFinalJournal": state.setup_finalization.Returned.Artifact
        if state.setup_finalization is not None
        and type(state.setup_finalization.Returned) is store.Finalized
        else None,
        "NativeCallPaths": tuple(native_paths),
        "NativePathScope": "reserved or attempted paths; existence and completion require actual process records",
        "Python": {
            "Executable": sys.executable,
            "Version": sys.version,
            "CacheTag": sys.implementation.cache_tag,
        },
        "RuntimeClosureAdmitted": False,
        "SourceToMachineAdmitted": False,
        "ActualReturns": "DriverResult memory; no recursive full RunResult serialization",
    }


def drive(
    raw_manifest: object,
    expected_manifest_sha256: object,
    source_root: object,
    output_parent: object,
    attempt_name: object,
    dotnet: object,
) -> DriverResult:
    """One complete fixed-roster invocation; never select/retry individual cases."""
    state = _Driver(raw_manifest, expected_manifest_sha256)
    target: store.Store | None = None
    try:
        state.admission = state.observe(
            "admit-manifest",
            lambda: admit_manifest(raw_manifest, expected_manifest_sha256),
        )
        admitted = state.returned(state.admission)
        if type(admitted) is not a.Admitted or type(admitted.value) is not Manifest:
            if isinstance(admitted, a.Refused):
                state.fail(admitted)
                raise _Stop
            state.stop("manifest-return", "Manifest", "typed admission result required")
        manifest = admitted.value
        source = _root(source_root, "SourceRoot")
        state.source = source
        assert type(raw_manifest) is bytes
        parent = _root(output_parent, "OutputParent")
        if type(attempt_name) is not str or _NAME.fullmatch(attempt_name) is None:
            state.stop(
                "driver-name", "AttemptName", "one bounded path component required"
            )
        attempt = parent / attempt_name
        state.attempt = attempt
        if (
            not isinstance(dotnet, Path)
            or not dotnet.is_absolute()
            or "\x00" in str(dotnet)
            or dotnet.resolve(strict=True) != dotnet
        ):
            state.stop("driver-host", "Dotnet", "canonical existing host Path required")
        protected = [
            state.source,
            dotnet,
            *(state.source / row.Path for row in manifest.Sources),
            *(state.source / row.Role for row in manifest.Native[1:]),
        ]
        if any(
            state.attempt == path or state.attempt in path.parents for path in protected
        ):
            state.stop(
                "driver-overlap",
                "AttemptRoot",
                "attempt must not contain protected source or host paths",
            )
        reservation_call = state.observe(
            "reserve", lambda: _reserve(manifest, len(raw_manifest))
        )
        reservation = state.returned(reservation_call)
        if (
            type(reservation) is not a.Admitted
            or type(reservation.value) is not Reservation
        ):
            state.fail(
                reservation
                if isinstance(reservation, a.Refused)
                else a.Refused(
                    "reservation-return", "Driver", "typed reservation required"
                )
            )
            raise _Stop
        admitted_reservation = reservation.value
        state.reservation = admitted_reservation
        creation = state.observe(
            "create-attempt", lambda: storage.create_directory(parent, attempt_name)
        )
        created = state.returned(creation)
        if type(created) is not a.Admitted or created.value != attempt_name:
            state.fail(
                created
                if isinstance(created, a.Refused)
                else a.Refused(
                    "attempt-return", "AttemptRoot", "exclusive creation failed"
                )
            )
            raise _Stop
        state.owned = True
        state.put("manifest.json", raw_manifest, raw=True)
        scan = state.observe(
            "source-snapshot-1", lambda: _source_snapshot(source, manifest)
        )
        state.sources.append(scan)
        first = state.returned(scan)
        if type(first) is not SourceSnapshot:
            state.stop("snapshot-return", "Sources", "typed source snapshot required")
        if not first.Complete:
            state.fail(
                first.Failure
                or a.Refused("source-snapshot", "Sources", "incomplete snapshot")
            )
        state.put("source-snapshot-1.json", _snapshot_report(first))
        if state.failure is not None:
            raise _Stop
        pins = {
            row.Role: process.FileIdentity(row.Bytes, row.Sha256)
            for row in manifest.Native
        }
        state.preparation = state.observe(
            "prepare-native",
            lambda: process.prepare_native(
                source, attempt / "native-custody", dotnet, pins
            ),
        )
        prepared = state.returned(state.preparation)
        if type(prepared) is not process.PreparedNative:
            state.stop(
                "preparation-return",
                "PreparedNative",
                "actual typed native preparation required",
            )
        if not prepared.Complete:
            state.fail(
                a.Refused("native-preparation", "PreparedNative", str(prepared.Failure))
            )
        state.put("prepared-native.json", prepared)
        if state.failure is not None:
            raise _Stop
        state.opened = state.observe(
            "open-store",
            lambda: store.open_store(attempt, "records", admitted_reservation.Inner),
        )
        opened = state.returned(state.opened)
        if type(opened) is not store.Opened:
            state.fail(
                opened.Failure
                if isinstance(opened, store.OpenFailed)
                else a.Refused(
                    "store-open-return", "Store", "typed store opening required"
                )
            )
            raise _Stop
        target = opened.Store
        scan = state.observe(
            "source-snapshot-2", lambda: _source_snapshot(source, manifest)
        )
        state.sources.append(scan)
        second = state.returned(scan)
        if type(second) is not SourceSnapshot:
            state.stop("snapshot-return", "Sources", "typed source snapshot required")
        if not second.Complete:
            state.fail(
                second.Failure
                or a.Refused("source-snapshot", "Sources", "incomplete snapshot")
            )
        state.put("source-snapshot-2.json", _snapshot_report(second))
        if state.failure is not None:
            raise _Stop
        bindings = dict(manifest.Bindings)
        native_entries = 0

        def native(request: runner.Request) -> object:
            nonlocal native_entries
            if (
                type(request) is not runner.Request
                or request.Bindings != bindings
                or native_entries >= NATIVE_CALLS
            ):
                return process.NativeObservation(
                    Failure=process.ProcessFailure(
                        "driver",
                        "RequestBinding",
                        "fixed request and unchanged binding expectation required",
                    )
                )
            native_entries += 1
            call = state.observe(
                "native-service",
                lambda: process.launch_native(
                    prepared,
                    request.RawInput,
                    request.InputSha256,
                    request.NumericId,
                    dict(manifest.Bindings),
                    attempt / f"native-call-{request.Index:03}",
                ),
            )
            if call.Raised is not None:
                return process.NativeObservation(
                    Failure=process.ProcessFailure(
                        "driver", "NativeRaised", call.Raised.Message
                    )
                )
            return call.Returned

        base_services = runner.reference_services(native)

        def root(request: runner.Request) -> object:
            if type(request) is not runner.Request or request.Bindings != bindings:
                return a.Refused(
                    "driver-binding",
                    "ReferenceRoot",
                    "unchanged independently admitted bindings required",
                )
            return base_services.ReferenceRoot(
                replace(request, Bindings=dict(manifest.Bindings))
            )

        def certificate(request: runner.Request) -> object:
            if type(request) is not runner.Request or request.Bindings != bindings:
                return a.Refused(
                    "driver-binding",
                    "CertifyNative",
                    "unchanged independently admitted bindings required",
                )
            return base_services.CertifyNative(
                replace(request, Bindings=dict(manifest.Bindings))
            )

        services = runner.Services(native, root, certificate)
        state.run = state.observe(
            "run-comparison",
            lambda: runner.run_comparison(target, dict(manifest.Bindings), services),
        )
        actual = state.returned(state.run)
        if type(actual) is not runner.RunResult:
            state.stop("run-return", "Run", "actual typed RunResult required")
        if actual.PrimaryFailure is not None:
            state.fail(actual.PrimaryFailure)
        elif not actual.CollectionAndCriteriaPassed:
            state.fail(
                a.Refused(
                    "run-incomplete",
                    "Run",
                    "fixed collection/criteria did not complete",
                )
            )
    except _AdmissionStop as error:
        state.fail(error.failure)
    except _Stop:
        pass
    except Exception as error:  # noqa: BLE001 - preserve all admitted actual prefixes
        state.fail(
            a.Refused("driver-unexpected", "Driver", f"{type(error).__name__}: {error}")
        )
    if target is not None and state.run is None:
        state.setup_finalization = state.observe(
            "setup-finalization", lambda: store.finalize(target)
        )
        if (
            state.setup_finalization.Raised is not None
            or type(state.setup_finalization.Returned) is not store.Finalized
        ):
            state.fail(
                a.Refused(
                    "setup-finalization", "Store", "actual setup finalization failed"
                )
            )
    if state.owned:
        try:
            state.put("outer-final.json", _outer(state))
        except _Stop:
            pass
        except Exception as error:  # noqa: BLE001 - no recursive publication retry
            state.fail(
                a.Refused(
                    "outer-publication", "Outer", f"{type(error).__name__}: {error}"
                )
            )
    return state.result()


def cli(argv: object) -> DriverResult | a.Refused:
    """Exactly six named arguments; no case, operation or outcome selection."""
    names = (
        "--source-root",
        "--manifest",
        "--manifest-sha256",
        "--output-parent",
        "--attempt",
        "--dotnet",
    )
    try:
        if (
            type(argv) is not list
            or len(argv) != 12
            or any(type(value) is not str for value in argv)
        ):
            return a.Refused(
                "cli-arguments", "Argv", "six exact named arguments required"
            )
        if (
            sum(len(value.encode("utf-8")) for value in argv) > MANIFEST_CAP
            or tuple(argv[::2]) != names
        ):
            return a.Refused(
                "cli-arguments",
                "Argv",
                "fixed argument order and 64-KiB bound required",
            )
        values = dict(zip(names, argv[1::2], strict=True))
        path = Path(values["--manifest"])
        if (
            not path.is_absolute()
            or "\x00" in str(path)
            or path.resolve(strict=True) != path
        ):
            return a.Refused(
                "cli-manifest", "Manifest", "canonical existing manifest file required"
            )
        size = path.stat().st_size
        observation = _observe(
            "cli-manifest-read",
            lambda: storage.read_exact(
                path.parent, path.name, expected_bytes=size, maximum_bytes=MANIFEST_CAP
            ),
        )
        read = observation.Returned
        if (
            observation.Raised is not None
            or type(read) is not a.Admitted
            or type(read.value) is not bytes
        ):
            state = _Driver(None, values["--manifest-sha256"])
            state.calls.append(observation)
            state.fail(
                read
                if isinstance(read, a.Refused)
                else a.Refused(
                    "cli-read", "Manifest", "actual read did not return exact bytes"
                )
            )
            return replace(state.result(), ManifestRead=observation)
        actual = drive(
            read.value,
            values["--manifest-sha256"],
            Path(values["--source-root"]),
            Path(values["--output-parent"]),
            values["--attempt"],
            Path(values["--dotnet"]),
        )
        return replace(actual, ManifestRead=observation)
    except Exception as error:  # noqa: BLE001 - typed command admission errors
        return a.Refused("cli-unexpected", "Argv", f"{type(error).__name__}: {error}")


def main() -> int:
    actual = cli(sys.argv[1:])
    if isinstance(actual, a.Refused):
        summary: object = {
            "Complete": False,
            "Failure": actual,
            "ActualDriverReturnAvailable": False,
        }
        code = 2
    else:
        summary = {
            "Complete": actual.Complete,
            "Failure": actual.Failure,
            "AttemptRoot": actual.AttemptRoot,
            "ActualDriverReturnAvailable": True,
            "FullActualResult": "memory-only; outer-final.json is a bounded reference envelope",
        }
        code = 0 if actual.Complete else 2
    encoded = encoding.encode_public_result(summary, maximum_bytes=MANIFEST_CAP)
    if not isinstance(encoded, a.Admitted):
        return 2
    try:
        written = sys.stdout.buffer.write(encoded.value)
        if type(written) is not int or written != len(encoded.value):
            return 2
        sys.stdout.buffer.flush()
    except Exception:  # noqa: BLE001 - no second publication or execution attempt
        return 2
    return code


if __name__ == "__main__":
    raise SystemExit(main())
