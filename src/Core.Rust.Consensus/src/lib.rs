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
/// group by value, take the highest support, commit it iff it reaches `quorum_threshold(total)`.
///
/// The tie-break among values sharing the highest support is the **ordinal minimum**, deliberately
/// order-INDEPENDENT: two nodes that received the same votes in different orders must decide
/// identically. It used to be first-occurrence, which read arrival order and diverged at
/// n ∈ {2, 3, 6}. See `src/Core/Consensus.fs` and the shared seed
/// `src/Core.TypeScript/consensus/golden-vectors.json` — do NOT change the rule in one oracle.
///
/// Collation note: `Ord for String` here is UTF-8 byte order (== Unicode codepoint order), while the
/// F#/C#/TS oracles order by UTF-16 code unit. The two agree on every value in the seed and disagree
/// only for a tie straddling the astral/high-BMP boundary — named, not fixed; see the decision doc.
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
    let mut groups: Vec<(String, i64)> = Vec::new();
    for v in votes {
        if let Some(g) = groups.iter_mut().find(|(k, _)| k == v) {
            g.1 += 1;
        } else {
            groups.push((v.clone(), 1));
        }
    }
    let count = groups.iter().map(|g| g.1).max().expect("non-empty");
    // Order-independent tie-break: ordinal minimum among the values tied at `count`.
    let value = groups
        .iter()
        .filter(|g| g.1 == count)
        .map(|g| g.0.clone())
        .min()
        .expect("non-empty");
    let threshold = quorum_threshold(total);
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
