#!/usr/bin/env python3
# Independent Python hand-port oracle for the Numerical Recipes 32-bit LCG step.
#
# WRITTEN FROM THE PUBLISHED RECURRENCE, NOT FROM THE IR. This file never reads
# `lcg32_numerical_recipes.ir.json` and never imports the generated lane; the
# multiplier, the increment and the modulus below were taken from the reference
# and typed out here, so agreeing with the IR-generated lane is an OBSERVATION
# rather than a restatement. That is the whole point: before this file existed
# the primitive's only lane was generated from the IR and its `vectors.yaml`
# expected values were produced by that same lane, so nothing in the repo could
# disagree with it (`_harness/ir-vs-handwritten.ts`, NO_INDEPENDENT_ORACLE).
#
# ANCHOR (checked, not merely cited — .claude/rules/anchor-to-human-prior-art.md)
#   Press, Teukolsky, Vetterling & Flannery, *Numerical Recipes in C*, 2nd ed.
#   (Cambridge University Press, 1992), §7.1 "An Even Quicker Generator":
#       idum = 1664525L * idum + 1013904223L
#   carried in a 32-bit unsigned word, i.e. modulus m = 2^32, multiplier
#   a = 1664525, increment c = 1013904223. Commonly catalogued as `ranqd1`.
#
#   ENTAILMENT CHECK. The committed IR is `mul 1664525` then `add 1013904223` at
#   width 32. That IS the recurrence above, modulus included — a full-word 2^32
#   LCG with no output-bit selection, which is what the reference specifies.
#   Anchor holds. (Contrast `lcg32_glibc` in the sibling directory, where the
#   same shape of check FAILS; see that file's header.)
import json
import os

MASK = (1 << 32) - 1
A = 1664525
C = 1013904223


def lcg_step(x: int) -> int:
    """One Numerical Recipes ranqd1 step: x -> (a*x + c) mod 2^32."""
    return (A * (x & MASK) + C) & MASK


INPUTS = {
    "x-0": 0,
    "x-1": 1,
    "x-2": 2,
    "x-10": 10,
    "x-255": 255,
    "x-u32max": 4294967295,
    "x-golden": 2654435769,
    "x-2pow31": 2147483648,
    "x-1234567890": 1234567890,
    "x-1e9": 1000000000,
}

out = {"_source": "hand-port-python"}
for k, v in INPUTS.items():
    out[k] = str(lcg_step(v))

target = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "python-output.json")
with open(target, "w") as f:
    f.write(json.dumps(out, indent=2) + "\n")
print("wrote python-output.json (hand-port)")
