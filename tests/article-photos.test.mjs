import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {runInNewContext} from 'node:vm';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))return n(s+'.ts',c);throw e}}});
const {parseRecipe}=await import('../lib/recipe.ts');
const {articlePhotos,normalizePhotos,matchArticlePhotos}=await import('../lib/article-photos.ts');
const {browserImportBookmark,readBrowserImport}=await import('../lib/browser-import.ts');
const {providedFrame}=await import('../lib/storyboard.ts');
const html=readFileSync(new URL('./fixtures/sweet-corn-article.html',import.meta.url),'utf8');

test('Baking Sense: matches four out-of-order process photos, retaining the final hero',()=>{
 const r=parseRecipe(html);
 assert.equal(r.photos.length,7);
 assert.deepEqual(r.steps.map(s=>s.image?.match(/corn-ice-cream-(\d)a/)[1]||null),['2','3','1',null,null,'4',null]);
 assert.equal(r.steps.filter((_,i)=>providedFrame(r,i,true)).length,5);
 assert.ok(r.steps[0].imageMatch.includes('Puree'));
 assert.equal(providedFrame(r,6,true),r.images[0]);
 assert.equal(providedFrame(r,0,false),undefined);
});
test('preserves explicit schema step photos over suggestions',()=>{
 const r=parseRecipe(html),explicit={...r.steps[0],image:'https://example.com/explicit.jpg',imageMatch:undefined};
 const matched=matchArticlePhotos([explicit,...r.steps.slice(1)],r.photos);
 assert.equal(matched[0].image,explicit.image);assert.equal(matched[0].imageMatch,undefined);
});
test('skips unrelated/author/tiny images, resolves lazy URLs, captions and responsive duplicates',()=>{
 const photos=articlePhotos(`<main><aside><figure><img src="/ad.jpg" alt="Whisk the egg yolks"></figure></aside><div class="related-posts"><img src="/other.jpg" alt="Strain custard"></div><img src="/tiny.jpg" width="40" alt="Logo"><figure><img data-src="/mix.jpg" src="data:image/gif;base64,xx" alt="Mix eggs"><figcaption>Whisk the egg yolks.</figcaption></figure><figure><img src="/mix-300x200.jpg" alt="Mix eggs"></figure><figure><img src="/small.jpg" srcset="/whisk-300x200.jpg 300w, /whisk.jpg 1200w" alt="Whisk eggs"></figure><img src="javascript:alert(1)" alt="Cook eggs"></main>`,'https://example.com/recipe');
 assert.equal(photos.length,2);assert.equal(photos[0].url,'https://example.com/mix.jpg');assert.equal(photos[0].caption,'Whisk the egg yolks.');assert.equal(photos[1].url,'https://example.com/whisk.jpg');
});
test('ambiguous stages and generic final-dish photos are available but not guessed onto steps',()=>{
 const scenes=[{title:'1',text:'Whisk eggs in a bowl.'},{title:'2',text:'Whisk eggs in another bowl.'},{title:'3',text:'Bake the cake.'}];
 const photos=[{url:'https://example.com/eggs.jpg',caption:'Whisk eggs.',alt:''},{url:'https://example.com/cake.jpg',caption:'A delicious cake in a bowl',alt:''}];
 assert.ok(matchArticlePhotos(scenes,photos).every(s=>!s.image));
 assert.deepEqual(normalizePhotos([{url:'http://example.com/a.jpg'},{url:'https://user:password@example.com/x',alt:'Bake cake'}]),[]);
});
test('browser bookmark sends article metadata and reproduces URL import matches',()=>{
 const r=parseRecipe(html),schema=JSON.parse(html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]);
 const imgs=r.photos.map(photo=>({getAttribute:key=>key==='src'?photo.url:key==='alt'?photo.alt:null,closest:selector=>selector==='figure,.wp-caption'?{querySelector:()=>({textContent:photo.caption})}:null}));
 const calls=[],alerts=[];
 runInNewContext(decodeURIComponent(browserImportBookmark('https://simmer.example').slice(11)),{document:{querySelector:()=>({querySelectorAll:()=>imgs}),querySelectorAll:()=>[{textContent:JSON.stringify(schema)}]},location:{href:r.source},window:{open:url=>calls.push(url)},alert:m=>alerts.push(m)});
 assert.deepEqual(alerts,[]);const imported=readBrowserImport(new URL(calls[0]).hash);assert.deepEqual(imported.steps,r.steps);assert.deepEqual(imported.photos,r.photos);
});
test('URL import includes article photos via the existing safe fetching path',async()=>{
 const {POST}=await import('../app/api/import/route.ts');const original=global.fetch;
 try{global.fetch=async url=>String(url).includes('dns-query')?Response.json({Answer:[{type:1,data:'93.184.216.34'}]}):new Response(html,{headers:{'content-type':'text/html'}});
 const response=await POST(new Request('https://simmer.example/api/import',{method:'POST',body:JSON.stringify({url:'https://www.baking-sense.com/2016/08/07/sweet-corn-ice-cream/'})}));
 assert.equal(response.status,200);const {recipe}=await response.json();assert.equal(recipe.steps.filter(s=>s.imageMatch).length,4);
 }finally{global.fetch=original;}
});
