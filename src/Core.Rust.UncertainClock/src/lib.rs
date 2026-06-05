//! UncertainClock — a Hybrid Logical Clock with an uncertainty window, Rust oracle.
//!
//! Conforms to the F# canonical shape (`src/Core/UncertainClock.fs`) by agreeing on the shared seed
//! (`src/Core.TypeScript/uncertain-clock/golden-vectors.json`) that the C#/F#/TS oracles also verify.
//! All `i64` arithmetic — no floats, fully byte-lockable. An HLC is `{physical, logical}`; an
//! uncertain reading is `{physical, eps}` with true time in `[physical, physical + eps]`.

/// A Hybrid Logical Clock reading: physical time + logical tiebreak.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Hlc {
    pub physical: i64,
    pub logical: i64,
}

impl Hlc {
    pub fn new(physical: i64, logical: i64) -> Self {
        Hlc { physical, logical }
    }
}

/// Lexicographic HLC comparison (-1 / 0 / +1): physical first, logical as tiebreak.
pub fn compare_hlc(a: Hlc, b: Hlc) -> i32 {
    match a.physical.cmp(&b.physical) {
        std::cmp::Ordering::Less => -1,
        std::cmp::Ordering::Greater => 1,
        std::cmp::Ordering::Equal => match a.logical.cmp(&b.logical) {
            std::cmp::Ordering::Less => -1,
            std::cmp::Ordering::Greater => 1,
            std::cmp::Ordering::Equal => 0,
        },
    }
}

/// HLC send: advance to at least `now_physical`, bumping logical when physical doesn't move.
pub fn send(c: Hlc, now_physical: i64) -> Hlc {
    let p = c.physical.max(now_physical);
    if p == c.physical {
        Hlc::new(p, c.logical + 1)
    } else {
        Hlc::new(p, 0)
    }
}

/// HLC receive: the CockroachDB/HLC merge — the result dominates both inputs (bounded divergence).
pub fn receive(c: Hlc, msg: Hlc, now_physical: i64) -> Hlc {
    let p = c.physical.max(msg.physical).max(now_physical);
    let l = if p == c.physical && p == msg.physical {
        c.logical.max(msg.logical) + 1
    } else if p == c.physical {
        c.logical + 1
    } else if p == msg.physical {
        msg.logical + 1
    } else {
        0
    };
    Hlc::new(p, l)
}

/// Definite happens-before: a's whole window ends strictly before b's begins.
pub fn definitely_before(a_physical: i64, a_eps: i64, b_physical: i64, b_eps: i64) -> bool {
    let _ = b_eps;
    a_physical + a_eps < b_physical
}

/// The uncertain zone: neither reading is definitely before the other (windows overlap).
pub fn uncertain(a_physical: i64, a_eps: i64, b_physical: i64, b_eps: i64) -> bool {
    !definitely_before(a_physical, a_eps, b_physical, b_eps)
        && !definitely_before(b_physical, b_eps, a_physical, a_eps)
}
