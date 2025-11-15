#!/usr/bin/env node

const { program } = require('commander');
const { connectToDb } = require('./db');

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PID_DIR = path.join(process.cwd(), '.queuectl_pids');
if (!fs.existsSync(PID_DIR)) {
  fs.mkdirSync(PID_DIR);
}

// --- Config Command ---
program
  .command('config set <key> <value>')
  .description('Set a configuration value (e.g., max-retries, backoff-base)')
  .action(async (key, value) => {
    const db = await connectToDb();
    const configCollection = db.collection('config');
    
    // Use upsert to create or update the single config document
    await configCollection.updateOne(
      { _id: 'system_config' },
      { $set: { [key]: value } }, // [key] is computed property syntax
      { upsert: true }
    );
    
    console.log(`Config updated: ${key} = ${value}`);
    process.exit(0); // Exit successfully
  });

// --- Enqueue Command ---
program
  .command('enqueue <jobJSON>')
  .description('Add a new job to the queue. <jobJSON> is a string: \'{"id":"job1","command":"sleep 2"}\'')
  .action(async (jobJSON) => {
    const db = await connectToDb();
    const config = await db.collection('config').findOne({ _id: 'system_config' });
    const jobsCollection = db.collection('jobs');

    let jobData;
    try {
      jobData = JSON.parse(jobJSON);
    } catch (e) {
      console.error('Error: Invalid JSON string.', e.message);
      process.exit(1);
    }

    const newJob = {
      _id: jobData.id, // Use user-provided ID as the primary key
      command: jobData.command,
      state: 'pending',
      attempts: 0,
      max_retries: parseInt(config?.max_retries || 3), // Get from config or default
      created_at: new Date(),
      updated_at: new Date(),
    };

    try {
      const result = await jobsCollection.insertOne(newJob);
      console.log(`Job enqueued with id: ${result.insertedId}`);
    } catch (e) {
      if (e.code === 11000) { // Duplicate key error
        console.error(`Error: A job with id "${newJob._id}" already exists.`);
      } else {
        console.error('Error enqueuing job:', e.message);
      }
    }
    process.exit(0);
  });

// --- Worker Start Command ---
program
  .command('worker start')
  .description('Start one or more worker processes')
  .option('--count <n>', 'Number of workers to start', 1)
  .action((options) => {
    const count = parseInt(options.count);
    console.log(`Starting ${count} worker(s)...`);

    for (let i = 0; i < count; i++) {
      // Start 'worker.js' as a detached background process
      const workerProcess = spawn('node', [path.join(__dirname, 'worker.js')], {
        detached: true,
        stdio: 'ignore', // 'ignore' or 'pipe' to log files
      });

      // 'unref()' allows the parent (this CLI) to exit while the child lives on
      workerProcess.unref();

      // Store the PID for 'stop' command
      const pid = workerProcess.pid.toString();
      fs.writeFileSync(path.join(PID_DIR, `worker-${pid}.pid`), pid);
      console.log(`Started worker with PID: ${pid}`);
    }
    process.exit(0);
  });

// --- Worker Stop Command ---
program
  .command('worker stop')
  .description('Stop all running worker processes gracefully')
  .action(() => {
    console.log('Stopping all workers...');
    const pidFiles = fs.readdirSync(PID_DIR).filter(f => f.endsWith('.pid'));

    if (pidFiles.length === 0) {
      console.log('No workers found to stop.');
      process.exit(0);
    }

    for (const pidFile of pidFiles) {
      const pidFilePath = path.join(PID_DIR, pidFile);
      try {
        const pid = fs.readFileSync(pidFilePath, 'utf-8');
        process.kill(pid, 'SIGTERM'); // Send graceful shutdown signal
        fs.unlinkSync(pidFilePath); // Clean up the PID file
        console.log(`Sent SIGTERM to worker ${pid}`);
      } catch (e) {
        console.warn(`Error stopping worker (file: ${pidFile}): ${e.message}. Removing stale file.`);
        fs.unlinkSync(pidFilePath); // Clean up stale file
      }
    }
    process.exit(0);
  });

  // --- Status Command ---
program
  .command('status')
  .description('Show a summary of job states and active workers')
  .action(async () => {
    const db = await connectToDb();
    const jobsCollection = db.collection('jobs');

    // 1. Get Job Counts
    const stats = await jobsCollection.aggregate([
      { $group: { _id: '$state', count: { $sum: 1 } } }
    ]).toArray();
    
    console.log('--- Job Status ---');
    if (stats.length === 0) {
      console.log('No jobs in the system.');
    } else {
      stats.forEach(s => console.log(`${s._id}: ${s.count}`));
    }

    // 2. Get Active Workers
    const pidFiles = fs.readdirSync(PID_DIR).filter(f => f.endsWith('.pid'));
    console.log('\n--- Active Workers ---');
    console.log(`Count: ${pidFiles.length}`);
    pidFiles.forEach(f => console.log(`- ${f.replace('.pid', '')}`));
    
    process.exit(0);
  });

// --- List Jobs Command ---
program
  .command('list')
  .description('List jobs by state')
  .option('--state <state>', 'Filter by state (pending, processing, etc.)', 'pending')
  .action(async (options) => {
    const db = await connectToDb();
    const jobs = await db.collection('jobs').find({ state: options.state }).toArray();

    if (jobs.length === 0) {
      console.log(`No jobs found with state: ${options.state}`);
    } else {
      console.table(jobs); // 'console.table' is great for this
    }
    process.exit(0);
  });

// --- DLQ Commands ---
program
  .command('dlq list')
  .description('List all jobs in the Dead Letter Queue (state=dead)')
  .action(async () => {
    const db = await connectToDb();
    const jobs = await db.collection('jobs').find({ state: 'dead' }).toArray();
    if (jobs.length === 0) {
      console.log('DLQ is empty.');
    } else {
      console.table(jobs);
    }
    process.exit(0);
  });

program
  .command('dlq retry <jobId>')
  .description('Retry a job from the DLQ by moving it to pending')
  .action(async (jobId) => {
    const db = await connectToTodb();
    const result = await db.collection('jobs').updateOne(
      { _id: jobId, state: 'dead' },
      { $set: { state: 'pending', attempts: 0, updated_at: new Date() } }
    );

    if (result.matchedCount === 0) {
      console.error(`Error: Job "${jobId}" not found in DLQ.`);
    } else {
      console.log(`Job "${jobId}" moved to pending queue for retry.`);
    }
    process.exit(0);
  });
// --- Main Program Execution ---
async function main() {
  await program.parseAsync(process.argv);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});