const https = require('https');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.argv[2];

if (!ANTHROPIC_API_KEY) {
    console.log('Provide key as argument.');
    process.exit(1);
}

const options = {
    hostname: 'api.anthropic.com',
    port: 443,
    path: '/v1/models',
    method: 'GET',
    headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', body);
    });
});

req.on('error', (err) => console.error(err));
req.end();
