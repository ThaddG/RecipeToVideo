import type {ReactNode} from 'react';
import {ArrowRight, ArrowUpRight, BookOpen, Check, Download, Image as ImageIcon, Plus, RotateCcw, Settings, Sparkles, X} from 'lucide-react';
import {ProductionControls} from '../production-controls';
import {imageModelLabel, modelCopy, videoModelLabel} from '../../lib/model-presentation';
import {imageModels, type GenerationSettings} from '../../lib/generation-settings';
import type {Recipe} from '../../lib/recipe';
import type {generationPlan} from '../../lib/video-jobs';

export type StudioModal = '' | 'images' | 'settings' | 'generate' | 'unknown' | 'ingredients' | 'new' | 'guide';

/** Backdrop and dialog frame shared by every studio dialog. */
export function ModalFrame({onClose, children}: {onClose: () => void; children: ReactNode}) {
 return <div className="modal-backdrop" onClick={onClose}>
  <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}>
   <button className="close-modal icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button>
   {children}
  </section>
 </div>;
}

export function ImagesModal({phase, force, count, generation, format, spendRemaining, onConfirm}: {
 phase: 'start' | 'end';
 force: boolean;
 count: number;
 generation: GenerationSettings;
 format: string;
 spendRemaining: number;
 onConfirm: () => void;
}) {
 const nano = generation.imageModel === 'nano', portrait = format === '9:16';
 return <>
  <div className="modal-symbol"><ImageIcon size={25}/></div>
  <h2 id="modal-title">{phase === 'end' ? 'Create the ending state.' : 'Build the missing moments.'}</h2>
  <p>{force ? 'Generate a new version of the selected frame.' : 'Generate or resume the missing storyboard frames.'} Planned shots use a shared kitchen reference; original recipe photos stay available for review.</p>
  <div className="render-summary">
   <span>Selected scenes<strong>{count}</strong></span>
   <span>{modelCopy('Image model', 'Image generation')}<strong>{imageModelLabel(generation.imageModel)}</strong></span>
   <span>Frame size<strong>{nano ? (portrait ? '768 × 1376' : '1376 × 768') : (portrait ? '1080 × 1920' : '1920 × 1080')}</strong></span>
   <span>Maximum new-image cost<strong>{count * imageModels[generation.imageModel].credits} credits</strong></span>
  </div>
  <p className="fineprint">This uses paid image-generation credits. Resumed tasks are reused. Images are saved on this device; no video is generated until you review and approve the storyboard.</p>
  <button className="primary full" disabled={count * imageModels[generation.imageModel].usd > spendRemaining} onClick={onConfirm}><Sparkles size={17}/>{phase === 'end' ? 'Generate ending frame' : 'Generate storyboard images'}</button>
 </>;
}

export type ProviderKeys = {apiKey: string; anthropicKey: string; geminiKey: string; falKey: string};

export function SettingsModal({keys, generation, locked, onKey, onGeneration, onConfirm}: {
 keys: ProviderKeys;
 generation: GenerationSettings;
 locked: boolean;
 onKey: (name: keyof ProviderKeys, value: string) => void;
 onGeneration: (settings: GenerationSettings) => void;
 onConfirm: () => void;
}) {
 const {apiKey, anthropicKey, geminiKey, falKey} = keys;
 return <>
  <div className="modal-symbol"><Settings size={24}/></div>
  <h2 id="modal-title">A little setup. A lot of magic.</h2>
  <p>{modelCopy('Connect Runway for images, Anthropic for shot planning, and optionally fal for MiniMax or Kling video. Add only the connections you want to use.', 'Connect your image service and Anthropic planning account, plus an optional service for alternative video options. Add only the connections you want to use.')}</p>
  <label className="setting-label" htmlFor="api-key">{modelCopy('Runway API key', 'Image service API key')}</label>
  <input id="api-key" autoFocus type="password" autoComplete="off" placeholder={modelCopy('Paste your Runway API key', 'Paste your image service API key')} value={apiKey} onChange={e => onKey('apiKey', e.target.value.trim())}/>
  <label className="setting-label" htmlFor="anthropic-key">Planning service API key · Anthropic</label>
  <input id="anthropic-key" type="password" autoComplete="off" placeholder="Anthropic API key for shot planning" value={anthropicKey} onChange={e => onKey('anthropicKey', e.target.value.trim())}/>
  <a className="external-link" href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">Get an Anthropic planning API key<ArrowUpRight size={14}/></a>
  <p className="fineprint">Both planning approaches use this key. API credits are billed by Anthropic; your image-service and Google keys do not work here.</p>
  <details>
   <summary>Previous Google planning connection</summary>
   <label className="setting-label" htmlFor="gemini-key">{modelCopy('Google API key · previous planner', 'Previous Google planning key · optional diagnostics')}</label>
   <input id="gemini-key" type="password" autoComplete="off" placeholder={modelCopy('Google API key', 'Previous Google planning key')} value={geminiKey} onChange={e => onKey('geminiKey', e.target.value.trim())}/>
   <a className="external-link" href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">{modelCopy('Get a Gemini key', 'Get a Google diagnostics key')}<ArrowUpRight size={14}/></a>
  </details>
  <label className="setting-label" htmlFor="fal-key">{modelCopy('fal API key · MiniMax / Kling', 'Alternative video service API key')}</label>
  <input id="fal-key" type="password" autoComplete="off" placeholder={modelCopy('fal API key', 'Alternative video service API key')} value={falKey} onChange={e => onKey('falKey', e.target.value.trim())}/>
  <a className="external-link" href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer">{modelCopy('Get a fal key', 'Get an alternative video service key')}<ArrowUpRight size={14}/></a>
  <ProductionControls settings={generation} disabled={locked} onChange={onGeneration}/>
  <div className="security-note">Your keys stay in memory for this tab and are sent through our server only to their corresponding providers. Keys are never saved to your projects.</div>
  <a className="external-link" href="https://dev.runwayml.com/" target="_blank" rel="noreferrer">{modelCopy('Get a Runway API key', 'Get an image service API key')}<ArrowUpRight size={14}/></a>
  <button className="primary full" disabled={!apiKey && !anthropicKey && !geminiKey && !falKey} onClick={onConfirm}>Use these connections<Check size={16}/></button>
  <p className="fineprint">Each provider bills its own API account. No key is checked or charged until you request an operation.</p>
 </>;
}

type ResumePlan = ReturnType<typeof generationPlan>;
const plural = (n: number) => n === 1 ? '' : 's';

export function GenerateModal({recipeName, plan, targets, hasVideoJobs, approved, locked, newVideoSeconds, newCredits, spendRemaining, videoModel, onCheckProgress, onGenerate}: {
 recipeName: string;
 plan: ResumePlan;
 /** Specific shots to generate, or null for the whole video. */
 targets: number[] | null;
 hasVideoJobs: boolean;
 approved: boolean;
 locked: boolean;
 newVideoSeconds: number;
 newCredits: number;
 spendRemaining: number;
 videoModel: GenerationSettings['videoModel'];
 onCheckProgress: () => void;
 onGenerate: () => void;
}) {
 return <>
  <div className="modal-symbol"><Sparkles size={25}/></div>
  <h2 id="modal-title">{targets ? `Create shot ${targets[0] + 1}?` : hasVideoJobs ? 'Continue this video?' : 'Create your video clips?'}</h2>
  <p>{hasVideoJobs ? 'Keep completed clips and continue unfinished scenes for ' : 'Generate video clips for '}<strong>{recipeName}</strong>.</p>
  <div className="render-summary">
   <span>Completed clips to keep<strong>{plan.completed.length}</strong></span>
   <span>Existing tasks to check · no new charge<strong>{plan.tracking.length}</strong></span>
   <span>Scenes not started<strong>{plan.fresh.length}</strong></span>
   <span>Failed or missing scenes to retry<strong>{plan.retry.length}</strong></span>
   <span>Unconfirmed submissions · recover task ID<strong>{plan.uncertain.length}</strong></span>
   <span>New paid generations<strong>{plan.newCount}</strong></span>
   <span>New video duration<strong>{newVideoSeconds} seconds</strong></span>
   <span>Estimated new video cost<strong>${newCredits.toFixed(2)} USD</strong></span>
  </div>
  <p className="fineprint">Completed clips will not be regenerated. Existing task IDs are polled again. Only {plan.newCount} new or retry scene{plural(plan.newCount)} would start a paid generation ({newVideoSeconds} generated seconds total, {videoModelLabel(videoModel)}). Images and planning are separate. Estimates use current published rates; review provider pricing before spending. <a href="https://docs.dev.runwayml.com/guides/pricing/" target="_blank" rel="noreferrer">{modelCopy('Runway pricing', 'Generation pricing')}</a>.</p>
  {newCredits > spendRemaining && <p className="video-inline-error">This request exceeds the remaining project spending limit. Adjust the limit in Generation & spending.</p>}
  {plan.uncertain.length > 0 && <p className="video-inline-error">Recover the unconfirmed task IDs before continuing to avoid duplicate charges.</p>}
  {plan.newCount > 0 && !approved && <p className="video-inline-error">Review and approve the storyboard before creating new scenes. You can check existing tasks now.</p>}
  {hasVideoJobs && <button className="secondary full" disabled={locked} onClick={onCheckProgress}><RotateCcw size={15}/>Check existing tasks only · no new credits</button>}
  <button className="primary full" disabled={locked || plan.uncertain.length > 0 || (plan.newCount > 0 && !approved) || newCredits > spendRemaining} onClick={onGenerate}><Sparkles size={17}/>{targets ? `Generate only shot ${targets[0] + 1}` : hasVideoJobs ? `Continue · create ${plan.newCount} new scene${plural(plan.newCount)}` : `Generate ${plan.newCount} video clips`}</button>
 </>;
}

export function UnknownTaskModal({scene, onBack, onConfirm}: {scene: number; onBack: () => void; onConfirm: () => void}) {
 return <>
  <div className="modal-symbol"><RotateCcw size={25}/></div>
  <h2 id="modal-title">Review the unconfirmed request.</h2>
  <p>The provider may have accepted scene {scene} before the connection was lost. First check its task history for a matching generation. Connect the original generation service and link that task ID if it exists.</p>
  <p>If you have confirmed that no matching task exists, you can mark this scene as not submitted. A later resume will show the cost and require confirmation before creating a replacement.</p>
  <button className="secondary full" onClick={onBack}>Go back and recover the task</button>
  <button className="primary full" onClick={onConfirm}>I checked · mark as not submitted</button>
 </>;
}

export function IngredientsModal({recipe, onExport}: {recipe: Recipe; onExport: () => void}) {
 return <>
  <div className="eyebrow">THE GOOD STUFF</div>
  <h2 id="modal-title">What goes in.</h2>
  <p>{recipe.name}</p>
  <ul className="ingredients">{recipe.ingredients.map((s, i) => <li key={i}><Check size={15}/>{s}</li>)}</ul>
  <button className="secondary full" onClick={onExport}><Download size={16}/>Export Recipe JSON</button>
 </>;
}

export function NewProjectModal({onSaveAndStart, onStart}: {onSaveAndStart: () => void; onStart: () => void}) {
 return <>
  <div className="modal-symbol"><Plus size={26}/></div>
  <h2 id="modal-title">Something new is cooking.</h2>
  <p>Save your current project before starting a fresh recipe.</p>
  <button className="primary full" onClick={onSaveAndStart}>Save & start fresh<ArrowRight size={16}/></button>
  <button className="text-button full" onClick={onStart}>Start without saving</button>
 </>;
}

export function GuideModal() {
 return <>
  <div className="modal-symbol"><BookOpen size={25}/></div>
  <h2 id="modal-title">From recipe to reel.</h2>
  <ol className="guide-list">
   <li><strong>Bring your recipe.</strong><p>Import a recipe URL, paste Recipe JSON, or write a recipe. If a site blocks automatic import, use the Send to Simmer bookmark from the recipe page, or upload its saved HTML file.</p></li>
   <li><strong>Set the scene.</strong><p>First create and apply an AI shot plan, or choose Keep imported steps. Then generate only the missing storyboard images. Check the cooking stages and continuity, edit directions as needed, and approve the complete storyboard before generating video.</p></li>
   <li><strong>Create & share.</strong><p>Connect your generation service, generate your scenes, choose optional original background music and export one video with step captions. Keep this tab open during export.</p></li>
  </ol>
  <p className="fineprint">Projects are stored on this device. Provider download links can expire; export completed videos promptly. AI footage may vary from instructions—review it before sharing.</p>
 </>;
}
