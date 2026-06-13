const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const startTime = Date.now();

function getMemoryUsage() {
    const mem = process.memoryUsage();
    return {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(mem.external / 1024 / 1024)}MB`,
    };
}

router.get('/', (req, res) => {
    res.json({
        status: 'ok',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
    });
});

router.get('/detailed', protect, adminOnly, (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

    const health = {
        database: {
            status: dbState === 1 ? 'ok' : 'degraded',
            state: dbStates[dbState] || 'unknown',
        },
        memory: getMemoryUsage(),
        uptime: Math.round(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
    };

    const statusCode = dbState === 1 ? 200 : 503;
    res.status(statusCode).json(health);
});

module.exports = router;
