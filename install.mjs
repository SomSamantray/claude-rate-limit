#!/usr/bin/env node
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_DIR = join(homedir(), '.claude');
const INSTALL_DIR = join(CLAUDE_DIR, 'rate-limit-statusline');
const SETTINGS_FILE = join(CLAUDE_DIR, 'settings.json');
const SCRIPT_DEST = join(INSTALL_DIR, 'statusline.mjs');

// 1. Create install directory
mkdirSync(INSTALL_DIR, { recursive: true });

// 2. Copy statusline.mjs
copyFileSync(join(__dirname, 'statusline.mjs'), SCRIPT_DEST);

// 3. Read existing settings.json (or start fresh)
let settings = {};
if (existsSync(SETTINGS_FILE)) {
  try { settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')); } catch { /* start fresh */ }
}

// 4. Inject statusLine config
settings.statusLine = {
  type: 'command',
  command: `node "${SCRIPT_DEST}"`
};

// 5. Write back
writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n');

console.log('');
console.log('✅ claude-rate-limit installed!');
console.log('');
console.log(`   Script  → ${SCRIPT_DEST}`);
console.log(`   Config  → ${SETTINGS_FILE} (statusLine added)`);
console.log('');
console.log('   Restart Claude Code to activate the status bar.');
console.log('');
