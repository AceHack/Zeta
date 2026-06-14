#![allow(missing_docs)]

use std::sync::Arc;
use zeta_core_mixin::WeakMap;

#[test]
fn test_basic_operations() {
    let map = WeakMap::new();
    let key1 = Arc::new("key1".to_string());
    let key2 = Arc::new("key2".to_string());

    // Initially empty
    assert_eq!(map.get(&key1), None);
    assert_eq!(map.len_raw(), 0);

    // Set values
    map.set(&key1, 100);
    map.set(&key2, 200);

    // Get values
    assert_eq!(map.get(&key1), Some(100));
    assert_eq!(map.get(&key2), Some(200));
    assert_eq!(map.len_raw(), 2);

    // Update value
    map.set(&key1, 150);
    assert_eq!(map.get(&key1), Some(150));

    // Delete value
    assert!(map.delete(&key1));
    assert_eq!(map.get(&key1), None);
    assert!(!map.delete(&key1));
    assert_eq!(map.len_raw(), 1);
}

#[test]
fn test_get_with() {
    // Non-cloneable value type to prove get_with works without Clone
    #[derive(Debug, PartialEq, Eq)]
    struct NonClone(i32);

    let map = WeakMap::new();
    let key = Arc::new("key".to_string());

    map.set(&key, NonClone(42));

    // Retrieve via closure
    let value_inner = map.get_with(&key, |v| v.0);
    assert_eq!(value_inner, Some(42));
}

#[test]
fn test_remove() {
    let map = WeakMap::new();
    let key = Arc::new("key".to_string());

    map.set(&key, 42);
    assert_eq!(map.len_raw(), 1);

    // Remove returns the value
    assert_eq!(map.remove(&key), Some(42));
    assert_eq!(map.get(&key), None);
    assert_eq!(map.len_raw(), 0);
}

#[test]
fn test_weak_garbage_collection_and_pruning() {
    let map = WeakMap::new();

    // Scope for keys to trigger drop
    {
        let key1 = Arc::new("temp_key1".to_string());
        let key2 = Arc::new("temp_key2".to_string());

        map.set(&key1, 1000);
        map.set(&key2, 2000);

        assert_eq!(map.get(&key1), Some(1000));
        assert_eq!(map.get(&key2), Some(2000));
        assert_eq!(map.len_raw(), 2);

        // key1 and key2 go out of scope here and get dropped.
        // Since we hold only weak references in the map, they are dropped.
    }

    // Now verify upgrade fails (returns None)
    // We can't query with the keys because they are gone, but we can verify that the raw map has dead keys.
    // And prune should remove them.
    assert_eq!(map.len_raw(), 2);

    // Call prune to clean up
    map.prune();
    assert_eq!(map.len_raw(), 0);
}
