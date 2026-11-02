import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { entries, root, walk } from './build-site.mjs';

const errors = [];
const files = [];
for (const entry of entries) {
  const path = join(root, entry);
  if ((await stat(path)).isDirectory()) files.push(...await walk(path));
  else files.push(path);
}
const publicFiles = new Set(files.map(path => relative(root, path).replaceAll('\\', '/')));
const htmlIds = new Map();
let referenceCount = 0;
const externalLinks = new Set();
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');

async function checkReference(source, raw) {
  const value = decode(raw);
  if (/^https?:/i.test(value)) { externalLinks.add(value); return; }
  if (/^(?:data:|mailto:|tel:)/i.test(value)) return;
  referenceCount++;
  if (value.startsWith('/')) { errors.push(`${source}: root-relative path breaks project hosting: ${value}`); return; }
  const [pathAndQuery, fragment] = value.split('#');
  const path = decodeURIComponent(pathAndQuery.split('?')[0]);
  let target = path ? join(dirname(source), path) : source;
  if (path.endsWith('/')) target = join(target, 'index.html');
  const key = relative(root, target).replaceAll('\\', '/');
  if (!publicFiles.has(key)) { errors.push(`${relative(root, source)}: missing or wrong-case target ${value}`); return; }
  if (fragment && target.endsWith('.html')) {
    if (!htmlIds.has(target)) {
      const html = await readFile(target, 'utf8');
      htmlIds.set(target, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])));
    }
    if (!htmlIds.get(target).has(decodeURIComponent(fragment))) errors.push(`${relative(root, source)}: missing anchor ${value}`);
  }
}

for (const file of files) {
  if (file.endsWith('.html')) {
    const html = await readFile(file, 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    if (new Set(ids).size !== ids.length) errors.push(`${file}: duplicate IDs`);
    const markup = html.replace(/&lt;[\s\S]*?&gt;/g, '');
    for (const match of markup.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)) await checkReference(file, match[1]);
    for (const match of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt="[^"]*"/.test(match[0])) errors.push(`${file}: image has no alt text`);
    if (!/<html\b[^>]*\blang="en"/.test(html)) errors.push(`${file}: missing document language`);
  } else if (file.endsWith('.css')) {
    for (const match of (await readFile(file, 'utf8')).matchAll(/url\(["']?([^"')]+)["']?\)/g)) await checkReference(file, match[1]);
  } else if (file.endsWith('.md')) {
    for (const match of (await readFile(file, 'utf8')).matchAll(/\]\(([^)]+)\)/g)) await checkReference(file, match[1]);
  }
}
const manifestFile = join(root, '05-web-kit/site.webmanifest');
const webManifest = JSON.parse(await readFile(manifestFile, 'utf8'));
for (const key of ['id', 'start_url', 'scope']) await checkReference(manifestFile, webManifest[key]);
for (const icon of webManifest.icons) await checkReference(manifestFile, icon.src);

const manifest = JSON.parse(await readFile(join(root, 'asset-manifest.json'), 'utf8'));
if (manifest.assets.length !== manifest.artwork_file_count) errors.push('Artwork inventory count differs from records.');
for (const asset of manifest.assets) {
  await checkReference(join(root, 'asset-manifest.json'), asset.file);
  const bytes = await readFile(join(root, asset.file));
  if (bytes.length !== asset.bytes) errors.push(`Size mismatch: ${asset.file}`);
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) errors.push(`SHA-256 mismatch: ${asset.file}`);
}
const csv = await readFile(join(root, 'asset-manifest.csv'), 'utf8');
if (csv.trim().split(/\r?\n/).length - 1 !== manifest.assets.length) errors.push('CSV inventory count differs from JSON.');
for (const asset of manifest.assets) if (!csv.includes(asset.file) || !csv.includes(asset.sha256)) errors.push(`CSV inventory differs: ${asset.file}`);

// Documents and videos must remain reachable rather than becoming orphaned again.
const pages = (await Promise.all(files.filter(file => file.endsWith('.html')).map(file => readFile(file, 'utf8')))).join('\n');
for (const file of await walk(join(root, 'docs'))) {
  if (/\.(?:docx|pdf|mp4|css|png)$/.test(file) && !file.includes('guide-images')) {
    const name = file.split(/[\\/]/).at(-1);
    if (!pages.includes(encodeURIComponent(name)) && !pages.includes(name)) errors.push(`Orphaned document: ${name}`);
  }
}
const report = {
  status: errors.length ? 'FAIL' : 'PASS',
  public_files: files.length,
  html_pages: files.filter(file => file.endsWith('.html')).length,
  local_references_checked: referenceCount,
  artwork_hashes_verified: manifest.assets.length,
  external_links_listed: externalLinks.size,
  errors,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
