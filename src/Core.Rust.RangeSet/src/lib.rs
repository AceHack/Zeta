//! RangeSet — the Rust ferry (oracle #4 of TS/F#/C#/Rust) for the sparse-integer-set primitive
//! in compact range notation (`"1-5,8,10-17"`). The TS reference
//! (`src/Core.TypeScript/range-set/`) authors the shared `golden-vectors.json`; this replays it:
//! `render(&parse(input)?)` equals the **canonical** form, and `contains` agrees. "The compilers
//! don't lie."
//!
//! Canonical form (the cross-oracle byte-diff contract): ranges sorted, disjoint, and
//! NON-ADJACENT (overlapping AND touching coalesce, `1-3,4-6` → `1-6`), each emitted as `n` when
//! `lo == hi` else `lo-hi`, joined by `,` with no spaces; the empty set renders `""`. Non-negative
//! JS-safe integers (the shared int wire domain).
//!
//! Result over throw: `parse` returns `Result<RangeSet, RangeSetFeedback>` (the rejection-vector
//! contract — a malformed token declines the SPECIFIC variant, matching across oracles).

/// The shared JS-safe-integer ceiling (2^53 - 1) — the int wire domain (matches the other oracles).
const MAX_SAFE_INT: i64 = 9_007_199_254_740_991;

/// An inclusive integer range `(lo, hi)` with `lo <= hi`.
pub type Range = (i64, i64);

/// A normalized set of ranges: sorted, disjoint, non-adjacent (the canonical invariant).
pub type RangeSet = Vec<Range>;

/// The typed reasons `parse` declines — the shared cross-oracle rejection-vector contract.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum RangeSetFeedback {
    /// A token (or sub-token) was not a non-negative safe integer.
    NotInteger(String),
    /// A range `lo-hi` had `lo > hi`.
    InvertedRange {
        /// The lower bound.
        lo: i64,
        /// The upper bound.
        hi: i64,
    },
    /// A structurally bad token (empty between commas, trailing comma, empty sub-token, too many dashes).
    Malformed(String),
}

/// Parse a non-negative integer token strictly: digits only, within the safe-int range.
fn parse_nat(token: &str) -> Option<i64> {
    if token.is_empty() || !token.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    match token.parse::<i64>() {
        Ok(n) if (0..=MAX_SAFE_INT).contains(&n) => Some(n),
        _ => None,
    }
}

/// Normalize raw ranges into the canonical invariant: sort, then coalesce overlapping/adjacent.
fn normalize(mut ranges: Vec<Range>) -> RangeSet {
    ranges.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));
    let mut merged: RangeSet = Vec::new();
    for (lo, hi) in ranges {
        if let Some(last) = merged.last_mut() {
            // coalesce when the next range overlaps OR touches the previous (lo <= last.hi + 1)
            if lo <= last.1 + 1 {
                last.1 = last.1.max(hi);
                continue;
            }
        }
        merged.push((lo, hi));
    }
    merged
}

/// Parse one token ("n" or "lo-hi") into a range, or decline.
fn parse_token(token: &str) -> Result<Range, RangeSetFeedback> {
    let parts: Vec<&str> = token.split('-').collect();
    match parts.len() {
        1 => parse_nat(parts[0])
            .map(|n| (n, n))
            .ok_or_else(|| RangeSetFeedback::NotInteger(token.to_string())),
        2 => {
            // an empty sub-token ("-3", "5-") is structurally missing, not a bad number
            if parts[0].is_empty() || parts[1].is_empty() {
                return Err(RangeSetFeedback::Malformed(token.to_string()));
            }
            let lo = parse_nat(parts[0]).ok_or_else(|| RangeSetFeedback::NotInteger(parts[0].to_string()))?;
            let hi = parse_nat(parts[1]).ok_or_else(|| RangeSetFeedback::NotInteger(parts[1].to_string()))?;
            if lo > hi {
                Err(RangeSetFeedback::InvertedRange { lo, hi })
            } else {
                Ok((lo, hi))
            }
        }
        _ => Err(RangeSetFeedback::Malformed(token.to_string())),
    }
}

/// Parse compact range notation into a canonical [`RangeSet`]. Empty string → empty set.
///
/// # Errors
/// Declines [`RangeSetFeedback`] on a non-integer token, an inverted range, or a malformed token.
pub fn parse(s: &str) -> Result<RangeSet, RangeSetFeedback> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let mut ranges: Vec<Range> = Vec::new();
    for raw in trimmed.split(',') {
        let token = raw.trim();
        if token.is_empty() {
            return Err(RangeSetFeedback::Malformed(raw.to_string()));
        }
        ranges.push(parse_token(token)?);
    }
    Ok(normalize(ranges))
}

/// Render a [`RangeSet`] to its canonical compact string.
#[must_use]
pub fn render(rs: &[Range]) -> String {
    rs.iter()
        .map(|&(lo, hi)| if lo == hi { lo.to_string() } else { format!("{lo}-{hi}") })
        .collect::<Vec<_>>()
        .join(",")
}

/// Whether `n` is a member of the set (ranges are sorted, so the scan early-exits).
#[must_use]
pub fn contains(rs: &[Range], n: i64) -> bool {
    for &(lo, hi) in rs {
        if n < lo {
            return false;
        }
        if n <= hi {
            return true;
        }
    }
    false
}

/// The union of two range sets, re-normalized to canonical form.
#[must_use]
pub fn union(a: &[Range], b: &[Range]) -> RangeSet {
    let mut combined = a.to_vec();
    combined.extend_from_slice(b);
    normalize(combined)
}

/// Add a single integer to the set (returns a new canonical set).
#[must_use]
pub fn add(rs: &[Range], n: i64) -> RangeSet {
    let mut combined = rs.to_vec();
    combined.push((n, n));
    normalize(combined)
}

/// The total count of integers covered by the set.
#[must_use]
pub fn size(rs: &[Range]) -> i64 {
    rs.iter().map(|&(lo, hi)| hi - lo + 1).sum()
}
