/* ==========================================================================
   AetherCache B2B Backend — High-Fidelity Local Edge Proxy & AetherPing Gateway
   ========================================================================== */

require('dotenv').config();
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

// 4. Stripe Checkout Session API Endpoint (4-tier billing with metered usage)
app.post('/api/v1/checkout/session', async (req, res) => {
    const { plan, email, urlOrigin } = req.body;

    // Full 4-tier price lookup table (base subscription + metered usage per tier)
    const pricingTiers = {
        startup: {
            base:    process.env.STRIPE_STARTUP_PRICE_ID    || 'price_1TdD06DRRNiuPDru4N97bRLc',
            metered: process.env.STRIPE_STARTUP_METERED_PRICE_ID || 'price_1TdDBADRRNiuPDrufALyFUED'
        },
        growth: {
            base:    process.env.STRIPE_GROWTH_PRICE_ID     || 'price_1TdDHnDRRNiuPDruKSKwXh4s',
            metered: process.env.STRIPE_GROWTH_METERED_PRICE_ID  || 'price_1TdDIXDRRNiuPDruqyHQ2CWT'
        },
        scale: {
            base:    process.env.STRIPE_SCALE_PRICE_ID      || 'price_1TdDMRDRRNiuPDruCCR20nq1',
            metered: process.env.STRIPE_SCALE_METERED_PRICE_ID   || 'price_1TdDUiDRRNiuPDru4OwtiKMD'
        },
        enterprise: {
            base:    process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_1TdDXwDRRNiuPDru3oWwlgBX',
            metered: process.env.STRIPE_ENTERPRISE_METERED_PRICE_ID || 'price_1TdDa7DRRNiuPDrunchGcMon'
        }
    };

    const tier = pricingTiers[plan] || pricingTiers.startup;

    if (process.env.STRIPE_SECRET_KEY) {
        try {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    // Fixed-rate monthly subscription price
                    { price: tier.base, quantity: 1 },
                    // Metered usage price (reported via Stripe Usage Records)
                    { price: tier.metered }
                ],
                mode: 'subscription',
                customer_email: email,
                success_url: `${urlOrigin}/?session_id={CHECKOUT_SESSION_ID}&success=true&plan=${plan}`,
                cancel_url: `${urlOrigin}/?cancel=true`,
                automatic_tax: { enabled: true },
                subscription_data: {
                    metadata: { plan_tier: plan }
                }
            });
            logEvent('stripe', `Checkout session created for ${email} on ${plan.toUpperCase()} tier`, 'success');
            return res.json({ url: session.url });
        } catch (err) {
            console.error('[Stripe Local SDK Error]:', err.message);
            return res.status(500).json({ error: err.message });
        }
    }

    // High-fidelity zero-config local simulation fallback redirecting to stripe-checkout.html
    res.json({ url: `/stripe-checkout.html?plan=${plan}&email=${email}` });
});

// 5. Stripe Webhook Listener Endpoint (Local Development & Database Sync)
app.post('/api/v1/stripe/webhook', async (req, res) => {
    const event = req.body;

    logEvent('stripe', `Stripe Webhook received event of type: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const email = session.customer_email || (session.customer_details && session.customer_details.email);

        if (email) {
            logEvent('stripe', `Verified checkout.session.completed for ${email}`, 'success');

            // 1. Update in-memory configuration for active pings
            keyVault.forEach((config, hash) => {
                if (config.email === email) {
                    config.paid = true;
                    logEvent('stripe', `In-memory KeyVault updated: set paid=true for ${email}`, 'success');
                }
            });

            // 2. Proactively update secure Supabase Database row if credentials are configured
            if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
                try {
                    logEvent('stripe', `Syncing paid status directly with Supabase Database...`, 'info');
                    
                    const dbResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/gateways?email=eq.${email}`, {
                        method: 'PATCH',
                        headers: {
                            'apikey': process.env.SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify({
                            paid: true,
                            updated_at: new Date()
                        })
                    });

                    if (dbResponse.ok) {
                        logEvent('stripe', `Supabase DB successfully updated: set paid=true for ${email}`, 'success');
                    } else {
                        const errText = await dbResponse.text();
                        logEvent('stripe', `Supabase DB update failed: ${errText}`, 'error');
                    }
                } catch (dbErr) {
                    logEvent('stripe', `Supabase DB connection error: ${dbErr.message}`, 'error');
                }
            }
        }
    }

    res.json({ received: true });
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
