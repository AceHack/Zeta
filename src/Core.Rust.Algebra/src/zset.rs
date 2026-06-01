//! Z-set — signed multiset, the TOP rung of the algebra ladder (G-Set ⊂ Bag ⊂ Z-set).
//! Mirrors `src/Core.TypeScript/z-set/z-set.ts` (the TS reference oracle) +
//! `src/Core.TypeScript/z-set/golden-vectors.json`, and the F#/C# twins.
//!
//! A Z-set widens the Bag from ℕ to **ℤ**: every key carries a NONZERO `i64`
//! weight `w` (positive OR negative; absent ⇒ weight 0), and the only combiner is
//! `union` = per-key **sum**. Two contrasts pin it down:
//!
//! - vs the **Bag** (ℕ / sum): a Bag drops any key summed `<= 0`; a Z-set drops
//!   ONLY `== 0` — a negative weight is a valid stored value (a retraction in
//!   flight). That single change of the drop rule (`> 0` → `!= 0`) is the whole
//!   ℕ→ℤ widening, and it makes the monoid an abelian **group**: every Z-set has
//!   an inverse [`ZSet::negate`] (flip every sign), with `union(a, negate(a))`
//!   empty — the law a Bag cannot satisfy, and why the Z-set (not the Bag) is the
//!   substrate for retraction / undo / DBSP incremental views.
//! - vs the **G-Set** (idempotent set-union): like the Bag, `union` is NOT
//!   idempotent — `union(a, a)` doubles every weight.
//!
//! Per the database-design ADR (2026-05-31): Z-set = ℤ / sum. Weights are `i64`
//! (matching the int64 F#/C# oracles); sums use `checked_add` and negation uses
//! `checked_neg` (overflow panics rather than silently wrapping).
//!
//! Canonical representation: an **ascending-key-sorted** `Vec<ZEntry<T>>`, every
//! `w != 0`, no key twice — so equality is plain entry-array equality and the
//! cross-language golden vectors are byte-stable.

use core::cmp::Ordering;
use core::iter::Sum;
use core::ops::{Add, Neg, Sub};

/// One Z-set entry: a key `e` with a strictly-nonzero signed weight `w`
/// (`!= 0` in a canonical Z-set; may be negative).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ZEntry<T> {
    /// The key.
    pub e: T,
    /// The signed weight (`!= 0` in a canonical Z-set; may be negative).
    pub w: i64,
}

/// A signed multiset: a canonical ascending-key-sorted, weight-nonzero run under
/// `T: Ord`. The invariant (sorted, every `w != 0`, no key twice) is held by
/// every constructor here — never build one by hand; use [`ZSet::of_entries`] or
/// [`ZSet::of_iter`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ZSet<T> {
    items: Vec<ZEntry<T>>,
}

/// Add two weights, re-checking the sum stays in `i64` range before it is stored.
/// Mirrors the TS `addWeights` guard (both signs); panics on overflow rather than
/// silently wrapping.
fn add_weights(a: i64, b: i64) -> i64 {
    a.checked_add(b).expect("Z-set weight overflow (i64)")
}

impl<T: Ord + Clone> ZSet<T> {
    /// The empty Z-set (the `union` identity).
    #[must_use]
    pub const fn empty() -> Self {
        ZSet { items: Vec::new() }
    }

    /// A one-key Z-set at weight `w`; `w == 0` yields the empty Z-set. `w` may be negative.
    #[must_use]
    pub fn singleton(x: T, w: i64) -> Self {
        if w != 0 {
            ZSet {
                items: vec![ZEntry { e: x, w }],
            }
        } else {
            ZSet::empty()
        }
    }

    /// Canonicalize arbitrary entries: sum weights per key, drop any summed weight
    /// `== 0` (retraction — KEEPS negatives), and sort ascending by key.
    pub fn of_entries(entries: impl IntoIterator<Item = ZEntry<T>>) -> Self {
        let mut v: Vec<ZEntry<T>> = entries.into_iter().collect();
        v.sort_by(|a, b| a.e.cmp(&b.e));
        let mut out: Vec<ZEntry<T>> = Vec::with_capacity(v.len());
        for entry in v {
            match out.last_mut() {
                Some(last) if last.e == entry.e => last.w = add_weights(last.w, entry.w),
                _ => out.push(entry),
            }
        }
        // Drop keys that netted to 0 (retraction); KEEP negatives (drop rule != 0, not <= 0).
        out.retain(|entry| entry.w != 0);
        ZSet { items: out }
    }

    /// Build a Z-set by counting occurrences in an iterator — each occurrence adds weight 1.
    pub fn of_iter(xs: impl IntoIterator<Item = T>) -> Self {
        ZSet::of_entries(xs.into_iter().map(|x| ZEntry { e: x, w: 1 }))
    }

    /// The weight of `x` (0 if absent — including a key retracted to 0). Binary search. O(log n).
    #[must_use]
    pub fn weight(&self, x: &T) -> i64 {
        match self.items.binary_search_by(|entry| entry.e.cmp(x)) {
            Ok(i) => self.items[i].w,
            Err(_) => 0,
        }
    }

    /// Membership: whether `x` has a NONZERO weight (positive or negative).
    #[must_use]
    pub fn contains(&self, x: &T) -> bool {
        self.weight(x) != 0
    }

    /// The combiner: the per-key SUM of two sorted Z-sets, kept sorted and
    /// weight-nonzero (a shared key whose weights cancel to 0 is DROPPED —
    /// retraction). Commutative, associative, identity, with [`ZSet::negate`] the
    /// inverse (abelian group) — but NOT idempotent: `union(a, a)` doubles weights.
    #[must_use]
    pub fn union(&self, other: &Self) -> Self {
        if self.items.is_empty() {
            return other.clone();
        }
        if other.items.is_empty() {
            return self.clone();
        }
        let (a, b) = (&self.items, &other.items);
        let mut out: Vec<ZEntry<T>> = Vec::with_capacity(a.len() + b.len());
        let (mut i, mut j) = (0usize, 0usize);
        while i < a.len() && j < b.len() {
            match a[i].e.cmp(&b[j].e) {
                Ordering::Less => {
                    out.push(a[i].clone());
                    i += 1;
                }
                Ordering::Greater => {
                    out.push(b[j].clone());
                    j += 1;
                }
                Ordering::Equal => {
                    let sum = add_weights(a[i].w, b[j].w); // same key → weights add (overflow-guarded)
                    if sum != 0 {
                        out.push(ZEntry {
                            e: a[i].e.clone(),
                            w: sum,
                        }); // == 0 ⇒ retracted, dropped
                    }
                    i += 1;
                    j += 1;
                }
            }
        }
        out.extend_from_slice(&a[i..]);
        out.extend_from_slice(&b[j..]);
        ZSet { items: out }
    }

    /// The abelian-group inverse: flip the sign of every weight. `union(a, negate(a))`
    /// is empty (the law the Bag's monoid cannot satisfy). Preserves the canonical
    /// invariant — a nonzero weight negates to a nonzero weight, order unchanged.
    #[must_use]
    pub fn negate(&self) -> Self {
        ZSet {
            items: self
                .items
                .iter()
                .map(|entry| ZEntry {
                    e: entry.e.clone(),
                    w: entry
                        .w
                        .checked_neg()
                        .expect("Z-set weight overflow on negate (i64)"),
                })
                .collect(),
        }
    }

    /// Increment `x`'s weight by 1 (`union` with a singleton). NOT idempotent.
    #[must_use]
    pub fn add(&self, x: T) -> Self {
        self.union(&ZSet {
            items: vec![ZEntry { e: x, w: 1 }],
        })
    }

    /// Add signed weight `w` to `x` (`w == 0` is a no-op; a key driven to net 0 is retracted).
    #[must_use]
    pub fn add_w(&self, x: T, w: i64) -> Self {
        if w != 0 {
            self.union(&ZSet {
                items: vec![ZEntry { e: x, w }],
            })
        } else {
            self.clone()
        }
    }

    /// The entries in canonical (ascending-key) order — a defensive copy.
    #[must_use]
    pub fn to_entries(&self) -> Vec<ZEntry<T>> {
        self.items.clone()
    }

    /// The canonical run as a slice (no copy).
    #[must_use]
    pub fn as_slice(&self) -> &[ZEntry<T>] {
        &self.items
    }

    /// The number of DISTINCT keys with nonzero weight (the support size).
    #[must_use]
    pub fn distinct_count(&self) -> usize {
        self.items.len()
    }

    /// The sum of all weights (may be negative or zero); panics on `i64` overflow.
    #[must_use]
    pub fn total(&self) -> i64 {
        self.items
            .iter()
            .fold(0i64, |s, entry| add_weights(s, entry.w))
    }

    /// Whether the Z-set has no keys.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }
}

// ── generic-math abelian-group surface (native Rust idiom, zero-dep) ─────────
// Rust has no `System.Numerics`, so we push our own port — the `std::ops` traits
// ("numerics like dotnet as our interface, push to other langs if they don't
// have", Aaron 2026-06-01). Z-set is an abelian GROUP (identity + associative
// `union` + inverse `negate`), so — unlike G-Set/Bag (`Add` + `Default` + `Sum`
// only) — it surfaces `Sub` + `Neg` too. `Default` is std's identity-value trait
// (the `Zero` analog; no `num_traits` dep, per the zero-prod-dep doctrine); `+`
// IS `union`, `-a` IS `negate`, `a - b` IS `union(negate)`; `Sum` folds a
// collection. NOT a numeric ring product (the scalar is per-element `scale`).
//
// All three operators are implemented for `&ZSet<T>` (ref-operator, `&a + &b`),
// NOT `ZSet<T>` by value: the type has an inherent `add(&self, x: T)` (add ONE
// key), and a by-value `Add for ZSet` would let `Add::add(self, Self)` win method
// resolution over that inherent method for owned receivers — silently breaking
// `z.add(key)`. The ref-operator is the idiomatic Rust form for non-`Copy`
// collections and keeps both (mirrors the G-Set #6469 fix).

impl<T: Ord + Clone> Add for &ZSet<T> {
    type Output = ZSet<T>;

    /// `&a + &b` — per-key signed sum (the abelian-group operation), the same merge
    /// as [`ZSet::union`]. Ref-operator (see the module note) so it never collides
    /// with the inherent element-wise [`ZSet::add`]. NOT idempotent (`&a + &a`
    /// doubles every weight).
    fn add(self, rhs: &ZSet<T>) -> ZSet<T> {
        self.union(rhs)
    }
}

impl<T: Ord + Clone> Neg for &ZSet<T> {
    type Output = ZSet<T>;

    /// `-&a` — the abelian-group inverse (flip every sign), the same as
    /// [`ZSet::negate`], so `&a + (-&a)` is empty (the law a Bag cannot satisfy).
    fn neg(self) -> ZSet<T> {
        self.negate()
    }
}

impl<T: Ord + Clone> Sub for &ZSet<T> {
    type Output = ZSet<T>;

    /// `&a - &b == &a + (-&b)` — retraction expressed directly (`union` with the
    /// negation of `rhs`).
    fn sub(self, rhs: &ZSet<T>) -> ZSet<T> {
        self.union(&rhs.negate())
    }
}

impl<T: Ord + Clone> Default for ZSet<T> {
    /// The additive-monoid identity (the empty Z-set) — the Rust `Default` analog of
    /// F# `Zero` / C# `AdditiveIdentity`.
    fn default() -> Self {
        Self::empty()
    }
}

impl<T: Ord + Clone> Sum for ZSet<T> {
    /// Fold a collection of Z-sets through the group (`+`), so `iter.sum()`
    /// aggregates them with retraction-to-0 drop. `reduce` folds from the FIRST
    /// element (no identity-clone of the seed); empty input yields `Default` (empty).
    fn sum<I: Iterator<Item = ZSet<T>>>(iter: I) -> Self {
        iter.reduce(|acc, x| &acc + &x).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn e(key: &str, w: i64) -> ZEntry<String> {
        ZEntry {
            e: key.to_string(),
            w,
        }
    }

    fn zset(entries: &[(&str, i64)]) -> ZSet<String> {
        ZSet::of_entries(entries.iter().map(|(k, w)| e(k, *w)))
    }

    #[test]
    fn of_iter_counts_occurrences_sorted() {
        assert_eq!(
            ZSet::of_iter(
                ["c", "a", "b", "a", "c", "c"]
                    .iter()
                    .map(|s| (*s).to_string())
            )
            .to_entries(),
            vec![e("a", 2), e("b", 1), e("c", 3)],
        );
    }

    #[test]
    fn of_entries_sums_drops_zero_keeps_negatives() {
        // c: 1+3=4; b nets to 0 → dropped; d: -1 KEPT (a Bag would drop it).
        assert_eq!(
            zset(&[("c", 1), ("a", 2), ("c", 3), ("b", 1), ("b", -1), ("d", -1)]).to_entries(),
            vec![e("a", 2), e("c", 4), e("d", -1)],
        );
    }

    #[test]
    fn singleton_zero_is_empty_negatives_kept() {
        assert!(ZSet::<String>::singleton("x".to_string(), 0).is_empty());
        assert_eq!(
            ZSet::singleton("x".to_string(), -4).to_entries(),
            vec![e("x", -4)]
        );
    }

    #[test]
    fn weight_and_contains() {
        let z = zset(&[("a", 2), ("c", -5), ("e", 1)]);
        assert_eq!(z.weight(&"c".to_string()), -5);
        assert_eq!(z.weight(&"d".to_string()), 0);
        assert!(z.contains(&"c".to_string())); // negative still "contained"
        assert!(!z.contains(&"z".to_string()));
    }

    #[test]
    fn distinct_count_and_total() {
        let z = zset(&[("a", 2), ("b", -3)]);
        assert_eq!(z.distinct_count(), 2);
        assert_eq!(z.total(), -1);
    }

    // Abelian-group laws (commutative, associative, identity, inverse) + NON-idempotence.
    #[test]
    fn law_commutative() {
        let a = zset(&[("a", 1), ("b", 2)]);
        let b = zset(&[("b", -1), ("c", 3)]);
        assert_eq!(a.union(&b), b.union(&a));
    }

    #[test]
    fn law_associative() {
        let a = zset(&[("a", 1), ("b", 2)]);
        let b = zset(&[("b", -1), ("c", 3)]);
        let c = zset(&[("c", 1), ("d", -4)]);
        assert_eq!(a.union(&b).union(&c), a.union(&b.union(&c)));
    }

    #[test]
    fn law_identity() {
        let a = zset(&[("a", 1), ("b", 2)]);
        assert_eq!(a.union(&ZSet::empty()), a);
        assert_eq!(ZSet::<String>::empty().union(&a), a);
    }

    #[test]
    fn law_inverse_negate() {
        // union(a, negate(a)) == empty — the law a Bag cannot satisfy.
        let a = zset(&[("a", 1), ("b", 2)]);
        assert!(a.union(&a.negate()).is_empty());
        // negate flips signs + is an involution.
        assert_eq!(a.negate().to_entries(), vec![e("a", -1), e("b", -2)]);
        assert_eq!(a.negate().negate(), a);
    }

    #[test]
    fn union_not_idempotent_doubles_weights() {
        let a = zset(&[("a", 1), ("b", 2)]);
        assert_eq!(a.union(&a).to_entries(), vec![e("a", 2), e("b", 4)]);
        assert_ne!(a.union(&a), a);
    }

    #[test]
    fn union_retraction_to_zero_drops_keeps_negative() {
        let a = zset(&[("a", 1), ("b", 2)]);
        // b: 2 + (-2) = 0 → dropped; a survives at 1.
        assert_eq!(a.union(&zset(&[("b", -2)])).to_entries(), vec![e("a", 1)]);
        // a: 1 + (-3) = -2 → negative kept.
        assert_eq!(
            a.union(&zset(&[("a", -3)])).to_entries(),
            vec![e("a", -2), e("b", 2)]
        );
    }

    #[test]
    fn add_and_add_w() {
        let a = zset(&[("a", 1), ("b", 2)]);
        assert_eq!(
            a.add("a".to_string()).to_entries(),
            vec![e("a", 2), e("b", 2)]
        );
        assert_eq!(
            a.add_w("z".to_string(), -3).to_entries(),
            vec![e("a", 1), e("b", 2), e("z", -3)]
        );
        assert_eq!(a.add_w("z".to_string(), 0), a); // w == 0 no-op
        assert_eq!(a.add_w("a".to_string(), -1).to_entries(), vec![e("b", 2)]); // retract a to 0
    }

    // ── generic-math abelian-group surface (Add/Sub/Neg + Default + Sum) ──────

    #[test]
    fn generic_math_operators_equal_methods() {
        let a = zset(&[("a", 1), ("b", 2)]);
        let b = zset(&[("b", 1), ("c", 3)]);
        assert_eq!(&a + &b, a.union(&b)); // + == union
        assert_eq!(-&a, a.negate()); // -a == negate
        assert_eq!(&a - &b, a.union(&b.negate())); // a - b == union(negate)
    }

    #[test]
    fn generic_math_default_is_empty_and_identity() {
        let a = zset(&[("a", 1), ("b", 2)]);
        assert!(ZSet::<String>::default().is_empty()); // Default == empty (the Zero analog)
        assert_eq!(&ZSet::<String>::default() + &a, a); // identity + a = a
        assert_eq!(&a + &ZSet::<String>::default(), a); // a + identity = a
    }

    #[test]
    fn generic_math_abelian_group_inverse() {
        // a + (-a) = empty and a - a = empty — the law a Bag's monoid cannot satisfy.
        let a = zset(&[("a", 1), ("b", -2), ("c", 3)]);
        assert!((&a + &(-&a)).is_empty());
        assert!((&a - &a).is_empty());
    }

    #[test]
    fn generic_math_not_idempotent_doubles() {
        let a = zset(&[("a", 1), ("b", -3)]);
        // SUM, not set-union: doubles every weight (the Bag/Z-set step away from G-Set).
        assert_eq!((&a + &a).to_entries(), vec![e("a", 2), e("b", -6)]);
    }

    #[test]
    fn generic_math_sum_folds_with_retraction() {
        let zs = vec![
            zset(&[("a", 1)]),
            zset(&[("a", 1), ("b", 2)]),
            zset(&[("b", -2), ("c", 5)]),
        ];
        let merged: ZSet<String> = zs.into_iter().sum();
        // b nets to 0 and drops
        assert_eq!(merged.to_entries(), vec![e("a", 2), e("c", 5)]);
    }
}
