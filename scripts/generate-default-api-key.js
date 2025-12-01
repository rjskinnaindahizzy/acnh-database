const fs = require('fs');
const path = require('path');

const key = process.env.DEFAULT_API_KEY || '';
const outDir = path.join(__dirname, '..', 'config');
fs.mkdirSync(outDir, { recursive: true });
const content = key ? `window.DEFAULT_API_KEY = '${key}';\n` : '';
fs.writeFileSync(path.join(outDir, 'default-api-key.js'), content, 'utf8');
