"""Finite-witness replay admission and counterexample regression discriminators."""

import copy
import json

import pytest

from zeta_interp import finite_stochastic_bridge as bridge


@pytest.fixture(scope="module")
def native():
    report = bridge.reference()
    report["Arithmetic"] = {
        "OperandLimit": 1000000,
        "MaximumAbsoluteNumerator": 1000,
        "MaximumDenominator": 1000,
        "Refusals": 0,
    }
    return {
        "Complete": True,
        "Failure": {"Stage": "", "Detail": ""},
        "Protocol": "finite-stochastic-cqm-bridge-v1",
        "Provenance": {},
        "Runtime": "fixture runtime",
        "OperatingSystem": "fixture OS",
        "LoadedAssemblies": [
            {
                "Name": name,
                "Mvid": "00000000-0000-0000-0000-000000000000",
                "Sha256": "0" * 64,
            }
            for name in ("Zeta.Core", "Zeta.Core.Abstractions")
        ],
        "Report": report,
    }


def test_fixed_roster_and_exact_negative_discriminators(native):
    replay = bridge.verify(native, {})
    assert replay["Passed"] is True
    assert replay["Checks"] == 14
    assert replay["Cases"] == 957
    rows = {row["Name"]: row["Cases"][0] for row in native["Report"]["Checks"]}
    assert rows["naive quantum identity refusal"]["Left"][1:] == ["false", "1/2"]
    assert rows["signed normalized refusal"]["Left"][2] == "-1/1"
    assert rows["positive but not CP"]["Left"][-1] == "1x1:-1/1"


@pytest.mark.parametrize("row", range(14))
def test_every_retained_row_is_recomputed_not_trusted(native, row):
    changed = copy.deepcopy(native)
    changed["Report"]["Checks"][row]["Cases"][0]["Left"][0] = "fabricated"
    with pytest.raises(ValueError, match="case evidence"):
        bridge.verify(changed, {})


@pytest.mark.parametrize(
    "mutation",
    (
        lambda r: r["Report"].update(Complete=1),
        lambda r: r["Report"].update(Version=True),
        lambda r: r["Report"]["Checks"].pop(),
        lambda r: r["Report"]["Checks"].reverse(),
        lambda r: r["Report"]["Checks"][0]["Cases"].pop(),
        lambda r: r["Report"]["Checks"][0]["Cases"][0].update(Passed=1),
        lambda r: r["Report"]["Arithmetic"].update(Refusals=1),
        lambda r: r["Report"]["Arithmetic"].update(OperandLimit=1000001),
        lambda r: r["Report"]["Arithmetic"].update(MaximumAbsoluteNumerator=1000001),
        lambda r: r["Provenance"].update(SourceCommit="invented"),
        lambda r: r["LoadedAssemblies"].pop(),
        lambda r: r["LoadedAssemblies"][0].update(Sha256="not-a-hash"),
        lambda r: r["LoadedAssemblies"][0].update(Mvid="x" * 36),
        lambda r: r["Report"]["Arithmetic"].update(MaximumAbsoluteNumerator=1),
        lambda r: r["Report"]["Arithmetic"].update(MaximumDenominator=1),
    ),
)
def test_missing_roster_malformed_types_and_refusals_cannot_pass(native, mutation):
    changed = copy.deepcopy(native)
    mutation(changed)
    with pytest.raises(ValueError):
        bridge.verify(changed, {})


def test_partial_transpose_negative_direction_discriminates_plain_transpose():
    bell = bridge.mat(
        [
            [bridge.F(1, 2) if r in (0, 3) and c in (0, 3) else 0 for c in range(4)]
            for r in range(4)
        ]
    )
    vector = bridge.col([0, 1, -1, 0])
    wrong = bridge.mul(bridge.tr(vector), bridge.mul(bridge.tr(bell), vector))
    assert wrong[0][0] == 0  # Whole-system transpose would erase the negative witness.


@pytest.mark.parametrize(
    "raw",
    [
        b'{"Complete":false,"Complete":true}',
        b'{"Passed":true,"Passed":false}',
        b'{"Provenance":{"SourceCommit":"a","SourceCommit":"b"}}',
        b'{"x":NaN}',
        b'{"x":Infinity}',
    ],
)
def test_duplicate_keys_and_nonfinite_constants_refuse(raw):
    with pytest.raises(ValueError):
        bridge.decode(raw)


def test_source_admission_requires_archive_bytes(tmp_path):
    for path in bridge.SOURCE_FILES:
        target = tmp_path / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(path + "\n")
    bridge.git(tmp_path, "init", "--quiet")
    bridge.git(tmp_path, "add", ".")
    bridge.git(
        tmp_path,
        "-c",
        "user.name=fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-qm",
        "fixture",
    )
    for name in (bridge.ARCHIVE, bridge.CONTRACT_ARCHIVE):
        bridge.git(tmp_path, "tag", name.removeprefix("refs/tags/"))
    assert len(bridge.source_admission(tmp_path)["SourceHashes"]) == len(
        bridge.SOURCE_FILES
    )
    (tmp_path / bridge.SOURCE_FILES[-1]).write_text("unarchived change\n")
    with pytest.raises(ValueError, match="unarchived source bytes"):
        bridge.source_admission(tmp_path)


@pytest.mark.parametrize(
    "failure_stage", ["source-admission", "input-read", "input-decode"]
)
def test_cli_publishes_staged_failures_exclusively(
    tmp_path, monkeypatch, failure_stage
):
    source = tmp_path / "input.json"
    output = tmp_path / "failure.json"
    if failure_stage != "input-read":
        source.write_bytes(b'{"Complete":false,"Complete":true}')

    def admission(_root):
        if failure_stage == "source-admission":
            raise ValueError("fixture archive refusal")
        return {}

    monkeypatch.setattr(bridge, "source_admission", admission)
    monkeypatch.setattr(bridge.sys, "argv", ["reference", str(source), str(output)])
    assert bridge.main() == 1
    receipt_bytes = output.read_bytes()
    receipt = json.loads(receipt_bytes)
    assert receipt["Complete"] is False
    assert receipt["Failure"]["Stage"] == failure_stage
    assert len(receipt["ExecutingSourceSha256"]) == 64
    if failure_stage != "source-admission":
        assert receipt["Provenance"] == {}
    if failure_stage == "input-decode":
        assert receipt["InputSha256"] == bridge.digest(source.read_bytes())
    assert not output.with_name(output.name + ".partial").exists()
    with pytest.raises(SystemExit):
        bridge.main()
    assert output.read_bytes() == receipt_bytes
    another = tmp_path / "reserved.json"
    partial = another.with_name(another.name + ".partial")
    partial.write_bytes(b"prior attempt")
    monkeypatch.setattr(bridge.sys, "argv", ["reference", str(source), str(another)])
    with pytest.raises(SystemExit):
        bridge.main()
    assert partial.read_bytes() == b"prior attempt"
    assert not another.exists()


def test_renamed_entrypoint_cannot_admit_a_different_canonical_file(
    tmp_path, monkeypatch
):
    copied = tmp_path / "src/Interp.Python/zeta_interp/renamed.py"
    copied.parent.mkdir(parents=True)
    copied.write_text("renamed fixture\n")
    output = tmp_path / "refusal.json"
    monkeypatch.setattr(bridge, "__file__", str(copied))
    monkeypatch.setattr(bridge, "source_admission", lambda _root: {})
    monkeypatch.setattr(
        bridge.sys, "argv", ["reference", str(tmp_path / "input"), str(output)]
    )
    assert bridge.main() == 1
    receipt = json.loads(output.read_bytes())
    assert receipt["Failure"]["Stage"] == "source-admission"
    assert "canonical source file" in receipt["Failure"]["Detail"]
