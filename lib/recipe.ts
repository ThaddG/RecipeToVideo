export type Scene = { title: string; text: string; image?: string };
export type Recipe = { name: string; description: string; ingredients: string[]; steps: Scene[]; images: string[]; totalTime: string; yield: string; source?: string };
const clean = (s: unknown) => typeof s === 'string' ? s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim() : '';
function urls(v: any): string[] { return (Array.isArray(v) ? v : [v]).flatMap(x => { const s = typeof x === 'string' ? x : x?.url || x?.contentUrl; return s && /^https:\/\//i.test(s) ? [s] : []; }); }
function findRecipe(v: any, depth = 0): any { if (!v || typeof v !== 'object' || depth > 20) return null; if ([v['@type']].flat().some(t => typeof t === 'string' && /(^|[/#])Recipe$/.test(t))) return v; for (const x of Object.values(v)) { if (x && typeof x === 'object') { const found = findRecipe(x, depth + 1); if (found) return found; } } return null; }
function steps(v: any): Scene[] { if (typeof v === 'string') return v.split(/\n+/).map(clean).filter(Boolean).map((text, i) => ({title: '', text})); if (Array.isArray(v)) return v.flatMap(steps); if (!v || typeof v !== 'object') return []; if (v.itemListElement) return steps(v.itemListElement); if (v.item) return steps(v.item); const text = clean(v.text || v.name); return text ? [{title: clean(v.name) || '', text, image: urls(v.image)[0]}] : []; }
export function parseRecipe(input: string | object): Recipe {
 let data: any;
 if (typeof input === 'string') {
  if (input.length > 2_000_000) throw new Error('Recipe input is too large. Paste only the Recipe JSON.');
  const scripts = [...input.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (scripts.length) { for (const s of scripts) { try { const found = findRecipe(JSON.parse(s[1])); if (found) { data = found; break; } } catch {} } }
  else { try { data = JSON.parse(input); } catch { throw new Error('Paste valid Recipe JSON or JSON-LD. Use “Write recipe” for a guided form.'); } }
 } else data = input;
 const r = findRecipe(data);
 if (!r) throw new Error('No Schema.org Recipe found. Include "@type": "Recipe".');
 const name = clean(r.name), ingredients = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : []).map(clean).filter(Boolean), instructions = steps(r.recipeInstructions);
 if (!name) throw new Error('Add a recipe name.');
 if (!ingredients.length) throw new Error('Add at least one recipeIngredient.');
 if (!instructions.length) throw new Error('Add at least one recipeInstructions step.');
 if (instructions.length > 30) throw new Error('Use 30 or fewer steps for one video.');
 if (name.length > 200 || ingredients.join('').length > 12000 || instructions.some(s => s.text.length > 2000)) throw new Error('This recipe is too long. Shorten the name, ingredients, or steps.');
 return {name, description: clean(r.description), ingredients, steps: instructions.map((s,i) => ({...s,title:s.title || `Step ${i+1}`})),images: urls(r.image),totalTime:clean(r.totalTime),yield:clean(r.recipeYield) || String(r.recipeYield || ''),source:urls(r.url)[0]};
}
export const sampleSchema = { '@context':'https://schema.org', '@type':'Recipe', name:'Basil pesto pasta', description:'Fresh basil, bright tomatoes, and parmesan. A bowl of effortless comfort, made for slow afternoons.', totalTime:'PT25M', recipeYield:'2 servings', image:['https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1400&q=85'], recipeIngredient:['200 g farfalle','3 tbsp basil pesto','150 g cherry tomatoes, halved','40 g parmesan, finely grated','½ cup reserved pasta water','Salt and freshly ground black pepper','Fresh basil, to finish'], recipeInstructions:[{'@type':'HowToStep',name:'Cook the pasta',text:'Bring a large pot of salted water to a boil. Cook the farfalle until al dente, reserving ½ cup of pasta water.'},{'@type':'HowToStep',name:'Make it silky',text:'Stir the basil pesto with a splash of reserved pasta water in a large bowl until smooth.'},{'@type':'HowToStep',name:'Toss it together',text:'Add the pasta, cherry tomatoes, and parmesan. Toss, adding pasta water a little at a time, until the pesto coats the pasta.'},{'@type':'HowToStep',name:'The finishing touch',text:'Spoon into warm bowls. Finish with basil, black pepper, and a little more parmesan.'}] };
export const sampleRecipe = parseRecipe(sampleSchema);
export function scenePrompt(recipe: Recipe, index: number, style: string) { const step = recipe.steps[index]; const context = `Cooking video for ${recipe.name}. ${style === 'Overhead' ? 'Top-down view on a clean kitchen counter, clear instructional composition.' : style === 'Rustic' ? 'Rustic home kitchen, warm afternoon light, tactile natural materials.' : 'Cinematic food photography, soft natural light, close-up details, shallow depth of field.'} Show this action faithfully: `; const prompt = context + step.text + '. Ingredients: ' + recipe.ingredients.join(', ') + '. Realistic food, consistent kitchen, no on-screen text. Depict only this recipe step.'; if (prompt.length > 1000) throw new Error(`Scene ${index+1} is too long for the video provider. Shorten the step or ingredients.`); return prompt; }
