const { getDb } = require('../db');
async function registerDlq(program) {
  const dlq = program.command('dlq').description('Manage the Dead Letter Queue (DLQ)');

  dlq
    .command('list')
    .description('List all jobs in the Dead Letter Queue (state=dead)')
    .action(async () => {
      const db = getDb();
      const jobs = await db.collection('jobs').find({ state: 'dead' }).toArray();
      if (jobs.length === 0) {
        console.log('DLQ is empty.');
      } else {
        console.table(jobs);
      }
      process.exit(0);
    });

  dlq
    .command('retry <jobId>')
    .description('Retry a job from the DLQ by moving it to pending')
    .action(async (jobId) => {
      const db = getDb();
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
}

module.exports = { registerDlq };
