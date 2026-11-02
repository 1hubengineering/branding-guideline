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
const manifestFile = join(root, 'assets/web-kit/site.webmanifest');
const webManifest = JSON.parse(await readFile(manifestFile, 'utf8'));
for (const key of ['id', 'start_url', 'scope']) await checkReference(manifestFile, webManifest[key]);
for (const icon of webManifest.icons) await checkReference(manifestFile, icon.src);

const manifest = JSON.parse(await readFile(join(root, 'assets/asset-manifest.json'), 'utf8'));
if (manifest.assets.length !== manifest.artwork_file_count) errors.push('Artwork inventory count differs from records.');
for (const asset of manifest.assets) {
  await checkReference(join(root, 'index.html'), asset.file);
  const bytes = await readFile(join(root, asset.file));
  if (bytes.length !== asset.bytes) errors.push(`Size mismatch: ${asset.file}`);
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) errors.push(`SHA-256 mismatch: ${asset.file}`);
}
const csv = await readFile(join(root, 'assets/asset-manifest.csv'), 'utf8');
if (csv.trim().split(/\r?\n/).length - 1 !== manifest.assets.length) errors.push('CSV inventory count differs from JSON.');
for (const asset of manifest.assets) if (!csv.includes(asset.file) || !csv.includes(asset.sha256)) errors.push(`CSV inventory differs: ${asset.file}`);

const catalog = JSON.parse(await readFile(join(root, 'assets/catalog.json'), 'utf8'));
const catalogPaths = new Set();
const catalogIds = new Set();
for (const resource of catalog.resources) {
  if (catalogIds.has(resource.id)) errors.push(`Duplicate catalog ID: ${resource.id}`);
  catalogIds.add(resource.id);
  if (resource.preview) await checkReference(join(root, 'index.html'), resource.preview);
  if (!resource.files.length) errors.push(`No downloadable files: ${resource.id}`);
  for (const file of resource.files) {
    if (!file.path.startsWith('assets/')) errors.push(`Resource outside assets/: ${file.path}`);
    await checkReference(join(root, 'index.html'), file.path);
    const bytes = await readFile(join(root, file.path));
    if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) errors.push(`Stale catalog file record: ${file.path}`);
    catalogPaths.add(file.path);
  }
}
for (const bundle of catalog.bundles) {
  await checkReference(join(root, 'index.html'), bundle.path);
  const bytes = await readFile(join(root, bundle.path));
  if (bytes.length !== bundle.bytes || createHash('sha256').update(bytes).digest('hex') !== bundle.sha256) errors.push(`Stale ZIP bundle: ${bundle.path}`);
}
for (const resourceFolder of ['documents', 'images', 'videos', 'fonts', 'logos', 'icons', 'web-kit', 'reference', 'templates', 'qr', 'ai']) {
  for (const file of await walk(join(root, 'assets', resourceFolder))) {
    const path = relative(root, file).replaceAll('\\', '/');
    if (!catalogPaths.has(path) && !/\/(?:templates|qr-codes)\.json$/.test(path)) errors.push(`Resource missing from gallery: ${path}`);
  }
}
for (const file of files.filter(path => path.endsWith('.html'))) {
  const markup = await readFile(file, 'utf8');
  const links = [...markup.matchAll(/\bhref="([^"]+)"/g)].map(match => decode(match[1]));
  if (!links.some(value => !/^(?:https?:|data:|#)/.test(value) && join(dirname(file), value.split(/[?#]/)[0]) === join(root, 'index.html'))) errors.push(`Page missing a back-to-home link: ${relative(root, file)}`);
}
const report = {
  status: errors.length ? 'FAIL' : 'PASS',
  public_files: files.length,
  html_pages: files.filter(file => file.endsWith('.html')).length,
  local_references_checked: referenceCount,
  artwork_hashes_verified: manifest.assets.length,
  catalog_resources: catalog.resources.length,
  catalog_files_verified: catalogPaths.size,
  category_zip_bundles: catalog.bundles.length,
  external_links_listed: externalLinks.size,
  errors,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
