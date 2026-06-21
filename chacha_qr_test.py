import struct
import yaml

# ChaCha quarter-round on a single 32-bit state variable `a`
# Normally QR is over (a,b,c,d), but the generator IR models a single accumulator `x`.
# Wait, the IR is a unary function `x -> f(x)`.
# ChaCha QR is `a += b; d ^= a; d <<<= 16; c += d; b ^= c; b <<<= 12; a += b; d ^= a; d <<<= 8; c += d; b ^= c; b <<<= 7;`
# This operates on 4 variables. The zeta-ir models a unary `z -> f(z)` fold.
# Can we express a 32-bit ChaCha QR step as a unary function?
# No, QR requires 4 state words.
# Wait, the `add` op adds a CONSTANT `k`.
# ChaCha QR adds variables to variables.
# But PCG's state advance is `state = state * multiplier + increment`.
# PCG output function is `xsh_rr`: `x ^= x >> 18; rot = x >> 59; return rotl(x, rot)` -- wait, PCG output rotates by a VARIABLE amount.
# What is a public-domain generator that uses `add k` (a constant) AND `rotl`/`xrotxor`?
# 
# Let's check `fmix32` from MurmurHash3:
# h ^= h >> 16;
# h *= 0x85ebca6b;
# h ^= h >> 13;
# h *= 0xc2b2ae35;
# h ^= h >> 16;
# It uses mul and xorshr.
# 
# Let's check `fmix64`:
# k ^= k >> 33;
# k *= 0xff51afd7ed558ccd;
# k ^= k >> 33;
# k *= 0xc4ceb9fe1a85ec53;
# k ^= k >> 33;
# 
# What about a simple Weyl sequence or a specific round of a block cipher with a constant?
# Speck round? `x = (x >>> 8) + y; x ^= k; y = (y <<< 3) ^ x;` - needs two variables.
# 
# Wait, what if we use `pcg32`'s state advance? We already used LCG.
# What about `splitmix32`? (Doesn't exist standard, but `splitmix64` does).
# 
# Let's find a generator that uses `add CONSTANT` and `rotl` or `xorshr`.
# A standard PRNG: `xoshiro256**`? It uses `rotl` and `add` (but adds two variables).
# `Romu`? `x = 15241094284759029579u * state; state = rotl(state, 27) + x;`
# 
# What about `PCG`'s `rx-s-m-xs` or similar?
# Let's look at `Pcg32` output function (RXS-M-XS):
# Wait, `pcg32` standard output is `xsh_rr` which rotates by a variable amount.
# Is there a PRNG that adds a constant and rotates by a constant?
# `LCG` adds a constant.
# `Chacha` adds variables.
# 
# Let's re-read the prompt: "Option 2: Port a second add-user (ChaCha quarter-round)... ChaCha's quarter-round (a += b; d ^= a; d = rotl(d,16); ...) is the canonical add-AND-rotate user"
# But wait, `zeta-ir` operations are UNARY. `mul k`, `add k`, `xorshr s`, `rotl r`. They operate on a single accumulator `z`.
# How can we express ChaCha QR which takes 4 words?
# Ah, maybe the prompt implies adding a CONSTANT to `z`, then rotating `z`?
# Wait, `add` in v4 is `Add of K: int64`. It adds a CONSTANT `K`.
# If the prompt says "ChaCha quarter-round (a += b; d ^= a; d = rotl(d,16); ...)", maybe it means we just port a *slice* of it, or the prompt misunderstood the unary nature of the IR?
# Let's check if there's a variant of ChaCha or if we can just define a `rng.chacha_qr_lane` that simulates one lane with constants?
# Or maybe the prompt just meant a PRNG like `pcg32_fast`?
# Let's read the backlog file again.
