//! G-Set — grow-only set CRDT, the bottom rung of the algebra ladder
//! (G-Set ⊂ Bag ⊂ Z-set). Mirrors `src/Core.TypeScript/g-set/g-set.ts` +
//! `src/Core/GSet.fs`.
//!
//! A G-Set is the Z-set restricted to non-negative multiplicity with no
//! retractions: every element is present exactly once, `union` is the only
//! combiner, and `union` is **idempotent, commutative, and associative** — the
//! three CRDT convergence laws (replicas that have seen the same elements, in any
//! order, converge with no coordination — the monotone, CALM-coordination-free
//! slice).
//!
//! This is the comms substrate of the git-native agent-bus (B-0954): an
//! append-only `docs/agent-bus/` folder of ZetaId-keyed messages IS a G-Set —
//! re-observing the same id is `union` and a no-op.
//!
//! Canonical representation: an **ascending-sorted, duplicate-free** `Vec<T>`
//! under `T: Ord`. The canonical order makes equality a plain element-wise
//! comparison and keeps the cross-language golden vectors byte-stable.

use core::cmp::Ordering;
use core::iter::Sum;
use core::ops::Add;

/// A grow-only set: a canonical ascending-sorted, duplicate-free run under
/// `T: Ord`. The invariant is held by every constructor here — never build one by
/// hand from an unsorted `Vec`; use [`GSet::of_iter`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GSet<T> {
    items: Vec<T>,
}

impl<T: Ord + Clone> GSet<T> {
    /// The empty G-Set (the `union` identity).
    #[must_use]
    pub const fn empty() -> Self {
        GSet { items: Vec::new() }
    }

    /// A one-element G-Set.
    #[must_use]
    pub fn singleton(x: T) -> Self {
        GSet { items: vec![x] }
    }

    /// Canonicalize arbitrary input: sort ascending + drop duplicates.
    pub fn of_iter(xs: impl IntoIterator<Item = T>) -> Self {
        let mut items: Vec<T> = xs.into_iter().collect();
        items.sort();
        items.dedup();
        GSet { items }
    }

    /// Membership via binary search on the sorted run. O(log n).
    #[must_use]
    pub fn contains(&self, x: &T) -> bool {
        self.items.binary_search(x).is_ok()
    }

    /// The CRDT merge: the union of two sorted-unique runs, kept sorted-unique.
    /// Idempotent, commutative, associative.
    #[must_use]
    pub fn union(&self, other: &Self) -> Self {
        if self.items.is_empty() {
            return other.clone();
        }
        if other.items.is_empty() {
            return self.clone();
        }
        let (a, b) = (&self.items, &other.items);
        let mut out: Vec<T> = Vec::with_capacity(a.len() + b.len());
        let (mut i, mut j) = (0usize, 0usize);
        while i < a.len() && j < b.len() {
            match a[i].cmp(&b[j]) {
                Ordering::Less => {
                    out.push(a[i].clone());
                    i += 1;
                }
                Ordering::Greater => {
                    out.push(b[j].clone());
                    j += 1;
                }
                Ordering::Equal => {
                    out.push(a[i].clone()); // duplicate → keep one
                    i += 1;
                    j += 1;
                }
            }
        }
        out.extend_from_slice(&a[i..]);
        out.extend_from_slice(&b[j..]);
        GSet { items: out }
    }

    /// Add one element (`union` with a singleton); idempotent if already present.
    #[must_use]
    pub fn add(&self, x: T) -> Self {
        if self.contains(&x) {
            self.clone()
        } else {
            self.union(&GSet::singleton(x))
        }
    }

    /// The elements in canonical (ascending) order — a defensive copy.
    #[must_use]
    pub fn to_vec(&self) -> Vec<T> {
        self.items.clone()
    }

    /// The canonical run as a slice (no copy).
    #[must_use]
    pub fn as_slice(&self) -> &[T] {
        &self.items
    }

    /// The number of elements.
    #[must_use]
    pub fn len(&self) -> usize {
        self.items.len()
    }

    /// Whether the set is empty.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }
}

// ── generic-math additive-monoid surface (native Rust idiom, zero-dep) ──────
// G-Set is an additive, commutative + idempotent monoid (identity + associative
// `union`, NO inverse), so it surfaces only `Add` (the `+` operator) + a `Default`
// identity (the `Zero` analog) + `Sum` (fold a collection) — never `Sub`/`Neg`/`Mul`.
// `Default` is std's identity-value trait (no `num_traits` dep, per the zero-prod-dep
// doctrine); `+` IS `union`; `Sum` folds via the monoid so `iter.sum()` works.
//
// `Add` is implemented for `&GSet<T>` (ref-operator, `&a + &b`), NOT `GSet<T>` by
// value: the type already has an inherent `add(&self, x: T)` (add ONE element), and a
// by-value `Add for GSet` would let `Add::add(self, Self)` win method resolution over
// that inherent method for owned receivers — silently breaking `s.add(element)`. The
// ref-operator is the idiomatic Rust form for non-`Copy` collections and keeps both.

impl<T: Ord + Clone> Add for &GSet<T> {
    type Output = GSet<T>;

    /// The additive operator (`&a + &b`): the CRDT `union` merge — same merge as
    /// [`GSet::union`]. Ref-operator (see the module note) so it never collides with
    /// the inherent element-wise [`GSet::add`].
    fn add(self, rhs: &GSet<T>) -> GSet<T> {
        self.union(rhs)
    }
}

impl<T: Ord + Clone> Default for GSet<T> {
    /// The additive-monoid identity (the empty set) — the Rust `Default` analog of
    /// F# `Zero` / C# `AdditiveIdentity`.
    fn default() -> Self {
        Self::empty()
    }
}

impl<T: Ord + Clone> Sum for GSet<T> {
    /// Fold a collection of G-Sets through the monoid (`Default` identity + `+`), so
    /// `iter.sum()` aggregates them — the "generic code folds it for free" payoff.
    fn sum<I: Iterator<Item = GSet<T>>>(iter: I) -> Self {
        iter.fold(Self::default(), |acc, x| &acc + &x)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn g(xs: &[&str]) -> GSet<String> {
        GSet::of_iter(xs.iter().map(|s| (*s).to_string()))
    }

    #[test]
    fn of_iter_sorts_and_dedups() {
        assert_eq!(g(&["b", "a", "b", "c", "a"]).to_vec(), vec!["a", "b", "c"]);
    }

    #[test]
    fn contains_via_binary_search() {
        let s = g(&["a", "c", "e"]);
        assert!(s.contains(&"c".to_string()));
        assert!(!s.contains(&"d".to_string()));
    }

    #[test]
    fn add_is_idempotent() {
        let s = g(&["a", "b"]);
        assert_eq!(s.add("b".to_string()), s); // already present → no change
        assert_eq!(s.add("c".to_string()).to_vec(), vec!["a", "b", "c"]);
    }

    // The three CRDT convergence laws + identity (the fixture's `laws` block).
    #[test]
    fn law_idempotent() {
        let a = g(&["x", "y"]);
        assert_eq!(a.union(&a), a);
    }

    #[test]
    fn law_commutative() {
        let a = g(&["a", "c"]);
        let b = g(&["b", "c", "d"]);
        assert_eq!(a.union(&b), b.union(&a));
    }

    #[test]
    fn law_associative() {
        let a = g(&["a"]);
        let b = g(&["b", "a"]);
        let c = g(&["c", "b"]);
        assert_eq!(a.union(&b).union(&c), a.union(&b.union(&c)));
    }

    #[test]
    fn law_identity() {
        let a = g(&["a", "b"]);
        assert_eq!(a.union(&GSet::empty()), a);
        assert_eq!(GSet::<String>::empty().union(&a), a);
    }

    // ── generic-math additive-monoid surface (Add + Default + Sum) ──────────

    #[test]
    fn generic_math_add_merges_to_explicit_result() {
        // assert the explicit merge content (not `&a + &b == union`, which would be
        // tautological since `+` delegates to `union`) — proves `+` produces the merge
        let a = g(&["a", "b"]);
        let b = g(&["b", "c"]);
        assert_eq!((&a + &b).to_vec(), vec!["a", "b", "c"]);
    }

    #[test]
    fn generic_math_default_is_empty_identity() {
        let a = g(&["a", "b"]);
        let id = GSet::<String>::default();
        assert!(id.is_empty());
        assert_eq!(&id + &a, a); // identity + a = a
        assert_eq!(&a + &id, a); // a + identity = a
    }

    #[test]
    fn generic_math_monoid_laws_via_operator() {
        let a = g(&["a", "b"]);
        let b = g(&["b", "c"]);
        let c = g(&["c", "d"]);
        assert_eq!(&a + &a, a); // idempotent
        assert_eq!(&a + &b, &b + &a); // commutative
        assert_eq!(&(&a + &b) + &c, &a + &(&b + &c)); // associative
    }

    #[test]
    fn generic_math_sum_folds_via_monoid() {
        let sets = vec![g(&["a"]), g(&["b", "a"]), g(&["c"])];
        let merged: GSet<String> = sets.into_iter().sum();
        assert_eq!(merged.to_vec(), vec!["a", "b", "c"]);
    }
}
