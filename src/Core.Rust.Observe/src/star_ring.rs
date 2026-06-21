//! star_ring.rs — the *-ring trait + instances (port of IStarRing<T>).
//!
//! A *-ring: a ring (zero, one, add, mul, negate) plus an involution (conj).
//! The soft-lane interpreter is generic over this trait — swap the instance,
//! change the physics (real → Bayesian, complex → quantum, quaternion → future).

/// The *-ring trait: Zero/One/Add/Mul/Negate + Conj (involution).
pub trait StarRing: Clone + PartialEq {
    fn zero() -> Self;
    fn one() -> Self;
    fn add(a: &Self, b: &Self) -> Self;
    fn mul(a: &Self, b: &Self) -> Self;
    fn negate(a: &Self) -> Self;
    fn conj(a: &Self) -> Self;
    fn is_zero(a: &Self) -> bool;
}

/// Real numbers (f64) as a *-ring. Conj = identity.
impl StarRing for f64 {
    fn zero() -> Self {
        0.0
    }
    fn one() -> Self {
        1.0
    }
    fn add(a: &Self, b: &Self) -> Self {
        a + b
    }
    fn mul(a: &Self, b: &Self) -> Self {
        a * b
    }
    fn negate(a: &Self) -> Self {
        -a
    }
    fn conj(a: &Self) -> Self {
        *a
    }
    fn is_zero(a: &Self) -> bool {
        a.abs() < 1e-12
    }
}

/// Complex number (re + im*i).
#[derive(Clone, PartialEq, Debug)]
pub struct Complex {
    pub re: f64,
    pub im: f64,
}

impl StarRing for Complex {
    fn zero() -> Self {
        Complex { re: 0.0, im: 0.0 }
    }
    fn one() -> Self {
        Complex { re: 1.0, im: 0.0 }
    }
    fn add(a: &Self, b: &Self) -> Self {
        Complex {
            re: a.re + b.re,
            im: a.im + b.im,
        }
    }
    fn mul(a: &Self, b: &Self) -> Self {
        Complex {
            re: a.re * b.re - a.im * b.im,
            im: a.re * b.im + a.im * b.re,
        }
    }
    fn negate(a: &Self) -> Self {
        Complex {
            re: -a.re,
            im: -a.im,
        }
    }
    fn conj(a: &Self) -> Self {
        Complex {
            re: a.re,
            im: -a.im,
        }
    }
    fn is_zero(a: &Self) -> bool {
        a.re * a.re + a.im * a.im < 1e-12
    }
}

/// A weighted entry: (key, weight) where weight is from a *-ring.
#[derive(Clone)]
pub struct WEntry<W: StarRing> {
    pub key: u64,
    pub weight: W,
}

/// Consolidate: sum weights of identical keys, drop zeros.
/// This is where interference (complex) or mixture (real) happens.
pub fn consolidate<W: StarRing>(entries: Vec<WEntry<W>>) -> Vec<WEntry<W>> {
    let mut grouped: Vec<WEntry<W>> = Vec::new();
    for entry in entries {
        if let Some(existing) = grouped.iter_mut().find(|g| g.key == entry.key) {
            existing.weight = W::add(&existing.weight, &entry.weight);
        } else {
            grouped.push(entry);
        }
    }
    grouped
        .into_iter()
        .filter(|g| !W::is_zero(&g.weight))
        .collect()
}

/// Soft mix: fold IR ops over a weighted ensemble. Ring-generic.
/// Each op can FORK frames (1→N for branching ops). Support grows only
/// by actual uncertainty, not by register width. For mul/xorshr (permutations),
/// each frame maps 1→1 (no growth). The "grows in bits by uncertainty" property.
pub fn soft_mix<W: StarRing>(
    ops: &[(&str, u64)],
    width: u32,
    input: Vec<WEntry<W>>,
) -> Vec<WEntry<W>> {
    let mask: u64 = if width >= 64 {
        u64::MAX
    } else {
        (1u64 << width) - 1
    };
    let mut ensemble = input;
    for &(op, val) in ops {
        // flatMap: each frame can produce multiple output frames (fork).
        // mul/xorshr: deterministic (1→1). branch: 1→2 (grows by 1 bit of uncertainty).
        ensemble = ensemble
            .into_iter()
            .flat_map(|e| {
                match op {
                    "mul" => vec![WEntry {
                        key: e.key.wrapping_mul(val) & mask,
                        weight: e.weight,
                    }],
                    "xorshr" => vec![WEntry {
                        key: (e.key ^ (e.key >> val)) & mask,
                        weight: e.weight,
                    }],
                    "branch" => {
                        // Fork: two frames, each with the original weight (to be scaled by 1/√2 later)
                        vec![
                            WEntry {
                                key: e.key & mask,
                                weight: e.weight.clone(),
                            },
                            WEntry {
                                key: (e.key ^ (1u64 << val)) & mask,
                                weight: e.weight,
                            },
                        ]
                    }
                    _ => vec![WEntry {
                        key: e.key,
                        weight: e.weight,
                    }],
                }
            })
            .collect();
        ensemble = consolidate(ensemble);
    }
    ensemble
}
