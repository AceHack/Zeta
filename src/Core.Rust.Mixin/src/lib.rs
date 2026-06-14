//! Weak-keyed side-tables (mixin) for Rust.
//! Analogous to JavaScript's `WeakMap` or .NET's `ConditionalWeakTable`.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

use std::collections::HashMap;
use std::sync::{Arc, Mutex, Weak};

/// A thread-safe weak-keyed map mapping `Arc<K>` to `V`.
///
/// Keys are held weakly. When the last strong reference (`Arc<K>`) is dropped,
/// the entry becomes eligible for garbage collection (pruning).
pub struct WeakMap<K, V> {
    map: Mutex<HashMap<usize, (Weak<K>, V)>>,
}

impl<K, V> Default for WeakMap<K, V> {
    fn default() -> Self {
        Self::new()
    }
}

impl<K, V> WeakMap<K, V> {
    /// Creates a new, empty `WeakMap`.
    pub fn new() -> Self {
        Self {
            map: Mutex::new(HashMap::new()),
        }
    }

    /// Associates the given value with the key.
    /// If an entry already exists for this key, it is overwritten.
    pub fn set(&self, key: &Arc<K>, value: V) {
        let addr = Arc::as_ptr(key) as usize;
        let weak_key = Arc::downgrade(key);
        let mut map = self.map.lock().unwrap();
        map.insert(addr, (weak_key, value));
    }

    /// Gets a clone of the value associated with the key, if it exists and is alive.
    pub fn get(&self, key: &Arc<K>) -> Option<V>
    where
        V: Clone,
    {
        let addr = Arc::as_ptr(key) as usize;
        let map = self.map.lock().unwrap();
        if let Some((weak_key, value)) = map.get(&addr) {
            let is_match = weak_key
                .upgrade()
                .map(|strong| Arc::ptr_eq(&strong, key))
                .unwrap_or(false);
            if is_match {
                return Some(value.clone());
            }
        }
        None
    }

    /// Invokes a closure with a reference to the value associated with the key, if it exists and is alive.
    pub fn get_with<F, R>(&self, key: &Arc<K>, f: F) -> Option<R>
    where
        F: FnOnce(&V) -> R,
    {
        let addr = Arc::as_ptr(key) as usize;
        let map = self.map.lock().unwrap();
        if let Some((weak_key, value)) = map.get(&addr) {
            let is_match = weak_key
                .upgrade()
                .map(|strong| Arc::ptr_eq(&strong, key))
                .unwrap_or(false);
            if is_match {
                return Some(f(value));
            }
        }
        None
    }

    /// Removes the value associated with the key. Returns `true` if a value was present.
    pub fn delete(&self, key: &Arc<K>) -> bool {
        let addr = Arc::as_ptr(key) as usize;
        let mut map = self.map.lock().unwrap();
        if let Some((weak_key, _)) = map.remove(&addr) {
            let is_match = weak_key
                .upgrade()
                .map(|strong| Arc::ptr_eq(&strong, key))
                .unwrap_or(false);
            if is_match {
                return true;
            }
        }
        false
    }

    /// Removes the value associated with the key and returns it, if it exists and is alive.
    pub fn remove(&self, key: &Arc<K>) -> Option<V> {
        let addr = Arc::as_ptr(key) as usize;
        let mut map = self.map.lock().unwrap();
        if let Some((weak_key, value)) = map.remove(&addr) {
            let is_match = weak_key
                .upgrade()
                .map(|strong| Arc::ptr_eq(&strong, key))
                .unwrap_or(false);
            if is_match {
                return Some(value);
            }
        }
        None
    }

    /// Returns the number of entries currently stored in the map, including dead ones.
    pub fn len_raw(&self) -> usize {
        self.map.lock().unwrap().len()
    }

    /// Sweeps the map, removing entries whose keys have been garbage collected (dropped).
    pub fn prune(&self) {
        let mut map = self.map.lock().unwrap();
        map.retain(|_, (weak_key, _)| weak_key.upgrade().is_some());
    }
}
