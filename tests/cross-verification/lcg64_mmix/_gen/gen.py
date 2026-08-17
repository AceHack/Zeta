#!/usr/bin/env python3
# Independent Python hand-port oracle for Knuth's MMIX 64-bit LCG step.
#
# WRITTEN FROM THE PUBLISHED RECURRENCE, NOT FROM THE IR. This file never reads
# `lcg64_mmix.ir.json` and never imports the generated lane; the constants below
# were taken from the reference and typed out here, so agreeing with the
# IR-generated lane is an OBSERVATION rather than a restatement. Before this file
# existed the primitive's only lane was generated from the IR and its
# `vectors.yaml` expected values were produced by that same lane — the IR checked
# against itself (`_harness/ir-vs-handwritten.ts`, NO_INDEPENDENT_ORACLE).
#
# ANCHOR (checked, not merely cited — .claude/rules/anchor-to-human-prior-art.md)
#   Donald E. Knuth, MMIX — the LCG carried in *The Art of Computer Programming*
#   Vol. 2 §3.3.4's multiplier table and used by MMIX's 64-bit generator:
#       x -> (6364136223846793005 * x + 1442695040888963407) mod 2^64
#   multiplier a = 6364136223846793005, increment c = 1442695040888963407,
#   modulus m = 2^64.
#
#   ENTAILMENT CHECK. The committed IR is `mul 6364136223846793005` then
#   `add 1442695040888963407` at width 64. That IS the recurrence above, modulus
#   included. Anchor holds for the SHAPE (full-word 2^64 LCG, no output-bit
#   selection) and for the MULTIPLIER, which is uncontested.
#
#   OPEN, RECORDED RATHER THAN GLOSSED — the INCREMENT is not uncontested.
#   `a = 6364136223846793005` with `c = 1442695040888963407` is the pairing
#   overwhelmingly cited as "Knuth MMIX" in the literature and in PCG's
#   parameter tables, and c is the leading digits of log2(e) = 1.442695040888963…
#   which is Knuth's habit for increments. But Wikipedia's "LCG parameters in
#   common use" table currently gives the MMIX row as c = 9754186451795953191,
#   sourced to `rsixfour.c`. We have NOT resolved which reading Knuth's own MMIX
#   source uses, and this port deliberately does not pretend to: it implements
#   the committed increment, and the disagreement is filed rather than buried.
#   Under the numerology-vs-number-theory rule the honest statement is
#   "consistent with the widely-cited Knuth MMIX parameters", not "is MMIX" —
#   a matching multiplier does not settle an increment.
#   Filed: work-item 081M02YCNMA087G0R003TK7AEW ("Open, deliberately unresolved").
import json
import os

MASK = (1 << 64) - 1
A = 6364136223846793005
C = 1442695040888963407


def lcg_step(x: int) -> int:
    """One MMIX LCG step: x -> (a*x + c) mod 2^64."""
    return (A * (x & MASK) + C) & MASK


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

out = {"_source": "hand-port-python"}
for k, v in INPUTS.items():
    out[k] = str(lcg_step(v))

target = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "python-output.json")
with open(target, "w") as f:
    f.write(json.dumps(out, indent=2) + "\n")
print("wrote python-output.json (hand-port)")
