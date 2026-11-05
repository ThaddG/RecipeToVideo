import type {Recipe} from './recipe';
import type {StoryboardFrame} from './storyboard';
import type {VideoJob} from './video-jobs';
// Existing paid work remains resumable; fresh imports need an explicit planning choice.
export function shotChoiceReady(recipe:Recipe,frames:StoryboardFrame[]=[],jobs:VideoJob[]=[]){
 if(recipe.production||jobs.some(Boolean))return true;
 if(recipe.storyboardApproach==='choose')return false;
 return recipe.storyboardApproach==='original'||frames.some(f=>!!(f?.imageKey||f?.taskId||f?.status));
}
