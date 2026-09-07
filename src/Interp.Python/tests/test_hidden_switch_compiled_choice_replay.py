"""Binary invocation mutations on explicit hand tuples; no study source draws."""

from __future__ import annotations

import struct
from dataclasses import replace
from typing import Any

import pytest

from zeta_interp import hidden_switch_compiled_certificate as c
from zeta_interp import hidden_switch_compiled_choice_replay as replay
from zeta_interp import hidden_switch_compiled_ieee as s
from zeta_interp import hidden_switch_compiled_reference as r

SOURCE = "A" * 64
RUNTIME = "B" * 64


def value[T](result: s.Result[T]) -> T:
    assert isinstance(result, s.Success), result
    return result.value


@pytest.fixture(scope="module")
def certificate() -> c.VerifiedCertificate:
    bindings = {"ProtocolSha256": c.PROTOCOL_SHA256, "hand/source.py": SOURCE}
    return value(c.verify_certificate(value(c.build_certificate(bindings)), bindings))


@pytest.fixture(scope="module")
def cycle(certificate: c.VerifiedCertificate) -> tuple[replay.ChoiceInput, ...]:
    middle = certificate.Guards[0].SmaxBits + 1
    return (
        replay.ChoiceInput("0000000000000000", True, 2),
        replay.ChoiceInput("8000000000000000", True, 2),
        replay.ChoiceInput(f"{middle:016X}", True, 2),
        replay.ChoiceInput("3FF0000000000000", True, 3),
        replay.ChoiceInput("0000000000000001", False, 3),
        replay.ChoiceInput("0000000000000000", True, 2),
    )


def buffer(
    certificate: c.VerifiedCertificate,
    cycle: tuple[replay.ChoiceInput, ...],
    strategy: str,
    passes: int,
) -> bytes:
    records = []
    for item in cycle:
        result = (
            r.native_choice(int(item.BeliefBits, 16), item.Effect, item.Depth)
            if strategy == "native-recursive"
            else r.compiled_choice(
                certificate, int(item.BeliefBits, 16), item.Effect, item.Depth
            )
        )
        records.append(value(r.encode_choice(value(result))))
    return b"".join(records) * passes


def run(
    raw: object,
    cycle: object,
    certificate: object,
    *,
    passes: object = 3,
    strategy: object = "compiled-guarded",
    source: object = SOURCE,
    runtime: object = RUNTIME,
) -> s.Result[replay.BufferReplayCounts]:
    return replay.replay_choice_buffer(
        raw,
        cycle,
        passes,
        certificate,
        strategy,
        source_manifest_sha256=source,
        native_runtime_sha256=runtime,
    )


@pytest.mark.parametrize("strategy", r.STRATEGIES)
def test_every_record_and_duplicate_position_is_checked(
    certificate: c.VerifiedCertificate,
    cycle: tuple[replay.ChoiceInput, ...],
    strategy: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw = buffer(certificate, cycle, strategy, 3)
    calls = []
    native, compiled = r.native_choice, r.compiled_choice

    def native_spy(belief: object, effect: object, depth: object) -> s.Result[r.Choice]:
        calls.append((belief, effect, depth))
        return native(belief, effect, depth)

    def compiled_spy(
        cert: object, belief: object, effect: object, depth: object
    ) -> s.Result[r.Choice]:
        calls.append((belief, effect, depth))
        return compiled(cert, belief, effect, depth)

    def forbidden(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("binary replay must not call a source or episode runner")

    monkeypatch.setattr(r, "native_choice", native_spy)
    monkeypatch.setattr(r, "compiled_choice", compiled_spy)
    monkeypatch.setattr(r, "source_tapes", forbidden)
    monkeypatch.setattr(r, "run_episode", forbidden)
    counts = value(run(raw, cycle, certificate, strategy=strategy))
    assert (counts.Calls, counts.Bytes, counts.TuplePositions, counts.Passes) == (
        18,
        504,
        6,
        3,
    )
    assert counts.DistinctTuples == len(calls) == 5
    assert len({(belief, effect, depth) for belief, effect, depth in calls}) == 5
    assert calls[0][0] == 0 and calls[1][0] == 1 << 63
    assert (counts.SourceManifestSha256, counts.NativeRuntimeSha256) == (
        SOURCE,
        RUNTIME,
    )
    assert counts.NumericCertificateSha256 == certificate.NumericSha256
    assert sum(counts.PathCounts) == 18
    observed = list(struct.iter_unpack("<BBH6I", raw))
    assert counts.WorkTotals == tuple(
        sum(row[i] for row in observed) for i in range(3, 9)
    )
    assert counts.Scope == "one-cyclic-choice-buffer-only"
    assert counts.RuntimeAndOuterAdmission == "not-performed-by-pure-replay"


@pytest.mark.parametrize("offset", range(28))
def test_all_bytes_in_a_late_repeated_record_are_load_bearing(
    certificate: c.VerifiedCertificate,
    cycle: tuple[replay.ChoiceInput, ...],
    offset: int,
) -> None:
    mutated = bytearray(buffer(certificate, cycle, "compiled-guarded", 3))
    mutated[17 * 28 + offset] ^= 1
    result = run(bytes(mutated), cycle, certificate)
    assert isinstance(result, replay.BufferReplayFailure)
    assert (result.Code, result.Path, result.CompletedCalls, result.CompletedBytes) == (
        "ChoiceMismatch",
        "Choices[17]",
        17,
        17 * 28,
    )


@pytest.mark.parametrize(
    "mutation", ["truncate", "append", "reorder", "duplicate", "mutable"]
)
def test_record_length_and_order_refuse(
    certificate: c.VerifiedCertificate,
    cycle: tuple[replay.ChoiceInput, ...],
    mutation: str,
) -> None:
    raw = buffer(certificate, cycle, "compiled-guarded", 3)
    variants: dict[str, object] = {
        "truncate": raw[:-1],
        "append": raw + b"\x00",
        "reorder": raw[56:84] + raw[28:56] + raw[:28] + raw[84:],
        "duplicate": raw[:56] + raw[:28] + raw[84:],
        "mutable": bytearray(raw),
    }
    assert isinstance(
        run(variants[mutation], cycle, certificate), replay.BufferReplayFailure
    )


@pytest.mark.parametrize("bad", [True, False, 0, -1, 1.0, "3", 65_537])
def test_invalid_pass_counts_refuse(
    certificate: c.VerifiedCertificate, bad: object
) -> None:
    cycle = (replay.ChoiceInput("0000000000000000", False, 1),)
    result = run(b"", cycle, certificate, passes=bad)
    assert isinstance(result, replay.BufferReplayFailure)
    assert result.Code == "PassCount"


@pytest.mark.parametrize(
    "bad",
    [
        None,
        [],
        (),
        ({},),
        (object(),),
        (replay.ChoiceInput("0", True, 2),),
        (replay.ChoiceInput("7FF0000000000000", True, 2),),
        (replay.ChoiceInput("0000000000000000", 1, 2),),  # type: ignore[arg-type]
        (replay.ChoiceInput("0000000000000000", True, True),),
    ],
)
def test_invalid_tuple_rosters_refuse(
    certificate: c.VerifiedCertificate, bad: object
) -> None:
    length = len(bad) if isinstance(bad, tuple) else 1
    assert isinstance(
        run(b"\x00" * 28 * length, bad, certificate, passes=1),
        replay.BufferReplayFailure,
    )


def test_registered_maximum_is_checked_without_truncating(
    certificate: c.VerifiedCertificate,
) -> None:
    cycle = (replay.ChoiceInput("0000000000000000", False, 1),) * 1024
    raw = buffer(certificate, cycle, "compiled-guarded", 64)
    counts = value(run(raw, cycle, certificate, passes=64))
    assert counts.Calls == 65_536 and counts.Bytes == 65_536 * 28
    assert counts.DistinctTuples == 1 and counts.PathCounts == (0, 0, 0, 65_536, 0)
    assert isinstance(
        run(raw, cycle, certificate, passes=65), replay.BufferReplayFailure
    )
    assert isinstance(
        run(raw, cycle + cycle[:1], certificate, passes=64), replay.BufferReplayFailure
    )


def test_bad_identities_certificate_and_unsupported_mode_refuse(
    certificate: c.VerifiedCertificate,
    cycle: tuple[replay.ChoiceInput, ...],
) -> None:
    raw = buffer(certificate, cycle, "compiled-guarded", 3)
    for field in ("source", "runtime"):
        for invalid in (True, "a" * 64, "A" * 63, None):
            assert isinstance(
                run(raw, cycle, certificate, **{field: invalid}),
                replay.BufferReplayFailure,
            )
    for invalid_certificate in (None, replace(certificate), object()):
        assert isinstance(
            run(raw, cycle, invalid_certificate), replay.BufferReplayFailure
        )
    for strategy in ("unsupported-runtime", "native", True, None):
        assert isinstance(
            run(raw, cycle, certificate, strategy=strategy), replay.BufferReplayFailure
        )


def test_local_cache_cannot_hide_later_reference_or_identity_changes(
    certificate: c.VerifiedCertificate,
    cycle: tuple[replay.ChoiceInput, ...],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw = buffer(certificate, cycle, "compiled-guarded", 3)
    value(run(raw, cycle, certificate))
    monkeypatch.setattr(
        r,
        "compiled_choice",
        lambda *args: s.Failure(
            "ReferenceWitness", "changed reference must execute again"
        ),
    )
    result = run(raw, cycle, certificate, source="C" * 64, runtime="D" * 64)
    assert isinstance(result, replay.BufferReplayFailure)
    assert (result.Code, result.Path, result.CompletedCalls) == (
        "ReferenceWitness",
        "Cycle[0]",
        0,
    )
