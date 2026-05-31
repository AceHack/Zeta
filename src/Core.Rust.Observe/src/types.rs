//! The event-algebra types. Native Rust enums = native discriminated unions, and
//! `#[derive(PartialEq, Eq)]` gives structural equality for free — including
//! element-wise `Vec` comparison (no C#-style reference-equality gotcha). Mirrors
//! the TS reference (tools/observe/observe.ts) and the F#/C# oracles.

/// The persisted mode. The JSON wire form uses the lower/snake strings
/// `"work" | "explore" | "play" | "self_reflect" | "free_time"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Mode {
    /// Transient work mode (entered by do/decompose/edit-grammar).
    Work,
    /// Self-directed making.
    Explore,
    /// Leisure / culture-forming.
    Play,
    /// Reviewing own trajectories.
    SelfReflect,
    /// Rest.
    FreeTime,
}

/// One backlog item, classified to what the controller needs to decide.
/// `needs_new_action` is optional in the wire form (decompose children omit it;
/// absent ≡ false) — handled by the JSON mapping.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BacklogItem {
    /// Stable item id.
    pub id: String,
    /// Human-readable title.
    pub title: String,
    /// Ready to be worked.
    pub ready: bool,
    /// Ambiguous → wants decomposition.
    pub ambiguous: bool,
    /// Needs a fresh action grammar before it can proceed.
    pub needs_new_action: bool,
}

/// The observable read-side of the operator channel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperatorChannel {
    /// A message is waiting from the operator.
    pub pending_message: bool,
    /// Ferried verbatim content is waiting to be preserved.
    pub pending_ferry: bool,
}

/// The world snapshot. `operator = None` = the channel isn't wired; `mode = None`
/// = unset.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct World {
    /// The backlog, in order.
    pub backlog: Vec<BacklogItem>,
    /// The operator channel, if wired.
    pub operator: Option<OperatorChannel>,
    /// The persisted mode, if set.
    pub mode: Option<Mode>,
}

/// The event / action union (the Msg). Nine kinds; mirrors the TS `NextAction`.
/// `reason` fields are carried for parity and never affect the reducer transition.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NextAction {
    /// Clear the pending-ferry signal.
    PreserveFerry {
        /// Why (carried for parity).
        reason: String,
    },
    /// Clear the pending-message signal.
    RespondToOperator {
        /// Why (carried for parity).
        reason: String,
    },
    /// Item done → drop it from the backlog.
    DoItem {
        /// The item to drop (matched by id).
        item: BacklogItem,
    },
    /// Replace the ambiguous item in place with two ready children.
    Decompose {
        /// The item to decompose (matched by id).
        item: BacklogItem,
    },
    /// Sovereign grammar edit: the targeted item gains a fresh action + becomes ready.
    EditGrammar {
        /// The target item, or `None` for a no-op.
        item: Option<BacklogItem>,
        /// Why (carried for parity).
        reason: String,
    },
    /// Enter explore mode.
    Explore {
        /// Why (carried for parity).
        reason: String,
    },
    /// Enter play mode.
    Play {
        /// Why (carried for parity).
        reason: String,
    },
    /// Enter self-reflect mode.
    SelfReflect {
        /// Why (carried for parity).
        reason: String,
    },
    /// Enter free-time mode.
    FreeTime {
        /// Why (carried for parity).
        reason: String,
    },
}
