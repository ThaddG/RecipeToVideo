import type {RefObject} from 'react';
import {ChefHat, Film, Image as ImageIcon, LoaderCircle, Pause, Play} from 'lucide-react';
import {publicGenerationText} from '../../lib/model-presentation';
import type {Recipe, Scene} from '../../lib/recipe';
import type {VideoJob} from '../../lib/video-jobs';

export type PreviewMode = 'video' | 'storyboard';

function VideoPlaceholder({job, selected, loading, error, canRead, onLoadClip}: {
 job?: VideoJob;
 selected: number;
 loading: boolean;
 error: string;
 canRead: boolean;
 onLoadClip: () => void;
}) {
 const scene = selected + 1;
 return <div className="video-placeholder">
  {loading ? <LoaderCircle size={30} className="spin"/> : <Film size={32}/>}
  <strong>{loading ? `Loading scene ${scene} video…` : job?.status === 'SUCCEEDED' ? `Scene ${scene} video ready` : `No video for scene ${scene} yet`}</strong>
  <p>{publicGenerationText(error) || (!job?.id ? 'Generate this scene to watch its video. Its storyboard image is available in the other preview mode.' : job?.status === 'SUCCEEDED' ? 'Load the existing clip to watch it. This does not regenerate it.' : `Provider task: ${job.status.toLowerCase()}. Use Check progress to retrieve its latest status.`)}</p>
  {job?.status === 'SUCCEEDED' && !loading && <button className="secondary" onClick={onLoadClip}>{canRead ? 'Load existing clip' : 'Connect provider to retrieve clip'}</button>}
 </div>;
}

function StoryboardPreview({recipe, scene, selected, photo, playing, sceneSeconds, totalSeconds, onPhotoError, onTogglePlay}: {
 recipe: Recipe;
 scene: Scene;
 selected: number;
 photo?: string;
 playing: boolean;
 sceneSeconds: number[];
 totalSeconds: number;
 onPhotoError: (photo: string) => void;
 onTogglePlay: () => void;
}) {
 return <>
  {photo ? <img src={photo} alt="Recipe storyboard preview" onError={() => onPhotoError(photo)}/> : <div className="preview-placeholder"><ChefHat size={60}/></div>}
  <div className="preview-shade"/>
  <div className="preview-brand"><ChefHat size={15}/>simmer.</div>
  <button className="play-button" aria-label={playing ? 'Pause storyboard images' : 'Play storyboard images'} onClick={onTogglePlay}>{playing ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor"/>}</button>
  <div className="preview-caption">
   <span>{playing ? `STEP ${selected + 1}` : 'STORYBOARD IMAGE'}</span>
   <h3>{playing ? scene.title : recipe.name}</h3>
   <div className="preview-divider"/>
   <small>{playing ? scene.text : 'Still-image storyboard · not generated video'}</small>
  </div>
  <span className="preview-time">{String(sceneSeconds.slice(0, selected).reduce((sum, n) => sum + n, 0)).padStart(2, '0')} / {totalSeconds}s</span>
 </>;
}

export function VideoPreview({recipe, scene, selected, jobs, format, mode, mediaURL, loading, error, canRead, playing, photo, sceneSeconds, totalSeconds, complete, allReady, locked, playerRef, onSelect, onShowVideo, onShowStoryboard, onClipEnded, onVideoError, onLoadClip, onPhotoError, onTogglePlay, onPlayReady}: {
 recipe: Recipe;
 scene: Scene;
 selected: number;
 jobs: VideoJob[];
 format: string;
 mode: PreviewMode;
 mediaURL: string;
 loading: boolean;
 error: string;
 /** The provider key needed to download the selected clip is present. */
 canRead: boolean;
 playing: boolean;
 photo?: string;
 sceneSeconds: number[];
 totalSeconds: number;
 complete: number;
 allReady: boolean;
 locked: boolean;
 playerRef: RefObject<HTMLVideoElement | null>;
 onSelect: (index: number) => void;
 onShowVideo: () => void;
 onShowStoryboard: () => void;
 onClipEnded: () => void;
 onVideoError: () => void;
 onLoadClip: () => void;
 onPhotoError: (photo: string) => void;
 onTogglePlay: () => void;
 onPlayReady: () => void;
}) {
 return <>
  <div className="section-heading"><h2>{allReady ? 'Preview & export your video' : 'Create your video clips'}</h2><span className="preview-badge">{mode === 'video' ? 'VIDEO CLIPS' : 'STORYBOARD IMAGES'}</span></div>
  <label className="guided-scene-select">Scene to preview<select value={selected} disabled={locked} onChange={e => onSelect(Number(e.target.value))}>{recipe.steps.map((step, i) => <option key={i} value={i}>Scene {i + 1} · {step.title}</option>)}</select></label>
  <div className="preview-mode" role="group" aria-label="Preview mode">
   <button aria-pressed={mode === 'video'} onClick={onShowVideo}><Film size={13}/>Video clips ({complete})</button>
   <button aria-pressed={mode === 'storyboard'} onClick={onShowStoryboard}><ImageIcon size={13}/>Storyboard images</button>
  </div>
  <div className={`preview-stage ${format === '16:9' ? 'landscape' : ''}`}>
   <div className="preview-frame">
    {mode === 'video'
     ? (mediaURL
      ? <video aria-label={`Generated video scene ${selected + 1}`} ref={playerRef} src={mediaURL} controls autoPlay playsInline onEnded={onClipEnded} onError={onVideoError}/>
      : <VideoPlaceholder job={jobs[selected]} selected={selected} loading={loading} error={error} canRead={canRead} onLoadClip={onLoadClip}/>)
     : <StoryboardPreview recipe={recipe} scene={scene} selected={selected} photo={photo} playing={playing} sceneSeconds={sceneSeconds} totalSeconds={totalSeconds} onPhotoError={onPhotoError} onTogglePlay={onTogglePlay}/>}
   </div>
  </div>
  {error && mediaURL && <p className="video-inline-error" role="alert">{error}</p>}
  <p className="preview-explanation">{mode === 'video' ? `Scene ${selected + 1} · ${complete} of ${recipe.steps.length} video clips complete` : 'Storyboard images only · switch to Video clips to watch generated footage'}</p>
  {complete > 0 && <button className="secondary full" disabled={locked || loading} onClick={onPlayReady}><Play size={14}/>Play completed clips ({complete})</button>}
 </>;
}
