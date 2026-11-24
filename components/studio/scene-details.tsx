import {Download, PenLine, Sparkles} from 'lucide-react';
import ArticlePhotoPicker from '../article-photo-picker';
import {ShotStateEditor} from '../shot-workbench';
import {modelCopy} from '../../lib/model-presentation';
import type {Recipe, Scene} from '../../lib/recipe';
import {frameSignature, imagePrompt, motionPrompt, type StoryboardFrame} from '../../lib/storyboard';
import type {Storyboard} from './storyboard-type';

const unconfirmed = (status?: string) => ['SUBMISSION_UNKNOWN', 'SUBMITTING'].includes(status || '');
const validTaskId = (id: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(id);

function placeholder(prompt: () => string, fallback: string) {
 try {return prompt();} catch {return fallback;}
}

/** Lets the user link an image task whose submission was interrupted, or confirm none exists. */
function TaskRecovery({label, confirmLabel, locked, onNone, onLink}: {label: string; confirmLabel: string; locked: boolean; onNone: () => void; onLink: (id: string) => void}) {
 return <label>{label}<button className="text-button" disabled={locked} onClick={onNone}>{confirmLabel}</button><input placeholder="Paste the complete task ID, then leave this field" disabled={locked} onBlur={e => {const id = e.target.value.trim(); if (validTaskId(id)) onLink(id);}}/></label>;
}

export function SceneDetails({recipe, scene, selected, frame, board, format, style, endFrameSupported, locked, busy, editing, editable, shotsChosen, hasVideoJobs, onToggleEditing, onRecipe, onSceneChange, onUpdateFrame, onSplit, onRequestImages, onDownloadFrame}: {
 recipe: Recipe;
 scene: Scene;
 selected: number;
 frame?: StoryboardFrame;
 board: Storyboard;
 format: string;
 style: string;
 /** The current video model accepts an ending frame. */
 endFrameSupported: boolean;
 locked: boolean;
 busy: boolean;
 editing: boolean;
 /** The selected shot has no clip, or its clip failed. */
 editable: boolean;
 shotsChosen: boolean;
 hasVideoJobs: boolean;
 onToggleEditing: () => void;
 onRecipe: (recipe: Recipe) => void;
 /** Replaces the selected scene from the shot state editor. */
 onSceneChange: (scene: Scene) => void;
 onUpdateFrame: (index: number, change: Partial<StoryboardFrame>) => void;
 onSplit: () => void;
 onRequestImages: (indices: number[], force: boolean, phase?: 'start' | 'end') => void;
 onDownloadFrame: (index: number) => void;
}) {
 const updateScene = (change: (s: Scene) => Scene) => onRecipe({...recipe, steps: recipe.steps.map((s, i) => i === selected ? change(s) : s)});
 const endStatus = frame?.endStatus || '';
 return <details className="guided-scene-details">
  <summary>Scene {selected + 1}: review instructions & adjust image</summary>
  <div className="scene-detail">
   <span className="eyebrow">SCENE {String(selected + 1).padStart(2, '0')}</span>
   <button className="text-button" disabled={locked || !editable} onClick={onToggleEditing}><PenLine size={13}/>{editing ? 'Done' : 'Edit step'}</button>
   {editing
    ? <textarea aria-label="Edit recipe step" value={scene.text} onChange={e => updateScene(s => ({...s, text: e.target.value, ...(s.shot ? {shot: {...s.shot, action: e.target.value}} : {})}))}/>
    : <p>{scene.text}</p>}
   <ShotStateEditor scene={scene} bible={recipe.production?.bible} source={scene.shot ? recipe.production?.originalSteps[scene.shot.sourceStep - 1] : undefined} disabled={locked || !editable} onChange={onSceneChange}/>
   <label className="scene-image-input">Step photo <span>(optional HTTPS URL)</span><input type="url" placeholder="https://…" value={scene.image || ''} disabled={locked || !editable} onChange={e => updateScene(s => ({...s, image: e.target.value || undefined, imageMatch: undefined}))}/></label>
   <ArticlePhotoPicker recipe={recipe} scene={scene} disabled={locked || busy || !editable} onChoose={image => updateScene(s => ({...s, image, imageMatch: undefined}))}/>
   {unconfirmed(frame?.status) && <TaskRecovery label="Recover starting-image task ID" confirmLabel="I checked provider history · no matching image task" locked={locked}
    onNone={() => onUpdateFrame(selected, {status: 'NOT_SUBMITTED', taskId: undefined})}
    onLink={id => onUpdateFrame(selected, {taskId: id, taskSignature: frameSignature(recipe, selected, format, style, frame?.prompt), status: 'PENDING'})}/>}
   {unconfirmed(frame?.endStatus) && <TaskRecovery label="Recover ending-image task ID" confirmLabel="I checked provider history · no matching ending task" locked={locked}
    onNone={() => onUpdateFrame(selected, {endStatus: 'NOT_SUBMITTED', endTaskId: undefined})}
    onLink={id => onUpdateFrame(selected, {endTaskId: id, endTaskSignature: frameSignature(recipe, selected, format, style) + '/end', endStatus: 'PENDING'})}/>}
   <div className="frame-directions">
    <div className="frame-action-row">
     <button className="text-button" disabled={locked || busy || hasVideoJobs} onClick={onSplit}>Split step into shots</button>
     <button className="text-button" disabled={!shotsChosen || locked || busy || !editable} onClick={() => onRequestImages([selected], true)}><Sparkles size={13}/>{board.sources[selected] ? 'Regenerate frame' : 'Generate this frame'}</button>
     {board.sources[selected] && <button className="text-button" disabled={locked || busy} onClick={() => onDownloadFrame(selected)}><Download size={13}/>Save frame</button>}
    </div>
    <label>Image direction <small>Show the correct state at the start of the action.</small><textarea rows={3} maxLength={1000} value={frame?.prompt || ''} placeholder={placeholder(() => imagePrompt(recipe, selected, style), 'Describe one starting frame for this cooking action.')} disabled={locked || !editable} onChange={e => onUpdateFrame(selected, {prompt: e.target.value})}/></label>
    <label>Video motion <small>Describe one visible action for this shot.</small><textarea rows={2} maxLength={1000} value={frame?.motion || ''} placeholder={placeholder(() => motionPrompt(recipe, selected), 'Describe a single gentle movement.')} disabled={locked || !editable} onChange={e => onUpdateFrame(selected, {motion: e.target.value})}/></label>
   </div>
  </div>
  {(endFrameSupported || frame?.endImageURL || frame?.endImageKey || frame?.endStatus) && <div className="end-frame-control">
   {scene.shot && <button className="secondary" disabled={locked || busy || !editable || !board.sources[selected]} onClick={() => onRequestImages([selected], true, 'end')}>{frame?.endStatus && !['SUCCEEDED', 'FAILED', 'CANCELLED', 'DELETED'].includes(endStatus) ? 'Resume ending frame' : 'Generate ending frame'}</button>}
   <label>{modelCopy('Optional ending frame · MiniMax / Kling', 'Optional ending frame · compatible video options')}<input type="url" disabled={locked || !editable || ['PENDING', 'RUNNING', 'THROTTLED', 'SUBMITTING', 'SUBMISSION_UNKNOWN'].includes(endStatus)} placeholder="https://…" value={frame?.endImageURL || ''} onChange={e => onUpdateFrame(selected, {endImageURL: e.target.value || undefined, endImageKey: undefined, endStatus: undefined, endTaskId: undefined, endTaskSignature: undefined})}/></label>
   {frame?.endImageURL && <img className="end-frame-preview" src={frame.endImageURL} alt="Planned ending frame"/>}
   <p>{modelCopy('The ending image must show this shot’s ending state in the same kitchen. Gen-4.5 supports the starting frame only.', 'The ending image must show this shot’s ending state in the same kitchen. Ending-frame support depends on the current generation settings.')}</p>
  </div>}
  <div className="info-note"><Sparkles size={15}/><span>Generated images guide each shot. Split multi-action instructions before creating frames; keep captions faithful to the recipe.</span></div>
 </details>;
}
