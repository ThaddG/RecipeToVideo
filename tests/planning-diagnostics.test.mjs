import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))return n(s+'.ts',c);throw e}}});
const {diagnosePlanning,planningDiagnosis}=await import('../lib/planning-diagnostics.ts');
const {POST}=await import('../app/api/plan/check/route.ts');
test('diagnostics compare existing Google interfaces with small capped requests and no recipe or alternate service',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push({url,headers:options.headers,body:JSON.parse(options.body)});return Response.json({error:{status:'UNAVAILABLE',message:'High demand'}},{status:503});};
 try{
  const results=await diagnosePlanning('diagnostic-key');assert.equal(calls.length,4);assert.equal(results.length,4);
  assert.ok(calls.every(c=>c.url.startsWith('https://generativelanguage.googleapis.com/')));
  assert.equal(calls[0].headers['Api-Revision'],'2026-05-20');assert.equal(calls[3].headers['Api-Revision'],undefined);
  assert.ok(calls[2].url.endsWith(':generateContent'));assert.equal(calls[2].body.generationConfig.maxOutputTokens,256);
  for(const i of [0,1,3]){assert.equal(calls[i].body.generation_config.max_output_tokens,256);assert.equal(calls[i].body.input,'Reply with the word OK.');assert.equal(calls[i].body.response_format,undefined);assert.equal(calls[i].body.store,false);}
  assert.match(planningDiagnosis(results),/recipe and shot-plan schema are not required/);assert.match(planningDiagnosis(results),/cannot distinguish/);
 }finally{global.fetch=original;}
});
for(const status of [401,403,429])test(`diagnostics stop after ${status} rather than burning further quota`,async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return Response.json({error:{status:status===429?'RESOURCE_EXHAUSTED':'PERMISSION_DENIED'}},{status});};
 try{const results=await diagnosePlanning('key');assert.equal(calls,1);assert.equal(results[0].status,status);assert.match(planningDiagnosis(results),status===429?/quota/:/permission/);}finally{global.fetch=original;}
});
test('diagnostics distinguish an accepted compatibility call and redact keys from provider responses',async()=>{
 const original=global.fetch;let calls=0;const key='AIzaPrivateTestKey';global.fetch=async()=>{calls++;return calls===3?Response.json({candidates:[{content:{parts:[{text:'OK'}]}}]}):Response.json({error:{status:'UNAVAILABLE',message:`key=${key}; unrelated AIzaOtherPrivateKey`}},{status:503,headers:{'x-request-id':key}});};
 try{const results=await diagnosePlanning(key);assert.match(planningDiagnosis(results),/compatibility interface accepted/);assert.ok(!JSON.stringify(results).includes(key));assert.ok(!JSON.stringify(results).includes('AIzaOtherPrivateKey'));}finally{global.fetch=original;}
});
test('diagnostic endpoint requires the planning key without submitting inference',async()=>{
 assert.equal((await POST(new Request('https://studio.test/api/plan/check',{method:'POST'}))).status,401);
});
test('timeouts remain inconclusive and never trigger a retry of the same request',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw new DOMException('Timeout','TimeoutError');};
 try{const results=await diagnosePlanning('key');assert.equal(calls,4);assert.ok(results.every(r=>r.status===0));assert.match(planningDiagnosis(results),/inconclusive/);}finally{global.fetch=original;}
});
