import {parseDocument, DomUtils} from 'htmlparser2';
import type {Scene} from './recipe';

export type ArticlePhoto = {url:string; alt:string; caption:string};
const text = (value:unknown) => typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,700):'';
const excluded = /(?:^|[\s_-])(?:related|recommend|suggested|comment|avatar|author|logo|advert|social|pinterest|newsletter|sidebar|footer|nav|rating)(?:[\s_-]|$)/i;
export function photoIdentity(url:string){try{const u=new URL(url);for(const key of ['w','h','width','height','resize','fit','crop','q','quality'])u.searchParams.delete(key);u.pathname=u.pathname.replace(/-\d+x\d+(?=\.[a-z]+$)/i,'');return u.href;}catch{return url;}}
export function normalizePhotos(values:unknown,base?:string):ArticlePhoto[]{
 if(!Array.isArray(values))return [];
 const photos=new Map<string,ArticlePhoto>();
 for(const value of values.slice(0,100)){
  if(!value||typeof value.url!=='string')continue;
  try{const u=new URL(value.url,base);if(u.protocol!=='https:'||u.username||u.password||/\.(?:svg|gif)$/i.test(u.pathname))continue;
   const photo={url:u.href,alt:text(value.alt),caption:text(value.caption)};
   if((!photo.alt&&!photo.caption)||excluded.test(photo.alt))continue;
   const id=photoIdentity(photo.url),previous=photos.get(id);
   if(!previous||photo.caption.length>previous.caption.length)photos.set(id,photo);
  }catch{}
 }
 return [...photos.values()].slice(0,60);
}
export function articlePhotos(html:string,base?:string):ArticlePhoto[]{
 const doc=parseDocument(html);
 const nodes=DomUtils.findAll(e=>true,doc.children);
 const root=nodes.find(e=>/\b(?:entry-content|post-content|article-content)\b/.test(e.attribs.class||''))||nodes.find(e=>e.name==='article')||nodes.find(e=>e.name==='main');
 if(!root)return [];
 const photos=[];
 for(const img of DomUtils.findAll(e=>e.name==='img',root.children)){
  let parent=img.parent,container=img.parent,skip=false;
  while(parent&&parent!==root){if('attribs' in parent){if(excluded.test(`${parent.attribs.class||''} ${parent.attribs.id||''} ${parent.name}`)||['aside','nav','footer'].includes(parent.name)){skip=true;break;}if(parent.name==='figure'||/\bwp-caption\b/.test(parent.attribs.class||''))container=parent;}parent=parent.parent;}
  if(skip)continue;
  const a=img.attribs;
  if((a.width&&Number(a.width)<200)||(a.height&&Number(a.height)<150)||excluded.test(a.alt||''))continue;
  const caption=container&&'children' in container?DomUtils.findOne(e=>e.name==='figcaption'||/\bwp-caption-text\b/.test(e.attribs.class||''),container.children):null;
  const set=a['data-srcset']||a.srcset||'';
  const largest=set.split(',').map(s=>s.trim().split(/\s+/)).sort((a,b)=>parseFloat(b[1]||'0')-parseFloat(a[1]||'0'))[0]?.[0];
  photos.push({url:a['data-full-url']||a['data-orig-file']||a['data-lazy-src']||a['data-src']||largest||a.src,alt:a.alt,caption:caption?DomUtils.textContent(caption):a.title});
 }
 return normalizePhotos(photos,base);
}

// This function is serialized into the bookmark: keep it self-contained and bounded.
export function collectBrowserPhotos(){
 const root=document.querySelector('.entry-content, .post-content, .article-content')||document.querySelector('article')||document.querySelector('main');
 if(!root)return [];
 return Array.from(root.querySelectorAll('img')).slice(0,100).filter(img=>!img.closest('aside,nav,footer,[class*="related"],[class*="comment"],[class*="author"],[class*="sidebar"]')&&!(img.getAttribute('width')&&Number(img.getAttribute('width'))<200)&&!(img.getAttribute('height')&&Number(img.getAttribute('height'))<150)).map(img=>{
  const a=(key:string)=>img.getAttribute(key)||'';
  const box=img.closest('figure,.wp-caption');
  const set=a('data-srcset')||a('srcset');
  const largest=set.split(',').map(s=>s.trim().split(/\s+/)).sort((a,b)=>parseFloat(b[1]||'0')-parseFloat(a[1]||'0'))[0]?.[0];
  return {url:a('data-full-url')||a('data-orig-file')||a('data-lazy-src')||a('data-src')||largest||a('src'),alt:a('alt').slice(0,700),caption:(box?.querySelector('figcaption,.wp-caption-text')?.textContent||a('title')).slice(0,700)};
 });
}
const ignored=new Set('the a an to of in on and or with for into from until then this that is are be it as at by your recipe make food ready'.split(' '));
// Stage verbs matter more than repeated recipe nouns. Keep inflections together.
const forms:Record<string,string>={kernals:'kernel',kernels:'kernel',cobs:'cob',pureed:'puree',pureeing:'puree',purée:'puree',puréed:'puree',steeping:'steep',strained:'strain',straining:'strain',whisking:'whisk',whisked:'whisk',cooked:'cook',cooking:'cook',heating:'heat',heated:'heat',mixing:'mix',mixed:'mix',combining:'combine',combined:'combine',chopped:'chop',chopping:'chop',baking:'bake',baked:'bake',churning:'churn',churned:'churn',freezing:'freeze',frozen:'freeze',melting:'melt',melted:'melt',solids:'solid',yolks:'yolk'};
const actions=new Set('puree steep strain whisk cook heat mix combine chop bake churn freeze melt knead roast fry saute blend fold beat slice grate peel simmer boil cool chill'.split(' '));
function tokens(value:string){return [...new Set(value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').split(/[^a-z]+/).map(w=>forms[w]||w).filter(w=>w.length>2&&!ignored.has(w)))];}
export function matchArticlePhotos(steps:Scene[],photos:ArticlePhoto[],hero?:string):Scene[]{
 const result=steps.map(s=>({...s})),used=new Set(steps.flatMap(s=>s.image?[photoIdentity(s.image)]:[]));
 const terms=steps.map(s=>tokens(s.text));
 const edges:{photo:ArticlePhoto;index:number;score:number}[]=[];
 for(const photo of photos){
  if(used.has(photoIdentity(photo.url))||(hero&&photoIdentity(hero)===photoIdentity(photo.url)))continue;
  let caption=photo.caption||photo.alt;
  // A prepared ingredient waiting to be added belongs to the combining stage.
  if(/ready to (?:go|add|pour).*into/i.test(caption))caption=caption.replace(/pureed/ig,'')+' combine';
  const words=tokens(caption),verbs=words.filter(w=>actions.has(w));
  if(!verbs.length)continue; // Generic hero/ingredient photos remain available in the picker.
  const scores=terms.map((step,index)=>{
   const shared=words.filter(w=>step.includes(w));
   const sharedVerbs=verbs.filter(w=>step.includes(w));
   if(!sharedVerbs.length||shared.filter(w=>!actions.has(w)).length<1)return {index,score:0};
   const score=shared.reduce((sum,w)=>sum+(actions.has(w)?6:1+Math.log((steps.length+1)/(1+terms.filter(s=>s.includes(w)).length))),0)-verbs.filter(w=>!step.includes(w)).length*2;
   return {index,score};
  }).sort((a,b)=>b.score-a.score);
  if(scores[0]?.score>=7&&scores[0].score-(scores[1]?.score||0)>=1)edges.push({photo,...scores[0]});
 }
 for(const {photo,index} of edges.sort((a,b)=>b.score-a.score)){
  if(result[index].image||used.has(photoIdentity(photo.url)))continue;
  result[index]={...result[index],image:photo.url,imageMatch:photo.caption||photo.alt};used.add(photoIdentity(photo.url));
 }
 return result;
}
