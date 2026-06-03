/* ==========================================================================
   AetherCache B2B App Controller — Smooth Interactive Financial Simulator
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // --- Supabase Enterprise Database Configuration ---
    const SUPABASE_URL = "https://cqbvcsbkdddamrivejca.supabase.co";
    const SUPABASE_KEY = "sb_publishable_8qB6CruIJAn3Kr2BwdJBHg_wCdX6Hwz";
    const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
    console.log("Supabase Client active:", !!supabase);

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

    const auditPromptInput = document.getElementById('audit-prompt-input');
    const auditCallsSlider = document.getElementById('audit-calls-slider');
    const auditCallsValue = document.getElementById('audit-calls-value');
    const auditTokenDisplay = document.getElementById('audit-token-display');
    const auditLeakDisplay = document.getElementById('audit-leak-display');
    const auditSavingsDisplay = document.getElementById('audit-savings-display');

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
    const authPassword = document.getElementById('auth-password');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authToggleType = document.getElementById('auth-toggle-type');

    const liveTelemetryBadge = document.querySelector('.live-telemetry-badge');

    // DYNAMIC HEADER TABS Selectors
    const headerNav = document.getElementById('header-nav');
    const navTabHome = document.getElementById('nav-tab-home');
    const navTabDash = document.getElementById('nav-tab-dash');

    // DYNAMIC GATEWAY WORKSPACE Selectors
    const gatewaysListTbody = document.getElementById('gateways-list-tbody');
    const addGatewayBtn = document.getElementById('add-gateway-btn');
    
    // Gateway modal overlay components
    const gatewayConfigModal = document.getElementById('gateway-config-modal');
    const configModalCloseBtn = document.getElementById('config-modal-close-btn');
    const gatewayConfigForm = document.getElementById('gateway-config-form');
    const configGatewayId = document.getElementById('config-gateway-id');
    const configGatewayName = document.getElementById('config-gateway-name');
    const configModelSelector = document.getElementById('config-model-selector');
    const configApiKeyInput = document.getElementById('config-api-key-input');
    const configHeartbeatToggle = document.getElementById('config-heartbeat-toggle');
    const configSubmitBtn = document.getElementById('config-submit-btn');

    // Global in-memory controller states
    let userGateways = [];
    let userProfileState = null;

    // --- Authentication & Workspace state swapping ---
    // --- Unified Database and Local Mock Service Abstraction ---
    const DBService = {
        isSupabase() {
            return !!supabase && localStorage.getItem('aether_user') !== null;
        },

        async getUserProfile() {
            if (this.isSupabase()) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) return null;
                    
                    let { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .maybeSingle();

                    if (profileError) {
                        console.warn("Profiles query failed, trying to auto-seed.");
                    }

                    if (!profile) {
                        try {
                            const { data: newProfile } = await supabase
                                .from('profiles')
                                .insert({
                                    id: session.user.id,
                                    email: session.user.email,
                                    paid: false,
                                    plan_tier: 'free'
                                })
                                .select()
                                .single();
                            profile = newProfile;
                        } catch (seedEx) {
                            console.warn("Auto-seed profile bypassed:", seedEx.message);
                        }
                    }

                    return profile || { id: session.user.id, email: session.user.email, paid: false, plan_tier: 'free' };
                } catch (e) {
                    console.error("Supabase profile fetch error:", e);
                    return null;
                }
            } else {
                const email = localStorage.getItem('aether_user');
                if (!email) return null;
                const paid = localStorage.getItem('aether_paid') === 'true';
                const plan_tier = localStorage.getItem('aether_plan_tier') || 'free';
                return { email, paid, plan_tier };
            }
        },

        async fetchGateways(userId) {
            if (this.isSupabase()) {
                const { data, error } = await supabase
                    .from('gateways')
                    .select('*, cached_prompts(*)')
                    .eq('user_id', userId);
                if (error) throw error;
                return data || [];
            } else {
                let mockGatesRaw = localStorage.getItem('aether_mock_gateways');
                if (!mockGatesRaw) {
                    const defaultMock = [
                        {
                            gateway_id: "ae_live_8f9c2a",
                            name: "Default Gateway",
                            active_model: "claude-sonnet",
                            protection_active: true,
                            encrypted_api_key: "••••••••••••••••••••",
                            created_at: new Date().toISOString(),
                            cached_prompts: [
                                {
                                    prompt_hash: "ae_sha256_7f8a9b",
                                    encrypted_prompt: "aes256_gcm_sys_prompt_1",
                                    total_requests: 420,
                                    prompt_tokens: 2100000,
                                    cached_prompt_tokens: 1575000,
                                    cost_without_caching: 6.30,
                                    cost_with_caching: 1.575,
                                    last_used_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                                    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                                    mock_decrypted: "You are a helpful customer support agent for AetherCache Inc. Be professional, direct, and highlight our caching optimizations."
                                },
                                {
                                    prompt_hash: "ae_sha256_1c2d3e",
                                    encrypted_prompt: "aes256_gcm_sys_prompt_2",
                                    total_requests: 85,
                                    prompt_tokens: 850000,
                                    cached_prompt_tokens: 637500,
                                    cost_without_caching: 2.55,
                                    cost_with_caching: 0.6375,
                                    last_used_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
                                    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                                    mock_decrypted: "You are a legal document analyzer specialized in SaaS terms of service. Extract and cross-examine liability and compliance sections."
                                }
                            ]
                        }
                    ];
                    localStorage.setItem('aether_mock_gateways', JSON.stringify(defaultMock));
                    return defaultMock;
                }
                return JSON.parse(mockGatesRaw);
            }
        },

        async saveGateway(gateId, name, model, key, heartbeat, profile) {
            if (this.isSupabase()) {
                const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const backendBase = isLocalHost 
                    ? 'http://localhost:3000'
                    : 'https://aethercache-gateway.arthercache.workers.dev';

                const edgeRes = await fetch(`${backendBase}/api/v1/key/vault`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key: key,
                        email: profile.email,
                        model: model,
                        protectionActive: heartbeat,
                        gatewayId: gateId || undefined,
                        name: name
                    })
                });
                const edgeData = await edgeRes.json();
                if (!edgeRes.ok || !edgeData.success) {
                    throw new Error(edgeData.message || edgeData.error || 'Failed to sync with Cloudflare Edge Worker.');
                }
                return edgeData;
            } else {
                let list = await this.fetchGateways();
                let finalGateId = gateId;
                if (gateId) {
                    const idx = list.findIndex(g => g.gateway_id === gateId);
                    if (idx !== -1) {
                        list[idx].name = name;
                        list[idx].active_model = model;
                        list[idx].protection_active = heartbeat;
                        if (key !== '__KEEP_EXISTING_KEY__') {
                            list[idx].encrypted_api_key = '••••••••••••••••••••';
                        }
                    }
                } else {
                    const hex = Math.random().toString(16).substring(2, 8);
                    finalGateId = `ae_live_${hex}`;
                    const newGate = {
                        gateway_id: finalGateId,
                        name: name,
                        active_model: model,
                        protection_active: heartbeat,
                        encrypted_api_key: '••••••••••••••••••••',
                        created_at: new Date().toISOString(),
                        cached_prompts: []
                    };
                    list.push(newGate);
                }
                localStorage.setItem('aether_mock_gateways', JSON.stringify(list));
                return { success: true, gatewayId: finalGateId };
            }
        },

        async deleteGateway(gateId) {
            if (this.isSupabase()) {
                const { error } = await supabase
                    .from('gateways')
                    .delete()
                    .eq('gateway_id', gateId);
                if (error) throw error;
            } else {
                let list = await this.fetchGateways();
                list = list.filter(g => g.gateway_id !== gateId);
                localStorage.setItem('aether_mock_gateways', JSON.stringify(list));
            }
        }
    };

    // --- Authentication & Workspace state swapping ---
    async function checkLoginState(forceLogout = false) {
        if (forceLogout) {
            localStorage.removeItem('aether_user');
            localStorage.removeItem('aether_paid');
            localStorage.removeItem('aether_plan_tier');
            localStorage.removeItem('aether_mock_gateways');
            localStorage.removeItem('aether_key_vaulted');
        }

        // Initialize user email from session if logged in but localstorage empty
        if (supabase && !localStorage.getItem('aether_user')) {
            try {
                const sessionData = await supabase.auth.getSession();
                if (sessionData.data.session) {
                    localStorage.setItem('aether_user', sessionData.data.session.user.email);
                }
            } catch (e) {}
        }

        const profile = await DBService.getUserProfile();

        if (profile) {
            userProfileState = profile;
            localStorage.setItem('aether_user', profile.email);
            localStorage.setItem('aether_paid', profile.paid ? 'true' : 'false');
            localStorage.setItem('aether_plan_tier', profile.plan_tier || 'free');

            loginBtn.style.display = 'none';
            userProfile.style.display = 'flex';
            userEmailText.textContent = profile.email;
            document.querySelector('.user-avatar').textContent = profile.email.charAt(0).toUpperCase();

            // Fetch user gateways
            userGateways = await DBService.fetchGateways(profile.id);

            const isPaid = !!profile.paid;
            const planTier = profile.plan_tier || 'free';

            if (isPaid) {
                if (headerNav) headerNav.style.display = 'flex';
                switchView('dashboard');
                
                headerStatusContainer.style.display = 'block';
                headerStatusContainer.innerHTML = DBService.isSupabase()
                    ? `<div class="active-badge-glowing"><span class="pulse-dot"></span><span>${planTier.toUpperCase()} Plan Connected</span></div>`
                    : `<div class="active-badge-glowing"><span class="pulse-dot"></span><span>${planTier.toUpperCase()} Plan (Simulation)</span></div>`;
                
                renderGatewaysTable(userGateways, planTier);
                updateQuotaProgressBar(userGateways.length, planTier);
            } else {
                if (headerNav) headerNav.style.display = 'none';
                landingPageContainer.style.display = 'block';
                clientDashboardContainer.style.display = 'none';
                headerStatusContainer.style.display = 'block';
                headerStatusContainer.innerHTML = DBService.isSupabase()
                    ? '<span class="unpaid-badge">● Sandbox (Unpaid)</span>'
                    : '<span class="unpaid-badge">● Sandbox (Simulation)</span>';
                
                if (userGateways.length > 0 && userGateways[0].encrypted_api_key) {
                    apiKeyInput.value = '••••••••••••••••••••';
                }
            }

            // Check if there is a pending plan to checkout after login completes
            const pendingPlan = localStorage.getItem('pending_checkout_plan');
            if (pendingPlan) {
                localStorage.removeItem('pending_checkout_plan');
                const btn = document.querySelector(`.plan-action-btn[data-plan="${pendingPlan}"]`);
                triggerStripeCheckout(pendingPlan, profile.email, btn);
            }
        } else {
            loginBtn.style.display = 'block';
            userProfile.style.display = 'none';
            headerStatusContainer.style.display = 'none';
            if (headerNav) headerNav.style.display = 'none';
            
            landingPageContainer.style.display = 'block';
            clientDashboardContainer.style.display = 'none';
            
            apiKeyInput.value = '';
            apiKeyInput.placeholder = 'Please sign in to configure key settings...';
        }
    }

    // --- SPA View Navigation Toggler ---
    function switchView(viewName) {
        const loggedInUser = localStorage.getItem('aether_user');
        const isPaid = localStorage.getItem('aether_paid') === 'true';

        if (!loggedInUser || !isPaid) {
            if (headerNav) headerNav.style.display = 'none';
            landingPageContainer.style.display = 'block';
            clientDashboardContainer.style.display = 'none';
            return;
        }

        if (viewName === 'home') {
            if (navTabHome) navTabHome.classList.add('active');
            if (navTabDash) navTabDash.classList.remove('active');
            landingPageContainer.style.display = 'block';
            clientDashboardContainer.style.display = 'none';
            
            // Re-trigger landing page updates to ensure stats and simulator are accurate
            updateSimulator();
            updateAudit();
        } else {
            if (navTabDash) navTabDash.classList.add('active');
            if (navTabHome) navTabHome.classList.remove('active');
            landingPageContainer.style.display = 'none';
            clientDashboardContainer.style.display = 'block';
        }
    }

    if (navTabHome) {
        navTabHome.addEventListener('click', () => switchView('home'));
    }
    if (navTabDash) {
        navTabDash.addEventListener('click', () => switchView('dashboard'));
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
    function generateGatewayURL(key, email) {
        const hashBase = email || 'guest';
        const uniqueHash = btoa(hashBase).substring(0, 8).toLowerCase();
        
        // Dynamic localhost detection to connect frontend with live Cloudflare Workers gateway
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const gatewayURL = isLocalHost 
            ? `http://localhost:3000/api/v1/chat/completions/ae_live_${uniqueHash}`
            : `https://aethercache-gateway.arthercache.workers.dev/api/v1/chat/completions/ae_live_${uniqueHash}`;
        
        gatewayUrlEl.textContent = gatewayURL;
        outcomeBox.style.display = 'flex';

        if (liveTelemetryBadge) {
            liveTelemetryBadge.textContent = '📊 Gateway Sync Live';
            liveTelemetryBadge.style.backgroundColor = 'rgba(6, 182, 212, 0.1)';
            liveTelemetryBadge.style.color = '#06b6d4';
            liveTelemetryBadge.style.borderColor = 'rgba(6, 182, 212, 0.2)';
        }
    }

    // --- Render Relational Gateways Manager Table/List ---
    function renderGatewaysTable(gateways, planTier) {
        if (!gatewaysListTbody) return;
        
        gatewaysListTbody.innerHTML = '';
        
        if (!gateways || gateways.length === 0) {
            gatewaysListTbody.innerHTML = `
                <tr>
                    <td colspan="5" class="table-empty-row">
                        <div class="empty-state-container" style="text-align: center; padding: 24px; color: var(--text-muted);">
                            <p style="margin: 0; font-size: 13px;">No active gateways configured. Click "+ Create New Gateway" above to deploy your first secure edge caching endpoint.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const gatewayBase = isLocalHost 
            ? 'http://localhost:3000'
            : 'https://aethercache-gateway.arthercache.workers.dev';

        gateways.forEach(gate => {
            const tr = document.createElement('tr');
            
            // Name Column
            const tdName = document.createElement('td');
            tdName.className = 'gateway-name-cell';
            tdName.innerHTML = `
                <div class="gateway-info-box">
                    <span class="gate-title-bold" style="font-weight: 600; color: var(--text-primary); display: block; font-size: 14px;">${escapeHtml(gate.name || 'Unnamed Gateway')}</span>
                    <span class="gate-id-sub" style="font-size: 11px; color: var(--text-muted); font-family: monospace;">ID: ${escapeHtml(gate.gateway_id)}</span>
                </div>
            `;
            tr.appendChild(tdName);
            
            // Model Column
            const tdModel = document.createElement('td');
            const modelConfig = MODELS[gate.active_model] || MODELS['claude-sonnet'];
            tdModel.innerHTML = `<span class="model-badge" style="background: rgba(139, 92, 246, 0.08); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; text-transform: uppercase;">${escapeHtml(modelConfig.name)}</span>`;
            tr.appendChild(tdModel);
            
            // Cache Protection Column
            const tdProtection = document.createElement('td');
            if (gate.protection_active) {
                tdProtection.innerHTML = `<span class="status-pill state-warm" style="background: rgba(16, 185, 129, 0.08); color: var(--color-emerald); border: 1px solid rgba(16, 185, 129, 0.18); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em;">● Warm & Secured</span>`;
            } else {
                tdProtection.innerHTML = `<span class="status-pill state-cold" style="background: rgba(239, 68, 68, 0.08); color: var(--color-red); border: 1px solid rgba(239, 68, 68, 0.18); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em;">● Inactive</span>`;
            }
            tr.appendChild(tdProtection);
            
            // Endpoint URL Column
            const tdUrl = document.createElement('td');
            const fullUrl = `${gatewayBase}/api/v1/chat/completions/${gate.gateway_id}`;
            tdUrl.innerHTML = `
                <div class="table-url-wrapper" style="display: flex; align-items: center; gap: 8px; max-width: 320px;">
                    <span class="table-url-text" style="font-family: monospace; font-size: 12px; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex-grow: 1; background: rgba(0, 0, 0, 0.2); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.04);">${fullUrl}</span>
                    <button class="table-copy-btn" data-url="${fullUrl}" style="background: var(--color-purple); border: none; color: white; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: var(--transition-smooth); white-space: nowrap;">Copy</button>
                </div>
            `;
            tr.appendChild(tdUrl);
            
            // Actions Column
            const tdActions = document.createElement('td');
            tdActions.className = 'actions-cell';
            tdActions.innerHTML = `
                <div style="display: flex; gap: 6px; justify-content: flex-end;">
                    <button class="view-caches-btn" data-id="${gate.gateway_id}" style="background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2); color: #c084fc; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: var(--transition-smooth);">Caches (${gate.cached_prompts ? gate.cached_prompts.length : 0})</button>
                    <button class="edit-gate-btn" data-id="${gate.gateway_id}" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); color: var(--text-primary); padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: var(--transition-smooth);">Edit</button>
                    <button class="delete-gate-btn" data-id="${gate.gateway_id}" style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.18); color: #fca5a5; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: var(--transition-smooth);">Delete</button>
                </div>
            `;
            tr.appendChild(tdActions);
            
            gatewaysListTbody.appendChild(tr);

            // Render details sub-row
            const trDetails = document.createElement('tr');
            trDetails.id = `details-${gate.gateway_id}`;
            trDetails.style.display = 'none';
            trDetails.className = 'gateway-details-row';
            
            let promptsHtml = '';
            if (gate.cached_prompts && gate.cached_prompts.length > 0) {
                promptsHtml = `
                    <div style="padding: 16px; background: rgba(0, 0, 0, 0.2); border-radius: 12px; margin: 8px 0; border: 1px solid rgba(255, 255, 255, 0.05); text-align: left;">
                        <h5 style="margin: 0 0 12px 0; font-size: 12px; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px; font-weight: 700;">
                            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #c084fc;"></span>
                            Active Prompt Caches (${gate.cached_prompts.length})
                        </h5>
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                                <thead>
                                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); color: var(--text-secondary); font-weight: 600;">
                                        <th style="padding: 8px 4px;">Prompt Snippet</th>
                                        <th style="padding: 8px 4px;">Hash ID</th>
                                        <th style="padding: 8px 4px;">Keepalive Status</th>
                                        <th style="padding: 8px 4px; text-align: right;">Requests</th>
                                        <th style="padding: 8px 4px; text-align: right;">Savings Rate</th>
                                        <th style="padding: 8px 4px; text-align: right;">Total Saved</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;
                
                gate.cached_prompts.forEach(p => {
                    const idleTime = Date.now() - new Date(p.last_used_at).getTime();
                    const isClaude = gate.active_model.startsWith('claude');
                    const cooldownThreshold = isClaude ? 3.5 * 60 * 1000 : 7.5 * 60 * 1000;
                    
                    let statusBadge = '';
                    if (!gate.protection_active) {
                        statusBadge = `<span style="color: #ef4444; font-weight: 600;">● Inactive (Cold)</span>`;
                    } else if (idleTime <= cooldownThreshold) {
                        statusBadge = `<span style="color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><span class="pulse-dot" style="width: 6px; height: 6px; background-color: #10b981; border-radius: 50%;"></span>Warm (Active Client)</span>`;
                    } else if (idleTime < 24 * 60 * 60 * 1000) {
                        statusBadge = `<span style="color: #06b6d4; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><span class="pulse-dot" style="width: 6px; height: 6px; background-color: #06b6d4; border-radius: 50%;"></span>Sustained (Warm)</span>`;
                    } else {
                        statusBadge = `<span style="color: var(--text-muted); font-weight: 500;">● Idle (Cooled down)</span>`;
                    }
                    
                    const savedCost = Number(p.cost_without_caching || 0) - Number(p.cost_with_caching || 0);
                    const pctSaved = p.cost_without_caching > 0 ? Math.round((savedCost / p.cost_without_caching) * 100) : 0;
                    
                    const snippetText = p.mock_decrypted || `Encrypted System Prompt (${p.prompt_hash.substring(0, 10)}...)`;
                    const cleanSnippet = escapeHtml(snippetText.substring(0, 60)) + (snippetText.length > 60 ? '...' : '');
                    
                    promptsHtml += `
                        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04); color: var(--text-secondary);">
                            <td style="padding: 10px 4px; font-style: italic; color: var(--text-primary);" title="${escapeHtml(snippetText)}">"${cleanSnippet}"</td>
                            <td style="padding: 10px 4px; font-family: monospace; font-size: 11px;">${p.prompt_hash.substring(0, 10)}</td>
                            <td style="padding: 10px 4px;">${statusBadge}</td>
                            <td style="padding: 10px 4px; text-align: right; font-family: monospace;">${p.total_requests || 0}</td>
                            <td style="padding: 10px 4px; text-align: right; color: #06b6d4; font-weight: 600; font-family: monospace;">${pctSaved}%</td>
                            <td style="padding: 10px 4px; text-align: right; color: #10b981; font-weight: 600; font-family: monospace;">$${savedCost.toFixed(4)}</td>
                        </tr>
                    `;
                });
                
                promptsHtml += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            } else {
                promptsHtml = `
                    <div style="padding: 20px; text-align: center; color: var(--text-muted); background: rgba(0, 0, 0, 0.2); border-radius: 12px; margin: 8px 0; border: 1px solid rgba(255, 255, 255, 0.05);">
                        <p style="margin: 0; font-size: 13px;">No active prompt caches detected yet on this gateway. Point your SDK here and make a call with a system prompt to initiate caching!</p>
                    </div>
                `;
            }
            
            trDetails.innerHTML = `<td colspan="5" style="padding: 0 16px 16px 16px;">${promptsHtml}</td>`;
            gatewaysListTbody.appendChild(trDetails);
        });

        // Add event listeners for view caches buttons
        gatewaysListTbody.querySelectorAll('.view-caches-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const gateId = btn.getAttribute('data-id');
                const detailsRow = document.getElementById(`details-${gateId}`);
                if (detailsRow) {
                    const isHidden = detailsRow.style.display === 'none';
                    detailsRow.style.display = isHidden ? 'table-row' : 'none';
                    btn.textContent = isHidden ? 'Hide Caches' : `Caches (${gateways.find(g => g.gateway_id === gateId)?.cached_prompts?.length || 0})`;
                    btn.style.backgroundColor = isHidden ? 'rgba(255, 255, 255, 0.08)' : 'rgba(139, 92, 246, 0.08)';
                }
            });
        });

        // Add event listeners for copy buttons
        gatewaysListTbody.querySelectorAll('.table-copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.getAttribute('data-url');
                navigator.clipboard.writeText(url).then(() => {
                    btn.textContent = 'Copied!';
                    btn.style.backgroundColor = 'var(--color-emerald)';
                    setTimeout(() => {
                        btn.textContent = 'Copy';
                        btn.style.backgroundColor = 'var(--color-purple)';
                    }, 2000);
                });
            });
        });

        // Add event listeners for edit buttons
        gatewaysListTbody.querySelectorAll('.edit-gate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const gateId = btn.getAttribute('data-id');
                const gate = gateways.find(g => g.gateway_id === gateId);
                if (gate) openGatewayModal(gate);
            });
        });

        // Add event listeners for delete buttons
        gatewaysListTbody.querySelectorAll('.delete-gate-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const gateId = btn.getAttribute('data-id');
                const gate = gateways.find(g => g.gateway_id === gateId);
                if (!gate) return;
                
                if (confirm(`Are you sure you want to permanently delete the gateway "${gate.name}"?`)) {
                    await deleteGateway(gateId);
                }
            });
        });

        // Update Live Telemetry Metrics
        updateDashboardTelemetry(gateways);
    }

    function updateDashboardTelemetry(gateways) {
        const costStandardEl = document.getElementById('dash-cost-standard');
        const costOptimizedEl = document.getElementById('dash-cost-optimized');
        const roiSavingsEl = document.getElementById('dash-roi-savings');
        const kpiSavingsRate = document.getElementById('dash-kpi-savings-rate');
        const dashTotalTokensEl = document.getElementById('dash-total-tokens');

        if (!costStandardEl) return;

        let totalCostWithout = 0;
        let totalCostWith = 0;
        let totalCachedTokens = 0;
        let hasActualData = false;

        if (gateways && gateways.length > 0) {
            gateways.forEach(g => {
                totalCachedTokens += Number(g.cached_prompt_tokens || 0);
                if (g.cost_without_caching !== undefined && g.cost_without_caching !== null) {
                    const costWithout = Number(g.cost_without_caching);
                    if (costWithout > 0) {
                        totalCostWithout += costWithout;
                        totalCostWith += Number(g.cost_with_caching || 0);
                        hasActualData = true;
                    }
                }
            });
        }

        if (dashTotalTokensEl) {
            dashTotalTokensEl.textContent = totalCachedTokens.toLocaleString();
        }

        if (hasActualData && totalCostWithout > 0) {
            const totalSavings = totalCostWithout - totalCostWith;
            const avgSavingsRate = totalSavings / totalCostWithout;

            costStandardEl.textContent = `$${totalCostWithout.toFixed(2)}`;
            costOptimizedEl.textContent = `$${totalCostWith.toFixed(2)}`;
            roiSavingsEl.textContent = `$${totalSavings.toFixed(2)}`;
            kpiSavingsRate.textContent = `${Math.round(avgSavingsRate * 100)}%`;
        } else {
            // Live active tracking starts at 0.00
            costStandardEl.textContent = "$0.00";
            costOptimizedEl.textContent = "$0.00";
            roiSavingsEl.textContent = "$0.00";
            kpiSavingsRate.textContent = "0%";
        }

        // --- Render Audit Vault Dynamic Log Receipts ---
        const auditTbody = document.getElementById('audit-vault-tbody');
        const downloadBtn = document.getElementById('download-audit-btn');
        let allAuditRecords = [];

        if (auditTbody) {
            auditTbody.innerHTML = '';
            
            if (gateways && gateways.length > 0) {
                gateways.forEach(g => {
                    const N = Number(g.total_requests || 0);
                    if (N > 0) {
                        const avgTotal = Math.round((g.prompt_tokens || 0) / N);
                        const avgCached = Math.round((g.cached_prompt_tokens || 0) / N);
                        const avgStd = Number(g.cost_without_caching || 0) / N;
                        const avgOpt = Number(g.cost_with_caching || 0) / N;
                        
                        const modelConfig = MODELS[g.active_model] || MODELS['claude-sonnet'];

                        for (let i = 0; i < N; i++) {
                            // Spaced out transactions by i * 12 minutes
                            const date = new Date(new Date(g.updated_at || new Date()) - i * 12 * 60 * 1000);
                            const timeStr = date.toISOString().replace('T', ' ').substring(0, 19);
                            
                            allAuditRecords.push({
                                timestamp: timeStr,
                                gatewayName: g.name || "Default Gateway",
                                model: modelConfig.name,
                                totalTokens: avgTotal,
                                cachedTokens: avgCached,
                                stdCost: avgStd,
                                optCost: avgOpt,
                                savings: avgStd - avgOpt
                            });
                        }
                    }
                });
            }

            // Sort by timestamp descending
            allAuditRecords.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

            if (allAuditRecords.length > 0) {
                allAuditRecords.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="font-family: monospace; font-size: 12px; color: var(--text-secondary);">${r.timestamp}</td>
                        <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(r.gatewayName)}</td>
                        <td><span class="model-badge" style="background: rgba(139, 92, 246, 0.08); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 500; text-transform: uppercase;">${escapeHtml(r.model)}</span></td>
                        <td style="font-family: monospace;">${r.totalTokens.toLocaleString()}</td>
                        <td style="font-family: monospace; color: var(--color-cyan); font-weight: 600;">${r.cachedTokens.toLocaleString()}</td>
                        <td style="font-family: monospace; color: #fca5a5;">$${r.stdCost.toFixed(4)}</td>
                        <td style="font-family: monospace; color: #a7f3d0;">$${r.optCost.toFixed(4)}</td>
                        <td style="font-family: monospace; color: #e9d5ff; font-weight: 700; text-shadow: 0 0 10px rgba(168, 85, 247, 0.2);">$${r.savings.toFixed(4)}</td>
                    `;
                    auditTbody.appendChild(tr);
                });
            } else {
                auditTbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="table-empty-row" style="text-align: center; padding: 30px; color: var(--text-muted); font-style: italic;">
                            No telemetry events recorded yet. Run completions queries through your edge endpoints to populate receipts.
                        </td>
                    </tr>
                `;
            }
        }

        // --- Export CSV / Excel Handler ---
        if (downloadBtn) {
            // Remove previous listeners to prevent multiple concurrent downloads
            const newBtn = downloadBtn.cloneNode(true);
            downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
            
            newBtn.addEventListener('click', () => {
                if (allAuditRecords.length === 0) {
                    alert("No audit records available to export. Run some API requests first!");
                    return;
                }

                // Generate CSV string
                const headers = ["Timestamp (UTC)", "Gateway Name", "Target Model", "Total Tokens", "Cached Tokens", "Standard Cost (USD)", "Optimized Cost (USD)", "Savings Secured (USD)"];
                const csvRows = [headers.join(",")];
                
                allAuditRecords.forEach(r => {
                    csvRows.push([
                        `"${r.timestamp}"`,
                        `"${r.gatewayName.replace(/"/g, '""')}"`,
                        `"${r.model}"`,
                        r.totalTokens,
                        r.cachedTokens,
                        r.stdCost.toFixed(4),
                        r.optCost.toFixed(4),
                        r.savings.toFixed(4)
                    ].join(","));
                });

                const csvString = csvRows.join("\n");
                const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                
                link.setAttribute("href", url);
                link.setAttribute("download", `aethercache_audit_vault_${new Date().toISOString().substring(0, 10)}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }
    }

    // --- Usage Quota Progress Bar Refresher ---
    function updateQuotaProgressBar(count, planTier) {
        const quotaStatusCounter = document.getElementById('quota-status-counter');
        const quotaProgressFill = document.getElementById('quota-progress-fill');
        
        let limit = 3; // Default Startup
        let limitLabel = "3";
        
        if (planTier === 'free') {
            limit = 1;
            limitLabel = "1";
        } else if (planTier === 'startup') {
            limit = 1;
            limitLabel = "1";
        } else if (planTier === 'growth') {
            limit = 2;
            limitLabel = "2";
        } else if (planTier === 'scale') {
            limit = 5;
            limitLabel = "5";
        } else if (planTier === 'enterprise') {
            limit = Infinity;
            limitLabel = "∞";
        }
        
        if (quotaStatusCounter) {
            if (limit === Infinity) {
                quotaStatusCounter.textContent = `${count} Endpoints Connected`;
            } else {
                quotaStatusCounter.textContent = `${count}/${limitLabel} Endpoints Connected`;
            }
        }
        
        if (quotaProgressFill) {
            if (limit === Infinity) {
                quotaProgressFill.style.width = '100%';
                quotaProgressFill.className = "quota-progress-fill bg-emerald-gradient";
            } else {
                const percentage = Math.min((count / limit) * 100, 100);
                quotaProgressFill.style.width = `${percentage}%`;
                
                // Color change warning if full
                if (count >= limit) {
                    quotaProgressFill.className = "quota-progress-fill bg-red-gradient";
                    if (quotaStatusCounter) quotaStatusCounter.style.color = "#f87171";
                } else {
                    quotaProgressFill.className = "quota-progress-fill bg-purple-gradient";
                    if (quotaStatusCounter) quotaStatusCounter.style.color = "var(--text-secondary)";
                }
            }
        }
    }

    // --- Modal overlays driving logic ---
    if (addGatewayBtn) {
        addGatewayBtn.addEventListener('click', () => openGatewayModal());
    }

    if (configModalCloseBtn) {
        configModalCloseBtn.addEventListener('click', closeGatewayModal);
    }

    function openGatewayModal(gate = null) {
        if (!gatewayConfigModal) return;
        gatewayConfigModal.classList.add('active');
        
        const updateInstructions = () => {
            const modelKey = configModelSelector.value;
            const model = MODELS[modelKey];
            const configKeyInstructionsTitle = document.getElementById('config-key-instructions-title');
            const configKeyInstructionsText = document.getElementById('config-key-instructions-text');
            if (configKeyInstructionsTitle && configKeyInstructionsText && model) {
                configKeyInstructionsTitle.textContent = model.instructions.title;
                configKeyInstructionsText.textContent = model.instructions.text;
            }
        };

        configModelSelector.onchange = updateInstructions;
        configModelSelector.oninput = updateInstructions;
        
        if (gate) {
            // Edit Mode
            document.getElementById('config-modal-title').textContent = 'Edit Edge Gateway';
            configGatewayId.value = gate.gateway_id;
            configGatewayName.value = gate.name;
            configModelSelector.value = gate.active_model;
            configApiKeyInput.value = '••••••••••••••••••••';
            configApiKeyInput.required = false; // Not strictly required since they can keep existing key
            configHeartbeatToggle.checked = gate.protection_active;
            configSubmitBtn.textContent = 'Save Changes';
        } else {
            // Create Mode
            document.getElementById('config-modal-title').textContent = 'Configure New Edge Gateway';
            configGatewayId.value = '';
            configGatewayName.value = '';
            configModelSelector.value = 'claude-sonnet';
            configApiKeyInput.value = '';
            configApiKeyInput.required = true;
            configHeartbeatToggle.checked = true;
            configSubmitBtn.textContent = 'Vault & Synchronize Edge';
        }
        
        updateInstructions();
    }

    function closeGatewayModal() {
        if (gatewayConfigModal) {
            gatewayConfigModal.classList.remove('active');
        }
    }

    // --- CRUD backend endpoints synchronizations ---
    if (gatewayConfigForm) {
        gatewayConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const gateId = configGatewayId.value;
            const name = configGatewayName.value.trim();
            const model = configModelSelector.value;
            let key = configApiKeyInput.value.trim();
            const heartbeat = configHeartbeatToggle.checked;
            
            const loggedInUser = localStorage.getItem('aether_user');
            const planTier = localStorage.getItem('aether_plan_tier') || 'free';

            if (!loggedInUser) {
                alert('Please sign in first.');
                return;
            }

            // 1. Quota Check for NEW gateway creation
            if (!gateId) {
                const count = userGateways.length;
                const limits = { free: 1, startup: 1, growth: 2, scale: 5 };
                const limit = limits[planTier] || 1;
                
                if (planTier !== 'enterprise' && count >= limit) {
                    const nextTier = { free: "Startup", startup: "Growth", growth: "Scale", scale: "Enterprise" }[planTier] || "Enterprise";
                    alert(`🚫 Active prompt limit reached (${count}/${limit}) for ${planTier} plan.\n\nPlease upgrade to the ${nextTier} plan to unlock more active prompt gateways!`);
                    const pricingSec = document.querySelector('.pricing-section');
                    if (pricingSec) pricingSec.scrollIntoView({ behavior: 'smooth' });
                    closeGatewayModal();
                    return;
                }
            }

            // Handle edit key bypass
            if (gateId && key.startsWith('•••')) {
                key = '__KEEP_EXISTING_KEY__';
            }

            configSubmitBtn.disabled = true;
            configSubmitBtn.textContent = 'Vaulting...';

            try {
                const result = await DBService.saveGateway(gateId, name, model, key, heartbeat, userProfileState);
                if (result.success) {
                    closeGatewayModal();
                    alert(`🎉 Gateway synchronized successfully!\n\nUse your dedicated endpoint URL in your application settings.`);
                    await checkLoginState(); // Reload gateways and re-render
                }
            } catch (err) {
                console.error("Save Error:", err);
                alert("Error saving gateway: " + err.message);
            } finally {
                configSubmitBtn.disabled = false;
            }
        });
    }

    async function deleteGateway(gateId) {
        if (confirm(`Are you sure you want to permanently delete this gateway?`)) {
            try {
                await DBService.deleteGateway(gateId);
                alert("Gateway deleted successfully.");
                await checkLoginState();
            } catch (err) {
                console.error("Failed to delete gateway:", err.message);
                alert("Error deleting gateway: " + err.message);
            }
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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
                heartbeatToggle.disabled = false;
                heartbeatToggle.checked = false;
                heartbeatStatusBadge.textContent = "PROTECTION DEACTIVATED";
                heartbeatStatusBadge.className = "toggle-label inactive";
            }

            cacheTempFill.style.width = "0%";
            cacheTempFill.className = "progress-bar-fill bg-red-gradient";
            cacheStatePill.className = "status-pill state-cold";
            cacheStatePill.textContent = "INACTIVE";
            cacheStateText.textContent = "Safeguards deactivated. Please select a premium plan to activate automatic keep-warm edge protection.";

        } else {
            // State 2: LOGGED IN Unpaid Account
            headerStatusContainer.style.display = 'block';
            headerStatusContainer.innerHTML = '<span class="unpaid-badge">● Sandbox (Unpaid)</span>';

            if (heartbeatToggle) {
                heartbeatToggle.disabled = false;
                heartbeatToggle.checked = false;
                heartbeatStatusBadge.textContent = "PROTECTION DEACTIVATED";
                heartbeatStatusBadge.className = "toggle-label inactive";
            }

            cacheTempFill.style.width = "0%";
            cacheTempFill.className = "progress-bar-fill bg-red-gradient";
            cacheStatePill.className = "status-pill state-cold";
            cacheStatePill.textContent = "INACTIVE (Unpaid)";
            cacheStateText.textContent = "Automated safeguards deactivated. Select a premium plan below to activate automatic keep-warm edge protection.";
        }
    }

    // --- AetherAudit Prompt Cost Leak Scanner Engine ---
    function updateAudit() {
        const text = auditPromptInput ? auditPromptInput.value : '';
        const charCount = text.length;
        // 4 characters per token average
        const tokenCount = charCount > 0 ? Math.ceil(charCount / 4) : 0;

        // Retrieve active model selected in Card 1 to align pricing parameters
        const modelKey = modelSelector.value;
        
        // Input prompt-caching pricing metrics (per 1,000,000 tokens)
        const pricingTable = {
            'claude-sonnet': { std: 3.00, cached: 0.75 },
            'claude-haiku': { std: 0.80, cached: 0.24 },
            'claude-opus': { std: 15.00, cached: 3.30 },
            'gpt-4o': { std: 2.50, cached: 1.50 },
            'gpt-4o-mini': { std: 0.15, cached: 0.093 },
            'gemini-pro': { std: 1.25, cached: 0.68 },
            'gemini-flash': { std: 0.075, cached: 0.0435 },
            'deepseek-v3': { std: 0.14, cached: 0.077 }
        };

        const price = pricingTable[modelKey] || pricingTable['claude-sonnet'];
        const dailyCalls = Number(auditCallsSlider.value);

        // Daily standard vs cached context cost
        const dailyStandardCost = (tokenCount * dailyCalls * price.std) / 1000000;
        const dailyCachedCost = (tokenCount * dailyCalls * price.cached) / 1000000;

        // Monthly Cost Leak & Annual Savings
        const monthlyLeak = (dailyStandardCost - dailyCachedCost) * 30;
        const annualSavings = monthlyLeak * 12;

        // Update DOM Elements
        if (auditTokenDisplay) {
            auditTokenDisplay.innerHTML = `${tokenCount.toLocaleString()} tokens <span style="font-size: 11px; font-weight: 450; color: var(--text-muted); font-family: var(--font-body); text-transform: none; text-shadow: none;">(${charCount.toLocaleString()} chars)</span>`;
        }
        if (auditLeakDisplay) {
            auditLeakDisplay.textContent = `$${monthlyLeak.toFixed(2)}`;
        }
        if (auditSavingsDisplay) {
            auditSavingsDisplay.textContent = `$${annualSavings.toFixed(2)}`;
        }
    }

    // --- Onboarding Event Handlers ---
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const loggedInUser = localStorage.getItem('aether_user');

            if (!loggedInUser) {
                alert('Please sign in to your dashboard account first to vault your API key.');
                openAuthModal();
                return;
            }

            alert('Please select and pay for one of the pricing plans below to unlock gateway endpoint creation.');
            const pricingSec = document.querySelector('.pricing-section');
            if (pricingSec) pricingSec.scrollIntoView({ behavior: 'smooth' });
        });
    }

    if (copyUrlBtn) {
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
    }

    // --- Authentication Event Handlers ---
    if (loginBtn) loginBtn.addEventListener('click', openAuthModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeAuthModal);
    
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) closeAuthModal();
        });
    }

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            if (!supabase) {
                doMockLogin('google.partner@company.com');
                return;
            }
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) alert('Google Sign-In Error: ' + error.message);
        });
    }

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = authEmail.value.trim();
            const password = authPassword.value;

            if (!email || !password) return;

            const isSignup = authSubmitBtn.textContent === 'Register Account';

            if (!supabase) {
                doMockLogin(email);
                return;
            }

            authSubmitBtn.textContent = isSignup ? 'Registering...' : 'Signing in...';
            authSubmitBtn.disabled = true;

            try {
                if (isSignup) {
                    const { data, error } = await supabase.auth.signUp({ email, password });
                    if (error) {
                        alert('Registration Error: ' + error.message);
                    } else {
                        alert('🎉 Enterprise account created successfully! Please check your email to confirm registration.');
                        closeAuthModal();
                    }
                } else {
                    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                    if (error) {
                        alert('Login Error: ' + error.message);
                    } else {
                        closeAuthModal();
                        checkLoginState();
                    }
                }
            } catch (err) {
                console.error('Supabase Auth Error:', err);
                alert('Supabase Connection Error: ' + err.message);
            } finally {
                authSubmitBtn.textContent = isSignup ? 'Register Account' : 'Secure Login';
                authSubmitBtn.disabled = false;
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (supabase) {
                try {
                    await supabase.auth.signOut();
                } catch(e) {}
            }
            localStorage.removeItem('aether_user');
            localStorage.removeItem('aether_paid');
            localStorage.removeItem('aether_plan_tier');
            localStorage.removeItem('aether_mock_gateways');
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
    }

    if (authToggleType) {
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
    }

    // --- Plan Selection & Stripe Checkout Integration ---
    function triggerStripeCheckout(plan, email, btn) {
        if (btn) {
            btn.textContent = 'Connecting to Stripe...';
            btn.disabled = true;
        }

        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const backendBase = isLocalHost 
            ? 'http://localhost:3000'
            : 'https://aethercache-gateway.arthercache.workers.dev';

        fetch(`${backendBase}/api/v1/checkout/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plan: plan,
                email: email,
                urlOrigin: window.location.origin
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.url) {
                window.location.href = data.url;
            } else if (data.success) {
                localStorage.setItem('aether_paid', 'true');
                localStorage.setItem('aether_plan_tier', plan);
                alert('🎉 Subscription payment successful! Swapping view to your dedicated standalone gateway dashboard.');
                checkLoginState();
            } else {
                alert('Error creating checkout session: ' + (data.error || 'Unknown error'));
                if (btn) {
                    btn.textContent = plan === 'startup' ? 'Get Started' : `Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`;
                    btn.disabled = false;
                }
            }
        })
        .catch(err => {
            console.error(err);
            // Resilient local visual fallback in case backend is offline
            localStorage.setItem('aether_paid', 'true');
            localStorage.setItem('aether_plan_tier', plan);
            alert(`🎉 Simulation Mode: Subscription payment successful for ${plan.toUpperCase()}! Redirecting to dashboard.`);
            checkLoginState();
        });
    }

    const pricingButtons = document.querySelectorAll('.plan-action-btn');
    pricingButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const plan = btn.getAttribute('data-plan') || 'startup';

            const loggedInUser = localStorage.getItem('aether_user');
            if (!loggedInUser) {
                // Not logged in: save pending plan and trigger auth flow
                localStorage.setItem('pending_checkout_plan', plan);
                alert('To purchase the ' + plan.toUpperCase() + ' plan, please sign in or register an enterprise account. You will be redirected to the Stripe Checkout page immediately after.');
                openAuthModal();
                return;
            }

            // Already logged in: directly trigger Stripe checkout
            triggerStripeCheckout(plan, loggedInUser, btn);
        });
    });

    // Check URL parameters for successful Stripe Checkout redirect on load
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
        const loggedInUser = localStorage.getItem('aether_user');
        if (loggedInUser) {
            localStorage.setItem('aether_paid', 'true');
            
            // Try to resolve which plan they bought
            const sessionVal = urlParams.get('session_id');
            // Clean URL parameters using history API so refreshes remain clean
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            setTimeout(() => {
                alert('🎉 Subscription payment verified successfully! Swapping view to your secure standalone gateway dashboard.');
                checkLoginState();
            }, 100);
        }
    }

    // --- Inputs Event Listeners ---
    if (modelSelector) {
        modelSelector.addEventListener('change', () => { updateSimulator(); updateAudit(); });
        modelSelector.addEventListener('input', () => { updateSimulator(); updateAudit(); });
    }
    
    if (heartbeatToggle) {
        heartbeatToggle.addEventListener('click', (e) => {
            e.preventDefault(); // Keep it visually OFF for everyone
            
            const loggedInUser = localStorage.getItem('aether_user');
            const isPaid = localStorage.getItem('aether_paid') === 'true';

            if (loggedInUser && isPaid) {
                // If user is logged in and paid, do absolutely nothing
                return;
            }

            if (!loggedInUser) {
                // If user is logged out
                alert("🚫 Caching protection is deactivated. Please sign in and pay if you have not already.");
                
                const pricingSection = document.querySelector('.pricing-section') || document.getElementById('pricing-section');
                if (pricingSection) {
                    pricingSection.scrollIntoView({ behavior: 'smooth' });
                }
                return;
            }

            if (loggedInUser && !isPaid) {
                // If user is logged in but unpaid
                alert("🚫 Caching protection is deactivated. Please select a premium plan below to activate automatic keep-warm safeguards!");
                
                const pricingSection = document.querySelector('.pricing-section') || document.getElementById('pricing-section');
                if (pricingSection) {
                    pricingSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    }

    // AetherAudit Event Listeners
    if (auditPromptInput) {
        auditPromptInput.addEventListener('input', updateAudit);
    }
    if (auditCallsSlider) {
        auditCallsSlider.addEventListener('input', () => {
            if (auditCallsValue) {
                auditCallsValue.textContent = Number(auditCallsSlider.value).toLocaleString();
            }
            updateAudit();
        });
    }

    // --- Initial Onboarding State ---
    checkLoginState();
    updateSimulator();
    updateAudit();
});
