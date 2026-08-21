const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data', 'guides_content');
const listPath = path.join(__dirname, 'data', 'guides_list.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Simple markdown to HTML parser tailored for our needs
function mdToHtml(md) {
  let html = md.trim();
  if (!html) return '';
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Images  ![alt](src) -> <img>   (링크 변환보다 먼저 처리)
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_m, alt, src) {
    return '<img src="' + src + '" alt="' + alt + '" loading="lazy">';
  });

  // Links  [text](url) -> <a href="url">text</a>
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, text, url) {
    var ext = /^https?:/.test(url);
    return '<a href="' + url + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + text + '</a>';
  });

  // Lists
  html = html.replace(/^\s*\- (.*$)/gim, '<ul><li>$1</li></ul>');
  html = html.replace(/<\/ul>\n<ul>/g, '\n');
  
  // Blockquote  "> text" -> <blockquote>
  html = html.replace(/^\s*&gt; (.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/^\s*> (.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br>');

  // Ordered list  "1. text" -> <ol><li>
  html = html.replace(/^\s*\d+\. (.*$)/gim, '<ol><li>$1</li></ol>');
  html = html.replace(/<\/ol>\n<ol>/g, '');

  // Tables
  // Detect table blocks
  let tableRegex = /((?:\|.*\|\n)+)/g;
  html = html.replace(tableRegex, (match) => {
    let lines = match.trim().split('\n');
    if (lines.length < 3) return match; // Not a valid table
    
    let tableHtml = '<div class="table-wrap"><div class="table-scroll"><table><thead><tr>';
    let headers = lines[0].split('|').filter(c => c.trim() !== '');
    headers.forEach(h => { tableHtml += `<th>${h.trim()}</th>`; });
    tableHtml += '</tr></thead><tbody>';
    
    for (let i = 2; i < lines.length; i++) {
      let cells = lines[i].split('|').filter(c => c.trim() !== '');
      if (cells.length > 0) {
        tableHtml += '<tr>';
        cells.forEach(c => { tableHtml += `<td>${c.trim()}</td>`; });
        tableHtml += '</tr>';
      }
    }
    tableHtml += '</tbody></table></div></div>';
    return tableHtml;
  });
  
  // Paragraphs
  html = html.split('\n\n').map(p => {
    if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<table') || p.startsWith('<div') || p.startsWith('<figure') || p.startsWith('<blockquote')) return p;
    return `<p>${p.trim().replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  
  return html;
}

function processGuides() {
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.md'));
  let guides = [];
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(dataDir, file), 'utf8').replace(/\r\n/g, '\n');
    
    // Parse Meta
    const metaMatch = content.match(/---\n([\s\S]*?)\n---/);
    if (!metaMatch) return;
    
    const metaStr = metaMatch[1];
    let meta = {};
    metaStr.split('\n').forEach(line => {
      const parts = line.split(': ');
      if (parts.length >= 2) {
        meta[parts[0].trim()] = parts.slice(1).join(': ').trim();
      }
    });
    
    // Parse Languages
    const getLangSection = (lang) => {
      const regex = new RegExp(`<!-- ${lang} START -->([\\s\\S]*?)<!-- ${lang} END -->`);
      const match = content.match(regex);
      return match ? match[1].trim() : '';
    };
    
    const title_en = getLangSection('TITLE_EN');
    const title_th = getLangSection('TITLE_TH');
    const title_vi = getLangSection('TITLE_VI');
    
    const en_md = getLangSection('EN');
    const th_md = getLangSection('TH');
    const vi_md = getLangSection('VI');
    
    guides.push({
      id: meta.id,
      category: meta.category,
      tag: meta.tag,
      title_en: title_en,
      title_th: title_th,
      title_vi: title_vi,
      image: meta.image,
      date: meta.date,
      content_en: mdToHtml(en_md),
      content_th: mdToHtml(th_md),
      content_vi: mdToHtml(vi_md)
    });
  });
  
  fs.writeFileSync(listPath, JSON.stringify(guides, null, 2), 'utf8');
  console.log(`Successfully compiled ${guides.length} guides into guides_list.json`);
}

processGuides();
