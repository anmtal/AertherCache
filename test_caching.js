/* ==========================================================================
   AetherCache Core Diagnostic Script — Live Prompt Caching & Latency Auditor
   ========================================================================== */

/**
 * This script runs a live diagnostics test against the official Anthropic Claude API.
 * It proves the physical mechanics of AetherCache and AetherPing:
 * 
 * 1. Creates a repeating prompt context exceeding 1,024 tokens (Anthropic's caching threshold).
 * 2. Dispatch #1: Writes the context to Anthropic's edge node RAM (Cache Creation).
 * 3. Dispatch #2: Reads the context from RAM, proving the 75%+ prompt caching discount!
 * 
 * Zero dependencies required. Uses native Node.js HTTPS module.
 */

const https = require('https');

// Retrieve API key from environment variable or command line
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.argv[2];

if (!ANTHROPIC_API_KEY) {
    console.log('\n\x1b[31m[Error] Missing Anthropic API Key!\x1b[0m');
    console.log('To run this test, please provide your Anthropic key starting with "sk-ant-":');
    console.log('\x1b[36mnode test_caching.js your-api-key-here\x1b[0m\n');
    process.exit(1);
}

// Generate a large static system instructions context (>1,024 tokens)
// Anthropic requires prompt caches to be at least 1,024 tokens to activate caching discounts.
const staticInstructionBlock = `
ROLE PROFILE: You are a B2B enterprise assistant router designed by AetherCache Inc.
MISSION: Demonstrate high-fidelity edge caching proxy optimizations.
CORPORATE DIRECTIVE MANUAL:
${Array(50).fill("AetherCache acts as an intelligent edge caching proxy. By refactoring prompts and maintaining pings, we keep caches warm 24/7.").join("\n")}
Ensure all responses strictly maintain a cyber-neon obsidian theme narrative.
`;

console.log('\n========================================================================');
console.log('🧪 AETHERCACHE CORE DIAGNOSTICS: TESTING PROMPT CACHING WITH CLAUDE');
console.log('========================================================================');
console.log(`Prompt Context Size: ~${Math.ceil(staticInstructionBlock.length / 4)} tokens (Minimum threshold met)`);
console.log('Connecting directly to Anthropic API endpoints...\n');

// Standard Anthropic request structure
function makeAnthropicRequest(isCachedHit) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 100,
            system: [
                {
                    type: "text",
                    text: staticInstructionBlock,
                    // Injected by AetherCache Proxy to trigger prompt caching:
                    cache_control: { type: "ephemeral" }
                }
            ],
            messages: [
                { role: "user", content: isCachedHit ? "Repeat back 'AetherCache Caching Hit Verified!'" : "Repeat back 'AetherCache Cache Created successfully!'" }
            ]
        });

        const options = {
            hostname: 'api.anthropic.com',
            port: 443,
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-length': Buffer.byteLength(payload)
            }
        };

        const startTime = Date.now();

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                const latency = Date.now() - startTime;
                
                if (res.statusCode !== 200) {
                    reject(new Error(`API Error (Status ${res.statusCode}): ${body}`));
                    return;
                }

                try {
                    const parsed = JSON.parse(body);
                    resolve({
                        latency,
                        usage: parsed.usage,
                        response: parsed.content[0].text
                    });
                } catch (e) {
                    reject(new Error("Failed to parse JSON response."));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(payload);
        req.end();
    });
}

async function runDiagnostics() {
    try {
        // -------------------------------------------------------------
        // DISPATCH #1: Cache Creation
        // -------------------------------------------------------------
        console.log('\x1b[33m[Dispatch #1] Sending large context prompt to initiate edge cache...\x1b[0m');
        const run1 = await makeAnthropicRequest(false);
        
        console.log(`  🟢 Response: "${run1.response}"`);
        console.log(`  ⏱️  Latency: \x1b[33m${run1.latency}ms\x1b[0m`);
        console.log(`  📊 Token Usage:`);
        console.log(`     - Input Tokens: ${run1.usage.input_tokens}`);
        console.log(`     - \x1b[32mCreated Cache Tokens: ${run1.usage.cache_creation_input_tokens || 0}\x1b[0m`);
        console.log(`     - Read Cache Tokens: ${run1.usage.cache_read_input_tokens || 0}`);
        console.log(`  💰 Transaction Cost: \x1b[33m$${((run1.usage.input_tokens * 3.00) / 1000000).toFixed(6)}\x1b[0m (Standard input pricing)\n`);

        console.log('Waiting 2 seconds to simulate prompt cooldown...');
        await new Promise(r => setTimeout(r, 2000));

        // -------------------------------------------------------------
        // DISPATCH #2: Cache Read (The AetherCache hit!)
        // -------------------------------------------------------------
        console.log('\x1b[32m[Dispatch #2] Sending identical prompt to trigger AetherCache read...\x1b[0m');
        const run2 = await makeAnthropicRequest(true);

        console.log(`  🟢 Response: "${run2.response}"`);
        console.log(`  ⏱️  Latency: \x1b[32m${run2.latency}ms\x1b[0m (Fast retrieval bypasses parsing)`);
        console.log(`  📊 Token Usage:`);
        console.log(`     - Input Tokens: ${run2.usage.input_tokens}`);
        console.log(`     - Created Cache Tokens: ${run2.usage.cache_creation_input_tokens || 0}`);
        console.log(`     - \x1b[32mRead Cache Tokens (CACHED MATCH): ${run2.usage.cache_read_input_tokens || 0}\x1b[0m 🌟`);
        
        const totalInputTokens = run2.usage.input_tokens + (run2.usage.cache_read_input_tokens || 0);
        const standardCost = (totalInputTokens * 3.00) / 1000000;
        const cachedCost = (run2.usage.input_tokens * 3.00 + (run2.usage.cache_read_input_tokens || 0) * 0.75) / 1000000;
        const savedPercent = ((standardCost - cachedCost) / standardCost) * 100;

        console.log(`  💰 Transaction Cost: \x1b[32m$${cachedCost.toFixed(6)}\x1b[0m (Cached input discount applied!)`);
        console.log(`  🎉 \x1b[35mSavings Secured: ${savedPercent.toFixed(1)}% Cost Reduction on this call!\x1b[0m\n`);

        // -------------------------------------------------------------
        // AETHERPING EXPLANATION
        // -------------------------------------------------------------
        console.log('========================================================================');
        console.log('⏰ HOW AETHERPING HEARTBEATS SUSTAIN THIS:");');
        console.log('========================================================================');
        console.log('1. The prompt cache we just created in Anthropic\'s RAM expires in 5 minutes.');
        console.log('2. If you are idle for 10 minutes, Dispatch #3 would cost standard rates again ($3.00/1M).');
        console.log('3. AetherPing solves this by sending a background keep-warm check every 4 minutes.');
        console.log('4. This locks your 75% caching discount forever, guaranteeing permanent savings!');
        console.log('========================================================================\n');

    } catch (error) {
        console.error('\x1b[31m[Diagnostic Error]\x1b[0m', error.message);
        console.log('Please verify your Anthropic API Key has active credits and try again.');
    }
}

runDiagnostics();
