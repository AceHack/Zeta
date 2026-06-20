//! Durability primitives (DeltaLog + DeltaCodec + RecoverableSpine) -- Rust
//! parity oracle (#4 of TS/F#/C#/Rust) for input-delta logging and snapshotting.

#![deny(unsafe_code)]
#![warn(missing_docs)]

use std::collections::BTreeMap;
use std::sync::Mutex;
use zeta_core_algebra::zset::{ZEntry, ZSet};
use zeta_core_dynamic_value::DynamicValue;

/// Convert a ZSet to a Tagged (DynamicValue) representation.
pub fn to_dynamic_value<K, E>(key_enc: E, z: &ZSet<K>) -> DynamicValue
where
    K: Ord + Clone,
    E: Fn(&K) -> DynamicValue,
{
    let mut pairs = Vec::with_capacity(z.as_slice().len());
    for entry in z.as_slice() {
        let key_dv = key_enc(&entry.e);
        let weight_dv = DynamicValue::Int(entry.w);
        pairs.push(DynamicValue::Array(vec![key_dv, weight_dv]));
    }
    DynamicValue::Array(pairs)
}

/// Convert a DynamicValue to a ZSet.
pub fn of_dynamic_value<K, D>(key_dec: D, dv: &DynamicValue) -> Result<ZSet<K>, String>
where
    K: Ord + Clone,
    D: Fn(&DynamicValue) -> Result<K, String>,
{
    match dv {
        DynamicValue::Array(pairs) => {
            let mut entries = Vec::with_capacity(pairs.len());
            for pair in pairs {
                match pair {
                    DynamicValue::Array(kv) if kv.len() == 2 => {
                        let key = key_dec(&kv[0])?;
                        let weight = match &kv[1] {
                            DynamicValue::Int(w) => *w,
                            other => return Err(format!("Expected Int weight, got {:?}", other)),
                        };
                        entries.push(ZEntry { e: key, w: weight });
                    }
                    other => {
                        return Err(format!("Expected [key, Int weight] pair, got {:?}", other));
                    }
                }
            }
            Ok(ZSet::of_entries(entries))
        }
        other => Err(format!("Expected Array of pairs, got {:?}", other)),
    }
}

/// Pluggable serialization seam for the durable delta log.
pub trait DeltaCodec<K> {
    /// Encodes a ZSet to bytes.
    fn encode(&self, z: &ZSet<K>) -> Vec<u8>;
    /// Decodes a ZSet from bytes.
    fn decode(&self, bytes: &[u8]) -> Result<ZSet<K>, String>;
}

/// Byte-verified canonical CBOR codec.
pub struct CborDeltaCodec<K, E, D> {
    key_enc: E,
    key_dec: D,
    _marker: std::marker::PhantomData<K>,
}

impl<K, E, D> CborDeltaCodec<K, E, D>
where
    E: Fn(&K) -> DynamicValue,
    D: Fn(&DynamicValue) -> Result<K, String>,
{
    /// Creates a new CborDeltaCodec.
    pub fn new(key_enc: E, key_dec: D) -> Self {
        Self {
            key_enc,
            key_dec,
            _marker: std::marker::PhantomData,
        }
    }
}

impl<K, E, D> DeltaCodec<K> for CborDeltaCodec<K, E, D>
where
    K: Ord + Clone,
    E: Fn(&K) -> DynamicValue,
    D: Fn(&DynamicValue) -> Result<K, String>,
{
    fn encode(&self, z: &ZSet<K>) -> Vec<u8> {
        let dv = to_dynamic_value(&self.key_enc, z);
        dv.to_canonical_cbor()
            .expect("ZSet serialization should never exceed depth limit")
    }

    fn decode(&self, bytes: &[u8]) -> Result<ZSet<K>, String> {
        match DynamicValue::from_canonical_cbor(bytes) {
            Ok(dv) => of_dynamic_value(&self.key_dec, &dv),
            Err(e) => Err(format!(
                "CborDeltaCodec::decode: non-decodable CBOR: {:?}",
                e
            )),
        }
    }
}

/// One entry in the delta log.
#[derive(Debug, Clone)]
pub struct DeltaLogEntry<K> {
    /// Logical sequence number.
    pub seq: i64,
    /// The input delta.
    pub delta: ZSet<K>,
    /// Captured non-determinism.
    pub captured: BTreeMap<String, String>,
}

/// Append-only delta log trait.
pub trait DeltaLog<K> {
    /// Append a committed delta; returns assigned sequence number.
    fn append(&self, delta: ZSet<K>, captured: BTreeMap<String, String>) -> i64;
    /// Replay entries with seq > from_seq_exclusive.
    fn replay(&self, from_seq_exclusive: i64) -> Vec<DeltaLogEntry<K>>;
    /// Highest assigned sequence number.
    fn high_water(&self) -> i64;
    /// Truncate entries <= through_seq_inclusive.
    fn truncate(&self, through_seq_inclusive: i64);
}

/// In-memory delta log.
pub struct InMemoryDeltaLog<K> {
    state: Mutex<InMemoryDeltaLogState<K>>,
}

struct InMemoryDeltaLogState<K> {
    entries: Vec<DeltaLogEntry<K>>,
    next_seq: i64,
}

impl<K> InMemoryDeltaLog<K> {
    /// Creates a new empty InMemoryDeltaLog.
    pub fn new() -> Self {
        Self {
            state: Mutex::new(InMemoryDeltaLogState::<K> {
                entries: Vec::new(),
                next_seq: 0,
            }),
        }
    }
}

impl<K> Default for InMemoryDeltaLog<K> {
    fn default() -> Self {
        Self::new()
    }
}

impl<K: Clone> DeltaLog<K> for InMemoryDeltaLog<K> {
    fn append(&self, delta: ZSet<K>, captured: BTreeMap<String, String>) -> i64 {
        let mut guard = self.state.lock().unwrap();
        guard.next_seq += 1;
        let seq = guard.next_seq;
        guard.entries.push(DeltaLogEntry {
            seq,
            delta,
            captured,
        });
        seq
    }

    fn replay(&self, from_seq_exclusive: i64) -> Vec<DeltaLogEntry<K>> {
        let guard = self.state.lock().unwrap();
        guard
            .entries
            .iter()
            .filter(|e| e.seq > from_seq_exclusive)
            .cloned()
            .collect()
    }

    fn high_water(&self) -> i64 {
        let guard = self.state.lock().unwrap();
        guard.next_seq
    }

    fn truncate(&self, through_seq_inclusive: i64) {
        let mut guard = self.state.lock().unwrap();
        guard.entries.retain(|e| e.seq > through_seq_inclusive);
    }
}

/// A durable pointer to a snapshot.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SnapshotPointer {
    /// Handle of the snapshot.
    pub handle: String,
    /// Log sequence number the snapshot covers.
    pub seq: i64,
}

/// Snapshot store trait.
pub trait SnapshotStore<K> {
    /// Write state at seq; return the pointer.
    fn write(&self, seq: i64, state: ZSet<K>) -> Result<SnapshotPointer, String>;
    /// Read state by pointer.
    fn read(&self, pointer: &SnapshotPointer) -> Result<ZSet<K>, String>;
    /// Latest snapshot pointer.
    fn latest(&self) -> Result<Option<SnapshotPointer>, String>;
}

/// In-memory snapshot store.
pub struct InMemorySnapshotStore<K> {
    state: Mutex<InMemorySnapshotStoreState<K>>,
}

struct InMemorySnapshotStoreState<K> {
    store: BTreeMap<i64, ZSet<K>>,
    latest: Option<SnapshotPointer>,
}

impl<K> InMemorySnapshotStore<K> {
    /// Creates a new empty InMemorySnapshotStore.
    pub fn new() -> Self {
        Self {
            state: Mutex::new(InMemorySnapshotStoreState::<K> {
                store: BTreeMap::new(),
                latest: None,
            }),
        }
    }
}

impl<K> Default for InMemorySnapshotStore<K> {
    fn default() -> Self {
        Self::new()
    }
}

impl<K: Clone> SnapshotStore<K> for InMemorySnapshotStore<K> {
    fn write(&self, seq: i64, state: ZSet<K>) -> Result<SnapshotPointer, String> {
        let mut guard = self.state.lock().unwrap();
        guard.store.insert(seq, state);
        let p = SnapshotPointer {
            handle: seq.to_string(),
            seq,
        };
        guard.latest = Some(p.clone());
        Ok(p)
    }

    fn read(&self, pointer: &SnapshotPointer) -> Result<ZSet<K>, String> {
        let seq = pointer
            .handle
            .parse::<i64>()
            .map_err(|e| format!("Invalid handle: {}", e))?;
        let guard = self.state.lock().unwrap();
        guard
            .store
            .get(&seq)
            .cloned()
            .ok_or_else(|| format!("Snapshot not found for seq {}", seq))
    }

    fn latest(&self) -> Result<Option<SnapshotPointer>, String> {
        let guard = self.state.lock().unwrap();
        Ok(guard.latest.clone())
    }
}

/// RecoverableSpine — ties an input DeltaLog together with snapshots.
pub struct RecoverableSpine<K, L, S> {
    log: L,
    snap: S,
    state: ZSet<K>,
    applied_seq: i64,
    cadence: usize,
    commits_since_snapshot: usize,
    latest_snapshot: Option<SnapshotPointer>,
}

impl<K: Ord + Clone, L: DeltaLog<K>, S: SnapshotStore<K>> RecoverableSpine<K, L, S> {
    /// Creates a new RecoverableSpine.
    pub fn new(log: L, snap: S, initial_state: ZSet<K>, initial_seq: i64) -> Self {
        Self {
            log,
            snap,
            state: initial_state,
            applied_seq: initial_seq,
            cadence: 0,
            commits_since_snapshot: 0,
            latest_snapshot: None,
        }
    }

    /// Returns the current folded state.
    pub fn consolidate(&self) -> &ZSet<K> {
        &self.state
    }

    /// Highest delta-log sequence folded into the current state.
    pub fn applied_seq(&self) -> i64 {
        self.applied_seq
    }

    /// Access the log.
    pub fn log(&self) -> &L {
        &self.log
    }

    /// Access the snapshot store.
    pub fn snapshot_store(&self) -> &S {
        &self.snap
    }

    /// The most recent snapshot pointer taken by this spine in this session.
    pub fn latest_snapshot(&self) -> Option<&SnapshotPointer> {
        self.latest_snapshot.as_ref()
    }

    /// Get auto snapshot cadence.
    pub fn auto_snapshot_every(&self) -> usize {
        self.cadence
    }

    /// Set auto snapshot cadence.
    pub fn set_auto_snapshot_every(&mut self, n: usize) {
        self.cadence = n;
    }

    /// Persist current consolidated state as a snapshot.
    pub fn snapshot(&mut self) -> Result<SnapshotPointer, String> {
        let p = self.snap.write(self.applied_seq, self.state.clone())?;
        self.latest_snapshot = Some(p.clone());
        self.commits_since_snapshot = 0;
        Ok(p)
    }

    /// Commit one input delta.
    pub fn commit(
        &mut self,
        delta: ZSet<K>,
        captured: BTreeMap<String, String>,
    ) -> Result<i64, String> {
        let seq = self.log.append(delta.clone(), captured);
        self.state = self.state.union(&delta);
        self.applied_seq = seq;
        self.commits_since_snapshot += 1;

        if self.cadence > 0 && self.commits_since_snapshot >= self.cadence {
            let p = self.snapshot()?;
            self.log.truncate(p.seq);
        }
        Ok(seq)
    }

    /// Fold a replayed delta into the state during recovery.
    pub fn apply_replayed(&mut self, delta: ZSet<K>, seq: i64) {
        self.state = self.state.union(&delta);
        self.applied_seq = seq;
    }

    /// Recover a spine from durable state.
    pub fn recover(log: L, snap: S, pointer: Option<SnapshotPointer>) -> Result<Self, String> {
        let resolved = match pointer {
            Some(p) => Some(p),
            None => snap.latest()?,
        };
        let (base_state, base_seq) = match resolved {
            Some(p) => {
                let s = snap.read(&p)?;
                (s, p.seq)
            }
            None => (ZSet::empty(), 0),
        };
        let mut spine = Self::new(log, snap, base_state, base_seq);
        let tail = spine.log.replay(base_seq);
        for e in tail {
            spine.apply_replayed(e.delta, e.seq);
        }
        Ok(spine)
    }
}

impl<K, L: DeltaLog<K>> DeltaLog<K> for &L {
    fn append(&self, delta: ZSet<K>, captured: BTreeMap<String, String>) -> i64 {
        (*self).append(delta, captured)
    }
    fn replay(&self, from_seq_exclusive: i64) -> Vec<DeltaLogEntry<K>> {
        (*self).replay(from_seq_exclusive)
    }
    fn high_water(&self) -> i64 {
        (*self).high_water()
    }
    fn truncate(&self, through_seq_inclusive: i64) {
        (*self).truncate(through_seq_inclusive)
    }
}

impl<K, S: SnapshotStore<K>> SnapshotStore<K> for &S {
    fn write(&self, seq: i64, state: ZSet<K>) -> Result<SnapshotPointer, String> {
        (*self).write(seq, state)
    }
    fn read(&self, pointer: &SnapshotPointer) -> Result<ZSet<K>, String> {
        (*self).read(pointer)
    }
    fn latest(&self) -> Result<Option<SnapshotPointer>, String> {
        (*self).latest()
    }
}
