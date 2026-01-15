# Hormozi Focus Timer

A 15-minute interval focus timer inspired by Alex Hormozi's productivity method. Tracks your time across three categories (PROMOTE, BUILD, DELIVER) and auto-saves to daily markdown files.

## Features

- **15-minute countdown intervals** with sound notifications
- **Countdown or Count-up mode** - toggle between watching time tick down or accumulate
- **Category tracking** - PROMOTE, BUILD, DELIVER (Hormozi's value stack)
- **Voice/keyboard control** - Say or type P, B, D to switch categories
- **Auto-save** - Sessions automatically save to daily tracker files
- **Weekly summary** - View your stats with category breakdowns
- **Browser notifications** - Get alerts even when tab is minimized
- **6 sound options** - Chime, Bell, Gong, Pulse, Alarm, Soft Tone

## Quick Start

1. **Start the server** (required for auto-save):
   ```bash
   cd "Time Tracker/Hormozi-Focus-Timer"
   node server.js
   ```

2. **Open the timer**:
   - Double-click `timer.html` or open it in your browser
   - You should see a green dot indicating the server is connected

3. **Start focusing**:
   - Select a category (PROMOTE/BUILD/DELIVER)
   - Type what you're working on
   - Press START or hit Space

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Start / Pause |
| P | Select PROMOTE |
| B | Select BUILD |
| D | Select DELIVER |
| R | Reset (saves session) |
| W | Show weekly summary |
| Esc | Close modal |

## Voice Control

Click in the task input field and say:
- "Promote" or "P" - switches to PROMOTE
- "Build" or "B" - switches to BUILD
- "Deliver" or "D" - switches to DELIVER

## File Structure

```
Time Tracker/
├── Hormozi-Focus-Timer/
│   ├── timer.html      # The timer interface
│   ├── server.js       # Auto-save server
│   └── README.md       # This file
├── 2026-01-15-Thursday.md  # Daily tracker files (auto-created)
├── WEEKLY-SUMMARY.md       # Weekly summary (auto-generated)
└── MASTER-FRAMEWORK.md     # Your productivity framework
```

## How It Works

1. **Timer runs in browser** - All UI and timing logic
2. **Server saves data** - Node.js server writes to markdown files
3. **Daily files** - Each day gets its own tracker file
4. **Weekly rollup** - Server aggregates last 7 days for summary

## Categories (Hormozi Value Stack)

| Category | Description |
|----------|-------------|
| **PROMOTE** | Revenue-generating activities - outreach, content, ads |
| **BUILD** | Improve your offer - product, systems, skills |
| **DELIVER** | Fulfill for clients - work, communication, results |

## Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ping` | GET | Check server status |
| `/save` | POST | Save a session |
| `/weekly` | GET | Generate weekly summary |

## Requirements

- Node.js (any recent version)
- Modern web browser (Chrome, Safari, Firefox, Edge)

## Tips

- Keep the server running while you work
- Hit RESET when you finish a focus block to save
- Check weekly summary to see your category balance
- Aim for 80% of time in Q2 activities (Important, Not Urgent)

---

*Inspired by Alex Hormozi's productivity methods and the Eisenhower Matrix.*
