package zset_merkle

import (
	"encoding/binary"
	"fmt"
	"math/bits"
	"sort"

	"github.com/zeebo/xxh3"
)

type MerkleHash struct {
	Hi, Lo uint64
}

func (m MerkleHash) ToHex() string {
	return fmt.Sprintf("%016x%016x", m.Hi, m.Lo)
}

func OfBytes(b []byte) MerkleHash {
	h := xxh3.Hash128(b)
	return MerkleHash{
		Hi: bits.ReverseBytes64(h.Lo),
		Lo: bits.ReverseBytes64(h.Hi),
	}
}

func Combine(a, b MerkleHash) MerkleHash {
	var buf [32]byte
	binary.LittleEndian.PutUint64(buf[0:8], a.Hi)
	binary.LittleEndian.PutUint64(buf[8:16], a.Lo)
	binary.LittleEndian.PutUint64(buf[16:24], b.Hi)
	binary.LittleEndian.PutUint64(buf[24:32], b.Lo)
	return OfBytes(buf[:])
}

func leafBytes(keyBytes []byte, weight int64) []byte {
	buf := make([]byte, 4+len(keyBytes)+8)
	binary.LittleEndian.PutUint32(buf[0:4], uint32(len(keyBytes)))
	copy(buf[4:4+len(keyBytes)], keyBytes)
	binary.LittleEndian.PutUint64(buf[4+len(keyBytes):4+len(keyBytes)+8], uint64(weight))
	return buf
}

func fold(level []MerkleHash) MerkleHash {
	n := len(level)
	if n == 0 {
		return OfBytes([]byte{})
	}
	if n == 1 {
		return level[0]
	}
	parents := make([]MerkleHash, (n+1)/2)
	for i := 0; i < len(parents); i++ {
		a := level[2*i]
		var b MerkleHash
		if 2*i+1 < n {
			b = level[2*i+1]
		} else {
			b = a
		}
		parents[i] = Combine(a, b)
	}
	return fold(parents)
}

type Entry struct {
	Key    string
	Weight int64
}

func Root(entries []Entry) MerkleHash {
	counts := make(map[string]int64)
	for _, e := range entries {
		counts[e.Key] += e.Weight
	}

	var keys []string
	for k, w := range counts {
		if w != 0 {
			keys = append(keys, k)
		}
	}

	sort.Strings(keys)

	leaves := make([]MerkleHash, len(keys))
	for i, k := range keys {
		leaves[i] = OfBytes(leafBytes([]byte(k), counts[k]))
	}

	return fold(leaves)
}
