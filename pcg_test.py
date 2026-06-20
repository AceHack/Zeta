# PCG32 output function (RXS-M-XS)
# x = state
# word = ((x >> ((x >> 59) + 5)) ^ x) * multiplier
# return (word >> 43) ^ word
#
# Actually, the standard pcg32 (PCG-XSH-RR) is:
# count = (state >> 59)
# x = state ^ (state >> 18)
# x = x >> 27
# return rotl32(x, -count)
#
# Let's check O'Neill's minimal C implementation of PCG32:
# uint32_t pcg32_random_r(pcg32_random_t* rng) {
#     uint64_t oldstate = rng->state;
#     // Advance internal state
#     rng->state = oldstate * 6364136223846793005ULL + (rng->inc | 1);
#     // Calculate output function (XSH RR), uses old state for max ILP
#     uint32_t xorshifted = ((oldstate >> 18u) ^ oldstate) >> 27u;
#     uint32_t rot = oldstate >> 59u;
#     return (xorshifted >> rot) | (xorshifted << ((-rot) & 31));
# }

# The output function takes `oldstate` (a 64-bit word) and produces a 32-bit word.
# In Zeta IR, the finalizer is a sequence of ops on a single word `x`.
# If the IR word is 64-bit, we can do the LCG step:
# x *= 6364136223846793005
# x += increment
#
# But wait, Zeta's generator IR models the *finalizer* (the output scrambler), not the state advance!
# The output scrambler for splitmix64 is:
# x ^= x >> 30; x *= M1; x ^= x >> 27; x *= M2; x ^= x >> 31
#
# For PCG32, the output scrambler is:
# xorshifted = ((x >> 18) ^ x) >> 27
# rot = x >> 59
# result = rotr32(xorshifted, rot)
# This requires a variable shift/rotate! Our grammar only has constant shifts/rotates.
#
# What about PCG-RXS-M-XS (often used for 64-bit output from 64-bit state)?
# word = ((state >> ((state >> 59) + 5)) ^ state) * 12605985483714917081ull;
# return (word >> 43) ^ word;
# This also uses a variable shift.
#
# Let's look for a generator that uses ADD in its finalizer with *constant* operands.
# What about the standard LCG finalizer? (It's just the identity, output = state).
# What about ChaCha quarter round?
# a += b; d ^= a; d <<= 16;
# c += d; b ^= c; b <<= 12;
# a += b; d ^= a; d <<= 8;
# c += d; b ^= c; b <<= 7;
# This uses ADD, but it operates on *multiple* words (a, b, c, d). Zeta IR finalizer operates on a *single* word `x`.
#
# Let's check other hash functions.
# MurmurHash3 finalizer:
# k ^= k >> 33; k *= M1; k ^= k >> 33; k *= M2; k ^= k >> 33; (fmix64)
#
# CityHash64 finalizer:
# hash ^= hash >> 33;
# hash *= 0xff51afd7ed558ccdULL;
# hash ^= hash >> 33;
# hash *= 0xc4ceb9fe1a85ec53ULL;
# hash ^= hash >> 33;
#
# XXHash64 finalizer:
# h64 ^= h64 >> 33;
# h64 *= 0xC2B2AE3D27D4EB4FULL;
# h64 ^= h64 >> 29;
# h64 *= 0x165667B19E3779F9ULL;
# h64 ^= h64 >> 32;
#
# FNV-1a 64-bit finalizer:
# hash ^= hash >> 33;
# hash *= 0xc4ceb9fe1a85ec53ULL;
# hash ^= hash >> 33;
# hash *= 0xff51afd7ed558ccdULL;
# hash ^= hash >> 33;
#
# Wang Hash (Thomas Wang's integer hash functions):
# uint64_t hash(uint64_t key) {
#   key = (~key) + (key << 21); // key = (key << 21) - key - 1;
#   key = key ^ (key >> 24);
#   key = (key + (key << 3)) + (key << 8); // key * 265
#   key = key ^ (key >> 14);
#   key = (key + (key << 2)) + (key << 4); // key * 21
#   key = key ^ (key >> 28);
#   key = key + (key << 31);
#   return key;
# }
# Wait, `key = (~key) + (key << 21)` is `key = key * ((1<<21)-1) - 1`.
# Let's find a hash function that explicitly uses `add constant`.
#
# SplitMix64's *state advance* is `x += 0x9e3779b97f4a7c15`.
# If we model the *entire* SplitMix64 generator (advance + finalizer) as the IR:
# x += 0x9e3779b97f4a7c15
# x ^= x >> 30
# x *= 0xbf58476d1ce4e5b9
# x ^= x >> 27
# x *= 0x94d049bb133111eb
# x ^= x >> 31
#
# If the IR is meant to represent the *whole* SplitMix64 step (from old state to output),
# wait, SplitMix64 output is `fmix64(state += 0x9e3779b97f4a7c15)`.
# So the input to the IR is `old_state`, and the output is the random number.
# In `tests/cross-verification/_harness/nway-diff.ts`, how is splitmix64 tested?
# Let's check `tests/cross-verification/splitmix64/compare.ts` or `vectors.yaml`.
