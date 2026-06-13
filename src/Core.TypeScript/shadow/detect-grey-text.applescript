-- detect-grey-text.applescript
-- Queries the frontmost terminal emulator's accessibility tree for
-- autocomplete suggestion text (grey/ghost text from Claude Code).
--
-- Returns suggestion text on stdout if found; empty string if not.
-- Requires: System Preferences → Privacy & Security → Accessibility access.
--
-- Usage:
--   osascript detect-grey-text.applescript            (frontmost terminal)
--   osascript detect-grey-text.applescript iTerm2     (specific app)

on run argv
    tell application "System Events"
        set frontApp to first application process whose frontmost is true
        set frontAppName to name of frontApp

        -- Resolve target app: explicit argument wins; else require known terminal
        if (count of argv) > 0 then
            if frontAppName ≠ item 1 of argv then
                return ""
            end if
        else
            set knownTerminals to {"Terminal", "iTerm2", "iTerm", "Warp", "Hyper", "Alacritty", "kitty"}
            if knownTerminals does not contain frontAppName then
                return ""
            end if
        end if

        try
            set focusedEl to value of attribute "AXFocusedUIElement" of frontApp

            -- AXSelectedText: covers selections and ghost-text in some emulators
            try
                set selText to value of attribute "AXSelectedText" of focusedEl
                if class of selText is text and selText ≠ "" then
                    return selText
                end if
            end try

            -- AXValue is intentionally NOT used as a fallback: it returns the
            -- full text content of the focused element (entire scrollback for
            -- most terminal emulators), which is over-matching for grey-text
            -- autocomplete detection. Empirically observed 45KB+ scrollback
            -- being reported as "detected" suggestion content on 2026-05-15
            -- in dry-run mode — would have caused continuous Enter keystrokes
            -- in live mode for any focused terminal with shell history.
            -- If a future terminal exposes grey-text only via AXValue, add a
            -- per-terminal heuristic (length cap + diff vs prior poll) rather
            -- than blanket fallback.
        end try

        return ""
    end tell
end run
