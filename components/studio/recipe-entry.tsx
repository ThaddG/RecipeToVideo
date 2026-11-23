import {ArrowRight, ArrowUpRight, FileJson, Link2, LoaderCircle, PenLine, X, type LucideIcon} from 'lucide-react';
import RecipeImportOptions from '../recipe-import-options';
import type {Recipe} from '../../lib/recipe';

export type RecipeForm = {name: string; ingredients: string; steps: string};

const inputTabs: [string, string, LucideIcon][] = [['url', 'Recipe link', Link2], ['json', 'Recipe JSON', FileJson], ['write', 'Write recipe', PenLine]];

/** Shown instead of the recipe entry while the example recipe is loaded. */
export function ExampleSession({disabled, onStop}: {disabled: boolean; onStop: () => void}) {
 return <section className="template-session panel">
  <div><span className="eyebrow">USING AN EXAMPLE</span><h2>Try the workflow with pesto pasta.</h2><p>Review its storyboard below, or switch to your own recipe.</p></div>
  <button className="secondary" disabled={disabled} onClick={onStop}><X size={16}/>Stop using example</button>
 </section>;
}

export function RecipeEntry({tab, url, json, form, busy, locked, importBlocked, onTab, onUrl, onJson, onForm, onImport, onApply, onExamples}: {
 tab: string;
 url: string;
 json: string;
 form: RecipeForm;
 busy: boolean;
 locked: boolean;
 importBlocked: boolean;
 onTab: (tab: string) => void;
 onUrl: (url: string) => void;
 onJson: (json: string) => void;
 onForm: (form: RecipeForm) => void;
 onImport: () => void;
 onApply: (recipe: Recipe) => void;
 onExamples: () => void;
}) {
 return <section className="import-panel recipe-entry" aria-labelledby="recipe-entry-title">
  <div className="section-heading"><span className="eyebrow">START WITH THE INGREDIENTS</span><h2 id="recipe-entry-title">Your recipe</h2><p>Bring a link, paste a saved recipe, or write something of your own.</p><span className="soft-badge"><span/>Schema.org ready</span></div>
  <div className="input-tabs" role="tablist" aria-label="Recipe input method">
   {inputTabs.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'selected' : ''} onClick={() => onTab(id)}><Icon size={15}/>{label}</button>)}
  </div>
  {tab === 'url'
   ? <div className="input-content">
    <label htmlFor="recipe-url">Have a recipe in mind? Drop the link.</label>
    <div className="url-row">
     <Link2 size={17}/>
     <input id="recipe-url" type="url" placeholder="https://your-favorite-recipe.com/…" value={url} onChange={e => onUrl(e.target.value)} onKeyDown={e => {if (e.key === 'Enter' && !locked) onImport();}}/>
     <button className="primary" disabled={busy || locked || !url.trim()} onClick={onImport}>{busy ? <LoaderCircle className="spin" size={16}/> : <>Import<ArrowRight size={16}/></>}</button>
    </div>
    <p className="input-help">Import ingredients, steps, and photos. Browser import is available for sites that block direct access.</p>
   </div>
   : tab === 'json'
    ? <div className="input-content">
     <label htmlFor="recipe-json">Paste Schema.org Recipe JSON or a JSON-LD script</label>
     <textarea id="recipe-json" className="code-input" rows={5} value={json} placeholder={'{\n  "@type": "Recipe",\n  "name": "Something delicious",\n  "recipeIngredient": [...],\n  "recipeInstructions": [...]\n}'} onChange={e => onJson(e.target.value)}/>
     <div className="input-actions">
      <button className="text-button" onClick={onExamples}>Explore examples</button>
      <button className="primary" disabled={busy || locked || !json.trim()} onClick={onImport}>Continue to shot planning<ArrowRight size={16}/></button>
     </div>
    </div>
    : <div className="input-content write-form">
     <label>Recipe name<input placeholder="Grandma’s Sunday pasta" value={form.name} onChange={e => onForm({...form, name: e.target.value})}/></label>
     <div>
      <label>Ingredients <small>One per line</small><textarea rows={4} placeholder={'200 g pasta\n2 tbsp olive oil'} value={form.ingredients} onChange={e => onForm({...form, ingredients: e.target.value})}/></label>
      <label>Instructions <small>One step per line</small><textarea rows={4} placeholder={'Boil salted water.\nCook pasta until al dente.'} value={form.steps} onChange={e => onForm({...form, steps: e.target.value})}/></label>
     </div>
     <button className="primary" disabled={busy || locked || !form.name || !form.ingredients || !form.steps} onClick={onImport}>Continue to shot planning<ArrowRight size={16}/></button>
    </div>}
  <RecipeImportOptions locked={locked || busy} blocked={importBlocked} sourceURL={url} onImport={onApply}/>
  <div className="sample-row"><span>Just exploring?</span><button disabled={locked} onClick={onExamples}>Explore the example recipe<ArrowUpRight size={14}/></button></div>
 </section>;
}
