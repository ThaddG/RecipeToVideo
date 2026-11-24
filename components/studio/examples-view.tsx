import {ArrowRight} from 'lucide-react';
import {sampleRecipe} from '../../lib/recipe';

export function ExamplesView({disabled, hasRecipe, onBack, onStart}: {
 disabled: boolean;
 hasRecipe: boolean;
 onBack: () => void;
 onStart: () => void;
}) {
 return <>
  <div className="page-heading">
   <div><div className="eyebrow">A LITTLE INSPIRATION</div><h1>Try a recipe. Learn the flow.</h1><p>Explore an example, then bring your own recipe to the studio.</p></div>
   <button className="secondary" onClick={onBack}>Back to studio<ArrowRight size={16}/></button>
  </div>
  <section className="example-feature panel">
   <img src={sampleRecipe.images[0]} alt="Basil pesto pasta example"/>
   <div>
    <span className="eyebrow">EXAMPLE RECIPE</span>
    <h2>{sampleRecipe.name}</h2>
    <p>{sampleRecipe.description}</p>
    <p className="example-meta">{sampleRecipe.ingredients.length} ingredients · {sampleRecipe.steps.length} steps · 1 recipe photo</p>
    <button className="primary" disabled={disabled} onClick={onStart}>Start with this example<ArrowRight size={16}/></button>
    <small>Loading the example is free. Generating images or video requires your generation service key and a separate credit confirmation.</small>
    {hasRecipe && <small>Your current recipe will be saved before the example opens.</small>}
   </div>
  </section>
 </>;
}
