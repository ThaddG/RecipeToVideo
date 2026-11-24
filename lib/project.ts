import type {Recipe} from './recipe';
import type {StoryboardFrame} from './storyboard';
import type {GenerationSettings} from './generation-settings';
import type {MusicChoice} from './music';
import type {VideoJob} from './video-jobs';

export type Project = {
 generation?: GenerationSettings;
 sampleChosen?: boolean;
 id: string;
 recipe: Recipe;
 format: string;
 style: string;
 duration: number;
 captions: boolean;
 useImages: boolean;
 music?: MusicChoice;
 musicVolume?: number;
 frames?: StoryboardFrame[];
 storyboardApproval?: string;
 jobs: VideoJob[];
 updated: string;
};

export const emptyRecipe: Recipe = {name: '', description: '', ingredients: [], steps: [], images: [], totalTime: '', yield: ''};

/** A blank project with the studio's default settings. */
export const seedProject = () => ({
 id: crypto.randomUUID(),
 recipe: emptyRecipe,
 format: '9:16',
 style: 'Cinematic',
 duration: 3,
 captions: true,
 useImages: true,
 jobs: [],
 updated: new Date().toISOString(),
});

/** Saves a blob to the user's device under the given file name. */
export function downloadBlob(blob: Blob, name: string) {
 const link = document.createElement('a'), u = URL.createObjectURL(blob);
 link.href = u;
 link.download = name;
 link.click();
 setTimeout(() => URL.revokeObjectURL(u), 60000);
}

/** Lowercase, dash-separated file name stem for a recipe. */
export const fileStem = (name: string) => name.replace(/[^a-z0-9]/gi, '-').toLowerCase();

/** Schema.org Recipe JSON for the export button, including any shot plan. */
export function recipeSchema(recipe: Recipe) {
 return {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: recipe.name,
  description: recipe.description,
  image: recipe.images,
  recipeIngredient: recipe.ingredients,
  recipeInstructions: (recipe.production?.originalSteps || recipe.steps).map(s => ({'@type': 'HowToStep', name: s.title, text: s.text, image: s.image})),
  ...(recipe.production ? {simmerShotPlan: {bible: recipe.production.bible, shots: recipe.steps.map(s => ({...s.shot, title: s.title}))}} : {}),
  totalTime: recipe.totalTime,
  recipeYield: recipe.yield,
  url: recipe.source,
 };
}
