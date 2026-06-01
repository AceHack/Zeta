//! `IndexedZSet<K, V>` — the rung ABOVE the Z-set on the algebra ladder
//! (G-Set ⊂ Bag ⊂ Z-set ⊂ **IndexedZSet**), the Rust parity oracle (#4 of
//! TS / F# / C# / Rust).
//!
//! Conceptually an IndexedZSet is `Z[K × V]` — a Z-set over `(key, value)`
//! pairs — but stored **grouped by key**: an ascending-by-key run of groups,
//! each carrying its per-key `ZSet<V>`. That grouping is precisely what turns
//! the bilinear **join** and key-wise aggregation into a *linear merge* over
//! two sorted runs, which is why it is the substrate DBSP incremental views are
//! built on. It mirrors the F# engine `src/Core/IndexedZSet.fs` (the
//! originating oracle) and the TS reference oracle
//! (`src/Core.TypeScript/indexed-z-set/`).
//!
//! **Canonical form** (the cross-oracle byte-diff equality contract): groups
//! sorted ascending by key (no key twice), each group's `values` a canonical
//! `ZSet<V>` (sorted by value, weight `!= 0`), and a group whose values cancel
//! to empty is DROPPED — the abelian-group inverse lifts from the value Z-set
//! up to the indexed level. Because every weight lives in `ℤ`, the whole thing
//! is a **commutative (abelian) group** under [`IndexedZSet::add`] with
//! [`IndexedZSet::neg`] the inverse — a generalized `ℤ`-relation (relation
//! ring), the coordination-free substrate for distributed deletion (you delete
//! by adding the negative, no lock round).
//!
//! Every op reduces to the [`crate::zset::ZSet`] primitive — `index_with`
//! buckets-by-key then Z-set-canonicalizes each bucket; `add` merge-joins the
//! runs and unions shared keys; `neg` negates per group; `sub = add(a, neg(b))`;
//! `join` merge-joins on key then cross-products the value Z-sets with weight
//! MULTIPLY + consolidate. Native [`Ord`] on `K`/`V` IS the comparer: the
//! sort criterion is not an implementation detail, it is the structural
//! identity the four oracles must agree on. Cross-verified byte-for-byte
//! against the shared golden vectors (per `m-acc-multi-oracle`: the compilers
//! don't lie; agreement IS the verification).

use std::cmp::Ordering;

use crate::zset::{ZEntry, ZSet};

/// A key paired with its per-key `ZSet<V>` — one bucket of the indexed run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeyGroup<K, V> {
    /// The group's key (groups are held in ascending-key order, no key twice).
    pub key: K,
    /// The per-key value Z-set (canonical: sorted by value, weight `!= 0`).
    pub values: ZSet<V>,
}

/// `IndexedZSet<K, V>` — an ascending-by-key run of [`KeyGroup`]s; conceptually
/// `Z[K × V]` stored grouped by key. See the module doc for the canonical-form
/// contract. The derived [`PartialEq`] IS the structural-equality check the
/// canonical form makes semantic (two equal indexed Z-sets are byte-identical).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IndexedZSet<K, V> {
    groups: Vec<KeyGroup<K, V>>,
}

impl<K: Ord + Clone, V: Ord + Clone> IndexedZSet<K, V> {
    /// The empty IndexedZSet (the [`IndexedZSet::add`] identity).
    #[must_use]
    pub const fn empty() -> Self {
        IndexedZSet { groups: Vec::new() }
    }

    /// Whether there are no groups.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.groups.is_empty()
    }

    /// The number of DISTINCT keys (groups).
    #[must_use]
    pub fn key_count(&self) -> usize {
        self.groups.len()
    }

    /// The total number of `(key, value)` tuples = the sum of per-group distinct
    /// values (each group's value-Z-set support size).
    #[must_use]
    pub fn tuple_count(&self) -> usize {
        self.groups.iter().map(|g| g.values.distinct_count()).sum()
    }

    /// The canonical run as a slice (no copy) — groups ascending by key.
    #[must_use]
    pub fn as_slice(&self) -> &[KeyGroup<K, V>] {
        &self.groups
    }

    /// Build the canonical form from arbitrary groups: merge duplicate keys
    /// (via [`ZSet::union`]), drop keys whose merged values cancel to empty, and
    /// sort ascending by key. The general-purpose constructor the fixture loader
    /// and [`IndexedZSet::add`] rely on. Comparer-correct by construction: it
    /// groups via a sort + merge-of-adjacent on native [`Ord`] (NOT a hash map),
    /// so the structural identity matches the other oracles exactly.
    pub fn of_groups(groups: impl IntoIterator<Item = KeyGroup<K, V>>) -> Self {
        let mut v: Vec<KeyGroup<K, V>> = groups.into_iter().collect();
        // Stable sort by key, then fold adjacent same-key groups via union.
        v.sort_by(|a, b| a.key.cmp(&b.key));
        let mut out: Vec<KeyGroup<K, V>> = Vec::with_capacity(v.len());
        for g in v {
            match out.last_mut() {
                Some(last) if last.key == g.key => last.values = last.values.union(&g.values),
                _ => out.push(g),
            }
        }
        // Drop groups whose values cancelled to empty (indexed abelian-group inverse).
        out.retain(|g| !g.values.is_empty());
        IndexedZSet { groups: out }
    }

    /// Index a flat [`ZSet<A>`](crate::zset::ZSet) by extracting a key and a
    /// value from each entry — carrying that entry's weight onto the
    /// `(key, value)` tuple. The weight on a tuple is the SUM over all source
    /// entries that map to it (each bucket is canonicalized through the Z-set
    /// constructor: sum + drop-zero). Comparer-correct: buckets via sort +
    /// group-adjacent on native [`Ord`], never a hash map.
    pub fn index_with<A: Ord + Clone>(
        key_of: impl Fn(&A) -> K,
        val_of: impl Fn(&A) -> V,
        z: &ZSet<A>,
    ) -> Self {
        // (key, value-entry) pairs, sorted by key, grouped adjacent, each
        // bucket canonicalized via ZSet::of_entries (sum dups + drop-zero).
        let mut pairs: Vec<(K, ZEntry<V>)> = z
            .as_slice()
            .iter()
            .map(|en| {
                (
                    key_of(&en.e),
                    ZEntry {
                        e: val_of(&en.e),
                        w: en.w,
                    },
                )
            })
            .collect();
        pairs.sort_by(|a, b| a.0.cmp(&b.0));

        let mut out: Vec<KeyGroup<K, V>> = Vec::new();
        let mut idx = 0usize;
        while idx < pairs.len() {
            let key = pairs[idx].0.clone();
            let mut bucket: Vec<ZEntry<V>> = Vec::new();
            while idx < pairs.len() && pairs[idx].0 == key {
                bucket.push(pairs[idx].1.clone());
                idx += 1;
            }
            let values = ZSet::of_entries(bucket);
            if !values.is_empty() {
                out.push(KeyGroup { key, values });
            }
        }
        IndexedZSet { groups: out }
    }

    /// Look up a single key's `ZSet<V>` (empty if the key is absent). Binary
    /// search over the ascending-key run. O(log k).
    #[must_use]
    pub fn get(&self, key: &K) -> ZSet<V> {
        match self.groups.binary_search_by(|g| g.key.cmp(key)) {
            Ok(i) => self.groups[i].values.clone(),
            Err(_) => ZSet::empty(),
        }
    }

    /// Flatten to a `ZSet<C>` of mapped tuples — `combine(key, value)` names the
    /// codomain element (e.g. `` |k, v| format!("{k}|{v}") ``). The flat Z-set's
    /// canonicalization (sum + drop-zero) applies, in case two `(k, v)` tuples
    /// map to the same `C`.
    #[must_use]
    pub fn to_zset<C: Ord + Clone>(&self, combine: impl Fn(&K, &V) -> C) -> ZSet<C> {
        let mut entries: Vec<ZEntry<C>> = Vec::new();
        for g in &self.groups {
            for en in g.values.as_slice() {
                entries.push(ZEntry {
                    e: combine(&g.key, &en.e),
                    w: en.w,
                });
            }
        }
        ZSet::of_entries(entries)
    }

    /// Group-wise addition: merge the two sorted runs; on a shared key,
    /// [`ZSet::union`] the per-key value Z-sets (dropping the group if it cancels
    /// to empty). Linear in the number of groups — the indexed analogue of
    /// `ZSet::union`, and the abelian-group combiner.
    #[must_use]
    pub fn add(&self, other: &Self) -> Self {
        if self.groups.is_empty() {
            return other.clone();
        }
        if other.groups.is_empty() {
            return self.clone();
        }
        let (a, b) = (&self.groups, &other.groups);
        let mut out: Vec<KeyGroup<K, V>> = Vec::with_capacity(a.len() + b.len());
        let (mut i, mut j) = (0usize, 0usize);
        while i < a.len() && j < b.len() {
            match a[i].key.cmp(&b[j].key) {
                Ordering::Less => {
                    out.push(a[i].clone());
                    i += 1;
                }
                Ordering::Greater => {
                    out.push(b[j].clone());
                    j += 1;
                }
                Ordering::Equal => {
                    let merged = a[i].values.union(&b[j].values);
                    if !merged.is_empty() {
                        out.push(KeyGroup {
                            key: a[i].key.clone(),
                            values: merged,
                        });
                    }
                    i += 1;
                    j += 1;
                }
            }
        }
        out.extend_from_slice(&a[i..]);
        out.extend_from_slice(&b[j..]);
        IndexedZSet { groups: out }
    }

    /// Negate every weight (the abelian-group inverse, lifted per group). A
    /// nonzero weight negates to a nonzero weight, so no group can become empty;
    /// the canonical form is preserved.
    #[must_use]
    pub fn neg(&self) -> Self {
        IndexedZSet {
            groups: self
                .groups
                .iter()
                .map(|g| KeyGroup {
                    key: g.key.clone(),
                    values: g.values.negate(),
                })
                .collect(),
        }
    }

    /// `a − b` = `add(a, neg(b))`.
    #[must_use]
    pub fn sub(&self, other: &Self) -> Self {
        self.add(&other.neg())
    }

    /// The bilinear **join** on the shared key: merge-join the two sorted runs,
    /// and for each matching key cross-product the value Z-sets — the output
    /// weight is the PRODUCT of the two value weights (`combine(key, va, vb)`
    /// names the codomain element). The flat `ZSet<C>` result is consolidated
    /// (sum + drop-zero), so a cancellation across the cross-product disappears.
    /// This is the operator the whole DBSP incremental-view story rests on.
    ///
    /// It is *bilinear* (linear in each argument separately), which is exactly
    /// why weights multiply and negatives propagate: a tombstone joined yields a
    /// tombstone, with no special-case delete logic. The output is a flat
    /// `ZSet<C>` (re-grouping into an `IndexedZSet` is a separate `index_with`
    /// step — DBSP keeps `⋈` and re-index orthogonal). The weight product is
    /// overflow-checked (mirrors the F#/C# checked multiply).
    #[must_use]
    pub fn join<VB: Ord + Clone, C: Ord + Clone>(
        &self,
        other: &IndexedZSet<K, VB>,
        combine: impl Fn(&K, &V, &VB) -> C,
    ) -> ZSet<C> {
        if self.groups.is_empty() || other.groups.is_empty() {
            return ZSet::empty();
        }
        let (a, b) = (&self.groups, &other.groups);
        let mut out: Vec<ZEntry<C>> = Vec::new();
        let (mut i, mut j) = (0usize, 0usize);
        while i < a.len() && j < b.len() {
            match a[i].key.cmp(&b[j].key) {
                Ordering::Less => i += 1,  // A-only key: product with 0 ⇒ nothing
                Ordering::Greater => j += 1, // B-only key: product with 0 ⇒ nothing
                Ordering::Equal => {
                    let key = &a[i].key;
                    for va in a[i].values.as_slice() {
                        for vb in b[j].values.as_slice() {
                            // Checked multiply — mirrors ZSet cartesian / F# Checked.(*).
                            let w = va
                                .w
                                .checked_mul(vb.w)
                                .expect("indexed-join weight overflow (i64)");
                            if w != 0 {
                                out.push(ZEntry {
                                    e: combine(key, &va.e, &vb.e),
                                    w,
                                });
                            }
                        }
                    }
                    i += 1;
                    j += 1;
                }
            }
        }
        ZSet::of_entries(out)
    }
}
