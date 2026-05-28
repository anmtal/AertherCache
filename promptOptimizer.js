/**
 * AetherCache Prompt Optimization Engine
 * Analyzes prompt structures, extracts dynamic variables,
 * estimates token counts, and compiles caching-optimized layouts.
 */

// Regex patterns to identify typical dynamic variables in prompts
const DYNAMIC_PATTERNS = [
    /\{\{[\w\s\-]+?\}\}/g,               // {{variable}}
    /\{[\w\s\-]+?\}/g,                  // {variable}
    /\b(CURRENT_DATE|TIMESTAMP|TIME)\b/gi, // date/time indicators
    /\b(USER_NAME|USER_ID|EMAIL)\b/gi     // generic user metadata fields
];

/**
 * Estimates token counts based on standard text metrics.
 * 1 token is approximately 4 characters of standard English text.
 */
function estimateTokens(text) {
    if (!text) return 0;
    return Math.max(1, Math.round(text.length / 4));
}

/**
 * Optimizes an input prompt by repositioning dynamic elements to the end.
 * @param {string} promptText - The raw, unoptimized prompt text
 * @returns {object} - Analysis results, optimized prompt, and savings breakdown
 */
function optimizePrompt(promptText) {
    if (!promptText || typeof promptText !== 'string') {
        throw new Error('Valid prompt text string is required for optimization');
    }

    const lines = promptText.split('\n');
    const staticLines = [];
    const dynamicLines = [];
    const detectedVariables = new Set();
    const refactorSteps = [];

    // Analyze line-by-line
    lines.forEach(line => {
        let isDynamic = false;
        
        // Scan for dynamic patterns
        DYNAMIC_PATTERNS.forEach(pattern => {
            const matches = line.match(pattern);
            if (matches) {
                isDynamic = true;
                matches.forEach(m => detectedVariables.add(m));
            }
        });

        // Check if the line looks like an active template parameter
        if (line.includes('=') && (line.includes('{{') || line.includes('{'))) {
            isDynamic = true;
        }

        if (isDynamic) {
            dynamicLines.push(line);
        } else {
            staticLines.push(line);
        }
    });

    const originalTokens = estimateTokens(promptText);
    
    // Compile optimized prompt
    // Static context is placed at the top (to create a long, reusable cached prefix)
    // Dynamic context is separated and appended at the bottom.
    const cleanStaticText = staticLines.join('\n').trim();
    const cleanDynamicText = dynamicLines.join('\n').trim();

    let optimizedPrompt = '';
    
    if (cleanStaticText) {
        optimizedPrompt += cleanStaticText + '\n\n';
    }
    
    if (cleanDynamicText) {
        optimizedPrompt += `# --- ACTIVE CONVERSATION METADATA (DYNAMIC TAIL) ---\n`;
        optimizedPrompt += cleanDynamicText;
    }

    const staticTokens = estimateTokens(cleanStaticText);
    const dynamicTokens = estimateTokens(cleanDynamicText);
    const optimizedTokens = staticTokens + dynamicTokens;

    // Log the refactoring steps for developer auditing
    if (dynamicLines.length > 0) {
        refactorSteps.push(`Identified ${detectedVariables.size} dynamic parameter fields: ${Array.from(detectedVariables).join(', ')}.`);
        refactorSteps.push(`Moved ${dynamicLines.length} line(s) of dynamic variables from the top/middle to the very bottom.`);
        refactorSteps.push(`Secured a static system prefix of ${staticTokens.toLocaleString()} tokens, unlocking up to a 90% prompt caching read discount.`);
    } else {
        refactorSteps.push('No active dynamic variables detected. Static block of ' + staticTokens.toLocaleString() + ' tokens is ready for 100% prefix matching.');
    }

    // Caching savings efficiency calculation (Anthropic Sonnet benchmark)
    // First query writes cache (standard price), subsequent queries read at 90% off.
    const standardCostPerMillion = 3.00;
    const cacheReadCostPerMillion = 0.30;
    
    // Estimate cost over a standard 5-turn session
    const standardCost = (originalTokens * 5 * standardCostPerMillion) / 1000000;
    const optimizedCost = ((staticTokens * 1 * standardCostPerMillion) + (staticTokens * 4 * cacheReadCostPerMillion) + (dynamicTokens * 5 * standardCostPerMillion)) / 1000000;
    const savingsPct = standardCost > 0 ? ((standardCost - optimizedCost) / standardCost) * 100 : 0;

    return {
        originalPrompt: promptText,
        optimizedPrompt: optimizedPrompt.trim(),
        originalTokens,
        staticTokens,
        dynamicTokens,
        variables: Array.from(detectedVariables),
        refactorSteps,
        financials: {
            standardCostSession: parseFloat(standardCost.toFixed(6)),
            optimizedCostSession: parseFloat(optimizedCost.toFixed(6)),
            savingsPercentage: Math.round(savingsPct)
        }
    };
}

module.exports = {
    optimizePrompt,
    estimateTokens
};
