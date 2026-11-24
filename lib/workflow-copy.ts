import {modelCopy} from './model-presentation';

export type WorkflowState = {
 progress: number;
 rendering: boolean;
 checking: boolean;
 planning: boolean;
 generatingImages: boolean;
 allReady: boolean;
 approved: boolean;
 hasRecipe: boolean;
 shotsChosen: boolean;
 storyboardReady: boolean;
 busy: boolean;
 tab: string;
 complete: number;
 sceneCount: number;
 framesReady: number;
};

/** Heading for the current point in the guided workflow. */
export function workflowTitle(s: WorkflowState) {
 if (s.progress >= 0) return 'Exporting your video';
 if (s.rendering) return 'Generating video clips';
 if (s.checking) return modelCopy('Checking existing Runway tasks', 'Checking existing generation tasks');
 if (s.planning) return 'Planning precise cooking shots';
 if (s.generatingImages) return 'Generating storyboard frames';
 if (s.allReady) return 'Your video clips are ready';
 if (s.approved) return 'Ready to animate';
 if (s.hasRecipe) return !s.shotsChosen ? 'First, choose your shot plan' : s.storyboardReady ? 'Review and approve your storyboard' : 'Next, generate missing images';
 return s.busy ? 'Importing your recipe' : 'Add your recipe';
}

/** Explanation shown under the workflow heading. */
export function workflowDescription(s: WorkflowState) {
 if (s.planning) return 'Reading the whole recipe to separate actions and carry food states, cookware and lighting between shots. No images or videos are being generated.';
 if (s.checking) return 'Checking your saved task IDs only. This does not create new tasks or use generation credits.';
 if (s.progress >= 0) return `Export ${Math.round(s.progress * 100)}% complete. Keep this tab visible while your clips, captions, and optional music are assembled.`;
 if (s.rendering) return `${s.complete} of ${s.sceneCount} clips ready. Each approved image is animated using its motion direction.`;
 if (s.generatingImages) return `${s.framesReady} of ${s.sceneCount} frames ready. You can pause and resume image generation.`;
 if (s.allReady) return 'Preview your clips, choose optional music and captions, then export the finished video.';
 if (s.approved) return 'Choose Generate video and confirm the generation credit usage to animate your approved frames.';
 if (s.hasRecipe) {
  if (!s.shotsChosen) return 'Create and apply a shot plan first (recommended), or choose Keep imported steps. Generate missing images only after choosing the shots.';
  return s.storyboardReady ? 'Check the cooking stage and utensils in every image. Choose Approve storyboard when the frames look right.' : 'Your shots are set. Choose Generate missing frames, then check every image and approve the storyboard. Existing recipe photos are kept.';
 }
 if (s.busy) return 'We are reading the ingredients, instructions, and photos. Your storyboard appears after import.';
 if (s.tab === 'write') return 'Give your recipe a name, list ingredients one per line, and write one instruction per line. Then choose Continue to shot planning.';
 if (s.tab === 'json') return 'Paste your Recipe JSON, then choose Continue to shot planning.';
 return 'Paste a recipe link and choose Import, or switch to Recipe JSON or Write recipe.';
}
