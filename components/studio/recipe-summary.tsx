import {CheckCircle2, ChefHat, Clock, ExternalLink, Image as ImageIcon, Users} from 'lucide-react';
import {photoIdentity} from '../../lib/article-photos';
import type {Recipe} from '../../lib/recipe';

/** Formats an ISO 8601 duration such as PT1H5M for display. */
const readableTime = (time: string) => time.replace('PT', '').replace('H', ' hr ').replace('M', ' min').replace('S', ' sec');

const photoCount = (recipe: Recipe) => new Set([...recipe.images, ...recipe.steps.flatMap(s => s.image ? [s.image] : []), ...(recipe.photos || []).map(p => p.url)].map(photoIdentity)).size;

export function RecipeSummary({recipe, isExample, onIngredients}: {recipe: Recipe; isExample: boolean; onIngredients: () => void}) {
 return <section className="recipe-card">
  <div className="recipe-photo">
   {recipe.images[0] ? <img src={recipe.images[0]} alt={recipe.name}/> : <div className="photo-empty"><ChefHat size={50}/></div>}
   <span className="photo-label"><ImageIcon size={12}/>{!recipe.images.length ? 'No recipe photo' : isExample ? 'Example recipe' : 'Recipe photo'}</span>
  </div>
  <div className="recipe-info">
   <div className="eyebrow"><CheckCircle2 size={13}/>{isExample ? 'EXAMPLE LOADED' : 'RECIPE IMPORTED'}</div>
   <h2>{recipe.name}</h2>
   <p>{recipe.description || 'Your ingredients, your steps, your next great video.'}</p>
   <div className="recipe-meta">
    <span><Clock size={14}/>{recipe.totalTime ? readableTime(recipe.totalTime) : 'Time not specified'}</span>
    <span><Users size={14}/>{recipe.yield || 'Your recipe'}</span>
   </div>
   <div className="recipe-stats">
    <button onClick={onIngredients}>{recipe.ingredients.length} ingredients</button>
    <span>·</span>
    <span>{recipe.production ? `${recipe.production.originalSteps.length} recipe steps · ${recipe.steps.length} shots` : `${recipe.steps.length} steps`}</span>
    <span>·</span>
    <span>{photoCount(recipe)} photos</span>
    {recipe.source && <a href={recipe.source} target="_blank" rel="noreferrer" aria-label="View recipe source"><ExternalLink size={13}/></a>}
   </div>
  </div>
 </section>;
}
