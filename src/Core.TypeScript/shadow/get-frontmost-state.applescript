-- get-frontmost-state.applescript
-- Returns minimal state about the frontmost application: pid + name.
-- Cheap query — no AXValue/AXFocusedUIElement traversal, no key injection.
--
-- Used by the shadow observer's freshness-threshold guard (B-0402.fix3):
-- skip AX-heavy detection + restore-arrow keypresses while a newly-focused
-- window is still settling, to avoid interfering with shell init (e.g.
-- zsh .zshrc plugins loading in a new terminal that just became frontmost).
--
-- Return format (single stdout line):
--
--   <pid>|<app-name>
--
-- where:
--   pid       integer process ID of the frontmost application
--   app-name  display name of the frontmost application (e.g. "Terminal")
--
-- Returns empty string on any accessibility failure (no permission, no
-- frontmost app, etc.) — caller treats empty as "unknown, skip cycle."

on run
    try
        tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set frontPid to unix id of frontApp
            set frontName to name of frontApp
        end tell
        return (frontPid as text) & "|" & frontName
    on error
        return ""
    end try
end run
