//! four-corner — the bidirectional-feedback I/O object (four corners = data×feedback × in×out).
//! Rust parity oracle; mirrors `src/Core/FourCorner.fs` (the F# oracle that LOCKED the treaty bytes),
//! `src/Core.CSharp/FourCornerOwnership.cs`, and `src/Core.TypeScript/four-corner/four-corner.ts`.
//! `t_in_feedback` is co-owned — both sides contribute — "each is backpressure from the other's
//! perspective".
//!
//! TREATY (B-1022): `to_line`/`of_line` is the canonical text wire form for the string-quad
//! instantiation; this oracle MUST produce/consume byte-identical lines to the other three against
//! `src/Core.TypeScript/four-corner/golden-vectors.lines` (the integration test replays it).

/// The four-corner ownership object: data flows forward (`t_in` → `t_out`), feedback flows back
/// (`t_out_feedback` / `t_in_feedback`). `t_in` is required; the other corners are optional
/// (`None` = not yet filled — mirrors F# `option` / C# `string?` / TS `null`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FourCornerOwnership {
    /// what comes in (e.g. an OperatorMessage)
    pub t_in: String,
    /// what the agent emits back
    pub t_out: Option<String>,
    /// control-flow the agent authors on the channel
    pub t_out_feedback: Option<String>,
    /// the co-owned channel — BOTH sides contribute; each side's contribution is the other's backpressure
    pub t_in_feedback: Option<String>,
}

impl FourCornerOwnership {
    /// Just the input — no output, no feedback yet (the resting corner).
    pub fn of_in(t_in: impl Into<String>) -> Self {
        Self {
            t_in: t_in.into(),
            t_out: None,
            t_out_feedback: None,
            t_in_feedback: None,
        }
    }

    /// Has the tick produced output yet? (the forward corner is filled)
    pub fn has_output(&self) -> bool {
        self.t_out.is_some()
    }

    /// Has feedback crossed in either direction? (the backpressure corners)
    pub fn has_feedback(&self) -> bool {
        self.t_out_feedback.is_some() || self.t_in_feedback.is_some()
    }

    /// Serialize to the canonical treaty line (byte-identical to the F#/C#/TS oracles).
    pub fn to_line(&self) -> String {
        format!(
            "fourcorner1\t{}\t{}\t{}\t{}",
            esc(&self.t_in),
            opt_to_text(&self.t_out),
            opt_to_text(&self.t_out_feedback),
            opt_to_text(&self.t_in_feedback)
        )
    }

    /// Parse a canonical treaty line; `None` on malformed input (honest refusal).
    pub fn of_line(line: &str) -> Option<Self> {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() != 5 || parts[0] != "fourcorner1" {
            return None;
        }
        let t_out = opt_of_text(parts[2])?;
        let t_out_feedback = opt_of_text(parts[3])?;
        let t_in_feedback = opt_of_text(parts[4])?;
        Some(Self {
            t_in: unesc(parts[1]),
            t_out,
            t_out_feedback,
            t_in_feedback,
        })
    }
}

fn esc(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('\t', "\\t")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn unesc(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('t') => out.push('\t'),
                Some('n') => out.push('\n'),
                Some('r') => out.push('\r'),
                Some(other) => out.push(other),
                None => out.push('\\'), // lone trailing backslash — preserved (parity: F#/C#/TS keep it)
            }
        } else {
            out.push(c);
        }
    }
    out
}

fn opt_to_text(v: &Option<String>) -> String {
    match v {
        None => "-".to_string(),
        Some(s) => format!("+{}", esc(s)),
    }
}

/// Outer `None` = malformed; `Some(None)` = the "-" corner; `Some(Some(v))` = a filled corner.
fn opt_of_text(s: &str) -> Option<Option<String>> {
    if s == "-" {
        Some(None)
    } else {
        s.strip_prefix('+').map(|rest| Some(unesc(rest)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resting_corner_helpers() {
        let o = FourCornerOwnership::of_in("msg");
        assert!(!o.has_output());
        assert!(!o.has_feedback());
    }

    #[test]
    fn malformed_is_refused() {
        assert!(FourCornerOwnership::of_line("garbage").is_none());
        assert!(FourCornerOwnership::of_line("fourcorner1\tonly-three\t-\t-").is_none());
        assert!(FourCornerOwnership::of_line("fourcorner2\ta\t-\t-\t-").is_none());
        assert!(FourCornerOwnership::of_line("fourcorner1\ta\t?\t-\t-").is_none());
    }
}
