#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { registerConfig } = require('./commands/config');
const { registerEnqueue } = require('./commands/enqueue');
const { registerWorker } = require('./commands/worker');
const { registerStatus } = require('./commands/status');
const { registerList } = require('./commands/list');
const { registerDlq } = require('./commands/dlq');
const { registerStats } = require('./commands/stats');
const { connectToDb } = require('./db');

const PID_DIR = path.join(process.cwd(), '.queuectl_pids');
if (!fs.existsSync(PID_DIR)) {
  fs.mkdirSync(PID_DIR);
}

// Register commands (modularized)
registerConfig(program);
registerEnqueue(program);
registerWorker(program, PID_DIR);
registerStatus(program, PID_DIR);
registerList(program);
registerDlq(program);
registerStats(program);

// --- Main Program Execution ---

async function main() {
  const db = await connectToDb();

  await program.parseAsync(process.argv);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});