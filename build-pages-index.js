#!/usr/bin/env node
/* Writes pages.json: the list of Tether pages (games, tools...) shown in the app's menu.
   It reads the <meta name="tether:..."> tags at the top of every .html file next to this script.
   No dependencies. Run it yourself with `node build-pages-index.js`, or let the GitHub Action
   in .github/workflows/pages-index.yml do it on every push. */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function read(file) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  const tags = {};
  for (const m of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const name = /name\s*=\s*["']tether:([a-z-]+)["']/i.exec(m[1]);
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(m[1]);
    if (name && content) tags[name[1].toLowerCase()] = decode(content[1] != null ? content[1] : content[2]);
  }
  if (!tags.page || !tags.title) return null;                       // not a Tether page
  return {
    file, type: tags.page.toLowerCase(), title: tags.title, icon: tags.icon || 'sparkle',
    blurb: tags.blurb || '', order: +tags.order || 100, action: tags.action || '', section: tags.section || '',
  };
}

const pages = fs.readdirSync(dir)
  .filter((f) => /\.html?$/i.test(f) && !/^index\.html?$/i.test(f))
  .sort()
  .map(read)
  .filter(Boolean)
  .sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title));

fs.writeFileSync(path.join(dir, 'pages.json'), JSON.stringify(pages, null, 2) + '\n');
console.log(`pages.json: ${pages.length} pages -> ${pages.map((p) => p.file).join(', ')}`);
