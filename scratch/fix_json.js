const fs = require('fs');
const path = require('path');

const langs = ['en', 'th', 'vi'];
const dataDir = path.join(__dirname, '../data');
const newsDir = path.join(__dirname, '../news');

for (const lang of langs) {
  const jsonPath = path.join(dataDir, `news_list_${lang}.json`);
  if (!fs.existsSync(jsonPath)) continue;
  let list = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const originalLength = list.length;
  list = list.filter(item => {
    const htmlPath = path.join(newsDir, `${item.id}.html`);
    return fs.existsSync(htmlPath);
  });
  console.log(`${lang}: Removed ${originalLength - list.length} items`);
  fs.writeFileSync(jsonPath, JSON.stringify(list, null, 2));
}
