"""Owned file fixtures and controlled callbacks, never final numerical cases."""

from __future__ import annotations

import hashlib
import json
import sys
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_admission as a
from zeta_interp import hidden_switch_compiled_record_encoding as encoding
from zeta_interp import hidden_switch_compiled_record_store as store
from zeta_interp import hidden_switch_compiled_storage as storage
from zeta_interp import precision_gate_projection_comparison as criteria
from zeta_interp import precision_gate_projection_driver as d
from zeta_interp import precision_gate_projection_process as process
from zeta_interp import precision_gate_projection_run as runner


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest().upper()


def raw_manifest(value: dict[str, Any]) -> bytes:
    return json.dumps(value, ensure_ascii=True, separators=(",", ":")).encode()


@pytest.fixture
def owned(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[Path, Path, Path, dict[str, Any]]:
    source = tmp_path / "source"
    source.mkdir()
    output = tmp_path / "output"
    output.mkdir()
    host = tmp_path / "dotnet-owned-fixture"
    host.write_bytes(b"owned nonexecuted host")
    actual_root = Path(__file__).resolve().parents[3]
    rows = []
    for name in d.SOURCE_PATHS:
        data = ("owned fixture file: " + name).encode()
        if name.endswith(
            (
                "projection-proposed-contract.md",
                "admission-clarification.md",
                "rendered-zero-clarification.md",
            )
        ):
            data = (actual_root / name).read_bytes()
        if name == process.SCRIPT:
            data = b"\n".join(
                (
                    b"#if INTERACTIVE",
                    b'#r "../Core/bin/Release/net10.0/Zeta.Core.dll"',
                    b'#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"',
                    b'#r "../Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll"',
                    b"#endif",
                    b"// Never executed owned source fixture.",
                )
            )
        path = source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        rows.append({"Path": name, "Bytes": len(data), "Sha256": sha(data)})
    native = []
    for role in d.NATIVE_ROLES:
        path = host if role == "@host" else source / role
        if role not in ("@host", process.SCRIPT):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(("owned nonexecuted DLL " + role).encode())
        data = path.read_bytes()
        native.append({"Role": role, "Bytes": len(data), "Sha256": sha(data)})
    # These are declared owned fake source files, not imported task code.
    monkeypatch.setattr(d, "_loaded", lambda root: ((), None))
    manifest = {
        "Schema": d.SCHEMA,
        "ProtocolSha256": criteria.PROTOCOL_SHA256,
        "SourceFiles": rows,
        "NativeFiles": native,
    }
    return source, output, host, manifest


def invoke(
    owned: tuple[Path, Path, Path, dict[str, Any]], name: str = "attempt"
) -> d.DriverResult:
    source, output, host, value = owned
    raw = raw_manifest(value)
    return d.drive(raw, sha(raw), source, output, name, host)


def fake_run(
    target: store.Store, bindings: object, services: runner.Services
) -> runner.RunResult:
    # Actual exclusive Store calls, but zero service, case, policy or solver calls.
    terminal = store.append_bytes(target, "owned-terminal", b'{"OwnedFixture":true}')
    assert isinstance(terminal, store.Stored)
    final = store.finalize(target)
    assert isinstance(final, store.Finalized)
    return runner.RunResult(
        (),
        (),
        None,
        (),
        (),
        (None, terminal),
        final,
        {"Planned": 88, "Entered": 0, "Returned": 0},
        (),
        True,
        True,
        True,
        None,
        "owned-controlled-runner-fixture",
    )


def test_real_source_reads_prepare_copies_and_one_controlled_runner(
    owned: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = []

    def run(
        target: store.Store, bindings: object, services: runner.Services
    ) -> runner.RunResult:
        calls.append(bindings)
        return fake_run(target, bindings, services)

    monkeypatch.setattr(runner, "run_comparison", run)
    actual = invoke(owned)
    assert actual.Complete, actual.Failure
    assert len(calls) == 1
    assert actual.Admission is not None
    admission = actual.Admission.Returned
    assert isinstance(admission, a.Admitted) and isinstance(admission.value, d.Manifest)
    assert calls[0] == dict(admission.value.Bindings)
    assert len(actual.Sources) == 2
    assert all(
        isinstance(c.Returned, d.SourceSnapshot) and len(c.Returned.Reads) == 47
        for c in actual.Sources
    )
    assert actual.Preparation is not None and isinstance(
        actual.Preparation.Returned, process.PreparedNative
    )
    assert actual.Run is not None and isinstance(actual.Run.Returned, runner.RunResult)
    assert actual.Reservation is not None
    assert actual.AttemptRoot is not None
    assert actual.Preparation.Returned.Complete
    assert len(actual.Preparation.Returned.CreatedFiles) == 4
    assert len(actual.Publications) == 5
    assert actual.Run.Returned.Scope == "owned-controlled-runner-fixture"
    assert actual.Reservation.DriverSlots == 90
    assert (
        actual.Reservation.Inner.CombinedBytes + actual.Reservation.DriverCombinedBytes
        == d.TOTAL_BYTES
    )
    assert actual.Reservation.Inner.Artifacts == 422
    assert actual.Reservation.UnusedReservationsReclaimed is False
    outer = (Path(actual.AttemptRoot) / "outer-final.json").read_bytes()
    assert b'"FullRunResult":"memory-only;' in outer
    assert b'"Entries"' not in outer
    assert not (Path(actual.AttemptRoot) / "native-call-000").exists()


@pytest.mark.parametrize(
    "mutation",
    [
        "hash",
        "missing",
        "extra",
        "reorder",
        "duplicate",
        "bool-length",
        "negative",
        "lower-sha",
        "source-total",
        "native-role",
        "script-identity",
        "protocol",
        "schema",
        "native-extra",
    ],
)
def test_manifest_refusals_before_file_or_runner_entry(
    owned: Any, monkeypatch: pytest.MonkeyPatch, mutation: str
) -> None:
    source, output, host, value = owned
    if mutation == "missing":
        value["SourceFiles"].pop()
    elif mutation == "extra":
        value["Unexpected"] = 1
    elif mutation == "reorder":
        value["SourceFiles"][0], value["SourceFiles"][1] = (
            value["SourceFiles"][1],
            value["SourceFiles"][0],
        )
    elif mutation == "duplicate":
        value["SourceFiles"][1] = dict(value["SourceFiles"][0])
    elif mutation == "bool-length":
        value["SourceFiles"][0]["Bytes"] = True
    elif mutation == "negative":
        value["SourceFiles"][0]["Bytes"] = -1
    elif mutation == "lower-sha":
        value["SourceFiles"][0]["Sha256"] = "a" * 64
    elif mutation == "source-total":
        for row in value["SourceFiles"]:
            row["Bytes"] = d.SOURCE_CAP
    elif mutation == "native-role":
        value["NativeFiles"][0]["Role"] = "@claimed-host"
    elif mutation == "script-identity":
        value["NativeFiles"][1]["Bytes"] += 1
    elif mutation == "protocol":
        value["ProtocolSha256"] = "0" * 64
    elif mutation == "schema":
        value["Schema"] = "producer-chosen"
    elif mutation == "native-extra":
        value["NativeFiles"].append(dict(value["NativeFiles"][0]))
    raw = raw_manifest(value)

    def forbidden(*args: object, **kwargs: object) -> Any:
        pytest.fail("admission must precede all I/O")

    monkeypatch.setattr(storage, "create_directory", forbidden)
    monkeypatch.setattr(runner, "run_comparison", forbidden)
    actual = d.drive(
        raw,
        "0" * 64 if mutation == "hash" else sha(raw),
        source,
        output,
        "attempt",
        host,
    )
    assert actual.Failure is not None
    assert actual.Run is None and actual.Preparation is None
    assert not actual.AttemptOwned


@pytest.mark.parametrize(
    "raw", [b'{"Schema":1,"Schema":2}', b'{"a":NaN}', b'{"a":Infinity}', b"\xff"]
)
def test_strict_json_refusals(raw: bytes) -> None:
    assert isinstance(d.admit_manifest(raw, sha(raw)), a.Refused)


def test_oversize_manifest_refuses_before_hash(monkeypatch: pytest.MonkeyPatch) -> None:
    def forbidden(*args: object, **kwargs: object) -> Any:
        pytest.fail("oversize hash")

    monkeypatch.setattr(hashlib, "sha256", forbidden)
    assert isinstance(
        d.admit_manifest(b"x" * (d.MANIFEST_CAP + 1), "A" * 64), a.Refused
    )


@pytest.mark.parametrize("stage", [1, 2])
def test_changed_source_retains_read_prefix_and_no_runner(
    owned: Any, monkeypatch: pytest.MonkeyPatch, stage: int
) -> None:
    source, _, _, _ = owned
    selected = source / d.SOURCE_PATHS[5]
    if stage == 1:
        selected.write_bytes(b"changed")
    else:
        prepare = process.prepare_native

        def changed(*args: Any, **kwargs: Any) -> process.PreparedNative:
            actual = prepare(*args, **kwargs)
            selected.write_bytes(b"changed")
            return actual

        monkeypatch.setattr(process, "prepare_native", changed)

    def forbidden(*args: object, **kwargs: object) -> Any:
        pytest.fail("changed source must prevent run")

    monkeypatch.setattr(runner, "run_comparison", forbidden)
    actual = invoke(owned)
    assert not actual.Complete and actual.Failure is not None
    assert len(actual.Sources) == stage
    assert isinstance(actual.Sources[-1].Returned, d.SourceSnapshot)
    assert len(actual.Sources[-1].Returned.Reads) == 6
    assert not actual.Sources[-1].Returned.Reads[-1].Matched
    assert actual.Run is None
    assert (actual.SetupFinalization is not None) == (stage == 2)


@pytest.mark.parametrize("mutation", ["fifo", "symlink", "same-length"])
def test_actual_source_file_substitutions(
    owned: Any, monkeypatch: pytest.MonkeyPatch, mutation: str
) -> None:
    import os

    source, _, _, _ = owned
    path = source / d.SOURCE_PATHS[0]
    original = path.read_bytes()
    path.unlink()
    if mutation == "fifo":
        os.mkfifo(path)
    elif mutation == "symlink":
        other = source / "other"
        other.write_bytes(original)
        path.symlink_to(other)
    else:
        path.write_bytes(b"x" * len(original))
    monkeypatch.setattr(
        runner, "run_comparison", lambda *a, **k: pytest.fail("forbidden runner")
    )
    actual = invoke(owned)
    assert actual.Failure is not None and actual.Run is None
    assert isinstance(actual.Sources[0].Returned, d.SourceSnapshot)
    assert len(actual.Sources[0].Returned.Reads) == 1


def test_exclusive_attempt_preserves_existing_file(owned: Any) -> None:
    _, output, _, _ = owned
    attempt = output / "attempt"
    attempt.mkdir()
    marker = attempt / "keep"
    marker.write_bytes(b"unchanged")
    actual = invoke(owned)
    assert not actual.AttemptOwned and actual.Run is None
    assert marker.read_bytes() == b"unchanged"
    assert list(attempt.iterdir()) == [marker]


@pytest.mark.parametrize("kind", ["noncanonical", "nul", "overlap"])
def test_path_refusal_before_attempt(owned: Any, kind: str) -> None:
    source, output, host, value = owned
    raw = raw_manifest(value)
    if kind == "noncanonical":
        source = source / ".." / "source"
    elif kind == "nul":
        source = Path(str(source) + "\x00")
    else:
        output = source
    actual = d.drive(
        raw, sha(raw), source, output, "src" if kind == "overlap" else "attempt", host
    )
    assert actual.Failure is not None and not actual.AttemptOwned


def test_budget_refusal_precedes_all_writes(
    owned: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    source, output, host, value = owned
    for row in value["NativeFiles"][2:]:
        row["Bytes"] = process.FILE_CAP
    raw = raw_manifest(value)
    monkeypatch.setattr(
        storage,
        "create_directory",
        lambda *a: pytest.fail("reservation before write"),
    )
    actual = d.drive(raw, sha(raw), source, output, "attempt", host)
    assert actual.Failure is not None and actual.Failure.code == "reservation"
    assert not actual.AttemptOwned and actual.Run is None


def test_exact_reservation_has_two_copy_charge_and_terminal_room(
    owned: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    raw = raw_manifest(owned[3])
    manifest = d.admit_manifest(raw, sha(raw))
    assert isinstance(manifest, a.Admitted)
    actual = d._reserve(manifest.value, len(raw))
    assert isinstance(actual, a.Admitted)
    copies = sum(row.Bytes for row in manifest.value.Native[1:])
    expected = 2 * (
        copies
        + len(raw)
        + 27 * (2 * d.MANIFEST_CAP + process.RECEIPT_CAP)
        + 4 * d.METADATA_CAP
    )
    assert actual.value.DriverCombinedBytes == expected
    monkeypatch.setattr(
        d, "TOTAL_BYTES", expected + d.JOURNAL_BYTES + d.TERMINAL_RESERVE
    )
    assert isinstance(d._reserve(manifest.value, len(raw)), a.Refused)
    monkeypatch.setattr(
        d, "TOTAL_BYTES", expected + d.JOURNAL_BYTES + d.TERMINAL_RESERVE + 2
    )
    assert isinstance(d._reserve(manifest.value, len(raw)), a.Admitted)


@pytest.mark.parametrize("failure", ["encode", "write", "read"])
def test_actual_run_return_retained_before_outer_publication_failure(
    owned: Any, monkeypatch: pytest.MonkeyPatch, failure: str
) -> None:
    returned = []

    def run(
        target: store.Store, bindings: object, services: runner.Services
    ) -> runner.RunResult:
        actual = fake_run(target, bindings, services)
        returned.append(actual)
        return actual

    monkeypatch.setattr(runner, "run_comparison", run)
    if failure == "encode":
        encode = encoding.encode_public_result

        def broken(value: object, **kwargs: Any) -> Any:
            if (
                isinstance(value, dict)
                and value.get("Schema") == "zeta.precision-projection.driver.v1"
            ):
                return a.Refused("owned-encoding", "Outer", "original encoder refusal")
            return encode(value, **kwargs)

        monkeypatch.setattr(encoding, "encode_public_result", broken)
    elif failure == "write":
        write = storage.write_exclusive

        def broken_write(root: Path, relative: str, raw: bytes) -> Any:
            if relative == "outer-final.json":
                (root / relative).write_bytes(raw[:7])
                return a.Refused(
                    "owned-partial", relative, "original partial write refusal"
                )
            return write(root, relative, raw)

        monkeypatch.setattr(storage, "write_exclusive", broken_write)
    else:
        read = storage.read_exact

        def broken_read(root: Path, relative: str, **kwargs: Any) -> Any:
            if relative == "outer-final.json":
                return a.Refused("owned-read", relative, "original read refusal")
            return read(root, relative, **kwargs)

        monkeypatch.setattr(storage, "read_exact", broken_read)
    actual = invoke(owned)
    assert actual.Run is not None and isinstance(actual.Run.Returned, runner.RunResult)
    assert actual.AttemptRoot is not None
    assert actual.Run.Returned is returned[0]
    assert not actual.Complete
    assert actual.Failure is not None
    assert (
        actual.Failure.code
        == {"encode": "owned-encoding", "write": "owned-partial", "read": "owned-read"}[
            failure
        ]
    )
    assert sum(p.File == "outer-final.json" for p in actual.Publications) == 1
    assert actual.Run.Returned.Finalization is not None
    if failure == "write":
        assert (Path(actual.AttemptRoot) / "outer-final.json").stat().st_size == 7


def test_failed_run_primary_survives_outer_failure(
    owned: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    original = a.Refused("owned-run", "call/0", "original returned failure")

    def run(
        target: store.Store, bindings: object, services: runner.Services
    ) -> runner.RunResult:
        return replace(
            fake_run(target, bindings, services),
            PrimaryFailure=original,
            CollectionAndCriteriaPassed=False,
        )

    monkeypatch.setattr(runner, "run_comparison", run)
    encode = encoding.encode_public_result

    def broken(value: object, **kwargs: Any) -> Any:
        if (
            isinstance(value, dict)
            and value.get("Schema") == "zeta.precision-projection.driver.v1"
        ):
            return a.Refused("late-encode", "Outer", "later")
        return encode(value, **kwargs)

    monkeypatch.setattr(encoding, "encode_public_result", broken)
    actual = invoke(owned)
    assert actual.Failure is original
    assert len(actual.SecondaryFailures) == 1
    assert actual.Run is not None and isinstance(actual.Run.Returned, runner.RunResult)
    assert actual.Run.Returned.PrimaryFailure is original


@pytest.mark.parametrize("kind", ["returned", "raised", "store"])
def test_setup_failure_retains_actual_observation(
    owned: Any, monkeypatch: pytest.MonkeyPatch, kind: str
) -> None:
    original: list[object] = []
    if kind == "returned":

        def prepare(*args: Any) -> process.PreparedNative:
            actual = process.PreparedNative(
                False,
                str(args[1]),
                None,
                None,
                (),
                (),
                (),
                process.ProcessFailure("prepare", "Owned", "actual refusal"),
                (),
            )
            original.append(actual)
            return actual

        monkeypatch.setattr(process, "prepare_native", prepare)
    elif kind == "raised":

        def raises(*args: Any) -> Any:
            raise OSError("owned preparation exception")

        monkeypatch.setattr(process, "prepare_native", raises)
    else:

        def opening(*args: Any) -> store.OpenFailed:
            actual = store.OpenFailed(
                a.Refused("owned-store", "Store", "actual refusal"),
                str(args[0]),
                str(args[1]),
                str(args[0] / args[1]),
                None,
            )
            original.append(actual)
            return actual

        monkeypatch.setattr(store, "open_store", opening)
    actual = invoke(owned)
    assert actual.Run is None and not actual.Complete
    assert actual.Failure is not None
    if kind == "returned":
        assert (
            actual.Preparation is not None
            and actual.Preparation.Returned is original[0]
        )
    elif kind == "raised":
        assert actual.Preparation is not None and actual.Preparation.Raised is not None
        assert actual.Preparation.Raised.Message == "owned preparation exception"
    else:
        assert actual.StoreOpen is not None and actual.StoreOpen.Returned is original[0]
    assert actual.AttemptRoot is not None
    envelope = json.loads((Path(actual.AttemptRoot) / "outer-final.json").read_bytes())
    assert envelope["Run"] is None and envelope["SetupFinalJournal"] is None


def test_actual_local_module_origin_observation_and_foreign_root(
    tmp_path: Path,
) -> None:
    root = Path(__file__).resolve().parents[3]
    modules, failure = d._loaded(root)
    assert failure is None
    assert len(modules) == 14
    assert any(row.Name == d.DRIVER_NAME for row in modules)
    modules, failure = d._loaded(tmp_path)
    assert failure is not None and failure.code == "module-root"
    assert len(modules) == 1


@pytest.mark.parametrize("kind", ["missing", "changed-origin", "duplicate-entry"])
def test_loaded_module_substitution_is_refused(
    monkeypatch: pytest.MonkeyPatch, kind: str
) -> None:
    root = Path(__file__).resolve().parents[3]
    name = "zeta_interp.precision_gate_projection_run"
    if kind == "missing":
        monkeypatch.delitem(sys.modules, name)
    elif kind == "changed-origin":
        module = sys.modules[name]
        monkeypatch.setattr(
            module, "__spec__", SimpleNamespace(origin="/other/clone/run.py")
        )
    else:
        from types import ModuleType

        main = ModuleType("__main__")
        main.__spec__ = SimpleNamespace(name=d.DRIVER_NAME)  # type: ignore[assignment]
        monkeypatch.setitem(sys.modules, "__main__", main)
    _, failure = d._loaded(root)
    assert failure is not None


@pytest.mark.parametrize(
    "argv", [None, [], ["--case", "chosen"], ["x"] * 12, [True] * 12]
)
def test_invalid_cli_never_enters_driver(
    argv: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(d, "drive", lambda *a: pytest.fail("invalid CLI"))
    assert isinstance(d.cli(argv), a.Refused)


def test_cli_reads_exact_independent_manifest_and_forwards(
    owned: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    source, output, host, value = owned
    raw = raw_manifest(value)
    path = output / "expected.json"
    path.write_bytes(raw)
    called = []
    original = d._Driver(raw, sha(raw)).result()

    def supplied(*args: Any) -> d.DriverResult:
        called.append(args)
        return original

    monkeypatch.setattr(d, "drive", supplied)
    result = d.cli(
        [
            "--source-root",
            str(source),
            "--manifest",
            str(path),
            "--manifest-sha256",
            sha(raw),
            "--output-parent",
            str(output),
            "--attempt",
            "attempt",
            "--dotnet",
            str(host),
        ]
    )
    assert isinstance(result, d.DriverResult)
    assert result.ManifestRaw == original.ManifestRaw
    assert result.ManifestRead is not None
    assert isinstance(result.ManifestRead.Returned, a.Admitted)
    assert result.ManifestRead.Returned.value == raw
    assert called == [(raw, sha(raw), source, output, "attempt", host)]


def test_returned_source_read_survives_hash_exception(
    owned: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    source, _, _, value = owned
    raw = raw_manifest(value)
    manifest = d.admit_manifest(raw, sha(raw))
    assert isinstance(manifest, a.Admitted)
    expected = (source / d.SOURCE_PATHS[0]).read_bytes()

    def fails(*args: Any) -> Any:
        raise OSError("owned hash after read")

    monkeypatch.setattr(hashlib, "sha256", fails)
    actual = d._source_snapshot(source, manifest.value)
    assert not actual.Complete
    assert len(actual.Reads) == 1
    assert isinstance(actual.Reads[0].Read.Returned, a.Admitted)
    assert actual.Reads[0].Read.Returned.value == expected


def test_large_source_bodies_are_memory_only_metadata_stays_bounded(
    owned: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    source, _, _, manifest = owned
    relative = "src/Interp.Python/uv.lock"
    body = b"owned source body marker\n" * 60000
    assert len(body) > d.METADATA_CAP
    (source / relative).write_bytes(body)
    row = next(row for row in manifest["SourceFiles"] if row["Path"] == relative)
    row.update(Bytes=len(body), Sha256=sha(body))
    monkeypatch.setattr(runner, "run_comparison", fake_run)
    actual = invoke(owned)
    assert actual.Complete and actual.AttemptRoot is not None
    for observation in actual.Sources:
        assert isinstance(observation.Returned, d.SourceSnapshot)
        observed = next(
            row for row in observation.Returned.Reads if row.Expected.Path == relative
        )
        assert isinstance(observed.Read.Returned, a.Admitted)
        assert observed.Read.Returned.value == body
    for name in ("source-snapshot-1.json", "source-snapshot-2.json"):
        raw = (Path(actual.AttemptRoot) / name).read_bytes()
        assert len(raw) < d.METADATA_CAP
        assert b"owned source body marker" not in raw
        assert b"BytesHex" not in raw
        assert sha(body).encode() in raw


def test_all_three_service_wrappers_receive_same_admitted_expectations(
    owned: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    # These three callbacks return explicit owned nonnumeric objects. Neither
    # reference nor native service is entered; forwarding alone is exercised.
    from zeta_interp import precision_gate_projection_reference as reference

    observed: list[tuple[str, tuple[object, ...], dict[str, object]]] = []
    sentinel = object()

    def root(*args: object, **kwargs: object) -> object:
        observed.append(("root", args, kwargs))
        return sentinel

    def certificate(*args: object, **kwargs: object) -> object:
        observed.append(("certificate", args, kwargs))
        return sentinel

    def native(*args: object, **kwargs: object) -> object:
        observed.append(("native", args, kwargs))
        return sentinel

    monkeypatch.setattr(reference, "reference_root", root)
    monkeypatch.setattr(reference, "certify_native", certificate)
    monkeypatch.setattr(process, "launch_native", native)

    def run(
        target: store.Store, bindings: object, services: runner.Services
    ) -> runner.RunResult:
        assert isinstance(bindings, dict)
        request = runner.Request(
            0,
            "owned-fixture",
            "owned-fixture",
            b"owned-input",
            b"owned-native",
            sha(b"owned-input"),
            dict(bindings),
        )
        assert services.NativeSolve(request) is sentinel
        assert services.ReferenceRoot(request) is sentinel
        assert services.CertifyNative(request) is sentinel
        bad = replace(request, Bindings={**bindings, "ProtocolSha256": "0" * 64})
        rejected = services.NativeSolve(bad)
        assert (
            isinstance(rejected, process.NativeObservation)
            and rejected.Failure is not None
        )
        assert isinstance(services.ReferenceRoot(bad), a.Refused)
        assert isinstance(services.CertifyNative(bad), a.Refused)
        return fake_run(target, bindings, services)

    monkeypatch.setattr(runner, "run_comparison", run)
    actual = invoke(owned)
    assert actual.Complete and actual.Admission is not None
    admission = actual.Admission.Returned
    assert isinstance(admission, a.Admitted) and isinstance(admission.value, d.Manifest)
    expected = dict(admission.value.Bindings)
    assert [row[0] for row in observed] == ["native", "root", "certificate"]
    assert observed[0][1][4] == expected
    assert observed[1][1][1] == expected
    assert observed[2][1][2] == expected
    assert all(
        row[2]["expected_input_sha256"] == sha(b"owned-input") for row in observed[1:]
    )
    assert sum(call.Operation == "native-service" for call in actual.Calls) == 1


@pytest.mark.parametrize("kind", ["wrong-write-type", "wrong-read-type"])
def test_publication_requires_exact_return_types(
    owned: Any, monkeypatch: pytest.MonkeyPatch, kind: str
) -> None:
    monkeypatch.setattr(runner, "run_comparison", fake_run)
    if kind == "wrong-write-type":
        original_write = storage.write_exclusive

        def write(root: Path, relative: str, raw: bytes) -> object:
            returned = original_write(root, relative, raw)
            if relative == "outer-final.json":
                return a.Admitted(float(len(raw)))
            return returned

        monkeypatch.setattr(storage, "write_exclusive", write)
    else:
        original_read = storage.read_exact

        def read(root: Path, relative: str, **kwargs: Any) -> object:
            returned = original_read(root, relative, **kwargs)
            if relative == "outer-final.json" and isinstance(returned, a.Admitted):
                return a.Admitted(bytearray(returned.value))
            return returned

        monkeypatch.setattr(storage, "read_exact", read)
    actual = invoke(owned)
    assert not actual.Complete and actual.Run is not None
    assert actual.Failure is not None
    assert actual.Failure.code == (
        "driver-write" if kind == "wrong-write-type" else "driver-readback"
    )


def test_changed_second_snapshot_links_actual_setup_journal(
    owned: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    source, _, _, _ = owned
    prepare = process.prepare_native

    def changed(*args: Any, **kwargs: Any) -> process.PreparedNative:
        actual = prepare(*args, **kwargs)
        (source / d.SOURCE_PATHS[0]).write_bytes(b"changed after preparation")
        return actual

    monkeypatch.setattr(process, "prepare_native", changed)
    actual = invoke(owned)
    assert (
        actual.Run is None
        and actual.SetupFinalization is not None
        and actual.AttemptRoot is not None
    )
    returned = actual.SetupFinalization.Returned
    assert isinstance(returned, store.Finalized)
    raw = (Path(actual.AttemptRoot) / "outer-final.json").read_bytes()
    assert b"SetupFinalJournal" in raw and returned.Artifact.Sha256.encode() in raw


@pytest.mark.parametrize("kind", ["refused", "raised"])
def test_cli_retains_actual_manifest_read_failure(
    owned: Any, monkeypatch: pytest.MonkeyPatch, kind: str
) -> None:
    source, output, host, value = owned
    raw = raw_manifest(value)
    path = output / "manifest.json"
    path.write_bytes(raw)
    failure = a.Refused("owned-read", "Manifest", "actual read refusal")

    def read(*args: object, **kwargs: object) -> object:
        if kind == "raised":
            raise OSError("actual read exception")
        return failure

    monkeypatch.setattr(storage, "read_exact", read)
    actual = d.cli(
        [
            "--source-root",
            str(source),
            "--manifest",
            str(path),
            "--manifest-sha256",
            sha(raw),
            "--output-parent",
            str(output),
            "--attempt",
            "attempt",
            "--dotnet",
            str(host),
        ]
    )
    assert isinstance(actual, d.DriverResult) and actual.ManifestRead is not None
    assert actual.Run is None and not actual.AttemptOwned
    if kind == "refused":
        assert actual.ManifestRead.Returned is failure and actual.Failure is failure
    else:
        assert actual.ManifestRead.Raised is not None
        assert actual.ManifestRead.Raised.Message == "actual read exception"


def test_cli_stdout_is_small_and_short_write_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    actual = d._Driver(b"owned", "A" * 64).result()
    monkeypatch.setattr(d, "cli", lambda args: actual)
    writes: list[bytes] = []

    class Buffer:
        def write(self, raw: bytes) -> int:
            writes.append(raw)
            return len(raw) - 1

        def flush(self) -> None:
            pytest.fail("short write must stop without another publication")

    monkeypatch.setattr(sys, "stdout", SimpleNamespace(buffer=Buffer()))
    assert d.main() == 2
    assert len(writes) == 1 and len(writes[0]) < d.MANIFEST_CAP
    assert b"ManifestRaw" not in writes[0] and b"RunResult" not in writes[0]


@pytest.mark.parametrize("stage", ["complete", "setup-failed"])
def test_outer_inner_artifact_links_resolve_against_attempt_root(
    owned: Any, monkeypatch: pytest.MonkeyPatch, stage: str
) -> None:
    if stage == "complete":
        monkeypatch.setattr(runner, "run_comparison", fake_run)
    else:
        source, _, _, _ = owned
        prepare = process.prepare_native

        def changed(*args: Any, **kwargs: Any) -> process.PreparedNative:
            actual = prepare(*args, **kwargs)
            (source / d.SOURCE_PATHS[0]).write_bytes(b"owned setup failure")
            return actual

        monkeypatch.setattr(process, "prepare_native", changed)
    actual = invoke(owned)
    assert actual.AttemptRoot is not None
    root = Path(actual.AttemptRoot)
    envelope = json.loads((root / "outer-final.json").read_bytes())
    assert envelope["AttemptRoot"] == str(root)
    if stage == "complete":
        descriptors = [envelope["Run"]["Terminal"], envelope["Run"]["FinalJournal"]]
    else:
        descriptors = [envelope["SetupFinalJournal"]]
    for descriptor in descriptors:
        fields = descriptor["Fields"]
        assert Path(fields["File"]).parts[0] == "records"
        raw = (root / fields["File"]).read_bytes()
        assert len(raw) == fields["StoredBytes"] and sha(raw) == fields["StoredSha256"]
