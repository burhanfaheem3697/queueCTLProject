async function refreshStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    
    // --- 1. Format Job Counts ---
    const statsEl = document.getElementById('stats');
    statsEl.innerHTML = ''; // Clear old logs
    if (data.counts.length > 0) {
      data.counts.forEach(item => {
        statsEl.innerHTML += `<div><span class="log-key">${item._id}:</span> <span class="log-value">${item.count}</span></div>`;
      });
    } else {
      statsEl.innerHTML = `<div>No jobs found.</div>`;
    }
    
    // --- 2. Format Exec Times ---
    const execEl = document.getElementById('exec');
    execEl.innerHTML = ''; // Clear old logs
    const execData = data.execStats.length > 0 ? data.execStats[0] : null;
    
    if (execData) {
      execEl.innerHTML += `<div><span class="log-key">Avg Runtime:</span> <span class="log-value">${execData.avg_runtime_ms.toFixed(2)} ms</span></div>`;
      execEl.innerHTML += `<div><span class="log-key">Max Runtime:</span> <span class="log-value">${execData.max_runtime_ms} ms</span></div>`;
      execEl.innerHTML += `<div><span class="log-key">Min Runtime:</span> <span class="log-value">${execData.min_runtime_ms} ms</span></div>`;
    } else {
      execEl.innerHTML = `<div>No completed jobs yet.</div>`;
    }
    
    // --- 3. Format Jobs Table ---
    const jobsBody = document.getElementById('jobs');
    jobsBody.innerHTML = ''; // Clear table
    
    data.recentJobs.forEach(job => {
      jobsBody.innerHTML += `
        <tr>
          <td>${job._id}</td>
          <td>${job.command}</td>
          <td class="state state-${job.state}">${job.state}</td>
          <td>${job.priority || 0}</td>
          <td>${new Date(job.updated_at).toLocaleString()}</td>
        </tr>
      `;
    });
  } catch (e) {
    console.error("Failed to fetch stats", e);
    // Ensure elements exist before trying to set innerText on error
    const statsEl = document.getElementById('stats');
    if (statsEl) {
      statsEl.innerText = "Error loading stats. Check console.";
    }
  }
}

// Set the interval to run refreshStats and also call it once immediately.
// 'defer' in the HTML script tag will run this after the page is parsed.
setInterval(refreshStats, 3000);
refreshStats(); // Initial load