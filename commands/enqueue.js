const { getDb } = require('../db');
async function registerEnqueue(program) {
  program
    .command('enqueue')
    .description('Add a new job to the queue')
    .requiredOption('-i, --id <id>', 'The unique job ID')
    .requiredOption('-c, --command <command>', 'The command to execute')
    .option('--timeout <ms>', 'Job timeout in milliseconds', '30000')
    .option('-p, --priority <number>', 'Job priority (higher is sooner)', 0)
    .option('--run-at <datetime>', 'Schedule job for a future ISO datetime (e.g., 2025-12-25T09:00:00Z)')
    .action(async (options) => {
      const db = getDb();
      const config = await db.collection('config').findOne({ _id: 'system_config' });
      const jobsCollection = db.collection('jobs');

      const newJob = {
        _id: options.id,
        command: options.command,
        job_timeout: parseInt(options.timeout),
        priority: parseInt(options.priority), // <-- Add this
        run_at: options.runAt ? new Date(options.runAt) : null,
        state: 'pending',
        attempts: 0,
        max_retries: parseInt(config?.max_retries || 3),
        created_at: new Date(),
        updated_at: new Date(),
      };

      try {
        const result = await jobsCollection.insertOne(newJob);
        console.log(`Job enqueued with id: ${result.insertedId}`);
      } catch (e) {
        if (e.code === 11000) {
          console.error(`Error: A job with id "${newJob._id}" already exists.`);
        } else {
          console.error('Error enqueuing job:', e.message);
        }
      }
      process.exit(0);
    });
}

module.exports = { registerEnqueue };
