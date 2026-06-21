def murmur3_32_h_update(h):
    h = h & 0xFFFFFFFF
    # rotl 13
    h = ((h << 13) | (h >> (32 - 13))) & 0xFFFFFFFF
    # mul 5
    h = (h * 5) & 0xFFFFFFFF
    # add 0xe6546b64
    h = (h + 0xe6546b64) & 0xFFFFFFFF
    return h

vectors = [0, 1, 2, 0xFFFFFFFF, 0x12345678, 0x87654321, 0xAAAAAAAA, 0x55555555, 42, 1337]
print("vectors:")
for v in vectors:
    out = murmur3_32_h_update(v)
    print(f"  - input: {v}")
    print(f"    output: {out}")
