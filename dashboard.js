// dashboard.js
const express = require('express');
const path = require('path');
const { getDb, connectToDb } = require('./db');
const app = express();
const port = 3000;

let db;


app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/stats', async (req, res) => {
  try {
    const jobs = db.collection('jobs');

    // Get counts
    const counts = await jobs.aggregate([
      { $group: { _id: '$state', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();


    // Get execution stats
    const execStats = await jobs.aggregate([
      { $match: { state: 'completed', processing_at: { $exists: true } } },
      { $project: { runtime_ms: { $subtract: ["$completed_at", "$processing_at"] } } },
      { $group: {
          _id: null,
          avg_runtime_ms: { $avg: "$runtime_ms" },
          max_runtime_ms: { $max: "$runtime_ms" },
          min_runtime_ms: { $min: "$runtime_ms" }
        }
      }
    ]).toArray();
    
    // Get recent 10 jobs
    const recentJobs = await jobs.find()
      .sort({ updated_at: -1 })
      .limit(10)
      .toArray();

    res.json({ counts, execStats, recentJobs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start the server
app.listen(port, async () => {
  db = await connectToDb();
  console.log(`Dashboard running at http://localhost:${port}`);
});