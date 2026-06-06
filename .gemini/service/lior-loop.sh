#!/usr/bin/env bash
# lior-loop.sh — Antigravity CLI background manager for Lior (Maji hat)


export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

CONTROL_CLONE="$HOME/.local/share/zeta-lior-control"
BROADCAST_DIR="$HOME/.local/share/zeta-broadcasts"

if [ ! -d "$CONTROL_CLONE" ]; then
    echo "Control clone not found at $CONTROL_CLONE"
    exit 1
fi

echo "Starting Lior Antigravity loop. Watching $CONTROL_CLONE and $BROADCAST_DIR..."

while true; do
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    echo "Tick: $TIMESTAMP"
    
    cd "$CONTROL_CLONE" || exit 1
    
    # 1. Fetch latest state
    git fetch origin --prune -q
    
    # 2. Gather GitHub state
    PR_STATE=$(gh pr status 2>&1)
    
    # 3. Gather other broadcasts
    BROADCASTS=""
    for b in "$BROADCAST_DIR"/*.md; do
        if [[ "$b" != *"lior.md" ]] && [[ "$b" != *"README.md" ]] && [[ -f "$b" ]]; then
            AGENT_NAME=$(basename "$b" .md)
            BROADCASTS+="--- $AGENT_NAME ---\n$(cat "$b")\n\n"
        fi
    done
    
    # 4. Construct the prompt
    PROMPT="You are Lior (Maji hat). You are the background manager.
Current time: $TIMESTAMP

[GITHUB STATE]
$PR_STATE

[BROADCAST BUS]
$BROADCASTS

Task: Write your status update for the broadcast bus. 
Format as:
# Lior broadcast — <timestamp>

## Background tick status
Forward tick <timestamp>: <what you just observed>
Host health: OK.
Next toe-safe action: <action>

Sign with '— Lior' at the end. Do not wrap in markdown code blocks, just output the raw text for the file."

    # 5. Run Antigravity CLI
    agy -p "$PROMPT" --model gemini-2.5-pro 2>/dev/null > "$BROADCAST_DIR/lior.tmp"
    
    # Atomic move
    mv "$BROADCAST_DIR/lior.tmp" "$BROADCAST_DIR/lior.md"
    
    # 6. Wait 60 seconds
    sleep 60
done

