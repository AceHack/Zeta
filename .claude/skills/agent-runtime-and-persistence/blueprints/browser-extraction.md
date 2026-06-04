---
name: browser-extraction
description: "Browser content extraction via osascript + Chrome JS — authenticated sessions, no Playwright, macOS only."
trigger: "extract from browser", "download conversation", "authenticated session", "get the page", "scrape", "osascript chrome"
---

# Browser Content Extraction via osascript + Chrome

## What this does

Extracts content from authenticated web sessions (Claude.ai,
ChatGPT, Gemini, DeepSeek, any site) using the user's running
Chrome browser via AppleScript JavaScript execution. Uses the
user's existing login — no re-authentication needed.

## What this does NOT do

- Does NOT use Playwright (separate browser, separate cookies)
- Does NOT access cookie stores or credential files
- Does NOT work with Safari (Chrome only)
- Does NOT bypass authentication (requires user already logged in)

## Prerequisites

1. Chrome running with the target site already authenticated
2. Chrome → View → Developer → Allow JavaScript from Apple Events (one-time toggle)
3. Playwright's Chrome killed (it shadows real Chrome for AppleScript)

## Procedure

### Step 1: Kill Playwright Chrome

Playwright runs its own Chrome (`--user-data-dir=.../ms-playwright/...`).
AppleScript sees it instead of the real Chrome. Kill it first.

```bash
kill $(ps aux | grep 'ms-playwright/mcp-chrome' | grep -v grep | awk '{print $2}') 2>/dev/null
```

### Step 2: Verify real Chrome is visible

```bash
osascript -e 'tell application "Google Chrome" to count of windows'
```

Should return > 0. If 0, Chrome might need `open -a "Google Chrome"`.

### Step 3: Open the target URL (if not already open)

```bash
osascript << 'EOF'
tell application "Google Chrome"
    tell active tab of window 1
        set URL to "https://target-url-here"
    end tell
end tell
EOF
```

Wait 5-8 seconds for the page to load.

### Step 4: Find the target tab

```bash
osascript << 'EOF'
tell application "Google Chrome"
    repeat with w in windows
        repeat with t in tabs of w
            if URL of t contains "target-url-fragment" then
                return title of t & " | " & URL of t
            end if
        end repeat
    end repeat
    return "Not found"
end tell
EOF
```

### Step 5: Extract content (chunked for large pages)

```bash
osascript << 'EOF' > /tmp/extraction.txt
tell application "Google Chrome"
    repeat with w in windows
        repeat with t in tabs of w
            if URL of t contains "target-url-fragment" then
                tell t
                    set totalLen to execute javascript "document.body.innerText.length"
                    set allText to ""
                    set chunkSize to 40000
                    set i to 0
                    repeat while i < totalLen
                        set chunk to execute javascript "document.body.innerText.substring(" & i & "," & (i + chunkSize) & ")"
                        set allText to allText & chunk
                        set i to i + chunkSize
                    end repeat
                end tell
                return allText
            end if
        end repeat
    end repeat
end tell
EOF
```

### Step 6: Post-extraction name scrubbing

Always check for sensitive names before committing:

```bash
grep -ioP '\b[A-Z][a-z]+\s+[A-Z][a-z]+\b' /tmp/extraction.txt | sort -u
```

Review the list. Scrub any names that don't have explicit
consent using sed:

```bash
sed -i '' -e 's/\bSensitiveName\b/[role-description]/g' /tmp/extraction.txt
```

### Step 7: Add §33 archive header and commit

Add the standard archive header (Scope, Attribution, Operational
status, Non-fusion disclaimer) before committing to `docs/research/`.

## When to use this vs Playwright

- **Use osascript**: when the user is already logged into a
  site in Chrome and you need their authenticated session
- **Use Playwright**: when no authentication is needed, or
  when you need browser automation (clicking, filling forms)
- **Never use Playwright** for authenticated session extraction —
  it has its own cookie store and won't see the user's login

## Shadow lesson

This skill exists because of shadow catch #5 (effort-avoidance)
and catch #9 (pattern-blindness). Otto fought Playwright for
20 minutes before discovering osascript works in 30 seconds.
The proven pattern was available from a prior session but
wasn't reached for first. When the first attempt returns
suspiciously little data, try harder. When a known pattern
exists, use it instead of inventing a new approach.

## Proven track record (2026-05-07)

| Source | Size | Method |
|--------|------|--------|
| ChatGPT (Amara reconstruction) | 195KB | Playwright (pre-discovery) |
| Claude.ai (Seeking feedback) | 294KB | Playwright (second attempt) |
| Gemini (Lior/Protocol Scale-Up) | 118KB | Playwright |
| DeepSeek (Ethics Containment) | 66KB | Playwright |
| DeepSeek (Git Automation) | 15KB | Playwright |
| Claude.ai (CLI harness) | 974KB | osascript/Chrome ← this method |
