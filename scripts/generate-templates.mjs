import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

// All artwork is generated as live SVG text and embedded vector logo paths.
// SVG and HTML sources are self-contained. The installed browser supplies raster/PDF exports.
const root = resolve(import.meta.dirname, '..');
const output = join(root, 'assets/templates');
await mkdir(output, { recursive: true });
// Maintain current company and leadership facts in one place; artwork stays in the logo library.
const brand = JSON.parse(await readFile(join(root, 'assets/brand.json'), 'utf8'));
const colors = { ...brand.palette, slate: '#475569', surface: '#F8FAFC', white: '#FFFFFF' };
const company = {
  name: brand.name, tagline: brand.tagline,
  email: brand.email, website: brand.website,
  phone1: brand.phones[0]?.display, phone2: brand.phones[1]?.display,
  address: brand.address.display,
};
const people = brand.leadership.map(person => ({
  // Existing email-based IDs keep the current filenames stable. An explicit id can override them.
  id: (person.id || person.email.split('@')[0]).toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
  name: person.name, role: person.title, email: person.email, phone: person.phone,
}));
const websiteLabel = new URL(company.website).hostname.replace(/^www\./, '');
for (const [field, value] of Object.entries(company)) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing assets/brand.json template field: ${field}`);
}
for (const person of people) {
  for (const [field, value] of Object.entries(person)) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing assets/brand.json leadership field: ${field}`);
  }
}
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const embeddedInter = (await readFile(join(root, 'assets/fonts/InterVariable.woff2'))).toString('base64');
const interLicense = await readFile(join(root, 'assets/fonts/LICENSE.txt'), 'utf8');
async function firstFile(paths) {
  for (const path of paths) { try { return await readFile(join(root, path)); } catch {} }
  throw new Error(`Missing template source asset: ${paths.join(', ')}`);
}
const logoCache = new Map();
async function loadLogo(layout, theme) {
  const key = `${layout}-${theme}`;
  if (!logoCache.has(key)) {
    logoCache.set(key, (await firstFile([
      `assets/logos/svg/${layout}/andhub-${layout}-gradient-${theme}.svg`,
      `01-svg/${layout}/andhub-${layout}-gradient-${theme}.svg`,
    ])).toString('utf8'));
  }
  return logoCache.get(key);
}
let logoNumber = 0;
async function logo(x, y, width, height, layout = 'horizontal', theme = 'light', opacity = 1) {
  const raw = await loadLogo(layout, theme);
  const viewBox = raw.match(/viewBox="([^"]+)"/)[1];
  const prefix = `template-${++logoNumber}-`;
  const body = raw.slice(raw.indexOf('>') + 1).replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    .replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`)
    .replace(/aria-labelledby="[^"]+"/g, '');
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" opacity="${opacity}" aria-hidden="true">${body}</svg>`;
}
function rect(x, y, width, height, fill, extra = '') { return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" ${extra}/>`; }
function line(x1, y1, x2, y2, color = colors.cloud, width = 1) { return `<path d="M${x1} ${y1}H${x2}" transform="translate(0 ${y2-y1})" stroke="${color}" stroke-width="${width}"/>`; }
function text(value, x, y, size = 16, fill = colors.navy, weight = 400, extra = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" ${extra}>${xml(value)}</text>`;
}
function lines(values, x, y, size = 16, leading = 24, fill = colors.navy, weight = 400, extra = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" ${extra}>${values.map((value, index) => `<tspan x="${x}" dy="${index ? leading : 0}">${xml(value)}</tspan>`).join('')}</text>`;
}
function label(value, x, y, fill = colors.slate, size = 10) { return text(value.toUpperCase(), x, y, size, fill, 700, 'letter-spacing="1.7"'); }
function artwork(width, height, body, title) {
  const id = `art-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}"><title id="${id}">${xml(title)}</title><metadata>${xml(interLicense)}</metadata><style>@font-face{font-family:AndHubInter;src:url(data:font/woff2;base64,${embeddedInter}) format('woff2');font-weight:100 900;font-style:normal}text{font-family:AndHubInter,Arial,Helvetica,sans-serif}a{text-decoration:none}</style>${body}</svg>`;
}
const templates = [];
async function makeRecord({ id, name, description, width, height, mmWidth, mmHeight, sheets, tags, extras = [] }) {
  const names = [];
  for (let i = 0; i < sheets.length; i++) {
    const suffix = sheets.length > 1 ? `-${i + 1}` : '';
    const base = `${id}${suffix}`;
    await writeFile(join(output, `${base}.svg`), sheets[i] + '\n');
    names.push(base);
  }
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${xml(name)} — AndHub Templates</title>
<style>*{box-sizing:border-box}body{margin:0;background:#E5E7EB;color:#0B1F3B;font:14px/1.5 Arial,sans-serif}.toolbar{max-width:1120px;margin:auto;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.toolbar a{color:#0B1F3B;text-underline-offset:3px}.toolbar h1{font-size:16px;margin:0}.toolbar button{font:inherit;padding:10px 16px;min-height:44px;border:1px solid #0B1F3B;border-radius:4px;background:#0B1F3B;color:white;cursor:pointer}a:focus-visible,button:focus-visible{outline:3px solid #2563EB;outline-offset:4px}.sheet{width:${mmWidth}mm;max-width:calc(100vw - 32px);margin:0 auto 28px;box-shadow:0 3px 20px #0B1F3B18;background:white}.sheet>svg{display:block;width:100%;height:auto}.instructions{max-width:760px;margin:24px auto;padding:0 24px 24px;color:#475569}.instructions p{margin:0 0 8px}@page{size:${mmWidth}mm ${mmHeight}mm;margin:0}@media print{body{background:white}.toolbar,.instructions{display:none}.sheet{width:${mmWidth}mm;height:${mmHeight}mm;max-width:none;margin:0;box-shadow:none;break-after:page;overflow:hidden}.sheet:last-of-type{break-after:auto}.sheet>svg{width:100%;height:100%}}
</style></head><body><nav class="toolbar" aria-label="Template actions"><a href="../../index.html">← Back to home</a><h1>${xml(name)}</h1><button type="button" onclick="window.print()">Print / Save as PDF</button></nav>
<main>${sheets.map(sheet => `<section class="sheet">${sheet}</section>`).join('\n')}</main><aside class="instructions"><p>${xml(description)}</p><p>Editable SVG artwork is supplied alongside this self-contained HTML. Replace bracketed placeholders before use. Print at 100% scale with background graphics enabled. These RGB templates use the stated trim size; agree bleed, color conversion and proofs with your printer.</p>${id === 'brochure' ? '<p>Tri-fold brochure: outside panels are flap / back / front, left to right. Inside panels run left to right. Fold a paper proof before a production run.</p>' : ''}<p><a href="../../assets.html">Return to the asset library</a></p></aside></body></html>\n`;
  await writeFile(join(output, `${id}.html`), html);
  templates.push({ id, name, category: 'templates', description, preview: `assets/templates/${names[id.startsWith('business-card') ? 1 : 0]}.png`, files: [
    { path: `assets/templates/${id}.html`, format: 'html', label: 'Offline editable layout / print' },
    { path: `assets/templates/${id}.pdf`, format: 'pdf', label: sheets.length > 1 ? `${sheets.length}-page print PDF` : 'Print PDF' },
    ...names.flatMap((base, index) => [
      { path: `assets/templates/${base}.svg`, format: 'svg', label: `Editable SVG${names.length > 1 ? ` / side ${index + 1}` : ''}` },
      { path: `assets/templates/${base}.png`, format: 'png', label: `PNG${names.length > 1 ? ` / side ${index + 1}` : ''}` },
      { path: `assets/templates/${base}.jpg`, format: 'jpg', label: `JPG${names.length > 1 ? ` / side ${index + 1}` : ''}` },
    ]), ...extras,
  ], tags, dimensions: { width, height, mmWidth, mmHeight }, render: { html, names, width, height } });
}

// Stationery: a reusable header and footer, then the complete A4 letterhead.
const header = await logo(48, 22, 280, 86) + label(company.tagline, 744, 64, colors.slate, 10).replace('x="744"', 'x="744" text-anchor="end"') + rect(48, 123, 698, 2, colors.cloud) + rect(48, 123, 72, 2, colors.green);
const footer = rect(48, 0, 698, 1, colors.cloud) + rect(48, 0, 72, 2, colors.blue) + text(company.name, 48, 31, 12, colors.navy, 700) + text(company.address, 48, 53, 11, colors.slate) + text(`${company.phone1}  /  ${company.phone2}`, 48, 74, 11, colors.slate) + text(company.email, 746, 31, 11, colors.navy, 400, 'text-anchor="end"') + text(websiteLabel, 746, 53, 11, colors.navy, 400, 'text-anchor="end"') + label(company.tagline, 746, 84, colors.slate, 9).replace('x="746"', 'x="746" text-anchor="end"');
await writeFile(join(output, 'letterhead-header.svg'), artwork(794, 140, rect(0, 0, 794, 140, colors.white) + header, 'AndHub letterhead header'));
await writeFile(join(output, 'letterhead-footer.svg'), artwork(794, 110, rect(0, 0, 794, 110, colors.white) + footer, 'AndHub letterhead footer'));
const letterBody = rect(0, 0, 794, 1123, colors.white) + header + label('[DATE]', 62, 195) + lines(['[Recipient name]', '[Organization]', '[Address]'], 62, 244, 14, 24, colors.slate) + text('Subject: [Letter subject]', 62, 360, 20, colors.navy, 700) + text('Dear [Recipient name],', 62, 418, 15) + lines(['[Write your opening paragraph here. State the purpose of the letter', 'and the next step clearly.]'], 62, 466, 15, 25, colors.slate) + lines(['[Add the relevant details, references and supporting information.', 'Keep the message concise and use the approved company name.]'], 62, 553, 15, 25, colors.slate) + lines(['[Close with the action, response or follow-up you need.]'], 62, 665, 15, 25, colors.slate) + text('Kind regards,', 62, 760, 15) + text('[Name]', 62, 814, 16, colors.navy, 700) + text(`[Title] · ${company.name}`, 62, 839, 13, colors.slate) + `<g transform="translate(0 1003)">${footer}</g>`;
await makeRecord({ id: 'letterhead', name: 'Letterhead / header & footer', description: 'A4 correspondence template with reusable header and footer artwork, verified company contacts, and editable letter placeholders.', width: 794, height: 1123, mmWidth: 210, mmHeight: 297, sheets: [artwork(794, 1123, letterBody, 'AndHub A4 letterhead')], tags: ['stationery', 'letter', 'header', 'footer', 'A4'], extras: [
  { path: 'assets/templates/letterhead-header.svg', format: 'svg', label: 'Reusable header strip' },
  { path: 'assets/templates/letterhead-footer.svg', format: 'svg', label: 'Reusable footer strip' },
] });

// Brochure: two landscape A4 sides, with comfortable 19 px body type.
const W = 1123, H = 794, P = W / 3;
let outside = rect(0, 0, W, H, colors.white) + rect(P, 0, P, H, colors.surface) + rect(P * 2, 0, P, H, colors.navy);
outside += label('A TRUSTED PARTNER', 36, 62, colors.blue) + lines(['Technology,', 'shaped around', 'your vision.'], 36, 138, 36, 43, colors.navy, 700);
outside += lines(['We aim to be a trusted partner that', 'understands your vision, helps shape', 'your ideas, and brings your plans to life.'], 36, 308, 17, 29, colors.slate);
outside += lines(['Backed by experienced leadership in', 'software and systems engineering,', 'we bring clear thinking and practical', 'engineering to the work that matters.'], 36, 447, 17, 29, colors.slate);
outside += label('DIFFERENT CHALLENGES.', 36, 675, colors.navy, 10) + label('INFINITE POSSIBILITIES.', 36, 697, colors.navy, 10) + label('ONE HUB.', 36, 719, colors.blue, 10);
outside += await logo(P + 36, 42, P - 72, 95, 'horizontal', 'light');
outside += lines(['Let’s turn your', 'ideas into action.'], P + 36, 226, 32, 40, colors.navy, 700);
outside += text(company.address, P + 36, 365, 17, colors.slate) + text(company.phone1, P + 36, 421, 20, colors.navy, 600) + text(company.phone2, P + 36, 453, 20, colors.navy, 600) + text(company.email, P + 36, 520, 17, colors.navy) + text(websiteLabel, P + 36, 555, 20, colors.blue, 600);
outside += label('SOFTWARE / SYSTEMS / CONSULTANCY', P + 36, 724, colors.slate, 8.5);
outside += await logo(P * 2 + 32, 43, P - 64, 95, 'horizontal', 'dark');
outside += label(company.name, P * 2 + 36, 250, colors.cloud, 10);
outside += lines(['Ideas.', 'Engineered.'], P * 2 + 36, 344, 55, 68, colors.white, 700);
outside += rect(P * 2 + 36, 459, 64, 4, colors.green);
outside += lines(['We turn ideas into solutions', 'that make a difference.'], P * 2 + 36, 524, 20, 31, colors.white);
outside += lines(['Software development.', 'Systems engineering.', 'Consultancy.'], P * 2 + 36, 670, 15, 25, colors.cloud);
let inside = rect(0, 0, W, H, colors.white) + rect(P, 0, P, H, colors.surface) + rect(0, 0, W, 8, colors.blue);
const panels = [
  { title: ['Software', 'development.'], number: '01', lead: ['Digital experiences that', 'serve your business.'], body: ['From websites and custom software', 'to digital products, we help turn', 'requirements into useful technology.', '', 'We work with businesses of all sizes', 'to design, build and improve the', 'software they depend on.'], details: ['Websites & digital products', 'Custom business software', 'Application improvement'] },
  { title: ['Systems', 'engineering.'], number: '02', lead: ['Bring the pieces', 'together.'], body: ['From connected technology to', 'large-scale business systems, we', 'help make complex needs clearer.', '', 'Our software developers and systems', 'engineers work together to simplify', 'operations and create lasting value.'], details: ['Business systems', 'Systems design & integration', 'Technology improvement'] },
  { title: ['Expert', 'consultancy.'], number: '03', lead: ['Shape the next step', 'with clear advice.'], body: ['We help you understand your', 'challenges, shape your ideas and', 'plan a practical way forward.', '', 'Experienced leadership in software', 'and systems engineering supports', 'thoughtful technical decisions.'], details: ['Technical advice', 'Requirements & planning', 'Software & systems guidance'] },
];
for (let i = 0; i < panels.length; i++) {
  const x = P * i + 36, panel = panels[i];
  inside += label(`${panel.number} / OUR SERVICES`, x, 69, colors.blue) + lines(panel.title, x, 143, 35, 42, colors.navy, 700) + rect(x, 223, 54, 3, colors.green) + lines(panel.lead, x, 280, 23, 31, colors.navy, 600) + lines(panel.body, x, 383, 17, 27, colors.slate) + line(x, 625, x + P - 72, 625, colors.cloud) + lines(panel.details, x, 664, 15, 29, colors.navy, 600);
}
await makeRecord({ id: 'brochure', name: 'Company brochure / tri-fold', description: 'Two-sided A4 landscape tri-fold brochure covering the company introduction, services, positioning and contact details.', width: W, height: H, mmWidth: 297, mmHeight: 210, sheets: [artwork(W, H, outside, 'AndHub brochure / outside: flap, back, front'), artwork(W, H, inside, 'AndHub brochure / inside service panels')], tags: ['brochure', 'company', 'services', 'tri-fold', 'A4'] });

// Founder cards: 85 × 55 mm trim, exported at approximately 300 dpi.
for (const person of people) {
  const width = 1004, height = 650;
  const front = rect(0, 0, width, height, colors.navy) + await logo(145, 126, 714, 225, 'horizontal', 'dark') + rect(450, 403, 104, 5, colors.green) + text(company.tagline.toUpperCase(), 502, 478, 24, colors.cloud, 500, 'text-anchor="middle" letter-spacing="6"') + text(websiteLabel, 502, 575, 24, colors.cloud, 400, 'text-anchor="middle"');
  const back = rect(0, 0, width, height, colors.white) + rect(0, 0, 17, height, colors.blue) + await logo(74, 48, 450, 139, 'horizontal', 'light') + text(person.name, 82, 300, 45, colors.navy, 700) + text(person.role, 84, 352, 28, colors.slate) + rect(84, 390, 72, 4, colors.green) + text(person.email, 84, 454, 29, colors.navy) + text(person.phone, 84, 503, 29, colors.navy) + text(company.address, 84, 578, 24, colors.slate);
  await makeRecord({ id: `business-card-${person.id}`, name: `Business card / ${person.name}`, description: `Double-sided 85 × 55 mm business card with the AndHub brand face and ${person.name}’s supplied role and contact details.`, width, height, mmWidth: 85, mmHeight: 55, sheets: [artwork(width, height, front, `${person.name} / business card front`), artwork(width, height, back, `${person.name} / business card back`)], tags: ['business card', 'stationery', person.id, person.role] });
}

// Digital banner and social post: editable, restrained geometric layouts.
const bannerBody = rect(0, 0, 1920, 640, colors.navy) + rect(1340, 0, 580, 640, '#102B4B') + await logo(72, 40, 470, 145, 'horizontal', 'dark') + await logo(1380, 64, 490, 490, 'symbol', 'dark') + label('SOFTWARE / SYSTEMS / CONSULTANCY', 92, 237, colors.cloud, 18) + lines(['Ideas into solutions.', 'Possibilities into progress.'], 88, 330, 69, 83, colors.white, 700) + rect(92, 463, 84, 5, colors.green) + text('Different Challenges. Infinite Possibilities. One Hub.', 92, 521, 24, colors.cloud) + text(websiteLabel, 92, 584, 23, colors.white, 600);
await makeRecord({ id: 'web-banner', name: 'Website banner / 1920 × 640', description: 'Wide digital banner with a clear service statement, approved company website, and editable headline.', width: 1920, height: 640, mmWidth: 508, mmHeight: 169.333, sheets: [artwork(1920, 640, bannerBody, 'AndHub website banner')], tags: ['banner', 'website', 'digital', '1920x640'] });

const social = rect(0, 0, 1080, 1080, colors.navy) + rect(0, 1058, 1080, 22, colors.green) + await logo(60, 48, 500, 155, 'horizontal', 'dark') + label(company.tagline, 80, 286, colors.cloud, 19) + lines(['Different', 'Challenges.', 'Infinite', 'Possibilities.'], 72, 386, 90, 105, colors.white, 700) + text('One Hub.', 76, 848, 89, colors.green, 700) + text('Software development · Systems engineering · Consultancy', 80, 950, 24, colors.cloud) + text(websiteLabel, 80, 1013, 28, colors.white, 600);
await makeRecord({ id: 'social-square', name: 'Social post / 1080 × 1080', description: 'Square brand announcement template with the supplied “Different Challenges. Infinite Possibilities. One Hub.” message.', width: 1080, height: 1080, mmWidth: 285.75, mmHeight: 285.75, sheets: [artwork(1080, 1080, social, 'AndHub square social post')], tags: ['social', 'post', 'square', '1080x1080'] });

const cover = rect(0, 0, 794, 1123, colors.navy) + rect(0, 0, 12, 1123, colors.blue) + await logo(50, 42, 350, 108, 'horizontal', 'dark') + label('PROPOSAL / TECHNICAL DOCUMENT', 66, 272, colors.cloud, 11) + lines(['Engineering', 'what comes', 'next.'], 60, 367, 67, 79, colors.white, 700) + rect(66, 605, 72, 4, colors.green) + text('[Project title]', 66, 691, 28, colors.white, 600) + text('[Client / organization]', 66, 733, 17, colors.cloud) + label('PREPARED BY', 66, 852, colors.cloud) + text('[Name and title]', 66, 883, 17, colors.white) + label('DATE / VERSION', 440, 852, colors.cloud) + text('[Date] / [Version]', 440, 883, 17, colors.white) + line(66, 988, 728, 988, '#39516E') + text(company.name, 66, 1026, 14, colors.white, 600) + text(company.email, 66, 1055, 13, colors.cloud) + text(company.tagline, 728, 1026, 13, colors.cloud, 400, 'text-anchor="end"') + text(websiteLabel, 728, 1055, 13, colors.cloud, 400, 'text-anchor="end"');
await makeRecord({ id: 'proposal-cover', name: 'Proposal & report cover', description: 'A4 proposal or technical report cover with editable project, client, author, date and version fields.', width: 794, height: 1123, mmWidth: 210, mmHeight: 297, sheets: [artwork(794, 1123, cover, 'AndHub proposal and report cover')], tags: ['proposal', 'report', 'cover', 'A4'] });

// Signature layouts use live HTML links and an embedded PNG logo for easy reuse.
const emailLogo = await firstFile(['assets/logos/png/512px/compact/andhub-compact-gradient-light-512px.png', '02-png-transparent/512px/compact/andhub-compact-gradient-light-512px.png']);
for (const person of people) {
  const id = `email-signature-${person.id}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${xml(person.name)} — AndHub email signature</title><style>*{box-sizing:border-box}body{margin:0;color:#0B1F3B;background:#F8FAFC;font:14px/1.5 Arial,sans-serif}.toolbar{padding:20px 24px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;border-bottom:1px solid #E5E7EB}.toolbar a{color:#0B1F3B}.toolbar button{padding:10px 16px;border:1px solid #0B1F3B;background:white;color:#0B1F3B;border-radius:4px;font:inherit;cursor:pointer}.instructions{max-width:680px;padding:24px;color:#475569}.signature-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain}#signature{background:white;width:720px;padding:36px}a:focus-visible,button:focus-visible{outline:3px solid #2563EB;outline-offset:4px}.signature-scroll:focus-visible{outline:3px solid #2563EB;outline-offset:-3px}@page{size:190.5mm 82mm;margin:0}@media print{.toolbar,.instructions{display:none}body{background:white}.signature-scroll{overflow:visible}#signature{width:190.5mm;max-width:none}}</style></head><body><nav class="toolbar" aria-label="Template actions"><a href="../../index.html">← Back to home</a><a href="../../assets.html">Asset library</a><button type="button" onclick="window.print()">Print / Save as PDF</button></nav><main><div class="signature-scroll" role="region" aria-label="Email signature preview; scroll horizontally on narrow screens" tabindex="0"><div id="signature"><table role="presentation" style="border-collapse:collapse;font-family:Arial,sans-serif;color:#0B1F3B"><tr><td style="vertical-align:top;padding:6px 28px 0 0;border-right:2px solid #10B981"><img src="data:image/png;base64,${emailLogo.toString('base64')}" alt="${xml(company.name)}" width="180" style="display:block;width:180px;height:auto"><p style="font-size:10px;letter-spacing:1.5px;margin:16px 0 0;color:#475569">${xml(company.tagline.toUpperCase())}</p></td><td style="vertical-align:top;padding:0 0 0 28px"><p style="margin:0;font-size:20px;font-weight:700">${xml(person.name)}</p><p style="margin:3px 0 15px;font-size:13px;color:#475569">${xml(person.role)}</p><p style="margin:0 0 6px;font-size:13px;font-weight:700">${xml(company.name)}</p><p style="margin:0 0 5px;font-size:13px"><a href="mailto:${person.email}" style="color:#0B1F3B;text-decoration:none">${person.email}</a></p><p style="margin:0 0 5px;font-size:13px"><a href="tel:${person.phone}" style="color:#0B1F3B;text-decoration:none">${person.phone}</a></p><p style="margin:0 0 5px;font-size:13px"><a href="${company.website}" style="color:#2563EB;text-decoration:none">${xml(websiteLabel)}</a></p><p style="margin:0;font-size:12px;color:#475569">${xml(company.address)}</p></td></tr></table></div></div><aside class="instructions"><p>On narrow screens, scroll the signature preview horizontally. Select and copy the signature block above into your email client. To edit the content, open this HTML file in a text editor. Contact text remains selectable.</p><p>The logo is embedded for offline use. If your email client strips embedded images, host the PNG logo at your approved public asset URL and replace the image source. Test the signature in your actual email client before rollout.</p></aside></main></body></html>\n`;
  await writeFile(join(output, `${id}.html`), html);
  templates.push({ id, name: `Email signature / ${person.name}`, category: 'templates', description: `Live HTML email signature for ${person.name}, with selectable contact links and an embedded AndHub logo.`, preview: `assets/templates/${id}.png`, files: [
    { path: `assets/templates/${id}.html`, format: 'html', label: 'Editable HTML signature' },
    { path: `assets/templates/${id}.png`, format: 'png', label: 'PNG preview' },
    { path: `assets/templates/${id}.jpg`, format: 'jpg', label: 'JPG preview' },
    { path: `assets/templates/${id}.pdf`, format: 'pdf', label: 'Reference PDF' },
  ], tags: ['email', 'signature', person.id, person.role], dimensions: { width: 720, height: 310 }, render: { html, width: 720, height: 310, signature: true } });
}

async function installedBrowser() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) return process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const directory = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData/Local'), 'ms-playwright');
  try {
    const versions = (await readdir(directory)).filter(name => /^chromium_headless_shell-\d+$/.test(name)).sort((a, b) => Number(b.split('-').at(-1)) - Number(a.split('-').at(-1)));
    for (const version of versions) {
      const path = join(directory, version, 'chrome-headless-shell-win64/chrome-headless-shell.exe');
      try { await access(path); return path; } catch {}
    }
  } catch {}
  return undefined;
}
let playwright;
try { playwright = await import('playwright'); } catch {
  const directory = process.env.PLAYWRIGHT_MODULE || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  playwright = await import(pathToFileURL(directory).href);
}
const browser = await playwright.chromium.launch({ headless: true, executablePath: await installedBrowser() });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  for (const template of templates) {
    await page.setContent(template.render.html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    if (template.render.signature) {
      const block = page.locator('#signature');
      await block.screenshot({ path: join(output, `${template.id}.png`), type: 'png' });
      await block.screenshot({ path: join(output, `${template.id}.jpg`), type: 'jpeg', quality: 95 });
    } else {
      for (let i = 0; i < template.render.names.length; i++) {
        const name = template.render.names[i];
        await page.setViewportSize({ width: Math.max(template.render.width, 1200), height: Math.max(template.render.height, 900) });
        // Remove the responsive millimeter sizing for exact digital raster dimensions.
        await page.locator('.sheet').nth(i).evaluate((element, { width, height }) => { element.style.width = `${width}px`; element.style.height = `${height}px`; element.style.maxWidth = 'none'; element.style.margin = '0'; }, template.render);
        const art = page.locator('.sheet').nth(i);
        await art.screenshot({ path: join(output, `${name}.png`), type: 'png' });
        await art.screenshot({ path: join(output, `${name}.jpg`), type: 'jpeg', quality: 95 });
      }
    }
    // Reload so exact-pixel screenshot styles cannot affect the print dimensions.
    await page.setContent(template.render.html, { waitUntil: 'load' });
    await page.pdf({ path: join(output, `${template.id}.pdf`), preferCSSPageSize: true, printBackground: true, tagged: true });
    console.log(`Generated ${template.id}`);
  }
} finally { await browser.close(); }

// Native editable Word stationery, with actual header/footer parts rather than a full-page image.
// A small uncompressed ZIP writer keeps generation dependency-free.
function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function zipFiles(files) {
  const chunks = [], central = [];
  let offset = 0;
  for (const [path, source] of Object.entries(files)) {
    const name = Buffer.from(path), bytes = Buffer.isBuffer(source) ? source : Buffer.from(source);
    const crc = crc32(bytes), local = Buffer.alloc(30), entry = Buffer.alloc(46);
    local.writeUInt32LE(0x04034B50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26);
    entry.writeUInt32LE(0x02014B50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x0800, 8); entry.writeUInt16LE(33, 14);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(bytes.length, 20); entry.writeUInt32LE(bytes.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    chunks.push(local, name, bytes); central.push(entry, name); offset += local.length + name.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22), count = Object.keys(files).length;
  end.writeUInt32LE(0x06054B50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}
const wordNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const relNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
const officeRelNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const wordP = (value, bold = false) => `<w:p><w:pPr><w:spacing w:after="200" w:line="300" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:color w:val="0B1F3B"/></w:rPr><w:t xml:space="preserve">${xml(value)}</w:t></w:r></w:p>`;
const wordLogo = await firstFile(['assets/logos/png/1024px/horizontal/andhub-horizontal-gradient-light-1024px.png', '02-png-transparent/1024px/horizontal/andhub-horizontal-gradient-light-1024px.png']);
const wordHeader = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="${wordNs}" xmlns:r="${officeRelNs}"><w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="8" w:color="E5E7EB"/></w:pBdr></w:pPr><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="2743200" cy="845967"/><wp:docPr id="1" name="AndHub logo" descr="${xml(company.name)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="andhub-logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2743200" cy="845967"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:hdr>`;
const wordFooter = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="${wordNs}"><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="6" w:space="8" w:color="E5E7EB"/></w:pBdr><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0B1F3B"/><w:sz w:val="18"/></w:rPr><w:t>${xml(company.name)} — ${xml(company.tagline)}</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:color w:val="475569"/><w:sz w:val="16"/></w:rPr><w:t>${xml(company.address)}  |  ${company.phone1} / ${company.phone2}</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:color w:val="475569"/><w:sz w:val="16"/></w:rPr><w:t>${xml(company.email)}  |  ${xml(websiteLabel)}</w:t></w:r></w:p></w:ftr>`;
const wordBody = ['[Date]', '[Recipient name]', '[Organization]', '[Address]', '', 'Subject: [Letter subject]', '', 'Dear [Recipient name],', '[Write your opening paragraph here. State the purpose of the letter and the next step clearly.]', '[Add the relevant details, references and supporting information. Keep the message concise and use the approved company name.]', '[Close with the action, response or follow-up you need.]', '', 'Kind regards,', '[Name]', `[Title] · ${company.name}`].map(value => wordP(value, value.startsWith('Subject:') || value === '[Name]')).join('');
await writeFile(join(output, 'letterhead.docx'), zipFiles({
  '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`,
  '_rels/.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="${officeRelNs}/officeDocument" Target="word/document.xml"/></Relationships>`,
  'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${wordNs}" xmlns:r="${officeRelNs}"><w:body>${wordBody}<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2100" w:right="1134" w:bottom="1600" w:left="1134" w:header="450" w:footer="600"/></w:sectPr></w:body></w:document>`,
  'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${relNs}"><Relationship Id="rIdHeader" Type="${officeRelNs}/header" Target="header1.xml"/><Relationship Id="rIdFooter" Type="${officeRelNs}/footer" Target="footer1.xml"/><Relationship Id="rIdStyles" Type="${officeRelNs}/styles" Target="styles.xml"/></Relationships>`,
  'word/styles.xml': `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${wordNs}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`,
  'word/header1.xml': wordHeader,
  'word/_rels/header1.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${relNs}"><Relationship Id="rIdLogo" Type="${officeRelNs}/image" Target="media/logo.png"/></Relationships>`,
  'word/footer1.xml': wordFooter,
  'word/media/logo.png': wordLogo,
}));
templates.find(template => template.id === 'letterhead').files.unshift({ path: 'assets/templates/letterhead.docx', format: 'docx', label: 'Editable Word letter / native header & footer' });
await writeFile(join(output, 'templates.json'), JSON.stringify(templates.map(({ render, ...template }) => template), null, 2) + '\n');
await writeFile(join(output, 'README.md'), `# AndHub downloadable templates

All templates use the supplied company and founder details. The SVG and HTML files are editable and self-contained, with embedded logo artwork. The letterhead includes an editable Word DOCX with native header/footer parts and live body text. PNG/JPG files are exports for placement and preview. PDF files are ready to review or print at the stated trim size.

| Template | Size | Pages / sides |
|---|---|---|
| Letterhead | A4 / 210 × 297 mm | 1; reusable header/footer SVG strips included |
| Company brochure | A4 landscape / 297 × 210 mm | 2; tri-fold outside and inside |
| Founder business cards | 85 × 55 mm | 2 each; brand front and contact back |
| Website banner | 1920 × 640 px | 1 |
| Social square | 1080 × 1080 px | 1 |
| Proposal / report cover | A4 / 210 × 297 mm | 1 |
| Founder email signatures | HTML | 1 each; selectable contact links |

Open a template HTML file to preview it and use **Print / Save as PDF**. Replace bracketed placeholders before publication. Edit SVG text and layout in a vector editor, or update the generator. Keep the logo paths intact and preserve its aspect ratio. The brochure outside is arranged flap / back / front from left to right; the inside is arranged left to right. Fold a paper proof first.

SVG artwork embeds the brand's recommended Inter variable font and its SIL Open Font License notice for portable editing and display. The native Word letterhead and email signatures use Arial for office and email compatibility. Templates are RGB, at trim size, without bleed or printer marks. Agree bleed, process-specific color conversion, minimum type sizes and a physical proof with your printer. For business cards, print at 100% scale with automatic scaling disabled. The letterhead header/footer and business card PNG/JPG exports retain the same trim proportions as the source.

For email, copy the live HTML signature block rather than pasting the preview image. If your email client removes embedded logo images, replace the image source with your approved hosted PNG URL. Test in the target client.

Regenerate with \`node scripts/generate-templates.mjs\`. The script uses Playwright and a local installed Chromium browser; set \`PLAYWRIGHT_MODULE\` (module file path) and \`PLAYWRIGHT_EXECUTABLE_PATH\` if the runtime is not discoverable. Font source and license are retained in the separate font library.

[Back to home](../../index.html) · [Asset library](../../assets.html)
`);
console.log(`Created ${templates.length} downloadable template families in assets/templates/.`);
