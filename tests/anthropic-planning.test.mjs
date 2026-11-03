import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))return n(s+'.ts',c);throw e}}});
const {POST}=await import('../app/api/plan/route.ts');
const {parseRecipe}=await import('../lib/recipe.ts');
const {plannerReservation}=await import('../lib/planning-config.ts');
const recipe=parseRecipe(JSON.parse(readFileSync(new URL('./fixtures/pumpkin-cookie-bars.json',import.meta.url))));
const plan=JSON.parse(readFileSync(new URL('./fixtures/cookie-shot-plan.json',import.meta.url)));plan.shots.forEach(s=>s.duration=2);
const req=(body,headers={})=>new Request('https://studio.test/api/plan',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({recipe,maxShots:30,targetSeconds:45,...body})});
for(const [planner,model,effort,reservation] of [['quality','claude-sonnet-5-5','high',.25],['economy','claude-haiku-5-5','medium',.02]])test(`${planner} planning uses direct Anthropic, structured output and a separate key`,async()=>{
 const original=global.fetch,calls=[];global.fetch=async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return Response.json({stop_reason:'end_turn',content:[{type:'thinking',thinking:'not JSON output'},{type:'text',text:JSON.stringify(plan)}],usage:{input_tokens:4000,output_tokens:6000}});};
 try{
  const response=await POST(req({planner},{'x-anthropic-key':'anthropic-test-key','x-gemini-key':'google-never-forward','x-fal-key':'fal-never-forward','x-runway-key':'image-never-forward'}));
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.model,model);assert.equal(data.recipe.steps.reduce((sum,s)=>sum+s.shot.duration,0),44);assert.deepEqual(data.recipe.ingredients,recipe.ingredients);assert.deepEqual(data.recipe.production.originalSteps,JSON.parse(JSON.stringify(recipe.steps)));
  assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.anthropic.com/v1/messages');assert.equal(calls[0].options.headers.Authorization,'Bearer anthropic-test-key');assert.equal(calls[0].options.headers['anthropic-version'],'2026-10-21');
  assert.doesNotMatch(JSON.stringify(calls),/google-never-forward|fal-never-forward|image-never-forward/);
  assert.equal(calls[0].body.model,model);assert.equal(calls[0].body.max_tokens,16384);assert.equal(calls[0].body.output_config.effort,effort);assert.equal(calls[0].body.thinking.type,'adaptive');assert.equal(calls[0].body.output_config.format.type,'json_schema');assert.ok(calls[0].body.output_config.format.schema.properties.shots);assert.equal(calls[0].body.temperature,undefined);
  assert.match(calls[0].body.messages[0].content,/350°F/);assert.match(calls[0].body.messages[0].content,/totaling at most 45 seconds/);assert.equal(plannerReservation(planner),reservation);
 }finally{global.fetch=original;}
});
test('new clients default to quality planning and never reuse a Google or image key',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return Response.json({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(plan)}]});};
 try{assert.equal((await POST(req({}, {'x-gemini-key':'legacy-key'}))).status,401);assert.equal(calls,0);assert.equal((await POST(req({}, {'x-anthropic-key':'new-key'}))).status,200);assert.equal(calls,1);}finally{global.fetch=original;}
});
for(const [status,message] of [[401,'invalid key'],[403,'model access denied'],[400,'Your credit balance is too low'],[429,'limit'],[529,'overloaded']])test(`Anthropic rejection ${status} is actionable and never retried or sent to Google`,async()=>{
 const original=global.fetch,calls=[];global.fetch=async url=>{calls.push(url);return Response.json({error:{message}},{status,headers:{'retry-after':'12'}});};
 try{const response=await POST(req({planner:'quality'},{'x-anthropic-key':'test'}));assert.equal(response.status,status);assert.equal(response.headers.get('retry-after'),'12');assert.deepEqual(calls,['https://api.anthropic.com/v1/messages']);assert.equal((await response.json()).recipe,undefined);}finally{global.fetch=original;}
});
test('incomplete, refused, malformed and over-budget plans leave the storyboard unchanged',async()=>{
 const original=global.fetch;let calls=0;
 const before=JSON.stringify(recipe);
 try{for(const result of [{stop_reason:'max_tokens',content:[{type:'text',text:JSON.stringify(plan)}]},{stop_reason:'end_turn',stop_details:{type:'refusal'},content:[{type:'text',text:JSON.stringify(plan)}]},{stop_reason:'end_turn',content:[{type:'text',text:'not JSON'}]},{stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({...plan,shots:plan.shots.map(s=>({...s,duration:5}))})}]}]){global.fetch=async()=>{calls++;return Response.json(result);};const count=calls;const response=await POST(req({planner:'quality'},{'x-anthropic-key':'test'}));assert.equal(response.status,400);assert.equal((await response.json()).recipe,undefined);assert.equal(calls,count+1);assert.equal(JSON.stringify(recipe),before);}}finally{global.fetch=original;}
});
test('a planning connection interruption is an inconclusive gateway error, without an automatic paid retry',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw new TypeError('network down');};
 try{const response=await POST(req({planner:'quality'},{'x-anthropic-key':'test'}));assert.equal(response.status,502);assert.match((await response.json()).error,/history before retrying/);assert.equal(calls,1);}finally{global.fetch=original;}
});
test('hidden presentation also removes new planning model identifiers while preserving help links',async()=>{
 const {publicGenerationText}=await import('../lib/model-presentation.ts');const url='https://platform.claude.com/settings/keys';const message=publicGenerationText(`Use claude-sonnet-5-5 or Claude Haiku 5.5. Help: ${url}`);assert.doesNotMatch(message,/claude-sonnet|Claude Haiku/);assert.ok(message.includes(url));
});
