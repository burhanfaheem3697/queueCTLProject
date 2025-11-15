# queuectl - A Production-Grade CLI Job Queue System

A minimal, robust background job queue system built with Node.js and MongoDB. This system manages background jobs, worker processes, retries with exponential backoff, and a Dead Letter Queue (DLQ) for failed jobs.

It includes advanced features like Job Timeouts, Priority Queues, Scheduled Jobs, and a Live Web Dashboard.

🌟 Live Demo (https://drive.google.com/file/d/1OGuSo-ymz6U58SFhl97dxsKV2jflgNMD/view?usp=drive_link)


🎯 Core Features

- Persistent Job Storage: Uses MongoDB to ensure jobs are not lost on restart.
- Concurrent Workers: Run multiple worker processes in parallel to consume jobs.
- Atomic Locking: Safely processes jobs with no race conditions or duplicates.
- Retry & Backoff: Automatically retries failed jobs using exponential backoff.
- Dead Letter Queue (DLQ): Moves permanently failed jobs to a DLQ for inspection.
- Advanced Scheduling: Includes support for job priorities, timeouts, and scheduled start times.
- Live Dashboard: A minimal web dashboard to monitor the system in real-time.

⚙️ Setup and Installation

Follow these steps to get the system running locally.


1. Clone and Install

```bash
# 1. Clone the repository
git clone <your-github-repo-url>
cd queuectl-project

# 2. Install dependencies
npm install
```

2. Environment Configuration

You must create a `.env` file in the root of the project to store your database connection string.

Create the file:

```bash
touch .env
```

Add your MongoDB connection string to it:

```ini
# .env
MONGODB_URI="mongodb://localhost:27017/queuectl"

# Example for MongoDB Atlas:
# MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/queuectl"
```

3. Make CLI Executable

On macOS or Linux, you may need to make the CLI script executable:

```bash
chmod +x queuectl.js
```

🚀 Usage Examples

All commands are run through the `queuectl.js` script.

1. Configuration

Set the default max retries and backoff base:

```bash
# Set max retries to 5 (default 3)
node ./queuectl.js config set max-retries 5

# Set exponential backoff base to 2 (default 2)
node ./queuectl.js config set backoff-base 2
```

2. Enqueueing Jobs

Use the `--id` and `--command` options.

```bash
# Enqueue a simple job
node ./queuectl.js enqueue --id "job-1" --command "echo 'Hello World'"

# Enqueue a job that will fail
node ./queuectl.js enqueue --id "job-2" --command "exit 1"

# Enqueue a long-running job
node ./queuectl.js enqueue --id "job-3" --command "sleep 10"
```

3. Enqueueing with Bonus Features

Use the optional flags for priority, scheduling, and timeouts.

```bash
# Enqueue a HIGH PRIORITY job
node ./queuectl.js enqueue --id "job-4" --command "echo 'I run first!'" --priority 10

# Enqueue a job SCHEDULED for the future
node ./queuectl.js enqueue --id "job-5" --command "echo 'Happy New Year!'" --run-at "2026-01-01T00:00:00Z"

# Enqueue a job with a 5-second TIMEOUT
node ./queuectl.js enqueue --id "job-6" --command "sleep 30" --timeout 5000
```

4. Managing Workers

```bash
# Start 4 worker processes in the background
node ./queuectl.js worker start --count 4

# Stop all running workers gracefully
node ./queuectl.js worker stop
```

5. Checking Status & Jobs

```bash
# Get a summary of all job states and active workers
node ./queuectl.js status

# List all pending jobs
node ./queuectl.js list --state pending

# List all completed jobs
node ./queuectl.js list --state completed
```

6. Dead Letter Queue (DLQ)

```bash
# List all permanently failed jobs
node ./queuectl.js dlq list

# Retry a failed job (this moves it back to 'pending')
node ./queuectl.js dlq retry "job-2"
```

7. Viewing Stats

```bash
# Show advanced metrics (avg/min/max execution time)
node ./queuectl.js stats
```

8. Running the Dashboard

Run this in its own terminal.

```bash
# Start the web dashboard
node dashboard.js

# Now, open your browser to http://localhost:3000
```

🏛️ Architecture Overview

1. Core Components

- **CLI (`queuectl.js`)**: The user interface, built with `commander.js`. It's a stateless application that sends commands to the database (e.g., enqueues a job, updates config).
- **Workers (`worker.js`)**: The "engine." These are stateful, long-running background processes (spawned via `child_process.spawn`) that constantly poll the database for jobs to execute.
- **Database (MongoDB)**: The "single source of truth." It acts as the central message broker, storing all job data, states, and configuration.

2. Job Lifecycle

A job moves through a simple state machine:

```
pending → processing → completed
```

If a job fails:

```
processing → failed (retries max_retries times with exponential backoff) → dead
```

3. Concurrency & Atomicity

The most critical problem is preventing two workers from grabbing the same job. We solve this atomically using MongoDB's `findOneAndUpdate` operation.

- A worker queries for the "best" available job (Highest priority, `run_at` in the past, `state=pending`).
- It uses `findOneAndUpdate` to find a matching job and atomically update its state to `processing` in a single operation.
- The database guarantees that only one worker will succeed in this operation. All other workers will find no job and continue polling.

This "find-and-lock" mechanism is the core of the system and prevents all race conditions.

💡 Assumptions & Trade-offs

- **MongoDB vs. Redis:** While Redis is often faster for pure queues, MongoDB was chosen for its flexibility. It allows for rich, complex queries (like for priorities and scheduled jobs) and makes storing stats and job output simple.
- **`exec` Security:** The system uses `child_process.exec` to run commands, which inherits the worker's environment. This assumes all commands are "trusted." In a multi-tenant production system, this would be a major security risk, and jobs would need to be run in a sandboxed container (e.g., Docker).
- **Worker Management:** Workers are managed by tracking their PIDs in files. This is simple but not fully robust. If the main `queuectl` process crashes, it could leave "zombie" PID files. A more production-grade system would use a process manager like PM2.
- **Retry Logic:** The retry/backoff logic is handled by any idle worker. This is efficient as it doesn't require a dedicated "retry processor." Any worker with free time will check for failed jobs that are ready to be re-queued.

🧪 Testing Instructions

To verify all core functionality, you can run the following test flow.

Open 3 terminals.

Terminal 1: The Dashboard

Start the dashboard to monitor the system live.

```bash
# Start the dashboard
node dashboard.js
# Open http://localhost:3000 in your browser
```

Terminal 2: The Workers

Start the engine.

```bash
# Start two workers in the background
node ./queuectl.js worker start --count 2
```

Terminal 3: The CLI (Job Control)

Now, use the CLI to create jobs and watch them run.

```bash
# 1. Enqueue a job that succeeds
node ./queuectl.js enqueue --id "test-success" --command "echo 'This will succeed'"

# 2. Enqueue a job that fails (it will retry 3 times and go to DLQ)
node ./queuectl.js enqueue --id "test-fail" --command "not-a-real-command"

# 3. Enqueue a high-priority job
node ./queuectl.js enqueue --id "test-priority" --command "echo 'I ran first!'" --priority 10

# 4. Check the status.
# You will see the workers process jobs in real-time.
# 'test-priority' should be processed before others.
node ./queuectl.js status

# 5. After a few seconds, check for the completed job
node ./queuectl.js list --state completed
# (You should see 'test-success' and 'test-priority')

# 6. Check the DLQ for the failed job
node ./queuectl.js dlq list
# (You should see 'test-fail')

# 7. Check the stats
node ./queuectl.js stats

# 8. Stop the workers
node ./queuectl.js worker stop
```

At the same time, you can watch the Web Dashboard update live as jobs move from pending to completed or dead.
