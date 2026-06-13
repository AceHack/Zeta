-- restore-arrow.applescript (v2 — delta-detection)
-- Press the right-arrow key (key code 124) in the frontmost terminal if
-- (and only if) the frontmost application is a known terminal emulator.
-- Sample the focused element's text value BEFORE and AFTER the press,
-- then return a delta describing what (if anything) appeared.
--
-- Rationale: when an autonomous-loop cron tick fires a prompt in the
-- Claude Code CLI, any grey-text autocomplete in the input field is
-- erased. Pressing → restores the suggestion as typed text. The delta
-- catches the restored content for the log so the maintainer can audit
-- (a) which suggestions actually got restored, and (b) whether anything
-- accidentally got captured that wasn't autocomplete (e.g. their own
-- typing between samples).
--
-- Return format (single stdout line, fields separated by ASCII Unit
-- Separator char id 31):
--
--   <verdict><delta-content>
--
-- where:
--   verdict      ∈ { "pressed:<app>", "skipped:<reason>", "error:<reason>" }
--   delta-content   the substring that appeared AFTER the press but was
--                   not present BEFORE. Empty when no text changed (the
--                   common case: no autocomplete + cursor at end of input
--                   → → is a no-op).
--
-- The delta is computed as: if the BEFORE text is a prefix of the AFTER
-- text, delta = AFTER's suffix beyond BEFORE. Otherwise delta = AFTER in
-- full (signals an unusual non-extension change). Both samples are
-- capped to the trailing 500 characters of AXValue to avoid pulling in
-- terminal scrollback (which can be 45KB+).
--
-- Requires: System Preferences → Privacy & Security → Accessibility
-- access for the host (bun, osascript, or terminal as applicable).

on tailText(t, n)
    -- Return the last n characters of t (or all of t if shorter).
    -- AppleScript text-class assumed; non-text values caller-rejected.
    set L to length of t
    if L <= n then return t
    return text (L - n + 1) thru L of t
end tailText

on safeSample(frontApp)
    -- Sample AXValue of the focused element of frontApp, capped to the
    -- trailing 500 characters. Returns "" on any accessibility failure
    -- (no permission, no focused element, non-text value, etc.) — never
    -- raises, so the caller can always treat the result as a string.
    try
        tell application "System Events"
            set focusedEl to value of attribute "AXFocusedUIElement" of frontApp
        end tell
        try
            tell application "System Events"
                set v to value of attribute "AXValue" of focusedEl
            end tell
            if class of v is text then
                return my tailText(v, 500)
            end if
        end try
    end try
    return ""
end safeSample

on computeDelta(vBefore, vAfter)
    -- Suffix-extension delta: if vBefore is a prefix of vAfter, return
    -- the suffix of vAfter beyond vBefore. Otherwise return vAfter
    -- whole (signals an unusual non-extension change worth logging).
    -- Empty string when nothing changed (the common no-op case).
    if vAfter is equal to vBefore then return ""
    set bLen to length of vBefore
    set aLen to length of vAfter
    if bLen = 0 then return vAfter
    if aLen < bLen then return vAfter
    -- Cheap prefix check via head extraction
    set head to text 1 thru bLen of vAfter
    if head is equal to vBefore then
        if aLen = bLen then return ""
        return text (bLen + 1) thru aLen of vAfter
    end if
    return vAfter
end computeDelta

on run
    set sep to (ASCII character 31)

    tell application "System Events"
        try
            set frontApp to first application process whose frontmost is true
        on error
            return "skipped:no-frontmost" & sep & ""
        end try
        set frontAppName to name of frontApp
        set knownTerminals to {"Terminal", "iTerm2", "iTerm", "Warp", "Hyper", "Alacritty", "kitty"}
        if knownTerminals does not contain frontAppName then
            return "skipped:not-terminal:" & frontAppName & sep & ""
        end if
    end tell

    set vBefore to my safeSample(frontApp)

    tell application "System Events"
        key code 124  -- right arrow
    end tell
    delay 0.05

    set vAfter to my safeSample(frontApp)
    set deltaText to my computeDelta(vBefore, vAfter)

    return "pressed:" & frontAppName & sep & deltaText
end run
