import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = (process.env.SITEMAP_BASE_URL || 'https://system-overload.com').replace(/\/$/, '');

const routes = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/register', priority: 0.7, changefreq: 'monthly' },
];

const now = new Date().toISOString();

const entries = routes
  .map(({ path, priority, changefreq }) => {
    const url = `${BASE_URL}${path}`;
    return `  <url>\n    <loc>${url}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;

const outPath = resolve(process.cwd(), 'public', 'sitemap.xml');
writeFileSync(outPath, xml, 'utf8');

console.log(`Generated sitemap with ${routes.length} entries at ${outPath}`);
