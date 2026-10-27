import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){try{return nextResolve(specifier,context);}catch(e){if(specifier.startsWith('.'))return nextResolve(specifier+'.ts',context);throw e;}}});
const {parseRecipe,scenePrompt}=await import('../lib/recipe.ts');
const {browserImportBookmark,readBrowserImport}=await import('../lib/browser-import.ts');
const {POST}=await import('../app/api/import/route.ts');
for (const [file,name,ingredients,steps,photos] of [
 ['carrot-raisin-salad','Carrot Raisin Salad',7,3,3],
 ['pumpkin-cookie-bars','Chewy Pumpkin Chocolate Chip Cookie Bars',14,8,0],
]) {
 const schema=JSON.parse(readFileSync(new URL(`./fixtures/${file}.json`,import.meta.url),'utf8'));
 test(`${name}: imports the actual website schema and keeps its photos`,()=>{
  const r=parseRecipe(schema);assert.equal(r.name,name);assert.equal(r.ingredients.length,ingredients);assert.equal(r.steps.length,steps);assert.equal(r.steps.filter(s=>s.image).length,photos);assert.equal(r.images.length,1);assert.equal(r.source,schema.url);
  const html=`<html><link rel="canonical" href="${schema.url}"><script type="application/ld+json">${JSON.stringify({...schema,url:undefined})}</script></html>`;
  assert.deepEqual(parseRecipe(html),r);
 });
 test(`${name}: every rendering prompt fits without dropping instruction text`,()=>{
  const r=parseRecipe(schema);for(let i=0;i<r.steps.length;i++)for(const style of ['Cinematic','Overhead','Rustic']){const p=scenePrompt(r,i,style);assert.ok(p.length<=1000);assert.ok(p.includes(r.steps[i].text));}
 });
 test(`${name}: browser bookmark and app import round-trip`,()=>{
  const calls=[],alerts=[];const bookmark=browserImportBookmark('https://simmer.example');
  runInNewContext(decodeURIComponent(bookmark.slice('javascript:'.length)),{document:{querySelectorAll:()=>[{textContent:JSON.stringify({'@graph':[schema]})}]},location:{href:schema.url},window:{open:(...args)=>calls.push(args)},alert:m=>alerts.push(m)});
  assert.deepEqual(alerts,[]);assert.equal(calls.length,1);const target=new URL(calls[0][0]);assert.equal(target.origin,'https://simmer.example');assert.equal(target.search,'');const r=readBrowserImport(target.hash);assert.equal(r.name,name);assert.equal(r.source,schema.url);assert.equal(r.steps.length,steps);
 });
}
test('blocked sites return a recovery code rather than suggesting payment',async()=>{
 const original=global.fetch;
 try{for(const status of [402,403,429]){global.fetch=async url=>String(url).includes('dns-query')?Response.json({Answer:[{type:1,data:'93.184.216.34'}]}):new Response('Blocked',{status});const response=await POST(new Request('https://simmer.example/api/import',{method:'POST',body:JSON.stringify({url:'https://www.allrecipes.com/recipe/8458932/carrot-raisin-salad/'})}));const body=await response.json();assert.equal(response.status,422);assert.equal(body.code,'WEBSITE_BLOCKED');assert.equal(body.upstreamStatus,status);assert.match(body.error,/browser/);}}
 finally{global.fetch=original;}
});
test('browser import rejects malformed, oversized, and source-less payloads',()=>{
 assert.equal(readBrowserImport('#elsewhere'),null);assert.throws(()=>readBrowserImport('#import=%E0%A4%A'));assert.throws(()=>readBrowserImport('#import='+'a'.repeat(300000)),/too large/);assert.throws(()=>readBrowserImport('#import='+encodeURIComponent(JSON.stringify({'@type':'Recipe',name:'Test',recipeIngredient:['Salt'],recipeInstructions:['Mix.']}))),/source/);
});
test('bookmark handles pages without recipe data without opening an empty project',()=>{
 const calls=[],alerts=[];runInNewContext(decodeURIComponent(browserImportBookmark('https://simmer.example').slice(11)),{document:{querySelectorAll:()=>[]},window:{open:(...a)=>calls.push(a)},alert:m=>alerts.push(m)});assert.equal(calls.length,0);assert.match(alerts[0],/No Recipe data/);
});
test('resolves relative photos against the recipe source and decodes common text entities',()=>{
 const r=parseRecipe({'@type':'Recipe',name:'Chef&#39;s &quot;salad&quot;',recipeIngredient:['Salt &amp; pepper'],recipeInstructions:[{text:'Mix.',image:'/step.jpg'}],image:'//example.com/main.jpg'},'https://example.com/recipe');assert.equal(r.name,'Chef\'s "salad"');assert.equal(r.ingredients[0],'Salt & pepper');assert.equal(r.images[0],'https://example.com/main.jpg');assert.equal(r.steps[0].image,'https://example.com/step.jpg');
});
