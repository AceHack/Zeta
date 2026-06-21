def pcg_xsh_rr(state):
    # This is just the output function of PCG-XSH-RR 64->32
    count = (state >> 59) & 31
    x = state ^ (state >> 18)
    x = (x >> 27) & 0xFFFFFFFF
    # rotr
    return ((x >> count) | (x << (32 - count))) & 0xFFFFFFFF

# But wait, PCG uses variables (state >> 59). Zeta IR doesn't support variable shifts yet.
# The IR ops are constants.
# Let's find another add-anchor. What about ChaCha20 quarter round? We already did murmur3.
# What about FNV-1a 32-bit?
def fnv1a_32(state):
    # fnv1a is usually mul and xor, no add.
    pass

# What about a simple LCG? We already did lcg64_mmix and lcg32_numerical_recipes.
# What about the PCG state advance?
# state = state * 6364136223846793005 + inc
# But inc is a variable in PCG. If we fix inc, it's just an LCG.

# What about xxHash32 finalizer?
# h32 ^= h32 >> 15;
# h32 *= 2246822519;
# h32 ^= h32 >> 13;
# h32 *= 3266489917;
# h32 ^= h32 >> 16;
# This doesn't use add.

# Let's look at splitmix64 finalizer:
# z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9
# z = (z ^ (z >> 27)) * 0x94d049bb133111eb
# return z ^ (z >> 31)
# No add.

# What about CityHash32 finalizer?
# h ^= h >> 16;
# h *= 0x85ebca6b;
# h ^= h >> 13;
# h *= 0xc2b2ae35;
# h ^= h >> 16;
# No add.

# What about MurmurHash3 64-bit finalizer (fmix64)?
# k ^= k >> 33;
# k *= 0xff51afd7ed558ccd;
# k ^= k >> 33;
# k *= 0xc4ceb9fe1a85ec53;
# k ^= k >> 33;
# No add.

# Let's use the standard ChaCha quarter-round first half (add then xor then rotl).
# a += b; d ^= a; d <<<= 16;
# In our IR, state is a single register. We can't do a += b if b is a variable.
# But we CAN do it if we treat b as a constant.
# Let's just define a "chacha_qr_step1" generator:
# state = state + 0x01020304
# state = state ^ 0x05060708 (Wait, IR xorshr is state ^ (state >> s). We don't have a constant XOR op!)
# Ah, we don't have a constant XOR op in the grammar.
# We have: mul k, add k, xorshr s, rotl r, xrotxor rs, xshrxor ss.

# What uses add and then xorshr/rotl?
# How about Jenkins Hash (lookup3) finalizer?
# c ^= b; c -= rotl(b, 14);
# We don't have sub/add with variables.

# What about a specific LCG like POSIX rand48?
# state = (state * 0x5DEECE66D + 0xB) & 0xFFFFFFFFFFFF
# Width 48 is weird.

# Let's do `lcg64_newlib`:
# state = state * 6364136223846793005 + 1
# This is an add-anchor.

# Or `lcg32_glibc`:
# state = state * 1103515245 + 12345
def lcg32_glibc(state):
    return (state * 1103515245 + 12345) & 0xFFFFFFFF

for i in range(10):
    print(hex(lcg32_glibc(i)))
