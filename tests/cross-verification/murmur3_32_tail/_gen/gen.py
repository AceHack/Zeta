#!/usr/bin/env python3
# Independent Python hand-port oracle for the MurmurHash3 x86_32 mix-combine step.
#
# WRITTEN FROM APPLEBY'S REFERENCE SOURCE, NOT FROM THE IR. This file never reads
# `murmur3_32_tail.ir.json` and never imports the generated lane. Before it
# existed the primitive's only lane was generated from the IR and its
# `vectors.yaml` expected values were produced by that same lane — the IR checked
# against itself (`_harness/ir-vs-handwritten.ts`, NO_INDEPENDENT_ORACLE).
#
# ANCHOR (checked, not merely cited — .claude/rules/anchor-to-human-prior-art.md)
#   Austin Appleby, MurmurHash3 (public domain), `smhasher/src/MurmurHash3.cpp`,
#   `MurmurHash3_x86_32`. Verbatim from the section the reference itself labels
#   `// body`:
#
#       for(int i = -nblocks; i; i++)
#       {
#         uint32_t k1 = getblock32(blocks,i);
#         k1 *= c1;  k1 = ROTL32(k1,15);  k1 *= c2;
#         h1 ^= k1;
#         h1 = ROTL32(h1,13);
#         h1 = h1*5+0xe6546b64;
#       }
#
#   The two lines this primitive implements are the last two: the per-block
#   ACCUMULATOR combine, `h1 = ROTL32(h1,13); h1 = h1*5 + 0xe6546b64`.
#
#   ENTAILMENT CHECK — ARITHMETIC HOLDS, THE NAME DOES NOT.
#   The committed IR is `rotl 13`, `mul 5`, `add 3864292196` (= 0xe6546b64) at
#   width 32, which IS exactly those two lines. So the code is right.
#   The generator is NAMED `hash.murmur3_32_tail`, and in MurmurHash3 the
#   "tail" is a DIFFERENT, named section of the same function — the leftover
#   1..3 bytes after the last whole block:
#
#       //----------
#       // tail
#       const uint8_t * tail = (const uint8_t*)(data + nblocks*4);
#       uint32_t k1 = 0;
#       switch(len & 3) { case 3: k1 ^= tail[2] << 16; ...
#                         case 1: k1 ^= tail[0];
#                                 k1 *= c1; k1 = ROTL32(k1,15); k1 *= c2; h1 ^= k1; }
#
#   That path contains NO rotl-13, NO multiply-by-5 and NO 0xe6546b64. The name
#   therefore asserts an anchor the code does not implement; the accurate name is
#   the body-block combine (or block mix-combine). Renaming changes
#   `idOf "hash.murmur3_32_tail" 1` and every golden byte derived from it, so it
#   is not done here — it is priced and filed as work-item 081M02YCNMA087G0R003TK7AEW.
#   See also `_harness/anchor-entailment.test.ts`, which pins BOTH halves of
#   this finding as executable assertions rather than prose.
import json
import os

MASK = (1 << 32) - 1


def rotl32(x: int, r: int) -> int:
    r %= 32
    if r == 0:
        return x & MASK
    return ((x << r) | (x >> (32 - r))) & MASK


def mix_combine(h1: int) -> int:
    """MurmurHash3_x86_32 body-block accumulator combine (NOT the tail path)."""
    h1 = rotl32(h1 & MASK, 13)
    return (h1 * 5 + 0xE6546B64) & MASK


INPUTS = {
    "x-0": 0,
    "x-1": 1,
    "x-2": 2,
    "x-4294967295": 4294967295,
    "x-305419896": 305419896,
    "x-2271560481": 2271560481,
    "x-2863311530": 2863311530,
    "x-1431655765": 1431655765,
    "x-42": 42,
    "x-1337": 1337,
}

out = {"_source": "hand-port-python"}
for k, v in INPUTS.items():
    out[k] = str(mix_combine(v))

target = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "python-output.json")
with open(target, "w") as f:
    f.write(json.dumps(out, indent=2) + "\n")
print("wrote python-output.json (hand-port)")
