# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Claude Code native status bar plugin that displays real-time rate limit usage after every assistant response. Uses Claude Code's `statusLine` mechanism — no API calls, no token counting, no external dependencies.

## Architecture

```
stdin JSON (injected by Claude Code)  →  statusline.mjs  →  stdout (status bar)
                                                          →  stderr (notifications + bell)
```

The script is invoked by Claude Code on every turn via `~/.claude/settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "node \"/Users/apple/Documents/Rate-Limit/statusline.mjs\""
}
```

## Files

- `specs.md` — Full specification: data source, format, color bands, notifications, state schema
- `statusline.mjs` — The statusLine script (ES module, Node.js)
- `~/.claude/rate-limit-notify-state.json` — Auto-created at runtime; tracks notification dedup state

## Key Constraints

- **stdin JSON** is the sole data source — never make API calls or read local files for rate data
- **`rate_limits` may be absent** (non-Pro users, before first API call) — show `--` placeholders, never crash
- **stdout only** for the status bar — never write errors to stdout (corrupts the display)
- **Entire script wrapped in try/catch** — exit 0 silently on any error
- **Notifications deduped by `resets_at`** (Unix epoch), not by calendar date — cleared when window changes

## Status Line Format

```
5h ████░░░░░░ 38% 🟠  7d ██░░░░░░░░ 14% 🟢  Ctx ██████░░░░ 68% 🟠  resets in 2h 14m
```

Color bands: `\x1b[32m` green < 30% · `\x1b[33m` orange 31–75% · `\x1b[31m` red > 75%

## Testing

```bash
# Normal data
echo '{"rate_limits":{"five_hour":{"used_percentage":38,"resets_at":1743020000},"seven_day":{"used_percentage":14,"resets_at":1743448800}},"context_window":{"used_percentage":68},"model":{"display_name":"Sonnet"}}' | node /Users/apple/Documents/Rate-Limit/statusline.mjs

# Absent rate_limits (non-Pro / first turn)
echo '{"context_window":{"used_percentage":20},"model":{"display_name":"Sonnet"}}' | node /Users/apple/Documents/Rate-Limit/statusline.mjs

# Notification trigger (76% → fires 75% threshold)
echo '{"rate_limits":{"five_hour":{"used_percentage":76,"resets_at":1743020000},"seven_day":{"used_percentage":20,"resets_at":1743448800}},"context_window":{"used_percentage":10},"model":{"display_name":"Sonnet"}}' | node /Users/apple/Documents/Rate-Limit/statusline.mjs
```
