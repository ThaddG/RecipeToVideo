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
 try{const response=await planRoute(req({planner:'standard',recipe,maxShots:30},{'x-gemini-key':'test-gemini'}));assert.equal(response.status,200);assert.equal((await response.json()).recipe.steps.length,fixture.shots.length);assert.equal(calls.length,1);assert.equal(calls[0].body.generation_config.max_output_tokens,16384);assert.equal(calls[0].url,'https://generativelanguage.googleapis.com/v1beta/interactions');assert.equal(calls[0].body.model,'gemini-3.8-flash');assert.equal(calls[0].body.store,false);assert.equal(calls[0].headers['Api-Revision'],'2026-05-20');assert.equal(calls[0].body.generation_config.thinking_level,'low');assert.equal(calls[0].body.response_format.mime_type,'application/json');assert.ok(calls[0].body.response_format.schema.properties.shots);
 global.fetch=async()=>Response.json({status:'incomplete',steps:[]});const incomplete=await planRoute(req({planner:'standard',recipe,maxShots:30},{'x-gemini-key':'test-gemini'}));assert.equal(incomplete.status,400);assert.match((await incomplete.json()).error,/did not finish/);
 assert.equal((await planRoute(req({planner:'standard',recipe,maxShots:30}))).status,401);
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
 try{const response=await planRoute(req({planner:'standard',recipe,maxShots:30},{'x-gemini-key':'test'}));assert.equal(response.status,404);const data=await response.json();assert.match(data.error,/Refresh the app/);assert.doesNotMatch(data.error,/models\/|gemini/i);assert.equal(calls,1);}finally{global.fetch=original;}
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

test('variable shot durations survive planning and portable recipe export, with a strict total budget',()=>{
 const plan=structuredClone(fixture);plan.shots.forEach((shot,i)=>shot.duration=[2,3,4,5][i%4]);
 const seconds=plan.shots.reduce((sum,s)=>sum+s.duration,0);
 const applied=applyShotPlan(recipe,plan,30,seconds);
 assert.deepEqual(applied.steps.map(s=>s.shot.duration),plan.shots.map(s=>s.duration));
 assert.deepEqual(parseRecipe({...schema,simmerShotPlan:plan}).steps.map(s=>s.shot.duration),plan.shots.map(s=>s.duration));
 assert.throws(()=>applyShotPlan(recipe,plan,30,seconds-1),/duration budget/);
 for(const duration of [1,2.5,6,NaN,'3']){const bad=structuredClone(plan);bad.shots[0].duration=duration;assert.throws(()=>applyShotPlan(recipe,bad),/duration/);}
 assert.match(plannerInput(recipe,15,30),/totaling at most 30 seconds/);
});
test('short video durations reach the providers unchanged; unsupported lengths never create a task',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return Response.json(String(url).includes('fal.run')?{request_id:'short-task'}:{id:'short-task'});};
 try{
  for(const model of ['runway','minimax'])for(const duration of [2,3,4]){
   const response=await videoRoute(req({action:'create',model,recipe,index:0,format:'9:16',style:'Overhead',duration,storyboardImage:'https://example.com/start.jpg',motionPrompt:'The spoon moves in one circle.'},{'x-runway-key':'test','x-fal-key':'test'}));
   assert.equal(response.status,200);assert.equal((await response.json()).duration,duration);assert.equal(calls.at(-1).duration,duration);
  }
  const count=calls.length;
  for(const [model,duration] of [['runway',1],['runway',2.5],['minimax',1],['kling',3]])assert.notEqual((await videoRoute(req({action:'create',model,recipe,index:0,format:'9:16',style:'Overhead',duration,storyboardImage:'https://example.com/start.jpg',motionPrompt:'Stir.'},{'x-runway-key':'test','x-fal-key':'test'}))).status,200);
  assert.equal(calls.length,count);
 }finally{global.fetch=original;}
});
test('timelines and selective-retry costs use actual per-shot lengths and preserve saved task durations',async()=>{
 const {timelineSeconds,videoEstimate,providerDuration}=await import('../lib/shot-timing.ts');
 const r={...planned,steps:planned.steps.slice(0,3).map((s,i)=>({...s,shot:{...s.shot,duration:[2,3,5][i]}}))};
 assert.deepEqual(timelineSeconds(r,5,'runway'),[2,3,5]);
 assert.equal(videoEstimate(timelineSeconds(r,5,'runway'),[0,2],.12),.84);
 assert.deepEqual(timelineSeconds(r,5,'kling'),[5,5,5]);assert.equal(providerDuration('kling',6),10);
 assert.deepEqual(timelineSeconds(r,5,'minimax',[{id:'saved',status:'SUCCEEDED',duration:5}]),[5,3,5]);
 const jobs=[{id:'keep',status:'SUCCEEDED',duration:5},undefined];
 await runVideoJobs({count:2,getJob:i=>jobs[i],write:(i,j)=>jobs[i]=j,create:async()=>({id:'new',status:'PENDING',duration:2}),poll:async()=>({id:'new',status:'SUCCEEDED'}),wait:async()=>{}});
 assert.equal(jobs[0].duration,5);assert.equal(jobs[1].duration,2);
});

test('changing only shot timing keeps existing storyboard images reusable',()=>{
 const original=frameSignature(planned,0,'9:16','Overhead');
 const changed=structuredClone(planned);changed.steps[0].shot.duration=2;
 assert.equal(frameSignature(changed,0,'9:16','Overhead'),original);
 changed.steps[0].shot.startState='A visibly different food state';
 assert.notEqual(frameSignature(changed,0,'9:16','Overhead'),original);
});

test('a capacity rejection exposes an alternative without automatic retries or changing the recipe',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return Response.json({error:{message:'This model is currently experiencing high demand.'}},{status:503});};
 const before=JSON.stringify(recipe);
 try{
  const response=await planRoute(req({planner:'standard',recipe,maxShots:30,targetSeconds:45},{'x-gemini-key':'test'}));
  assert.equal(response.status,503);const data=await response.json();assert.equal(data.code,'PLANNER_UNAVAILABLE');assert.match(data.error,/Planning connection diagnostics/);assert.doesNotMatch(data.error,/gemini/i);assert.equal(calls.length,1);assert.equal(JSON.stringify(recipe),before);
 }finally{global.fetch=original;}
});
test('explicit alternative planning uses the same connection and validates the entire plan and timing budget',async()=>{
 const original=global.fetch,calls=[],shortPlan=structuredClone(fixture);shortPlan.shots.forEach(s=>s.duration=2);
 global.fetch=async(url,options)=>{calls.push({url,headers:options.headers,body:JSON.parse(options.body)});return Response.json({status:'completed',output_text:JSON.stringify(shortPlan)});};
 try{
  const response=await planRoute(req({planner:'alternative',recipe,maxShots:30,targetSeconds:45},{'x-gemini-key':'same-connection'}));
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.model,'gemini-3.1-flash-lite');assert.equal(data.recipe.steps.reduce((n,s)=>n+s.shot.duration,0),44);
  assert.equal(calls.length,1);assert.equal(calls[0].headers['x-goog-api-key'],'same-connection');assert.equal(calls[0].body.model,'gemini-3.1-flash-lite');assert.equal(calls[0].body.generation_config.max_output_tokens,16384);assert.equal(calls[0].body.generation_config.temperature,undefined);
  assert.equal((await planRoute(req({planner:'alternative',recipe,maxShots:30,targetSeconds:30},{'x-gemini-key':'same-connection'}))).status,400);
  const count=calls.length;assert.equal((await planRoute(req({planner:'arbitrary-model',recipe,maxShots:30},{'x-gemini-key':'test'}))).status,400);assert.equal(calls.length,count);
  const {plannerReservation}=await import('../lib/planning-config.ts');assert.equal(plannerReservation('alternative'),.04);
 }finally{global.fetch=original;}
});

test('bridge planning preserves assigned process photos and hero exactly once, and refuses dropped or duplicated anchors',async()=>{
 const {photoAnchors}=await import('../lib/shot-plan.ts');
 const source=structuredClone(recipe);source.steps[0].image='https://example.com/process.jpg';source.steps[0].imageMatch='Prepared ingredients in saucepan';
 const anchors=photoAnchors(source),plan=structuredClone(fixture);plan.shots.forEach(s=>s.sourcePhotoId='');
 for(const anchor of anchors){const matches=plan.shots.filter(s=>s.sourceStep===anchor.sourceStep);matches.at(-1).sourcePhotoId=anchor.id;}
 const result=applyShotPlan(source,plan);
 assert.deepEqual(result.steps.filter(s=>s.image).map(s=>s.image),anchors.map(a=>a.url));
 assert.equal(result.production.continuityVersion,2);assert.deepEqual(result.production.originalSteps,source.steps);
 const text=plannerInput(source,30);assert.ok(text.includes('https://example.com/process.jpg'));assert.match(text,/BRIDGES GAPS/);assert.match(text,/already completed/i);
 const dropped=structuredClone(plan);dropped.shots.find(s=>s.sourcePhotoId).sourcePhotoId='';assert.throws(()=>applyShotPlan(source,dropped),/omitted an existing photo/);
 const duplicate=structuredClone(plan);const anchor=anchors[0],indices=duplicate.shots.flatMap((s,i)=>s.sourceStep===anchor.sourceStep?[i]:[]);duplicate.shots[indices[0]].sourcePhotoId=anchor.id;assert.throws(()=>applyShotPlan(source,duplicate),/duplicated/);
 const invented=structuredClone(plan);invented.shots[0].sourcePhotoId='made-up';assert.throws(()=>applyShotPlan(source,invented),/source photo/);
});
test('food state handoffs follow the current vessel across intervening scenes and invalidate dependent new frames',async()=>{
 const {foodStateContext}=await import('../lib/shot-plan.ts');
 const r=structuredClone(planned);r.production.continuityVersion=2;
 r.steps=r.steps.slice(0,4);r.steps.forEach(s=>{s.shot.vesselIds=['pot'];s.shot.toolIds=[];});
 r.steps[0].shot.endState='Milk already fills the saucepan to 2 cm.';
 r.steps[1].shot.vesselIds=['bowl'];r.steps[1].shot.endState='Egg yolks in the bowl.';
 r.steps[2].shot.startState='Cream jug poised above the saucepan containing the milk.';
 assert.match(foodStateContext(r,2),/Milk already fills/);assert.match(foodStateContext(r,2),/Egg yolks/);
 const prompt=planImagePrompt(r,2);assert.match(prompt,/ALREADY completed/);assert.match(prompt,/BEFORE the action/);
 assert.match(imagePrompt(r,2,'Overhead','Close crop.'),/Milk already fills/);
 const signature=frameSignature(r,2,'9:16','Overhead');r.steps[0].shot.endState='Milk fills the saucepan to 4 cm.';assert.notEqual(frameSignature(r,2,'9:16','Overhead'),signature);
 const timing=frameSignature(r,2,'9:16','Overhead');r.steps[0].shot.duration=2;assert.equal(frameSignature(r,2,'9:16','Overhead'),timing);
});
test('image requests distinguish previous starting setups from completed ending frames without extra paid requests',async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return Response.json({id:'image-handoff'});};
 try{const options={action:'create',recipe:planned,index:2,format:'9:16',style:'Overhead',useImages:true,imageModel:'nano',previousFrame:'https://example.com/previous.jpg'};
 assert.equal((await imageRoute(req(options,{'x-runway-key':'test'}))).status,200);assert.match(calls[0].promptText,/START image, NOT its result/);
 assert.equal((await imageRoute(req({...options,previousFramePhase:'end'},{'x-runway-key':'test'}))).status,200);assert.match(calls[1].promptText,/END image; its action has completed/);
 assert.equal(calls.length,2);
 }finally{global.fetch=original;}
});
