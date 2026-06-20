use crate::{DynamicValue, EncodeError};
use std::cmp::Ordering;
use std::hash::{Hash, Hasher};

/// Content-addressed, COMPARABLE key for a `DynamicValue` row.
#[derive(Debug, Clone)]
pub struct DvKey {
    value: DynamicValue,
    canonical: Vec<u8>,
}

impl DvKey {
    /// Wrap a `DynamicValue` as a comparable, content-addressed row key.
    pub fn of_value(value: DynamicValue) -> Result<Self, EncodeError> {
        let canonical = value.to_canonical_cbor()?;
        Ok(Self { value, canonical })
    }

    /// The underlying value.
    pub fn value(&self) -> &DynamicValue {
        &self.value
    }

    /// The canonical CBOR bytes.
    pub fn canonical(&self) -> &[u8] {
        &self.canonical
    }
}

impl PartialEq for DvKey {
    fn eq(&self, other: &Self) -> bool {
        self.canonical == other.canonical
    }
}

impl Eq for DvKey {}

impl PartialOrd for DvKey {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for DvKey {
    fn cmp(&self, other: &Self) -> Ordering {
        self.canonical.cmp(&other.canonical)
    }
}

impl Hash for DvKey {
    fn hash<H: Hasher>(&self, state: &mut H) {
        // 32-bit FNV-1a over canonical bytes.
        let mut h: u32 = 2166136261;
        for &b in &self.canonical {
            h = (h ^ (b as u32)).wrapping_mul(16777619);
        }
        state.write_u32(h);
    }
}
