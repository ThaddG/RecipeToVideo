import {Check, CheckCircle2, Clapperboard, FolderOpen, LoaderCircle} from 'lucide-react';
import type {Scene} from '../../lib/recipe';

export const stageHeadings = ['Every recipe has a story.', 'Plan your shots.', 'Build your storyboard.', 'Create your video.'];
export const stageLabels = ['Import recipe', 'Plan your shots', 'Storyboard images', 'Create your video'];
const steps = [['Import recipe', 'Ingredients, steps & photos'], ['Plan shots', 'AI plan or keep imported steps'], ['Storyboard images', 'Fill gaps, review & approve'], ['Generate video', 'Animate & export']];
const reviewTitles = ['Add your recipe', 'Review your shot plan', 'Review your storyboard images', 'Create your video'];

export function StudioHeading({activeStage, recipeName, canSave, onSave}: {
 activeStage: number;
 recipeName: string;
 canSave: boolean;
 onSave: () => void;
}) {
 return <div className="page-heading">
  <div><div className="eyebrow"><span/>FROM YOUR KITCHEN TO THEIR SCREEN</div><h1>{stageHeadings[activeStage]}</h1><p>{activeStage === 0 ? 'Turn your favorite recipes into videos worth savoring.' : recipeName}</p></div>
  <button className="secondary save-button" onClick={onSave} disabled={!canSave}><FolderOpen size={16}/>Save project</button>
 </div>;
}

export function WorkflowTracker({activeStage, phase, locked, working, allReady, title, description, scene, sceneNumber, onStage}: {
 activeStage: number;
 phase: number;
 locked: boolean;
 /** Any long-running task is in progress; shows a spinner. */
 working: boolean;
 allReady: boolean;
 title: string;
 description: string;
 /** The scene being generated right now, if any. */
 scene?: Scene;
 sceneNumber: number;
 onStage: (stage: number) => void;
}) {
 return <section className="workflow-tracker" aria-label="Recipe creation progress">
  <div className="workflow">
   {steps.map(([stepTitle, stepDescription], i) => <button type="button" disabled={locked || i > phase} onClick={() => onStage(i)} key={stepTitle} className={`workflow-step ${activeStage === i ? 'current' : phase > i ? 'finished' : ''}`} aria-current={activeStage === i ? 'step' : undefined}>
    <span>{phase > i ? <Check size={15}/> : i + 1}</span><strong>{stepTitle}</strong><small>{stepDescription}</small>
   </button>)}
  </div>
  <div className="workflow-description" role="status" aria-live="polite" aria-atomic="true">
   <div className="tracker-marker">{working ? <LoaderCircle className="spin" size={18}/> : allReady ? <CheckCircle2 size={18}/> : <Clapperboard size={18}/>}</div>
   <div>
    <strong>{activeStage === phase ? title : reviewTitles[activeStage]}</strong>
    <p>{activeStage === phase ? description : 'You are reviewing an earlier step. Your later work is kept. Continue when you are ready.'}</p>
    {scene && <p className="tracker-scene"><b>Scene {sceneNumber}: {scene.title}</b> — {scene.text}</p>}
   </div>
  </div>
 </section>;
}

export function GuidedNavigation({activeStage, locked, recipeName, onBack}: {
 activeStage: number;
 locked: boolean;
 /** Shown once a recipe has been added. */
 recipeName?: string;
 onBack: () => void;
}) {
 return <div className="guided-navigation">
  <button className="text-button" disabled={locked || activeStage === 0} onClick={onBack}>← Back</button>
  <span>Step {activeStage + 1} of 4</span>
  {recipeName !== undefined && <span className="guided-recipe-name">{recipeName}</span>}
 </div>;
}
