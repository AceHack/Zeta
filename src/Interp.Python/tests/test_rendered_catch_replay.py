"""Exact native/reference hand parity and hostile receipt admission checks."""

import copy
import json
import subprocess
from pathlib import Path

import pytest

from zeta_interp.mess3_replay import Stream, domain
from zeta_interp.rendered_catch_carrier import (
    ARMS,
    COUNTS_SHA,
    MODEL_SHA,
    compile_rom,
    run_batch,
    sha,
)
from zeta_interp.rendered_catch_replay import (
    PROTOCOL,
    check_batch_shape,
    exact,
    parse,
    replay,
    source_receipt,
    write_new,
)

ROOT = Path(__file__).resolve().parents[3]


def model():
    return json.loads(
        (ROOT / "src/Research.FSharp/rendered-signal-results.json").read_bytes()
    )["Counts"]


@pytest.fixture(scope="module")
def batch():
    return run_batch(
        [bytes([0, 0, 1, 0, 1, 1] * 11)], "dot", "fixed", "order-two", model()
    )


def test_live_native_hand_kernel_matches_every_episode_byte_digest():
    completed = subprocess.run(
        [
            "dotnet",
            "fsi",
            "--warnaserror",
            "--optimize+",
            "src/Research.FSharp/check-rendered-catch-kernel.fsx",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
        timeout=180,
    )
    receipt = parse(completed.stdout)
    exact(receipt["Kind"], "hand-conformance-fixture")
    exact(receipt["Protocol"], PROTOCOL)
    exact(receipt["CountsSha256"], COUNTS_SHA)
    exact(receipt["InputSha256"], MODEL_SHA)
    exact(receipt["FairSeed"], 19)
    exact(receipt["FairDomain"], 29)
    symbols = bytes([0, 0, 1, 0, 1, 1] * 11)
    exact(receipt["Symbols"], "001011" * 11)
    expected_rows = []
    for geometry, palette in (
        ("dot", "fixed"),
        ("bar", "fixed"),
        ("dot", "odd-complement"),
    ):
        arms = []
        for name in ARMS:
            rng = Stream(domain(19, 29)) if name == "fair-independent" else None
            arms.append(
                {
                    "Name": name,
                    "Batch": run_batch(
                        [symbols], geometry, palette, name, model(), rng
                    ),
                }
            )
        expected_rows.append(
            {
                "Geometry": geometry,
                "Palette": palette,
                "RomSha256": sha(compile_rom(symbols, geometry)),
                "Arms": arms,
            }
        )
    exact(receipt["Rows"], expected_rows)


def test_compact_batch_admission_is_not_a_vacuous_join(batch):
    check_batch_shape(batch, 1, 0, "order-two")
    for mutation in (
        "missing",
        "duplicate",
        "bool-index",
        "bool-counter",
        "bad-hash",
        "bad-hit",
        "wrong-sum",
        "nan-mean",
        "extra",
    ):
        changed = copy.deepcopy(batch)
        episode = changed["Episodes"][0]
        if mutation == "missing":
            changed["Episodes"] = []
        elif mutation == "duplicate":
            changed["Episodes"].append(copy.deepcopy(episode))
        elif mutation == "bool-index":
            episode["Index"] = False
        elif mutation == "bool-counter":
            episode["Counters"]["Episodes"] = True
        elif mutation == "bad-hash":
            episode["FrameSha256"] = "0" * 63
        elif mutation == "bad-hit":
            episode["Hits"] = "2" + episode["Hits"][1:]
        elif mutation == "wrong-sum":
            changed["TotalHits"] += 1
        elif mutation == "nan-mean":
            changed["MeanHitFraction"] = float("nan")
        else:
            changed["Unverified"] = True
        with pytest.raises(ValueError):
            check_batch_shape(changed, 1, 0, "order-two")


@pytest.mark.parametrize(
    "key",
    [
        "Actions",
        "Hits",
        "Observations",
        "FrameSha256",
        "ProjectionSha256",
        "ShadowTraceSha256",
    ],
)
def test_exact_replay_refuses_semantic_and_digest_mutations(batch, key):
    changed = copy.deepcopy(batch)
    value = changed["Episodes"][0][key]
    changed["Episodes"][0][key] = ("1" if value[0] == "0" else "0") + value[1:]
    with pytest.raises(ValueError):
        exact(changed, batch)


def test_cost_corpus_indices_and_stream_hash_bytes(batch):
    changed = copy.deepcopy(batch)
    changed["Episodes"][0]["Index"] = 8
    check_batch_shape(changed, 1, 8, "order-two")
    with pytest.raises(ValueError):
        check_batch_shape(changed, 1, 0, "order-two")
    rows = [bytes(66), bytes([1]) * 66]
    receipt = source_receipt(rows, 7, 11, "bar")
    assert receipt["SourceSymbolsSha256"] == sha(b"".join(rows))
    assert receipt["SourceRomSha256"] == sha(
        b"".join(compile_rom(row, "bar") for row in rows)
    )
    assert receipt["SourceSymbolsSha256"] != sha(
        "".join(sha(row) for row in rows).encode()
    )


def test_archival_admission_precedes_input_parse_and_replay(monkeypatch):
    import zeta_interp.rendered_catch_replay as module

    def refuse(*args):
        raise ValueError("source not archived")

    def never(*args):
        pytest.fail("ran expensive replay before source admission")

    monkeypatch.setattr(module, "source_manifest", refuse)
    monkeypatch.setattr(module, "run_batch", never)
    with pytest.raises(ValueError, match="not archived"):
        replay(b"not-json", b"not-json", ROOT)


def test_own_module_origin_and_invocation_are_admitted_before_git(tmp_path):
    from zeta_interp.rendered_catch_replay import source_manifest

    with pytest.raises(ValueError, match="outside admitted root"):
        source_manifest(tmp_path, ["native.json", "cost.json", "replay.json"])
    with pytest.raises(ValueError, match="nonempty invocation"):
        source_manifest(ROOT, [])


def test_own_commit_must_contain_the_claimed_source_bytes(monkeypatch):
    import zeta_interp.rendered_catch_replay as module

    monkeypatch.setattr(
        module,
        "admitted_sources",
        lambda root: (
            "a" * 40,
            [{"File": "example.py", "Sha256": sha(b"admitted bytes")}],
        ),
    )

    def fake_git(root, *args):
        return (
            b"b" * 40 if args == ("rev-parse", "HEAD") else b"different committed bytes"
        )

    monkeypatch.setattr(module, "git", fake_git)
    with pytest.raises(ValueError, match="HEAD differs"):
        module.source_manifest(ROOT, ["native.json", "cost.json", "replay.json"])


@pytest.mark.parametrize("raw", [b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":Infinity}'])
def test_json_duplicates_and_nonfinite_literals_refuse(raw):
    with pytest.raises(ValueError):
        parse(raw)


def test_no_clobber_publication_preserves_existing_receipts_and_partial(tmp_path):
    path = tmp_path / "receipt.json"
    write_new(path, {"Complete": False})
    before = path.read_bytes()
    with pytest.raises(ValueError, match="overwrite"):
        write_new(path, {"Complete": True})
    assert path.read_bytes() == before
    next_path = tmp_path / "next.json"
    partial = tmp_path / "next.json.partial"
    partial.write_bytes(b"failed-attempt")
    with pytest.raises(FileExistsError):
        write_new(next_path, {"Complete": True})
    assert partial.read_bytes() == b"failed-attempt"


def test_exact_comparison_rejects_boolean_numeric_alias_and_extra_rosters():
    for actual, expected in (
        (True, 1),
        (False, 0.0),
        (1.0, 1),
        ([1, 2], [1]),
        ({"a": 1, "b": 2}, {"a": 1}),
    ):
        with pytest.raises(ValueError):
            exact(actual, expected)
