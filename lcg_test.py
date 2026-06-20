# Let's use a standard 64-bit LCG as the anchor.
# Specifically, the PCG64 state advance (which is just a 64-bit LCG).
# Or better, the Knuth 64-bit LCG (from MMIX), which is a well-known public domain generator.
# Multiplier: 6364136223846793005 (used in PCG32 state advance)
# Increment: 1442695040888963407 (used in Knuth's MMIX LCG)
#
# Actually, let's use the exact LCG step from PCG-XSH-RR (the default pcg32).
# The default increment for pcg32 is often 1442695040888963407ULL.
# Let's define `rng.lcg64_mcg` (Multiplicative Congruential Generator, or just LCG).
# Wait, PCG uses `state * 6364136223846793005ULL + inc`.
# Let's use the exact MMIX LCG:
# state = state * 6364136223846793005ULL + 1442695040888963407ULL;
#
# This is a perfect, clean 2-op finalizer: `mul 6364136223846793005`, `add 1442695040888963407`.
# It exactly proves `add` is needed, because without `add`, you only have an MCG (which maps 0 -> 0),
# while an LCG maps 0 -> inc.
#
# Let's write the python script to generate the vectors.

inputs = [
    0,
    1,
    2,
    10,
    255,
    0xFFFFFFFFFFFFFFFF, # u64max
    11400714819323198485, # golden
    0x8000000000000000, # 2pow63
    12345678901234567890,
    1000000000000000000
]

M = 6364136223846793005
C = 1442695040888963407
MASK = 0xFFFFFFFFFFFFFFFF

for x in inputs:
    res = (x * M + C) & MASK
    print(f"x: {x} -> result: {res}")
