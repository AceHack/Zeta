//! Tri-boolean floating point -- biased-exponent decoder (B-0944 slice 5 pt2, Rust parity oracle #4).
//!
//! Mirrors the TS distribution surface (src/Core.TypeScript/tri-boolean-float) and the F#/C# ports
//! with the RATIFIED biased-exponent decoder. The middle field decodes the ends (middle-out,
//! self-describing):
//!
//! ```text
//! decoded value = V * 2 ^ (mode - bias),   bias = 2 ^ (decoderWidth - 1)
//! ```
//!
//! where `V` = MSB-first base-2 read of (high ++ low) and `mode` = MSB-first base-2 read of the
//! middle decoder field (`Tri::True` = 1, `Tri::False` = 0). Every field is a `Vec<Tri>` -- the
//! float is a composite of digital-qubit cells, so any trit may be held (`Tri::N`): `Tri::N` in a
//! value trit => the value is superposed; `Tri::N` in a decoder trit => the decode instruction is
//! superposed. `measure` is the only collapsing op; it surfaces which superposition is held as
//! `Err(FloatFeedback)` (Rust-native `Result`) rather than collapsing silently.
//!
//! rustc is oracle #4: a non-exhaustive `match` over `Tri` is a hard compile error, so the decode's
//! held-state handling is exhaustive by construction -- the strongest of the four oracles.

use crate::Tri;

/// Field widths of a tri-boolean float (trits per field), MSB-first within each field. Parity with
/// the TS `FloatShape`, F# `Float.FloatShape`, and C# `FloatShape`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FloatShape {
    /// High (more-significant) value trits.
    pub high_width: usize,
    /// Middle decoder trits (the biased-exponent mode; read first).
    pub decoder_width: usize,
    /// Low (less-significant) value trits.
    pub low_width: usize,
}

impl FloatShape {
    /// Reference v0 shape: 4/3/4 -- 8 value trits, mode in `[0,8)`, bias = 4. Parity with C#
    /// `FloatShape.Default` / F# `defaultShape` / TS `DEFAULT_SHAPE`.
    pub const DEFAULT: Self = Self {
        high_width: 4,
        decoder_width: 3,
        low_width: 4,
    };
}

/// A tri-boolean float: a composite of digital-qubit cells. Each field is MSB-first; because every
/// position is a `Tri`, any trit may be held (`Tri::N`). Parity with the TS/F#/C# `TriFloat`.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TriFloat {
    /// The field widths.
    pub shape: FloatShape,
    /// High value trits (MSB-first).
    pub high: Vec<Tri>,
    /// Middle decoder trits (the biased-exponent mode, MSB-first).
    pub decoder: Vec<Tri>,
    /// Low value trits (MSB-first).
    pub low: Vec<Tri>,
}

/// Which superposition is held when [`measure`] cannot collapse a float to a single number. The two
/// held-states are distinct. Parity with the F# `Float.FloatFeedback` DU / TS `FloatFeedback` union.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FloatFeedback {
    /// `Tri::N` in the decoder field -- the decode instruction itself is superposed.
    InterpretationSuperposed,
    /// `Tri::N` in a value trit while the decoder is certain -- the value is superposed.
    ValueSuperposed,
}

/// MSB-first base-2 read of a trit field (`Tri::True` = 1, `Tri::False` = 0). `None` iff ANY trit is
/// held (`Tri::N`) -- the held signal. Exhaustive `match` (no fourth state; Rust has no null).
fn int_of<'a>(trits: impl Iterator<Item = &'a Tri>) -> Option<u64> {
    let mut v: u64 = 0;
    for t in trits {
        match t {
            Tri::N => return None,
            Tri::True => v = v * 2 + 1,
            Tri::False => v *= 2,
        }
    }
    Some(v)
}

/// MSB-first encode of a non-negative integer into `width` certain trits.
fn int_to_trits(v: u64, width: usize) -> Vec<Tri> {
    (0..width)
        .map(|i| {
            let shift = (width - 1 - i) as u32;
            if ((v >> shift) & 1) == 1 {
                Tri::True
            } else {
                Tri::False
            }
        })
        .collect()
}

/// decode (middle-out, biased-exponent): read the MIDDLE decoder first, then decode OUTWARD.
/// `Tri::N` in the decoder => [`FloatFeedback::InterpretationSuperposed`]; `Tri::N` in a value trit
/// => [`FloatFeedback::ValueSuperposed`] (decoder read first, so interpretation dominates when both
/// are held); else `Ok(V * 2 ^ (mode - bias))`, bias = `2 ^ (decoderWidth - 1)`.
///
/// # Errors
/// Returns [`FloatFeedback::InterpretationSuperposed`] or [`FloatFeedback::ValueSuperposed`] when a
/// decoder or value trit (respectively) is held.
pub fn decode(f: &TriFloat) -> Result<f64, FloatFeedback> {
    let mode = match int_of(f.decoder.iter()) {
        None => return Err(FloatFeedback::InterpretationSuperposed),
        Some(m) => m,
    };
    let v = match int_of(f.high.iter().chain(f.low.iter())) {
        None => return Err(FloatFeedback::ValueSuperposed),
        Some(v) => v,
    };
    let bias = 1i32 << (f.decoder.len() as u32 - 1);
    let exp = mode as i32 - bias;
    Ok(v as f64 * 2f64.powi(exp))
}

/// measure: the only collapsing op (identical to [`decode`]; named for parity with the cell's
/// `measure`/`cooperate` pair).
///
/// # Errors
/// Same as [`decode`].
pub fn measure(f: &TriFloat) -> Result<f64, FloatFeedback> {
    decode(f)
}

/// cooperate: engage WITHOUT collapsing -- identity, preserving every held (`Tri::N`) trit. Takes
/// the float by value and returns it unchanged (the move-through identity; no clone, nothing lost).
#[must_use]
pub fn cooperate(f: TriFloat) -> TriFloat {
    f
}

/// True iff the float cannot collapse to a single number (any value or decoder trit is held).
#[must_use]
pub fn is_held(f: &TriFloat) -> bool {
    decode(f).is_err()
}

/// Construct a float directly from trit fields (tests / advanced use); the shape is inferred from
/// the field lengths.
#[must_use]
pub fn from_trits(high: Vec<Tri>, decoder: Vec<Tri>, low: Vec<Tri>) -> TriFloat {
    let shape = FloatShape {
        high_width: high.len(),
        decoder_width: decoder.len(),
        low_width: low.len(),
    };
    TriFloat {
        shape,
        high,
        decoder,
        low,
    }
}

/// fromValue (biased-exponent canonical encode): find a `(mode, V)` with `V * 2 ^ (mode - bias) =
/// value`, `V` a non-negative integer fitting the value field and `mode` in the decoder field. Picks
/// the SMALLEST mode that works (a canonical representation; the biased-exponent decoder has
/// redundant representations). v0 is unsigned + finite. Round-trips with [`decode`].
///
/// # Errors
/// Returns a reason string when `value` is negative / non-finite, or when no `(mode, V)` represents
/// it in the given shape.
pub fn from_value(value: f64, shape: FloatShape) -> Result<TriFloat, String> {
    if value.is_nan() || value.is_infinite() || value < 0.0 {
        return Err("v0 is unsigned + finite".to_string());
    }
    let value_bits = shape.high_width + shape.low_width;
    let max_mode = (1u64 << shape.decoder_width) - 1;
    let max_v = 1u64 << value_bits;
    let bias = 1i32 << (shape.decoder_width as u32 - 1);
    for mode in 0..=max_mode {
        let exp = mode as i32 - bias;
        let scaled = value / 2f64.powi(exp); // = V
        if scaled.fract() == 0.0 && scaled >= 0.0 && scaled < max_v as f64 {
            let v = scaled as u64;
            let bits = int_to_trits(v, value_bits);
            return Ok(TriFloat {
                shape,
                high: bits[..shape.high_width].to_vec(),
                decoder: int_to_trits(mode, shape.decoder_width),
                low: bits[shape.high_width..].to_vec(),
            });
        }
    }
    Err(format!(
        "no (mode,V) with mode<={max_mode} and V<{max_v} represents {value}"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Tri::{False as F, N, True as T};

    // Rust parity oracle (#4 of four) for the biased-exponent tri-boolean float (B-0944 slice 5
    // pt2). Vectors mirror tests/Tests.FSharp/TriBoolean/Float.Tests.fs +
    // tests/Tests.CSharp/TriBoolean/FloatTests.cs so four-of-four parity IS the summonable-BFT
    // ballot. Shape 4/3/4: decoderWidth 3 -> bias 4; valueBits 8 -> V in [0,256).

    fn mk(high: Vec<Tri>, decoder: Vec<Tri>, low: Vec<Tri>) -> TriFloat {
        from_trits(high, decoder, low)
    }

    fn zero4() -> Vec<Tri> {
        vec![F, F, F, F]
    }

    #[test]
    fn decode_mode_equals_bias_value_is_v() {
        // decoder 100 = mode 4 = bias -> exp 0; low 0101 -> V = 5 -> 5.0
        let f = mk(zero4(), vec![T, F, F], vec![F, T, F, T]);
        assert_eq!(Ok(5.0), decode(&f));
    }

    #[test]
    fn decode_mode_greater_than_bias_times_two() {
        // decoder 101 = mode 5 -> exp +1; low 0011 -> V = 3 -> 6.0
        let f = mk(zero4(), vec![T, F, T], vec![F, F, T, T]);
        assert_eq!(Ok(6.0), decode(&f));
    }

    #[test]
    fn decode_mode_less_than_bias_half() {
        // decoder 011 = mode 3 -> exp -1; low 1000 -> V = 8 -> 4.0
        let f = mk(zero4(), vec![F, T, T], vec![T, F, F, F]);
        assert_eq!(Ok(4.0), decode(&f));
    }

    #[test]
    fn decode_mode_less_than_bias_quarter() {
        // decoder 010 = mode 2 -> exp -2; low 0100 -> V = 4 -> 1.0
        let f = mk(zero4(), vec![F, T, F], vec![F, T, F, F]);
        assert_eq!(Ok(1.0), decode(&f));
    }

    #[test]
    fn decode_reads_high_then_low_as_one_v() {
        // high 0001, low 0000 -> V = 0b00010000 = 16; decoder 100 = mode 4 -> exp 0 -> 16.0
        let f = mk(vec![F, F, F, T], vec![T, F, F], zero4());
        assert_eq!(Ok(16.0), decode(&f));
    }

    #[test]
    fn n_in_decoder_is_interpretation_superposed() {
        let f = mk(zero4(), vec![T, N, F], vec![F, T, F, T]);
        assert_eq!(Err(FloatFeedback::InterpretationSuperposed), decode(&f));
    }

    #[test]
    fn n_in_value_decoder_certain_is_value_superposed() {
        let f = mk(vec![F, F, F, N], vec![T, F, F], zero4());
        assert_eq!(Err(FloatFeedback::ValueSuperposed), decode(&f));
    }

    #[test]
    fn decoder_read_first_both_held_is_interpretation_superposed() {
        // N in BOTH decoder and value -> InterpretationSuperposed dominates (decoder checked first).
        let f = mk(vec![N, F, F, F], vec![N, F, F], zero4());
        assert_eq!(Err(FloatFeedback::InterpretationSuperposed), decode(&f));
    }

    #[test]
    fn measure_equals_decode() {
        let f = mk(zero4(), vec![T, F, F], vec![F, T, F, T]);
        assert_eq!(decode(&f), measure(&f));
    }

    #[test]
    fn cooperate_is_identity_and_preserves_held_trits() {
        let held = mk(vec![F, F, F, N], vec![N, F, F], zero4());
        assert_eq!(held.clone(), cooperate(held));
    }

    #[test]
    fn is_held_true_iff_any_value_or_decoder_trit_is_held() {
        let certain = mk(zero4(), vec![T, F, F], vec![F, T, F, T]);
        let held = mk(vec![F, F, F, N], vec![T, F, F], zero4());
        assert!(!is_held(&certain));
        assert!(is_held(&held));
    }

    #[test]
    fn from_value_round_trips_through_decode() {
        for v in [0.0, 1.0, 5.0, 6.0, 0.5, 8.0, 16.0] {
            let f = from_value(v, FloatShape::DEFAULT)
                .unwrap_or_else(|e| panic!("from_value {v} unexpectedly failed: {e}"));
            assert_eq!(Ok(v), decode(&f));
        }
    }

    #[test]
    fn from_value_surfaces_feedback_for_negative_and_non_dyadic() {
        assert!(from_value(-1.0, FloatShape::DEFAULT).is_err());
        assert!(from_value(0.1, FloatShape::DEFAULT).is_err()); // 0.1 is not a dyadic rational
    }
}
