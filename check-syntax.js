const fs = require('fs');
const code = fs.readFileSync('src/pages/StatusPage.jsx', 'utf8');
try {
  require('@babel/parser').parse(code, {sourceType: 'module', plugins: ['jsx']});
  console.log('Syntax OK');
} catch(e) {
  console.error('Syntax error:', e.message);
  console.error(e.stack);
}