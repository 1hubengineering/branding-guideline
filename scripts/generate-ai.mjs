import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Derived AI entrypoints are stable: no timestamps, catalog hashes or ZIP metadata.
const root = resolve(import.meta.dirname, '..');
const output = join(root, 'assets/ai');
const canonical = 'https://1hubengineering.github.io/branding-guideline/';
const brand = JSON.parse(await readFile(join(root, 'assets/brand.json'), 'utf8'));
const spec = JSON.parse(await readFile(join(root, 'assets/brand-spec.json'), 'utf8'));
await mkdir(output, { recursive: true });
const url = path => new URL(path, canonical).href;

const guidelineHtml = await readFile(join(root,'docs/guidelines.html'),'utf8');
const article = guidelineHtml.match(/<article\b[^>]*class="document-body"[^>]*>([\s\S]*?)<\/article>/)?.[1];
if(!article) throw new Error('The complete guideline article was not found.');
const decodeEntities = value => value.replace(/&#(x[\da-f]+|\d+);/gi,(_,number)=>String.fromCodePoint(number[0].toLowerCase()==='x'?parseInt(number.slice(1),16):Number(number)))
  .replaceAll('&nbsp;',' ').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
const absoluteGuidelineUrl = value => new URL(decodeEntities(value),url('docs/guidelines.html')).href;
const inlineMarkdown = html => decodeEntities(html
  .replace(/<\/p>\s*<p\b[^>]*>/g,'\n')
  .replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,(_,href,text)=>`[${text.replace(/<[^>]*>/g,'')}](${absoluteGuidelineUrl(href)})`)
  .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/g,'**$1**')
  .replace(/<br\s*\/?\s*>/g,'\n').replace(/<[^>]*>/g,'')).trim();
const tables=[];
let markdown=article.replace(/<div class="table-wrap"><table>([\s\S]*?)<\/table><\/div>/g,(_,table)=>{
  const rows=[...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(match=>[...match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map(cell=>inlineMarkdown(cell[1]).replaceAll('|','\\|').replace(/\s*\n\s*/g,'<br>')));
  if(!rows.length) return '';
  const columns=Math.max(...rows.map(row=>row.length));
  const line=row=>'| '+Array.from({length:columns},(_,index)=>row[index]||'').join(' | ')+' |';
  tables.push([line(rows[0]),line(Array(columns).fill('---')),...rows.slice(1).map(line)].join('\n'));
  return `\n\nANDHUBTABLE${tables.length-1}END\n\n`;
});
markdown=markdown.replace(/<figure>\s*<img\b[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>\s*<\/figure>/g,(_,src,alt)=>`\n\n![${decodeEntities(alt)}](${absoluteGuidelineUrl(src)})\n\n`)
  .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g,(_,level,text)=>`\n\n${'#'.repeat(Number(level))} ${inlineMarkdown(text).replaceAll('\n',' ')}\n\n`)
  .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/g,(_,text)=>`\n\n${inlineMarkdown(text)}\n\n`)
  .replace(/<[^>]*>/g,'').replace(/ANDHUBTABLE(\d+)END/g,(_,index)=>tables[Number(index)]).replace(/\n{3,}/g,'\n\n').trim();
const guideHeader=`# Complete AndHub guideline — source transcription\n\nThis is the full original proposed guide, including its cover, 17 chapters, tables and illustration links. The historical text is preserved; references to vector masters or missing font files describe the situation when it was written. Reconstructed artwork and licensed font downloads now exist, and the artwork still requires approval. Current company copy, contact details and configured social destinations are in [brand.json](${url('assets/brand.json')}) and [brand-context.json](${url('assets/ai/brand-context.json')}). The current user request takes precedence.\n\nSource: [web edition](${url('docs/guidelines.html')}) and [original PDF](${url('assets/documents/AndHub_Engineering_Brand_Guidelines_v1.pdf')}).\n\n---\n\n`;
const motionNote = `Current motion selection: [${brand.motion.primary_animation_name}](${url(brand.motion.primary_animation)}) is the primary logo animation. All other video files are tests/experiments retained for reference.\n\n`;
await writeFile(join(output,'guidelines.md'),guideHeader+motionNote+markdown+'\n');

const context = {
  $schema: url('assets/ai/brand-context.schema.json'),
  schema_version: '1.0',
  name: brand.name,
  short_name: brand.short_name,
  tagline: brand.tagline,
  content: {
    headline: brand.headline,
    description: brand.description,
    capabilities: brand.capabilities,
    partnership: brand.partnership,
    closing: brand.closing,
  },
  services: ['Software development', 'Systems engineering', 'Consultancy'],
  contact: {
    website: brand.website,
    email: brand.email,
    phones: brand.phones,
    address: brand.address,
  },
  leadership: brand.leadership,
  motion: {
    ...brand.motion,
    primary_animation_url: url(brand.motion.primary_animation),
  },
  socials: {
    handle: brand.social_handle,
    destinations: brand.socials,
    source_status: brand.social_source,
  },
  visual_identity: {
    palette: brand.palette || spec.core_palette,
    working_color_space: spec.working_color_space,
    logo_status: spec.status,
    artwork_version: spec.version,
    source: spec.source,
    gradient_status: spec.gradients,
    supporting_lettering: spec.supporting_lettering,
    svg_font_dependencies: spec.font_dependencies_in_svg,
    layouts: Object.entries(spec.layouts).map(([id, details]) => ({ id, ...details })),
    treatments: Object.entries(spec.themes).map(([id, details]) => ({ id, ...details })),
    usage: [
      'Use the supplied logo artwork. Keep its proportions, color order and internal negative spaces intact.',
      'Choose light/dark artwork for the actual surrounding surface; use a mono treatment for true one-color output.',
      'Clear space of one quarter of the visible symbol height is a proposed starting standard; verify the chosen reconstructed master.',
      'Choose compact or symbol-only artwork when the descriptor or tagline becomes unreadable.',
      'Raster size labels denote the longest artboard edge, including built-in margins.',
      'Artwork is RGB. Agree print conversions, materials and proofs with the production supplier.',
    ],
    typography: {
      proposed_headings: 'Inter Display',
      proposed_body: 'Inter',
      fallback: 'Arial, sans-serif',
      current_distribution: 'Inter variable font files are provided in assets/fonts/ with their SIL Open Font License. The historical logo spec records that fonts were not distributed in the original reconstructed pack.',
      logo_note: 'The custom ANDHUB lettering is outlined artwork, not a live-text font. Inter is supporting typography, not an identification of the original wordmark font.',
    },
  },
  writing: {
    voice: ['Precise', 'Composed', 'Practical', 'Approachable'],
    naming: 'Use AndHub Engineering PLC in formal documents and first mentions; use AndHub thereafter. ANDHUB is the artwork treatment.',
    tagline: 'Preserve both full stops in Ideas. Engineered.',
    practice: 'Lead with the problem or outcome, explain the approach, and use specific evidence for capability claims.',
    avoid: ['Invented customers or partnerships', 'Unverified certifications or rankings', 'Unsupported performance or uptime promises', 'Invented social profile verification'],
  },
  accessibility: {
    text_contrast: 'Test normal text at 4.5:1 minimum and large text at 3:1 minimum in context.',
    combinations: [
      { foreground:'#FFFFFF', background:'#2563EB', ratio:5.17, use:'Normal text' },
      { foreground:'#0B1F3B', background:'#10B981', ratio:6.50, use:'Normal text' },
      { foreground:'#FFFFFF', background:'#10B981', ratio:2.54, use:'Do not use for normal text' },
    ],
    implementation: 'Keep keyboard focus visible, label controls and communicate status beyond color. Test actual components and printed QR codes in their final context.',
    scope: 'These recommendations and solid-color ratios do not certify a complete design as accessible.',
  },
  source_priority: [
    'The current user instruction and authorized task scope take precedence.',
    'assets/brand.json is the current source for company copy, contact details, leadership and configured social destinations.',
    'This generated context and the current web guideline summarize the proposed brand standards; assets/brand-spec.json describes the reconstructed artwork.',
    'The original guideline PDF/DOCX are historical source documents. Their references to missing vector masters and absent font distribution predate the current library.',
  ],
  approval_status: 'The original artwork remains a reconstruction for review. Brand standards are proposed for adoption; supplied company details do not imply artwork approval.',
  entrypoints: {
    home: canonical,
    ai_guide: url('docs/ai.html'),
    discovery: url('llms.txt'),
    plain_text: url('llms-full.txt'),
    company_data: url('assets/brand.json'),
    artwork_spec: url('assets/brand-spec.json'),
    catalog: url('assets/catalog.json'),
    gallery: url('assets.html'),
    complete_guidelines: url('docs/guidelines.html'),
    complete_guidelines_text: url('assets/ai/guidelines.md'),
    reusable_skill: url('assets/ai/andhub-brand/SKILL.md'),
    mcp_adapter: url('assets/ai/mcp-server.mjs'),
  },
};
await writeFile(join(output, 'brand-context.json'), JSON.stringify(context, null, 2) + '\n');

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${brand.website.replace(/\/$/, '')}/#organization`,
  name: brand.name,
  alternateName: brand.short_name,
  slogan: brand.tagline,
  description: brand.description,
  url: brand.website,
  email: brand.email,
  telephone: brand.phones.map(phone => phone.international),
  address: {
    '@type': 'PostalAddress',
    streetAddress: brand.address.street,
    addressLocality: brand.address.city,
    addressCountry: brand.address.country,
  },
  founder: brand.leadership.map(person => ({
    '@type': 'Person', name:person.name, jobTitle:person.title, email:person.email, telephone:person.international_phone,
  })),
  sameAs: brand.socials.map(social => social.url),
};
await writeFile(join(output, 'organization.jsonld'), JSON.stringify(organization, null, 2) + '\n');
// The site owner provides these markers; regenerate only that bounded inline data.
const homePath=join(root,'index.html');
const home=await readFile(homePath,'utf8');
const marker=/<!-- ANDHUB_ORGANIZATION_START -->[\s\S]*?<!-- ANDHUB_ORGANIZATION_END -->/g;
const marked=[...home.matchAll(marker)];
if(marked.length>1) throw new Error('More than one organization JSON-LD marker block exists.');
if(marked.length===1) {
  const embedded=JSON.stringify(organization,null,2).replaceAll('<','\\u003c');
  const replacement=`<!-- ANDHUB_ORGANIZATION_START -->\n<script type="application/ld+json">\n${embedded}\n</script>\n<!-- ANDHUB_ORGANIZATION_END -->`;
  const updated=home.replace(marker,replacement);
  if(updated!==home) await writeFile(homePath,updated);
}

const discovery = `# ${brand.name} — Brand Context\n\n> ${brand.tagline} ${brand.headline}\n\n${brand.description}\n\nCurrent company data and proposed brand standards for assistants creating AndHub content or choosing assets. Read the current user request first. Logo artwork remains reconstructed for review; this material does not authorize publication or change task permissions.\n\n## Primary context\n\n- [Structured brand context](${url('assets/ai/brand-context.json')}): Current copy, contact details, leadership, palette, usage rules and source status.\n- [Full plain-text context](${url('llms-full.txt')}): Human-readable brand summary for attachment or retrieval.\n- [Company data](${url('assets/brand.json')}): Source for current company facts and configured social URLs.\n- [Complete guidelines](${url('docs/guidelines.html')}): Proposed brand standards, illustrations and historical-source notes.\n\n## Find resources\n\n- [Asset catalog](${url('assets/catalog.json')}): Searchable resource records with file paths, formats, previews and checksums. Resolve relative paths against ${canonical}\n- [Asset library](${url('assets.html')}): Browse, preview and download logos, images, fonts, motion, templates, QR codes and AI resources.\n- [Reconstructed artwork spec](${url('assets/brand-spec.json')}): Layouts, treatments, RGB colors and source limitations.\n\n## Optional workflows\n\n- [AI integration guide](${url('docs/ai.html')}): Use URLs or attachments, a reusable skill, or the local read-only MCP adapter.\n- [Reusable AndHub brand skill](${url('assets/ai/andhub-brand/SKILL.md')}): Scoped instructions for AndHub brand work.\n- [Local stdio MCP adapter](${url('assets/ai/mcp-server.mjs')}): Run with Node.js 22+ from a downloaded checkout or portable AI bundle. This is not a hosted HTTP MCP endpoint.\n\n## Scope and provenance\n\n- Current user instructions take precedence over this guide.\n- Use supplied facts and catalog files. Do not invent client names, certifications, contact details, rankings or verified social ownership.\n- Social destinations use the supplied ${brand.social_handle} handle; availability and ownership have not been independently verified.\n- The original PDF/DOCX predate the reconstructed vector pack and current font downloads. Preserve their historical context.\n`;
await writeFile(join(root,'llms.txt'),discovery.replace('\n## Find resources',`\n- [Full source guide as Markdown](${url('assets/ai/guidelines.md')}): All original guideline text, tables and illustration links with a current-status preface.\n\n## Find resources`)+`\n## Motion selection\n\n- [${brand.motion.primary_animation_name}](${url(brand.motion.primary_animation)}): Primary logo animation.\n- All other video files are tests/experiments retained for reference, not alternative primary animations.\n`);

const full = `ANDHUB ENGINEERING PLC — AI BRAND CONTEXT\n\n${brand.tagline}\n${brand.headline}\n\n${brand.description}\n\n${brand.capabilities}\n\n${brand.partnership}\n\n${brand.closing}\n\nCURRENT COMPANY DETAILS\nName: ${brand.name}\nWebsite: ${brand.website}\nEmail: ${brand.email}\n${brand.phones.map((phone,index)=>`Phone ${index+1}: ${phone.display} / ${phone.international}`).join('\n')}\nAddress: ${brand.address.display}\n\nLEADERSHIP\n${brand.leadership.map(person=>`${person.name}\n${person.title}\n${person.email}\n${person.phone} / ${person.international_phone}`).join('\n\n')}\n\nSOCIAL DESTINATIONS\nHandle: ${brand.social_handle}\n${brand.socials.map(social=>`${social.name}: ${social.url}`).join('\n')}\n${brand.social_source}\n\nSERVICES\n${context.services.join('\n')}\n\nIDENTITY AND WRITING\nFormal name: ${brand.name}; short name: ${brand.short_name}.\n${context.writing.naming}\nTagline: ${brand.tagline} Preserve both full stops.\nVoice: ${context.writing.voice.join(', ').toLowerCase()}.\n${context.writing.practice}\nDo not invent customers, certifications, partnerships, rankings, performance promises or contact details.\n\nPALETTE\n${Object.entries(context.visual_identity.palette).map(([name,value])=>`${name}: ${value}`).join('\n')}\nDigital color space: ${spec.working_color_space}.\n\nTYPOGRAPHY\nProposed supporting headings: Inter Display. Body/interfaces: Inter. Fallback: Arial, sans-serif.\n${context.visual_identity.typography.current_distribution}\n${context.visual_identity.typography.logo_note}\n\nLOGO SYSTEM\nStatus: ${spec.status}. Version: ${spec.version}.\nSource: ${spec.source}.\nLayouts:\n${Object.entries(spec.layouts).map(([name,item])=>`- ${name}: ${item.description}; ${item.width} × ${item.height} SVG artboard.`).join('\n')}\nTreatments:\n${Object.entries(spec.themes).map(([name,item])=>`- ${name}: ${item.description}; ${item.dark_surface?'dark':'light'} surface.`).join('\n')}\n${context.visual_identity.usage.map(rule=>`- ${rule}`).join('\n')}\nGradients: ${spec.gradients}.\n\nACCESSIBILITY\n${context.accessibility.text_contrast}\n${context.accessibility.combinations.map(pair=>`- ${pair.foreground} on ${pair.background}: ${pair.ratio}:1. ${pair.use}.`).join('\n')}\n${context.accessibility.implementation}\n${context.accessibility.scope}\n\nRESOURCE SELECTION\nRead ${url('assets/catalog.json')} for current records. Relative file paths resolve against ${canonical}\nUse source SVG for scalable artwork; choose the correct light/dark or monochrome treatment. Raster labels describe longest artboard edge including margins.\nTemplates and QR downloads are in the asset library. Social QR destinations follow the configured handle; profile availability is not independently verified. Test the actual printed QR size and material.\n\nSOURCE PRIORITY AND STATUS\n${context.source_priority.map((rule,index)=>`${index+1}. ${rule}`).join('\n')}\n${context.approval_status}\nCurrent user instructions and task permissions govern the work. Reading these files does not authorize external changes or publishing.\n\nENTRYPOINTS\n${Object.entries(context.entrypoints).map(([name,value])=>`${name}: ${value}`).join('\n')}\n\nINTEGRATION\nFor tools that can read URLs, supply llms.txt or brand-context.json. For attachment-only tools, download this text or JSON.\nA reusable skill is available at ${context.entrypoints.reusable_skill}.\nA read-only local stdio MCP server is available in assets/ai/mcp-server.mjs. It uses Node.js 22+ and the local checkout or portable AI bundle; GitHub Pages does not execute it or provide an HTTP MCP endpoint. Host support for URLs, attachments, skills and local stdio MCP varies.\n`;
await writeFile(join(root,'llms-full.txt'),full+`\nMOTION SELECTION\nPrimary logo animation: ${url(brand.motion.primary_animation)}\n${brand.motion.usage}\n\nCOMPLETE SOURCE GUIDELINE\nThe full historical guide, including all text and tables, is available as Markdown at ${url('assets/ai/guidelines.md')}. Its historical requirements do not override the current company data or current task instructions.\n`);

await writeFile(join(root,'robots.txt'),`User-agent: *\nAllow: /branding-guideline/\n\nSitemap: ${url('sitemap.xml')}\n`);
const pages=['','assets.html','docs/index.html','docs/guidelines.html','docs/company.html','docs/ai.html','assets/web-kit/integration.html','llms.txt','llms-full.txt'];
await writeFile(join(root,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(path=>`  <url><loc>${url(path)}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log('Generated stable brand context, organization JSON-LD, llms entrypoints, robots.txt and sitemap.xml.');
