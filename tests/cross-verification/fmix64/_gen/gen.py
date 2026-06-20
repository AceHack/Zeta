#!/usr/bin/env python3
"""Independent Python oracle: compute MurmurHash3 fmix64 over the canonical inputs
and emit python-output.json. This recomputes the finaliser from scratch (it does
not import any port) so the cross-verification is a genuine independent oracle, not
a re-serialisation of another impl."""
import json
import os
MASK = (1 << 64) - 1
C1 = 0xFF51AFD7ED558CCD
C2 = 0xC4CEB9FE1A85EC53
def fmix64(x: int) -> int:
    h = x & MASK
    h ^= h >> 33
    h = (h * C1) & MASK
    h ^= h >> 33
    h = (h * C2) & MASK
    h ^= h >> 33
    return h & MASK
INPUTS = {
    "x-0": 0,
    "x-1": 1,
    "x-2": 2,
    "x-10": 10,
    "x-255": 255,
    "x-u64max": 18446744073709551615,
    "x-golden": 11400714819323198485,
    "x-2pow63": 9223372036854775808,
    "x-12345678901234567890": 12345678901234567890,
    "x-1e18": 1000000000000000000,
}
out = {k: str(fmix64(v)) for k, v in INPUTS.items()}
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(here, "python-output.json"), "w") as f:
    json.dump(out, f, indent=2)
    f.write("\n")
print("wrote python-output.json")
