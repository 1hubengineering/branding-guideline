import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const checks=[];
function client(serverPath) {
  const child=spawn(process.execPath,[serverPath],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  let nextId=1;
  const pending=new Map();
  const unsolicited=[];
  let stderr='';
  child.stderr.on('data',data=>{stderr+=data;});
  const reader=createInterface({input:child.stdout,crlfDelay:Infinity});
  reader.on('line',line=>{
    let message;
    try {message=JSON.parse(line);} catch {unsolicited.push(line);return;}
    const request=pending.get(message.id);
    if(request) {clearTimeout(request.timer);pending.delete(message.id);request.resolve(message);}
    else unsolicited.push(message);
  });
  child.on('error',issue=>{for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(issue);}pending.clear();});
  const send=(method,params)=>new Promise((resolve,reject)=>{
    const id=nextId++;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`MCP timed out on ${method}`));},5000);
    pending.set(id,{resolve,reject,timer});
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,...(params===undefined?{}:{params})})+'\n');
  });
  const notify=(method,params)=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',method,...(params===undefined?{}:{params})})+'\n');
  const close=async()=>{
    child.stdin.end();
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{child.kill();reject(new Error('MCP did not exit after stdin closed.'));},5000);
      child.once('close',code=>{clearTimeout(timer);if(code===0)resolve();else reject(new Error(`MCP exited ${code}: ${stderr}`));});
    });
    assert.deepEqual(unsolicited,[],'stdout contains only expected JSON-RPC responses');
    assert.equal(stderr,'','healthy session has no stderr diagnostics');
  };
  return {child,send,notify,close};
}
async function initialize(api) {
  const response=await api.send('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'andhub-protocol-check',version:'1.0'}});
  assert.equal(response.result.protocolVersion,'2025-11-25');
  assert.ok(response.result.capabilities.resources);
  assert.ok(response.result.capabilities.tools);
  api.notify('notifications/initialized');
}

const api=client(join(root,'assets/ai/mcp-server.mjs'));
try {
  const early=await api.send('tools/list');
  assert.equal(early.error.code,-32000);
  await initialize(api);
  assert.deepEqual((await api.send('ping')).result,{});
  checks.push('Initializes and negotiates MCP 2025-11-25, requires ready notification, responds to ping');
  const resources=(await api.send('resources/list')).result.resources;
  assert.equal(resources.length,5);
  const contextResponse=await api.send('resources/read',{uri:'andhub://brand-context'});
  const context=JSON.parse(contextResponse.result.contents[0].text);
  assert.equal(context.name,'AndHub Engineering PLC');
  assert.equal(context.contact.email,'info@1hubengineering.com');
  assert.equal(context.leadership.length,2);
  assert.equal(context.motion.primary_animation,'assets/videos/ANDHUB_Logo_Animation_1080p.mp4');
  assert.equal(context.motion.other_videos_status,'experimental');
  const guideline=(await api.send('resources/read',{uri:'andhub://guidelines'})).result.contents[0];
  assert.match(guideline.text,/One identity\. A usable system\./);
  assert.match(guideline.text,/Basis and references/);
  assert.match(guideline.text,/current company/i);
  checks.push('Lists fixed resources and reads current contact data plus the full source guideline');
  const toolList=(await api.send('tools/list')).result.tools;
  assert.equal(toolList.length,4);
  assert.ok(toolList.every(tool=>tool.annotations.readOnlyHint===true));
  const toolContext=(await api.send('tools/call',{name:'get_brand_context',arguments:{}})).result.structuredContent;
  assert.equal(toolContext.contact.website,'https://1hubengineering.com');
  const search=(await api.send('tools/call',{name:'search_assets',arguments:{query:'horizontal',category:'logos',format:'svg',limit:2}})).result;
  assert.equal(search.isError,false);
  assert.equal(search.structuredContent.returned,2);
  assert.ok(search.structuredContent.total_matches>=2);
  assert.ok(search.structuredContent.resources.every(record=>record.files.some(file=>file.url.startsWith('https://1hubengineering.github.io/branding-guideline/assets/'))));
  const first=search.structuredContent.resources[0];
  const found=(await api.send('tools/call',{name:'get_asset',arguments:{id:first.id}})).result;
  assert.equal(found.structuredContent.id,first.id);
  const categories=(await api.send('tools/call',{name:'list_asset_categories',arguments:{}})).result.structuredContent;
  assert.ok(categories.categories.some(item=>item.category==='logos'));
  const videos=(await api.send('tools/call',{name:'search_assets',arguments:{category:'videos',limit:25}})).result.structuredContent.resources;
  assert.equal(videos.filter(record=>record.status==='primary').length,1);
  assert.ok(videos.find(record=>record.status==='primary').files.some(file=>file.path===context.motion.primary_animation));
  assert.ok(videos.filter(record=>record.status!=='primary').every(record=>record.status==='experimental' && record.recommended===false));
  checks.push('Searches and filters the live catalog, returns exact records and absolute published download URLs');
  assert.equal((await api.send('tools/call',{name:'search_assets',arguments:{limit:200}})).result.isError,true);
  assert.equal((await api.send('tools/call',{name:'get_asset',arguments:{id:'../../not-a-resource'}})).result.isError,true);
  assert.equal((await api.send('tools/call',{name:'write_file',arguments:{}})).error.code,-32602);
  assert.equal((await api.send('resources/read',{uri:'file:///private/example'})).error.code,-32002);
  assert.equal((await api.send('resources/read',{uri:'andhub://../../package.json'})).error.code,-32002);
  assert.equal((await api.send('not/a/method')).error.code,-32601);
  checks.push('Rejects unknown tools/methods, unlisted resources, traversal-like IDs and invalid limits');
  const prompt=(await api.send('prompts/get',{name:'andhub_brand_brief',arguments:{task:'Prepare a short company introduction.'}})).result;
  assert.match(prompt.messages[0].content.text,/Prepare a short company introduction/);
  assert.match(prompt.messages[0].content.text,/Current user instructions take precedence/);
  checks.push('Provides a scoped reusable prompt with current brand context');
} finally {await api.close();}

// Model the portable ZIP layout: no full catalog, only a lightweight resource index.
const portable=await mkdtemp(join(tmpdir(),'andhub-mcp-check-'));
try {
  await mkdir(join(portable,'assets/ai'),{recursive:true});
  for(const file of ['mcp-server.mjs','brand-context.json','guidelines.md']) await cp(join(root,'assets/ai',file),join(portable,'assets/ai',file));
  for(const file of ['brand.json','brand-spec.json']) await cp(join(root,'assets',file),join(portable,'assets',file));
  const catalog=JSON.parse(await readFile(join(root,'assets/catalog.json'),'utf8'));
  const sample=catalog.resources.slice(0,2).map(record=>({id:record.id,name:record.name,category:record.category,description:record.description,preview:record.preview,files:record.files.map(({path,format,label})=>({path,format,label}))}));
  await writeFile(join(portable,'assets/ai/resource-index.json'),JSON.stringify({version:2,brand:catalog.brand,resources:sample}));
  const bundled=client(join(portable,'assets/ai/mcp-server.mjs'));
  try {
    await initialize(bundled);
    const matches=(await bundled.send('tools/call',{name:'search_assets',arguments:{limit:25}})).result.structuredContent;
    assert.equal(matches.total_matches,2);
    assert.ok(matches.resources.every(record=>record.files.every(file=>file.url.startsWith('https://1hubengineering.github.io/branding-guideline/assets/'))));
    const source=JSON.parse((await bundled.send('resources/read',{uri:'andhub://catalog'})).result.contents[0].text);
    assert.equal(source.resources.length,2);
  } finally {await bundled.close();}
  checks.push('Runs from a portable AI bundle using resource-index.json when the full catalog is absent');
} finally {
  const intendedPrefix=resolve(tmpdir(),'andhub-mcp-check-');
  if(!resolve(portable).startsWith(intendedPrefix)) throw new Error('Refusing to clean an unexpected temporary path.');
  await rm(portable,{recursive:true,force:true});
}

console.log(JSON.stringify({status:'PASS',transport:'stdio',protocol:'2025-11-25',checks},null,2));
