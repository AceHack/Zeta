const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..', 'site');

// Find all HTML files
const files = fs.readdirSync(TARGET_DIR)
    .filter(f => f.startsWith('index.') && f.endsWith('.html'));

for (const file of files) {
    const filepath = path.join(TARGET_DIR, file);
    let content = fs.readFileSync(filepath, 'utf-8');

    content = content.replace(/<meta name="robots" content="noindex, nofollow">\n/g, '');
    content = content.replace(/<meta name="googlebot" content="noindex, nofollow">\n/g, '');

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`Removed SEO blocks from: ${file}`);
}
