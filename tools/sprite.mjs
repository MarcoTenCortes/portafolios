// Genera public/icons/sprite.svg a partir de simple-icons (versión fijada en package.json).
// Falla si algún slug no existe, para que nunca se publique un chip sin icono por error.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import * as icons from 'simple-icons';

const version = JSON.parse(readFileSync(new URL('../node_modules/simple-icons/package.json', import.meta.url), 'utf8')).version;

export const SLUGS = [
  'openjdk', 'springboot', 'python', 'django', 'flask', 'mysql', 'mongodb', 'firebase', 'sqlite',
  'selenium', 'junit5', 'cucumber', 'postman', 'appium',
  'javascript', 'html5', 'css', 'react', 'expo', 'tailwindcss', 'bootstrap',
  'keras', 'tensorflow', 'kaggle', 'googlecloud',
  'git', 'github', 'openapiinitiative', 'jira', 'confluence', 'trello', 'unity', 'telegram',
  'googlechrome', 'opencode', 'modelcontextprotocol', 'nodedotjs',
  'githubactions', 'gitlab', 'docker', 'kubernetes', 'claude', 'githubcopilot', 'googlebigquery', 'pandas', 'gnubash', 'jsonwebtokens', 'openbao'
];

const missing = [];
const symbols = [];
for (const slug of SLUGS) {
  const key = 'si' + slug.charAt(0).toUpperCase() + slug.slice(1);
  const icon = icons[key];
  if (!icon) { missing.push(slug); continue; }
  symbols.push(`<symbol id="${slug}" viewBox="0 0 24 24"><title>${icon.title}</title><path d="${icon.path}"/></symbol>`);
}
if (missing.length) {
  console.error(`Slugs no encontrados en simple-icons@${version}: ${missing.join(', ')}`);
  process.exit(1);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg"><!-- simple-icons@${version} (CC0), generado por tools/sprite.mjs -->\n${symbols.join('\n')}\n</svg>\n`;
mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/sprite.svg', svg);
console.log(`sprite.svg: ${symbols.length} iconos (simple-icons@${version}), ${svg.length} bytes`);
