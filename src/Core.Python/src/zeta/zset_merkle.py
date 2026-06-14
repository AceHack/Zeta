import struct
import xxhash
from typing import List, Tuple, Dict

class MerkleHash:
    def __init__(self, hi: int, lo: int):
        self.hi = hi
        self.lo = lo

    @staticmethod
    def zero() -> "MerkleHash":
        return MerkleHash(0, 0)

    @staticmethod
    def of_bytes(b: bytes) -> "MerkleHash":
        digest = xxhash.xxh128(b).digest()
        lo = struct.unpack("<Q", digest[0:8])[0]
        hi = struct.unpack("<Q", digest[8:16])[0]
        return MerkleHash(hi, lo)

    @staticmethod
    def combine(a: "MerkleHash", b: "MerkleHash") -> "MerkleHash":
        buf = bytearray(32)
        struct.pack_into("<Q", buf, 0, a.hi)
        struct.pack_into("<Q", buf, 8, a.lo)
        struct.pack_into("<Q", buf, 16, b.hi)
        struct.pack_into("<Q", buf, 24, b.lo)
        return MerkleHash.of_bytes(bytes(buf))

    def to_hex(self) -> str:
        return f"{self.hi:016x}{self.lo:016x}"

def leaf_bytes(key_bytes: bytes, weight: int) -> bytes:
    buf = bytearray(4 + len(key_bytes) + 8)
    struct.pack_into("<I", buf, 0, len(key_bytes))
    buf[4 : 4 + len(key_bytes)] = key_bytes
    struct.pack_into("<q", buf, 4 + len(key_bytes), weight)
    return bytes(buf)

def fold(level: List[MerkleHash]) -> MerkleHash:
    n = len(level)
    if n == 0:
        return MerkleHash.of_bytes(b"")
    if n == 1:
        return level[0]
    parents = []
    for i in range((n + 1) // 2):
        a = level[2 * i]
        b = level[2 * i + 1] if 2 * i + 1 < n else a
        parents.append(MerkleHash.combine(a, b))
    return fold(parents)

def root(entries: List[Tuple[str, int]]) -> MerkleHash:
    # 1. Group by key and sum weights
    counts: Dict[str, int] = {}
    for k, w in entries:
        counts[k] = counts.get(k, 0) + w

    # 2. Filter out zero net weights
    non_zero = [(k, w) for k, w in counts.items() if w != 0]

    # 3. Sort by key's encoded UTF-8 bytes (ordinal lexicographic)
    # Python sorts lists of tuples lexicographically; we sort key bytes
    encoded_entries = [(k.encode("utf-8"), w) for k, w in non_zero]
    encoded_entries.sort(key=lambda item: item[0])

    # 4. Generate leaf hashes
    leaves = [MerkleHash.of_bytes(leaf_bytes(kb, w)) for kb, w in encoded_entries]

    # 5. Fold bottom-up
    return fold(leaves)
