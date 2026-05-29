/* ==========================================================================
   AetherCache B2B App Controller — Smooth Interactive Financial Simulator
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // --- State and Constants ---
    const MODELS = {
        'claude-sonnet': {
            name: 'Claude 3.5 Sonnet',
            savingsRatio: 0.75, // Save 75% on average with optimized cache
            bestPingMinutes: 4.5,
            instructions: {
                title: 'HOW TO FIND YOUR ANTHROPIC KEY:',
                text: "Sign in to your Anthropic Console -> navigate to 'API Keys' in the sidebar -> click 'Create Key'. Copy your key immediately (starts with 'sk-ant-')."
            }
        },
        'claude-haiku': {
            name: 'Claude 3.5 Haiku',
            savingsRatio: 0.70,
            bestPingMinutes: 4.5,
            instructions: {
                title: 'HOW TO FIND YOUR ANTHROPIC KEY:',
                text: "Sign in to your Anthropic Console -> navigate to 'API Keys' in the sidebar -> click 'Create Key'. Copy your key immediately (starts with 'sk-ant-')."
            }
        },
        'claude-opus': {
            name: 'Claude 3.0 Opus',
            savingsRatio: 0.78,
            bestPingMinutes: 4.5,
            instructions: {
                title: 'HOW TO FIND YOUR ANTHROPIC KEY:',
                text: "Sign in to your Anthropic Console -> navigate to 'API Keys' in the sidebar -> click 'Create Key'. Copy your key immediately (starts with 'sk-ant-')."
            }
        },
        'gpt-4o': {
            name: 'GPT-4o',
            savingsRatio: 0.40, // Save 40% on average
            bestPingMinutes: 9.0,
            instructions: {
                title: 'HOW TO FIND YOUR OPENAI KEY:',
                text: "Go to your OpenAI Platform Dashboard -> select the 'API Keys' tab -> click 'Create secret key'. Note your key securely (starts with 'sk-proj-')."
            }
        },
        'gpt-4o-mini': {
            name: 'GPT-4o-mini',
            savingsRatio: 0.38,
            bestPingMinutes: 9.0,
            instructions: {
                title: 'HOW TO FIND YOUR OPENAI KEY:',
                text: "Go to your OpenAI Platform Dashboard -> select the 'API Keys' tab -> click 'Create secret key'. Note your key securely (starts with 'sk-proj-')."
            }
        },
        'gemini-pro': {
            name: 'Gemini 1.5 Pro',
            savingsRatio: 0.45,
            bestPingMinutes: 4.5,
            instructions: {
                title: 'HOW TO FIND YOUR GOOGLE GEMINI KEY:',
                text: "Sign in to Google AI Studio -> click the prominent 'Get API key' button in the top left menu -> copy your secure key string (starts with 'AIzaSy')."
            }
        },
        'gemini-flash': {
            name: 'Gemini 1.5 Flash',
            savingsRatio: 0.42,
            bestPingMinutes: 4.5,
            instructions: {
                title: 'HOW TO FIND YOUR GOOGLE GEMINI KEY:',
                text: "Sign in to Google AI Studio -> click the prominent 'Get API key' button in the top left menu -> copy your secure key string (starts with 'AIzaSy')."
            }
        },
        'deepseek-v3': {
            name: 'DeepSeek-V3',
            savingsRatio: 0.45,
            bestPingMinutes: 9.0,
            instructions: {
                title: 'HOW TO FIND YOUR DEEPSEEK KEY:',
                text: "Access your DeepSeek Developer Platform Console -> click on the 'API Keys' tab -> click 'Create API Key'. Copy it safely (starts with 'sk-')."
            }
        }
    };

    // --- DOM Selectors ---
    const landingPageContainer = document.getElementById('landing-page-container');
    const clientDashboardContainer = document.getElementById('client-dashboard-container');

    // LANDING VIEW Selectors
    const modelSelector = document.getElementById('model-selector');

    const cacheTempFill = document.getElementById('cache-temp-fill');
    const cacheStatePill = document.getElementById('cache-state-pill');
    const cacheStateText = document.getElementById('cache-state-text');
    const heartbeatToggle = document.getElementById('heartbeat-toggle');
    const heartbeatStatusBadge = document.getElementById('heartbeat-status-badge');

    const apiKeyInput = document.getElementById('api-key-input');
    const generateBtn = document.getElementById('generate-btn');
    const outcomeBox = document.getElementById('outcome-box');
    const gatewayUrlEl = document.getElementById('gateway-url');
    const copyUrlBtn = document.getElementById('copy-url-btn');

    const keyInstructionsTitle = document.getElementById('key-instructions-title');
    const keyInstructionsText = document.getElementById('key-instructions-text');

    const costStandardEl = document.getElementById('cost-standard');
    const costOptimizedEl = document.getElementById('cost-optimized');
    const roiSavingsEl = document.getElementById('roi-savings');
    const kpiSavingsRate = document.getElementById('kpi-savings-rate');

    // DEDICATED CONSOLE VIEW Selectors
    const dashModelSelector = document.getElementById('dash-model-selector');
    const dashApiKeyInput = document.getElementById('dash-api-key-input');
    const dashKeyInstructionsTitle = document.getElementById('dash-key-instructions-title');
    const dashKeyInstructionsText = document.getElementById('dash-key-instructions-text');
    const dashGenerateBtn = document.getElementById('dash-generate-btn');
    const dashOutcomeBox = document.getElementById('dash-outcome-box');
    const dashGatewayUrlEl = document.getElementById('dash-gateway-url');
    const dashCopyUrlBtn = document.getElementById('dash-copy-url-btn');

    const dashHeartbeatToggle = document.getElementById('dash-heartbeat-toggle');
    const dashHeartbeatStatusBadge = document.getElementById('dash-heartbeat-status-badge');
    const dashCacheTempFill = document.getElementById('dash-cache-temp-fill');
    const dashCacheStatePill = document.getElementById('dash-cache-state-pill');
    const dashCacheStateText = document.getElementById('dash-cache-state-text');

    // Header & Auth Selectors
    const loginBtn = document.getElementById('login-btn');
    const userProfile = document.getElementById('user-profile');
    const userEmailText = document.getElementById('user-email-text');
    const logoutBtn = document.getElementById('logout-btn');
    const headerStatusContainer = document.getElementById('header-status-container');

    const authModal = document.getElementById('auth-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const authForm = document.getElementById('auth-form');
    const authEmail = document.getElementById('auth-email');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authToggleType = document.getElementById('auth-toggle-type');

    const liveTelemetryBadge = document.querySelector('.live-telemetry-badge');

    // --- Authentication & Workspace state swapping ---
    function checkLoginState() {
        const loggedInUser = localStorage.getItem('aether_user');
        const isPaid = localStorage.getItem('aether_paid') === 'true';

        if (loggedInUser) {
            loginBtn.style.display = 'none';
            userProfile.style.display = 'flex';
            userEmailText.textContent = loggedInUser;
            document.querySelector('.user-avatar').textContent = loggedInUser.charAt(0).toUpperCase();
            
            if (isPaid) {
                // Paid Lifecycle: Route to Separated Standalone Console Dashboard
                landingPageContainer.style.display = 'none';
                clientDashboardContainer.style.display = 'block';
                syncClientDashboard();
            } else {
                // Logged in but unpaid: Keep on Landing Page to prompt payment
                landingPageContainer.style.display = 'block';
                clientDashboardContainer.style.display = 'none';
                headerStatusContainer.style.display = 'block';
                headerStatusContainer.innerHTML = '<span class="unpaid-badge">● Unpaid Account</span>';
                
                const savedKey = localStorage.getItem('aether_key_vaulted');
                if (savedKey) {
                    apiKeyInput.value = savedKey;
                }
            }
        } else {
            // Logged out Visitor: Show Landing Page
            loginBtn.style.display = 'block';
            userProfile.style.display = 'none';
            headerStatusContainer.style.display = 'none';
            
            landingPageContainer.style.display = 'block';
            clientDashboardContainer.style.display = 'none';
            
            apiKeyInput.value = '';
            apiKeyInput.placeholder = 'Please sign in to configure key settings...';
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

    // --- Gateway URL Generator helper ---
    function generateGatewayURL(key, email, isConsole = false) {
        const hashBase = email || 'guest';
        const uniqueHash = btoa(hashBase).substring(0, 8).toLowerCase();
        
        // Dynamic localhost detection to connect frontend with server.js gateway
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const gatewayURL = isLocalHost 
            ? `http://localhost:3000/api/v1/chat/completions/ae_live_${uniqueHash}`
            : `https://api.aethercache.com/v1/ae_live_${uniqueHash}`;
        
        if (isConsole) {
            dashGatewayUrlEl.textContent = gatewayURL;
            dashOutcomeBox.style.display = 'flex';
        } else {
            gatewayUrlEl.textContent = gatewayURL;
            outcomeBox.style.display = 'flex';

            if (liveTelemetryBadge) {
                liveTelemetryBadge.textContent = '📊 Gateway Sync Live';
                liveTelemetryBadge.style.backgroundColor = 'rgba(6, 182, 212, 0.1)';
                liveTelemetryBadge.style.color = '#06b6d4';
                liveTelemetryBadge.style.borderColor = 'rgba(6, 182, 212, 0.2)';
            }
        }
    }

    // --- Standalone Console Synchronization ---
    function syncClientDashboard() {
        const modelKey = dashModelSelector.value;
        const model = MODELS[modelKey];
        const loggedInUser = localStorage.getItem('aether_user');

        // Update Active Model Display Heading
        const dashActiveModelDisplay = document.getElementById('dash-active-model-display');
        const dashStateDescription = document.getElementById('dash-state-description');
        const dashTempPercentage = document.getElementById('dash-temp-percentage');

        if (dashActiveModelDisplay) {
            dashActiveModelDisplay.textContent = model.name;
        }

        // Dynamic Key Instructions per model
        if (dashKeyInstructionsTitle && dashKeyInstructionsText) {
            dashKeyInstructionsTitle.textContent = model.instructions.title;
            dashKeyInstructionsText.textContent = model.instructions.text;
        }

        // Check vaulted credentials
        const savedKey = localStorage.getItem('aether_key_vaulted');
        if (savedKey) {
            dashApiKeyInput.value = savedKey;
            generateGatewayURL(savedKey, loggedInUser, true);
        }

        // Active State Safeguards (Toggle ON)
        if (dashHeartbeatToggle && dashHeartbeatToggle.checked) {
            headerStatusContainer.innerHTML = '<div class="active-badge-glowing"><span class="pulse-dot"></span><span>Secure Gateway Active</span></div>';
            
            dashHeartbeatStatusBadge.textContent = "PROTECTION ACTIVE";
            dashHeartbeatStatusBadge.className = "toggle-label";

            dashCacheTempFill.style.width = "100%";
            dashCacheTempFill.className = "progress-bar-fill bg-emerald-gradient";
            dashCacheStatePill.className = "status-pill state-warm";
            dashCacheStatePill.textContent = "100% WARM & SECURED";
            dashCacheStateText.textContent = `Active safeguards running. Heartbeats are automated every ${model.bestPingMinutes} minutes to keep ${model.name}'s cache permanently warm.`;
            
            if (dashTempPercentage) {
                dashTempPercentage.textContent = "100%";
                dashTempPercentage.style.color = "var(--color-emerald)";
            }
            if (dashStateDescription) {
                dashStateDescription.textContent = "AetherPing active protection keeping your caches warm.";
                dashStateDescription.style.color = "var(--color-emerald)";
            }
            if (dashActiveModelDisplay) {
                dashActiveModelDisplay.classList.add('text-emerald-glow');
            }

            // GREY OUT and DISABLE inputs in Active state
            dashModelSelector.disabled = true;
            dashApiKeyInput.disabled = true;
            dashGenerateBtn.disabled = true;
            dashGenerateBtn.textContent = "🔒 Protection Active — Inputs Locked";
        } else {
            // Inactive State Safeguards (Toggle OFF)
            headerStatusContainer.innerHTML = '<span class="paid-account-badge">● Paid (Inactive)</span>';
            
            dashHeartbeatStatusBadge.textContent = "PROTECTION INACTIVE";
            dashHeartbeatStatusBadge.className = "toggle-label inactive";

            dashCacheTempFill.style.width = "0%";
            dashCacheTempFill.className = "progress-bar-fill bg-red-gradient";
            dashCacheStatePill.className = "status-pill state-cold";
            dashCacheStatePill.textContent = "INACTIVE";
            dashCacheStateText.textContent = "AetherPing is disabled. Your prompt cache has cooled down, and you are paying standard prices.";
            
            if (dashTempPercentage) {
                dashTempPercentage.textContent = "0%";
                dashTempPercentage.style.color = "var(--color-red)";
            }
            if (dashStateDescription) {
                dashStateDescription.textContent = "AetherPing is currently disabled. Caching safeguards are paused.";
                dashStateDescription.style.color = "var(--text-secondary)";
            }
            if (dashActiveModelDisplay) {
                dashActiveModelDisplay.classList.remove('text-emerald-glow');
            }

            // RE-ENABLE inputs when protection is turned OFF
            dashModelSelector.disabled = false;
            dashApiKeyInput.disabled = false;
            dashGenerateBtn.disabled = false;
            dashGenerateBtn.textContent = "Vault Settings & Sync Gateway";
        }

        // Sync with local backend if running locally on state swaps
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalHost && savedKey) {
            fetch('/api/v1/key/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: savedKey,
                    email: loggedInUser,
                    model: modelKey,
                    protectionActive: dashHeartbeatToggle.checked
                })
            }).catch(err => {});
        }
    }

    // --- Landing Simulator Engine ---
    function updateSimulator() {
        const loggedInUser = localStorage.getItem('aether_user');
        const isPaid = localStorage.getItem('aether_paid') === 'true';

        // Do not execute landing page simulator math if the client console is active
        if (loggedInUser && isPaid) return;

        const modelKey = modelSelector.value;
        const model = MODELS[modelKey];

        if (keyInstructionsTitle && keyInstructionsText) {
            keyInstructionsTitle.textContent = model.instructions.title;
            keyInstructionsText.textContent = model.instructions.text;
        }

        // Calculate and update dynamic savings costs & KPIs
        const standardSpend = 5000;
        const savingsRatio = model.savingsRatio;
        const savingsValue = standardSpend * savingsRatio;
        const optimizedCost = standardSpend - savingsValue;

        if (costStandardEl) costStandardEl.textContent = `$${Math.round(standardSpend).toLocaleString()}`;
        if (costOptimizedEl) costOptimizedEl.textContent = `$${Math.round(optimizedCost).toLocaleString()}`;
        if (roiSavingsEl) roiSavingsEl.textContent = `$${Math.round(savingsValue).toLocaleString()}`;
        if (kpiSavingsRate) kpiSavingsRate.textContent = `${Math.round(savingsRatio * 100)}%`;

        if (!loggedInUser) {
            // State 1: LOGGED OUT Visitor
            headerStatusContainer.style.display = 'none';
            
            if (heartbeatToggle) {
                heartbeatToggle.disabled = true;
                heartbeatToggle.checked = false;
                heartbeatStatusBadge.textContent = "PROTECTION LOCKED";
                heartbeatStatusBadge.className = "toggle-label inactive";
            }

            cacheTempFill.style.width = "0%";
            cacheTempFill.className = "progress-bar-fill bg-red-gradient";
            cacheStatePill.className = "status-pill state-cold";
            cacheStatePill.textContent = "INACTIVE";
            cacheStateText.textContent = "Safeguards locked. Please log in to your account and activate AetherPing.";

        } else {
            // State 2: LOGGED IN Unpaid Account
            headerStatusContainer.style.display = 'block';
            headerStatusContainer.innerHTML = '<span class="unpaid-badge">● Unpaid Account</span>';

            if (heartbeatToggle) {
                heartbeatToggle.disabled = true;
                heartbeatToggle.checked = false;
                heartbeatStatusBadge.textContent = "PROTECTION UNPAID";
                heartbeatStatusBadge.className = "toggle-label inactive";
            }

            cacheTempFill.style.width = "0%";
            cacheTempFill.className = "progress-bar-fill bg-red-gradient";
            cacheStatePill.className = "status-pill state-cold";
            cacheStatePill.textContent = "INACTIVE (Unpaid)";
            cacheStateText.textContent = "Automated safeguards disabled. Select a premium plan below to unlock protection.";
        }
    }

    // --- Onboarding Event Handlers ---
    generateBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        const loggedInUser = localStorage.getItem('aether_user');

        if (!loggedInUser) {
            alert('Please sign in to your dashboard account first to vault your API key.');
            openAuthModal();
            return;
        }

        alert('Please select and pay for one of the pricing plans below to unlock gateway endpoint creation.');
        document.querySelector('.pricing-section').scrollIntoView({ behavior: 'smooth' });
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

    // --- Dedicated Console Onboarding Event Handlers ---
    dashGenerateBtn.addEventListener('click', () => {
        const key = dashApiKeyInput.value.trim();
        const loggedInUser = localStorage.getItem('aether_user');

        if (!key) {
            alert('Please enter a secure API key first.');
            return;
        }

        localStorage.setItem('aether_key_vaulted', key);
        generateGatewayURL(key, loggedInUser, true);

        // Sync with local backend if running locally
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalHost) {
            const activeModel = dashModelSelector.value;
            const protectionActive = dashHeartbeatToggle.checked;

            fetch('/api/v1/key/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: key,
                    email: loggedInUser,
                    model: activeModel,
                    protectionActive: protectionActive
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    dashGatewayUrlEl.textContent = data.gatewayUrl;
                    console.log('Synchronized securely with local mock Edge Vault.');
                }
            })
            .catch(err => console.log('Local server connection offline. Running visual fallback.'));
        }
    });

    dashCopyUrlBtn.addEventListener('click', () => {
        const urlText = dashGatewayUrlEl.textContent;
        navigator.clipboard.writeText(urlText).then(() => {
            dashCopyUrlBtn.classList.add('copied');
            const btnSpan = dashCopyUrlBtn.querySelector('span');
            btnSpan.textContent = 'Copied!';
            
            setTimeout(() => {
                dashCopyUrlBtn.classList.remove('copied');
                btnSpan.textContent = 'Copy URL';
            }, 2000);
        }).catch(err => {
            console.error('Clipboard copy failed: ', err);
        });
    });

    // --- Authentication Event Handlers ---
    loginBtn.addEventListener('click', openAuthModal);
    modalCloseBtn.addEventListener('click', closeAuthModal);
    
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });

    // About modal overlay logic removed as About Us is now statically embedded

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
        localStorage.removeItem('aether_paid');
        localStorage.removeItem('aether_key_vaulted');
        
        if (liveTelemetryBadge) {
            liveTelemetryBadge.textContent = '📊 Live Dashboard';
            liveTelemetryBadge.style.backgroundColor = '';
            liveTelemetryBadge.style.color = '';
            liveTelemetryBadge.style.borderColor = '';
        }

        checkLoginState();
        updateSimulator();
    });

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

    // --- Plan Selection & Mock Purchase Event Handlers ---
    const pricingButtons = document.querySelectorAll('.plan-action-btn');
    pricingButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const loggedInUser = localStorage.getItem('aether_user');
            if (!loggedInUser) {
                alert('Please sign in to your dashboard account first to checkout and purchase a plan.');
                openAuthModal();
                return;
            }

            localStorage.setItem('aether_paid', 'true');
            alert('🎉 Subscription payment successful! Swapping view to your dedicated standalone gateway dashboard.');
            
            checkLoginState();
        });
    });

    // --- Inputs Event Listeners ---
    modelSelector.addEventListener('change', updateSimulator);
    modelSelector.addEventListener('input', updateSimulator);
    
    if (heartbeatToggle) {
        heartbeatToggle.addEventListener('change', updateSimulator);
    }

    // Dedicated Console Event Listeners
    dashModelSelector.addEventListener('change', syncClientDashboard);
    dashModelSelector.addEventListener('input', syncClientDashboard);
    
    if (dashHeartbeatToggle) {
        dashHeartbeatToggle.addEventListener('change', syncClientDashboard);
    }

    // --- Initial Onboarding State ---
    checkLoginState();
    updateSimulator();
});
