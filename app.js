/* ==========================================================================
   AetherCache B2B App Controller — Smooth Interactive Financial Simulator
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // --- State and Constants ---
    const MODELS = {
        'claude-sonnet': {
            name: 'Claude 3.5 Sonnet',
            savingsRatio: 0.75, // Save 75% on average with optimized cache
            evictionMinutes: 5,
            tip: 'Anthropic caches expire completely after 5 minutes of idle silence.'
        },
        'claude-haiku': {
            name: 'Claude 3.5 Haiku',
            savingsRatio: 0.70,
            evictionMinutes: 5,
            tip: 'Haiku’s cheap prompt cache evicts after 5 minutes of inactivity.'
        },
        'claude-opus': {
            name: 'Claude 3.0 Opus',
            savingsRatio: 0.78,
            evictionMinutes: 5,
            tip: 'Opus caches expire after 5 minutes. Letting them evict is highly penalizing.'
        },
        'gpt-4o': {
            name: 'GPT-4o',
            savingsRatio: 0.40, // Save 40% on average
            evictionMinutes: 10,
            tip: 'OpenAI automatically caches in blocks, but evicts caches after ~10 minutes.'
        },
        'gpt-4o-mini': {
            name: 'GPT-4o-mini',
            savingsRatio: 0.38,
            evictionMinutes: 10,
            tip: 'GPT-4o-mini evicts inactive caches quickly.'
        },
        'gemini-pro': {
            name: 'Gemini 1.5 Pro',
            savingsRatio: 0.45,
            evictionMinutes: 5,
            tip: 'Google Gemini prompt caching evicts after 5 minutes of inactivity.'
        },
        'gemini-flash': {
            name: 'Gemini 1.5 Flash',
            savingsRatio: 0.42,
            evictionMinutes: 5,
            tip: 'Gemini Flash cache expires after 5 minutes of inactivity.'
        },
        'deepseek-v3': {
            name: 'DeepSeek-V3',
            savingsRatio: 0.45,
            evictionMinutes: 10,
            tip: 'DeepSeek-V3 caches evict during idle periods (approx 10 minutes).'
        }
    };

    // --- DOM Selectors ---
    const modelSelector = document.getElementById('model-selector');
    const sliderSpend = document.getElementById('slider-spend');
    const sliderTime = document.getElementById('slider-time');
    const heartbeatToggle = document.getElementById('heartbeat-toggle');

    const txtSpend = document.getElementById('val-spend-txt');
    const txtTime = document.getElementById('val-time-txt');
    const evictionTip = document.getElementById('eviction-tip');

    const costStandardEl = document.getElementById('cost-standard');
    const costOptimizedEl = document.getElementById('cost-optimized');
    const roiSavingsEl = document.getElementById('roi-savings');
    const annualSavingsEl = document.getElementById('annual-savings');
    const roiMultiplierEl = document.getElementById('roi-multiplier');

    const cacheTempFill = document.getElementById('cache-temp-fill');
    const cacheStatePill = document.getElementById('cache-state-pill');
    const cacheStateText = document.getElementById('cache-state-text');
    const leakageWarning = document.getElementById('leakage-warning');
    const heartbeatStatusBadge = document.getElementById('heartbeat-status-badge');

    const apiKeyInput = document.getElementById('api-key-input');
    const generateBtn = document.getElementById('generate-btn');
    const outcomeBox = document.getElementById('outcome-box');
    const gatewayUrlEl = document.getElementById('gateway-url');
    const copyUrlBtn = document.getElementById('copy-url-btn');

    // --- Calculation and Simulation Engine ---
    function updateSimulator() {
        const modelKey = modelSelector.value;
        const model = MODELS[modelKey];

        const standardSpend = parseInt(sliderSpend.value, 10);
        const elapsedMinutes = parseInt(sliderTime.value, 10);

        // Update basic spend text
        txtSpend.textContent = `$${standardSpend.toLocaleString()}`;
        evictionTip.textContent = model.tip;

        // Base Savings Ratio
        let savingsRatio = model.savingsRatio;
        let cacheIntegrity = 100;

        // Protection check
        if (heartbeatToggle.checked) {
            // Locking protection visual parameters
            sliderTime.value = 0;
            txtTime.textContent = "0 mins (Warm)";
            heartbeatStatusBadge.textContent = "PROTECTION ACTIVE";
            heartbeatStatusBadge.className = "toggle-label";

            cacheTempFill.style.width = "100%";
            cacheTempFill.className = "progress-bar-fill bg-emerald-gradient";
            cacheStatePill.className = "status-pill state-warm";
            cacheStatePill.textContent = "100% WARM & SECURED";
            cacheStateText.textContent = "AetherPing heartbeats are active. Caching discounts are successfully secured 24/7.";
            leakageWarning.style.display = "none";
        } else {
            // Heartbeat disabled, cache cooling down
            heartbeatStatusBadge.textContent = "PROTECTION DISABLED";
            heartbeatStatusBadge.className = "toggle-label inactive";
            txtTime.textContent = `${elapsedMinutes} mins`;

            const evictionLimit = model.evictionMinutes;

            if (elapsedMinutes < evictionLimit) {
                // Cooling state
                cacheIntegrity = Math.max(0, 100 - (elapsedMinutes * (100 / evictionLimit)));
                cacheTempFill.style.width = `${cacheIntegrity}%`;
                cacheTempFill.className = "progress-bar-fill bg-emerald-gradient";
                cacheStatePill.className = "status-pill state-warm";
                cacheStatePill.textContent = `${Math.round(cacheIntegrity)}% WARM (Cooling)`;
                cacheStateText.textContent = `Your cache is cooling down. It will evict completely in ${evictionLimit - elapsedMinutes} minute(s) of idle silence.`;
                leakageWarning.style.display = "none";

                // Savings ratio decays with temperature
                savingsRatio = savingsRatio * (cacheIntegrity / 100);
            } else {
                // Expired cold state
                cacheIntegrity = 0;
                cacheTempFill.style.width = "0%";
                cacheTempFill.className = "progress-bar-fill bg-red-gradient";
                cacheStatePill.className = "status-pill state-cold";
                cacheStatePill.textContent = "EXPIRED (Evicted)";
                cacheStateText.textContent = "Your prompt cache expired. Caching discounts have been lost.";
                
                // Alert banner
                leakageWarning.style.display = "flex";
                document.getElementById('leakage-desc-text').textContent = `Your cache expired after ${elapsedMinutes} minutes of idle silence. Next query will pay full standard cost.`;

                // 0 savings realized
                savingsRatio = 0;
            }
        }

        // Financial calculations
        const savingsValue = standardSpend * savingsRatio;
        const optimizedCost = standardSpend - savingsValue;
        const annualSavings = savingsValue * 12;

        // Offset ROI (based on $99/mo standard Startup sub)
        const offsetMultiplier = savingsValue / 99;

        // Update DOM
        costStandardEl.textContent = `$${Math.round(standardSpend).toLocaleString()}`;
        costOptimizedEl.textContent = `$${Math.round(optimizedCost).toLocaleString()}`;
        roiSavingsEl.textContent = `$${Math.round(savingsValue).toLocaleString()}`;
        annualSavingsEl.textContent = `$${Math.round(annualSavings).toLocaleString()} / year`;
        roiMultiplierEl.textContent = `${offsetMultiplier.toFixed(1)}x`;
    }

    // --- Onboarding base URL Generator ---
    generateBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            alert('Please enter a secure API key first.');
            return;
        }

        // Simulate secure AES hash generation for proxy mapping
        const shortHash = Math.random().toString(36).substring(2, 10);
        
        gatewayUrlEl.textContent = `https://api.aethercache.com/v1/ae_live_${shortHash}`;
        outcomeBox.style.display = 'flex';
        
        // Auto scroll to outcome box smoothly
        outcomeBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    // --- Copy to clipboard action ---
    copyUrlBtn.addEventListener('click', () => {
        const urlText = gatewayUrlEl.textContent;
        navigator.clipboard.writeText(urlText).then(() => {
            copyUrlBtn.classList.add('copied');
            const btnSpan = copyUrlBtn.querySelector('span');
            btnSpan.textContent = 'Copied!';
            
            setTimeout(() => {
                copyUrlBtn.classList.remove('copied');
                btnSpan.textContent = 'Copy URL';
            }, 2000);
        }).catch(err => {
            console.error('Clipboard copy failed: ', err);
        });
    });

    // --- Event Listeners ---
    const inputs = [modelSelector, sliderSpend, sliderTime];
    inputs.forEach(input => {
        input.addEventListener('input', updateSimulator);
    });

    heartbeatToggle.addEventListener('change', updateSimulator);

    // Run Initial Simulation calculations
    updateSimulator();
});
