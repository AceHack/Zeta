//! Schema evolution over DynamicValue — Rust oracle implementing total migration algebra and stashing.

use crate::DynamicValue;

/// Reserved key for stashed values in the garbage dump.
pub const DUMP_KEY: &str = "__evo_dump__";

/// Adjacent-version migration record.
pub struct Migration {
    /// Initial version of schema.
    pub from: i32,
    /// Destination version of schema.
    pub to: i32,
    /// Migration function.
    pub up: Box<dyn Fn(DynamicValue) -> DynamicValue>,
    /// Rollback function.
    pub down: Option<Box<dyn Fn(DynamicValue) -> DynamicValue>>,
}

/// Ensure key is present, supplying def when absent. Idempotent; preserves existing value + order.
#[must_use]
pub fn add_field(key: &str, def: DynamicValue, v: DynamicValue) -> DynamicValue {
    match v {
        DynamicValue::Object(mut pairs) => {
            if pairs.iter().any(|(k, _)| k == key) {
                DynamicValue::Object(pairs)
            } else {
                pairs.push((key.to_string(), def));
                DynamicValue::Object(pairs)
            }
        }
        other => other,
    }
}

/// Drop key if present. Preserves order of the rest.
#[must_use]
pub fn remove_field(key: &str, v: DynamicValue) -> DynamicValue {
    match v {
        DynamicValue::Object(pairs) => {
            let new_pairs = pairs.into_iter().filter(|(k, _)| k != key).collect();
            DynamicValue::Object(new_pairs)
        }
        other => other,
    }
}

/// Rename oldKey to newKey in place; preserves value + order.
#[must_use]
pub fn rename_field(old_key: &str, new_key: &str, v: DynamicValue) -> DynamicValue {
    match v {
        DynamicValue::Object(pairs) => {
            let new_pairs = pairs
                .into_iter()
                .map(|(k, val)| {
                    if k == old_key {
                        (new_key.to_string(), val)
                    } else {
                        (k, val)
                    }
                })
                .collect();
            DynamicValue::Object(new_pairs)
        }
        other => other,
    }
}

/// Project to only the keys an old reader knows (drops everything else).
#[must_use]
pub fn project(known_keys: &std::collections::HashSet<String>, v: DynamicValue) -> DynamicValue {
    match v {
        DynamicValue::Object(pairs) => {
            let new_pairs = pairs
                .into_iter()
                .filter(|(k, _)| known_keys.contains(k))
                .collect();
            DynamicValue::Object(new_pairs)
        }
        other => other,
    }
}

/// addField is lossless-invertible: the inverse is removeField key.
#[must_use]
pub fn add_field_migration(from_v: i32, key: String, def: DynamicValue) -> Migration {
    let key_c1 = key.clone();
    let key_c2 = key;
    Migration {
        from: from_v,
        to: from_v + 1,
        up: Box::new(move |v| add_field(&key_c1, def.clone(), v)),
        down: Some(Box::new(move |v| remove_field(&key_c2, v))),
    }
}

/// renameField is lossless-invertible: the inverse is renameField newKey oldKey.
#[must_use]
pub fn rename_field_migration(from_v: i32, old_key: String, new_key: String) -> Migration {
    let old_key_c1 = old_key.clone();
    let old_key_c2 = old_key;
    let new_key_c1 = new_key.clone();
    let new_key_c2 = new_key;
    Migration {
        from: from_v,
        to: from_v + 1,
        up: Box::new(move |v| rename_field(&old_key_c1, &new_key_c1, v)),
        down: Some(Box::new(move |v| rename_field(&new_key_c2, &old_key_c2, v))),
    }
}

/// removeField is lossy: the down-migration restores only downDefault.
#[must_use]
pub fn remove_field_migration(from_v: i32, key: String, down_default: DynamicValue) -> Migration {
    let key_c1 = key.clone();
    let key_c2 = key;
    Migration {
        from: from_v,
        to: from_v + 1,
        up: Box::new(move |v| remove_field(&key_c1, v)),
        down: Some(Box::new(move |v| {
            add_field(&key_c2, down_default.clone(), v)
        })),
    }
}

fn dump_entry(idx: usize, value: DynamicValue) -> DynamicValue {
    DynamicValue::Object(vec![
        ("idx".to_string(), DynamicValue::Int(idx as i64)),
        ("val".to_string(), value),
    ])
}

type Pair = (String, DynamicValue);
type Pairs = Vec<Pair>;

fn split_dump(pairs: Pairs) -> (Pairs, Pairs) {
    let mut non_dump = Vec::new();
    let mut dump = Vec::new();
    for (k, v) in pairs {
        if k == DUMP_KEY {
            if let DynamicValue::Object(d) = v {
                dump = d;
            }
        } else {
            non_dump.push((k, v));
        }
    }
    (non_dump, dump)
}

fn split_dump_ref(pairs: &[Pair]) -> (Vec<&Pair>, Option<&Pairs>) {
    let mut non_dump = Vec::new();
    let mut dump = None;
    for pair in pairs {
        if pair.0 == DUMP_KEY {
            if let DynamicValue::Object(d) = &pair.1 {
                dump = Some(d);
            }
        } else {
            non_dump.push(pair);
        }
    }
    (non_dump, dump)
}

/// Move key's value INTO the dump (lossless stash).
#[must_use]
pub fn stash_to_dump(key: &str, v: DynamicValue) -> DynamicValue {
    match v {
        DynamicValue::Object(pairs) => {
            let idx = pairs.iter().position(|(k, _)| k == key);
            match idx {
                None => DynamicValue::Object(pairs),
                Some(_) => {
                    let (mut non_dump, dump) = split_dump(pairs);
                    let idx = non_dump.iter().position(|(k, _)| k == key).unwrap();
                    let (_, removed) = non_dump.remove(idx);
                    let mut new_dump: Vec<_> = dump.into_iter().filter(|(k, _)| k != key).collect();
                    new_dump.push((key.to_string(), dump_entry(idx, removed)));
                    non_dump.push((DUMP_KEY.to_string(), DynamicValue::Object(new_dump)));
                    DynamicValue::Object(non_dump)
                }
            }
        }
        other => other,
    }
}

/// Restore key FROM the dump (position-exact).
#[must_use]
pub fn restore_from_dump(key: &str, v: DynamicValue) -> DynamicValue {
    match v {
        DynamicValue::Object(pairs) => {
            let has_key_in_dump = {
                let (_, dump) = split_dump_ref(&pairs);
                dump.is_some_and(|d| d.iter().any(|(k, _)| k == key))
            };
            if !has_key_in_dump {
                DynamicValue::Object(pairs)
            } else {
                let (mut non_dump, dump) = split_dump(pairs);
                let mut key_entry = None;
                let mut remaining_dump = Vec::new();
                for (k, val) in dump {
                    if k == key {
                        key_entry = Some(val);
                    } else {
                        remaining_dump.push((k, val));
                    }
                }

                if let Some(DynamicValue::Object(entry_pairs)) = key_entry {
                    let idx_val = entry_pairs
                        .iter()
                        .find(|(k, _)| k == "idx")
                        .map(|(_, val)| val);
                    let idx = match idx_val {
                        Some(DynamicValue::Int(i)) => *i as usize,
                        _ => non_dump.len(),
                    };
                    let value = entry_pairs
                        .into_iter()
                        .find(|(k, _)| k == "val")
                        .map(|(_, val)| val)
                        .unwrap_or(DynamicValue::Null);

                    let clamped = std::cmp::max(0, std::cmp::min(idx, non_dump.len()));
                    non_dump.insert(clamped, (key.to_string(), value));

                    if !remaining_dump.is_empty() {
                        non_dump.push((DUMP_KEY.to_string(), DynamicValue::Object(remaining_dump)));
                    }
                    DynamicValue::Object(non_dump)
                } else {
                    let mut non_dump_recon = non_dump;
                    if !remaining_dump.is_empty() {
                        non_dump_recon
                            .push((DUMP_KEY.to_string(), DynamicValue::Object(remaining_dump)));
                    }
                    DynamicValue::Object(non_dump_recon)
                }
            }
        }
        other => other,
    }
}

/// Drop the whole dump.
#[must_use]
pub fn drop_dump(v: DynamicValue) -> DynamicValue {
    remove_field(DUMP_KEY, v)
}

/// removeField made windowed-lossless.
#[must_use]
pub fn remove_field_with_dump_migration(from_v: i32, key: String) -> Migration {
    let key_c1 = key.clone();
    let key_c2 = key;
    Migration {
        from: from_v,
        to: from_v + 1,
        up: Box::new(move |v| stash_to_dump(&key_c1, v)),
        down: Some(Box::new(move |v| restore_from_dump(&key_c2, v))),
    }
}

/// Migrate forward.
pub fn migrate(
    migrations: &[Migration],
    from_v: i32,
    to_v: i32,
    value: DynamicValue,
) -> Result<DynamicValue, String> {
    if to_v < from_v {
        return Err(format!(
            "downgrade {} -> {} not supported by migrate; use migrateDown",
            from_v, to_v
        ));
    }
    let mut cur = from_v;
    let mut v = value;
    while cur < to_v {
        let m = migrations
            .iter()
            .find(|mig| mig.from == cur && mig.to == cur + 1);
        match m {
            None => {
                return Err(format!(
                    "no migration registered from version {} to {}",
                    cur,
                    cur + 1
                ));
            }
            Some(mig) => {
                v = (mig.up)(v);
                cur += 1;
            }
        }
    }
    Ok(v)
}

/// Migrate backward.
pub fn migrate_down(
    migrations: &[Migration],
    from_v: i32,
    to_v: i32,
    value: DynamicValue,
) -> Result<DynamicValue, String> {
    if to_v > from_v {
        return Err(format!(
            "migrate_down requires to_v <= from_v, got {} -> {}",
            from_v, to_v
        ));
    }
    let mut cur = from_v;
    let mut v = value;
    while cur > to_v {
        let m = migrations
            .iter()
            .find(|mig| mig.to == cur && mig.from == cur - 1);
        match m {
            None => {
                return Err(format!(
                    "no migration registered from version {} to {}",
                    cur - 1,
                    cur
                ));
            }
            Some(mig) => match &mig.down {
                None => {
                    return Err(format!(
                        "migration {} -> {} is non-invertible (rollback needs compensation, not an inverse)",
                        mig.from, mig.to
                    ));
                }
                Some(down) => {
                    v = (down)(v);
                    cur -= 1;
                }
            },
        }
    }
    Ok(v)
}
