const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'site');
const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.html'));

for (const file of files) {
    const filePath = path.join(targetDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Arabic active case
    content = content.replace('<span class="on">العربية</span></nav>', '<span class="on">العربية</span> &nbsp;·&nbsp; <a href="../fa/">فارسی</a></nav>');
    
    // Arabic link case
    content = content.replace('<a href="../ar/">العربية</a></nav>', '<a href="../ar/">العربية</a> &nbsp;·&nbsp; <a href="../fa/">فارسی</a></nav>');
    
    // Arabic link case (zh)
    content = content.replace('<a href="ar/" style="color:var(--seal);text-decoration:none">العربية</a></nav>', '<a href="ar/" style="color:var(--seal);text-decoration:none">العربية</a> &nbsp;·&nbsp; <a href="fa/" style="color:var(--seal);text-decoration:none">فارسی</a></nav>');
    
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
}
