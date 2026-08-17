const fs = require('fs');

const thContent = fs.readFileSync('th/index.html', 'utf8');
const startTag = '<details style="margin-top:16px; border:1px solid #e2e8f0; border-radius:12px; padding:12px; background:#f8fafc;">';
const endTag = '</details>';

const startIdx = thContent.indexOf(startTag);
const endIdx = thContent.indexOf(endTag, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  let thBlock = thContent.slice(startIdx, endIdx + endTag.length);
  // Replace href="..." with href="en/..." for English
  let enBlock = thBlock.replace(/href=\"([^\"]+)\"/g, 'href="en/$1"');
  
  let enContent = fs.readFileSync('index.html', 'utf8');
  
  const enStart = enContent.indexOf(startTag);
  const enEnd = enContent.indexOf(endTag, enStart);
  
  if (enStart !== -1 && enEnd !== -1) {
    enContent = enContent.slice(0, enStart) + enBlock + enContent.slice(enEnd + endTag.length);
    fs.writeFileSync('index.html', enContent, 'utf8');
    console.log('Successfully synced index.html with 51 static links from th/index.html');
  } else {
    console.log('Failed to find target block in index.html');
  }
} else {
  console.log('Failed to find source block in th/index.html');
}
