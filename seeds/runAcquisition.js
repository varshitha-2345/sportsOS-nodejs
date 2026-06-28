#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Pipeline = require('./discovery/pipeline');
const config = require('./discovery/config');

async function main() {
    console.log('SportsOS Data Acquisition System');
    console.log('================================\n');

    // Validate environment (API keys required only in non-dry-run mode)
    const required = ['MONGO_URI'];
    if (!config.acquisition.dryRun) {
        required.push('GEMINI_API_KEY', 'FIRECRAWL_API_KEY');
    }
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('Missing required environment variables:');
        missing.forEach(key => console.error(`  - ${key}`));
        console.error('\nPlease set these in your .env file or environment.');
        process.exit(1);
    }

    // Run pipeline
    const pipeline = new Pipeline();
    await pipeline.run();
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
