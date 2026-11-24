import {ArrowRight, Clock, Download, Film, LoaderCircle, Music2, RotateCcw, Sparkles, VolumeX} from 'lucide-react';
import {ClipReview} from '../production-controls';
import {modelCopy, publicGenerationText} from '../../lib/model-presentation';
import type {Recipe} from '../../lib/recipe';
import {failureMessage, type VideoJob} from '../../lib/video-jobs';

const retryable = ['FAILED', 'CANCELLED', 'DELETED', 'MISSING', 'NOT_SUBMITTED'];

/** Whether a single shot can be (re)generated on its own. */
function singleShotBlocked(job?: VideoJob) {
 return job?.status === 'SUCCEEDED' || !!job?.id && job?.status !== 'REJECTED' && !retryable.includes(job?.status || '');
}

function SceneStatus({recipe, jobs, locked, recoveryScene, recoveryTask, uncertain, onRecoveryScene, onRecoveryTask, onRecover, onUnknown}: {
 recipe: Recipe;
 jobs: VideoJob[];
 locked: boolean;
 recoveryScene: number;
 recoveryTask: string;
 /** Scenes whose submission was never confirmed. */
 uncertain: number[];
 onRecoveryScene: (index: number) => void;
 onRecoveryTask: (id: string) => void;
 onRecover: () => void;
 onUnknown: () => void;
}) {
 return <details className="video-task-details">
  <summary>Scene status & task recovery</summary>
  <ol>{recipe.steps.map((step, i) => <li key={i}>
   <strong>Scene {i + 1}: {jobs[i]?.status?.toLowerCase().replaceAll('_', ' ') || 'not started'}</strong>
   {jobs[i]?.id && <code>{jobs[i].id}</code>}
   {jobs[i]?.requestId && !jobs[i].id && <code>Submission reference: {jobs[i].requestId}</code>}
   {jobs[i]?.failure && <p>{publicGenerationText(failureMessage(jobs[i].failure))}</p>}
  </li>)}</ol>
  <p>If a request was interrupted before its ID was saved, copy the matching task ID from your provider task history. Linking an ID only checks the task; it does not create a paid generation.</p>
  <label>Scene to recover<select value={recoveryScene} disabled={locked} onChange={e => onRecoveryScene(Number(e.target.value))}>{recipe.steps.map((_, i) => <option key={i} value={i} disabled={!!jobs[i]?.id}>Scene {i + 1}</option>)}</select></label>
  <label>Provider task ID<input value={recoveryTask} disabled={locked} onChange={e => onRecoveryTask(e.target.value.trim())} placeholder="Task ID from the selected provider"/></label>
  <button className="secondary full" disabled={locked || !recoveryTask || !!jobs[recoveryScene]?.id} onClick={onRecover}>Link existing task · no new credits</button>
  {uncertain.includes(recoveryScene) && <button className="text-button full" disabled={locked} onClick={onUnknown}>{modelCopy('No matching task exists in Runway', 'No matching task exists in the generation service')}</button>}
 </details>;
}

export function GenerateSection({recipe, jobs, selected, locked, busy, approved, hasVideoJobs, checking, rendering, allReady, progress, complete, music, videoNotice, error, videoModelName, totalSeconds, recoveryScene, recoveryTask, uncertain, onGenerateOne, onReview, onUpload, onRestorePrevious, onCheckProgress, onPauseMonitoring, onExport, onGenerate, onDownloadScene, onRecoveryScene, onRecoveryTask, onRecover, onUnknown}: {
 recipe: Recipe;
 jobs: VideoJob[];
 selected: number;
 locked: boolean;
 busy: boolean;
 approved: boolean;
 hasVideoJobs: boolean;
 checking: boolean;
 rendering: boolean;
 allReady: boolean;
 /** Export progress from 0 to 1, or -1 when not exporting. */
 progress: number;
 complete: number;
 music: string;
 videoNotice: string;
 error: string;
 videoModelName: string;
 totalSeconds: number;
 recoveryScene: number;
 recoveryTask: string;
 uncertain: number[];
 onGenerateOne: () => void;
 onReview: (accept: boolean) => void;
 onUpload: (file: File) => void;
 onRestorePrevious: () => void;
 onCheckProgress: () => void;
 onPauseMonitoring: () => void;
 onExport: () => void;
 onGenerate: () => void;
 onDownloadScene: () => void;
 onRecoveryScene: (index: number) => void;
 onRecoveryTask: (id: string) => void;
 onRecover: () => void;
 onUnknown: () => void;
}) {
 const job = jobs[selected];
 return <div className="generate-section">
  {recipe.steps.length > 1 && <details className="guided-single-shot"><summary>Test or regenerate one scene</summary><button className="secondary full" disabled={locked || busy || !approved || singleShotBlocked(job)} onClick={onGenerateOne}>Generate only shot {selected + 1}</button></details>}
  <details className="guided-clip-review" open={job?.status === 'SUCCEEDED' || job?.status === 'REJECTED'}>
   <summary>{job ? 'Review or replace this clip' : 'Use your own footage (optional)'}</summary>
   <ClipReview job={job} disabled={locked || busy} onAccept={() => onReview(true)} onReject={() => onReview(false)} onRestore={() => onReview(true)} onUpload={onUpload} onRestorePrevious={onRestorePrevious}/>
  </details>
  {hasVideoJobs && <button className="secondary full check-progress" disabled={locked || busy} onClick={onCheckProgress}>{checking ? <LoaderCircle className="spin" size={14}/> : <RotateCcw size={14}/>}Check progress · no new credits</button>}
  {videoNotice && <p className="video-notice" role="status">{publicGenerationText(videoNotice)}</p>}
  {error && hasVideoJobs && <p className="video-inline-error" role="alert">{publicGenerationText(error)}</p>}
  {rendering
   ? <>
    <div className="render-status"><LoaderCircle size={18} className="spin"/><div><strong>Something good is cooking…</strong><span>{complete} of {recipe.steps.length} scenes ready</span></div></div>
    <div className="progress-track"><span style={{width: `${complete / recipe.steps.length * 100}%`}}/></div>
    <button className="secondary full" onClick={onPauseMonitoring}>Pause monitoring</button>
   </>
   : allReady
    ? <>
     <button className="primary generate" disabled={progress >= 0} onClick={onExport}>{progress >= 0 ? <LoaderCircle className="spin" size={18}/> : <Download size={18}/>} {progress >= 0 ? `Exporting ${Math.round(progress * 100)}%` : 'Export video'}<ArrowRight size={17}/></button>
     <p className="generation-note">{music === 'none' ? 'Silent video' : 'Video with background music'} · keep this tab visible</p>
    </>
    : <>
     <button className="primary generate" disabled={locked || busy || recipe.steps.some(s => !s.text.trim()) || (!approved && !hasVideoJobs)} onClick={onGenerate}><Sparkles size={18}/>{hasVideoJobs ? 'Review & resume unfinished scenes' : 'Generate video'}<ArrowRight size={17}/></button>
     <p className="generation-note">{hasVideoJobs ? 'Completed clips are kept · only new or retry scenes use credits' : !approved ? 'Complete and approve your storyboard first' : `${videoModelName} · uses the selected provider’s credits`}</p>
    </>}
  {job?.status === 'SUCCEEDED' && <button className="text-button full" disabled={busy || locked} onClick={onDownloadScene}><Download size={13}/>Download scene {selected + 1} · MP4</button>}
  {hasVideoJobs && <SceneStatus recipe={recipe} jobs={jobs} locked={locked} recoveryScene={recoveryScene} recoveryTask={recoveryTask} uncertain={uncertain} onRecoveryScene={onRecoveryScene} onRecoveryTask={onRecoveryTask} onRecover={onRecover} onUnknown={onUnknown}/>}
  <div className="output-spec"><span><Film size={13}/>720p HD</span><span><Clock size={13}/>{totalSeconds} seconds</span><span>{music === 'none' ? <VolumeX size={13}/> : <Music2 size={13}/>} {music === 'none' ? 'Silent' : 'Music'}</span></div>
 </div>;
}
