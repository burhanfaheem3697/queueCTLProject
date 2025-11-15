
const { getDb } = require('../db');

async function registerConfig(program) {
    const config = program.command('config')
        .description('Manage system configuration');
    config
        .command('set <key> <value>')
        .description('Set a configuration value (e.g., max-retries, backoff-base)')
        .action(async (key, value) => {
            const db = getDb();
            const configCollection = db.collection('config');
            await configCollection.updateOne(
                { _id: 'system_config' },
                { $set: { [key]: value } },
                { upsert: true }
            );
            process.exit(0);
        });
}

module.exports = { registerConfig };
