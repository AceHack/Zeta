const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.join(__dirname, '..', 'site');

// Find all HTML files
const files = fs.readdirSync(TARGET_DIR)
    .filter(f => f.startsWith('index.') && f.endsWith('.html'));

const FA_LINK = '<a href="../fa/">فارسی</a>';
const FA_ON = '<span class="on">فارسی</span>';
const NC_LINK = '<a href="../en-nc/">NC Drawl</a>';
const NC_ON = '<span class="on">NC Drawl</span>';

for (const file of files) {
    const filepath = path.join(TARGET_DIR, file);
    let content = fs.readFileSync(filepath, 'utf-8');

    if (content.includes(NC_LINK) || content.includes(NC_ON)) {
        console.log(`Already patched: ${file}`);
        continue;
    }

    // Is this the en-nc file itself? (doesn't exist yet, but for future)
    if (file === 'index.en-nc.html') {
        content = content.replace(FA_LINK, `${FA_LINK}\n  ${NC_ON}`);
        content = content.replace(FA_ON, `${FA_ON}\n  ${NC_ON}`);
    } else {
        // Any other file, just append the NC_LINK after the FA_LINK (or FA_ON)
        content = content.replace(FA_LINK, `${FA_LINK}\n  ${NC_LINK}`);
        content = content.replace(FA_ON, `${FA_ON}\n  ${NC_LINK}`);
    }
    
    // Specifically for zh which uses local inline styles for nav:
    if (file === 'index.zh.html') {
        const FA_ZH = '<a href="fa/" style="color:var(--seal);text-decoration:none">فارسی</a>';
        const NC_ZH = '<a href="en-nc/" style="color:var(--seal);text-decoration:none">NC Drawl</a>';
        content = content.replace(FA_ZH, `${FA_ZH}\n  ${NC_ZH}`);
    }

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`Patched: ${file}`);
}
