# ZetaId Canonical String Encoding Specification

This document specifies the canonical string representation for the 128-bit ZetaId.
This format is designed to be filename-safe, sort-preserving, and visually resilient.

## 1. Encoding: Crockford Base32

The canonical string encoding for ZetaId is **Crockford Base32** (with modifications for fixed length and strict validation).

### Alphabet

The alphabet contains 32 symbols, strictly ordered by ascending ASCII values:
```
0123456789ABCDEFGHJKMNPQRSTVWXYZ
```
This alphabet excludes the ambiguous characters `I`, `L`, `O`, and `U` to minimize visual confusion.

### Width

Every packed ZetaId is represented by exactly **26 characters**.

- $26 \times 5 = 130$ bits.
- The top 2 bits are zero-padded (so the maximum value represented by the first character is `7`).

### Case Sensitivity & Lenient Aliases

1. **Canonical Form**: Strictly uppercase. Only contains symbols from the canonical alphabet.
2. **Parsing (Lenient)**:
   - Case-insensitive (lowercase symbols are folded to uppercase).
   - Ambiguous characters are accepted and mapped:
     - `I`, `i`, `L`, `l` map to `1`
     - `O`, `o` map to `0`
     - `U`, `u` are rejected (used only as checksum symbols in standard Crockford base32, which we do not use).

## 2. Endianness

The string serialization represents the 128-bit integer in **big-endian (network byte order)**.

- The first character (index 0) represents the most-significant bits of the ZetaId.
- The 26th character (index 25) represents the least-significant 5 bits of the ZetaId.

## 3. Bit-Numbering

We use the **LSB-0** bit-numbering convention:

- Bit `0` is the least-significant bit of the 128-bit integer.
- Bit `127` is the most-significant bit.

## 4. 128-bit Overflow Rejection

Since 26 Crockford base32 symbols can encode up to 130 bits, any string where the first character decodes to a value $\ge 8$ (occupying bits 128 and 129) represents an integer greater than $2^{128} - 1$.
Such values are invalid and MUST be rejected during parsing.

## 5. Canonical Vectors

| Vector ID | Hexadecimal Representation | Crockford Base32 Representation |
|---|---|---|
| `authority-human-verified` | `080cb77ed58d19c1f80b000800000000` | `081JVQXNCD370ZG2R010000000` |
| `authority-trusted-agent` | `080cb77ed58d19c1a00b000800000000` | `081JVQXNCD370T02R010000000` |
| `authority-standard` | `080cb77ed58d18017815001000000000` | `081JVQXNCD300QG58020000000` |
| `authority-best-effort` | `080cb77ed58d18074017000800000000` | `081JVQXNCD303M05R010000000` |
| `authority-simulated` | `080cb77ed58d18071817c00800000000` | `081JVQXNCD303HG5Y010000000` |
| `momentum-background` | `080cb77ed58d19c1f809000800000000` | `081JVQXNCD370ZG28010000000` |
| `momentum-normal` | `080cb77ed58d19c1f80b000800000000` | `081JVQXNCD370ZG2R010000000` |
| `momentum-elevated` | `080cb77ed58d19c1a00d000800000000` | `081JVQXNCD370T038010000000` |
| `momentum-high` | `080cb77ed58d19c1f80f000800000000` | `081JVQXNCD370ZG3R010000000` |
| `momentum-critical` | `080cb77ed58d19c1f80fc00800000000` | `081JVQXNCD370ZG3Y010000000` |
| `authority-raw-0` | `0800000000000001000b000800000000` | `0800000000000G02R010000000` |
| `momentum-raw-255` | `0ffffffffffff9c1f80ff80800000000` | `0FZZZZZZZZZ70ZG3ZR10000000` |
