#!/usr/bin/env node
/**
 * Starts Next.js dev server on port 3000.
 * - Requires Node >= 20.9
 * - Removes stale .next/dev/lock from crashed sessions
 * - If dev is already running, prints the URL instead of failing
 */

import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

const MIN_NODE = [20, 9, 0];
const PORT = 3000;
const lockPath = join(process.cwd(), '.next/dev/lock');

function parseNodeVersion() {
  const parts = process.version.replace(/^v/, '').split('.').map(Number);
  return { major: parts[0] ?? 0, minor: parts[1] ?? 0, patch: parts[2] ?? 0 };
}

function nodeVersionOk() {
  const v = parseNodeVersion();
  if (v.major > MIN_NODE[0]) return true;
  if (v.major < MIN_NODE[0]) return false;
  if (v.minor > MIN_NODE[1]) return true;
  if (v.minor < MIN_NODE[1]) return false;
  return v.patch >= MIN_NODE[2];
}

function isPidRunning(pid) {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLock() {
  if (!existsSync(lockPath)) return null;
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

function removeStaleLock() {
  const lock = readLock();
  if (!lock) return null;
  if (isPidRunning(lock.pid)) return lock;
  try {
    unlinkSync(lockPath);
    console.log('Removed stale Next.js dev lock.');
  } catch {
    /* ignore */
  }
  return null;
}

function printNodeHelp() {
  const v = process.version;
  console.error(`\nNode ${v} is too old. Next.js requires Node >= 20.9.0.\n`);
  console.error('From Garbo_web_dashboard/, run:\n');
  console.error('  nvm use 20');
  console.error('  npm run dev\n');
  console.error('If nvm is not installed: https://github.com/nvm-sh/nvm\n');
}

function startNext() {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'dev', '--webpack', '-p', String(PORT)],
    { stdio: 'inherit', env: process.env, cwd: process.cwd() }
  );
  child.on('exit', (code) => process.exit(code ?? 0));
}

if (!nodeVersionOk()) {
  printNodeHelp();
  process.exit(1);
}

const activeLock = removeStaleLock();
if (activeLock?.pid && isPidRunning(activeLock.pid)) {
  const url = activeLock.appUrl || `http://localhost:${activeLock.port || PORT}`;
  console.log(`Dev server is already running at ${url}`);
  console.log(`Stop it with: npm run stop:dev`);
  process.exit(0);
}

startNext();
