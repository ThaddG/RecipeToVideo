import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){try{return nextResolve(specifier,context);}catch(e){if(specifier.startsWith('.'))return nextResolve(specifier+'.ts',context);throw e;}}});
const {POST}=await import('../app/api/video/route.ts');
const {sampleRecipe}=await import('../lib/recipe.ts');
const request=(body,key='test-key')=>new Request('https://studio.test/api/video',{method:'POST',headers:{'Content-Type':'application/json',...(key?{'x-runway-key':key}:{})},body:JSON.stringify(body)});
test('rejects missing credentials without contacting provider',async()=>{const res=await POST(request({action:'create'},''));assert.equal(res.status,401);});
test('creates text and image jobs with supported dimensions and faithful prompts',async()=>{const original=global.fetch;const calls=[];global.fetch=async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body),headers:opts.headers});return Response.json({id:'task-123'});};try{const opts={action:'create',recipe:sampleRecipe,format:'9:16',style:'Cinematic',duration:5,useImages:true};assert.equal((await POST(request({...opts,index:0}))).status,200);assert.equal((await POST(request({...opts,index:3}))).status,200);assert.ok(calls[0].url.endsWith('/text_to_video'));assert.ok(calls[1].url.endsWith('/image_to_video'));assert.equal(calls[1].body.promptImage,sampleRecipe.images[0]);assert.equal(calls[0].body.ratio,'720:1280');assert.ok(calls[0].body.promptText.includes(sampleRecipe.steps[0].text));assert.equal(calls[0].headers.Authorization,'Bearer test-key');}finally{global.fetch=original;}});
test('validates generation settings before spending credits',async()=>{const res=await POST(request({action:'create',recipe:sampleRecipe,index:0,format:'1:1',style:'Cinematic',duration:5}));assert.equal(res.status,400);});
test('returns provider failures for actionable UI handling',async()=>{const original=global.fetch;global.fetch=async()=>Response.json({error:'Not enough credits'},{status:402});try{const res=await POST(request({action:'status',id:'task-123'}));assert.equal(res.status,402);assert.equal((await res.json()).error,'Not enough credits');}finally{global.fetch=original;}});
test('retrieves media by task ID and never forwards key to media host',async()=>{const original=global.fetch;const calls=[];global.fetch=async(url,opts)=>{calls.push({url,opts});return calls.length===1?Response.json({status:'SUCCEEDED',output:['https://cdn.example.com/video.mp4']}):new Response('video',{headers:{'Content-Type':'video/mp4'}});};try{const res=await POST(request({action:'media',id:'task-123'}));assert.equal(res.status,200);assert.equal(await res.text(),'video');assert.equal(calls[1].opts.headers,undefined);}finally{global.fetch=original;}});

test('upstream connection interruptions are retryable gateway errors',async()=>{const original=global.fetch;global.fetch=async()=>{throw new TypeError('Network interrupted');};try{const res=await POST(request({action:'status',id:'task-123'}));assert.equal(res.status,502);}finally{global.fetch=original;}});
test('rate-limit retry advice is preserved for safe status polling',async()=>{const original=global.fetch;global.fetch=async()=>Response.json({error:'Busy'},{status:429,headers:{'Retry-After':'9'}});try{const res=await POST(request({action:'status',id:'task-123'}));assert.equal(res.status,429);assert.equal(res.headers.get('retry-after'),'9');}finally{global.fetch=original;}});
test('a completed task returning an image cannot masquerade as video',async()=>{const original=global.fetch;let count=0;global.fetch=async()=>++count===1?Response.json({status:'SUCCEEDED',output:['https://cdn.example.com/not-video.jpg']}):new Response('image',{headers:{'Content-Type':'image/jpeg'}});try{const res=await POST(request({action:'media',id:'task-123'}));assert.equal(res.status,502);assert.match((await res.json()).error,/invalid video file/);}finally{global.fetch=original;}});

test('Grok Lite uses the existing Runway key, exact short durations and automatic 720p image framing',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body),headers:opts.headers});return Response.json({id:'grok-task'});};
 try{for(const duration of [1,2,3,5,15]){
  const response=await POST(request({action:'create',model:'grok',recipe:sampleRecipe,index:0,format:'9:16',style:'Cinematic',duration,storyboardRequired:true,storyboardImage:'https://example.com/frame.jpg',motionPrompt:'The spoon stirs in one circle.'}));
  assert.equal(response.status,200);assert.equal((await response.json()).duration,duration);
  const call=calls.at(-1);assert.ok(call.url.endsWith('/image_to_video'));assert.equal(call.body.model,'grok_imagine_1_5_lite');assert.equal(call.body.ratio,'auto_720p');assert.equal(call.body.duration,duration);assert.equal(call.body.promptImage,'https://example.com/frame.jpg');assert.equal(call.headers.Authorization,'Bearer test-key');assert.equal(call.body.promptText,'The spoon stirs in one circle.');
 }
 const before=calls.length;
 for(const extra of [{duration:0},{duration:16},{duration:2.5},{duration:'3'},{endFrame:'https://example.com/end.jpg'}]){
  const response=await POST(request({action:'create',model:'grok',recipe:sampleRecipe,index:0,format:'9:16',style:'Cinematic',duration:3,...extra}));assert.equal(response.status,400);
 }
 assert.equal(calls.length,before);
 }finally{global.fetch=original;}
});
test('Grok text-to-video uses explicit 720p dimensions; legacy generation and task retrieval retain their routes',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,opts)=>{calls.push({url,body:opts.body?JSON.parse(opts.body):undefined});return Response.json({id:'task',status:'PENDING'});};
 try{const options={action:'create',recipe:sampleRecipe,index:0,format:'16:9',style:'Cinematic',duration:3,useImages:false};
 assert.equal((await POST(request({...options,model:'grok'}))).status,200);assert.equal(calls.at(-1).body.ratio,'1280:720');assert.ok(calls.at(-1).url.endsWith('/text_to_video'));
 assert.equal((await POST(request({...options,model:'runway'}))).status,200);assert.equal(calls.at(-1).body.model,'gen4.5');
 for(const model of ['grok','runway']){assert.equal((await POST(request({action:'status',model,id:'saved-task'}))).status,200);assert.ok(calls.at(-1).url.endsWith('/tasks/saved-task'));assert.equal(calls.at(-1).body,undefined);}
 }finally{global.fetch=original;}
});
test('new and previous-default projects switch to Grok without changing reservations or persisted task models',async()=>{
 const {defaultGenerationSettings,safeSettings}=await import('../lib/generation-settings.ts');
 assert.equal(defaultGenerationSettings().videoModel,'grok');assert.equal(defaultGenerationSettings().imageModel,'nano');
 const spent=[{id:'existing',kind:'video',usd:.6}],saved={videoModel:'runway',imageModel:'nano',limit:8,spent},job={id:'old-task',model:'runway',duration:5,status:'SUCCEEDED'};
 const result=safeSettings(saved);assert.equal(result.videoModel,'grok');assert.equal(result.limit,8);assert.deepEqual(result.spent,spent);assert.equal(saved.videoModel,'runway');assert.equal(job.model,'runway');
 assert.deepEqual(safeSettings(result),result);assert.equal(safeSettings({videoModel:'minimax'}).videoModel,'minimax');assert.equal(safeSettings({videoModel:'runway',videoDefaultsVersion:2}).videoModel,'runway');
 const {videoEstimate,providerDuration}=await import('../lib/shot-timing.ts');const {videoModels}=await import('../lib/generation-settings.ts');const model=videoModels.grok;
 assert.ok(Math.abs(videoEstimate(Array(10).fill(3),Array.from({length:10},(_,i)=>i),model.perSecond,model.perShot)-1)<1e-9);
 assert.ok(Math.abs(videoEstimate([3,5],[1],model.perSecond,model.perShot)-.16)<1e-9);assert.equal(providerDuration('grok',2),2);
});
