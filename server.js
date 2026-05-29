/* ==========================================================================
   AetherCache B2B Backend — High-Fidelity Local Edge Proxy & AetherPing Gateway
   ========================================================================== */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and parse JSON payloads
app.use(cors());
app.use(express.json());

// Serve Static Frontend assets directly
app.use(express.static(__dirname));

// In-Memory Key Vault Simulation (Zero permanent storage)
const keyVault = new Map();
let aetherPingInterval = null;

// Helper to log glowing terminal highlights
function logEvent(type, message, status = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    let prefix = '\x1b[36m[AetherCache Info]\x1b[0m';
    if (status === 'success') prefix = '\x1b[32m[AetherPing 🟢 Warm]\x1b[0m';
    if (status === 'error') prefix = '\x1b[31m[AetherPing 🔴 Cold]\x1b[0m';
    if (status === 'vault') prefix = '\x1b[35m[AetherVault 🔒 Secure]\x1b[0m';

    console.log(`${prefix} [${timestamp}] ${message}`);
}

// 1. Vault Sync API Endpoint — AES-256 BYOK Emulation
app.post('/api/v1/key/vault', (req, res) => {
    const { key, email, model, protectionActive } = req.body;

    if (!key || !email || !model) {
        return res.status(400).json({ error: 'Missing configuration parameters.' });
    }

    const uniqueHash = Buffer.from(email).toString('base64').substring(0, 8).toLowerCase();
    
    // Simulate AES-256 GCM in-memory encryption
    const encryptedKey = `aes256_gcm_${Buffer.from(key).toString('hex').substring(0, 16)}...`;
    
    // Save state in our local server memory
    keyVault.set(uniqueHash, {
        email,
        model,
        encryptedKey,
        protectionActive: !!protectionActive,
        lastRefactored: new Date()
    });

    logEvent('vault', `API Key vaulted securely for user: ${email}`, 'vault');
    logEvent('vault', `Generated AES-256 in-memory payload: ${encryptedKey}`, 'vault');
    logEvent('vault', `Synchronization active for gateway ID: ae_live_${uniqueHash}`, 'vault');

    // Trigger AetherPing keep-warm heartbeats scheduler
    startKeepWarmScheduler();

    res.json({
        success: true,
        gatewayId: `ae_live_${uniqueHash}`,
        gatewayUrl: `http://localhost:${PORT}/api/v1/chat/completions/ae_live_${uniqueHash}`
    });
});

// 2. Mock Edge-Proxy Streaming Endpoint — Prompt Caching Interceptor & SSE Stream
app.post('/api/v1/chat/completions/:gatewayId', (req, res) => {
    const { gatewayId } = req.params;
    const { messages, model: requestModel, stream } = req.body;

    const hash = gatewayId.replace('ae_live_', '');
    const userConfig = keyVault.get(hash);

    if (!userConfig) {
        return res.status(401).json({ error: 'Gateway ID inactive or unauthorized key vault.' });
    }

    logEvent('proxy', `Incoming query intercepted from client SDK on gateway: ${gatewayId}`);
    logEvent('proxy', `In-memory decryption: Loaded encrypted payload -> Decrypted raw Bearer token strictly in RAM.`, 'vault');

    // Prompt Caching Refactoring Interceptor Simulation
    logEvent('proxy', `Scanning prompt JSON context. Found static prefix context size: 1042 tokens.`);
    logEvent('proxy', `Refactoring message array structure to insert provider cache controllers...`);
    
    const refactoredPrompt = {
        model: requestModel || userConfig.model,
        messages: [
            ...messages.slice(0, -1),
            { ...messages[messages.length - 1], cache_control: { type: "ephemeral" } }
        ]
    };
    
    logEvent('proxy', `Refactored payload successfully sent to provider. Cache control flag injected!`);

    // Stream Mock Text Responses back using Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const mockTokens = [
        "Aether", "Cache", " has", " successfully", " intercepted", " your", " API", " call", 
        " at", " the", " edge", "!", " Prompt", " refactoring", " was", " automatically", " applied", 
        " to", " trigger", " prompt", " caching", " discounts", " from", " your", " model", 
        " provider.", " You", " saved", " 75%", " on", " input", " processing", " cost", 
        " with", " zero", " latency", " overhead."
    ];

    let tokenIndex = 0;
    const interval = setInterval(() => {
        if (tokenIndex < mockTokens.length) {
            const data = JSON.stringify({
                choices: [{ delta: { content: mockTokens[tokenIndex] } }]
            });
            res.write(`data: ${data}\n\n`);
            tokenIndex++;
        } else {
            clearInterval(interval);
            res.write('data: [DONE]\n\n');
            res.end();
            logEvent('proxy', `Edge stream delivery completed with 0ms buffering overhead. Stream closed.`, 'success');
        }
    }, 60);

    req.on('close', () => {
        clearInterval(interval);
    });
});

// 3. Keep-Warm Engine Scheduler (AetherPing Heartbeats)
function startKeepWarmScheduler() {
    if (aetherPingInterval) clearInterval(aetherPingInterval);

    // Run low-frequency keep-warm checks every 10 seconds to make the local demonstration super dynamic
    aetherPingInterval = setInterval(() => {
        if (keyVault.size === 0) return;

        keyVault.forEach((config, hash) => {
            if (config.protectionActive) {
                logEvent(
                    'ping', 
                    `Sustaining warm cache status for ${config.email} (${config.model}): Dispatching background dummy prefix keep-warm heartbeat...`, 
                    'success'
                );
                logEvent(
                    'ping', 
                    `Anthropic edge node cache locked at 100% warm. Cache eviction prevented successfully.`, 
                    'success'
                );
            } else {
                logEvent(
                    'ping', 
                    `AetherPing suspended for ${config.email} (${config.model}): Heartbeats paused. Cache cooled down to 0% cold.`, 
                    'error'
                );
            }
        });
    }, 10000);
}

// 4. Stripe Checkout Session API Endpoint (Zero-dependency mock fallback by default)
app.post('/api/v1/checkout/session', async (req, res) => {
    const { plan, email, urlOrigin } = req.body;

    const startupPriceId = 'price_1TcTWLDq9bSyzrd3x1rxMPgL';
    const growthPriceId = 'price_1TcTczDq9bSyzrd3gI1d6qJp'; // Mock Growth ID, will use environment vars if available

    const priceId = plan === 'growth' 
        ? (process.env.STRIPE_GROWTH_PRICE_ID || growthPriceId) 
        : (process.env.STRIPE_STARTUP_PRICE_ID || startupPriceId);

    if (process.env.STRIPE_SECRET_KEY) {
        try {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price: priceId,
                    quantity: 1,
                }],
                mode: 'subscription',
                customer_email: email,
                success_url: `${urlOrigin}/?session_id={CHECKOUT_SESSION_ID}&success=true`,
                cancel_url: `${urlOrigin}/?cancel=true`,
                automatic_tax: { enabled: true }
            });
            return res.json({ url: session.url });
        } catch (err) {
            console.error('[Stripe Local SDK Error]:', err.message);
            return res.status(500).json({ error: err.message });
        }
    }

    // High-fidelity zero-config local simulation fallback
    res.json({ success: true });
});

// Serve landing page at base route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log('\n\x1b[32m========================================================================\x1b[0m');
    console.log(`\x1b[32m🚀 AetherCache Mock Caching Backend Server successfully running locally!\x1b[0m`);
    console.log(`\x1b[32m🔗 Local Gateway dashboard accessible at: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
    console.log('\x1b[32m========================================================================\x1b[0m\n');
    console.log('Watching for secure key vaults and edge-caching API interactions...\n');
});
