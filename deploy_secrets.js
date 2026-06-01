/* ==========================================================================
   AetherCache Edge Secrets Autopilot Deployer
   ========================================================================== */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("\n\x1b[35m========================================================================\x1b[0m");
console.log("\x1b[35m🔒 AetherCache Serverless Edge Secrets Autopilot Deployer\x1b[0m");
console.log("\x1b[35m========================================================================\x1b[0m\n");

const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log("\x1b[31m❌ Error: .env file not found!\x1b[0m");
    console.log("Please create a file named \x1b[36m.env\x1b[0m in this directory containing your secrets.");
    console.log("You can copy the template from \x1b[36m.env.example\x1b[0m.\n");
    process.exit(1);
}

// Simple parser for .env
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.includes('=')) return;
    
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    const cleanKey = key.trim();
    
    let cleanVal = value;
    if (cleanVal.startsWith('"') && cleanVal.endsWith('"')) {
        cleanVal = cleanVal.substring(1, cleanVal.length - 1);
    } else if (cleanVal.startsWith("'") && cleanVal.endsWith("'")) {
        cleanVal = cleanVal.substring(1, cleanVal.length - 1);
    }
    
    env[cleanKey] = cleanVal.trim();
});

const secretsToBind = [
    'STRIPE_SECRET_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    // Startup tier
    'STRIPE_STARTUP_PRODUCT_ID',
    'STRIPE_STARTUP_PRICE_ID',
    'STRIPE_STARTUP_METERED_PRICE_ID',
    // Growth tier
    'STRIPE_GROWTH_PRODUCT_ID',
    'STRIPE_GROWTH_PRICE_ID',
    'STRIPE_GROWTH_METERED_PRICE_ID',
    // Scale tier
    'STRIPE_SCALE_PRODUCT_ID',
    'STRIPE_SCALE_PRICE_ID',
    'STRIPE_SCALE_METERED_PRICE_ID',
    // Enterprise tier
    'STRIPE_ENTERPRISE_PRODUCT_ID',
    'STRIPE_ENTERPRISE_PRICE_ID',
    'STRIPE_ENTERPRISE_METERED_PRICE_ID',
    // Webhook
    'STRIPE_WEBHOOK_SECRET',
    // Encryption
    'ENCRYPTION_SECRET'
];

console.log(`Parsed .env file. Found ${Object.keys(env).length} variables.\n`);

let successCount = 0;

secretsToBind.forEach(secret => {
    const value = env[secret];
    if (!value) {
        console.log(`\x1b[33m⚠️  Skipping ${secret} (Not found in .env file)\x1b[0m`);
        return;
    }

    console.log(`📤 Binding secret \x1b[36m${secret}\x1b[0m (Length: ${value.length} chars)...`);
    
    try {
        // Feed the secret value directly into Wrangler's stdin using execSync input option
        execSync(`npx wrangler@3.60.0 secret put ${secret}`, {
            input: value,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'] // ignore stderr to keep output super clean
        });
        console.log(`\x1b[32m✅ Successfully bound ${secret}!\x1b[0m`);
        successCount++;
    } catch (err) {
        console.log(`\x1b[31m❌ Failed to bind ${secret}: ${err.message}\x1b[0m`);
    }
});

console.log("\n\x1b[35m========================================================================\x1b[0m");
console.log(`\x1b[32m🎉 Autopilot binding completed! Bound ${successCount} secrets successfully.\x1b[0m`);
console.log("You can now run: \x1b[36mnpx wrangler@3.60.0 deploy\x1b[0m to deploy the live worker.");
console.log("\x1b[35m========================================================================\x1b[0m\n");
