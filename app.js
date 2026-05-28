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
                text: "Sign in to your Anthropic Console -> navigate to 'API Keys' in the sidebar -> click 'Create Key'. Copy your key immediately (it starts with 'sk-ant-')."
            }
        },
        'claude-haiku': {
            name: 'Claude 3.5 Haiku',
            savingsRatio: 0.70,
            bestPingMinutes: 4.5,
            instructions: {
                title: 'HOW TO FIND YOUR ANTHROPIC KEY:',
                text: "Sign in to your Anthropic Console -> navigate to 'API Keys' in the sidebar -> click 'Create Key'. Copy your key immediately (it starts with 'sk-ant-')."
            }
        },
        'claude-opus': {
            name: 'Claude 3.0 Opus',
            savingsRatio: 0.78,
            bestPingMinutes: 4.5,
            instructions: {
                title: 'HOW TO FIND YOUR ANTHROPIC KEY:',
                text: "Sign in to your Anthropic Console -> navigate to 'API Keys' in the sidebar -> click 'Create Key'. Copy your key immediately (it starts with 'sk-ant-')."
            }
        },
        'gpt-4o': {
            name: 'GPT-4o',
            savingsRatio: 0.40, // Save 40% on average
            bestPingMinutes: 9.0,
            instructions: {
                title: 'HOW TO FIND YOUR OPENAI KEY:',
                text: "Go to your OpenAI Platform Dashboard -> select the 'API Keys' tab -> click 'Create secret key'. Note your key securely (it starts with 'sk-proj-')."
            }
        },
        'gpt-4o-mini': {
            name: 'GPT-4o-mini',
            savingsRatio: 0.38,
            bestPingMinutes: 9.0,
            instructions: {
                title: 'HOW TO FIND YOUR OPENAI KEY:',
                text: "Go to your OpenAI Platform Dashboard -> select the 'API Keys' tab -> click 'Create secret key'. Note your key securely (it starts with 'sk-proj-')."
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
    const modelSelector = document.getElementById('model-selector');
    const sliderSpend = document.getElementById('slider-spend');

    const txtSpend = document.getElementById('val-spend-txt');

    const costStandardEl = document.getElementById('cost-standard');
    const costOptimizedEl = document.getElementById('cost-optimized');
    const roiSavingsEl = document.getElementById('roi-savings');
    const annualSavingsEl = document.getElementById('annual-savings');
    const roiMultiplierEl = document.getElementById('roi-multiplier');

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

    // Dynamic Key Finder Instructions Elements
    const keyInstructionsTitle = document.getElementById('key-instructions-title');
    const keyInstructionsText = document.getElementById('key-instructions-text');

    // Authentication Elements
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

    // Live Telemetry Indicator
    const liveTelemetryBadge = document.querySelector('.live-telemetry-badge');

    // --- Onboarding & State Management ---
    function checkLoginState() {
        const loggedInUser = localStorage.getItem('aether_user');
        const isPaid = localStorage.getItem('aether_paid') === 'true';

        if (loggedInUser) {
            loginBtn.style.display = 'none';
            userProfile.style.display = 'flex';
            userEmailText.textContent = loggedInUser;
            document.querySelector('.user-avatar').textContent = loggedInUser.charAt(0).toUpperCase();
            
            // Handle Gateway sync and key vault outcomes
            const savedKey = localStorage.getItem('aether_key_vaulted');
            if (savedKey && isPaid) {
                apiKeyInput.value = savedKey;
                generateGatewayURL(savedKey, loggedInUser);
            } else {
                outcomeBox.style.display = 'none';
                if (!isPaid) {
                    apiKeyInput.value = '';
                    apiKeyInput.placeholder = 'Please purchase a plan below to unlock secure gateway...';
                }
            }
        } else {
            loginBtn.style.display = 'block';
            userProfile.style.display = 'none';
            outcomeBox.style.display = 'none';
            headerStatusContainer.style.display = 'none';
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

    function generateGatewayURL(key, email) {
        const hashBase = email || 'guest';
        const uniqueHash = btoa(hashBase).substring(0, 8).toLowerCase();
        
        gatewayUrlEl.textContent = `https://api.aethercache.com/v1/ae_live_${uniqueHash}`;
        outcomeBox.style.display = 'flex';

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

        // Update spend text and instruction labels
        txtSpend.textContent = `$${standardSpend.toLocaleString()}`;

        if (keyInstructionsTitle && keyInstructionsText) {
            keyInstructionsTitle.textContent = model.instructions.title;
            keyInstructionsText.textContent = model.instructions.text;
        }

        const loggedInUser = localStorage.getItem('aether_user');
        const isPaid = localStorage.getItem('aether_paid') === 'true';

        let savingsRatio = 0;

        // Customer Subscription Lifecycle Decision Tree
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

            savingsRatio = 0;

        } else if (!isPaid) {
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

            savingsRatio = 0;

        } else {
            // State 3 & 4: LOGGED IN Paid Account
            headerStatusContainer.style.display = 'block';
            
            if (heartbeatToggle) {
                heartbeatToggle.disabled = false;
            }

            if (heartbeatToggle && heartbeatToggle.checked) {
                // State 4: Paid Account, Safeguards Active
                headerStatusContainer.innerHTML = '<div class="active-badge-glowing"><span class="pulse-dot"></span><span>Secure Gateway Active</span></div>';
                
                heartbeatStatusBadge.textContent = "PROTECTION ACTIVE";
                heartbeatStatusBadge.className = "toggle-label";

                cacheTempFill.style.width = "100%";
                cacheTempFill.className = "progress-bar-fill bg-emerald-gradient";
                cacheStatePill.className = "status-pill state-warm";
                cacheStatePill.textContent = "100% WARM & SECURED";
                cacheStateText.textContent = `Active protection enabled. AetherPing automatically sends a warm-up heartbeat every ${model.bestPingMinutes} minutes based on ${model.name}'s specifications.`;

                // Savings are fully unlocked
                savingsRatio = model.savingsRatio;
            } else {
                // State 3: Paid Account, Safeguards Off
                headerStatusContainer.innerHTML = '<span class="paid-account-badge">● Paid (Inactive)</span>';
                
                if (heartbeatStatusBadge) {
                    heartbeatStatusBadge.textContent = "PROTECTION INACTIVE";
                    heartbeatStatusBadge.className = "toggle-label inactive";
                }

                cacheTempFill.style.width = "0%";
                cacheTempFill.className = "progress-bar-fill bg-red-gradient";
                cacheStatePill.className = "status-pill state-cold";
                cacheStatePill.textContent = "INACTIVE";
                cacheStateText.textContent = "Protection unlocked! Toggle the switch above to start saving up to 90%.";

                savingsRatio = 0;
            }
        }

        // Financial calculations
        const savingsValue = standardSpend * savingsRatio;
        const optimizedCost = standardSpend - savingsValue;
        const annualSavings = savingsValue * 12;
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
        const isPaid = localStorage.getItem('aether_paid') === 'true';

        if (!loggedInUser) {
            alert('Please sign in to your dashboard account first to vault your API key.');
            openAuthModal();
            return;
        }

        if (!isPaid) {
            alert('Please select and pay for one of the pricing plans below to unlock gateway endpoint creation.');
            document.querySelector('.pricing-section').scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (!key) {
            alert('Please enter a secure API key first.');
            return;
        }

        localStorage.setItem('aether_key_vaulted', key);
        generateGatewayURL(key, loggedInUser);
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

            // Simulate B2B checkout payment success
            localStorage.setItem('aether_paid', 'true');
            alert('🎉 Subscription payment successful! Your AetherPing Caching Safeguards have been unlocked. Go ahead and toggle Card 2’s switch ON to start caching and secure your AI cost savings!');
            
            checkLoginState();
            updateSimulator();
            
            // Scroll back to main dashboard smoothly
            document.querySelector('.dashboard-grid').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // --- Inputs Event Listeners ---
    modelSelector.addEventListener('change', updateSimulator);
    modelSelector.addEventListener('input', updateSimulator);
    sliderSpend.addEventListener('input', updateSimulator);
    
    if (heartbeatToggle) {
        heartbeatToggle.addEventListener('change', updateSimulator);
    }

    // --- Initial Onboarding State ---
    checkLoginState();
    updateSimulator();
});
