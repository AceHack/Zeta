#!/usr/bin/env python3
"""Independent Python oracle: compute MurmurHash3 fmix32 over the canonical inputs
and emit python-output.json. This recomputes the finaliser from scratch (it does
not import any port) so the cross-verification is a genuine independent oracle, not
a re-serialisation of another impl."""
import json
import os

MASK = (1 << 32) - 1
A = 0x85EBCA6B
B = 0xC2B2AE35


def fmix32(x: int) -> int:
    h = x & MASK
    h ^= h >> 16
    h = (h * A) & MASK
    h ^= h >> 13
    h = (h * B) & MASK
    h ^= h >> 16
    return h & MASK


INPUTS = {
    "x-0": 0,
    "x-1": 1,
    "x-2": 2,
    "x-10": 10,
    "x-255": 255,
    "x-u32max": 4294967295,
    "x-0x9e3779b9": 2654435769,
    "x-2pow31": 2147483648,
    "x-3735928559": 3735928559,
    "x-1e9": 1000000000,
}
out = {k: str(fmix32(v)) for k, v in INPUTS.items()}
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(here, "python-output.json"), "w") as f:
    json.dump(out, f, indent=2)
    f.write("\n")
print("wrote python-output.json")
