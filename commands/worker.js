const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function registerWorker(program, pidDir) {
  const worker = program.command('worker').description('Manage worker processes');

  worker
    .command('start')
    .description('Start one or more worker processes')
    .option('--count <n>', 'Number of workers to start', 1)
    .action((options) => {
      const count = parseInt(options.count);
      console.log(`Starting ${count} worker(s)...`);

      for (let i = 0; i < count; i++) {
        const workerProcess = spawn('node', [path.join(__dirname, '..', 'worker.js')], {
          detached: true,
          stdio: 'ignore',
        });

        workerProcess.unref();

        const pid = workerProcess.pid.toString();
        fs.writeFileSync(path.join(pidDir, `worker-${pid}.pid`), pid);
        console.log(`Started worker with PID: ${pid}`);
      }
      process.exit(0);
    });

  worker
    .command('stop')
    .description('Stop all running worker processes gracefully')
    .action(() => {
      console.log('Stopping all workers...');
      const pidFiles = fs.readdirSync(pidDir).filter(f => f.endsWith('.pid'));

      if (pidFiles.length === 0) {
        console.log('No workers found to stop.');
        process.exit(0);
      }

      for (const pidFile of pidFiles) {
        const pidFilePath = path.join(pidDir, pidFile);
        try {
          const pid = fs.readFileSync(pidFilePath, 'utf-8');
          process.kill(pid, 'SIGTERM');
          fs.unlinkSync(pidFilePath);
          console.log(`Sent SIGTERM to worker ${pid}`);
        } catch (e) {
          console.warn(`Error stopping worker (file: ${pidFile}): ${e.message}. Removing stale file.`);
          try { fs.unlinkSync(pidFilePath); } catch(_){}
        }
      }
      process.exit(0);
    });
}

module.exports = { registerWorker };
