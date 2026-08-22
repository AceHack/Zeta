//! BFT quorum consensus decision core, Rust oracle.
//!
//! Conforms to the F# canonical shape (`src/Core/Consensus.fs`, `Consensus.quorumThreshold` / `decide`)
//! by agreeing on the shared seed (`src/Core.TypeScript/consensus/golden-vectors.json`) that the C#/F#/TS
//! oracles also verify. Pure integer. The vote state machine (`transition`) carries timestamps and is
//! out of the byte-lock scope; only the decision core is cross-verified.

/// The classic BFT quorum threshold: `2*floor((n-1)/3) + 1` (i.e. 2f+1 for n=3f+1).
pub fn quorum_threshold(node_count: i64) -> i64 {
    2 * ((node_count - 1) / 3) + 1
}

/// The outcome of `decide`: either a committed value with its support, or a rejection with the best
/// support seen. `value` is `None` on rejection.
#[derive(Debug, PartialEq, Eq)]
pub struct Decision {
    pub committed: bool,
    pub value: Option<String>,
    pub count: i64,
    pub total: i64,
}

/// Decide consensus over a list of vote VALUES (the F# `decide` ignores node/timestamp for the tally):
/// group by value preserving first-occurrence order, stable-sort by descending count, commit the top
/// iff its support reaches `quorum_threshold(total)`.
pub fn decide(votes: &[String]) -> Decision {
    let total = votes.len() as i64;
    if total == 0 {
        return Decision {
            committed: false,
            value: None,
            count: 0,
            total: 0,
        };
    }
    // First-occurrence-ordered (value, count) groups.
    let mut groups: Vec<(String, i64)> = Vec::new();
    for v in votes {
        if let Some(g) = groups.iter_mut().find(|(k, _)| k == v) {
            g.1 += 1;
        } else {
            groups.push((v.clone(), 1));
        }
    }
    // Stable sort by descending count (ties keep first-occurrence order).
    groups.sort_by_key(|g| std::cmp::Reverse(g.1));
    let threshold = quorum_threshold(total);
    let (value, count) = groups[0].clone();
    if count >= threshold {
        Decision {
            committed: true,
            value: Some(value),
            count,
            total,
        }
    } else {
        Decision {
            committed: false,
            value: None,
            count,
            total,
        }
    }
}
