import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Rebuild deterministic, self-contained QR artwork with the locally vendored encoder.
// Use --verify with an installed jsQR module to decode every raster export.
const root = resolve(import.meta.dirname, '..');
const output = join(root, 'assets/qr');
const brand = JSON.parse(await readFile(join(root, 'assets/brand.json'), 'utf8'));
const encoderPath = join(root, 'assets/vendor/qrcode.js');
const encoderContext = { module: { exports: {} }, exports: {} };
vm.runInNewContext(await readFile(encoderPath, 'utf8'), encoderContext);
const qrcode = encoderContext.module.exports;
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch {
  const runtimeSharp = process.env.ANDHUB_SHARP_MODULE;
  if (!runtimeSharp) throw new Error('Set ANDHUB_SHARP_MODULE to an installed sharp module path, or install sharp in your build environment. The website does not need sharp at runtime.');
  sharp = (await import(pathToFileURL(runtimeSharp).href)).default;
}

const candidateLogos = [
  'assets/logos/svg/symbol/andhub-symbol-mono-navy.svg',
  '01-svg/symbol/andhub-symbol-mono-navy.svg',
];
let logo;
for (const path of candidateLogos) {
  try { await access(join(root, path)); logo = await readFile(join(root, path), 'utf8'); break; } catch {}
}
if (!logo) throw new Error('The AndHub symbol master could not be found.');
const logoInner = logo.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<(?:title|desc)[\s\S]*?<\/(?:title|desc)>/g, '').replace(/\sid="[^"]*"/g, '');
const escapeXml = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

function vcard(fields) {
  const escape = value => value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0', `N:${fields.family ? `${escape(fields.family)};${escape(fields.given)};;${escape(fields.prefix || '')};` : `${escape(brand.name)};;;;`}`,
    `FN:${escape(fields.name)}`, `ORG:${escape(brand.name)}`,
    ...(fields.title ? [`TITLE:${escape(fields.title)}`] : []),
    ...fields.phones.map(phone => `TEL;TYPE=WORK,VOICE:${phone}`),
    `EMAIL;TYPE=WORK:${fields.email}`, `ADR;TYPE=WORK:;;${escape(brand.address.street)};${escape(brand.address.city)};;;${escape(brand.address.country)}`,
    `URL:${brand.website}`, 'END:VCARD',
  ];
  // RFC vCard physical lines use CRLF and fold after at most 75 UTF-8 octets.
  return lines.map(line => {
    const folded = [];
    let current = '';
    for (const character of line) {
      if (Buffer.byteLength(current + character, 'utf8') > 75) { folded.push(current); current = ' '; }
      current += character;
    }
    return [...folded,current].join('\r\n');
  }).join('\r\n') + '\r\n';
}

const contacts = [
  { id:'company-contact', name:'Company contact', person:brand.name, email:brand.email, phones:brand.phones.map(phone => phone.international) },
  ...brand.leadership.map(person => {
    const parts = person.name.split(' ');
    const prefix = parts[0].endsWith('.') ? parts.shift() : '';
    const given = parts.shift(), family = parts.join(' ');
    return { id:`${given.toLowerCase()}-${family.toLowerCase().replaceAll(' ', '-')}-contact`, name:`${person.name} contact`, person:person.name, family, given, prefix, title:person.title, email:person.email, phones:[person.international_phone] };
  }),
];
const items = [
  { id:'company-website', name:'Company website QR', payload:brand.website, description:`Open the ${brand.name} website.`, tags:['website','url'] },
  ...contacts.map(contact => ({ ...contact, payload:vcard({...contact,name:contact.person}), description:`Save ${contact.person}${contact.title ? `, ${contact.title}` : ''} to contacts.`, tags:['contact','vcard'] })),
  { id:'company-email', name:'Company email QR', payload:`mailto:${brand.email}`, description:`Compose an email to ${brand.email}.`, tags:['email'] },
  ...brand.phones.map((phone, index) => ({ id:`company-phone-${index+1}`, name:`Company phone ${index+1} QR`, payload:`tel:${phone.international}`, description:`Call ${phone.display} / ${phone.international}.`, tags:['phone','contact'] })),
  ...brand.socials.map(({ name:network, url:payload }) => {
    const id=network.toLowerCase();
    return { id:`social-${id}`, name:`${network} QR`, payload, description:`Open ${network} / ${brand.social_handle}. URL derived from the supplied handle; profile availability is not independently verified.`, tags:['social',id] };
  }),
];

function artwork(payload, label) {
  const qr = qrcode(0, 'H');
  qr.addData(payload, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  const total = count + quiet * 2;
  const scale = Math.floor(1536 / total);
  const size = total * scale;
  const paths = { navy:[],blue:[] };
  for(let row = 0; row < count; row++) for(let col = 0; col < count; col++) {
    if(!qr.isDark(row,col)) continue;
    const finder = (row < 7 && col < 7) || (row < 7 && col >= count - 7) || (row >= count - 7 && col < 7);
    paths[finder ? 'blue' : 'navy'].push(`M${col+quiet} ${row+quiet}h1v1h-1z`);
  }
  const badge = Math.max(3,Math.floor(count * .14));
  const start = (total - badge) / 2;
  const inset = badge * .1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" role="img" aria-labelledby="qr-title qr-description"><title id="qr-title">${escapeXml(label)}</title><desc id="qr-description">AndHub branded QR code. ${escapeXml(payload)}. High error correction, four-module quiet zone.</desc><rect width="${total}" height="${total}" fill="#FFFFFF"/><path d="${paths.navy.join('')}" fill="#0B1F3B" shape-rendering="crispEdges"/><path d="${paths.blue.join('')}" fill="#2563EB" shape-rendering="crispEdges"/><rect x="${start}" y="${start}" width="${badge}" height="${badge}" rx="${badge*.12}" fill="#FFFFFF"/><svg x="${start+inset}" y="${start+inset}" width="${badge-inset*2}" height="${badge-inset*2}" viewBox="0 0 512 512">${logoInner}</svg></svg>\n`;
  return { svg, size, modules:count, quiet, badge };
}

await mkdir(output,{recursive:true});
const records=[];
const decodes=[];
let jsQR;
if(process.argv.includes('--verify')) {
  const decoderPath = process.env.ANDHUB_JSQR_MODULE;
  if(!decoderPath) throw new Error('--verify requires ANDHUB_JSQR_MODULE pointing to an installed jsQR module.');
  jsQR=(await import(pathToFileURL(decoderPath).href)).default;
}
for(const item of items) {
  const base = `andhub-${item.id}-qr`;
  const {svg,size,modules,quiet,badge}=artwork(item.payload,item.name);
  await writeFile(join(output,`${base}.svg`),svg);
  await sharp(Buffer.from(svg)).png().toFile(join(output,`${base}.png`));
  await sharp(Buffer.from(svg)).jpeg({quality:100,chromaSubsampling:'4:4:4'}).toFile(join(output,`${base}.jpg`));
  const files = [
    {path:`assets/qr/${base}.png`,format:'png',label:'PNG image'},
    {path:`assets/qr/${base}.jpg`,format:'jpg',label:'JPG image'},
    {path:`assets/qr/${base}.svg`,format:'svg',label:'SVG vector'},
  ];
  if(item.tags.includes('vcard')) {
    await writeFile(join(output,`andhub-${item.id}.vcf`),item.payload);
    files.push({path:`assets/qr/andhub-${item.id}.vcf`,format:'vcf',label:'Contact vCard'});
  }
  if(jsQR) for(const format of ['png','jpg']) {
    const {data,info}=await sharp(join(output,`${base}.${format}`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height,{inversionAttempts:'dontInvert'});
    if(!decoded || decoded.data!==item.payload) throw new Error(`QR decode failed or payload mismatch: ${base}.${format}`);
    decodes.push({id:item.id,format,status:'PASS',width:info.width,height:info.height});
  }
  records.push({id:item.id,name:item.name,category:'qr',description:item.description,preview:`assets/qr/${base}.png`,files,tags:item.tags,payload:item.payload,width:size,height:size,qr:{error_correction:'H',modules,quiet_zone_modules:quiet,logo_backing_fraction:badge/modules}});
}
await writeFile(join(output,'qr-codes.json'),JSON.stringify({brand:'AndHub Engineering PLC',version:1,social_note:'Social URLs are derived from the supplied 1hubengineering handle. Profile ownership and availability have not been independently verified.',assets:records},null,2)+'\n');
if(jsQR) await writeFile(join(output,'QR-VALIDATION.json'),JSON.stringify({status:'PASS',encoder:'qrcode-generator 2.0.4',decoder:'jsQR 1.4.0',decoded_images:decodes.length,checks:decodes,scope:'Exact payload decoding of every generated PNG and JPG, including all vCard fields. This is a software decode check; test the final printed size and intended scanning devices.'},null,2)+'\n');
console.log(`Generated ${records.length} branded QR sets${jsQR ? `; all ${decodes.length} PNG/JPG files decode to their exact intended payloads` : ''}.`);
