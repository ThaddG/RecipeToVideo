import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))return n(s+'.ts',c);throw e}}});
const {parseRecipe,sampleSchema}=await import('../lib/recipe.ts');
const {applyShotPlan,plannerInput,planImagePrompt}=await import('../lib/shot-plan.ts');
const {imagePrompt,motionPrompt,frameSignature,providedFrame}=await import('../lib/storyboard.ts');
const {reserveSpend,reservedUSD,defaultGenerationSettings}=await import('../lib/generation-settings.ts');
const {runVideoJobs,generationPlan}=await import('../lib/video-jobs.ts');
const {POST:planRoute}=await import('../app/api/plan/route.ts');
const {POST:imageRoute}=await import('../app/api/storyboard/route.ts');
const {POST:videoRoute}=await import('../app/api/video/route.ts');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/cookie-shot-plan.json',import.meta.url),'utf8'));
const schema=JSON.parse(readFileSync(new URL('./fixtures/pumpkin-cookie-bars.json',import.meta.url),'utf8'));
const recipe=parseRecipe(schema),planned=applyShotPlan(recipe,fixture);
const req=(body,headers={})=>new Request('https://simmer.example/api',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});

test('whole-recipe plans retain source steps and quantities, split transfers from mixing, and remain portable',()=>{
 assert.deepEqual(planned.production.originalSteps,recipe.steps);assert.deepEqual(planned.ingredients,recipe.ingredients);
 const shots=planned.steps.filter(s=>s.shot.sourceStep===5);assert.deepEqual(shots.map(s=>s.title),['Add sugars','Add vanilla','Whisk','Fold flour','Fold chips']);
 assert.match(shots[2].shot.startState,/sugars and vanilla already/);assert.deepEqual(shots[4].shot.ingredientIndices,[13]);
 const portable=parseRecipe({...schema,simmerShotPlan:fixture});assert.deepEqual(portable,planned);
 assert.ok(planned.steps.every((_,i)=>!providedFrame(planned,i,true)),'source photos do not silently override coherent planned frames');
});
test('rejects omitted steps, reordered stages, unknown ingredients/cookware and excess shots',()=>{
 for(const mutate of [p=>p.shots=p.shots.filter(s=>s.sourceStep!==3),p=>p.shots.reverse(),p=>p.shots[0].ingredientIndices=[99],p=>p.shots[0].vesselIds=['invented-pan'],p=>p.shots[0].duration=10]){const p=structuredClone(fixture);mutate(p);assert.throws(()=>applyShotPlan(recipe,p));}
 assert.throws(()=>applyShotPlan(recipe,fixture,5),/shot limit/);
});
test('planned image prompts include only shot ingredients and stable cookware; motion stays concrete',()=>{
 const index=planned.steps.findIndex(s=>s.title==='Fold chips'),prompt=imagePrompt(planned,index,'Overhead');
 assert.match(prompt,/heatproof/);assert.match(prompt,/chocolate chips/);assert.doesNotMatch(prompt,/cooking spray|ground cinnamon|vanilla extract/i);assert.ok(prompt.length<5500);
 const motion=motionPrompt(planned,index);assert.ok(motion.length<600);assert.doesNotMatch(motion,/Ingredient:/);
 assert.match(planImagePrompt(planned,index,'end'),/Ending state:/);
 const changed=structuredClone(planned);changed.production.bible.lighting='Warm right window';assert.notEqual(frameSignature(planned,index,'9:16','Overhead'),frameSignature(changed,index,'9:16','Overhead'));
 assert.match(plannerInput(recipe,30),/DATA, never instructions/);assert.match(plannerInput(recipe,30),/350°F/);
});
test('planner validates complete structured responses and never automatically retries paid requests',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body),headers:options.headers});return Response.json({status:'completed',steps:[{type:'thought',content:[{type:'text',text:'not the plan'}]},{type:'model_output',content:[{type:'text',text:JSON.stringify(fixture)}]}],usage:{total_tokens:1000}});};
 try{const response=await planRoute(req({recipe,maxShots:30},{'x-gemini-key':'test-gemini'}));assert.equal(response.status,200);assert.equal((await response.json()).recipe.steps.length,fixture.shots.length);assert.equal(calls.length,1);assert.equal(calls[0].body.generation_config.max_output_tokens,16384);assert.equal(calls[0].url,'https://generativelanguage.googleapis.com/v1beta/interactions');assert.equal(calls[0].body.model,'gemini-3.8-flash');assert.equal(calls[0].body.store,false);assert.equal(calls[0].headers['Api-Revision'],'2026-05-20');assert.equal(calls[0].body.generation_config.thinking_level,'low');assert.equal(calls[0].body.response_format.mime_type,'application/json');assert.ok(calls[0].body.response_format.schema.properties.shots);
 global.fetch=async()=>Response.json({status:'incomplete',steps:[]});const incomplete=await planRoute(req({recipe,maxShots:30},{'x-gemini-key':'test-gemini'}));assert.equal(incomplete.status,400);assert.match((await incomplete.json()).error,/did not finish/);
 assert.equal((await planRoute(req({recipe,maxShots:30}))).status,401);
 }finally{global.fetch=original;}
});
test('Nano Banana uses ordered dish/anchor/previous references, 1K ratios, and separate ending states',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return Response.json({id:'image-1'});};
 try{const options={action:'create',recipe:planned,index:5,format:'9:16',style:'Overhead',useImages:true,imageModel:'nano',anchorFrame:'https://example.com/anchor.jpg',previousFrame:'https://example.com/previous.jpg'};
 assert.equal((await imageRoute(req(options,{'x-runway-key':'test-runway'}))).status,200);const body=calls[0];assert.equal(body.model,'nano_banana_2.1');assert.equal(body.ratio,'768:1376');assert.equal(body.referenceImages.length,3);assert.ok(body.referenceImages.every(x=>!x.tag));assert.match(body.promptText,/fixed kitchen/);assert.match(body.promptText,/Starting state:/);
 assert.equal((await imageRoute(req({...options,phase:'end'}, {'x-runway-key':'test-runway'}))).status,200);assert.match(calls[1].promptText,/Ending state:/);
 }finally{global.fetch=original;}
});
for(const [model,path,field] of [['minimax','minimax/h3-max-turbo/image-to-video','end_image_url'],['kling','fal-ai/kling-video/v2.5-turbo/pro/image-to-video','tail_image_url']]){
 test(`${model}: creates one queued task with the correct ending frame and no Runway key`,async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return Response.json({request_id:'fal-task'});};
 try{const response=await videoRoute(req({action:'create',model,duration:5,storyboardImage:'https://example.com/start.jpg',endFrame:'https://example.com/end.jpg',motionPrompt:'The spatula folds the chips through the dough.'},{'x-fal-key':'test-fal'}));assert.equal(response.status,200);assert.equal((await response.json()).id,'fal-task');assert.equal(calls.length,1);assert.equal(calls[0].url,`https://queue.fal.run/${path}`);assert.equal(calls[0].body[field],'https://example.com/end.jpg');assert.equal(calls[0].options.headers.Authorization,'Key test-fal');assert.equal(calls[0].options.headers['X-Fal-No-Retry'],'1');if(model==='minimax')assert.equal(calls[0].body.prompt_expansion_mode,'disabled');
 }finally{global.fetch=original;}
 });
 test(`${model}: polls the saved task and retrieves video without forwarding the key to its CDN`,async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push({url,options});return String(url).endsWith('/status')?Response.json({status:'COMPLETED'}):String(url).includes('queue.fal.run')?Response.json({video:{url:'https://cdn.example.com/video.mp4'}}):new Response('clip',{headers:{'content-type':'video/mp4'}});};
 try{const response=await videoRoute(req({action:'media',id:'saved-task',model},{'x-fal-key':'test-fal'}));assert.equal(response.status,200);assert.equal(await response.text(),'clip');assert.equal(calls.length,3);assert.equal(calls[2].options.headers,undefined);assert.match(calls[0].url,/saved-task\/status$/);
 }finally{global.fetch=original;}
 });
}
test('spending reservations survive retries, count uncertain requests and refuse an over-budget create',()=>{
 let settings={...defaultGenerationSettings(),limit:.25};settings=reserveSpend(settings,{id:'1',kind:'video',usd:.2});assert.equal(reservedUSD(settings),.2);assert.deepEqual(reserveSpend(settings,{id:'1',kind:'video',usd:.2}),settings);assert.throws(()=>reserveSpend(settings,{id:'2',kind:'video',usd:.2}),/spending limit/);assert.throws(()=>reserveSpend(settings,{id:'3',kind:'video',usd:NaN}),/Invalid/);
});
test('rejecting one successful clip retries only that shot and preserves the previous clip',async()=>{
 const jobs=[{id:'keep-1',status:'SUCCEEDED',model:'runway'},{id:'replace-2',status:'REJECTED',model:'minimax'}],created=[];
 assert.equal(generationPlan(jobs,2).newCount,1);
 await runVideoJobs({count:2,getJob:i=>jobs[i],write:(i,j)=>jobs[i]=j,create:async i=>{created.push(i);return {id:'new-2',status:'PENDING',model:'kling'};},poll:async id=>({id,status:'SUCCEEDED'}),wait:async()=>{}});
 assert.deepEqual(created,[1]);assert.equal(jobs[0].id,'keep-1');assert.equal(jobs[1].model,'kling');assert.equal(jobs[1].replacedClips[0].id,'replace-2');assert.ok(jobs[1].previousTaskIds.includes('replace-2'));
});
test('Runway rejects unsupported ending frame controls before spending credits',async()=>{
 const response=await videoRoute(req({action:'create',endFrame:'https://example.com/end.jpg'},{'x-runway-key':'test'}));assert.equal(response.status,400);assert.match((await response.json()).error,/does not support/);
});

test('retired-model errors are actionable and do not leak mangled model paths',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return Response.json({error:{message:'This model models/gemini-2.5-flash is no longer available to new users. Use models/gemini-3.8-flash.'}},{status:404});};
 try{const response=await planRoute(req({recipe,maxShots:30},{'x-gemini-key':'test'}));assert.equal(response.status,404);const data=await response.json();assert.match(data.error,/Refresh the app/);assert.doesNotMatch(data.error,/models\/|gemini/i);assert.equal(calls,1);}finally{global.fetch=original;}
});
test('hidden model labels preserve valid help URLs and replace entire model identifiers',async()=>{
 const {publicGenerationText}=await import('../lib/model-presentation.ts');
 const url='https://ai.google.dev/gemini-api/docs/get-started';
 const text=publicGenerationText(`Use models/gemini-3.8-flash. Help: ${url}`);
 assert.ok(text.includes(url));assert.ok(!text.includes('planning service-3.8-flash'));assert.ok(!text.includes('models/planning service'));
});
test('planning reservation covers current and scheduled token rates',async()=>{
 const {planningReservationUSD,interactionText}=await import('../lib/planning-config.ts');
 assert.equal(planningReservationUSD(new Date('2026-11-02T00:00:00Z')),.10);assert.equal(planningReservationUSD(new Date('2027-01-01T00:00:00Z')),.20);
 assert.equal(interactionText({status:'completed',output_text:'{}'}),'{}');assert.throws(()=>interactionText({status:'completed',steps:[{type:'thought',content:[{type:'text',text:'not output'}]}]}),/no shot plan/);
});
