import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export const root = resolve(import.meta.dirname, '..');
export const entries = [
  'index.html', 'assets.html', '.nojekyll', 'README.md',
  'AGENTS.md', 'llms.txt', 'llms-full.txt', 'robots.txt', 'sitemap.xml',
  'assets', 'docs',
];

export async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not a static asset: ${entry.name}`);
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  // This fixed destination is deliberately separate from all source folders.
  const output = join(root, '_site');
  await rm(output, { recursive: true, force: true });
  await mkdir(output);
  for (const entry of entries) await cp(join(root, entry), join(output, entry), { recursive: true });
  console.log(`Packaged ${(await walk(output)).length} public files into _site/.`);
}
