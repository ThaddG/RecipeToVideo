import {collectBrowserPhotos} from './article-photos';
import { parseRecipe, type Recipe } from './recipe';

export const MAX_IMPORT_FILE = 15_000_000;
export function readBrowserImport(hash: string): Recipe | null {
  if (!hash.startsWith('#import=')) return null;
  if (hash.length > 300_000) throw new Error('This browser import is too large. Save the recipe page and import the HTML file instead.');
  const payload = JSON.parse(decodeURIComponent(hash.slice(8)));
  const recipe = parseRecipe(payload);
  if (!recipe.source) throw new Error('The browser import is missing its source website.');
  return recipe;
}

export function browserImportBookmark(appOrigin: string) {
  const target = new URL('/', appOrigin);
  if (!['https:', 'http:'].includes(target.protocol)) throw new Error('Invalid Simmer address.');
  const code = `(()=>{try{const find=(v,d=0)=>{if(!v||typeof v!=="object"||d>20)return null;if([v["@type"]].flat().some(t=>typeof t==="string"&&/(^|[/#])Recipe$/.test(t)))return v;for(const x of Object.values(v)){if(x&&typeof x==="object"){const r=find(x,d+1);if(r)return r}}return null};let r;for(const s of document.querySelectorAll('script[type="application/ld+json"]')){try{r=find(JSON.parse(s.textContent));if(r)break}catch{}}if(!r)throw Error("No Recipe data found. Save this page as HTML and import it in Simmer, or use Write recipe.");const data={"@context":"https://schema.org","@type":"Recipe",name:r.name,description:r.description,image:r.image,recipeIngredient:r.recipeIngredient,recipeInstructions:r.recipeInstructions,totalTime:r.totalTime,recipeYield:r.recipeYield,url:location.href,simmerPhotos:(${collectBrowserPhotos.toString()})()};const hash=encodeURIComponent(JSON.stringify(data));if(hash.length>299990)throw Error("This recipe is too large. Save this page as HTML and import it in Simmer.");const w=window.open(${JSON.stringify(target.href)}+"#import="+hash,"_blank","noopener");}catch(e){alert(e.message||"Unable to send this recipe to Simmer.")}})()`;
  return 'javascript:' + encodeURIComponent(code);
}
