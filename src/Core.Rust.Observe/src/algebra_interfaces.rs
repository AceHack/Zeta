//! src/Core.Rust.Observe/src/algebra_interfaces.rs — the full algebraic interface stack.
//! GCF principle: richest shared structure + Rust-specific extras (trait bounds, lifetimes).
#![allow(missing_docs)]

/// Group: identity + combine + inverse. Minimal structure for undo/retract.
pub trait Group {
    type Element;

    fn identity(&self) -> Self::Element;
    fn combine(&self, a: Self::Element, b: Self::Element) -> Self::Element;
    fn inverse(&self, a: Self::Element) -> Self::Element;
}

/// Monoid: identity + combine. No inverse. The CRDT merge floor.
pub trait Monoid {
    type Element;

    fn identity(&self) -> Self::Element;
    fn combine(&self, a: Self::Element, b: Self::Element) -> Self::Element;
}

/// Join-semilattice: idempotent, commutative, associative join.
pub trait JoinSemilattice {
    type Element;

    fn join(&self, a: Self::Element, b: Self::Element) -> Self::Element;
}

/// Full lattice: join (LUB) + meet (GLB).
pub trait Lattice: JoinSemilattice {
    fn meet(&self, a: Self::Element, b: Self::Element) -> Self::Element;
}

/// Codec: encode/decode pair. The serialization contract.
pub trait Codec {
    type Domain;
    type Wire;

    fn encode(&self, a: &Self::Domain) -> Self::Wire;
    fn decode(&self, b: &Self::Wire) -> Self::Domain;
}

/// Port: hexagonal boundary (read + write).
pub trait Port {
    type Value;

    fn read(&self) -> Self::Value;
    fn write(&mut self, value: Self::Value);
}

/// Read-only port (covariant — can widen output).
pub trait ReadPort {
    type Value;
    fn read(&self) -> Self::Value;
}

/// Write-only port (contravariant — can narrow input).
pub trait WritePort {
    type Value;
    fn write(&mut self, value: Self::Value);
}

// ─── Instances ───────────────────────────────────────────────────────────

/// Additive group over i64.
pub struct AdditiveGroupI64;

impl Group for AdditiveGroupI64 {
    type Element = i64;

    fn identity(&self) -> i64 {
        0
    }
    fn combine(&self, a: i64, b: i64) -> i64 {
        a.wrapping_add(b)
    }
    fn inverse(&self, a: i64) -> i64 {
        a.wrapping_neg()
    }
}

/// Max join-semilattice over i64.
pub struct MaxLatticeI64;

impl JoinSemilattice for MaxLatticeI64 {
    type Element = i64;

    fn join(&self, a: i64, b: i64) -> i64 {
        a.max(b)
    }
}

/// JSON codec (String ↔ serde_json::Value — conceptual, no serde dep here).
pub struct JsonStringCodec;

impl Codec for JsonStringCodec {
    type Domain = String;
    type Wire = Vec<u8>;

    fn encode(&self, a: &String) -> Vec<u8> {
        a.as_bytes().to_vec()
    }
    fn decode(&self, b: &Vec<u8>) -> String {
        String::from_utf8_lossy(b).into_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn additive_group_laws() {
        let g = AdditiveGroupI64;
        assert_eq!(g.combine(5, g.identity()), 5);
        assert_eq!(g.combine(g.identity(), 5), 5);
        assert_eq!(g.combine(7, g.inverse(7)), g.identity());
        // Associativity
        assert_eq!(g.combine(g.combine(1, 2), 3), g.combine(1, g.combine(2, 3)));
    }

    #[test]
    fn max_lattice_laws() {
        let l = MaxLatticeI64;
        assert_eq!(l.join(3, 7), 7);
        assert_eq!(l.join(7, 3), 7);
        // Idempotent
        assert_eq!(l.join(5, 5), 5);
        // Associative
        assert_eq!(l.join(l.join(1, 5), 3), l.join(1, l.join(5, 3)));
    }

    #[test]
    fn json_codec_roundtrip() {
        let c = JsonStringCodec;
        let original = "hello world".to_string();
        assert_eq!(c.decode(&c.encode(&original)), original);
    }
}
