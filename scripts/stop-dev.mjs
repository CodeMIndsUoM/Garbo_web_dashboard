#!/usr/bin/env node
/** Stops the Next.js dev server started from this project (port 3000). */

import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const lockPath = join(process.cwd(), '.next/dev/lock');

function isPidRunning(pid) {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

let lock = null;
if (existsSync(lockPath)) {
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    /* ignore */
  }
}

if (lock?.pid && isPidRunning(lock.pid)) {
  try {
    process.kill(lock.pid, 'SIGTERM');
    console.log(`Stopped dev server (PID ${lock.pid}).`);
  } catch (err) {
    console.error(`Could not stop PID ${lock.pid}:`, err.message);
    process.exit(1);
  }
} else {
  console.log('No running dev server found for this project.');
}

if (existsSync(lockPath)) {
  try {
    unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}
