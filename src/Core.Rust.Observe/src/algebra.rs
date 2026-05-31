//! The pure event algebra: `simulate` (reducer) / `fold` (projection) / `replay`.
//! Mirrors tools/observe/observe.ts + the F#/C# oracles byte-for-byte in behaviour,
//! so the shared golden-vector fixture produces the SAME states here — the
//! cross-language-parity = non-Byzantine-BFT check (B-0944).
//!
//! Active disciplines: lock-free + wait-free (pure values, no shared mutable state),
//! weight-free, DST (deterministic from the same event log), idempotency (fold =
//! the monoidal reduction over an append-only log).

use crate::types::{BacklogItem, Mode, NextAction, OperatorChannel, World};

/// Apply one action to the world, returning the next world. `reason` fields never
/// affect the transition (parity with TS/F#/C#).
pub fn simulate(world: &World, action: &NextAction) -> World {
    match action {
        // Clear the pending-ferry signal (only if the channel is wired).
        NextAction::PreserveFerry { .. } => World {
            backlog: world.backlog.clone(),
            operator: world.operator.as_ref().map(|op| OperatorChannel {
                pending_message: op.pending_message,
                pending_ferry: false,
            }),
            mode: world.mode,
        },

        // Clear the pending-message signal (only if the channel is wired).
        NextAction::RespondToOperator { .. } => World {
            backlog: world.backlog.clone(),
            operator: world.operator.as_ref().map(|op| OperatorChannel {
                pending_message: false,
                pending_ferry: op.pending_ferry,
            }),
            mode: world.mode,
        },

        // Item done → drop it from the backlog; entering work mode.
        NextAction::DoItem { item } => World {
            backlog: world.backlog.iter().filter(|i| i.id != item.id).cloned().collect(),
            operator: world.operator.clone(),
            mode: Some(Mode::Work),
        },

        // Replace the ambiguous item in place with two ready children.
        NextAction::Decompose { item } => World {
            backlog: world
                .backlog
                .iter()
                .flat_map(|i| {
                    if i.id == item.id {
                        vec![
                            BacklogItem {
                                id: format!("{}.1", item.id),
                                title: format!("{} (part 1)", item.title),
                                ready: true,
                                ambiguous: false,
                                needs_new_action: false,
                            },
                            BacklogItem {
                                id: format!("{}.2", item.id),
                                title: format!("{} (part 2)", item.title),
                                ready: true,
                                ambiguous: false,
                                needs_new_action: false,
                            },
                        ]
                    } else {
                        vec![i.clone()]
                    }
                })
                .collect(),
            operator: world.operator.clone(),
            mode: Some(Mode::Work),
        },

        // Sovereign grammar edit: the targeted item gains a fresh action + becomes
        // ready (no-op if no target item). Entering work mode.
        NextAction::EditGrammar { item, .. } => match item {
            None => world.clone(),
            Some(target) => World {
                backlog: world
                    .backlog
                    .iter()
                    .map(|i| {
                        if i.id == target.id {
                            BacklogItem {
                                ready: true,
                                ambiguous: false,
                                needs_new_action: false,
                                ..i.clone()
                            }
                        } else {
                            i.clone()
                        }
                    })
                    .collect(),
                operator: world.operator.clone(),
                mode: Some(Mode::Work),
            },
        },

        // The four free modes set the persisted mode and leave the backlog alone.
        NextAction::Explore { .. } => World { mode: Some(Mode::Explore), ..world.clone() },
        NextAction::Play { .. } => World { mode: Some(Mode::Play), ..world.clone() },
        NextAction::SelfReflect { .. } => World { mode: Some(Mode::SelfReflect), ..world.clone() },
        NextAction::FreeTime { .. } => World { mode: Some(Mode::FreeTime), ..world.clone() },
    }
}

/// Project state from the event log: left-fold over `simulate`.
/// History is a list of events; state is a projection of that list.
pub fn fold(initial: &World, events: &[NextAction]) -> World {
    events.iter().fold(initial.clone(), |w, a| simulate(&w, a))
}

/// State after each event, the initial state excluded — mirrors the TS/F#/C# `replay`.
pub fn replay(initial: &World, events: &[NextAction]) -> Vec<World> {
    let mut states = Vec::with_capacity(events.len());
    let mut current = initial.clone();
    for a in events {
        current = simulate(&current, a);
        states.push(current.clone());
    }
    states
}
