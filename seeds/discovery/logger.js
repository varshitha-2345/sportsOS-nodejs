const fs = require('fs');
const path = require('path');

class AcquisitionLogger {
    constructor(runId) {
        this.runId = runId || `run_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
        this.logDir = path.join(__dirname, '..', 'logs');
        this.logFile = path.join(this.logDir, `acquisition-${this.runId}.json`);
        this.stats = {
            discovered: 0,
            verified: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            duplicates: 0,
            failed: 0,
        };
        this.records = [];
        this.startTime = new Date();

        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const entry = { timestamp, message, ...data };
        if (process.env.VERBOSE === 'true') {
            console.log(`[${timestamp}] ${message}`, data ? JSON.stringify(data) : '');
        }
        this.records.push(entry);
    }

    incrementStat(stat, count = 1) {
        if (this.stats[stat] !== undefined) {
            this.stats[stat] += count;
        }
    }

    addRecord(record) {
        this.records.push({
            timestamp: new Date().toISOString(),
            ...record,
        });
    }

    getSummary() {
        return {
            runId: this.runId,
            startTime: this.startTime.toISOString(),
            endTime: new Date().toISOString(),
            durationMs: Date.now() - this.startTime.getTime(),
            stats: { ...this.stats },
            totalProcessed: this.stats.discovered,
        };
    }

    writeLog() {
        const summary = this.getSummary();
        const logData = {
            summary,
            records: this.records,
        };
        fs.writeFileSync(this.logFile, JSON.stringify(logData, null, 2));
        console.log('\n=== ACQUISITION SUMMARY ===');
        console.log(`Run ID: ${summary.runId}`);
        console.log(`Duration: ${(summary.durationMs / 1000).toFixed(1)}s`);
        console.log(`Discovered: ${summary.stats.discovered}`);
        console.log(`Verified: ${summary.stats.verified}`);
        console.log(`Inserted: ${summary.stats.inserted}`);
        console.log(`Updated: ${summary.stats.updated}`);
        console.log(`Skipped: ${summary.stats.skipped}`);
        console.log(`Duplicates: ${summary.stats.duplicates}`);
        console.log(`Failed: ${summary.stats.failed}`);
        console.log(`Log file: ${this.logFile}`);
        console.log('===========================\n');
        return summary;
    }
}

module.exports = AcquisitionLogger;
