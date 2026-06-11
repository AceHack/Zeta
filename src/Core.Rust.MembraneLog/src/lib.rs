//! membrane-log — one line of the membrane log (the `RecordedSource` wire form). Rust parity oracle;
//! mirrors `src/Core/RecordedSource.fs` (the F# oracle that LOCKED the membrane-log treaty) and the
//! C#/TS siblings. `to_line`/`of_line` must reproduce the shared golden lines byte-for-byte.

const INT_KINDS: [&str; 4] = [
    "TimerElapsed",
    "DotGitSaturation",
    "RoundsElapsedSinceFreeTime",
    "PeerPRMerged",
];
const STR_KINDS: [&str; 3] = ["RateLimitExhausted", "OperatorMessageArrived", "CIFailureDetected"];

/// One membrane crossing: tick + interrupt kind + typed arg (int / string / none).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MembraneCrossing {
    pub tick: i64,
    pub kind: String,
    pub int_arg: Option<i64>,
    pub str_arg: Option<String>,
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
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

impl MembraneCrossing {
    /// Serialize to the canonical wire line (byte-identical to the F# oracle).
    pub fn to_line(&self) -> String {
        if INT_KINDS.contains(&self.kind.as_str()) {
            format!("{}\t{}\t{}", self.tick, self.kind, self.int_arg.unwrap())
        } else if STR_KINDS.contains(&self.kind.as_str()) {
            format!("{}\t{}\t{}", self.tick, self.kind, esc(self.str_arg.as_ref().unwrap()))
        } else {
            format!("{}\t{}", self.tick, self.kind)
        }
    }

    /// Parse a canonical wire line; `None` on malformed/unknown-kind (honest refusal).
    pub fn of_line(line: &str) -> Option<Self> {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 2 {
            return None;
        }
        let tick: i64 = parts[0].parse().ok()?;
        let kind = parts[1];

        if kind == "SentinelMissing" {
            if parts.len() != 2 {
                return None;
            }
            return Some(Self { tick, kind: kind.to_string(), int_arg: None, str_arg: None });
        }
        if INT_KINDS.contains(&kind) {
            if parts.len() != 3 {
                return None;
            }
            let v: i64 = parts[2].parse().ok()?;
            return Some(Self { tick, kind: kind.to_string(), int_arg: Some(v), str_arg: None });
        }
        if STR_KINDS.contains(&kind) {
            if parts.len() != 3 {
                return None;
            }
            return Some(Self {
                tick,
                kind: kind.to_string(),
                int_arg: None,
                str_arg: Some(unesc(parts[2])),
            });
        }
        None
    }
}
