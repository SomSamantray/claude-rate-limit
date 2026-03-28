# Rate-Limit Status Line — Specification

## Purpose

Displays a compact real-time rate limit status bar at the bottom of Claude Code after every
assistant response. Uses Claude Code's native `statusLine` mechanism — no API calls, no token
counting, no external dependencies. All data is injected by Claude Code itself via stdin.

---

## How It Works

Claude Code sends a JSON payload via stdin to the `statusLine` script on every turn. The script
reads it, renders a one-line status bar, and prints it to stdout. Claude Code displays whatever
stdout contains in its native bottom status bar.

```
stdin JSON  →  statusline.mjs  →  stdout (status bar display)
                               →  stderr (notifications + bell, side effects only)
```

---

## Data Source

**Native Claude Code stdin JSON — no external calls needed.**

```json
{
  "rate_limits": {
    "five_hour": {
      "used_percentage": 38.0,
      "resets_at": 1743013200
    },
    "seven_day": {
      "used_percentage": 14.2,
      "resets_at": 1743448800
    }
  },
  "context_window": {
    "used_percentage": 68
  },
  "model": {
    "display_name": "Sonnet"
  }
}
```

**Important caveats:**
- `rate_limits` is only present for Pro/Max subscribers
- `rate_limits` is absent before the first API call in a session
- Each window (`five_hour`, `seven_day`) may be independently absent
- Handle all absences gracefully — never crash, always produce output

---

## Status Line Format

```
5h ████░░░░░░ 38% 🟠  7d ██░░░░░░░░ 14% 🟢  Ctx ██████░░░░ 68% 🟠  resets in 2h 14m
```

**When `rate_limits` is absent** (before first response or non-Pro):
```
5h --  7d --  Ctx ██░░░░░░░░ 20% 🟢  (waiting...)
```

### Fields

| Field | Source field | Description |
|---|---|---|
| `5h` bar + % | `rate_limits.five_hour.used_percentage` | 5-hour rolling rate limit window |
| `7d` bar + % | `rate_limits.seven_day.used_percentage` | 7-day rolling rate limit window |
| `Ctx` bar + % | `context_window.used_percentage` | Current context window fill |
| `resets in Xh Ym` | `rate_limits.five_hour.resets_at` | Countdown to next 5h window reset |

### Color Bands

Applied to both the progress bar characters and the percentage text:

| Usage | Color | ANSI code |
|---|---|---|
| < 30% | Green | `\x1b[32m` |
| 31–75% | Orange | `\x1b[33m` |
| > 75% | Red | `\x1b[31m` |

### Progress Bar

- 10 characters wide
- Filled: `█` · Empty: `░`
- Example at 38%: `████░░░░░░`

---

## Notifications

Fired as **side effects** — do not affect stdout (status bar). Output to stderr.

Fires **once per rate-limit window** — deduped by `resets_at` value, not by calendar date.
A new window (new `resets_at`) clears the fired list for that window.

### Thresholds

| Threshold | macOS Notification Title | macOS Message |
|---|---|---|
| 75% 5h used | `⚠️ Claude — 5h Rate 75%` | `Resets in Xh Ym` |
| 90% 5h used | `🔴 Claude — 5h Rate 90%` | `Running very low — resets in Xh Ym` |
| 75% 7d used | `⚠️ Claude — Weekly Rate 75%` | `7-day window at 75%` |
| ≥ 100% 5h | `🚫 Claude — Rate Limited` | `5h limit hit — resets in Xh Ym` |

### On Each Trigger

1. Terminal bell: `\a` written to stderr
2. ASCII banner printed to stderr:
   ```
   ╔═════════════════════════════════════════╗
   ║  ⚠️  5h rate limit at 75%               ║
   ║  Resets in 2h 14m                       ║
   ╚═════════════════════════════════════════╝
   ```
3. macOS desktop notification via:
   ```
   osascript -e 'display notification "Resets in 2h 14m" with title "⚠️ Claude — 5h Rate 75%"'
   ```

### Notification State File

Auto-created at `~/.claude/rate-limit-notify-state.json`:

```json
{
  "five_hour_window": 1743013200,
  "five_hour_fired": ["75", "90"],
  "seven_day_window": 1743448800,
  "seven_day_fired": []
}
```

When `five_hour_window` changes → `five_hour_fired` is cleared (new window started).
When `seven_day_window` changes → `seven_day_fired` is cleared.

---

## Registration in settings.json

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"/Users/apple/Documents/Rate-Limit/statusline.mjs\""
  }
}
```

The existing `claude-token@community` plugin is **removed** from `enabledPlugins` — it used a
Stop hook to print an inline box to stderr, which is replaced entirely by this statusLine script.

---

## File Structure

```
/Users/apple/Documents/Rate-Limit/
├── specs.md          ← this file
├── statusline.mjs    ← the statusLine script
└── README.md

~/.claude/
└── rate-limit-notify-state.json   ← auto-created at runtime, gitignored
```

---

## Error Handling

- The entire script is wrapped in a top-level try/catch
- On any error: exit 0 silently — never crash, never block Claude
- Never write to stdout on error (corrupts the status bar display)
- If `rate_limits` is absent: display `--` placeholders, skip notifications
- If notify state file is unreadable: treat as empty state (re-fire allowed)

---

## What Was NOT Used (and Why)

| Rejected approach | Reason |
|---|---|
| `GET https://api.anthropic.com/api/oauth/usage` | Documented to 429 aggressively within minutes; stays blocked 30+ min with no Retry-After header. Multiple open GitHub issues. |
| Stop hook → stderr | Not the native status bar. The claude-token plugin already did this; it's the wrong mechanism. |
| Transcript JSONL parsing | Unnecessary — `context_window.used_percentage` already in stdin JSON. |
| Local `usage.json` token counting | Unnecessary — `rate_limits.five_hour/seven_day.used_percentage` already in stdin JSON. |
| macOS Keychain OAuth token | Unnecessary — rate limit data is injected by Claude Code directly. |
