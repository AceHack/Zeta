"""Replays the shared SplitMix64 golden seed through the Python oracle.

The C#/F#/Rust/TS oracles replay the same file
(``src/Core.TypeScript/splitmix64/golden-vectors.json``); agreement here is the
cross-language treaty. uint64 exceeds JSON's exact number range, so the seed
encodes inputs and outputs as decimal strings — parse them to ``int``.
"""

import json
from pathlib import Path

from zeta import splitmix64


def find_repo_root() -> Path:
    dir_path = Path(__file__).resolve().parent
    for parent in [dir_path] + list(dir_path.parents):
        if (parent / "Zeta.sln").exists():
            return parent
    raise RuntimeError("could not find repo root")


def _seed() -> dict:
    repo_root = find_repo_root()
    seed_path = (
        repo_root / "src" / "Core.TypeScript" / "splitmix64" / "golden-vectors.json"
    )
    with open(seed_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_mix_agrees_with_golden_vectors() -> None:
    seed = _seed()
    for v in seed["mix"]:
        x = int(v["x"])
        expected = int(v["result"])
        assert splitmix64.mix(x) == expected, f"mix({x}) != {expected}"


def test_mix_output_is_u64_bounded() -> None:
    seed = _seed()
    for v in seed["mix"]:
        result = splitmix64.mix(int(v["x"]))
        assert 0 <= result <= 0xFFFFFFFFFFFFFFFF


def test_mix_zero_is_zero() -> None:
    # 0 * GoldenRatio = 0 and every subsequent xor-shift of 0 is 0.
    assert splitmix64.mix(0) == 0
