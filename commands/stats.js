const { getDb } = require('../db');
async function registerStats(program) {
  program
    .command('stats')
    .description('Show advanced execution stats')
    .action(async () => {
      const db = getDb();
      const jobs = db.collection('jobs');

      // 1. Get basic counts (like 'status' command)
      const counts = await jobs.aggregate([
        { $group: { _id: '$state', count: { $sum: 1 } } },
      ]).toArray();

      console.log('--- Job Counts ---');
      console.table(counts);

      // 2. Get execution time stats for completed jobs
      const execStats = await jobs.aggregate([
        { $match: { state: 'completed', processing_at: { $exists: true } } },
        { $project: {
            runtime_ms: { $subtract: ["$completed_at", "$processing_at"] }
          }
        },
        { $group: {
            _id: null,
            avg_runtime_ms: { $avg: "$runtime_ms" },
            max_runtime_ms: { $max: "$runtime_ms" },
            min_runtime_ms: { $min: "$runtime_ms" }
          }
        }
      ]).toArray();

      console.log('\n--- Execution Stats (Completed Jobs) ---');
      if (execStats.length > 0 && execStats[0].avg_runtime_ms != null) {
        const s = execStats[0];
        console.table([{
          'Avg Runtime': `${s.avg_runtime_ms.toFixed(2)} ms`,
          'Min Runtime': `${s.min_runtime_ms} ms`,
          'Max Runtime': `${s.max_runtime_ms} ms`
        }]);
      } else {
        console.log('No completed jobs with stats yet.');
      }

      process.exit(0);
    });
}

module.exports = { registerStats };
