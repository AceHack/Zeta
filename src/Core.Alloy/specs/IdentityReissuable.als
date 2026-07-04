// Alloy structural model — IdentityReissuable with threshold shares (081KVP3GYW1 R4).
// Math-team finding: per-user CA alone relocates the identity SPOF; IdentityReissuable
// (∀ teardown of userCA_u ⇒ ∃ recovery path) FAILS with one key per user and HOLDS when
// ≥k Shamir shares remain. Complements shamir.ts / Shamir.fs (algebra) with path-existence.
//
// Run: java -jar tools/alloy/alloy.jar src/Core.Alloy/specs/IdentityReissuable.als
//      (or AlloyRunner via tests/Tests.FSharp/Formal/Alloy.Runner.Tests.fs)

module IdentityReissuable

sig User {}

sig UserCA {
  owner: one User
}

// Live private key material (single-key custody).
// Field named `holds` (not `ca`) to avoid join clash with sig UserCA.
sig LiveKey {
  holds: one UserCA
}

// Cold Shamir share (threshold custody).
sig Share {
  holds: one UserCA
}

// Recovery is possible iff the live key remains OR at least k=2 shares remain.
// k=2 is the minimal non-trivial threshold (matches default 2-of-n custody).
pred recoverable[c: UserCA] {
  (some lk: LiveKey | lk.holds = c)
  or
  #{ s: Share | s.holds = c } >= 2
}

// Single-key world: no shares exist.
pred singleKeyWorld {
  no Share
}

// ---------------------------------------------------------------------------
// R4a — single-key SPOF: after losing the live key, identity is NOT reissuable.
// `run` must FIND an orphan CA (no live key, no shares).
// ---------------------------------------------------------------------------
run SingleKeyOrphan {
  singleKeyWorld
  no LiveKey
  some c: UserCA | not recoverable[c]
} for 3 but 2 UserCA, 2 User, 0 LiveKey, 0 Share

// ---------------------------------------------------------------------------
// R4b — threshold recovery: live key gone, but ≥2 shares remain ⇒ recoverable.
// `run` must FIND such a configuration.
// ---------------------------------------------------------------------------
run ThresholdRecovers {
  some c: UserCA |
    (no lk: LiveKey | lk.holds = c)
    and #{ s: Share | s.holds = c } >= 2
    and recoverable[c]
} for 4 but 1 UserCA, 1 User, 0 LiveKey, 3 Share

// ---------------------------------------------------------------------------
// R4c — shares imply reissuable: whenever ≥2 shares remain, recovery holds
// (even with no live key). `check` must find NO counterexample.
// ---------------------------------------------------------------------------
assert SharesImplyReissuable {
  all c: UserCA |
    #{ s: Share | s.holds = c } >= 2 implies recoverable[c]
}
check SharesImplyReissuable for 5 but 3 UserCA, 3 User, 2 LiveKey, 6 Share

// ---------------------------------------------------------------------------
// R4d — live key alone is sufficient (no shares required).
// ---------------------------------------------------------------------------
assert LiveKeyImpliesReissuable {
  all c: UserCA |
    (some lk: LiveKey | lk.holds = c) implies recoverable[c]
}
check LiveKeyImpliesReissuable for 4
