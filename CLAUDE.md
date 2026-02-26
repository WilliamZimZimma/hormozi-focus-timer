# Hormozi Focus Timer - Intelligence File

> Auto-generated and maintained by /learn. Updated every session.

Last Updated: 2026-02-26
Sessions Tracked: 1

## What This Project Does

A browser-based 15-minute interval focus timer inspired by Alex Hormozi's productivity method. Tracks time across three categories (PROMOTE, BUILD, DELIVER), plays sound notifications at each interval, and saves sessions to both localStorage and optional daily markdown files via a Node.js server.

## Architecture

- **`index.html`** - Single-file app (HTML + CSS + JS). All timer logic, UI, sound generation, localStorage persistence, and server communication in one file. No build step, no dependencies.
- **`server.js`** - Optional Node.js server (port 3847) that saves sessions to daily markdown files in `data/`. Also generates weekly summaries. Timer works without the server (falls back to localStorage only).
- **`scripts/create-issue.js`** - Zero-dep Node.js script that parses daily markdown, calculates stats (streak, category %, 7-day avg), and creates a GitHub Issue via the API. Runs in GitHub Actions.
- **`scripts/commit-and-push.sh`** - Nightly cron script (10:30 PM) that commits `data/` changes and pushes to GitHub, triggering the Action.
- **`.github/workflows/daily-digest.yml`** - GitHub Action that runs `create-issue.js` when data files are pushed.
- **Data flow:** Timer runs in browser → interval completes → auto-saves to localStorage → on RESET, also sends to server → server writes to `data/YYYY-MM-DD-DayName.md` → cron pushes at 10:30 PM → GitHub Action creates Issue digest

## File Map

| File | Purpose |
|------|---------|
| `index.html` | Complete timer app - UI, logic, sounds, persistence (1500+ lines) |
| `server.js` | Express-less Node.js server for saving sessions to daily markdown files |
| `data/` | Daily markdown files (YYYY-MM-DD-DayName.md) — committed and pushed nightly |
| `scripts/create-issue.js` | Digest generator + GitHub Issue creator (zero npm deps) |
| `scripts/commit-and-push.sh` | Nightly cron script: commit data, push to origin |
| `.github/workflows/daily-digest.yml` | GitHub Action: triggers on data push, creates Issue |
| `README.md` | User-facing documentation with keyboard shortcuts and setup |
| `CLAUDE.md` | This intelligence file |

## Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| Node.js | Runtime | For server.js only. Timer works without it. |
| Chrome/Safari | Browser | Timer runs as local HTML file or via localhost |
| localStorage | Browser API | Primary session persistence |
| Web Audio API | Browser API | Sound generation (no audio files needed) |

## How to Run

```bash
# Option 1: Just the timer (localStorage only)
open index.html

# Option 2: With server for daily file saving
node server.js   # starts on port 3847
# Then open index.html in browser — green dot = server connected

# Option 3: Via localhost (avoids Chrome file:// issues)
python3 -m http.server 8888
open http://localhost:8888/index.html
```

## GitHub

- **Repo:** `WilliamZimZimma/hormozi-focus-timer` (private)
- **Clone location:** `Personal/Hormozi-Focus-Timer/` (moved from `/tmp/` on 2026-02-26)
- **Note:** Repo name has capital letters but GitHub redirects lowercase

## Current State: TEST MODE

Timer is currently set to **30-second intervals** for testing (normally 15 minutes). Changes:
- `countdownSeconds = 30` (was 900)
- Save threshold: 5 seconds (was 60)
- Subtitle: "Every 30 seconds counts (TEST MODE)"
- Display: "00:30" (was "15:00")
- Log messages: "30 sec" (was "15 min")
- Download extension: `.txt` (was `.md`, changed because Calibre hijacked .md files)

**To restore production mode:** Change `countdownSeconds` back to 900, save threshold to 60, update display strings.

## Patterns That Work

- 2026-02-26 - Serve HTML via `python3 -m http.server` when Chrome has issues with `file://` URLs. Avoids local file security restrictions.
- 2026-02-26 - Auto-save to a separate localStorage key (`_current`) after each interval, overwriting rather than appending. Prevents duplicate sessions while protecting against data loss. Commit to `allSessions` only on RESET.

## Learned Mistakes

- 2026-02-26 - **What happened:** Deleted user's active Chrome app (`Google Chrome 2.app`) via `rm -rf` while it was running. Also deleted `Google Chrome.app`. **Correct approach:** NEVER delete running applications. Ask user to quit first. Check which Chrome is active before touching any.
- 2026-02-26 - **What happened:** Renamed `Google Chrome 3.app` to `Google Chrome.app` but it was version 136 (April 2025), while user's profile data was from version 145. Chrome crashed on every launch because profile format is not backwards-compatible. **Correct approach:** Always check Chrome version compatibility before swapping app bundles. When in doubt, download fresh from Google.
- 2026-02-26 - **What happened:** `open -a "Google Chrome"` and AppleScript both failed to talk to Chrome because the app bundle was deleted while the process was still running (orphaned process). **Correct approach:** Chrome processes reference their original app bundle path. If the bundle is deleted, the running instance becomes unreachable via system commands.

## Gotchas

- Multiple Chrome installs (`Google Chrome.app`, `Google Chrome 2.app`, `Google Chrome 3.app`) can exist in /Applications. Always check which one is actually running via `ps aux | grep Chrome` before modifying any.
- Chrome profile data lives in `~/Library/Application Support/Google/Chrome/` — independent of app bundle. Deleting the .app doesn't lose bookmarks/passwords/tabs.
- `saveSession()` only fires on RESET or `beforeunload`. If user clicks DOWNLOAD mid-session, need to inject active session data manually.
- `.md` files may open in Calibre instead of the expected app on this machine. Use `.txt` extension as workaround.
- `Homebrew` is NOT installed on this machine. Don't suggest `brew install` commands.
- `gh` CLI is NOT installed. Use `git` directly (authenticates via macOS Keychain).

## Session Log

### 2026-02-26 - Fixed recording bugs, Chrome reinstall, test mode setup
- **Built:**
  - Modified `index.html`: 30-sec test mode, auto-save after intervals, download includes active sessions, seconds-level precision in exports, fixed reset countdown
  - Downloaded and installed fresh Chrome 145.0.7632.117 after breaking Chrome installs
- **Learned:**
  - Chrome profile format is version-locked — old Chrome can't read profiles updated by newer Chrome
  - Sessions only saved on RESET was the root cause of "download shows nothing" bug
  - Orphaned Chrome processes (app bundle deleted while running) can't be addressed by AppleScript or `open` command
- **Broke:**
  - Accidentally deleted `Google Chrome.app` and `Google Chrome 2.app` (user's active Chrome)
  - Renamed Chrome 3.app was version 136, caused crash loops with version 145 profile data
  - Had to download fresh Chrome to fix
- **Pattern:** Use separate localStorage keys for auto-save (`_current` key) vs committed sessions to avoid duplicates while preventing data loss
