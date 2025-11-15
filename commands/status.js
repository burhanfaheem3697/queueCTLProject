const fs = require('fs');
const { getDb } = require('../db');
async function registerStatus(program, pidDir) {
  program
    .command('status')
    .description('Show a summary of job states and active workers')
    .action(async () => {
      const db = getDb();
      const jobsCollection = db.collection('jobs');

      const stats = await jobsCollection.aggregate([
        { $group: { _id: '$state', count: { $sum: 1 } } }
      ]).toArray();

      console.log('--- Job Status ---');
      if (stats.length === 0) {
        console.log('No jobs in the system.');
      } else {
        stats.forEach(s => console.log(`${s._id}: ${s.count}`));
      }

      const pidFiles = fs.readdirSync(pidDir).filter(f => f.endsWith('.pid'));
      console.log('\n--- Active Workers ---');
      console.log(`Count: ${pidFiles.length}`);
      pidFiles.forEach(f => console.log(`- ${f.replace('.pid', '')}`));

      process.exit(0);
    });
}

module.exports = { registerStatus };
