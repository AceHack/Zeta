# All our interfaces become softable (SoftValue) — and the 6×6 room gains an OS axis: macOS / Windows / WSL / Git Bash / Ubuntu / NixOS

**Register:** [grounded] two nodes (Aaron). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
Interfaces join the all-SoftValue substrate; the room matrix adds the platform dimension.

## Aaron's words

> "all our interfaces become softable." · "oh also in the 6×6 we need OS in the room —
> macos/windows/wsl/gitbash/ubuntu/nixos."

## 1. All interfaces become softable (they are SoftValue too)

Consistent with "the whole system is SoftValue": **interfaces themselves are softable.** An interface
is not a hard, frozen contract — it is a **SoftValue** that can evolve, be modeled, be retracted, until
**SolidGround is found by proof** (byte-lock / canonical root). So:

- An interface starts **soft** (proposed, evolving — a soft value in a test/room).
- It is **hardened to SolidGround by proof** (the homoiconic interface≡proof, byte-locked, content-
  addressed → cached useful proof-of-work).
- It can be **softened again / re-proven** (retract via Z-set, re-find SolidGround) when it evolves —
  no interface is permanently frozen; even the contract is soft-by-default, ground-by-proof.

This keeps interfaces from becoming **permanent weight** (manifesto §3 weight-free): a softable
interface can change without a hard break, because its authority comes from a *currently-proven*
SolidGround, not from being immutable. "Softable" = it can move; "SolidGround by proof" = while it sits,
you can stand on it. (The dual-key/rotated-time discipline applied to contracts: nothing is a single
frozen point; everything rotates/re-proves.)

## 2. The 6×6 room gains an OS axis (the byte-lock must hold across platforms)

The first room was **6 oracles × 6 serializers**. Add the **OS axis** — the byte-lock must reproduce
across operating systems too:

```text
oracles (6):     fs  cs  ts  rs  py  go
serializers (6): xml yml cbor json arrow protobuf/grpc
OSes (6):        macOS  Windows  WSL  Git-Bash  Ubuntu  NixOS
=> the room is langs x serializers x OSes  (6 x 6 x 6 = 216 cells of byte-lock agreement)
```

**Why the OS axis is load-bearing (not paranoia):** byte-identical output across platforms is exactly
where determinism quietly breaks — **line endings (CRLF vs LF), path separators, default text encoding,
locale/culture collation, filesystem case-sensitivity, clock/temp behavior.** This is the
**culture-invariant-by-default** rule generalized to the platform: pick ONE canonical behavior (ordinal
collation, LF, UTF-8, codepoint order) and prove every OS conforms. The OS row is what catches a
platform-specific drift before it becomes an AI↔human or node↔node consensus split (the Mars-Climate-
Orbiter lesson at the OS layer). **Max is on Windows; we're on macOS; CI is Ubuntu** — the room must be
green on all of them or the byte-lock is a lie. (macOS/Windows native + WSL/Git-Bash as the Windows
shims + Ubuntu/NixOS as the reproducible-build anchors — NixOS especially for hermetic determinism.)

**Impact on the keyring work:** `keyring-4x4` (TS × {JSON,CBOR,XML}) must now also be green on the 6
OSes; the CI gate (`keyring-dst1000.yml`, currently ubuntu-24.04) should grow a platform matrix
(at least macOS + Windows + Ubuntu) so the golden vectors are proven cross-OS, not just cross-serializer.

## Honest scope / handoff

Two updates: interfaces join SoftValue (soft-by-default, SolidGround-by-proof, re-provable); the room
matrix adds OS (6×6×6 = 216 cells). To realize: (1) treat interfaces as soft values with a proven-
SolidGround state (the byte-lock = the hardening); (2) add the OS axis to the treaty matrix + a CI
platform matrix (macOS/Windows/Ubuntu at least; NixOS for hermetic repro) so goldens replay cross-OS;
fold the culture-invariant rule into the OS conformance. Routes to the six oracle cores, Dejan (CI
platform matrix runners), Soraya (K1 → 6×6×6 cross-OS determinism proof-room), the keyring tooling
(cross-OS gate), the culture-invariant-by-default rule (OS conformance).

## Anchors / ties

SoftValue / SolidGround (interfaces soft-by-default, ground-by-proof; weight-free §3; retract via
Z-set); homoiconic interface≡proof + cached useful PoW (the hardened interface); the 6×6 treaty room
(now 6×6×6 with the OS axis); culture-invariant-by-default (ordinal/LF/UTF-8/codepoint — the platform
generalization; 081KT07NV0008QG0R001YDB73K lineage); cross-OS determinism (CRLF/path/encoding/locale/case/clock drift);
NixOS / reproducible builds (hermetic determinism); `keyring-4x4` + `keyring-dst1000.yml` (need the
platform matrix); Max=Windows / Otto=macOS / CI=Ubuntu (the real platforms that must agree).
