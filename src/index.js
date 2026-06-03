/* ==========================================================================
   AetherCache Cloudflare Worker — Production Edge Proxy & Caching Gateway
   v2.0 — Real Provider Forwarding, Cache Injection, SSE Normalization
   ========================================================================== */

// ============================================================================
// Section 1: AES-256-GCM Key Encryption (Web Crypto API)
// ============================================================================

async function encryptKey(rawKey, secret) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(secret).slice(0, 32), { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyMaterial, enc.encode(rawKey));
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptKey(base64Blob, secret) {
  const enc = new TextEncoder();
  const combined = Uint8Array.from(atob(base64Blob), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(secret).slice(0, 32), { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyMaterial, ciphertext);
  return new TextDecoder().decode(plaintext);
}

async function getPromptHash(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// Section 2: Provider Configuration & Pricing
// ============================================================================

const PROVIDERS = {
  "claude-sonnet":  { provider: "anthropic", apiModel: "claude-sonnet-4-20250514",  endpoint: "https://api.anthropic.com/v1/messages" },
  "claude-haiku":   { provider: "anthropic", apiModel: "claude-haiku-4-20250514",   endpoint: "https://api.anthropic.com/v1/messages" },
  "claude-opus":    { provider: "anthropic", apiModel: "claude-opus-4-20250514",    endpoint: "https://api.anthropic.com/v1/messages" },
  "gpt-4o":         { provider: "openai",    apiModel: "gpt-4o",                    endpoint: "https://api.openai.com/v1/chat/completions" },
  "gpt-4o-mini":    { provider: "openai",    apiModel: "gpt-4o-mini",               endpoint: "https://api.openai.com/v1/chat/completions" },
  "gemini-pro":     { provider: "google",    apiModel: "gemini-2.5-pro",            endpoint: "https://generativelanguage.googleapis.com/v1beta" },
  "gemini-flash":   { provider: "google",    apiModel: "gemini-2.5-flash",          endpoint: "https://generativelanguage.googleapis.com/v1beta" },
  "deepseek-v3":    { provider: "deepseek",  apiModel: "deepseek-chat",             endpoint: "https://api.deepseek.com/v1/chat/completions" },
};

// Per-million-token pricing for cost telemetry
const MODEL_PRICING = {
  "claude-sonnet":  { inputStd: 3.00,  inputCached: 0.30,  cacheWrite: 3.75,  output: 15.00 },
  "claude-haiku":   { inputStd: 0.80,  inputCached: 0.08,  cacheWrite: 1.00,  output: 4.00  },
  "claude-opus":    { inputStd: 15.00, inputCached: 1.50,  cacheWrite: 18.75, output: 75.00 },
  "gpt-4o":         { inputStd: 2.50,  inputCached: 1.25,  cacheWrite: 0,     output: 10.00 },
  "gpt-4o-mini":    { inputStd: 0.15,  inputCached: 0.075, cacheWrite: 0,     output: 0.60  },
  "gemini-pro":     { inputStd: 1.25,  inputCached: 0.315, cacheWrite: 0,     output: 10.00 },
  "gemini-flash":   { inputStd: 0.075, inputCached: 0.019, cacheWrite: 0,     output: 0.30  },
  "deepseek-v3":    { inputStd: 0.27,  inputCached: 0.07,  cacheWrite: 0,     output: 1.10  },
};

// ============================================================================
// Section 3: Cache Control Injection (Provider-Specific)
// ============================================================================

/**
 * Anthropic: Extract system message, inject cache_control on system + conversation prefix.
 * Returns { system, messages } in Anthropic format.
 */
function buildAnthropicPayload(clientMessages, body) {
  let systemContent = null;
  const messages = [];

  for (const msg of clientMessages) {
    if (msg.role === "system") {
      systemContent = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    } else {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }
  }

  // Build system parameter with cache_control
  const system = systemContent ? [{
    type: "text",
    text: systemContent,
    cache_control: { type: "ephemeral" }
  }] : undefined;

  // Optimize multi-turn conversation caching using a sliding-window strategy.
  // Anthropic allows up to 4 cache_control breakpoints in total (1 on system prompt, 3 in messages list).
  if (messages.length > 0) {
    const indices = [];

    // 1. Always cache the second-to-last message (most critical for immediate next turn)
    if (messages.length >= 2) {
      indices.push(messages.length - 2);
    } else {
      indices.push(messages.length - 1);
    }

    // 2. If the conversation is longer, cache a middle message (breakpoint 3)
    if (messages.length >= 6) {
      indices.push(Math.floor(messages.length / 2));
    }

    // 3. If the conversation is even longer, cache a message at 1/4 (breakpoint 4)
    if (messages.length >= 10) {
      indices.push(Math.floor(messages.length / 4));
    }

    const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b);

    for (const idx of uniqueIndices) {
      const msg = messages[idx];
      if (msg) {
        if (typeof msg.content === "string") {
          messages[idx] = {
            role: msg.role,
            content: [{ type: "text", text: msg.content, cache_control: { type: "ephemeral" } }]
          };
        } else if (Array.isArray(msg.content)) {
          const lastBlock = msg.content[msg.content.length - 1];
          if (lastBlock && typeof lastBlock === "object") {
            lastBlock.cache_control = { type: "ephemeral" };
          }
        }
      }
    }
  }

  return {
    model: body._providerModel,
    system,
    messages,
    max_tokens: body.max_tokens || 4096,
    stream: body.stream !== false,
    ...(body.temperature !== undefined && { temperature: body.temperature }),
    ...(body.top_p !== undefined && { top_p: body.top_p }),
  };
}

/**
 * OpenAI / DeepSeek: Pass through with stream_options for usage tracking.
 */
function buildOpenAIPayload(clientMessages, body) {
  const payload = {
    model: body._providerModel,
    messages: clientMessages,
    stream: body.stream !== false,
    ...(body.max_tokens !== undefined && { max_tokens: body.max_tokens }),
    ...(body.temperature !== undefined && { temperature: body.temperature }),
    ...(body.top_p !== undefined && { top_p: body.top_p }),
  };

  // Request usage stats in stream chunks
  if (payload.stream) {
    payload.stream_options = { include_usage: true };
  }

  return payload;
}

/**
 * Google Gemini: Convert OpenAI messages to Gemini contents[] format.
 */
function buildGeminiPayload(clientMessages, body) {
  let systemInstruction = null;
  const contents = [];

  for (const msg of clientMessages) {
    const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    if (msg.role === "system") {
      systemInstruction = { parts: [{ text }] };
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text }]
      });
    }
  }

  const payload = { contents };
  if (systemInstruction) payload.systemInstruction = systemInstruction;
  payload.generationConfig = {};
  if (body.max_tokens) payload.generationConfig.maxOutputTokens = body.max_tokens;
  if (body.temperature !== undefined) payload.generationConfig.temperature = body.temperature;
  if (body.top_p !== undefined) payload.generationConfig.topP = body.top_p;
  return payload;
}

// ============================================================================
// Section 4: SSE Stream Parsing
// ============================================================================

class SSEParser {
  constructor() { this.buffer = ""; }

  feed(chunk) {
    this.buffer += chunk;
    const events = [];
    const parts = this.buffer.split("\n\n");
    this.buffer = parts.pop(); // Keep incomplete part
    for (const part of parts) {
      if (!part.trim()) continue;
      const event = {};
      for (const line of part.split("\n")) {
        if (line.startsWith("event: ")) event.event = line.substring(7).trim();
        else if (line.startsWith("data: ")) {
          event.data = event.data ? event.data + line.substring(6) : line.substring(6);
        }
      }
      if (event.data !== undefined) events.push(event);
    }
    return events;
  }
}

// ============================================================================
// Section 5: Provider-Specific Stream Normalization → OpenAI Format
// ============================================================================

/**
 * Normalize Anthropic SSE events to OpenAI chat.completion.chunk format.
 * Returns { chunks: [...openAIChunks], usage: {...} | null }
 */
function normalizeAnthropicEvents(events, modelAlias) {
  const chunks = [];
  let usage = null;

  for (const event of events) {
    if (!event.data || event.data === "[DONE]") continue;
    try {
      const d = JSON.parse(event.data);

      if (d.type === "message_start" && d.message?.usage) {
        usage = {
          prompt_tokens: d.message.usage.input_tokens || 0,
          cache_creation_tokens: d.message.usage.cache_creation_input_tokens || 0,
          cache_read_tokens: d.message.usage.cache_read_input_tokens || 0,
          completion_tokens: 0
        };
      }

      if (d.type === "content_block_delta" && d.delta?.type === "text_delta") {
        chunks.push(`data: ${JSON.stringify({
          id: "chatcmpl-ae", object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000), model: modelAlias,
          choices: [{ index: 0, delta: { content: d.delta.text }, finish_reason: null }]
        })}\n\n`);
      }

      if (d.type === "message_delta") {
        if (usage && d.usage) usage.completion_tokens = d.usage.output_tokens || 0;
        const finish = d.delta?.stop_reason === "end_turn" ? "stop" : (d.delta?.stop_reason || null);
        if (finish) {
          chunks.push(`data: ${JSON.stringify({
            id: "chatcmpl-ae", object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000), model: modelAlias,
            choices: [{ index: 0, delta: {}, finish_reason: finish }]
          })}\n\n`);
        }
      }

      if (d.type === "message_stop") {
        chunks.push("data: [DONE]\n\n");
      }

      // Forward errors as-is
      if (d.type === "error") {
        chunks.push(`data: ${JSON.stringify({ error: d.error })}\n\n`);
        chunks.push("data: [DONE]\n\n");
      }
    } catch { /* skip malformed */ }
  }

  return { chunks, usage };
}

/**
 * Normalize Gemini SSE events to OpenAI chat.completion.chunk format.
 */
function normalizeGeminiEvents(events, modelAlias) {
  const chunks = [];
  let usage = null;

  for (const event of events) {
    if (!event.data || event.data === "[DONE]") continue;
    try {
      const d = JSON.parse(event.data);
      const candidate = d.candidates?.[0];
      if (!candidate) continue;

      const text = candidate.content?.parts?.[0]?.text || "";
      const finish = candidate.finishReason === "STOP" ? "stop" : null;

      if (text) {
        chunks.push(`data: ${JSON.stringify({
          id: "chatcmpl-ae", object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000), model: modelAlias,
          choices: [{ index: 0, delta: { content: text }, finish_reason: null }]
        })}\n\n`);
      }

      if (finish) {
        chunks.push(`data: ${JSON.stringify({
          id: "chatcmpl-ae", object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000), model: modelAlias,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
        })}\n\n`);
      }

      if (d.usageMetadata) {
        usage = {
          prompt_tokens: d.usageMetadata.promptTokenCount || 0,
          cache_read_tokens: d.usageMetadata.cachedContentTokenCount || 0,
          cache_creation_tokens: 0,
          completion_tokens: d.usageMetadata.candidatesTokenCount || 0
        };
      }
    } catch { /* skip malformed */ }
  }

  return { chunks, usage };
}

/**
 * Pass through OpenAI/DeepSeek SSE events and extract usage.
 */
function normalizeOpenAIEvents(events) {
  const chunks = [];
  let usage = null;

  for (const event of events) {
    if (!event.data) continue;
    if (event.data === "[DONE]") {
      chunks.push("data: [DONE]\n\n");
      continue;
    }
    try {
      const d = JSON.parse(event.data);
      // Extract usage from final chunk
      if (d.usage) {
        usage = {
          prompt_tokens: d.usage.prompt_tokens || 0,
          cache_read_tokens: d.usage.prompt_tokens_details?.cached_tokens || 0,
          cache_creation_tokens: 0,
          completion_tokens: d.usage.completion_tokens || 0
        };
      }
      chunks.push(`data: ${event.data}\n\n`);
    } catch {
      chunks.push(`data: ${event.data}\n\n`);
    }
  }

  return { chunks, usage };
}

// ============================================================================
// Section 6: Non-Streaming Response Normalization
// ============================================================================

function normalizeAnthropicResponse(data, modelAlias) {
  const text = data.content?.map(b => b.text || "").join("") || "";
  return {
    id: `chatcmpl-ae-${Date.now()}`, object: "chat.completion",
    created: Math.floor(Date.now() / 1000), model: modelAlias,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      prompt_tokens_details: { cached_tokens: data.usage?.cache_read_input_tokens || 0 }
    },
    _raw_usage: data.usage
  };
}

function normalizeGeminiResponse(data, modelAlias) {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const um = data.usageMetadata || {};
  return {
    id: `chatcmpl-ae-${Date.now()}`, object: "chat.completion",
    created: Math.floor(Date.now() / 1000), model: modelAlias,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: {
      prompt_tokens: um.promptTokenCount || 0,
      completion_tokens: um.candidatesTokenCount || 0,
      total_tokens: um.totalTokenCount || 0,
      prompt_tokens_details: { cached_tokens: um.cachedContentTokenCount || 0 }
    }
  };
}

// ============================================================================
// Section 7: Cost Calculator
// ============================================================================

function calculateCosts(modelAlias, usage) {
  const p = MODEL_PRICING[modelAlias] || MODEL_PRICING["claude-sonnet"];
  const inputTokens = usage.prompt_tokens || 0;
  const cachedTokens = usage.cache_read_tokens || 0;
  const cacheWriteTokens = usage.cache_creation_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  const freshInputTokens = inputTokens - cachedTokens - cacheWriteTokens;

  const costWithout = ((inputTokens + cacheWriteTokens) * p.inputStd + outputTokens * p.output) / 1_000_000;
  const costWith = (freshInputTokens * p.inputStd + cachedTokens * p.inputCached + cacheWriteTokens * p.cacheWrite + outputTokens * p.output) / 1_000_000;

  return { costWithout, costWith, inputTokens: inputTokens + cacheWriteTokens, cachedTokens };
}

// ============================================================================
// Section 8: Main Worker Export
// ============================================================================

const keyVault = new Map();
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // ========================================================================
    // Route A: Vault Sync — Encrypt & Store API Keys
    // ========================================================================
    if (url.pathname === "/api/v1/key/vault" && request.method === "POST") {
      try {
        let key, email, model, protectionActive, gatewayId, gatewayName;
        try {
          const bodyText = await request.text();
          if (!bodyText) throw new Error("Request body is empty.");
          const body = JSON.parse(bodyText);
          key = body.key; email = body.email; model = body.model;
          protectionActive = body.protectionActive;
          gatewayId = body.gatewayId;
          gatewayName = body.name || "Default Gateway";
        } catch (jsonErr) {
          return jsonResponse({ error: `JSON Parse Error: ${jsonErr.message}` }, 400);
        }

        if (!key || !email || !model) {
          return jsonResponse({ error: "Missing parameters: key, email, or model." }, 400);
        }

        let isPaid = true;
        let planTier = "startup";
        let userId = null;

        // Fetch user profile from Supabase
        if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
          try {
            const profileRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?email=eq.${email}&select=*`, {
              headers: {
                "apikey": env.SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY}`
              }
            });
            const profiles = await profileRes.json();
            if (profiles?.length > 0) {
              userId = profiles[0].id;
              isPaid = !!profiles[0].paid;
              planTier = profiles[0].plan_tier || "free";
            }
          } catch (err) { console.error("[Supabase Profile Error]:", err.message); }
        }

        // Determine if editing or creating
        let activeGatewayId = gatewayId;
        let existingEncryptedKey = null;

        if (activeGatewayId) {
          // Editing: load existing encrypted key
          if (userId && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
            try {
              const checkRes = await fetch(`${env.SUPABASE_URL}/rest/v1/gateways?gateway_id=eq.${activeGatewayId}&select=encrypted_api_key`, {
                headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY}` }
              });
              const gates = await checkRes.json();
              if (gates?.length > 0) existingEncryptedKey = gates[0].encrypted_api_key;
            } catch (err) { console.error("[Route A] Existing gateway fetch error:", err.message); }
          }
        } else {
          // Creating: enforce quota limits
          let existingCount = 0;
          if (userId && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
            try {
              const gatewaysRes = await fetch(`${env.SUPABASE_URL}/rest/v1/gateways?user_id=eq.${userId}&select=gateway_id`, {
                headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY}` }
              });
              const gateways = await gatewaysRes.json();
              existingCount = gateways?.length || 0;
            } catch (err) { console.error("[Supabase Gateway Count Error]:", err.message); }
          }

          const limits = { free: 1, startup: 1, growth: 2, scale: 5 };
          const limit = limits[planTier];
          if (limit !== undefined && existingCount >= limit) {
            const nextTier = { free: "Startup", startup: "Growth", growth: "Scale", scale: "Enterprise" }[planTier] || "Enterprise";
            return jsonResponse({
              error: "limit_reached",
              message: `Active endpoint limit reached (${existingCount}/${limit}) for ${planTier} plan. Upgrade to ${nextTier} for more.`
            }, 403);
          }

          const hex = Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(16).padStart(2, "0")).join("");
          activeGatewayId = `ae_live_${hex}`;
        }

        const hash = activeGatewayId.replace("ae_live_", "");

        // Determine whether to keep existing key or encrypt new one
        let rawKey, dbEncryptedKey;
        if (key === "__KEEP_EXISTING_KEY__" || key.startsWith("•••")) {
          // Keep existing — restore raw key from existing encrypted value
          if (existingEncryptedKey && env.ENCRYPTION_SECRET) {
            try {
              rawKey = await decryptKey(existingEncryptedKey, env.ENCRYPTION_SECRET);
            } catch { rawKey = null; }
          }
          dbEncryptedKey = existingEncryptedKey || "";
        } else {
          rawKey = key;
          // Encrypt the raw key for database storage
          if (env.ENCRYPTION_SECRET) {
            dbEncryptedKey = await encryptKey(key, env.ENCRYPTION_SECRET);
          } else {
            dbEncryptedKey = key.substring(0, 16) + "..."; // Fallback if no secret
          }
        }

        // In-memory duplicate key check
        if (rawKey && key !== "__KEEP_EXISTING_KEY__" && !key.startsWith("•••")) {
          let memoryDuplicate = false;
          keyVault.forEach((config) => {
            if (config.email !== email && config.rawKey === rawKey) memoryDuplicate = true;
          });
          if (memoryDuplicate) {
            return jsonResponse({
              error: "duplicate_key",
              message: "🚫 This API key is already active under another account. Please use a unique key."
            }, 403);
          }
        }

        // Save to in-memory vault (with RAW key for real proxying)
        keyVault.set(hash, {
          email, model, rawKey,
          keyPreview: rawKey ? rawKey.substring(0, 8) + "..." : "n/a",
          cachedPrompts: new Map(),
          protectionActive: !!protectionActive && isPaid,
          lastUpdated: new Date()
        });

        // Persist to Supabase
        if (userId && env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const payload = {
              gateway_id: activeGatewayId, user_id: userId, name: gatewayName,
              active_model: model, encrypted_api_key: dbEncryptedKey,
              protection_active: !!protectionActive, updated_at: new Date()
            };
            await fetch(`${env.SUPABASE_URL}/rest/v1/gateways?gateway_id=eq.${activeGatewayId}`, {
              method: gatewayId ? "PATCH" : "POST",
              headers: {
                "apikey": env.SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json", "Prefer": "return=minimal"
              },
              body: JSON.stringify(payload)
            });
          } catch (err) { console.error("[Supabase DB Sync Error]:", err.message); }
        }

        console.log(`[AetherVault 🔒] Key vaulted for gateway: ${activeGatewayId} (Plan: ${planTier})`);

        return jsonResponse({
          success: true, paid: isPaid, planTier,
          gatewayId: activeGatewayId,
          gatewayUrl: `${url.origin}/api/v1/chat/completions/${activeGatewayId}`
        });
      } catch (err) {
        return jsonResponse({ error: `Vault error: ${err.message}` }, 400);
      }
    }

    // ========================================================================
    // Route B: REAL Proxy — Forward to AI Provider with Cache Injection
    // ========================================================================
    if (url.pathname.startsWith("/api/v1/chat/completions/ae_live_") && request.method === "POST") {
      const gatewayId = url.pathname.split("/").pop();
      const hash = gatewayId.replace("ae_live_", "");
      let userConfig = keyVault.get(hash);

      // Cold-start: restore from Supabase
      if (!userConfig && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
        try {
          console.log(`[AetherProxy 🚀 Cold Start] Restoring for gateway: ${gatewayId}`);
          // Query gateways joined with cached_prompts
          const dbRes = await fetch(`${env.SUPABASE_URL}/rest/v1/gateways?gateway_id=eq.${gatewayId}&select=*,profiles(*),cached_prompts(prompt_hash,encrypted_prompt,last_used_at)`, {
            headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY}` }
          });
          const records = await dbRes.json();
          if (records?.length > 0) {
            const gw = records[0];
            const profile = gw.profiles;
            if (profile?.paid && gw.encrypted_api_key && env.ENCRYPTION_SECRET) {
              try {
                const rawKey = await decryptKey(gw.encrypted_api_key, env.ENCRYPTION_SECRET);
                
                // Load all decrypted cached prompts into a map
                const cachedPrompts = new Map();
                for (const p of gw.cached_prompts || []) {
                  try {
                    const decrypted = await decryptKey(p.encrypted_prompt, env.ENCRYPTION_SECRET);
                    cachedPrompts.set(p.prompt_hash, { decrypted, lastUsedAt: p.last_used_at });
                  } catch (pErr) {
                    console.error(`[AetherProxy] Failed to decrypt prompt: ${pErr.message}`);
                  }
                }
                
                // Fallback for legacy cached_prefix column
                if (cachedPrompts.size === 0 && gw.cached_prefix) {
                  try {
                    const decrypted = await decryptKey(gw.cached_prefix, env.ENCRYPTION_SECRET);
                    const promptHash = await getPromptHash(decrypted);
                    cachedPrompts.set(promptHash, { decrypted, lastUsedAt: gw.updated_at });
                  } catch { /* ignore */ }
                }
                
                keyVault.set(hash, {
                  email: profile.email, model: gw.active_model, rawKey,
                  keyPreview: rawKey.substring(0, 8) + "...",
                  cachedPrompts,
                  protectionActive: gw.protection_active, lastUpdated: new Date()
                });
                userConfig = keyVault.get(hash);
                console.log(`[AetherProxy 🚀] Restored for ${profile.email} (${cachedPrompts.size} prompts loaded)`);
              } catch (decryptErr) {
                console.error(`[AetherProxy] Cannot decrypt key (legacy format?): ${decryptErr.message}`);
              }
            }
          }
        } catch (err) { console.error("[Cold Start Error]:", err.message); }
      }

      if (!userConfig || !userConfig.rawKey) {
        return jsonResponse({ error: "Unauthorized gateway or key unavailable. Please re-vault your API key." }, 401);
      }

      let activePromptHash = null;
      let activeEncryptedPrompt = null;

      try {
        const body = await request.json();
        const messages = body.messages || [];
        const modelAlias = userConfig.model;
        const providerConfig = PROVIDERS[modelAlias];

        if (!providerConfig) {
          return jsonResponse({ error: `Unsupported model: ${modelAlias}` }, 400);
        }

        const { provider, apiModel, endpoint } = providerConfig;
        const isStreaming = body.stream !== false;
        body._providerModel = apiModel;

        console.log(`[AetherProxy ⚡] ${provider.toUpperCase()} | ${modelAlias} | stream=${isStreaming} | msgs=${messages.length}`);

        // ---------------------------------------------------------------
        // Capture system prompt for keep-warm replay (the secret sauce)
        // ---------------------------------------------------------------
        const systemMsg = messages.find(m => m.role === "system");
        if (systemMsg) {
          const sysText = typeof systemMsg.content === "string" ? systemMsg.content : JSON.stringify(systemMsg.content);
          if (sysText) {
            activePromptHash = await getPromptHash(sysText);
            if (!userConfig.cachedPrompts) userConfig.cachedPrompts = new Map();
            
            // Update memory if not present
            if (!userConfig.cachedPrompts.has(activePromptHash)) {
              userConfig.cachedPrompts.set(activePromptHash, { decrypted: sysText, lastUsedAt: new Date().toISOString() });
              console.log(`[AetherProxy 🧠] Captured new system prompt hash ${activePromptHash.substring(0, 8)} (${sysText.length} chars)`);
            } else {
              // Update lastUsedAt in memory
              userConfig.cachedPrompts.get(activePromptHash).lastUsedAt = new Date().toISOString();
            }
            
            // Always prepare encrypted prompt for db update
            if (env.ENCRYPTION_SECRET) {
              try {
                activeEncryptedPrompt = await encryptKey(sysText, env.ENCRYPTION_SECRET);
              } catch (e) { console.error("[Encryption Error]:", e.message); }
            }
          }
        }

        // -------------------------------------------------------------------
        // Build provider-specific request
        // -------------------------------------------------------------------
        let providerUrl, providerHeaders, providerBody;

        if (provider === "anthropic") {
          providerUrl = endpoint;
          providerHeaders = {
            "x-api-key": userConfig.rawKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
          };
          providerBody = JSON.stringify(buildAnthropicPayload(messages, body));
          console.log(`[AetherProxy 🛡️] Injected Anthropic cache_control on system + prefix`);

        } else if (provider === "openai" || provider === "deepseek") {
          providerUrl = endpoint;
          providerHeaders = {
            "Authorization": `Bearer ${userConfig.rawKey}`,
            "Content-Type": "application/json"
          };
          providerBody = JSON.stringify(buildOpenAIPayload(messages, body));

        } else if (provider === "google") {
          const method = isStreaming ? "streamGenerateContent" : "generateContent";
          providerUrl = `${endpoint}/models/${apiModel}:${method}?alt=sse&key=${userConfig.rawKey}`;
          providerHeaders = { "Content-Type": "application/json" };
          providerBody = JSON.stringify(buildGeminiPayload(messages, body));
        }

        // -------------------------------------------------------------------
        // Forward to provider
        // -------------------------------------------------------------------
        const providerRes = await fetch(providerUrl, {
          method: "POST", headers: providerHeaders, body: providerBody
        });

        // Handle non-2xx errors from provider
        if (!providerRes.ok) {
          const errText = await providerRes.text();
          console.error(`[AetherProxy ❌] ${provider} returned ${providerRes.status}: ${errText.substring(0, 200)}`);
          try {
            const errJson = JSON.parse(errText);
            return jsonResponse({ error: errJson.error?.message || errJson.error || errText }, providerRes.status);
          } catch {
            return jsonResponse({ error: errText.substring(0, 500) }, providerRes.status);
          }
        }

        // -------------------------------------------------------------------
        // NON-STREAMING: normalize and return complete response
        // -------------------------------------------------------------------
        if (!isStreaming) {
          const data = await providerRes.json();
          let normalized;

          if (provider === "anthropic") {
            normalized = normalizeAnthropicResponse(data, modelAlias);
          } else if (provider === "google") {
            normalized = normalizeGeminiResponse(data, modelAlias);
          } else {
            normalized = data; // OpenAI/DeepSeek already in correct format
          }

          // Async telemetry sync
          const rawUsage = normalized._raw_usage || normalized.usage;
          if (rawUsage) {
            ctx.waitUntil(syncTelemetry(env, gatewayId, modelAlias, {
              prompt_tokens: rawUsage.prompt_tokens || rawUsage.input_tokens || 0,
              cache_read_tokens: rawUsage.prompt_tokens_details?.cached_tokens || rawUsage.cache_read_input_tokens || 0,
              cache_creation_tokens: rawUsage.cache_creation_input_tokens || 0,
              completion_tokens: rawUsage.completion_tokens || rawUsage.output_tokens || 0
            }, activePromptHash, activeEncryptedPrompt));
          }
          delete normalized._raw_usage;
          return jsonResponse(normalized);
        }

        // -------------------------------------------------------------------
        // STREAMING: pipe provider SSE → normalize → forward to client
        // -------------------------------------------------------------------
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const parser = new SSEParser();
        let accumulatedUsage = null;

        ctx.waitUntil((async () => {
          try {
            const reader = providerRes.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = decoder.decode(value, { stream: true });
              const events = parser.feed(text);
              if (events.length === 0) continue;

              let result;
              if (provider === "anthropic") {
                result = normalizeAnthropicEvents(events, modelAlias);
              } else if (provider === "google") {
                result = normalizeGeminiEvents(events, modelAlias);
              } else {
                result = normalizeOpenAIEvents(events);
              }

              if (result.usage) accumulatedUsage = result.usage;

              for (const chunk of result.chunks) {
                await writer.write(encoder.encode(chunk));
              }
            }

            // Ensure [DONE] was sent
            await writer.write(encoder.encode("data: [DONE]\n\n"));
          } catch (streamErr) {
            console.error(`[AetherProxy ❌ Stream Error]: ${streamErr.message}`);
            await writer.write(encoder.encode(`data: ${JSON.stringify({ error: streamErr.message })}\n\ndata: [DONE]\n\n`));
          } finally {
            await writer.close();
          }

          // Sync real telemetry to database
          if (accumulatedUsage) {
            await syncTelemetry(env, gatewayId, modelAlias, accumulatedUsage, activePromptHash, activeEncryptedPrompt);
          }
          console.log(`[AetherProxy 🟢] Stream completed for ${gatewayId}`);
        })());

        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            ...CORS_HEADERS,
          },
        });
      } catch (err) {
        return jsonResponse({ error: `Proxy error: ${err.message}` }, 400);
      }
    }

    // ========================================================================
    // Route C: Stripe Checkout Session
    // ========================================================================
    if (url.pathname === "/api/v1/checkout/session" && request.method === "POST") {
      try {
        let plan, email, urlOrigin;
        try {
          const bodyText = await request.text();
          if (!bodyText) throw new Error("Request body is empty.");
          const body = JSON.parse(bodyText);
          plan = body.plan; email = body.email; urlOrigin = body.urlOrigin;
        } catch (jsonErr) {
          return jsonResponse({ error: `JSON Parse Error: ${jsonErr.message}` }, 400);
        }

        if (!plan || !email || !urlOrigin) {
          return jsonResponse({ error: "Missing parameters: plan, email, or urlOrigin." }, 400);
        }

        const stripeConfig = {
          startup:    { base: env.STRIPE_STARTUP_PRICE_ID    || "price_1TdD06DRRNiuPDru4N97bRLc", metered: env.STRIPE_STARTUP_METERED_PRICE_ID    || "price_1TdDBADRRNiuPDrufALyFUED" },
          growth:     { base: env.STRIPE_GROWTH_PRICE_ID     || "price_1TdDHnDRRNiuPDruKSKwXh4s", metered: env.STRIPE_GROWTH_METERED_PRICE_ID     || "price_1TdDIXDRRNiuPDruqyHQ2CWT" },
          scale:      { base: env.STRIPE_SCALE_PRICE_ID      || "price_1TdDMRDRRNiuPDruCCR20nq1", metered: env.STRIPE_SCALE_METERED_PRICE_ID      || "price_1TdDUiDRRNiuPDru4OwtiKMD" },
          enterprise: { base: env.STRIPE_ENTERPRISE_PRICE_ID || "price_1TdDXwDRRNiuPDru3oWwlgBX", metered: env.STRIPE_ENTERPRISE_METERED_PRICE_ID || "price_1TdDa7DRRNiuPDrunchGcMon" },
        };

        const tier = stripeConfig[plan] || stripeConfig.startup;

        if (env.STRIPE_SECRET_KEY) {
          const params = new URLSearchParams({
            "payment_method_types[0]": "card",
            "line_items[0][price]": tier.base, "line_items[0][quantity]": "1",
            "line_items[1][price]": tier.metered,
            "mode": "subscription", "customer_email": email,
            "success_url": `${urlOrigin}/?session_id={CHECKOUT_SESSION_ID}&success=true&plan=${plan}`,
            "cancel_url": `${urlOrigin}/?cancel=true`,
            "automatic_tax[enabled]": "true", "metadata[plan]": plan,
            "subscription_data[metadata][plan_tier]": plan
          });

          const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${env.STRIPE_SECRET_KEY.trim()}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString()
          });

          const data = await stripeRes.json();
          if (data.error) return jsonResponse({ error: data.error.message }, 500);
          return jsonResponse({ url: data.url });
        }

        return jsonResponse({ success: true });
      } catch (err) {
        return jsonResponse({ error: `Checkout error: ${err.message}` }, 400);
      }
    }

    // ========================================================================
    // Route D: Stripe Webhook
    // ========================================================================
    if (url.pathname === "/api/v1/stripe/webhook" && request.method === "POST") {
      try {
        const bodyText = await request.text();
        let event;
        try { event = JSON.parse(bodyText); } catch { return jsonResponse({ error: "Invalid JSON." }, 400); }

        let email = null, paidStatus = null, selectedPlan = "free";

        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          email = session.customer_email || session.customer_details?.email;
          paidStatus = true;
          selectedPlan = session.metadata?.plan || "startup";
        } else if (event.type === "customer.subscription.deleted") {
          email = await fetchCustomerEmail(event.data.object.customer, env);
          paidStatus = false;
        } else if (event.type === "invoice.payment_failed") {
          email = await fetchCustomerEmail(event.data.object.customer, env);
          paidStatus = false;
        } else if (event.type === "customer.subscription.updated") {
          const sub = event.data.object;
          email = await fetchCustomerEmail(sub.customer, env);
          paidStatus = sub.status === "active" || sub.status === "trialing";
          selectedPlan = paidStatus ? (sub.metadata?.plan_tier || "startup") : "free";
        }

        if (email && paidStatus !== null && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?email=eq.${email}`, {
            method: "PATCH",
            headers: {
              "apikey": env.SUPABASE_ANON_KEY,
              "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json", "Prefer": "return=minimal"
            },
            body: JSON.stringify({ paid: paidStatus, plan_tier: selectedPlan, updated_at: new Date() })
          });
          console.log(`[Webhook] Synced: ${email} → paid=${paidStatus}, plan=${selectedPlan}`);
        }

        return jsonResponse({ received: true });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // Default
    return jsonResponse({ service: "AetherCache Edge Gateway Proxy v2.0", status: "Active" });
  },

  // ========================================================================
  // Cron: Real Keep-Warm Heartbeats
  // ========================================================================
  // ========================================================================
  // Cron: Real Keep-Warm Heartbeats & Pruning
  // ========================================================================
  async scheduled(event, env, ctx) {
    console.log(`[AetherPing ⏰] Cron triggered. Active vaults: ${keyVault.size}`);

    // 1. Housekeeping: Prune dead cached prompts older than 7 days from Supabase
    if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const pruneRes = await fetch(`${env.SUPABASE_URL}/rest/v1/cached_prompts?last_used_at=lt.${sevenDaysAgo}`, {
          method: "DELETE",
          headers: {
            "apikey": env.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY}`
          }
        });
        if (pruneRes.ok) {
          console.log(`[AetherPing ⏰] Successfully pruned inactive cached prompts older than 7 days`);
        }
      } catch (pruneErr) {
        console.error("[AetherPing Prune Error]:", pruneErr.message);
      }
    }

    // 2. If no active vaults in memory, try to restore from Supabase (with joined prompts)
    if (keyVault.size === 0 && env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.ENCRYPTION_SECRET) {
      try {
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/gateways?protection_active=eq.true&select=gateway_id,active_model,encrypted_api_key,cached_prefix,profiles(email,paid),cached_prompts(prompt_hash,encrypted_prompt,last_used_at)`, {
          headers: { "apikey": env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY}` }
        });
        const gateways = await res.json();
        for (const gw of (gateways || [])) {
          if (!gw.profiles?.paid || !gw.encrypted_api_key) continue;
          try {
            const rawKey = await decryptKey(gw.encrypted_api_key, env.ENCRYPTION_SECRET);
            
            const cachedPrompts = new Map();
            for (const p of gw.cached_prompts || []) {
              try {
                const decrypted = await decryptKey(p.encrypted_prompt, env.ENCRYPTION_SECRET);
                cachedPrompts.set(p.prompt_hash, { decrypted, lastUsedAt: p.last_used_at });
              } catch { /* skip */ }
            }
            
            // Fallback for legacy cached_prefix column
            if (cachedPrompts.size === 0 && gw.cached_prefix) {
              try {
                const decrypted = await decryptKey(gw.cached_prefix, env.ENCRYPTION_SECRET);
                const hash = await getPromptHash(decrypted);
                cachedPrompts.set(hash, { decrypted, lastUsedAt: gw.updated_at });
              } catch { /* skip */ }
            }
            
            const hash = gw.gateway_id.replace("ae_live_", "");
            keyVault.set(hash, {
              email: gw.profiles.email, model: gw.active_model, rawKey,
              keyPreview: rawKey.substring(0, 8) + "...",
              cachedPrompts,
              protectionActive: true, lastUpdated: new Date()
            });
          } catch { /* skip un-decryptable */ }
        }
        console.log(`[AetherPing ⏰] Restored ${keyVault.size} gateways from database`);
      } catch (err) { console.error("[AetherPing Restore Error]:", err.message); }
    }

    if (keyVault.size === 0) {
      console.log("[AetherPing ⏰] No active gateways. Skipping heartbeats.");
      return;
    }

    // Throttle: Claude every 4 min, others every 8 min
    const intervalIndex = Math.floor(Date.now() / (1000 * 60 * 4));
    const isEightMinuteInterval = intervalIndex % 2 === 0;

    for (const [hash, config] of keyVault.entries()) {
      if (!config.protectionActive || !config.rawKey) continue;

      const providerConfig = PROVIDERS[config.model];
      if (!providerConfig) continue;

      const isClaude = providerConfig.provider === "anthropic";
      if (!isClaude && !isEightMinuteInterval) {
        console.log(`[AetherPing 🟡] Throttled heartbeat for ${config.keyPreview} (${config.model})`);
        continue;
      }

      if (!config.cachedPrompts) config.cachedPrompts = new Map();
      if (config.cachedPrompts.size === 0) continue;

      // Loop through and keep warm all active system prompts cached on this gateway
      for (const [promptHash, promptInfo] of config.cachedPrompts.entries()) {
        const sysPrompt = typeof promptInfo === "string" ? promptInfo : promptInfo.decrypted;
        const lastUsedAtStr = typeof promptInfo === "string" ? config.lastUpdated : promptInfo.lastUsedAt;
        const lastUsedTime = new Date(lastUsedAtStr).getTime();
        const idleTime = Date.now() - lastUsedTime;

        // A. Dynamic Cooldown Filter:
        // Skip heartbeat if a real user request kept the cache warm recently.
        const cooldownThreshold = isClaude ? 3.5 * 60 * 1000 : 7.5 * 60 * 1000;
        if (idleTime <= cooldownThreshold) {
          console.log(`[AetherPing 🟢] Skipping ping for ${config.keyPreview} prompt ${promptHash.substring(0, 8)}: active client traffic detected inside cooldown window (${Math.round(idleTime / 1000)}s ago)`);
          continue;
        }

        // B. 24h Expiration filter:
        // We only warm prompts that have been active/used within the last 24 hours.
        if (idleTime >= 24 * 60 * 60 * 1000) {
          console.log(`[AetherPing 🟡] Skipping ping for ${config.keyPreview} prompt ${promptHash.substring(0, 8)}: idle for over 24h (cache cooled down)`);
          continue;
        }

        try {
          let pingUrl, pingHeaders, pingBody;

          if (providerConfig.provider === "anthropic") {
            pingUrl = providerConfig.endpoint;
            pingHeaders = { "x-api-key": config.rawKey, "anthropic-version": "2023-06-01", "content-type": "application/json" };
            pingBody = JSON.stringify({
              model: providerConfig.apiModel, max_tokens: 1, stream: false,
              system: [{ type: "text", text: sysPrompt, cache_control: { type: "ephemeral" } }],
              messages: [{ role: "user", content: "keepalive" }]
            });
          } else if (providerConfig.provider === "openai" || providerConfig.provider === "deepseek") {
            pingUrl = providerConfig.endpoint;
            pingHeaders = { "Authorization": `Bearer ${config.rawKey}`, "Content-Type": "application/json" };
            pingBody = JSON.stringify({
              model: providerConfig.apiModel, max_tokens: 1, stream: false,
              messages: [
                { role: "system", content: sysPrompt },
                { role: "user", content: "keepalive" }
              ]
            });
          } else if (providerConfig.provider === "google") {
            pingUrl = `${providerConfig.endpoint}/models/${providerConfig.apiModel}:generateContent?key=${config.rawKey}`;
            pingHeaders = { "Content-Type": "application/json" };
            const geminiBody = { 
              contents: [{ role: "user", parts: [{ text: "keepalive" }] }], 
              systemInstruction: { parts: [{ text: sysPrompt }] },
              generationConfig: { maxOutputTokens: 1 } 
            };
            pingBody = JSON.stringify(geminiBody);
          } else {
            continue;
          }

          const pingRes = await fetch(pingUrl, { method: "POST", headers: pingHeaders, body: pingBody });

          if (pingRes.ok) {
            console.log(`[AetherPing 🟢] Heartbeat OK for ${config.keyPreview} (${config.model}) | prompt=${promptHash.substring(0, 8)}`);
          } else {
            const errText = await pingRes.text();
            console.error(`[AetherPing 🔴] Failed for ${config.keyPreview} prompt ${promptHash.substring(0, 8)}: ${pingRes.status} ${errText.substring(0, 100)}`);
            if (pingRes.status === 401 || pingRes.status === 403) {
              config.protectionActive = false;
              console.error(`[AetherPing 🔴] Disabled keep-warm: API key invalid or expired.`);
              break;
            }
          }
        } catch (err) {
          console.error(`[AetherPing ❌] Error for ${config.keyPreview} prompt ${promptHash.substring(0, 8)}: ${err.message}`);
        }
      }
    }
  }
};

// ============================================================================
// Utility: Telemetry Sync (Atomic RPC Integration)
// ============================================================================

async function syncTelemetry(env, gatewayId, modelAlias, usage, promptHash = null, encryptedPrompt = null) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return;

  try {
    const costs = calculateCosts(modelAlias, usage);

    // Call the Supabase PostgreSQL atomic RPC function
    const rpcRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/sync_prompt_telemetry`, {
      method: "POST",
      headers: {
        "apikey": env.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_gateway_id: gatewayId,
        p_prompt_hash: promptHash,
        p_encrypted_prompt: encryptedPrompt,
        p_prompt_tokens: costs.inputTokens,
        p_cached_prompt_tokens: costs.cachedTokens,
        p_cost_without: costs.costWithout,
        p_cost_with: costs.costWith
      })
    });

    if (rpcRes.ok) {
      console.log(`[📊 Telemetry] ${gatewayId}: Atomic sync complete. Prompt=${promptHash ? promptHash.substring(0, 8) : 'none'} | saved=$${(costs.costWithout - costs.costWith).toFixed(6)}`);
    } else {
      const errText = await rpcRes.text();
      console.error(`[📊 Telemetry Sync Error]: Supabase returned ${rpcRes.status}: ${errText}`);
    }
  } catch (err) {
    console.error("[Telemetry Sync Error]:", err.message);
  }
}

// ============================================================================
// Utility: Stripe Customer Email Lookup
// ============================================================================

async function fetchCustomerEmail(customerId, env) {
  if (!customerId || !env.STRIPE_SECRET_KEY) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: { "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}` }
    });
    if (res.ok) { const c = await res.json(); return c.email; }
  } catch (err) { console.error("[Stripe Customer Fetch Error]:", err.message); }
  return null;
}
