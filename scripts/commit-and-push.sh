#!/bin/bash
# Nightly cron script: commit data/ changes and push to GitHub
# Runs at 10:30 PM via crontab
# Only commits files in data/ — never accidentally stages code changes

REPO_DIR="/Users/williamzimmerman/Desktop/Client Work/Claude/Personal/Hormozi-Focus-Timer"
LOG_DIR="/Users/williamzimmerman/Desktop/Client Work/Claude/Automations/logs"
LOG_FILE="$LOG_DIR/focus-timer-sync.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

cd "$REPO_DIR" || { log "ERROR: Cannot cd to $REPO_DIR"; exit 1; }

# Only stage data files
git add data/

# Check if there are staged changes
if git diff --cached --quiet; then
    log "No changes in data/ — skipping"
    exit 0
fi

# Commit and push
DATE=$(date '+%Y-%m-%d')
git commit -m "Daily focus data: $DATE"
if [ $? -eq 0 ]; then
    git push origin main 2>&1 | while read line; do log "push: $line"; done
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        log "Pushed data for $DATE"
    else
        log "ERROR: Push failed"
    fi
else
    log "ERROR: Commit failed"
fi
