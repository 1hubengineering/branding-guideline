import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { zip } from './zip.mjs';

const registry = JSON.parse(await readFile('assets/asset-manifest.json', 'utf8'));
const spec = JSON.parse(await readFile('assets/brand-spec.json', 'utf8'));
const brand = JSON.parse(await readFile('assets/brand.json', 'utf8'));
const resources = [], groups = new Map(), included = new Set();
await mkdir('assets/ai', { recursive: true });
try { await stat('assets/ai/resource-index.json'); }
catch { await writeFile('assets/ai/resource-index.json', '{"version":2,"resources":[]}\n'); }
const human = value => value.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files.sort();
}
async function fileRecord(path, label, existing = {}) {
  const bytes = await readFile(path);
  return { path, format: extname(path).slice(1).toLowerCase(), label, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    ...(existing.width_px ? { width: existing.width_px, height: existing.height_px } : {}) };
}
async function addFile(group, path, label, existing) {
  if (included.has(path)) return;
  included.add(path);
  group.files.push(await fileRecord(path, label, existing));
}
function group(id, data) {
  if (!groups.has(id)) { const resource = { id, ...data, files: [] }; groups.set(id, resource); resources.push(resource); }
  return groups.get(id);
}
for (const artwork of registry.assets) {
  const { file: path, layout, theme, kind } = artwork;
  let resource;
  if (path.startsWith('assets/logos/') && kind !== 'starter icon') {
    resource = group(`logo-${layout}-${theme}`, { name: `${human(layout)} / ${human(theme)}`, category: 'logos',
      description: `${spec.layouts[layout]?.description || 'Logo artwork'}. ${spec.themes[theme]?.description || ''} Preserve its proportions and clear space.`,
      preview: `assets/logos/svg/${layout}/andhub-${layout}-${theme}.svg`, layout, theme,
      dark_surface: !!spec.themes[theme]?.dark_surface, tags: [layout, theme, 'logo', kind] });
  } else if (kind === 'auto-theme SVG') {
    resource = group(`logo-${layout}-automatic`, { name: `${human(layout)} / Automatic theme`, category: 'logos',
      description: 'SVG follows the operating-system color preference. The preview uses the fixed light-surface counterpart.',
      preview: `assets/logos/svg/${layout}/andhub-${layout}-gradient-light.svg`, theme: 'automatic', layout, tags: ['automatic', 'web', layout] });
  } else {
    const app = path.match(/assets\/icons\/app-and-avatar\/([^/]+)/);
    const transparent = path.match(/assets\/icons\/transparent\/([^/]+)/);
    const key = app ? `app-${app[1]}` : transparent ? `transparent-${transparent[1]}` : 'web-favicons';
    resource = group(`icons-${key}`, { name: app ? `App icon & avatar / ${human(app[1])}` : transparent ? `Transparent icon / ${human(transparent[1])}` : 'Web favicon & mask kit',
      category: 'icons', description: app ? 'Square app and avatar artwork with safe space for platform masks.' : 'Symbol artwork and small-size exports. Review tiny sizes in the intended context.',
      preview: app ? `assets/icons/app-and-avatar/${app[1]}/andhub-app-icon.svg` : transparent ? `assets/icons/transparent/${transparent[1]}/andhub-icon.svg` : 'assets/web-kit/icon-192.png',
      theme: theme || 'light', dark_surface: !!transparent && !!spec.themes[theme]?.dark_surface,
      tags: ['icon', theme, app ? 'avatar' : 'transparent', 'favicon'] });
  }
  const label = `${artwork.format.toUpperCase()}${artwork.width_px ? ` · ${artwork.width_px} × ${artwork.height_px}` : ''}${kind.startsWith('starter') ? ' · starter copy' : ''}`;
  await addFile(resource, path, label, artwork);
}

const legacy = JSON.parse(await readFile('assets/legacy/legacy-assets.json', 'utf8'));
for (const input of legacy.resources) {
  const resource = { ...input, files: [] };
  resources.push(resource);
  for (const file of input.files) await addFile(resource, file.path, file.label);
}
const archiveGuide = group('legacy-archive-guide', { name: 'Legacy / Archive guide & original-file inventory', category: 'documents', status: 'legacy', recommended: false,
  description: 'Historical asset notes, original filenames and checksums. Current logo masters and company details take precedence.', preview: null, tags: ['legacy', 'old', 'archive', 'inventory'] });
for (const path of ['assets/legacy/README.md','assets/legacy/legacy-assets.json']) await addFile(archiveGuide, path, basename(path));

for (const folder of ['assets/images', 'assets/reference', 'assets/documents', 'assets/web-kit', 'assets/fonts', 'assets/videos']) {
  for (const path of await walk(folder)) {
    if (included.has(path)) continue;
    const format = extname(path).slice(1).toLowerCase(), name = basename(path);
    let resource;
    if (['png', 'jpg', 'gif', 'svg'].includes(format)) {
      resource = group(`image-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { name: human(basename(path, extname(path))), category: 'images',
        description: path.includes('/guide/') ? 'Illustration retained from the original guideline document.' : path.includes('Board') ? 'Supplied reference board; use the vector masters for production.' : 'Brand reference and animation artwork.',
        preview: path, tags: ['image', format, path.includes('/guide/') ? 'guideline illustration' : 'reference'] });
    } else if (folder === 'assets/fonts') {
      resource = group('fonts-inter', { name: 'Inter variable font family', category: 'fonts',
        description: 'Official Inter upright and italic web fonts plus desktop TTF. Includes the SIL Open Font License.', preview: null, tags: ['font', 'Inter', 'typography', 'woff2', 'ttf', 'license'] });
    } else if (format === 'mp4') {
      const primary = path === brand.motion.primary_animation;
      resource = group(`video-${name}`, { name: primary ? brand.motion.primary_animation_name : `Experiment / ${human(basename(path, '.mp4'))}`, category: 'videos',
        description: primary ? 'The primary AndHub logo animation, designated by the brand owner. Use this video for brand communication.' : 'Test/experimental animation, retained for reference. Use the primary logo animation for brand communication.',
        status: primary ? 'primary' : brand.motion.other_videos_status, recommended: primary,
        preview: brand.motion.primary_poster, tags: ['video', 'motion', primary ? 'primary main logo animation' : 'experimental test', name.includes('silent') ? 'silent' : 'animation', name.includes('square') ? 'square' : name.includes('portrait') ? 'portrait' : 'landscape'] });
    } else if (/Brand_Guidelines.*\.(pdf|docx)$/.test(name)) {
      resource = group('documents-original-guide', { name: 'Original brand guidelines / v1.0', category: 'documents',
        description: 'The original paginated guide and editable Word document. Proposed standards; predates the current asset library.', preview: 'assets/images/reference/AndHub Engineering Brand Identity Board.png', tags: ['guidelines', 'pdf', 'docx', 'brand'] });
    } else {
      resource = group(`document-${name}`, { name: human(basename(path, extname(path))), category: 'documents',
        description: path.includes('web-kit') ? 'Reusable web integration resource.' : 'Brand documentation, implementation guidance or validation reference.', preview: null, tags: [format, path.includes('web-kit') ? 'web integration' : 'reference'] });
    }
    await addFile(resource, path, name);
  }
}
for (const [path, name] of [['assets/brand.json', 'Company profile & contact data'], ['assets/brand-spec.json', 'Reconstructed brand specification'], ['assets/asset-manifest.json', 'Artwork inventory / JSON'], ['assets/asset-manifest.csv', 'Artwork inventory / CSV']]) {
  const item = group(`document-${basename(path)}`, { name, category: 'documents', description: 'Machine-readable source for the brand resource library.', preview: null, tags: ['metadata', 'reference'] });
  await addFile(item, path, basename(path));
}
for (const path of ['assets/templates/templates.json', 'assets/qr/qr-codes.json']) {
  const metadata = JSON.parse(await readFile(path, 'utf8'));
  const records = Array.isArray(metadata) ? metadata : metadata.resources || metadata.templates || metadata.codes || metadata.items || metadata.assets;
  if (!Array.isArray(records)) throw new Error(`Expected resource array in ${path}`);
  for (const input of records) {
    const resource = { ...input, files: [] };
    resources.push(resource);
    for (const file of input.files) await addFile(resource, file.path, file.label || basename(file.path));
  }
}
// Surface supporting template/QR documentation too, without duplicate generated records.
for (const folder of ['assets/templates', 'assets/qr']) {
  for (const path of await walk(folder)) {
    if (included.has(path) || path.endsWith('/templates.json') || path.endsWith('/qr-codes.json')) continue;
    const resource = group(`support-${path}`, { name: human(basename(path, extname(path))), category: 'documents', description: 'Supporting authoring or QR documentation.', preview: null, tags: ['support', folder.split('/').at(-1)] });
    await addFile(resource, path, basename(path));
  }
}
for (const path of await walk('assets/ai')) {
  const resource = group(`ai-${path}`, { name: human(basename(path, extname(path))), category: 'ai',
    description: path.endsWith('SKILL.md') ? 'Reusable AndHub brand skill for compatible agents. See the AI guide for installation.' : path.endsWith('mcp-server.mjs') ? 'Read-only MCP adapter for local stdio clients. Run from the downloaded toolkit or a repository checkout.' : 'AI-readable brand context, source data, schemas or integration guidance.',
    preview: null, tags: ['AI', 'agent', 'MCP', 'bot', 'skill', extname(path).slice(1)] });
  await addFile(resource, path, basename(path));
}
const order = ['logos', 'icons', 'images', 'fonts', 'videos', 'documents', 'templates', 'qr', 'ai'];
resources.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || Number(a.status==='legacy') - Number(b.status==='legacy') || Number(!!b.recommended) - Number(!!a.recommended) || a.name.localeCompare(b.name));
const resourceIndex = { version: 2, brand: brand.name, resources: resources.map(({ id, name, category, description, preview, status, recommended, files }) => ({ id, name, category, description, preview, ...(status ? { status, recommended } : {}), files: files.map(({ path, format, label }) => ({ path, format, label })) })) };
await writeFile('assets/ai/resource-index.json', JSON.stringify(resourceIndex, null, 2) + '\n');
const indexResource = resources.find(resource => resource.files.some(file => file.path === 'assets/ai/resource-index.json'));
indexResource.files = [await fileRecord('assets/ai/resource-index.json', 'resource-index.json')];
const bundles = [];
await mkdir('assets/downloads', { recursive: true });
for (const category of order) {
  const paths = [...new Set(resources.filter(item => item.category === category).flatMap(item => item.files.map(file => file.path)))];
  if (category === 'templates') paths.push('assets/fonts/LICENSE.txt', 'assets/fonts/InterVariable.ttf');
  if (category === 'templates') paths.push('assets/templates/README.md', 'assets/templates/templates.json');
  if (category === 'fonts') paths.push('assets/fonts/LICENSE.txt');
  if (category === 'qr') paths.push('assets/qr/README.md', 'assets/qr/qr-codes.json', 'assets/qr/QR-VALIDATION.json');
  if (category === 'ai') paths.push('assets/brand.json', 'assets/brand-spec.json', 'llms.txt', 'llms-full.txt', 'AGENTS.md');
  const contents = await Promise.all([...new Set(paths)].map(async path => ({ name: path, data: await readFile(path) })));
  const bytes = zip(contents), path = `assets/downloads/${category}.zip`;
  if (bytes.length > 95_000_000) throw new Error(`Split oversized ${category} bundle before publishing.`);
  await writeFile(path, bytes);
  bundles.push({ category, path, label: `Download ${category} ZIP`, bytes: bytes.length, file_count: contents.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const archivePaths = resources.filter(resource=>resource.status==='legacy').flatMap(resource=>resource.files.map(file=>file.path));
const archiveContents = await Promise.all([...new Set(archivePaths)].map(async path=>({name:path,data:await readFile(path)})));
const archiveBytes=zip(archiveContents),archivePath='assets/downloads/legacy.zip';
await writeFile(archivePath,archiveBytes);
bundles.push({category:'legacy',path:archivePath,label:'Download legacy archive ZIP',bytes:archiveBytes.length,file_count:archiveContents.length,sha256:createHash('sha256').update(archiveBytes).digest('hex')});
const catalog = { version: 2, brand: brand.name, generated_from: 'scripts/generate-catalog.mjs', resources, bundles,
  total_files: resources.reduce((sum, item) => sum + item.files.length, 0), contact: brand };
await writeFile('assets/catalog.json', JSON.stringify(catalog, null, 2) + '\n');
console.log(`Catalog: ${resources.length} resource groups / ${catalog.total_files} downloadable files / ${bundles.length} category bundles.`);
