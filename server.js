/**
 * AetherCache Core Backend API Server
 * Configures Express REST endpoints for prompt auditing,
 * secure API key encryption, and live keep-warm cache telemetry pings.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const cryptoUtils = require('./cryptoUtils');
const promptOptimizer = require('./promptOptimizer');
const pingExecutor = require('./pingExecutor');

const app = express();
const PORT = process.env.PORT || 3000;

// Secure master key fallback if no .env is configured locally
const MASTER_SECRET = process.env.ENCRYPTION_SECRET || 'aethercache_default_super_secret_master_key_2026';

app.use(cors());
app.use(express.json());

// Logger middleware for tracking local execution
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        engine: 'AetherCache REST Server v1.0',
        masterSecretSource: process.env.ENCRYPTION_SECRET ? 'Environment File' : 'Default Secure Fallback'
    });
});

/**
 * 1. Prompt Optimization Auditing Endpoint
 * POST /api/optimize
 * Ingests raw unoptimized prompt, analyzes dynamic variables,
 * estimates tokens, and generates caching refactoring layouts.
 */
app.post('/api/optimize', (req, res) => {
    const { promptText } = req.body;

    if (!promptText) {
        return res.status(400).json({ error: 'Field "promptText" is required' });
    }

    try {
        const result = promptOptimizer.optimizePrompt(promptText);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Audit Failed: ' + err.message });
    }
});

/**
 * 2. Secure API Key Encryption Endpoint
 * POST /api/keys/encrypt
 * Securely encrypts plain text developer keys using AES-256-GCM.
 */
app.post('/api/keys/encrypt', (req, res) => {
    const { apiKey } = req.body;

    if (!apiKey) {
        return res.status(400).json({ error: 'Field "apiKey" is required' });
    }

    try {
        const encrypted = cryptoUtils.encrypt(apiKey, MASTER_SECRET);
        res.json({
            success: true,
            encryptedKey: encrypted,
            obfuscatedPreview: apiKey.substring(0, 7) + '...' + apiKey.substring(apiKey.length - 4),
            description: 'Key successfully encrypted with AES-256-GCM. Safe for database insertion.'
        });
    } catch (err) {
        res.status(500).json({ error: 'Encryption Failed: ' + err.message });
    }
});

/**
 * 3. Live Cache Keep-Warm Telemetry Ping
 * POST /api/ping/run
 * Fires a live caching-indexed query to Anthropic or OpenAI.
 * Handles both encrypted keys and raw keys for developer testing.
 */
app.post('/api/ping/run', async (req, res) => {
    let { apiKey, provider, model, staticPrompt, isEncrypted } = req.body;

    if (!apiKey || !provider || !model || !staticPrompt) {
        return res.status(400).json({ error: 'Missing parameters: apiKey, provider, model, and staticPrompt are required.' });
    }

    try {
        let decryptedKey = apiKey;

        // If the key is flagged as an encrypted string from the database, decrypt it first
        if (isEncrypted === true || apiKey.split(':').length === 4) {
            decryptedKey = cryptoUtils.decrypt(apiKey, MASTER_SECRET);
        }

        const log = await pingExecutor.executePing(decryptedKey, provider, model, staticPrompt);
        
        if (log.success) {
            res.json(log);
        } else {
            res.status(500).json(log);
        }

    } catch (err) {
        res.status(500).json({ success: false, error: 'Ping Failed: ' + err.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`🚀 AetherCache Functional Backend Server running on port ${PORT}`);
    console.log(`🔐 AES-256-GCM Security Engine Initialized`);
    console.log(`🔗 Connect frontend to: http://localhost:${PORT}`);
    console.log(`================================================================`);
});
