
const { getDb } = require('../db');
async function registerList(program) {
  program
    .command('list')
    .description('List jobs by state')
    .option('--state <state>', 'Filter by state (pending, processing, etc.)', 'pending')
    .action(async (options) => {
      const db = getDb();
      const jobs = await db.collection('jobs').find({ state: options.state }).toArray();
      if (jobs.length === 0) {
        console.log(`No jobs found with state: ${options.state}`);
      } else {
        console.table(jobs);
      }
      process.exit(0);
    });
}

module.exports = { registerList };
