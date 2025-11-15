// worker.js
const { connectToDb } = require('./db');
const util = require('util');
const exec = util.promisify(require('child_process').exec); // Promisify exec

let db;

// --- Job Execution Logic ---
async function executeJob(job) {
  const jobsCollection = db.collection('jobs');
  console.log(`[Worker] Executing job: ${job._id} (Command: ${job.command})`);

  try {
    // 1. Execute the command
    const { stdout, stderr } = await exec(job.command);

    // 2. Handle Success
    console.log(`[Worker] Job ${job._id} completed successfully.`);
    await jobsCollection.updateOne(
      { _id: job._id },
      { $set: { state: 'completed', output: stdout, updated_at: new Date() } }
    );

  } catch (error) {
    // 3. Handle Failure
    console.warn(`[Worker] Job ${job._id} failed. Attempt ${job.attempts + 1}`);
    const config = await db.collection('config').findOne({ _id: 'system_config' });
    const maxRetries = parseInt(config?.max_retries || 3);
    
    if (job.attempts + 1 >= maxRetries) {
      // 4. Move to DLQ (Dead Letter Queue)
      console.error(`[Worker] Job ${job._id} moved to DLQ after ${maxRetries} attempts.`);
      await jobsCollection.updateOne(
        { _id: job._id },
        { 
          $set: { state: 'dead', output: error.stderr || error.message, updated_at: new Date() },
          $inc: { attempts: 1 }
        }
      );
    } else {
      // 5. Mark for retry
      await jobsCollection.updateOne(
        { _id: job._id },
        { 
          $set: { state: 'failed', output: error.stderr || error.message, updated_at: new Date() },
          $inc: { attempts: 1 } 
        }
      );
    }
  }
}

// --- Atomic Job Fetching (The Concurrency Solution) ---
async function findAndLockJob() {
  const jobsCollection = db.collection('jobs');
  
  // This is the atomic "find and lock" operation
  const result = await jobsCollection.findOneAndUpdate(
    { state: "pending" }, // Find a pending job
    { $set: { state: "processing", updated_at: new Date() } }, // Lock it
    { returnDocument: "after" } // Return the *updated* document
  );

  return result.value; // 'value' contains the job, or null if no job was found
}

// --- Retry Logic (Exponential Backoff) ---
async function requeueFailedJobs() {
  const jobsCollection = db.collection('jobs');
  const config = await db.collection('config').findOne({ _id: 'system_config' });
  const backoffBase = parseInt(config?.backoff_base || 2);
  const now = new Date();

  // Find all failed jobs
  const failedJobs = await jobsCollection.find({ state: 'failed' }).toArray();

  for (const job of failedJobs) {
    // Calculate exponential backoff: delay = base ^ attempts (in seconds)
    const delay = (backoffBase ** job.attempts) * 1000; // in milliseconds
    const retryTime = new Date(job.updated_at.getTime() + delay);

    if (now >= retryTime) {
      // It's time to retry, put it back in 'pending'
      console.log(`[Worker] Re-queuing job ${job._id} for retry.`);
      await jobsCollection.updateOne(
        { _id: job._id, state: 'failed' }, // Check state again for safety
        { $set: { state: 'pending' } }
      );
    }
  }
}

// --- Main Worker Loop ---
async function startWorker() {
  db = await connectToDb();
  console.log('[Worker] Worker process started.');
  
  let isShuttingDown = false;
  process.on('SIGTERM', () => {
    console.log('[Worker] Received SIGTERM. Shutting down gracefully...');
    isShuttingDown = true;
  });

  while (!isShuttingDown) {
    const job = await findAndLockJob();

    if (job) {
      await executeJob(job); // We have a job, process it
    } else {
      // No pending jobs, check for failed jobs to retry
      await requeueFailedJobs();
      // Sleep for a bit to prevent busy-looping
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('[Worker] Worker process stopped.');
  process.exit(0);
}

startWorker();