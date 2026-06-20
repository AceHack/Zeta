#!/usr/bin/env python3
# Independent Python hand-port oracle for the xoshiro256** OUTPUT SCRAMBLER.
# Re-implements `result = rotl(x * 5, 7) * 9` (width 64) FROM SCRATCH — no shared
# module, no IR — so it is a genuine N-way peer to the generated-from-ir TS oracle.
# Public-domain reference: https://prng.di.unimi.it/xoshiro256starstar.c
import json
import os

MASK = (1 << 64) - 1


def rotl(x: int, k: int) -> int:
    return ((x << k) | (x >> (64 - k))) & MASK


def scramble(x: int) -> int:
    return (rotl((x * 5) & MASK, 7) * 9) & MASK


INPUTS = {
    "x-0": 0,
    "x-1": 1,
    "x-2": 2,
    "x-10": 10,
    "x-255": 255,
    "x-u64max": (1 << 64) - 1,
    "x-golden": 11400714819323198485,
    "x-2pow63": 1 << 63,
    "x-12345678901234567890": 12345678901234567890,
    "x-1e18": 10 ** 18,
}

out = {"_source": "hand-port-python"}
for k, v in INPUTS.items():
    out[k] = str(scramble(v))

target = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "python-output.json")
with open(target, "w") as f:
    f.write(json.dumps(out, indent=2) + "\n")
print(f"wrote python-output.json (hand-port)")
