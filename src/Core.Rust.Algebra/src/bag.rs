//! Bag — multiset, the MIDDLE rung of the algebra ladder (G-Set ⊂ Bag ⊂ Z-set).
//! Mirrors `src/Core.TypeScript/bag/bag.ts` (the TS reference oracle) +
//! `src/Core.TypeScript/bag/golden-vectors.json`.
//!
//! A Bag is the Z-set restricted to NON-NEGATIVE multiplicity: every key carries
//! a count `n >= 1` (absent ⇒ multiplicity 0), and the only combiner is `union`
//! = per-key **sum**. The contrast with the G-Set (whose `union` is set-union, so
//! idempotent): a Bag's `union` is a commutative **monoid** — commutative,
//! associative, with the empty bag as identity — but **NOT** a semilattice,
//! because `union(a, a)` doubles every count. That non-idempotence is what makes
//! the Bag the counting structure and the step toward the Z-set's signed ℤ
//! weights + retraction. Per the database-design ADR (2026-05-31): Bag = ℕ / sum.
//!
//! Counts are `i64` (matching the int64 F#/C#/Z-set oracles). Rust's integer
//! type makes the TS `assertCount` non-integer guard unnecessary by construction;
//! only the overflow guard carries over (sums use `checked_add`). The overflow
//! threshold is per-representation (JS `2^53` vs i64 `2^63`); the small-count
//! fixtures stay well within both, so all four oracles agree on the vectors.
//!
//! Canonical representation: an **ascending-key-sorted** `Vec<BagEntry<T>>`,
//! every `n >= 1`, no key twice — so equality is plain entry-array equality and
//! the cross-language golden vectors are byte-stable.

use core::cmp::Ordering;
use core::iter::Sum;
use core::ops::Add;

/// One bag entry: a key `e` with a strictly-positive multiplicity `n` (>= 1 in a
/// canonical bag).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BagEntry<T> {
    /// The key.
    pub e: T,
    /// The multiplicity.
    pub n: i64,
}

/// A multiset: a canonical ascending-key-sorted, count-positive run under
/// `T: Ord`. The invariant (sorted, every `n >= 1`, no key twice) is held by
/// every constructor here — never build one by hand; use [`Bag::of_entries`] or
/// [`Bag::of_iter`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Bag<T> {
    items: Vec<BagEntry<T>>,
}

/// Add two counts, re-checking the sum stays in `i64` range before it is stored.
/// Mirrors the TS `addCounts` guard (two valid counts can sum past the
/// representable maximum); panics on overflow rather than silently wrapping.
fn add_counts(a: i64, b: i64) -> i64 {
    a.checked_add(b).expect("Bag multiplicity overflow (i64)")
}

impl<T: Ord + Clone> Bag<T> {
    /// The empty Bag (the `union` identity).
    #[must_use]
    pub const fn empty() -> Self {
        Bag { items: Vec::new() }
    }

    /// A one-key Bag at count `n`; `n <= 0` yields the empty Bag.
    #[must_use]
    pub fn singleton(x: T, n: i64) -> Self {
        if n > 0 {
            Bag {
                items: vec![BagEntry { e: x, n }],
            }
        } else {
            Bag::empty()
        }
    }

    /// Canonicalize arbitrary entries: sum counts per key, drop any summed count
    /// `<= 0`, and sort ascending by key.
    pub fn of_entries(entries: impl IntoIterator<Item = BagEntry<T>>) -> Self {
        let mut v: Vec<BagEntry<T>> = entries.into_iter().collect();
        v.sort_by(|a, b| a.e.cmp(&b.e));
        let mut out: Vec<BagEntry<T>> = Vec::with_capacity(v.len());
        for entry in v {
            match out.last_mut() {
                Some(last) if last.e == entry.e => last.n = add_counts(last.n, entry.n),
                _ => out.push(entry),
            }
        }
        out.retain(|entry| entry.n > 0);
        Bag { items: out }
    }

    /// Build a Bag by counting occurrences in an iterator — each occurrence adds 1.
    pub fn of_iter(xs: impl IntoIterator<Item = T>) -> Self {
        Bag::of_entries(xs.into_iter().map(|x| BagEntry { e: x, n: 1 }))
    }

    /// The multiplicity of `x` (0 if absent). Binary search on the sorted keys. O(log n).
    #[must_use]
    pub fn multiplicity(&self, x: &T) -> i64 {
        match self.items.binary_search_by(|entry| entry.e.cmp(x)) {
            Ok(i) => self.items[i].n,
            Err(_) => 0,
        }
    }

    /// Membership: whether `x` has a positive multiplicity.
    #[must_use]
    pub fn contains(&self, x: &T) -> bool {
        self.multiplicity(x) > 0
    }

    /// The combiner: the per-key SUM of two sorted bags, kept sorted and
    /// count-positive. Commutative, associative, identity — but NOT idempotent:
    /// `union(a, a)` doubles every count.
    #[must_use]
    pub fn union(&self, other: &Self) -> Self {
        if self.items.is_empty() {
            return other.clone();
        }
        if other.items.is_empty() {
            return self.clone();
        }
        let (a, b) = (&self.items, &other.items);
        let mut out: Vec<BagEntry<T>> = Vec::with_capacity(a.len() + b.len());
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
                    out.push(BagEntry {
                        e: a[i].e.clone(),
                        n: add_counts(a[i].n, b[j].n), // same key → counts add (overflow-guarded)
                    });
                    i += 1;
                    j += 1;
                }
            }
        }
        out.extend_from_slice(&a[i..]);
        out.extend_from_slice(&b[j..]);
        Bag { items: out }
    }

    /// Increment `x`'s count by 1 (`union` with a singleton). NOT idempotent.
    #[must_use]
    pub fn add(&self, x: T) -> Self {
        self.union(&Bag {
            items: vec![BagEntry { e: x, n: 1 }],
        })
    }

    /// Increment `x`'s count by `n` (`n <= 0` is a no-op — the Bag is grow-only over ℕ).
    #[must_use]
    pub fn add_n(&self, x: T, n: i64) -> Self {
        if n > 0 {
            self.union(&Bag {
                items: vec![BagEntry { e: x, n }],
            })
        } else {
            self.clone()
        }
    }

    /// The entries in canonical (ascending-key) order — a defensive copy.
    #[must_use]
    pub fn to_entries(&self) -> Vec<BagEntry<T>> {
        self.items.clone()
    }

    /// The canonical run as a slice (no copy).
    #[must_use]
    pub fn as_slice(&self) -> &[BagEntry<T>] {
        &self.items
    }

    /// The number of DISTINCT keys (the support size).
    #[must_use]
    pub fn distinct_count(&self) -> usize {
        self.items.len()
    }

    /// The sum of all multiplicities (the total count across keys); panics on
    /// `i64` overflow (consistent with the `union` / `of_entries` guards).
    #[must_use]
    pub fn total(&self) -> i64 {
        self.items
            .iter()
            .fold(0i64, |s, entry| add_counts(s, entry.n))
    }

    /// Whether the Bag has no keys.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }
}

// ── generic-math additive-monoid surface (native Rust idiom, zero-dep) ──────
// Bag is an additive, commutative monoid (identity + associative per-key-sum `union`,
// NO inverse) — but, unlike a G-Set, NOT idempotent (`&a + &a` doubles counts). It
// surfaces `Add` (the `+` operator) + a `Default` identity (the `Zero` analog) + `Sum`
// (fold a collection) — never `Sub`/`Neg`/`Mul` (the abelian-group step is the Z-set).
// `Add` is on `&Bag<T>` (ref-operator, `&a + &b`), NOT `Bag<T>` by value: the type has an
// inherent `add(&self, x: T)` (add ONE occurrence), and a by-value `Add for Bag` would let
// `Add::add(self, Self)` win method resolution over it — same collision the G-Set slice hit.

impl<T: Ord + Clone> Add for &Bag<T> {
    type Output = Bag<T>;

    /// The additive operator (`&a + &b`): the per-key SUM `union` merge (overflow-guarded).
    /// Ref-operator (see the module note) so it never collides with the inherent [`Bag::add`].
    fn add(self, rhs: &Bag<T>) -> Bag<T> {
        self.union(rhs)
    }
}

impl<T: Ord + Clone> Default for Bag<T> {
    /// The additive-monoid identity (the empty bag) — the Rust `Default` analog of
    /// F# `Zero` / C# `AdditiveIdentity`.
    fn default() -> Self {
        Self::empty()
    }
}

impl<T: Ord + Clone> Sum for Bag<T> {
    /// Fold a collection of Bags through the monoid, so `iter.sum()` aggregates them (per-key
    /// sums) — the "generic code folds it" payoff. `reduce` folds from the FIRST element (no
    /// identity-seed clone — `&empty + &x` would clone `x` via union's empty short-circuit);
    /// an empty iterator yields the `Default` identity.
    fn sum<I: Iterator<Item = Bag<T>>>(iter: I) -> Self {
        iter.reduce(|acc, x| &acc + &x).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn e(key: &str, n: i64) -> BagEntry<String> {
        BagEntry {
            e: key.to_string(),
            n,
        }
    }

    fn bag(entries: &[(&str, i64)]) -> Bag<String> {
        Bag::of_entries(entries.iter().map(|(k, n)| e(k, *n)))
    }

    #[test]
    fn of_iter_counts_occurrences_sorted() {
        assert_eq!(
            Bag::of_iter(
                ["c", "a", "b", "a", "c", "c"]
                    .iter()
                    .map(|s| (*s).to_string())
            )
            .to_entries(),
            vec![e("a", 2), e("b", 1), e("c", 3)],
        );
    }

    #[test]
    fn of_entries_sums_per_key_and_drops_nonpositive() {
        assert_eq!(
            bag(&[("a", 1), ("a", 2), ("b", 0), ("c", -1)]).to_entries(),
            vec![e("a", 3)],
        );
    }

    #[test]
    fn singleton_zero_is_empty() {
        assert!(Bag::<String>::singleton("x".to_string(), 0).is_empty());
        assert_eq!(
            Bag::singleton("x".to_string(), 4).to_entries(),
            vec![e("x", 4)]
        );
    }

    #[test]
    fn multiplicity_and_contains() {
        let b = bag(&[("a", 2), ("c", 5), ("e", 1)]);
        assert_eq!(b.multiplicity(&"c".to_string()), 5);
        assert_eq!(b.multiplicity(&"d".to_string()), 0);
        assert!(b.contains(&"a".to_string()));
        assert!(!b.contains(&"z".to_string()));
    }

    #[test]
    fn distinct_count_and_total() {
        let b = bag(&[("a", 2), ("b", 3)]);
        assert_eq!(b.distinct_count(), 2);
        assert_eq!(b.total(), 5);
    }

    // The commutative-monoid laws (and NON-idempotence — the Bag/G-Set distinction).
    #[test]
    fn law_commutative() {
        let a = bag(&[("a", 1), ("b", 2)]);
        let b = bag(&[("b", 1), ("c", 3)]);
        assert_eq!(a.union(&b), b.union(&a));
    }

    #[test]
    fn law_associative() {
        let a = bag(&[("a", 1), ("b", 2)]);
        let b = bag(&[("b", 1), ("c", 3)]);
        let c = bag(&[("c", 1), ("d", 4)]);
        assert_eq!(a.union(&b).union(&c), a.union(&b.union(&c)));
    }

    #[test]
    fn law_identity() {
        let a = bag(&[("a", 1), ("b", 2)]);
        assert_eq!(a.union(&Bag::empty()), a);
        assert_eq!(Bag::<String>::empty().union(&a), a);
    }

    #[test]
    fn union_not_idempotent_doubles_counts() {
        let a = bag(&[("a", 1), ("b", 2)]);
        assert_eq!(a.union(&a).to_entries(), vec![e("a", 2), e("b", 4)]);
        assert_ne!(a.union(&a), a);
    }

    #[test]
    fn union_sums_overlap_carries_disjoint() {
        let a = bag(&[("a", 1), ("b", 2)]);
        let b = bag(&[("b", 1), ("c", 3)]);
        assert_eq!(
            a.union(&b).to_entries(),
            vec![e("a", 1), e("b", 3), e("c", 3)]
        );
    }

    #[test]
    fn add_and_add_n() {
        let a = bag(&[("a", 1), ("b", 2)]);
        assert_eq!(
            a.add("a".to_string()).to_entries(),
            vec![e("a", 2), e("b", 2)]
        );
        assert_eq!(
            a.add_n("z".to_string(), 3).to_entries(),
            vec![e("a", 1), e("b", 2), e("z", 3)]
        );
        assert_eq!(a.add_n("z".to_string(), 0), a); // n <= 0 is a no-op
    }

    // ── generic-math additive-monoid surface (Add + Default + Sum) ──────────

    #[test]
    fn generic_math_add_is_per_key_sum() {
        // explicit per-key-sum result (not `&a + &b == union`, which would be tautological)
        let a = bag(&[("a", 1), ("b", 2)]);
        let b = bag(&[("b", 1), ("c", 3)]);
        assert_eq!((&a + &b).to_entries(), vec![e("a", 1), e("b", 3), e("c", 3)]);
    }

    #[test]
    fn generic_math_default_is_empty_identity() {
        let a = bag(&[("a", 1), ("b", 2)]);
        let id = Bag::<String>::default();
        assert!(id.is_empty());
        assert_eq!(&id + &a, a); // identity + a = a
        assert_eq!(&a + &id, a); // a + identity = a
    }

    #[test]
    fn generic_math_commutative_associative_but_not_idempotent() {
        let a = bag(&[("a", 1), ("b", 2)]);
        let b = bag(&[("b", 1), ("c", 3)]);
        let c = bag(&[("c", 5)]);
        assert_eq!(&a + &b, &b + &a); // commutative
        assert_eq!(&(&a + &b) + &c, &a + &(&b + &c)); // associative
        assert_eq!((&a + &a).to_entries(), vec![e("a", 2), e("b", 4)]); // NOT idempotent — doubles
    }

    #[test]
    fn generic_math_sum_folds_per_key() {
        let bags = vec![bag(&[("a", 1)]), bag(&[("a", 2), ("b", 1)]), bag(&[("b", 3)])];
        let merged: Bag<String> = bags.into_iter().sum();
        assert_eq!(merged.to_entries(), vec![e("a", 3), e("b", 4)]);
    }
}
