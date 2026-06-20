#!/usr/bin/env python3
# Independent Python hand-port oracle for Pelle Evensen's `nasam` mixer.
# Re-implements the public-domain reference FROM SCRATCH — no shared module, no IR —
# so it is a genuine N-way peer to the generated-from-ir TS oracle.
# Reference: https://mostlymangling.blogspot.com/2020/01/nasam-not-another-strange-acronym-mixer.html
#   x ^= ror(x,25) ^ ror(x,47);  x *= 0x9E6C63D0676A9A99;  x ^= x>>23 ^ x>>51;
#   x *= 0x9E6D62D06F6A9A9B;      x ^= x>>23 ^ x>>51
import json
import os

MASK = (1 << 64) - 1
M1 = 0x9E6C63D0676A9A99
M2 = 0x9E6D62D06F6A9A9B


def ror(x: int, r: int) -> int:
    return ((x >> r) | (x << (64 - r))) & MASK


def nasam(x: int) -> int:
    x &= MASK
    x ^= ror(x, 25) ^ ror(x, 47)
    x = (x * M1) & MASK
    x ^= (x >> 23) ^ (x >> 51)
    x = (x * M2) & MASK
    x ^= (x >> 23) ^ (x >> 51)
    return x & MASK


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
    out[k] = str(nasam(v))

target = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "python-output.json")
with open(target, "w") as f:
    f.write(json.dumps(out, indent=2) + "\n")
print("wrote python-output.json (hand-port)")
