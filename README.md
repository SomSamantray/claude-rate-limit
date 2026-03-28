# claude-rate-limit

Native rate-limit status bar for Claude Code. Shows your 5-hour and 7-day usage, context window fill, and countdown to reset — directly in the bottom status bar after every response.

```
5h ████░░░░░░ 38% 🟠  7d ██░░░░░░░░ 14% 🟢  Ctx ██████░░░░ 68% 🟠  resets in 2h 14m
```

Also fires macOS desktop notifications + terminal bell at 75%, 90%, and 100% thresholds.

## Install

```bash
npx claude-rate-limit
```

Restart Claude Code. Done.

## Requirements

- Node.js 18+
- Claude Code with a **Pro or Max** subscription (rate limit data is only injected for paid plans)
- macOS (for desktop notifications — the status bar works on any OS)

## What it shows

| Field | Description |
|---|---|
| `5h` | 5-hour rolling rate limit — usage % + progress bar |
| `7d` | 7-day rolling rate limit — usage % + progress bar |
| `Ctx` | Context window fill — how full the current session is |
| `resets in` | Countdown to the next 5h window reset |

**Color bands:** green < 30% · orange 31–75% · red > 75%

**Before the first API call** (or on non-Pro plans), rate limit data isn't available yet:
```
5h --  7d --  Ctx ██░░░░░░░░ 20% 🟢  (waiting...)
```

## Notifications

Fires once per rate-limit window (not per day):

| Threshold | Notification |
|---|---|
| 75% 5h | `⚠️ Claude — 5h Rate 75%` |
| 90% 5h | `🔴 Claude — 5h Rate 90%` |
| 75% 7d | `⚠️ Claude — Weekly Rate 75%` |
| 100% 5h | `🚫 Claude — Rate Limited` |

## How it works

Claude Code injects rate limit data as JSON via stdin to any script registered under `statusLine` in `~/.claude/settings.json`. This package installs `statusline.mjs` and registers it — no API calls, no token counting, no external dependencies.

## Uninstall

Remove the `statusLine` key from `~/.claude/settings.json` and delete `~/.claude/rate-limit-statusline/`.
