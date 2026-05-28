/* ==========================================================================
   AetherCache Core Simulator Engine - Interactive Computation & Rendering
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // --- Backend API Integration Check ---
    const badgeEl = document.querySelector('.active-badge span:last-child');
    const badgePulse = document.querySelector('.pulse-dot');
    
    async function checkBackend() {
        try {
            const res = await fetch('http://localhost:3000/api/health');
            if (res.ok) {
                badgeEl.textContent = '⚡ Live API Controller Active';
                badgeEl.style.color = '#67e8f9';
                badgePulse.style.backgroundColor = '#06b6d4';
                badgePulse.style.boxShadow = '0 0 10px #06b6d4';
                console.log('AetherCache: Connected to functional Node.js backend server! Direct REST integration available.');
            }
        } catch (e) {
            console.log('AetherCache: Running in stand-alone high-fidelity simulation engine mode.');
        }
    }
    checkBackend();

    // --- State & Constants ---
    const MODELS = {
        'claude-sonnet': {
            name: 'Claude 3.5 Sonnet',
            provider: 'Anthropic',
            rateInput: 3.00,      // per million
            rateCacheRead: 0.30,  // per million (90% discount)
            rateCacheWrite: 3.75, // per million (25% penalty)
            rateOutput: 15.00,    // per million
            tip: 'Anthropic prompt caching is extremely powerful. Static system prompts and context files at the beginning of your prompt are read at a 90% discount after the first query.'
        },
        'claude-haiku': {
            name: 'Claude 3.5 Haiku',
            provider: 'Anthropic',
            rateInput: 0.80,
            rateCacheRead: 0.08,  // per million (90% discount)
            rateCacheWrite: 1.00, // per million (25% penalty)
            rateOutput: 4.00,
            tip: 'Anthropic’s fastest model offers ultra-cheap caching. With system caching active, inputs drop to just $0.08 per Million tokens, perfect for high-speed agent loops.'
        },
        'claude-opus': {
            name: 'Claude 3.0 Opus',
            provider: 'Anthropic',
            rateInput: 15.00,
            rateCacheRead: 1.50,  // per million (90% discount)
            rateCacheWrite: 18.75, // per million (25% penalty)
            rateOutput: 75.00,
            tip: 'Opus is Anthropic’s most complex reasoning model. Caching is highly recommended here, as saving 90% on massive reasoning prompts yields significant absolute dollar savings.'
        },
        'gpt-4o': {
            name: 'GPT-4o',
            provider: 'OpenAI',
            rateInput: 5.00,
            rateCacheRead: 2.50,  // per million (50% discount)
            rateCacheWrite: 5.00, // per million (no penalty)
            rateOutput: 15.00,
            tip: 'OpenAI automatically caches prompts in 1024-token blocks. Prefix matching must be strictly identical from the very beginning of the prompt to trigger the 50% discount.'
        },
        'gpt-4o-mini': {
            name: 'GPT-4o-mini',
            provider: 'OpenAI',
            rateInput: 0.15,
            rateCacheRead: 0.075, // per million (50% discount)
            rateCacheWrite: 0.15, // per million (no penalty)
            rateOutput: 0.60,
            tip: 'OpenAI’s lightweight model automatically caches in 1024-token blocks. Perfect for high-frequency, low-cost microservices where prompt identicality is maintained.'
        },
        'gemini-pro': {
            name: 'Gemini 1.5 Pro',
            provider: 'Google',
            rateInput: 1.25,
            rateCacheRead: 0.625, // per million (50% discount)
            rateCacheWrite: 1.25, // per million (no penalty)
            rateOutput: 5.00,
            tip: 'Google Gemini prompt caching is highly cost-effective for extremely large contexts (over 32k tokens), offering a flat 50% discount on cache hits.'
        },
        'gemini-flash': {
            name: 'Gemini 1.5 Flash',
            provider: 'Google',
            rateInput: 0.075,
            rateCacheRead: 0.0375, // per million (50% discount)
            rateCacheWrite: 0.075, // per million (no penalty)
            rateOutput: 0.30,
            tip: 'Gemini Flash is Google’s speed-optimized model. Caching provides a 50% discount on prompts larger than 32k tokens, making large-context apps incredibly cheap.'
        },
        'deepseek-v3': {
            name: 'DeepSeek-V3',
            provider: 'DeepSeek',
            rateInput: 0.14,
            rateCacheRead: 0.07,  // per million (50% discount)
            rateCacheWrite: 0.14, // per million (no penalty)
            rateOutput: 0.28,
            tip: 'DeepSeek-V3 is an extremely low-cost reasoning model with built-in prompt caching. A cache hit reduces input costs to just $0.07 per Million tokens.'
        }
    };

    // --- DOM Elements ---
    const modelSelector = document.getElementById('model-selector');
    
    // Model Rate Labels
    const rateInputEl = document.getElementById('rate-input');
    const rateCacheReadEl = document.getElementById('rate-cache-read');
    const rateCacheWriteEl = document.getElementById('rate-cache-write');

    // Sliders
    const sliderQueries = document.getElementById('slider-queries');
    const sliderStatic = document.getElementById('slider-static');
    const sliderDynamic = document.getElementById('slider-dynamic');
    const sliderTurns = document.getElementById('slider-turns');

    // Slider Text values
    const txtQueries = document.getElementById('val-queries-txt');
    const txtStatic = document.getElementById('val-static-txt');
    const txtDynamic = document.getElementById('val-dynamic-txt');
    const txtTurns = document.getElementById('val-turns-txt');

    // Financial Cards
    const costStandardEl = document.getElementById('cost-standard');
    const costOptimizedEl = document.getElementById('cost-optimized');
    const roiSavingsEl = document.getElementById('roi-savings');
    
    // Progress Ratings
    const pctCachingProgress = document.getElementById('pct-caching-progress');
    const pctCachingTxt = document.getElementById('pct-caching-txt');
    const pctLatencyProgress = document.getElementById('pct-latency-progress');
    const pctLatencyTxt = document.getElementById('pct-latency-txt');

    // Text descriptions
    const roiPctEl = document.getElementById('roi-pct');
    const roiDevValueEl = document.getElementById('roi-dev-value');
    const tokenLadderEl = document.getElementById('token-ladder');
    const refactorBadgeEl = document.getElementById('refactor-badge');

    // Canvas Editors
    const editorDirty = document.getElementById('editor-dirty');
    const editorClean = document.getElementById('editor-clean');

    // SDK Tab Actions
    const tabPy = document.getElementById('tab-py');
    const tabNode = document.getElementById('tab-node');
    const codeSnippetEl = document.getElementById('code-snippet');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const sdkTipTextEl = document.getElementById('sdk-tip-text');

    let activeLang = 'python';

    // --- Simulation Mathematics ---
    function updateSimulation() {
        const selectedModelKey = modelSelector.value;
        const model = MODELS[selectedModelKey];

        // Gather numeric slider values
        const monthlyQueries = parseInt(sliderQueries.value, 10);
        const staticTokens = parseInt(sliderStatic.value, 10);
        const dynamicTokens = parseInt(sliderDynamic.value, 10);
        const turnsCount = parseInt(sliderTurns.value, 10);

        // Update Slider indicator values on DOM
        txtQueries.textContent = monthlyQueries.toLocaleString();
        txtStatic.textContent = staticTokens.toLocaleString();
        txtDynamic.textContent = dynamicTokens.toLocaleString();
        txtTurns.textContent = turnsCount.toString();

        // Update Model rates DOM
        rateInputEl.textContent = `$${model.rateInput.toFixed(2)}`;
        rateCacheReadEl.textContent = `$${model.rateCacheRead.toFixed(2)}`;
        rateCacheWriteEl.textContent = `$${model.rateCacheWrite.toFixed(2)}`;

        // Average model output per turn (800 tokens or dynamic * 1.5)
        const avgOutputTokens = Math.max(800, Math.round(dynamicTokens * 1.5));

        /* --- Cost Formula Calculation ---
           1 conversation has T turns.
           Round t (from 1 to T):
           - In standard non-cached architecture, input contains:
             S (static) + (t - 1) * (D + R) + D.
           - In AetherCache optimized architecture:
             S is cached.
             Round 1: S is written (S at write rate) + D at standard rate.
             Round 2+: S is read from cache (S at read rate) + previous dynamic conversation items read at standard input rate.
        */

        let standardInputTokensSum = 0;
        let standardOutputTokensSum = 0;

        let optimizedInputStandardSum = 0;
        let optimizedInputCacheReadSum = 0;
        let optimizedInputCacheWriteSum = 0;
        let optimizedOutputTokensSum = 0;

        // Cumulative storage arrays for rendering conversation rounds
        const roundData = [];

        for (let t = 1; t <= turnsCount; t++) {
            // Previous dialogue tokens in input: (t-1) rounds of (dynamic user request + output response)
            const prevDialogueTokens = (t - 1) * (dynamicTokens + avgOutputTokens);
            
            // Standard total input tokens for this turn
            const stdInputTokens = staticTokens + prevDialogueTokens + dynamicTokens;
            standardInputTokensSum += stdInputTokens;
            standardOutputTokensSum += avgOutputTokens;

            // Optimized prompt caching calculation
            let optInputCached = 0;
            let optInputWrite = 0;
            let optInputStandard = 0;

            if (t === 1) {
                // First turn: Caching write occurs for the static system context
                optInputWrite = staticTokens;
                optInputStandard = dynamicTokens;
            } else {
                // Subsequent turns: static context is read directly from cache prefix
                optInputCached = staticTokens;
                // Previous turns dialog history + current turn user message are dynamic and read standard
                optInputStandard = prevDialogueTokens + dynamicTokens;
            }

            optimizedInputStandardSum += optInputStandard;
            optimizedInputCacheReadSum += optInputCached;
            optimizedInputCacheWriteSum += optInputWrite;
            optimizedOutputTokensSum += avgOutputTokens;

            // Calculate cost for this specific turn in single conversation run
            const turnStdCost = (stdInputTokens * model.rateInput + avgOutputTokens * model.rateOutput) / 1000000;
            const turnOptCost = (optInputStandard * model.rateInput + optInputCached * model.rateCacheRead + optInputWrite * model.rateCacheWrite + avgOutputTokens * model.rateOutput) / 1000000;

            roundData.push({
                roundNum: t,
                standardInput: stdInputTokens,
                optimizedCached: optInputCached,
                optimizedWrite: optInputWrite,
                optimizedStandard: optInputStandard,
                output: avgOutputTokens,
                stdCost: turnStdCost,
                optCost: turnOptCost
            });
        }

        // Aggregate monthly costs
        // Note: Monthly Queries represents monthly CONVERSATION sessions.
        const totalStandardCostMonthly = (standardInputTokensSum * model.rateInput + standardOutputTokensSum * model.rateOutput) / 1000000 * monthlyQueries;
        const totalOptimizedCostMonthly = (optimizedInputStandardSum * model.rateInput + optimizedInputCacheReadSum * model.rateCacheRead + optimizedInputCacheWriteSum * model.rateCacheWrite + optimizedOutputTokensSum * model.rateOutput) / 1000000 * monthlyQueries;

        const totalSavingsMonthly = Math.max(0, totalStandardCostMonthly - totalOptimizedCostMonthly);
        const savingsPercentage = totalStandardCostMonthly > 0 ? (totalSavingsMonthly / totalStandardCostMonthly) * 100 : 0;

        // Render values to DOM
        costStandardEl.textContent = `$${Math.round(totalStandardCostMonthly).toLocaleString()}`;
        costOptimizedEl.textContent = `$${Math.round(totalOptimizedCostMonthly).toLocaleString()}`;
        roiSavingsEl.textContent = `$${Math.round(totalSavingsMonthly).toLocaleString()}`;
        refactorBadgeEl.textContent = `-${Math.round(savingsPercentage)}% Cost`;

        // Cache Hit Ratio estimate (percentage of context cached over overall input tokens)
        const totalInputTokensSum = standardInputTokensSum;
        const totalCachedInputSum = optimizedInputCacheReadSum;
        const cacheHitRatio = totalInputTokensSum > 0 ? (totalCachedInputSum / totalInputTokensSum) * 100 : 0;

        // Update Caching progress UI
        pctCachingTxt.textContent = `${Math.round(cacheHitRatio)}%`;
        const dashArrayCaching = `${Math.round(cacheHitRatio)}, 100`;
        pctCachingProgress.setAttribute('stroke-dasharray', dashArrayCaching);

        // Latency reduction approximation (Cached tokens read up to 4x faster)
        // Average speed boost is highly proportional to cache hit percentage
        const latencyReduction = cacheHitRatio * 0.85; // up to 85% latency drop
        pctLatencyTxt.textContent = `${Math.round(latencyReduction)}%`;
        const dashArrayLatency = `${Math.round(latencyReduction)}, 100`;
        pctLatencyProgress.setAttribute('stroke-dasharray', dashArrayLatency);

        // Financial SaaS ROI text highlights
        // Standard SaaS is $99/mo
        const SAAS_SUB = 99.00;
        const netRoi = SAAS_SUB > 0 ? (totalSavingsMonthly / SAAS_SUB) * 100 : 0;
        roiPctEl.textContent = `${Math.round(netRoi).toLocaleString()}%`;

        // 1 junior dev monthly cost equivalent (~$3,000/mo)
        const juniorDevValue = totalSavingsMonthly / 3000;
        roiDevValueEl.textContent = juniorDevValue.toFixed(1);

        // --- Render Token Accumulation Graph ---
        renderTokenLadder(roundData, staticTokens);

        // --- Render Prompt editors ---
        renderPromptEditors(staticTokens);

        // --- Render Code snippets ---
        renderCodeSnippets(selectedModelKey, staticTokens);
    }

    // --- Graph Rendering Engine ---
    function renderTokenLadder(roundData, staticTokens) {
        tokenLadderEl.innerHTML = '';

        // Find max tokens in standard list to scale elements proportionally
        const maxTokens = Math.max(...roundData.map(r => r.standardInput + r.output));

        roundData.forEach(round => {
            const ladderRound = document.createElement('div');
            ladderRound.className = 'ladder-round';

            const roundLabel = document.createElement('span');
            roundLabel.className = 'round-num';
            roundLabel.textContent = `Turn ${round.roundNum}`;

            const track = document.createElement('div');
            track.className = 'round-bar-track';

            // Calculate percentage segments
            const cachedPct = (round.optimizedCached / maxTokens) * 100;
            const writePct = (round.optimizedWrite / maxTokens) * 100;
            const standardInputPct = (round.optimizedStandard / maxTokens) * 100;
            const outputPct = (round.output / maxTokens) * 100;

            // Segment 1: Cached static context (Emerald)
            if (cachedPct > 0) {
                const segCached = document.createElement('div');
                segCached.className = 'bar-segment bg-emerald';
                segCached.style.width = `${cachedPct}%`;
                segCached.setAttribute('data-tooltip', `Cached: ${round.optimizedCached.toLocaleString()} tokens ($${(round.optimizedCached * MODELS[modelSelector.value].rateCacheRead / 1000000).toFixed(4)})`);
                track.appendChild(segCached);
            }

            // Segment 2: Caching Write overhead (Cyan, only round 1)
            if (writePct > 0) {
                const segWrite = document.createElement('div');
                segWrite.className = 'bar-segment bg-cyan';
                segWrite.style.width = `${writePct}%`;
                segWrite.setAttribute('data-tooltip', `Cache Write: ${round.optimizedWrite.toLocaleString()} tokens ($${(round.optimizedWrite * MODELS[modelSelector.value].rateCacheWrite / 1000000).toFixed(4)})`);
                track.appendChild(segWrite);
            }

            // Segment 3: Dynamic user prompts & history (Coral)
            if (standardInputPct > 0) {
                const segStdInput = document.createElement('div');
                segStdInput.className = 'bar-segment bg-coral';
                segStdInput.style.width = `${standardInputPct}%`;
                segStdInput.setAttribute('data-tooltip', `Dynamic Input: ${round.optimizedStandard.toLocaleString()} tokens ($${(round.optimizedStandard * MODELS[modelSelector.value].rateInput / 1000000).toFixed(4)})`);
                track.appendChild(segStdInput);
            }

            // Segment 4: Model response output (translucent gray/white segment for visualization)
            if (outputPct > 0) {
                const segOutput = document.createElement('div');
                segOutput.className = 'bar-segment';
                segOutput.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                segOutput.style.width = `${outputPct}%`;
                segOutput.setAttribute('data-tooltip', `Response Output: ${round.output.toLocaleString()} tokens ($${(round.output * MODELS[modelSelector.value].rateOutput / 1000000).toFixed(4)})`);
                track.appendChild(segOutput);
            }

            ladderRound.appendChild(roundLabel);
            ladderRound.appendChild(track);
            tokenLadderEl.appendChild(ladderRound);
        });
    }

    // --- Side-by-Side Prompt Visualizer ---
    function renderPromptEditors(staticTokens) {
        // Construct visual representations
        const kbSizeStr = `${Math.round(staticTokens / 200)} KB`;
        
        // Dirty HTML
        editorDirty.innerHTML = `
<div class="visual-block block-red">
    <div class="block-label">⚠️ DYNAMIC VARIABLES (Breaks Cache Prefix Match)</div>
    <div class="block-info">Placing changing items here causes the cache prefix check to fail immediately for all text below.</div>
    <pre class="block-code">{{user_name = "Alex_Dev_99"}}
{{timestamp = "${new Date().toISOString()}"}}</pre>
</div>

<div class="visual-block block-gray">
    <div class="block-label">🔒 STATIC RULES & CONTEXT (Charged at 100% Full Price)</div>
    <div class="block-info">Because the dynamic variables above are constantly changing, this block cannot match the cache prefix.</div>
    <pre class="block-code"># Size: ${staticTokens.toLocaleString()} tokens (${kbSizeStr})
You are an advanced AI engineering partner. Your role is
to strictly analyze code using the following developer rules...
[Hundreds of lines of static coding specifications here]</pre>
</div>
        `.trim();

        // Clean HTML
        editorClean.innerHTML = `
<div class="visual-block block-green">
    <div class="block-label">✅ SECURED CACHED PREFIX (Processed at 90% DISCOUNT)</div>
    <div class="block-info">This static block stays 100% identical. Billed at just $0.30/M tokens!</div>
    <pre class="block-code"># Size: ${staticTokens.toLocaleString()} tokens (${kbSizeStr})
You are an advanced AI engineering partner. Your role is
to strictly analyze code using the following developer rules...
[Hundreds of lines of static coding specifications here]</pre>
</div>

<div class="visual-block block-blue">
    <div class="block-label">⚡ DYNAMIC PAYLOAD (Appended at the end)</div>
    <div class="block-info">Dynamic variables are placed here so they do not disturb the cached prefix above.</div>
    <pre class="block-code">{{user_name = "Alex_Dev_99"}}
{{timestamp = "${new Date().toISOString()}"}}
Query: "Explain prompt caching rules"</pre>
</div>
        `.trim();
    }

    // --- SDK Code Generator Templates ---
    function renderCodeSnippets(modelKey, staticTokens) {
        const model = MODELS[modelKey];
        sdkTipTextEl.textContent = model.tip;

        let pyCode = '';
        let nodeCode = '';

        if (modelKey.startsWith('claude-')) {
            let modelId = 'claude-3-5-sonnet-20241022';
            if (modelKey === 'claude-haiku') modelId = 'claude-3-5-haiku-20241022';
            if (modelKey === 'claude-opus') modelId = 'claude-3-opus-20240229';

            pyCode = `
import anthropic

client = anthropic.Anthropic()

# 💡 AetherCache Caching Architecture
# Move the massive static context to the SYSTEM block
# and set the 'ephemeral' cache_control parameter.

response = client.beta.prompt_caching.messages.create(
    model="${modelId}",
    max_tokens=1000,
    system=[
        {
            "type": "text",
            "text": "System Rules... [Static Guidelines: ${staticTokens.toLocaleString()} tokens]",
            "cache_control": {"type": "ephemeral"} # 🟢 System Cached prefix
        }
    ],
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "User metadata: Alex_Dev_99\\nUser Question: Explain prompt caching rules"
                }
            ]
        }
    ]
)
print(response.content[0].text)
            `.trim();

            nodeCode = `
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// 💡 AetherCache Caching Architecture
// Keep static context inside system blocks with cache_control type: 'ephemeral'
async function main() {
  const response = await anthropic.beta.promptCaching.messages.create({
    model: '${modelId}',
    max_tokens: 1000,
    system: [
      {
        type: 'text',
        text: 'System Rules... [Static Guidelines: ${staticTokens.toLocaleString()} tokens]',
        cache_control: { type: 'ephemeral' } // 🟢 System Cached prefix
      }
    ],
    messages: [
      {
        role: 'user',
        content: 'User metadata: Alex_Dev_99\\nUser Question: Explain prompt caching rules'
      }
    ]
  });
  console.log(response.content[0].text);
}
main();
            `.trim();
        } else if (modelKey.startsWith('gpt-')) {
            let modelId = 'gpt-4o';
            if (modelKey === 'gpt-4o-mini') modelId = 'gpt-4o-mini';

            pyCode = `
import openai

client = openai.OpenAI()

# 💡 OpenAI Prompt Caching is automatic!
# But it only triggers in blocks of 1024 tokens.
# To benefit, keep the dynamic variables strictly at the end,
# and ensure the static system block at the top remains 100% identical.

response = client.chat.completions.create(
    model="${modelId}",
    messages=[
        {
            "role": "system",
            "content": "System Rules... [Static Guidelines: ${staticTokens.toLocaleString()} tokens]" # 🟢 Automatic cache match
        },
        {
            "role": "user",
            "content": "User metadata: Alex_Dev_99\\nUser Question: Explain prompt caching rules" # 🔴 Dynamic tail
        }
    ]
)
print(response.choices[0].message.content)
            `.trim();

            nodeCode = `
import OpenAI from 'openai';

const openai = new OpenAI();

// 💡 OpenAI Prompt Caching is automatic!
// Ensure the massive static block stays exactly identical
// and keep all dynamic changes (username, date) at the tail end.
async function main() {
  const completion = await openai.chat.completions.create({
    model: '${modelId}',
    messages: [
      {
        role: 'system',
        content: 'System Rules... [Static Guidelines: ${staticTokens.toLocaleString()} tokens]' // 🟢 Automatic cache match
      },
      {
        role: 'user',
        content: 'User metadata: Alex_Dev_99\\nUser Question: Explain prompt caching rules' // 🔴 Dynamic tail
      }
    ]
  });
  console.log(completion.choices[0].message.content);
}
main();
            `.trim();
        } else if (modelKey.startsWith('gemini-')) {
            let modelId = 'models/gemini-1.5-pro-002';
            if (modelKey === 'gemini-flash') modelId = 'models/gemini-1.5-flash-002';

            pyCode = `
from google import genai
from google.genai import types

client = genai.Client()

# 💡 Google Gemini Prompt Caching
# Explicitly create a cached content resource for massive static data,
# and link it to your active generation queries.

# 1. Create a cached reference content resource
cache = client.caches.create(
    model="${modelId}",
    config=types.CreateCachedContentConfig(
        contents=[
            types.Content(
                role="user",
                parts=[types.Part.from_text("System Rules... [Static Context: ${staticTokens.toLocaleString()} tokens]")]
            )
        ],
        ttl="300s" # Expire cache in 5 minutes of idle
    )
)

# 2. Query the model referencing the active cache ID
response = client.models.generate_content(
    model="${modelId}",
    contents="User metadata: Alex_Dev_99\\nUser Question: Explain prompt caching rules",
    config=types.GenerateContentConfig(
        cached_content=cache.name # 🟢 Links active cached context
    )
)
print(response.text)
            `.trim();

            nodeCode = `
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI();

// 💡 Google Gemini Prompt Caching
// Pre-create the cache reference, and link it via GenerateContentConfig
async function main() {
  // 1. Create the cache block
  const cache = await ai.caches.create({
    model: '${modelId}',
    config: {
      contents: [
        {
          role: 'user',
          parts: [{ text: 'System Rules... [Static Context: ${staticTokens.toLocaleString()} tokens]' }]
        }
      ],
      ttl: '300s' // Expire cache in 5 minutes of idle
    }
  });

  // 2. Query Gemini utilizing the cache config pointer
  const response = await ai.models.generateContent({
    model: '${modelId}',
    contents: 'User metadata: Alex_Dev_99\\nUser Question: Explain prompt caching rules',
    config: {
      cachedContent: cache.name // 🟢 Links active cached context
    }
  });
  console.log(response.text);
}
main();
            `.trim();
        } else if (modelKey === 'deepseek-v3') {
            pyCode = `
import openai

# 💡 DeepSeek API uses standard OpenAI SDK but connects to DeepSeek endpoints
# Caching is fully automatic for prefixes that match 1024-token boundaries.
# Keep the static guidelines identical at the top, and queries at the tail.

client = openai.OpenAI(
    base_url="https://api.deepseek.com",
    api_key="your_deepseek_api_key"
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {
            "role": "system",
            "content": "System Rules... [Static Guidelines: ${staticTokens.toLocaleString()} tokens]" # 🟢 Matches cached prefix
        },
        {
            "role": "user",
            "content": "User metadata: Alex_Dev_99\\nUser Question: Explain prompt caching rules" # 🔴 Dynamic query
        }
    ]
)
print(response.choices[0].message.content)
            `.trim();

            nodeCode = `
import OpenAI from 'openai';

// 💡 DeepSeek API uses standard OpenAI SDK but connects to DeepSeek endpoints
// Caching is fully automatic for prefixes that match 1024-token boundaries.
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: 'your_deepseek_api_key'
});

async function main() {
  const completion = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: 'System Rules... [Static Guidelines: ${staticTokens.toLocaleString()} tokens]' // 🟢 Matches cached prefix
      },
      {
        role: 'user',
        content: 'User metadata: Alex_Dev_99\\nUser Question: Explain prompt caching rules' // 🔴 Dynamic query
      }
    ]
  });
  console.log(completion.choices[0].message.content);
}
main();
            `.trim();
        }

        // Set compiled code block text
        codeSnippetEl.textContent = activeLang === 'python' ? pyCode : nodeCode;
    }

    // --- Interactive Action Handlers ---

    // Sliders
    const inputs = [sliderQueries, sliderStatic, sliderDynamic, sliderTurns, modelSelector];
    inputs.forEach(input => {
        input.addEventListener('input', updateSimulation);
    });

    // SDK Code switcher
    tabPy.addEventListener('click', () => {
        tabPy.classList.add('active');
        tabNode.classList.remove('active');
        activeLang = 'python';
        updateSimulation();
    });

    tabNode.addEventListener('click', () => {
        tabNode.classList.add('active');
        tabPy.classList.remove('active');
        activeLang = 'node';
        updateSimulation();
    });

    // Copy to clipboard
    copyCodeBtn.addEventListener('click', () => {
        const textToCopy = codeSnippetEl.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            copyCodeBtn.classList.add('copied');
            const btnSpan = copyCodeBtn.querySelector('span');
            const originalText = btnSpan.textContent;
            btnSpan.textContent = 'Copied!';
            
            setTimeout(() => {
                copyCodeBtn.classList.remove('copied');
                btnSpan.textContent = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Clipboard copy failed: ', err);
        });
    });

    // Initial Trigger
    updateSimulation();
});
