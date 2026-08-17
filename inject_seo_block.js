const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/directory_sitemap.json', 'utf8'));

// Extract base paths (e.g. seoul/restaurant/)
const basePaths = Array.from(new Set(data.filter(u => u.loc.includes('/en/')).map(u => u.loc.split('/link/en/')[1])));

// Capitalize first letter of each part
function formatLabel(path) {
  const parts = path.split('/').filter(Boolean);
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function getBlock(prefix) {
  const linksHtml = basePaths.map(p => {
    return '        <a href="' + prefix + p + '" style="color:#2563eb; font-size:12px; text-decoration:none;">' + formatLabel(p) + '</a>';
  }).join('\n');
  
  return `  <!-- SEO Links Block -->
  <details style="margin-top:16px; border:1px solid #e2e8f0; border-radius:12px; padding:12px; background:#f8fafc;">
    <summary style="font-size:13px; font-weight:700; color:#64748b; cursor:pointer; outline:none; list-style:none; text-align:center;">
      View All Regional Directories (Sitemap)
    </summary>
    <div style="margin-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:12px; text-align:left;">
${linksHtml}
    </div>
  </details>
  <!-- SEO Links Block END -->`;
}

function inject(file, prefix) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('<!-- SEO Links Block -->')) {
    content = content.replace(/<!-- SEO Links Block -->[\s\S]*?<!-- SEO Links Block END -->/, getBlock(prefix));
  } else {
    // Inject right after natPg
    const target = '<div id="natPg" class="pg" style="margin-top:20px; display:flex; justify-content:center; gap:8px;"></div>';
    if(content.includes(target)) {
      content = content.replace(target, target + '\n' + getBlock(prefix));
    } else {
      console.log('Target natPg not found in ' + file);
    }
  }
  fs.writeFileSync(file, content, 'utf8');
}

inject('index.html', 'en/');
inject('th/index.html', '');
inject('vi/index.html', '');
console.log('Injected SEO blocks!');
