//! Map our [`Json`](crate::json::Json) AST → observe types.
//!
//! Hexagonal: this mapping depends ONLY on our own `Json` port — never on any
//! external parser's value type. Whichever [`JsonParser`](crate::json::JsonParser)
//! produced the `Json` (the zero-dep one or the serde adapter), the mapping is
//! identical. Key lookup is by name, so object key order does not matter.

use crate::json::Json;
use crate::types::{BacklogItem, Mode, NextAction, OperatorChannel, World};

/// A mapping error: the JSON did not match the expected observe shape.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MapError(pub String);

fn req<'a>(j: &'a Json, key: &str) -> Result<&'a Json, MapError> {
    j.get(key).ok_or_else(|| MapError(format!("missing key '{key}'")))
}

fn req_str(j: &Json, key: &str) -> Result<String, MapError> {
    req(j, key)?
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| MapError(format!("key '{key}' is not a string")))
}

fn req_bool(j: &Json, key: &str) -> Result<bool, MapError> {
    req(j, key)?
        .as_bool()
        .ok_or_else(|| MapError(format!("key '{key}' is not a bool")))
}

/// Optional bool: absent ≡ `fallback`, but a key present with a non-bool value is a
/// shape error (not silently coerced to the fallback). Used for `needsNewAction`
/// (decompose children omit it; absent ≡ false — the value the reducer sets).
fn opt_bool(j: &Json, key: &str, fallback: bool) -> Result<bool, MapError> {
    match j.get(key) {
        None => Ok(fallback),
        Some(v) => v
            .as_bool()
            .ok_or_else(|| MapError(format!("key '{key}' is present but not a bool"))),
    }
}

/// Map a JSON object → [`BacklogItem`]. `needsNewAction` is optional (≡ false).
pub fn parse_item(j: &Json) -> Result<BacklogItem, MapError> {
    Ok(BacklogItem {
        id: req_str(j, "id")?,
        title: req_str(j, "title")?,
        ready: req_bool(j, "ready")?,
        ambiguous: req_bool(j, "ambiguous")?,
        needs_new_action: opt_bool(j, "needsNewAction", false)?,
    })
}

/// Map a wire-form mode string → [`Mode`].
pub fn parse_mode(s: &str) -> Result<Mode, MapError> {
    match s {
        "work" => Ok(Mode::Work),
        "explore" => Ok(Mode::Explore),
        "play" => Ok(Mode::Play),
        "self_reflect" => Ok(Mode::SelfReflect),
        "free_time" => Ok(Mode::FreeTime),
        other => Err(MapError(format!("unknown mode '{other}'"))),
    }
}

/// Map a JSON object → [`World`]. `operator` / `mode` are optional (absent ≡ None).
pub fn parse_world(j: &Json) -> Result<World, MapError> {
    let backlog = req(j, "backlog")?
        .as_array()
        .ok_or_else(|| MapError("'backlog' is not an array".to_string()))?
        .iter()
        .map(parse_item)
        .collect::<Result<Vec<_>, _>>()?;

    let operator = match j.get("operator") {
        Some(op) => Some(OperatorChannel {
            pending_message: req_bool(op, "pendingMessage")?,
            pending_ferry: req_bool(op, "pendingFerry")?,
        }),
        None => None,
    };

    let mode = match j.get("mode") {
        Some(m) => Some(parse_mode(
            m.as_str().ok_or_else(|| MapError("'mode' is not a string".to_string()))?,
        )?),
        None => None,
    };

    Ok(World { backlog, operator, mode })
}

/// Map a JSON object → [`NextAction`].
pub fn parse_event(j: &Json) -> Result<NextAction, MapError> {
    let reason = || j.get("reason").and_then(Json::as_str).unwrap_or("").to_string();
    let item = || -> Result<BacklogItem, MapError> { parse_item(req(j, "item")?) };
    let item_opt = || -> Result<Option<BacklogItem>, MapError> {
        match j.get("item") {
            Some(it) => Ok(Some(parse_item(it)?)),
            None => Ok(None),
        }
    };

    match req_str(j, "kind")?.as_str() {
        "preserve_ferry" => Ok(NextAction::PreserveFerry { reason: reason() }),
        "respond_to_operator" => Ok(NextAction::RespondToOperator { reason: reason() }),
        "do_item" => Ok(NextAction::DoItem { item: item()? }),
        "decompose" => Ok(NextAction::Decompose { item: item()? }),
        "edit_grammar" => Ok(NextAction::EditGrammar { item: item_opt()?, reason: reason() }),
        "explore" => Ok(NextAction::Explore { reason: reason() }),
        "play" => Ok(NextAction::Play { reason: reason() }),
        "self_reflect" => Ok(NextAction::SelfReflect { reason: reason() }),
        "free_time" => Ok(NextAction::FreeTime { reason: reason() }),
        other => Err(MapError(format!("unknown action kind '{other}'"))),
    }
}
