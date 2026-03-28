#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const RESET  = '\x1b[0m';

const STATE_FILE = join(homedir(), '.claude', 'rate-limit-notify-state.json');

function color(pct) {
  return pct < 30 ? GREEN : pct <= 75 ? YELLOW : RED;
}

function bar(pct) {
  const filled = pct == null ? 0 : Math.min(10, Math.round((pct / 100) * 10));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function emoji(pct) {
  return pct < 30 ? '🟢' : pct <= 75 ? '🟠' : '🔴';
}

function resetIn(epochSec) {
  const secs = epochSec - Math.floor(Date.now() / 1000);
  if (secs <= 0) return 'now';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function renderField(label, pct) {
  if (pct == null) return `${label} --`;
  const c = color(pct);
  return `${label} ${c}${bar(pct)} ${pct.toFixed(0)}%${RESET} ${emoji(pct)}`;
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { five_hour_window: null, five_hour_fired: [], seven_day_window: null, seven_day_fired: [] };
  }
}

function saveState(state) {
  try { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch { /* ignore */ }
}

function notify(title, message) {
  process.stderr.write('\a');
  const width = 43;
  const line1 = `  ${title}`;
  const line2 = `  ${message}`;
  const pad = (s) => s.padEnd(width);
  process.stderr.write(
    `\n╔${'═'.repeat(width)}╗\n` +
    `║${pad(line1)}║\n` +
    `║${pad(line2)}║\n` +
    `╚${'═'.repeat(width)}╝\n`
  );
  spawnSync('osascript', ['-e', `display notification "${message}" with title "${title}"`]);
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const data = JSON.parse(Buffer.concat(chunks).toString());

  const fiveHPct   = data.rate_limits?.five_hour?.used_percentage  ?? null;
  const sevenDPct  = data.rate_limits?.seven_day?.used_percentage  ?? null;
  const fiveHReset = data.rate_limits?.five_hour?.resets_at        ?? null;
  const sevenDReset= data.rate_limits?.seven_day?.resets_at        ?? null;
  const ctxPct     = data.context_window?.used_percentage          ?? null;

  // Build status line
  const fiveHField  = renderField('5h', fiveHPct);
  const sevenDField = renderField('7d', sevenDPct);
  const ctxField    = renderField('Ctx', ctxPct);

  let suffix = '';
  if (fiveHReset != null) {
    suffix = `  resets in ${resetIn(fiveHReset)}`;
  } else if (fiveHPct == null) {
    suffix = '  (waiting...)';
  }

  process.stdout.write(`${fiveHField}  ${sevenDField}  ${ctxField}${suffix}\n`);

  // Notifications — only when rate_limits present
  if (fiveHPct == null && sevenDPct == null) return;

  const state = loadState();
  let changed = false;

  // Reset fired lists when window changes
  if (fiveHReset != null && state.five_hour_window !== fiveHReset) {
    state.five_hour_window = fiveHReset;
    state.five_hour_fired = [];
    changed = true;
  }
  if (sevenDReset != null && state.seven_day_window !== sevenDReset) {
    state.seven_day_window = sevenDReset;
    state.seven_day_fired = [];
    changed = true;
  }

  const resetStr = fiveHReset != null ? resetIn(fiveHReset) : '?';

  // 5h thresholds
  if (fiveHPct != null) {
    if (fiveHPct >= 100 && !state.five_hour_fired.includes('100')) {
      notify('🚫 Claude — Rate Limited', `5h limit hit — resets in ${resetStr}`);
      state.five_hour_fired.push('100');
      changed = true;
    } else if (fiveHPct >= 90 && !state.five_hour_fired.includes('90')) {
      notify('🔴 Claude — 5h Rate 90%', `Running very low — resets in ${resetStr}`);
      state.five_hour_fired.push('90');
      changed = true;
    } else if (fiveHPct >= 75 && !state.five_hour_fired.includes('75')) {
      notify('⚠️ Claude — 5h Rate 75%', `Resets in ${resetStr}`);
      state.five_hour_fired.push('75');
      changed = true;
    }
  }

  // 7d threshold
  if (sevenDPct != null && sevenDPct >= 75 && !state.seven_day_fired.includes('75')) {
    notify('⚠️ Claude — Weekly Rate 75%', '7-day window at 75%');
    state.seven_day_fired.push('75');
    changed = true;
  }

  if (changed) saveState(state);
}

try {
  await main();
} catch {
  process.exit(0);
}
