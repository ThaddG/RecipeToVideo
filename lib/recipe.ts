import {applyShotPlan} from './shot-plan';
import type {Shot,ProductionPlan} from './shot-plan';
import {articlePhotos,normalizePhotos,matchArticlePhotos,type ArticlePhoto} from './article-photos';
export type Scene = { title: string; text: string; image?: string; imageMatch?:string; shot?:Shot };
export type Recipe = { storyboardApproach?:'original'|'choose';name: string; description: string; ingredients: string[]; steps: Scene[]; images: string[]; totalTime: string; yield: string; source?: string; photos?:ArticlePhoto[]; production?:ProductionPlan };
const clean = (s: unknown) => typeof s === 'string' ? s.replace(/<[^>]*>/g, '').replace(/&(?:amp|nbsp|quot|apos|lt|gt|#39|#34);/g, x => ({'&amp;':'&','&nbsp;':' ','&quot;':'"','&apos;':"'",'&#39;':"'",'&#34;':'"','&lt;':'<','&gt;':'>'}[x] || x)).replace(/\s+/g, ' ').trim() : '';
function urls(v: any, base?: string): string[] {
 return (Array.isArray(v) ? v : [v]).flatMap(x => {
  const value = typeof x === 'string' ? x : x?.url || x?.contentUrl;
  if (typeof value !== 'string') return [];
  try { const u = new URL(value, base); return u.protocol === 'https:' && !u.username && !u.password ? [u.href] : []; } catch { return []; }
 });
}
function canonicalURL(html: string): string | undefined {
 for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
  const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),m[2]]));
  if (attributes.rel?.toLowerCase() === 'canonical') return urls(attributes.href)[0];
 }
}
function findRecipe(v: any, depth = 0): any { if (!v || typeof v !== 'object' || depth > 20) return null; if ([v['@type']].flat().some(t => typeof t === 'string' && /(^|[/#])Recipe$/.test(t))) return v; for (const x of Object.values(v)) { if (x && typeof x === 'object') { const found = findRecipe(x, depth + 1); if (found) return found; } } return null; }
function steps(v: any, base?: string): Scene[] { if (typeof v === 'string') return v.split(/\n+/).map(clean).filter(Boolean).map((text, i) => ({title: '', text})); if (Array.isArray(v)) return v.flatMap(x => steps(x, base)); if (!v || typeof v !== 'object') return []; if (v.itemListElement) return steps(v.itemListElement, base); if (v.item) return steps(v.item, base); const text = clean(v.text || v.name); return text ? [{title: clean(v.name) || '', text, image: urls(v.image, base)[0]}] : []; }
export function parseRecipe(input: string | object, source?: string): Recipe {
 let data: any;
 const base = (typeof input === 'string' ? canonicalURL(input) : undefined) || urls(source)[0];
 if (typeof input === 'string') {
  if (input.length > 15_000_000) throw new Error('Recipe input is too large. Use an HTML or JSON file smaller than 15 MB.');
  const scripts = [...input.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (scripts.length) { for (const s of scripts) { try { const found = findRecipe(JSON.parse(s[1])); if (found) { data = found; break; } } catch {} } }
  else { try { data = JSON.parse(input); } catch { throw new Error('Paste valid Recipe JSON or JSON-LD. Use “Write recipe” for a guided form.'); } }
 } else data = input;
 const r = findRecipe(data);
 if (!r) throw new Error('No Schema.org Recipe found. Include "@type": "Recipe".');
 const name = clean(r.name), ingredients = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : []).map(clean).filter(Boolean), instructions = steps(r.recipeInstructions, base);
 if (!name) throw new Error('Add a recipe name.');
 if (!ingredients.length) throw new Error('Add at least one recipeIngredient.');
 if (!instructions.length) throw new Error('Add at least one recipeInstructions step.');
 if (instructions.length > 30) throw new Error('Use 30 or fewer steps for one video.');
 if (name.length > 200 || ingredients.join('').length > 12000 || instructions.some(s => s.text.length > 2000)) throw new Error('This recipe is too long. Shorten the name, ingredients, or steps.');
 const images=urls(r.image,base);
 const photos=typeof input==='string'&&/<(?:article|main|div)\b/i.test(input)?articlePhotos(input,base):normalizePhotos(r.simmerPhotos,base||urls(r.url)[0]);
 const scenes=instructions.map((s,i)=>({...s,title:s.title||`Step ${i+1}`}));
 const recipe:Recipe={name, description:clean(r.description),ingredients,steps:matchArticlePhotos(scenes,photos,images[0]),images,totalTime:clean(r.totalTime),yield:clean(r.recipeYield)||String(r.recipeYield||''),source:urls(r.url,base)[0]||base,...(photos.length?{photos}:{})};
 return r.simmerShotPlan?applyShotPlan(recipe,r.simmerShotPlan):recipe;
}
export const sampleSchema = { '@context':'https://schema.org', '@type':'Recipe', name:'Basil pesto pasta', description:'Fresh basil, bright tomatoes, and parmesan. A bowl of effortless comfort, made for slow afternoons.', totalTime:'PT25M', recipeYield:'2 servings', image:['https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1400&q=85'], recipeIngredient:['200 g farfalle','3 tbsp basil pesto','150 g cherry tomatoes, halved','40 g parmesan, finely grated','½ cup reserved pasta water','Salt and freshly ground black pepper','Fresh basil, to finish'], recipeInstructions:[{'@type':'HowToStep',name:'Cook the pasta',text:'Bring a large pot of salted water to a boil. Cook the farfalle until al dente, reserving ½ cup of pasta water.'},{'@type':'HowToStep',name:'Make it silky',text:'Stir the basil pesto with a splash of reserved pasta water in a large bowl until smooth.'},{'@type':'HowToStep',name:'Toss it together',text:'Add the pasta, cherry tomatoes, and parmesan. Toss, adding pasta water a little at a time, until the pesto coats the pasta.'},{'@type':'HowToStep',name:'The finishing touch',text:'Spoon into warm bowls. Finish with basil, black pepper, and a little more parmesan.'}] };
export const sampleRecipe = parseRecipe(sampleSchema);
export function scenePrompt(recipe: Recipe, index: number, style: string) {
 const step = recipe.steps[index];
 const visual = style === 'Overhead' ? 'Top-down view on a clean kitchen counter, clear instructional composition.' : style === 'Rustic' ? 'Rustic home kitchen, warm afternoon light, natural materials.' : 'Cinematic food photography, soft natural light, close-up details.';
 let prompt = `Cooking video for ${recipe.name}. ${visual} Show this action faithfully: ${step.text} Realistic food, consistent kitchen, no on-screen text.`;
 if (prompt.length > 1000) prompt = `${visual} Show this recipe step faithfully: ${step.text} No on-screen text.`;
 if (prompt.length > 1000) throw new Error(`Scene ${index+1} is too long for the video provider. Split it into shorter steps.`);
 // The action is essential. Add ingredient context only while it fits, without
 // cutting an instruction short or making a long ingredient list block rendering.
 const relevant = recipe.ingredients.filter(ingredient => ingredient.toLowerCase().split(/[^a-z]+/).some(word => word.length > 3 && step.text.toLowerCase().includes(word)));
 const context: string[] = [];
 for (const ingredient of [...relevant, ...recipe.ingredients.filter(x=>!relevant.includes(x))]) {
  const next = prompt + ' Ingredients: ' + [...context, ingredient].join(', ') + '.';
  if (next.length <= 1000) context.push(ingredient);
 }
 return prompt + (context.length ? ' Ingredients: ' + context.join(', ') + '.' : '');
}
