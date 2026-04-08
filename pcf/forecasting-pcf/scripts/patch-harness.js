const fs = require('fs');
const path = require('path');

const harnessHtml = path.join(__dirname, '..', 'node_modules', 'pcf-start', 'index.html');

if (fs.existsSync(harnessHtml)) {
  const content = fs.readFileSync(harnessHtml, 'utf8');
  // Remove React 16 CDN script tags — our bundle provides React 19
  const patched = content
    .replace(/<script src="https:\/\/unpkg\.com\/react@[^"]*"><\/script>/g, '')
    .replace(/<script src="https:\/\/unpkg\.com\/react-dom@[^"]*"><\/script>/g, '')
    .replace(/<\/title>/, '</title><script>window.React = window.React || {}; window.ReactDOM = window.ReactDOM || {};</script>');
  fs.writeFileSync(harnessHtml, patched, 'utf8');
  console.log('Patched pcf-start/index.html: removed React 16 CDN scripts');
} else {
  console.log('pcf-start/index.html not found, skipping patch');
}
