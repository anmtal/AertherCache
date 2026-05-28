/**
 * AetherCache Live API Ping Executor
 * Authenticates with user keys, fires lightweight keep-warm queries,
 * and extracts raw usage billing metadata from API header responses.
 */

/**
 * Fires a keep-warm heartbeat API query to Anthropic or OpenAI.
 * @param {string} decryptedKey - The decrypted user API key
 * @param {string} provider - 'anthropic' or 'openai'
 * @param {string} model - Specific model string (e.g. 'claude-3-5-sonnet-20241022')
 * @param {string} staticPrompt - The massive static system context to cache
 * @returns {object} - Live API execution logs, latencies, and billing metrics
 */
async function executePing(decryptedKey, provider, model, staticPrompt) {
    if (!decryptedKey || !provider || !model || !staticPrompt) {
        throw new Error('All parameters (key, provider, model, prompt) are required for live execution');
    }

    const start = Date.now();
    let cacheHit = false;
    let tokensRead = 0;
    let tokensWritten = 0;
    let totalInput = 0;
    let totalOutput = 0;

    try {
        if (provider === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': decryptedKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-beta': 'prompt-caching-2024-07-31',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 1,
                    system: [
                        {
                            type: 'text',
                            text: staticPrompt,
                            cache_control: { type: 'ephemeral' } // 🟢 Instruct Claude to cache this block
                        }
                    ],
                    messages: [
                        { role: 'user', content: '.' }
                    ]
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error?.message || `Anthropic API responded with status ${response.status}`);
            }

            const usage = data.usage || {};
            const cacheRead = usage.cache_read_input_tokens || 0;
            const cacheWrite = usage.cache_creation_input_tokens || 0;
            const inputStandard = usage.input_tokens || 0;

            totalInput = inputStandard + cacheRead + cacheWrite;
            totalOutput = usage.output_tokens || 0;
            tokensRead = cacheRead;
            tokensWritten = cacheWrite;
            cacheHit = cacheRead > 0;

        } else if (provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${decryptedKey}`,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 1,
                    messages: [
                        { role: 'system', content: staticPrompt },
                        { role: 'user', content: '.' }
                    ]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || `OpenAI API responded with status ${response.status}`);
            }

            const usage = data.usage || {};
            const details = usage.prompt_tokens_details || {};
            const cacheRead = details.cached_tokens || 0;

            totalInput = usage.prompt_tokens || 0;
            totalOutput = usage.completion_tokens || 0;
            tokensRead = cacheRead;
            // OpenAI automatically handles cache writing behind the scenes
            tokensWritten = cacheRead === 0 ? totalInput : 0; 
            cacheHit = cacheRead > 0;

        } else {
            throw new Error(`Provider '${provider}' is not currently supported for live pings`);
        }

        const latencyMs = Date.now() - start;

        // Pricing Rates per Million tokens (B2B SaaS values)
        let rateInput = 0;
        let rateCacheRead = 0;

        if (model.includes('sonnet')) {
            rateInput = 3.00;
            rateCacheRead = 0.30;
        } else if (model.includes('haiku')) {
            rateInput = 0.80;
            rateCacheRead = 0.08;
        } else if (model.includes('gpt-4o-mini')) {
            rateInput = 0.150;
            rateCacheRead = 0.075;
        } else if (model.includes('gpt-4o')) {
            rateInput = 5.00;
            rateCacheRead = 2.50;
        } else {
            // General fallback
            rateInput = 2.00;
            rateCacheRead = 1.00;
        }

        // Calculate standard cost vs cached cost
        const standardCost = (totalInput * rateInput) / 1000000;
        const actualCost = ((tokensRead * rateCacheRead) + ((totalInput - tokensRead) * rateInput)) / 1000000;
        const costSaved = Math.max(0, standardCost - actualCost);

        return {
            success: true,
            provider,
            model,
            latencyMs,
            cacheHit,
            tokensRead,
            tokensWritten,
            totalInput,
            totalOutput,
            financials: {
                standardCost: parseFloat(standardCost.toFixed(6)),
                actualCost: parseFloat(actualCost.toFixed(6)),
                costSaved: parseFloat(costSaved.toFixed(6))
            }
        };

    } catch (err) {
        return {
            success: false,
            error: err.message,
            latencyMs: Date.now() - start
        };
    }
}

module.exports = {
    executePing
};
