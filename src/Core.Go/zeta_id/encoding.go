package zeta_id

// encoding.go — ZetaId canonical Crockford base32 string encoding.
//
// Go oracle for the cross-language treaty defined by the canonical TypeScript
// implementation (src/Core.TypeScript/zeta-id/encoding.ts) and matched by the
// F#/C#/Rust/Python oracles. Until B-<this> Go was the one absent oracle — the
// cross-verify harness compared only hex for Go, so the 6-language byte-lock was
// really a 5-language treaty wearing a 6 label. This file closes that gap.
//
// The 128-bit ZetaId is carried here as a *big.Int (same as Pack/Unpack). Two
// canonical big-endian (MSB-first) string forms exist; this file is the base32
// one (hex lives in ToHex). Crockford base32: 26 chars, alphabet [0-9 A-Z] minus
// the ambiguous I,L,O,U; fixed-width + MSB-first + ASCII-ascending alphabet ⇒
// string sort == numeric ZetaId sort (filename-safe, sort-preserving). See
// encoding.ts for the full rationale (B-0682).

import (
	"errors"
	"fmt"
	"math/big"
	"strings"
)

// CrockfordAlphabet — excludes I, L, O, U (ambiguity). ASCII-ascending so a
// fixed-width string sort preserves numeric order.
const CrockfordAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// ZetaIdBase32Len — 128 bits / 5 bits-per-char = 25.6 ⇒ 26 chars (top 2 bits are
// zero padding).
const ZetaIdBase32Len = 26

// mask128 — the low 128 bits; every form masks to this before encoding.
var mask128 = new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 128), big.NewInt(1))

// crockfordDecode — canonical chars + lowercase + Crockford's lenient aliases
// (I/i,L/l→1; O/o→0). U/u is NOT a value symbol in Crockford (check-only) so it
// is absent ⇒ rejected by Parse. Keyed by ASCII byte (all symbols are ASCII).
var crockfordDecode = func() map[byte]int {
	m := make(map[byte]int, 64)
	for i := 0; i < len(CrockfordAlphabet); i++ {
		c := CrockfordAlphabet[i]
		m[c] = i
		if c >= 'A' && c <= 'Z' {
			m[c+('a'-'A')] = i // lowercase alias
		}
	}
	// Crockford lenient aliases for visually-ambiguous input.
	m['I'], m['i'] = 1, 1
	m['L'], m['l'] = 1, 1
	m['O'], m['o'] = 0, 0
	return m
}()

// Format encodes a 128-bit ZetaId as the canonical 26-char Crockford base32
// string (big-endian, fixed width, sort-preserving, filename-safe).
func Format(id *big.Int) string {
	v := new(big.Int).And(id, mask128)
	out := make([]byte, ZetaIdBase32Len)
	low5 := big.NewInt(31)
	digit := new(big.Int)
	// MSB-first: fill from the right (least-significant 5 bits) backwards.
	for i := ZetaIdBase32Len - 1; i >= 0; i-- {
		digit.And(v, low5)
		out[i] = CrockfordAlphabet[digit.Int64()]
		v.Rsh(v, 5)
	}
	return string(out)
}

// Parse decodes a canonical (or Crockford-lenient) base32 string back to a
// ZetaId. Accepts lowercase + the I/L→1, O→0 aliases; rejects wrong length,
// invalid symbols, and any value that overflows 128 bits (the two leading pad
// bits must be zero ⇒ first char ∈ 0..7).
func Parse(s string) (*big.Int, error) {
	if len(s) != ZetaIdBase32Len {
		return nil, fmt.Errorf("ZetaId.Parse: expected %d Crockford-base32 chars, got %d (%q)", ZetaIdBase32Len, len(s), s)
	}
	v := new(big.Int)
	for i := 0; i < len(s); i++ {
		d, ok := crockfordDecode[s[i]]
		if !ok {
			return nil, fmt.Errorf("ZetaId.Parse: invalid Crockford-base32 char %q at index %d", string(s[i]), i)
		}
		v.Lsh(v, 5)
		v.Or(v, big.NewInt(int64(d)))
	}
	if v.Cmp(mask128) > 0 {
		return nil, errors.New("ZetaId.Parse: value exceeds 128 bits (leading pad bits must be zero)")
	}
	return v, nil
}

// IsCanonical reports whether s is the strict canonical Crockford form (exactly
// what Format emits) — 26 chars, uppercase, only the strict alphabet, no lenient
// aliases, and round-trips. Use to reject non-canonical filenames.
func IsCanonical(s string) bool {
	if len(s) != ZetaIdBase32Len {
		return false
	}
	for i := 0; i < len(s); i++ {
		if !strings.ContainsRune(CrockfordAlphabet, rune(s[i])) {
			return false
		}
	}
	parsed, err := Parse(s)
	if err != nil {
		return false
	}
	return Format(parsed) == s
}
