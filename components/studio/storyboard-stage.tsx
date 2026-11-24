import type {ReactNode} from 'react';
import {ArrowRight, Check, CheckCircle2, ChefHat, Leaf, LoaderCircle, Sparkles} from 'lucide-react';
import type {Recipe} from '../../lib/recipe';
import type {StoryboardFrame} from '../../lib/storyboard';
import type {VideoJob} from '../../lib/video-jobs';
import type {Storyboard} from './storyboard-type';

const frameInProgress = (frame?: StoryboardFrame) => ['PENDING', 'RUNNING', 'THROTTLED'].includes(frame?.status || '');

function FrameSettings({format, style, useImages, locked, onFormat, onStyle, onUseImages}: {
 format: string;
 style: string;
 useImages: boolean;
 locked: boolean;
 onFormat: (format: string) => void;
 onStyle: (style: string) => void;
 onUseImages: (useImages: boolean) => void;
}) {
 return <details className="guided-frame-settings">
  <summary>Frame format & visual style <span>{format === '9:16' ? 'Portrait' : 'Landscape'} · {style}</span></summary>
  <div className="planner-preference-fields">
   <label>Frame format<select value={format} disabled={locked} onChange={e => onFormat(e.target.value)}><option value="9:16">Portrait · 9:16</option><option value="16:9">Landscape · 16:9</option></select></label>
   <label>Visual style<select value={style} disabled={locked} onChange={e => onStyle(e.target.value)}><option>Cinematic</option><option>Overhead</option><option>Rustic</option></select></label>
   <label className="guided-checkbox"><input type="checkbox" checked={useImages} disabled={locked} onChange={e => onUseImages(e.target.checked)}/>Keep recipe photos</label>
  </div>
  <p>Choose these before generating images. Changing them later requires reviewing the storyboard again.</p>
 </details>;
}

function frameOrigin(job: VideoJob | undefined, board: Storyboard, i: number, imageMatch?: string) {
 if (job?.status === 'SUCCEEDED') return 'Video ready · click to play';
 if (job?.id) return `Video ${job.status.toLowerCase()}`;
 if (!board.sources[i]) return 'Needs an image';
 return board.generated(i) ? 'AI-generated frame' : imageMatch ? 'Suggested article photo' : 'Recipe / supplied photo';
}

function SceneGrid({recipe, frames, jobs, board, selected, sceneSeconds, locked, onPreview}: {
 recipe: Recipe;
 frames: StoryboardFrame[];
 jobs: VideoJob[];
 board: Storyboard;
 selected: number;
 sceneSeconds: number[];
 locked: boolean;
 onPreview: (index: number) => void;
}) {
 return <div className="scene-grid">
  {recipe.steps.map((s, i) => <button className={`scene-card ${selected === i ? 'selected' : ''}`} key={i} disabled={locked} onClick={() => onPreview(i)}>
   <div className={`scene-image scene-${i % 4}`}>
    {board.sources[i]
     ? <img src={board.sources[i]} alt={`Storyboard frame for ${s.title}`} onError={() => board.markBroken(i, board.sources[i]!)}/>
     : <div className="scene-illustration">{frameInProgress(frames[i]) ? <LoaderCircle className="spin"/> : i % 3 === 0 ? <ChefHat/> : i % 3 === 1 ? <Leaf/> : <Sparkles/>}<span>{frameInProgress(frames[i]) ? 'Generating frame' : 'Missing frame'}</span></div>}
    <span className="scene-number">{String(i + 1).padStart(2, '0')}</span>
    <span className="scene-duration">{sceneSeconds[i]}s</span>
    {jobs[i]?.status === 'SUCCEEDED' && <span className="scene-done"><Check size={13}/></span>}
   </div>
   <span className="frame-origin">{frameOrigin(jobs[i], board, i, s.imageMatch)}</span>
   <h3>{s.title}</h3>
   <p>{s.text}</p>
  </button>)}
 </div>;
}

export function StoryboardStage({recipe, frames, jobs, board, format, style, useImages, selected, sceneSeconds, totalSeconds, locked, busy, approved, shotsChosen, canEditMissing, onFormat, onStyle, onUseImages, onGenerateMissing, onApprove, onContinue, onNewVersion, onPreview, children}: {
 recipe: Recipe;
 frames: StoryboardFrame[];
 jobs: VideoJob[];
 board: Storyboard;
 format: string;
 style: string;
 useImages: boolean;
 selected: number;
 sceneSeconds: number[];
 totalSeconds: number;
 locked: boolean;
 busy: boolean;
 approved: boolean;
 shotsChosen: boolean;
 /** Every missing or pending frame belongs to a shot that may still be edited. */
 canEditMissing: boolean;
 onFormat: (format: string) => void;
 onStyle: (style: string) => void;
 onUseImages: (useImages: boolean) => void;
 onGenerateMissing: () => void;
 onApprove: () => void;
 onContinue: () => void;
 onNewVersion: () => void;
 onPreview: (index: number) => void;
 /** Details for the selected scene. */
 children: ReactNode;
}) {
 const matched = recipe.steps.filter(s => s.imageMatch).length;
 return <section className="storyboard">
  <FrameSettings format={format} style={style} useImages={useImages} locked={locked} onFormat={onFormat} onStyle={onStyle} onUseImages={onUseImages}/>
  <div className="section-heading">
   <div><h2>Generate and review storyboard images</h2><p>{recipe.steps.some(s => s.imageMatch) ? `${matched} article photos matched to steps. Select a scene to review or change its photo.` : 'Your recipe, one delicious moment at a time.'}</p></div>
   <span className="plain-badge">{recipe.steps.length} scenes · {totalSeconds}s</span>
  </div>
  <div className="storyboard-workflow">
   <div>
    <strong>{board.sources.filter(Boolean).length} of {recipe.steps.length} frames ready</strong>
    <p>{approved ? 'Storyboard approved. Next: generate video clips.' : !shotsChosen ? 'Before generating images, create and apply a shot plan above, or choose Keep imported steps. The imported photos below are already available.' : board.ready ? 'All frames are ready. Review them, then approve the storyboard to continue to video.' : 'Generate only the missing images. Check food state, cookware and consistency, then choose Approve storyboard to continue to video.'}</p>
   </div>
   <div className="storyboard-buttons">
    {board.generating
     ? <button className="secondary" onClick={() => board.pause()}><LoaderCircle className="spin" size={14}/>Pause images</button>
     : board.missing.length || board.pending.length
      ? <button className="primary" disabled={!shotsChosen || locked || busy || !canEditMissing || (!board.missing.length && !board.pending.length)} onClick={onGenerateMissing}><Sparkles size={14}/>{board.pending.length ? 'Resume images' : `Generate ${board.missing.length} missing frames`}</button>
      : null}
    <button className="secondary" disabled={!shotsChosen || !board.ready || locked || busy || approved} onClick={onApprove}><CheckCircle2 size={14}/>{approved ? 'Approved' : 'Approve & continue to video'}</button>
    {approved && <button className="primary" disabled={locked} onClick={onContinue}>Continue to video<ArrowRight size={14}/></button>}
   </div>
   {jobs.some(Boolean) && <div className="storyboard-version"><span>Keep the existing render and start a new version to change its frames.</span><button className="text-button" disabled={locked} onClick={onNewVersion}>Save & start new version<ArrowRight size={13}/></button></div>}
  </div>
  <SceneGrid recipe={recipe} frames={frames} jobs={jobs} board={board} selected={selected} sceneSeconds={sceneSeconds} locked={locked} onPreview={onPreview}/>
  {children}
 </section>;
}
