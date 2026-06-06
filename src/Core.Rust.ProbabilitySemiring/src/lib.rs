//! Exact-rational probability `(+,×)` and Viterbi `(max,×)` semirings, Rust oracle.
//!
//! Conforms to the F# canonical shape (`src/Core/ProbabilitySemiring.fs`) by agreeing on the shared seed
//! (`src/Core.TypeScript/probability-semiring/golden-vectors.json`) that the C#/F#/TS oracles also verify.
//! Exact rational ℚ (`i64` num/den, lowest terms, positive denominator) — no floats, byte-lockable.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rational {
    pub n: i64,
    pub d: i64,
}

fn gcd(a: i64, b: i64) -> i64 {
    if b == 0 {
        a
    } else {
        gcd(b, a % b)
    }
}

/// Construct a normalized rational (lowest terms, positive denominator). `d == 0` panics.
pub fn rat(num: i64, den: i64) -> Rational {
    assert!(den != 0, "rational denominator is zero");
    let s = if den < 0 { -1 } else { 1 };
    let n = s * num;
    let d = s * den;
    let mut g = gcd(n.abs(), d);
    if g == 0 {
        g = 1;
    }
    Rational { n: n / g, d: d / g }
}

pub fn zero() -> Rational {
    Rational { n: 0, d: 1 }
}

/// Probability-semiring ⊕ (and the additive op): exact `a + b`.
pub fn add(a: Rational, b: Rational) -> Rational {
    rat(a.n * b.d + b.n * a.d, a.d * b.d)
}

/// ⊗ of both semirings: exact `a * b`.
pub fn mul(a: Rational, b: Rational) -> Rational {
    rat(a.n * b.n, a.d * b.d)
}

/// Sign of `a - b` (-1 / 0 / +1); denominators are positive after normalization.
pub fn compare(a: Rational, b: Rational) -> i32 {
    (a.n * b.d - b.n * a.d).signum() as i32
}

/// Viterbi-semiring ⊕: exact `max(a, b)`.
pub fn max(a: Rational, b: Rational) -> Rational {
    if compare(a, b) >= 0 {
        a
    } else {
        b
    }
}

/// Exact reciprocal `1/a` (ℚ is a field). `a.n == 0` panics.
pub fn recip(a: Rational) -> Rational {
    assert!(a.n != 0, "reciprocal of zero");
    rat(a.d, a.n)
}

/// Exact division `a / b` (`b = 0` panics) — used by the relative-observer reconciliation.
pub fn div(a: Rational, b: Rational) -> Rational {
    mul(a, recip(b))
}

/// Relative-observer 3-way merge over the Merkle ancestor: `merged(i) = a(i)·b(i)/ancestor(i)`.
pub fn merge3(ancestor: &[Rational], a: &[Rational], b: &[Rational]) -> Vec<Rational> {
    (0..ancestor.len()).map(|i| div(mul(a[i], b[i]), ancestor[i])).collect()
}

/// One forward step over `(+,×)`: `π'(j) = Σ_i π(i)·P(i,j)`.
pub fn forward_step(pi: &[Rational], p: &[Vec<Rational>]) -> Vec<Rational> {
    let n = p.len();
    (0..n)
        .map(|j| {
            let mut acc = zero();
            for (i, &pii) in pi.iter().enumerate() {
                acc = add(acc, mul(pii, p[i][j]));
            }
            acc
        })
        .collect()
}

/// One Viterbi step over `(max,×)`: `v'(j) = max_i v(i)·P(i,j)`.
pub fn viterbi_step(v: &[Rational], p: &[Vec<Rational>]) -> Vec<Rational> {
    let n = p.len();
    (0..n)
        .map(|j| {
            let mut acc = zero();
            for (i, &vi) in v.iter().enumerate() {
                acc = max(acc, mul(vi, p[i][j]));
            }
            acc
        })
        .collect()
}
