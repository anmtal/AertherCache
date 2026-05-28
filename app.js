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
            bestPingMinutes: 4.5,
            tip: 'Anthropic caches expire completely after 5 minutes of idle silence.',
            instructions: {
                title: 'HOW TO FIND YOUR ANTHROPIC KEY:',
                text: "Sign in to your Anthropic Console -> navigate to 'API Keys' in the sidebar -> click 'Create Key'. Copy your key immediately (it starts with 'sk-ant-')."
            }
        },
        'claude-haiku': {
            name: 'Claude 3.5 Haiku',
            savingsRatio: 0.70,
            evictionMinutes: 5,
            bestPingMinutes: 4.5,
            tip: 'Haiku’s cheap prompt cache evicts after 5 minutes of inactivity.',
            instructions: {
                title: 'HOW TO FIND YOUR ANTHROPIC KEY:',
                text: "Sign in to your Anthropic Console -> navigate to 'API Keys' in the sidebar -> click 'Create Key'. Copy your key immediately (it starts with 'sk-ant-')."
            }
        },
        'claude-opus': {
            name: 'Claude 3.0 Opus',
            savingsRatio: 0.78,
            evictionMinutes: 5,
            bestPingMinutes: 4.5,
            tip: 'Opus caches expire after 5 minutes. Letting them evict is highly penalizing.',
            instructions: {
                title: 'HOW TO FIND YOUR ANTHROPIC KEY:',
                text: "Sign in to your Anthropic Console -> navigate to 'API Keys' in the sidebar -> click 'Create Key'. Copy your key immediately (it starts with 'sk-ant-')."
            }
        },
        'gpt-4o': {
            name: 'GPT-4o',
            savingsRatio: 0.40, // Save 40% on average
            evictionMinutes: 10,
            bestPingMinutes: 9.0,
            tip: 'OpenAI automatically caches in blocks, but evicts caches after ~10 minutes.',
            instructions: {
                title: 'HOW TO FIND YOUR OPENAI KEY:',
                text: "Go to your OpenAI Platform Dashboard -> select the 'API Keys' tab -> click 'Create secret key'. Note your key securely (it starts with 'sk-proj-')."
            }
        },
        'gpt-4o-mini': {
            name: 'GPT-4o-mini',
            savingsRatio: 0.38,
            evictionMinutes: 10,
            bestPingMinutes: 9.0,
            tip: 'GPT-4o-mini evicts inactive caches quickly.',
            instructions: {
                title: 'HOW TO FIND YOUR OPENAI KEY:',
                text: "Go to your OpenAI Platform Dashboard -> select the 'API Keys' tab -> click 'Create secret key'. Note your key securely (it starts with 'sk-proj-')."
            }
        },
        'gemini-pro': {
            name: 'Gemini 1.5 Pro',
            savingsRatio: 0.45,
            evictionMinutes: 5,
            bestPingMinutes: 4.5,
            tip: 'Google Gemini prompt caching evicts after 5 minutes of inactivity.',
            instructions: {
                title: 'HOW TO FIND YOUR GOOGLE GEMINI KEY:',
                text: "Sign in to Google AI Studio -> click the prominent 'Get API key' button in the top left menu -> copy your secure key string (starts with 'AIzaSy')."
            }
        },
        'gemini-flash': {
            name: 'Gemini 1.5 Flash',
            savingsRatio: 0.42,
            evictionMinutes: 5,
            bestPingMinutes: 4.5,
            tip: 'Gemini Flash cache expires after 5 minutes of inactivity.',
            instructions: {
                title: 'HOW TO FIND YOUR GOOGLE GEMINI KEY:',
                text: "Sign in to Google AI Studio -> click the prominent 'Get API key' button in the top left menu -> copy your secure key string (starts with 'AIzaSy')."
            }
        },
        'deepseek-v3': {
            name: 'DeepSeek-V3',
            savingsRatio: 0.45,
            evictionMinutes: 10,
            bestPingMinutes: 9.0,
            tip: 'DeepSeek-V3 caches evict during idle periods (approx 10 minutes).',
            instructions: {
                title: 'HOW TO FIND YOUR DEEPSEEK KEY:',
                text: "Access your DeepSeek Developer Platform Console -> click on the 'API Keys' tab -> click 'Create API Key'. Copy it safely (starts with 'sk-')."
            }
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

    // Dynamic Key Finder Instructions Elements
    const keyInstructionsTitle = document.getElementById('key-instructions-title');
    const keyInstructionsText = document.getElementById('key-instructions-text');

    // Authentication Elements
    const loginBtn = document.getElementById('login-btn');
    const userProfile = document.getElementById('user-profile');
    const userEmailText = document.getElementById('user-email-text');
    const logoutBtn = document.getElementById('logout-btn');

    const authModal = document.getElementById('auth-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const authForm = document.getElementById('auth-form');
    const authEmail = document.getElementById('auth-email');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authToggleType = document.getElementById('auth-toggle-type');

    // Live Telemetry Indicator
    const liveTelemetryBadge = document.querySelector('.live-telemetry-badge');

    // --- Authentication Actions & UI Updates ---
    function checkLoginState() {
        const loggedInUser = localStorage.getItem('aether_user');
        if (loggedInUser) {
            loginBtn.style.display = 'none';
            userProfile.style.display = 'flex';
            userEmailText.textContent = loggedInUser;
            // Set user initials as avatar
            document.querySelector('.user-avatar').textContent = loggedInUser.charAt(0).toUpperCase();
            
            // If API key is saved, automatically populate outcome gateway URL
            const savedKey = localStorage.getItem('aether_key_vaulted');
            if (savedKey) {
                apiKeyInput.value = savedKey;
                generateGatewayURL(savedKey, loggedInUser);
            }
        } else {
            loginBtn.style.display = 'block';
            userProfile.style.display = 'none';
            outcomeBox.style.display = 'none';
            apiKeyInput.value = '';
        }
    }

    function openAuthModal() {
        authModal.classList.add('active');
        authEmail.focus();
    }

    function closeAuthModal() {
        authModal.classList.remove('active');
    }

    function doMockLogin(email) {
        localStorage.setItem('aether_user', email);
        closeAuthModal();
        checkLoginState();
        updateSimulator();
    }

    // --- Onboarding base URL Generator ---
    function generateGatewayURL(key, email) {
        // Derive a unique hash from email or inputs for personalized gateway endpoint
        const hashBase = email || 'guest';
        const uniqueHash = btoa(hashBase).substring(0, 8).toLowerCase();
        
        gatewayUrlEl.textContent = `https://api.aethercache.com/v1/ae_live_${uniqueHash}`;
        outcomeBox.style.display = 'flex';

        // Swap the telemetry dashboard badge to denote active connection
        if (liveTelemetryBadge) {
            liveTelemetryBadge.textContent = '📊 Gateway Sync Live';
            liveTelemetryBadge.style.backgroundColor = 'rgba(6, 182, 212, 0.1)';
            liveTelemetryBadge.style.color = '#06b6d4';
            liveTelemetryBadge.style.borderColor = 'rgba(6, 182, 212, 0.2)';
        }
    }

    // --- Calculation and Simulation Engine ---
    function updateSimulator() {
        const modelKey = modelSelector.value;
        const model = MODELS[modelKey];

        const standardSpend = parseInt(sliderSpend.value, 10);
        const elapsedMinutes = parseInt(sliderTime.value, 10);

        // Update spend text and model tips
        txtSpend.textContent = `$${standardSpend.toLocaleString()}`;
        evictionTip.textContent = model.tip;

        // Dynamic API Key instructions based on the selected LLM Model
        if (keyInstructionsTitle && keyInstructionsText) {
            keyInstructionsTitle.textContent = model.instructions.title;
            keyInstructionsText.textContent = model.instructions.text;
        }

        // Base Savings Ratio
        let savingsRatio = model.savingsRatio;
        let cacheIntegrity = 100;

        // Protection check (Automated heartbeats scheduled by our proxy system)
        if (heartbeatToggle.checked) {
            // Lock simulator visually because active protection ensures continuous 100% warm cache
            sliderTime.value = 0;
            txtTime.textContent = "0 mins (Warm)";
            heartbeatStatusBadge.textContent = "PROTECTION ACTIVE";
            heartbeatStatusBadge.className = "toggle-label";

            cacheTempFill.style.width = "100%";
            cacheTempFill.className = "progress-bar-fill bg-emerald-gradient";
            cacheStatePill.className = "status-pill state-warm";
            cacheStatePill.textContent = "100% WARM & SECURED";
            
            // Dynamic message displaying the System's auto-scheduled ping interval
            cacheStateText.textContent = `Active protection enabled. AetherPing automatically sends a warm-up heartbeat every ${model.bestPingMinutes} minutes based on ${model.name}'s specifications.`;
            leakageWarning.style.display = "none";
        } else {
            // Heartbeat disabled, cache cooling down based on manual slider
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
                document.getElementById('leakage-desc-text').textContent = `Your cache expired after ${elapsedMinutes} minutes of idle silence. Caching discounts are lost. Turn on protection to automatically trigger ${model.bestPingMinutes}-min heartbeats.`;

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

        // Update Dashboard cost elements
        costStandardEl.textContent = `$${Math.round(standardSpend).toLocaleString()}`;
        costOptimizedEl.textContent = `$${Math.round(optimizedCost).toLocaleString()}`;
        roiSavingsEl.textContent = `$${Math.round(savingsValue).toLocaleString()}`;
        annualSavingsEl.textContent = `$${Math.round(annualSavings).toLocaleString()} / year`;
        roiMultiplierEl.textContent = `${offsetMultiplier.toFixed(1)}x`;
    }

    // --- Onboarding Event Handlers ---
    generateBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        const loggedInUser = localStorage.getItem('aether_user');

        if (!loggedInUser) {
            // Auto open Login Modal if user is not signed in
            alert('Please sign in to your custom dashboard account first to vault your API key.');
            openAuthModal();
            return;
        }

        if (!key) {
            alert('Please enter a secure API key first.');
            return;
        }

        // Securely vault key locally for simulated user persistence
        localStorage.setItem('aether_key_vaulted', key);
        generateGatewayURL(key, loggedInUser);
        
        // Scroll smoothly to outcome box
        outcomeBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

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

    // --- Authentication Event Handlers ---
    loginBtn.addEventListener('click', openAuthModal);
    modalCloseBtn.addEventListener('click', closeAuthModal);
    
    // Close modal on background click
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });

    googleLoginBtn.addEventListener('click', () => {
        doMockLogin('google.partner@company.com');
    });

    authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = authEmail.value.trim();
        if (email) {
            doMockLogin(email);
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('aether_user');
        localStorage.removeItem('aether_key_vaulted');
        
        // Reset telemetry dashboard badge to simulated
        if (liveTelemetryBadge) {
            liveTelemetryBadge.textContent = '📊 Live Dashboard';
            liveTelemetryBadge.style.backgroundColor = '';
            liveTelemetryBadge.style.color = '';
            liveTelemetryBadge.style.borderColor = '';
        }

        checkLoginState();
        updateSimulator();
    });

    // Toggle auth form modes (login/signup)
    authToggleType.addEventListener('click', () => {
        const title = authModal.querySelector('.modal-title-wrapper h3');
        const desc = authModal.querySelector('.modal-title-wrapper p');
        
        if (authSubmitBtn.textContent === 'Secure Login') {
            title.textContent = 'Create Enterprise Account';
            desc.textContent = 'Start saving thousands on your LLM bills with custom gateways.';
            authSubmitBtn.textContent = 'Register Account';
            authToggleType.textContent = 'Already have an account? Sign in';
        } else {
            title.textContent = 'Welcome to AetherCache';
            desc.textContent = 'Sign in to unlock your secure key vault and custom gateways.';
            authSubmitBtn.textContent = 'Secure Login';
            authToggleType.textContent = "Don't have an enterprise account? Create one";
        }
    });

    // --- Inputs Event Listeners ---
    const inputs = [modelSelector, sliderSpend, sliderTime];
    inputs.forEach(input => {
        input.addEventListener('input', updateSimulator);
    });

    heartbeatToggle.addEventListener('change', updateSimulator);

    // --- Initial Startup Check ---
    checkLoginState();
    updateSimulator();
});
