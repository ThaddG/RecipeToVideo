import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){try{return nextResolve(specifier,context);}catch(e){if(specifier.startsWith('.'))return nextResolve(specifier+'.ts',context);throw e;}}});
const {parseRecipe,sampleRecipe}=await import('../lib/recipe.ts');
const {frameSignature,providedFrame,validGeneratedFrame,imagePrompt,motionPrompt,splitScene,validateImageInput}=await import('../lib/storyboard.ts');
const {POST}=await import('../app/api/storyboard/route.ts');
const {POST:video}=await import('../app/api/video/route.ts');
const cookie=parseRecipe(JSON.parse(readFileSync(new URL('./fixtures/pumpkin-cookie-bars.json',import.meta.url),'utf8')));
const request=(body,key='test-key')=>new Request('https://studio.example/api/storyboard',{method:'POST',headers:{'Content-Type':'application/json',...(key?{'x-runway-key':key}:{})},body:JSON.stringify(body)});
const options={action:'create',recipe:cookie,index:0,format:'9:16',style:'Overhead',useImages:true};
test('cookie storyboard identifies seven gaps and keeps the existing final dish',()=>{
 assert.equal(cookie.steps.filter((_,i)=>!providedFrame(cookie,i,true)).length,7);assert.equal(providedFrame(cookie,7,true),cookie.images[0]);assert.equal(providedFrame(cookie,7,false),undefined);
});
test('all actual cookie instructions yield bounded frame and focused motion prompts',()=>{
 for(let i=0;i<cookie.steps.length;i++){const p=imagePrompt(cookie,i,'Overhead');assert.ok(p.length<=1000);assert.match(p,/START/);assert.match(p,/starting frame/);const motion=motionPrompt(cookie,i);assert.ok(motion.length<=1000);assert.match(motion,/Locked-off/);}
 const split=splitScene(cookie.steps[0]);assert.equal(split.length,2);assert.equal(split.map(s=>s.text).join(' '),cookie.steps[0].text);
});
test('image edits, recipe edits, style, and aspect changes make generated frames stale',()=>{
 const signature=frameSignature(cookie,0,'9:16','Overhead');const frame={imageKey:'cached-key',signature};assert.equal(validGeneratedFrame(frame,signature),true);
 for(const changed of [frameSignature(cookie,0,'16:9','Overhead'),frameSignature(cookie,0,'9:16','Rustic'),frameSignature(cookie,0,'9:16','Overhead','Different starting state'),frameSignature({...cookie,steps:cookie.steps.map((s,i)=>i===0?{...s,text:'Different action.'}:s)},0,'9:16','Overhead')])assert.equal(validGeneratedFrame(frame,changed),false);
});
test('rejects unsafe image references and excessive custom directions',()=>{
 for(const input of ['javascript:alert(1)','http://example.com/photo.jpg','https://user:pass@example.com/image.jpg','https://127.0.0.1/image.jpg','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,???'])assert.throws(()=>validateImageInput(input));
 assert.equal(validateImageInput('data:image/jpeg;base64,YWJjZA=='),'data:image/jpeg;base64,YWJjZA==');assert.throws(()=>imagePrompt(cookie,0,'Overhead','a'.repeat(1001)),/1,000/);assert.throws(()=>motionPrompt(cookie,0,'a'.repeat(1001)),/1,000/);
});
test('requires a key before attempting paid image generation',async()=>{assert.equal((await POST(request(options,''))).status,401);});
test('creates an image task with continuity references and correct orientation',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,opts)=>{calls.push({url,opts,body:JSON.parse(opts.body)});return Response.json({id:'image-task-1'});};
 try{const res=await POST(request({...options,previousFrame:'data:image/jpeg;base64,YWJjZA=='}));assert.equal(res.status,200);const call=calls[0];assert.ok(call.url.endsWith('/text_to_image'));assert.equal(call.body.model,'gen4_image');assert.equal(call.body.ratio,'1080:1920');assert.deepEqual(call.body.referenceImages.map(r=>r.tag),['dish','previous']);assert.match(call.body.promptText,/@dish/);assert.match(call.body.promptText,/@previous/);assert.equal(call.opts.headers.Authorization,'Bearer test-key');}finally{global.fetch=original;}
});
test('text-only image generation works when no reference photos exist',async()=>{
 const original=global.fetch;let body;global.fetch=async(_,opts)=>{body=JSON.parse(opts.body);return Response.json({id:'image-task-1'});};try{assert.equal((await POST(request({...options,format:'16:9',recipe:{...cookie,images:[]}}))).status,200);assert.equal(body.ratio,'1920:1080');assert.equal(body.referenceImages,undefined);assert.doesNotMatch(body.promptText,/@dish|@previous/);}finally{global.fetch=original;}
});
test('invalid storyboard settings fail before a provider request',async()=>{assert.equal((await POST(request({...options,index:500}))).status,400);assert.equal((await POST(request({...options,format:'1:1'}))).status,400);});
test('polling an existing image task reuses the task rather than generating a new one',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,opts)=>{calls.push({url,opts});return Response.json({id:'existing-task',status:'SUCCEEDED',output:['https://cdn.example.com/frame.png']});};try{const res=await POST(request({action:'status',id:'existing-task'}));assert.equal(res.status,200);assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/tasks/existing-task'));assert.equal(calls[0].opts.method,undefined);}finally{global.fetch=original;}
});
test('image downloads use provider task output and never send the key to the CDN',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,opts)=>{calls.push({url,opts});return calls.length===1?Response.json({status:'SUCCEEDED',output:['https://cdn.example.com/frame.png']}):new Response('image bytes',{headers:{'Content-Type':'image/png'}});};try{const res=await POST(request({action:'media',id:'existing-task'}));assert.equal(res.status,200);assert.equal(res.headers.get('Content-Type'),'image/png');assert.equal(await res.text(),'image bytes');assert.equal(calls[1].opts.headers,undefined);}finally{global.fetch=original;}
});
test('image errors remain actionable and never pretend that a frame succeeded',async()=>{
 const original=global.fetch;global.fetch=async()=>Response.json({error:'Not enough image credits'},{status:402});try{const res=await POST(request(options));assert.equal(res.status,402);assert.match((await res.json()).error,/credits/);}finally{global.fetch=original;}
});
test('reviewed storyboard frames force image-to-video with a separate motion prompt',async()=>{
 const original=global.fetch;let url,body;global.fetch=async(u,opts)=>{url=u;body=JSON.parse(opts.body);return Response.json({id:'video-task'});};try{const res=await video(request({action:'create',recipe:sampleRecipe,index:0,format:'9:16',style:'Cinematic',duration:5,useImages:false,storyboardRequired:true,storyboardImage:'data:image/jpeg;base64,YWJjZA==',motionPrompt:'A spoon slowly stirs the mixture. Locked camera.'}));assert.equal(res.status,200);assert.ok(url.endsWith('/image_to_video'));assert.equal(body.promptImage,'data:image/jpeg;base64,YWJjZA==');assert.equal(body.promptText,'A spoon slowly stirs the mixture. Locked camera.');}finally{global.fetch=original;}
});
test('storyboard video requests without a frame cannot fall back to ungrounded text generation',async()=>{
 const res=await video(request({action:'create',recipe:sampleRecipe,index:0,format:'9:16',style:'Cinematic',duration:5,useImages:false,storyboardRequired:true}));assert.equal(res.status,400);assert.match((await res.json()).error,/storyboard image/);
});
