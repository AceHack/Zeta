"""SplitMix64 finaliser — Python oracle.

Sebastiano Vigna's mixer (arXiv:1410.0530 §3; public-domain reference
https://prng.di.unimi.it/splitmix64.c). Conforms to the F# canonical shape
(``src/Core/SplitMix64.fs``) by agreeing on the shared seed
(``src/Core.TypeScript/splitmix64/golden-vectors.json``) that the C#/F#/Rust/TS
oracles also verify.

Python ``int`` is unbounded, so every operation is masked back to 64 bits with
``& _U64`` to emulate the wrapping ``uint64`` arithmetic the other oracles get
for free. The result is byte-identical to the rest of the matrix.
"""

# floor(2^64 / phi) — Knuth TAOCP §6.4 multiplicative-hashing constant.
GOLDEN_RATIO = 0x9E3779B97F4A7C15

# First Vigna SplitMix64 finaliser multiplier (arXiv:1410.0530 §3).
VIGNA_A = 0xBF58476D1CE4E5B9

# Second Vigna SplitMix64 finaliser multiplier (arXiv:1410.0530 §3).
VIGNA_B = 0x94D049BB133111EB

_U64 = 0xFFFFFFFFFFFFFFFF


def mix(x: int) -> int:
    """Apply the SplitMix64 finaliser to a 64-bit input.

    ``x`` is interpreted as an unsigned 64-bit integer; the return value is an
    unsigned 64-bit integer (``0 <= result <= 2**64 - 1``). 5 ops, no allocation.
    """
    z = (x * GOLDEN_RATIO) & _U64
    z = ((z ^ (z >> 30)) * VIGNA_A) & _U64
    z = ((z ^ (z >> 27)) * VIGNA_B) & _U64
    return (z ^ (z >> 31)) & _U64
