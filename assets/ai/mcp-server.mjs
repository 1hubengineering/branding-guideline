#!/usr/bin/env node
// Read-only MCP 2025-11-25 adapter. stdio messages only; no HTTP listener or dependencies.
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const canonical = 'https://1hubengineering.github.io/branding-guideline/';
const protocolVersion = '2025-11-25';
let initialized = false;
let ready = false;
class RpcError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
class ToolInputError extends Error {}
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
const result = (id, value) => send({ jsonrpc:'2.0', id, result:value });
const error = (id, code, message) => send({ jsonrpc:'2.0', id, error:{ code, message } });
const resourceDefinitions = [
  { uri:'andhub://brand-context', name:'brand-context.json', title:'Current AndHub brand context', description:'Current company facts, proposed brand rules and source status.', mimeType:'application/json', file:'assets/ai/brand-context.json' },
  { uri:'andhub://brand-data', name:'brand.json', title:'Current company source data', description:'Supplied copy, contacts, leadership and configured social URLs.', mimeType:'application/json', file:'assets/brand.json' },
  { uri:'andhub://brand-spec', name:'brand-spec.json', title:'Reconstructed artwork specification', description:'Logo layouts, treatments, palette and historical reconstruction notes.', mimeType:'application/json', file:'assets/brand-spec.json' },
  { uri:'andhub://guidelines', name:'guidelines.md', title:'Complete source guideline', description:'Full historical guide text and tables, prefaced with current-source status.', mimeType:'text/markdown', file:'assets/ai/guidelines.md' },
  { uri:'andhub://catalog', name:'catalog.json', title:'AndHub resource index', description:'Current catalog; falls back to the portable resource index when bundled.', mimeType:'application/json', file:'catalog' },
];
const emptySchema = { type:'object', properties:{}, additionalProperties:false };
const annotations = { readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false };
const tools = [
  { name:'get_brand_context', title:'Read current AndHub brand context', description:'Return current supplied company facts, identity standards, approval status and source links.', inputSchema:emptySchema, annotations },
  { name:'search_assets', title:'Find AndHub resources', description:'Search current catalog names, descriptions, tags and file paths. Returns matching records with published download URLs; filters are optional.', inputSchema:{ type:'object', properties:{ query:{type:'string',maxLength:200}, category:{type:'string',maxLength:80}, format:{type:'string',maxLength:20}, limit:{type:'integer',minimum:1,maximum:25,default:10} }, additionalProperties:false }, annotations },
  { name:'get_asset', title:'Read an AndHub resource record', description:'Look up one exact catalog ID, including its formats and published download URLs.', inputSchema:{type:'object',properties:{id:{type:'string',minLength:1,maxLength:200}},required:['id'],additionalProperties:false}, annotations },
  { name:'list_asset_categories', title:'List available resource categories', description:'List catalog categories and current resource counts without assuming a fixed inventory size.', inputSchema:emptySchema, annotations },
];

async function readLocal(path) { return readFile(join(root,path),'utf8'); }
async function readCatalog() {
  let text;
  try { text=await readLocal('assets/catalog.json'); }
  catch (issue) {
    if(issue.code!=='ENOENT') throw issue;
    text=await readLocal('assets/ai/resource-index.json');
  }
  const catalog=JSON.parse(text);
  if(!Array.isArray(catalog.resources)) throw new Error('Catalog has no resources.');
  return catalog;
}
function publicUrl(path) {
  if(typeof path!=='string' || !path.startsWith('assets/') || path.split('/').some(part=>part==='..')) return null;
  return new URL(path.split('/').map(encodeURIComponent).join('/'),canonical).href;
}
function resourceRecord(record) {
  return {
    id:record.id, name:record.name, category:record.category, description:record.description || '',
    ...(record.preview ? {preview:publicUrl(record.preview)} : {}),
    ...(record.layout ? {layout:record.layout} : {}),
    ...(record.theme ? {theme:record.theme} : {}),
    tags:Array.isArray(record.tags)?record.tags:[],
    files:(record.files || []).map(file=>({path:file.path,url:publicUrl(file.path),format:file.format,label:file.label || file.format,...(Number.isInteger(file.bytes)?{bytes:file.bytes}:{})})).filter(file=>file.url),
  };
}
function checkArguments(args, allowed) {
  for(const key of Object.keys(args)) if(!allowed.includes(key)) throw new ToolInputError(`Unsupported argument: ${key}.`);
}
function optionalString(args,key,max) {
  if(args[key]===undefined) return '';
  if(typeof args[key]!=='string' || args[key].length>max) throw new ToolInputError(`${key} must be a string no longer than ${max} characters.`);
  return args[key].trim();
}
async function callTool(name,args) {
  if(name==='get_brand_context') {
    checkArguments(args,[]);
    return JSON.parse(await readLocal('assets/ai/brand-context.json'));
  }
  if(name==='list_asset_categories') {
    checkArguments(args,[]);
    const catalog=await readCatalog();
    const counts=new Map();
    for(const record of catalog.resources) counts.set(record.category,(counts.get(record.category)||0)+1);
    return {categories:[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([category,count])=>({category,count})),total_resources:catalog.resources.length};
  }
  if(name==='get_asset') {
    checkArguments(args,['id']);
    const id=optionalString(args,'id',200);
    if(!id) throw new ToolInputError('id is required. Use search_assets to discover an exact catalog ID.');
    const record=(await readCatalog()).resources.find(item=>item.id===id);
    if(!record) throw new ToolInputError('No resource has that ID. Use search_assets or list_asset_categories first.');
    return resourceRecord(record);
  }
  checkArguments(args,['query','category','format','limit']);
  const query=optionalString(args,'query',200).toLowerCase();
  const category=optionalString(args,'category',80).toLowerCase();
  const format=optionalString(args,'format',20).toLowerCase().replace(/^\./,'');
  const limit=args.limit===undefined?10:args.limit;
  if(!Number.isInteger(limit)||limit<1||limit>25) throw new ToolInputError('limit must be an integer between 1 and 25.');
  const catalog=await readCatalog();
  const terms=query.split(/\s+/).filter(Boolean);
  const matches=catalog.resources.filter(record=>{
    if(category && String(record.category).toLowerCase()!==category) return false;
    if(format && !(record.files || []).some(file=>String(file.format).toLowerCase()===format)) return false;
    const text=[record.id,record.name,record.description,...(record.tags || []),...(record.files || []).map(file=>file.path)].join(' ').toLowerCase();
    return terms.every(term=>text.includes(term));
  });
  return {query,category:category || null,format:format || null,total_matches:matches.length,returned:Math.min(limit,matches.length),resources:matches.slice(0,limit).map(resourceRecord),catalog_url:new URL('assets/catalog.json',canonical).href};
}
const toolResult = value => ({content:[{type:'text',text:JSON.stringify(value,null,2)}],structuredContent:value,isError:false});
const toolError = message => ({content:[{type:'text',text:message}],isError:true});
const promptDefinition={name:'andhub_brand_brief',title:'Apply the AndHub brand',description:'Start a task with current brand context and source priority. Does not authorize publishing or external changes.',arguments:[{name:'task',description:'The AndHub content or asset-selection task.',required:true}]};

async function request(message) {
  const {method,id}=message;
  const params=message.params===undefined?{}:message.params;
  if(!isObject(params)) throw new RpcError(-32602,'params must be an object.');
  if(method==='ping') return {};
  if(method==='initialize') {
    if(initialized) throw new RpcError(-32600,'This session has already initialized.');
    if(typeof params.protocolVersion!=='string'||!isObject(params.capabilities)||!isObject(params.clientInfo)||typeof params.clientInfo.name!=='string'||typeof params.clientInfo.version!=='string') throw new RpcError(-32602,'initialize requires protocolVersion, capabilities and clientInfo with name/version.');
    initialized=true;
    return {protocolVersion,capabilities:{resources:{},tools:{},prompts:{}},serverInfo:{name:'andhub-brand',version:'1.0.0',title:'AndHub read-only brand library',websiteUrl:canonical},instructions:'Read current user instructions first. Use brand data for current facts, preserve proposed/reconstructed status, and use catalog records for downloads. The adapter reads fixed local sources only; it does not authorize changes or publishing.'};
  }
  if(!initialized || !ready) throw new RpcError(-32000,'Initialize the MCP session and send notifications/initialized before using resources or tools.');
  if(method==='resources/list') {
    if(params.cursor!==undefined) throw new RpcError(-32602,'This fixed resource list has no pagination cursor.');
    return {resources:resourceDefinitions.map(({file,...definition})=>definition)};
  }
  if(method==='resources/templates/list') return {resourceTemplates:[]};
  if(method==='resources/read') {
    const definition=resourceDefinitions.find(item=>item.uri===params.uri);
    if(!definition) throw new RpcError(-32002,'Unknown resource URI. Use resources/list; arbitrary file paths are not accepted.');
    const text=definition.file==='catalog'?JSON.stringify(await readCatalog(),null,2):await readLocal(definition.file);
    return {contents:[{uri:definition.uri,mimeType:definition.mimeType,text}]};
  }
  if(method==='tools/list') {
    if(params.cursor!==undefined) throw new RpcError(-32602,'This fixed tool list has no pagination cursor.');
    return {tools};
  }
  if(method==='tools/call') {
    if(typeof params.name!=='string'||!tools.some(tool=>tool.name===params.name)) throw new RpcError(-32602,'Unknown tool. Use tools/list to discover supported names.');
    const args=params.arguments===undefined?{}:params.arguments;
    if(!isObject(args)) throw new RpcError(-32602,'Tool arguments must be an object.');
    try { return toolResult(await callTool(params.name,args)); }
    catch(issue) { if(issue instanceof ToolInputError) return toolError(issue.message); throw issue; }
  }
  if(method==='prompts/list') return {prompts:[promptDefinition]};
  if(method==='prompts/get') {
    if(params.name!==promptDefinition.name||!isObject(params.arguments)||typeof params.arguments.task!=='string'||!params.arguments.task.trim()||params.arguments.task.length>5000) throw new RpcError(-32602,'Choose andhub_brand_brief with a nonempty task string under 5,000 characters.');
    return {description:'Current AndHub context for the requested task.',messages:[{role:'user',content:{type:'text',text:`Task supplied by the caller:\n${params.arguments.task}\n\nApply the current AndHub context below within the caller\'s authorized scope. Current user instructions take precedence. Use search_assets to choose existing resources.\n\n${await readLocal('assets/ai/brand-context.json')}`}}]};
  }
  throw new RpcError(-32601,`Method not found: ${method}`);
}

const lines=createInterface({input:process.stdin,crlfDelay:Infinity,terminal:false});
for await(const line of lines) {
  if(!line.trim()) continue;
  let message;
  try { message=JSON.parse(line); }
  catch { error(null,-32700,'Parse error: send one JSON-RPC object per line.'); continue; }
  if(!isObject(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string'||('id' in message && typeof message.id!=='string' && (typeof message.id!=='number'||!Number.isFinite(message.id)))) {
    const safeId=isObject(message)&&(typeof message.id==='string'||(typeof message.id==='number'&&Number.isFinite(message.id)))?message.id:null;
    error(safeId,-32600,'Invalid JSON-RPC request.'); continue;
  }
  if(!('id' in message)) {
    if(message.method==='notifications/initialized' && initialized) ready=true;
    continue;
  }
  if(Buffer.byteLength(line,'utf8')>1_048_576) { error(message.id,-32600,'Request exceeds the one-megabyte limit.'); continue; }
  try { result(message.id,await request(message)); }
  catch(issue) {
    if(issue instanceof RpcError) error(message.id,issue.code,issue.message);
    else {
      process.stderr.write(`AndHub MCP: ${issue.code==='ENOENT'?'a required local source is missing':'a local source could not be read'}.\n`);
      error(message.id,-32603,'Required local brand data could not be read. Use a complete checkout or portable AI bundle.');
    }
  }
}
