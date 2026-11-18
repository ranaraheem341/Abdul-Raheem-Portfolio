import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
function moduleUrl(code) {
  return `data:text/javascript;base64,${Buffer.from(ts.transpileModule(code.replaceAll('import "server-only";', ""), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
}
const validationUrl = moduleUrl(await source("src/lib/admin/records-validation.ts"));
const mediaUrl = moduleUrl((await source("src/lib/admin/media-validation.ts")).replace('"./records-validation"', JSON.stringify(validationUrl)));
const { inspectUpload, mediaLimit } = await import(mediaUrl);
const configUrl = moduleUrl(await source("src/lib/supabase/config.ts"));
const redirectUrl = moduleUrl('export function redirect(url) { throw Object.assign(Error(url), { redirect: url }); }');
const serverUrl = moduleUrl('export async function createSupabaseServerClient() { return globalThis.__mediaTest.client; }');
const authUrl = moduleUrl((await source("src/lib/admin/auth.ts")).replace('"next/navigation"', JSON.stringify(redirectUrl)).replace('"../supabase/config"', JSON.stringify(configUrl)).replace('"../supabase/server"', JSON.stringify(serverUrl)));
const cacheUrl = moduleUrl('export function revalidatePath(path) { globalThis.__mediaTest.calls.refresh.push(path); }');
const { writeMedia } = await import(moduleUrl((await source("src/app/admin/media-actions.ts")).replace('"@/lib/admin/auth"', JSON.stringify(authUrl)).replace('"@/lib/admin/records-validation"', JSON.stringify(validationUrl)).replace('"@/lib/admin/media-validation"', JSON.stringify(mediaUrl)).replace('"next/cache"', JSON.stringify(cacheUrl))));
const { getMediaEditor } = await import(moduleUrl((await source("src/lib/admin/media.ts")).replace('"./auth"', JSON.stringify(authUrl))));
const { GET } = await import(moduleUrl((await source("src/app/admin/media/[id]/route.ts")).replace('"@/lib/admin/auth"', JSON.stringify(authUrl)).replace('"@/lib/admin/records-validation"', JSON.stringify(validationUrl))));
const adminId = "00000000-0000-4000-8000-000000000001", id = "00000000-0000-4000-8000-000000000002";
const envNames = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ADMIN_USER_ID"], originals = envNames.map(key => process.env[key]);
test.after(() => { envNames.forEach((key,i) => { if (originals[i] === undefined) delete process.env[key]; else process.env[key]=originals[i]; }); delete globalThis.__mediaTest; });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXXsAAAAASUVORK5CYII=", "base64");
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\nstartxref\n0\n%%EOF\n");
const initial = { ok: false, message: "forged previous state ignored" };
function upload(purpose="photo") {
  const form = new FormData();
  for (const [key,value] of Object.entries({ intent:"upload", purpose, project_id:purpose==="screenshot"?id:"",alt_text:"Synthetic test image" })) form.set(key,value);
  form.set("file",new File([purpose==="cv"?pdf:png], purpose==="cv"?"test.pdf":"../../unsafe.png", { type:purpose==="cv"?"application/pdf":"image/png" }));
  return form;
}
function mutation(intent="publish") {
  const form = new FormData(); for (const [key,value] of Object.entries({ intent,id,revision:"1",confirm_delete:"yes" })) form.set(key,value); return form;
}
function mock(options={}) {
  process.env.SUPABASE_URL="https://test.supabase.co"; process.env.SUPABASE_PUBLISHABLE_KEY="sb_publishable_test_only"; process.env.SUPABASE_ADMIN_USER_ID=adminId;
  const calls={ auth:0, writes:[], storage:[], reads:[], refresh:[] };
  let revision=1;
  const item=()=>({ id,object_path:"photo/stored-only.png",mime_type:options.pdf?"application/pdf":"image/png",purpose:options.pdf?"cv":"photo",size_bytes:png.length,alt_text:"Test",published:false,deleting:options.deleting??false,revision });
  const client={
    auth:{ getUser:async()=>{ calls.auth++; return { data:{ user: options.denied ? null : {id:adminId} },error:null }; } },
    rpc:async(name,args)=>{
      if (name==="is_portfolio_admin") return { data:!options.disallowed,error:null };
      calls.writes.push({name,args});
      if (options.rpcThrow) throw Error("provider detail");
      if (options.rpcError) return { data:null,error:{code:options.rpcError} };
      revision=args.expected_revision+1;
      return { data:options.badData?[]:[{...item(),id:args.media_id,revision}],error:null };
    },
    from:name=>{ calls.reads.push(name); const chain={eq:()=>chain,order:()=>chain,single:async()=>({data:options.readError?null:item(),error:options.readError?Error("private detail"):null}),range:async()=>({data:options.readError?null:[],error:options.readError?Error("private detail"):null})}; return {select:()=>chain}; },
    storage:{from:bucket=>({
      upload:async(path,bytes,settings)=>{ calls.storage.push({operation:"upload",bucket,path,bytes,settings}); return {error:options.storageError?Error("private detail"):null}; },
      remove:async(paths)=>{ calls.storage.push({operation:"remove",bucket,paths}); return {error:options.storageError?Error("private detail"):null}; },
      download:async(path)=>{ calls.storage.push({operation:"download",bucket,path}); return {data:new Blob([options.pdf?pdf:png]),error:options.storageError?Error("private detail"):null}; },
    })},
  };
  globalThis.__mediaTest={client,calls}; return calls;
}
test("all media reads/mutations/downloads authorize before touching storage or metadata",async()=>{
  for (const options of [{denied:true},{disallowed:true}]) for (const operation of [()=>writeMedia(initial,upload()),()=>writeMedia(initial,mutation()),()=>writeMedia(initial,mutation("unpublish")),()=>writeMedia(initial,mutation("delete")),getMediaEditor,()=>GET(new Request("http://localhost/admin/media/test"),{params:Promise.resolve({id})})]) {
    const calls=mock(options); await assert.rejects(operation,error=>error.redirect==="/admin/login?status=denied"); assert.equal(calls.storage.length,0);assert.equal(calls.reads.length,0);assert.equal(calls.writes.length,0);
  }
});

test("public cache follows media approval and revocation including partial removal", async () => {
  for (const intent of ["publish", "unpublish", "delete"]) {
    const calls = mock(); assert.equal((await writeMedia(initial, mutation(intent))).ok, true);
    assert.ok(calls.refresh.includes("/"));
  }
  const calls = mock(); assert.equal((await writeMedia(initial, upload())).ok, true);
  assert.deepEqual(calls.refresh, ["/admin"]);
});
test("unconfigured Supabase fails closed for media entry points",async()=>{
  for (const operation of [()=>writeMedia(initial,upload()),getMediaEditor,()=>GET(new Request("http://localhost"),{params:Promise.resolve({id})})]) {
    const calls=mock();delete process.env.SUPABASE_URL;await assert.rejects(operation,error=>error.redirect==="/admin/login?status=unavailable");assert.equal(calls.auth,0);
  }
});
test("valid image/PDF uploads use generated immutable paths, exact MIME and private draft registration",async()=>{
  for (const purpose of ["photo","cv","screenshot"]) {
    const calls=mock();const result=await writeMedia(initial,upload(purpose));assert.equal(result.ok,true,result.message);assert.equal(calls.storage.length,1);
    const stored=calls.storage[0];assert.match(stored.path,new RegExp(`^${purpose}/[0-9a-f-]{36}\\.${purpose==="cv"?"pdf":"png"}$`));assert.equal(stored.settings.upsert,false);assert.equal(stored.settings.cacheControl,"0");assert.equal(stored.bucket,"portfolio-media");assert.ok(!stored.path.includes("unsafe"));
    assert.equal(calls.writes[0].args.operation,"register");assert.equal(calls.writes[0].args.expected_revision,0);assert.equal(calls.writes[0].args.metadata.draft_project_id,purpose==="screenshot"?id:null);assert.equal(calls.writes[0].args.metadata.published,undefined);
  }
});

test("optional image alt text uploads blank or omitted values and retains meaningful descriptions",async()=>{
  for (const purpose of ["photo","screenshot","cv"]) for (const alt of ["", "   ", undefined, "  Production network topology  "]) {
    const calls=mock(); const form=upload(purpose);
    if (alt === undefined) form.delete("alt_text"); else form.set("alt_text",alt);
    const result=await writeMedia(initial,form);
    assert.equal(result.ok,true,result.message);
    assert.equal(calls.storage.length,1);
    assert.equal(calls.storage[0].settings.upsert,false);
    assert.equal(calls.writes[0].args.operation,"register");
    assert.equal(calls.writes[0].args.metadata.alt_text,(alt ?? "").trim());
    assert.equal(calls.writes[0].args.metadata.draft_project_id,purpose === "screenshot" ? id : null);
  }
});

test("alt input is optional with decorative and meaningful image guidance",async()=>{
  const editor=await source("src/app/admin/media-editor.tsx");
  const input=editor.match(/<input[^>]*name="alt_text"[^>]*\/>/)[0];
  assert.doesNotMatch(input,/required/);
  assert.match(input,/maxLength=\{300\}/);
  assert.match(editor,/Image alternative text \(optional\)/);
  assert.match(editor,/Leave empty for decorative images/);
  assert.match(editor,/For meaningful images/);
});

test("forward alt migration changes only optional alt validation/defaulting in the secured media RPC",async()=>{
  const original=await source("supabase/migrations/202611170004_projects_media.sql");
  const sql=await source("supabase/migrations/202611180007_optional_media_alt.sql");
  const expected=original.slice(original.indexOf("create function public.write_media_editor"))
    .replace("create function public.write_media_editor","create or replace function public.write_media_editor")
    .replace("jsonb_typeof(metadata->'alt_text')",`jsonb_typeof(coalesce(metadata->'alt_text','""'::jsonb))`)
    .replace(" or (role_name<>'cv' and btrim(metadata->>'alt_text')='')","")
    .replace("::bigint,metadata->>'alt_text');","::bigint,coalesce(metadata->>'alt_text',''));");
  assert.equal(sql.slice(sql.indexOf("create or replace function")).replaceAll("\r\n","\n"),expected.replaceAll("\r\n","\n"));
  assert.match(sql,/^begin;/);
  assert.doesNotMatch(sql,/alter table|create policy|security definer/i);
});

test("MIME/extension/signature mismatch, forbidden formats, zero/oversize and truncated files are rejected",async()=>{
  const bad=[new File([png],"test.svg",{type:"image/svg+xml"}),new File([png],"test.jpg",{type:"image/png"}),new File(["<script>alert(1)</script>"],"test.png",{type:"image/png"}),new File([png.subarray(0,25)],"test.png",{type:"image/png"}),new File([png],"test.pdf",{type:"application/pdf"}),new File([new Uint8Array(mediaLimit+1)],"test.png",{type:"image/png"}),new File([],"test.png",{type:"image/png"}),new File([Buffer.from([255,216,255,0,0,0,0,0,0,0,255,217])],"test.jpg",{type:"image/jpeg"})];
  for (const file of bad) await assert.rejects(()=>inspectUpload(file,file.type==="application/pdf"?"cv":"photo"));
  await assert.rejects(()=>inspectUpload(new File([pdf],"test.pdf",{type:"application/pdf"}),"photo"));
  await assert.rejects(()=>inspectUpload(new File([png],"test.png",{type:"image/png"}),"cv"));
});
test("invalid fields, duplicate/file-valued metadata and invalid project targets never upload",async()=>{
  for (const change of [f=>f.append("file",new Blob([png]),"test.png"),f=>f.append("purpose","photo"),f=>f.set("purpose","unknown"),f=>f.append("alt_text","duplicate"),f=>f.set("alt_text","x".repeat(301)),f=>f.set("alt_text","bad\u0000value"),f=>f.set("project_id",id),f=>f.set("purpose","screenshot"),f=>f.set("alt_text",new Blob(["x"])),f=>f.set("file",new File(["spoof"],"test.png",{type:"image/png"}))]) {
    const calls=mock();const form=upload();change(form);assert.equal((await writeMedia(initial,form)).ok,false);assert.equal(calls.storage.length,0);assert.equal(calls.writes.length,0);
  }
  const calls=mock({readError:true});assert.equal((await writeMedia(initial,upload("screenshot"))).ok,false);assert.equal(calls.storage.length,0);
});
test("publication and deletion reject forged identifiers/revisions, intent and missing confirmation",async()=>{
  for (const change of [f=>f.set("id","../../other"),f=>f.append("id",id),f=>f.set("revision","-1"),f=>f.set("revision","1.5"),f=>f.set("revision","0"),f=>f.set("intent","register"),f=>f.delete("confirm_delete")]) {
    const calls=mock();const form=mutation("delete");change(form);assert.equal((await writeMedia(initial,form)).ok,false);assert.equal(calls.storage.length,0);assert.equal(calls.writes.length,0);
  }
});
test("publish/unpublish use submitted revisions and ignore forged previous state",async()=>{
  for(const intent of ["publish","unpublish"]) {const calls=mock();assert.equal((await writeMedia(initial,mutation(intent))).ok,true);assert.deepEqual(calls.writes[0].args,{media_id:id,expected_revision:1,operation:intent,metadata:{}});assert.equal(calls.storage.length,0);}
});
test("delete tombstones before storage removal, uses stored path, then removes metadata",async()=>{
  const calls=mock();const form=mutation("delete");form.set("object_path","attacker/path");assert.equal((await writeMedia(initial,form)).ok,true);
  assert.deepEqual(calls.writes.map(call=>call.args.operation),["begin_delete","delete"]);assert.equal(calls.writes[1].args.expected_revision,2);assert.deepEqual(calls.storage[0].paths,["photo/stored-only.png"]);
  const failed=mock({storageError:true});assert.equal((await writeMedia(initial,mutation("delete"))).ok,false);assert.deepEqual(failed.writes.map(call=>call.args.operation),["begin_delete"]);assert.deepEqual(failed.refresh,["/"]);
});
test("provider/conflict/unconfirmed responses never claim success or delete possibly committed uploads",async()=>{
  for(const options of [{storageError:true},{rpcError:"40001"},{rpcThrow:true},{badData:true}]) {const calls=mock(options);const result=await writeMedia(initial,upload());assert.equal(result.ok,false);assert.equal(calls.refresh.length,0);assert.ok(calls.storage.every(call=>call.operation!=="remove"));assert.ok(!result.message.includes("provider detail"));}
  const calls=mock({rpcError:"40001"});assert.equal((await writeMedia(initial,mutation("delete"))).ok,false);assert.equal(calls.storage.length,0);
  mock({readError:true});assert.equal(await getMediaEditor(),null);
});
test("private previews use no-store/nosniff/sandbox, PDF attachment, stored paths and generic failure",async()=>{
  for(const options of [{},{pdf:true}]) {
    const calls=mock(options);const response=await GET(new Request("http://localhost"),{params:Promise.resolve({id})});assert.equal(response.status,200);assert.match(response.headers.get("Cache-Control"),/private, no-store/);assert.equal(response.headers.get("X-Content-Type-Options"),"nosniff");assert.match(response.headers.get("Content-Security-Policy"),/sandbox/);assert.equal(response.headers.get("Vary"),"Cookie");assert.equal(response.headers.get("Content-Disposition"),options.pdf?'attachment; filename="cv.pdf"':"inline");assert.equal(calls.storage[0].path,"photo/stored-only.png");
  }
  for(const options of [{deleting:true},{readError:true},{storageError:true}]) {mock(options);assert.equal((await GET(new Request("http://localhost"),{params:Promise.resolve({id})})).status,404);}
  const calls=mock();assert.equal((await GET(new Request("http://localhost"),{params:Promise.resolve({id:"../x"})})).status,404);assert.equal(calls.reads.length,0);
});
test("migration preserves private storage and existing drafts while adding constrained project/media lifecycle",async()=>{
  const sql=await source("supabase/migrations/202611170004_projects_media.sql");
  for(const pattern of [/security invoker/gi,/public.is_portfolio_admin\(\)/g,/record_drafts_kind_check/,/foreign key \(project_kind,draft_project_id\)/,/media_single_published/,/pg_advisory_xact_lock/,/Remove project screenshots first/,/File removal pending/,/Publish project first/,/revoke all on function public.write_media_editor/]) assert.match(sql,pattern);
  assert.doesNotMatch(sql,/grant[^;]+to anon|create policy|public\s*=\s*true/i);
});

test("real JPEG and WebP fixtures pass, truncated containers fail", async()=>{
  // Tiny fixtures generated once using the already-installed Next.js image codec.
  const fixtures = {
    jpeg: "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCMAhR5/9k=",
    webp: "UklGRjoAAABXRUJQVlA4IC4AAACwAQCdASoCAAIAAUAmJaACdLoABGaAAP7fgD+4Mz6uxw/++BP/eBP/eBP9tgAA",
  };
  for(const [format,encoded] of Object.entries(fixtures)) {
    const bytes=Buffer.from(encoded,"base64");
    const result=await inspectUpload(new File([bytes],`test.${format}`,{type:`image/${format}`}),"screenshot");
    assert.equal(result.mime,`image/${format}`);
    await assert.rejects(()=>inspectUpload(new File([bytes.subarray(0,bytes.length-4)],`test.${format}`,{type:`image/${format}`}),"screenshot"));
  }
});
