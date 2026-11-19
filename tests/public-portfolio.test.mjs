import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const source = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
function moduleUrl(code) {
  return `data:text/javascript;base64,${Buffer.from(ts.transpileModule(code.replaceAll('import "server-only";', ''), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`;
}
const clientUrl = moduleUrl('export function createPublicClient() { return globalThis.__publicTest.client; } export function createAssetClient() { globalThis.__publicTest.privileged++; return globalThis.__publicTest.storage; }');
const reactUrl = moduleUrl('export function cache(fn) { return fn; }');
const readerUrl = moduleUrl((await source('src/lib/public-portfolio.ts')).replace('"./supabase/public"', JSON.stringify(clientUrl)).replace('"react"',JSON.stringify(reactUrl)));
const reader = await import(readerUrl);
const validationUrl = moduleUrl(await source('src/lib/admin/records-validation.ts'));
const { GET } = await import(moduleUrl((await source('src/app/api/media/[id]/route.ts')).replace('"@/lib/supabase/public"',JSON.stringify(clientUrl)).replace('"@/lib/admin/records-validation"',JSON.stringify(validationUrl))));
const id = '00000000-0000-4000-8000-000000000002';
const item = { object_path:`photo/${id}.png`,purpose:'photo',mime_type:'image/png',size_bytes:3,published:true,deleting:false,revision:1 };
function mock({ row = item, changed = false, error = false, missing = false, downloadError = false, tables = {} } = {}) {
  const calls = { queries:[], privileged:0, downloads:[], reads:0 };
  const client = { from(table) {
    calls.queries.push(table);
    const chain = { select(value) { assert.ok(!table.includes('draft')); calls.queries.push(value); return chain; },
      eq(key,value) { calls.queries.push([key,value]); return chain; }, order(){return chain;},
      range: async(start) => ({ data: start ? [] : tables[table] ?? [], error:error ? Error('private') : null }),
      maybeSingle: async() => ({ data:tables.profile ?? null, error:error ? Error('private') : null }),
      single: async() => { calls.reads++; return { data: changed && calls.reads > 1 ? null : row, error:error ? Error('private') : null }; },
      then(resolve,reject) { return Promise.resolve({ data:tables[table] ?? [],error:error ? Error('private') : null }).then(resolve,reject); },
    }; return chain;
  }};
  Object.assign(calls, { client:missing ? null : client, storage:{ storage:{ from(bucket) { assert.equal(bucket,'portfolio-media'); return { download:async(path) => { calls.downloads.push(path); return { data:new Blob(['abc']),error:downloadError ? Error('private') : null }; } }; } } } });
  globalThis.__publicTest = calls; return calls;
}
const get = (value=id) => GET(new Request(`https://example.test/api/media/${value}`),{params:Promise.resolve({id:value})});
test.after(() => delete globalThis.__publicTest);
test('public reader uses only publication tables and preserves empty configured lists',async()=>{
  const calls=mock(); const result=await reader.getPublicPortfolio();
  assert.deepEqual(result.experience,[]); assert.deepEqual(result.skills,[]); assert.equal(result.profile,null);
  assert.equal(calls.privileged,0); assert.ok(calls.queries.some(v=>Array.isArray(v)&&v[0]==='archived'&&v[1]===false));
});
test('unconfigured fallback and configured outage remain separate so archived lists cannot reappear',async()=>{
  mock({missing:true}); assert.equal(await reader.getPublicPortfolio(),null);
  mock({error:true}); const result=await reader.getPublicPortfolio();
  assert.notEqual(result,null);
  for(const key of ['experience','skills','education','certifications','projects','media','links']) assert.deepEqual(result[key],[]);
});
test('public record pagination does not truncate the provider row limit',async()=>{
  const rows=Array.from({length:500},(_,i)=>({id:String(i),name:'published',category:'test'}));
  mock({tables:{skills:rows}}); assert.equal((await reader.getPublicPortfolio()).skills.length,500);
});
test('social and credential URLs reject executable, credential-bearing and wrong-host destinations',()=>{
  for(const value of ['javascript:alert(1)','http://example.test','https://user:pass@example.test']) assert.equal(reader.safePublicUrl(value),undefined);
  assert.deepEqual(reader.publicLinks([{label:'GitHub',url:'https://github.com.evil.test'},{label:'Public email',url:'mailto:test@example.test?bcc=x'},{label:'Private',url:'https://example.test'}]),[]);
  assert.deepEqual(reader.publicLinks([{label:'GitHub',url:'https://github.com/owner'}]),[{label:'GitHub',href:'https://github.com/owner'}]);
});

// Render the real public components with only layout/form boundaries stubbed.
const uiUrl = moduleUrl('export function Container({children}) { return children; } export function Card({children}) { return children; } export function SectionHeading() { return null; }');
const chromeUrl = moduleUrl('export function Brand() { return null; } export function Navigation() { return null; } export function NavigationItems() { return null; } export function ContactForm() { return null; }');
const navigationUrl = moduleUrl(await source('src/components/layout/navigation-config.ts'));
const cssUrl = moduleUrl('export default {};');
async function componentUrl(path, imports) {
  let code = await source(path);
  for (const [specifier, url] of Object.entries(imports)) code = code.replaceAll(JSON.stringify(specifier), JSON.stringify(url));
  const output = ts.transpileModule(code, { fileName: 'component.tsx', compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))).toString('base64')}`;
}
const { Contact } = await import(await componentUrl('src/components/contact/contact.tsx', {
  '@/components/ui': uiUrl, '@/components/layout/navigation-config': navigationUrl, './contact-form': chromeUrl, './contact.module.css': cssUrl,
}));
const { Footer } = await import(await componentUrl('src/components/layout/footer.tsx', {
  '@/components/ui/container': uiUrl, './brand': chromeUrl, './navigation-items': chromeUrl, './navigation-config': navigationUrl, '@/lib/public-portfolio': readerUrl,
}));
const buttonUrl = await componentUrl('src/components/ui/button.tsx', {});
const { Header } = await import(await componentUrl('src/components/layout/header.tsx', {
  '@/components/ui/container': uiUrl, './brand': chromeUrl, '@/components/ui': buttonUrl, './navigation': chromeUrl, '@/lib/public-portfolio': readerUrl,
}));
const { SkillsMarquee } = await import(await componentUrl('src/components/skills/skills-marquee.tsx', {
  '@/components/ui': uiUrl, './skills-marquee.module.css': cssUrl,
}));

test('public skills marquee has one accessible technology list and no manual animation control', () => {
  const markup = renderToStaticMarkup(createElement(SkillsMarquee));
  assert.doesNotMatch(markup, /<input|checkbox|Pause skills motion/);
  assert.match(markup, /data-motion-loop/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /tabindex="0"/);
  assert.equal((markup.match(/aria-label="Technologies"/g) ?? []).length, 1);
});

test('published LinkedIn, Fiverr and email render in Contact and Footer while newer drafts remain private', async () => {
  const published = [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/published-owner' },
    { label: 'Fiverr', url: 'https://www.fiverr.com/published-owner' },
    { label: 'Public email', url: 'mailto:published@example.test' },
    { label: 'GitHub', url: '' },
  ];
  const calls = mock({ tables: {
    profile: { full_name: 'Published owner', headline: 'Published headline', biography: '', professional_summary: '' },
    links: published,
    profile_draft: { revision: 5, published_revision: 4, payload: { linkedin: 'https://www.linkedin.com/in/private-draft', public_email: 'private@example.test' } },
  } });
  const content = await reader.getPublicPortfolio();
  for (const markup of [renderToStaticMarkup(createElement(Contact, { links: content.links })), renderToStaticMarkup(await Footer())]) {
    for (const { url } of published.slice(0, 3)) assert.ok(markup.includes(`href="${url}"`));
    assert.doesNotMatch(markup, /GitHub|private-draft|private@example|aria-disabled/);
  }
  assert.ok(!calls.queries.includes('profile_draft'));
  assert.ok(!calls.queries.includes('record_drafts'));
  assert.equal(calls.privileged, 0);
});

test('unpublished, unconfigured and failed reads render no social placeholders or private destinations', async () => {
  for (const options of [{ tables: { profile_draft: { payload: { github: 'https://github.com/private-draft' } } } }, { missing: true }, { error: true }]) {
    mock(options);
    const content = await reader.getPublicPortfolio();
    const contact = renderToStaticMarkup(createElement(Contact, { links: content?.links }));
    const footer = renderToStaticMarkup(await Footer());
    assert.doesNotMatch(contact + footer, /GitHub|LinkedIn|Fiverr|mailto:|private-draft|aria-disabled/);
    assert.match(contact, /Verified contact links will be added/);
    assert.match(footer, /Contact links will be added soon/);
  }
});

test('public header renders a Resume arrow instead of a literal HTML entity', async () => {
  mock();
  const markup = renderToStaticMarkup(await Header());
  assert.match(markup, /Resume <span aria-hidden="true">↗<\/span>/);
  assert.doesNotMatch(markup, /&amp;nearr;|&nearr;/);
});

test('only published, valid Upwork destinations render in Contact and Footer', async () => {
  for (const url of ['https://upwork.com/freelancers/test', 'https://www.upwork.com/freelancers/~test']) {
    mock({ tables: { links: [{ label: 'Upwork', url }], profile_draft: { payload: { upwork: 'https://upwork.com/freelancers/private-draft' } } } });
    const content = await reader.getPublicPortfolio();
    for (const markup of [renderToStaticMarkup(createElement(Contact, { links: content.links })), renderToStaticMarkup(await Footer())]) {
      assert.ok(markup.includes(`href="${url}"`)); assert.match(markup, />Upwork</);
      assert.doesNotMatch(markup, /private-draft/);
    }
  }
  for (const url of ['', 'http://upwork.com/test', 'javascript:alert(1)', 'https://upwork.com.evil.test/test', 'https://evil.test/upwork.com', 'https://user:pass@upwork.com/test', 'https://upwork.com:444/test', 'https://support.upwork.com/test', 'https://upwork.com/test path', 'https://upwork.com/\\test']) {
    assert.deepEqual(reader.publicLinks([{ label: 'Upwork', url }]), []);
  }
  mock({ tables: { profile_draft: { payload: { upwork: 'https://upwork.com/freelancers/private-draft' } } } });
  const content = await reader.getPublicPortfolio();
  assert.doesNotMatch(renderToStaticMarkup(createElement(Contact, { links: content.links })) + renderToStaticMarkup(await Footer()), /Upwork|private-draft/);
});
test('unknown, draft, archived-project-filtered, deleting and legacy media never reach privileged Storage',async()=>{
  for(const row of [null,{...item,published:false},{...item,deleting:true},{...item,purpose:'legacy'},{...item,object_path:'../private.png'},{...item,mime_type:'text/html'}]) {
    const calls=mock({row}); assert.equal((await get()).status,404); assert.equal(calls.privileged,0); assert.deepEqual(calls.downloads,[]);
  }
  const calls=mock(); assert.equal((await get('../bad')).status,404); assert.equal(calls.privileged,0);
});
test('approved images and CV use no-store delivery, with PDF attachment and fixed stored path',async()=>{
  for(const row of [item,{...item,purpose:'cv',mime_type:'application/pdf',object_path:`cv/${id}.pdf`}]) {
    const calls=mock({row});const response=await get();assert.equal(response.status,200);
    assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.equal(response.headers.get('content-type'),row.mime_type);
    if(row.purpose==='cv') assert.match(response.headers.get('content-disposition'),/^attachment/);
    assert.deepEqual(calls.downloads,[row.object_path]);assert.equal(calls.reads,2);
  }
});
test('revocation during download and provider failures deny bytes',async()=>{
  for(const opts of [{changed:true},{error:true},{missing:true},{downloadError:true},{row:{...item,size_bytes:4}}]) {
    mock(opts);const response=await get();assert.equal(response.status,404);assert.equal(await response.text(),'File unavailable');
  }
});
test('public client never inherits cookies or uses the asset secret for content reads',async()=>{
  const calls=[];globalThis.__clientCalls=calls;
  const sdk=moduleUrl('export function createClient(...args) { globalThis.__clientCalls.push(args); return {}; }');
  const {createPublicClient,createAssetClient}=await import(moduleUrl((await source('src/lib/supabase/public.ts')).replace('"@supabase/supabase-js"',JSON.stringify(sdk))));
  const names=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY'];const original=names.map(name=>process.env[name]);
  try {
    process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';process.env.SUPABASE_SECRET_KEY='sb_secret_test';
    createPublicClient();assert.equal(calls[0][1],'sb_publishable_test');assert.equal(calls[0][2].auth.persistSession,false);
    createAssetClient();assert.equal(calls.at(-1)[1],'sb_secret_test');
    process.env.SUPABASE_URL='https://user:pass@test.supabase.co';assert.equal(createPublicClient(),null);assert.equal(createAssetClient(),null);
  } finally { names.forEach((name,i)=>{if(original[i]===undefined)delete process.env[name];else process.env[name]=original[i];});delete globalThis.__clientCalls; }
});
test('migration exposes published rows only and retains private drafts and Storage',async()=>{
  const sql=await source('supabase/migrations/202611170005_public_portfolio.sql');
  assert.match(sql,/published_revision is not null/);assert.match(sql,/using \(not archived\)/);
  assert.match(sql,/published and not deleting/);assert.match(sql,/p.id=media.draft_project_id and not p.archived/);
  assert.doesNotMatch(sql,/grant[^;]*(profile_draft|record_drafts)[^;]*to anon|grant[^;]*storage|create policy[^;]*storage|public\s*=\s*true/i);
  assert.match(sql,/grant select \(id,full_name,headline,biography,professional_summary\)/);
});

test('public media pagination preserves approval filters across pages without leaking paths to components',async()=>{
  const original=process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY='sb_secret_test';
  try {
    const media=Array.from({length:500},(_,i)=>({id:String(i),purpose:'photo',alt_text:'Approved',published:true,deleting:false,draft_project_id:null}));
    const calls=mock({tables:{media}}); const result=await reader.getPublicPortfolio();
    assert.equal(result.media.length,500); assert.equal(calls.privileged,0);
    assert.ok(calls.queries.includes('id,purpose,alt_text,draft_project_id,published,deleting'));
    assert.ok(calls.queries.some(v=>Array.isArray(v)&&v[0]==='published'&&v[1]===true));
  } finally { if(original===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=original; }
});


// Render the actual media-bearing components; substitute only Next Image and UI boundaries.
const mediaUiUrl = moduleUrl('export function Container({children}) { return children; } export function Card({children}) { return children; } export function Badge({children}) { return children; } export function Button({children}) { return children; }');
const imageUrl = moduleUrl(`import { createElement } from ${JSON.stringify(import.meta.resolve('react'))}; export default function Image({unoptimized,...props}) { return createElement('img',props); }`);
const projectDataUrl = moduleUrl('export const caseStudyFields = []; export const projectStatusLabels = {};');
const fontUrl = moduleUrl('export function Manrope() { return { className: "test-manrope" }; }');
const { Hero } = await import(await componentUrl('src/components/hero/hero.tsx', {
  'next/font/google': fontUrl,
  '@/components/ui': mediaUiUrl, 'next/image': imageUrl, '@/lib/public-portfolio': readerUrl, './hero.module.css': cssUrl,
}));
const { PublishedProjectCard } = await import(await componentUrl('src/components/projects/project-card.tsx', {
  '@/components/ui': mediaUiUrl, 'next/image': imageUrl, '@/lib/public-portfolio': readerUrl, './projects-data': projectDataUrl, './projects.module.css': cssUrl,
}));
test('published photos and screenshots keep decorative alt empty and retain useful descriptions', () => {
  const project = { id, title:'Network project', description:'Published project', technologies:[], source_url:null, project_url:null };
  for (const alt_text of ['', 'Production network topology with redundant links']) {
    const photo = { id, purpose:'photo', alt_text, published:true, deleting:false, draft_project_id:null };
    const screenshot = { ...photo, purpose:'screenshot', draft_project_id:id };
    const content = { profile:{ full_name:'Test Person' }, projects:[], skills:[], experience:[], certifications:[], media:[photo] };
    for (const markup of [renderToStaticMarkup(createElement(Hero,{content})), renderToStaticMarkup(createElement(PublishedProjectCard,{project,media:[screenshot]}))]) {
      assert.match(markup,new RegExp(`alt="${alt_text}"`));
      assert.match(markup,new RegExp(`/api/media/${id}`));
    }
  }
});
