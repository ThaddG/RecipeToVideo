'use client';
import {useState, useEffect, useRef} from 'react';
import {CheckCircle2, Leaf, ArrowRight, X} from 'lucide-react';
import {guidedStage, shotChoiceReady} from '../lib/studio-workflow';
import {timelineSeconds, shotSeconds, videoEstimate} from '../lib/shot-timing';
import {parseRecipe, sampleRecipe, type Recipe, type Scene} from '../lib/recipe';
import {exportVideo} from '../lib/export-video';
import {useStoryboard} from '../hooks/use-storyboard';
import {motionPrompt, splitScene, type StoryboardFrame} from '../lib/storyboard';
import {ShotWorkbench} from '../components/shot-workbench';
import {DIAGNOSTIC_RESERVATION_USD} from '../lib/planning-diagnostics';
import {plannerReservation} from '../lib/planning-config';
import {modelCopy, videoModelLabel, publicGenerationText} from '../lib/model-presentation';
import {defaultGenerationSettings, safeSettings, reserveSpend, reservedUSD, videoModels, type GenerationSettings} from '../lib/generation-settings';
import {readBrowserImport} from '../lib/browser-import';
import ProcessTour from '../components/process-tour';
import {generationPlan, failedJob, runVideoJobs, pollWithRetry, VideoRequestError, failureMessage, type VideoJob} from '../lib/video-jobs';
import {loadVideo, saveVideo} from '../lib/video-cache';
import {createMusicSession, isMusicChoice, musicVolume, type MusicChoice, type MusicSession} from '../lib/music';
import {emptyRecipe, seedProject, downloadBlob as download, fileStem, recipeSchema, type Project} from '../lib/project';
import {workflowTitle, workflowDescription} from '../lib/workflow-copy';
import {Sidebar} from '../components/studio/sidebar';
import {Topbar} from '../components/studio/topbar';
import {ExamplesView} from '../components/studio/examples-view';
import {ProjectsView} from '../components/studio/projects-view';
import {StudioHeading, WorkflowTracker, GuidedNavigation, stageLabels} from '../components/studio/workflow-tracker';
import {ExampleSession, RecipeEntry} from '../components/studio/recipe-entry';
import {RecipeSummary} from '../components/studio/recipe-summary';
import {StoryboardStage} from '../components/studio/storyboard-stage';
import {SceneDetails} from '../components/studio/scene-details';
import {VideoPreview, type PreviewMode} from '../components/studio/video-preview';
import {VideoSettings} from '../components/studio/video-settings';
import {GenerateSection} from '../components/studio/video-generate';
import {ModalFrame, ImagesModal, SettingsModal, GenerateModal, UnknownTaskModal, IngredientsModal, NewProjectModal, GuideModal, type StudioModal, type ProviderKeys} from '../components/studio/modals';

type Job = VideoJob;
type VideoRequest = Record<string, unknown> & {id?: string; model?: string; action?: string};
type ApiError = {error?: unknown; code?: string};

/** Statuses after which a provider task will not change again. */
const settled = ['SUCCEEDED', 'REJECTED'];
const usesFal = (model?: string) => model === 'minimax' || model === 'kling';

export default function Studio() {
 // Recipe and import
 const [recipe, setRecipe] = useState<Recipe>(emptyRecipe), [tab, setTab] = useState('url'), [url, setUrl] = useState(''), [json, setJson] = useState(''), [form, setForm] = useState({name: '', ingredients: '', steps: ''});
 const [importBlocked, setImportBlocked] = useState(false), [sampleChosen, setSampleChosen] = useState(false);
 // Video settings
 const [format, setFormat] = useState('9:16'), [style, setStyle] = useState('Cinematic'), [duration, setDuration] = useState(3), [captions, setCaptions] = useState(true), [useImages, setUseImages] = useState(true);
 const [music, setMusic] = useState<MusicChoice>('none'), [volume, setVolume] = useState(.35);
 const [generation, setGeneration] = useState<GenerationSettings>(defaultGenerationSettings), generationRef = useRef(generation);
 generationRef.current = generation;
 // Provider keys, held in memory only
 const [apiKey, setApiKey] = useState(''), [anthropicKey, setAnthropicKey] = useState(''), [geminiKey, setGeminiKey] = useState(''), [falKey, setFalKey] = useState('');
 // Shell, navigation and feedback
 const [view, setView] = useState('studio'), [sidebarOpen, setSidebarOpen] = useState(false), [modal, setModal] = useState<StudioModal>(''), [toast, setToast] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
 const [projects, setProjects] = useState<Project[]>([]), [projectId, setProjectId] = useState(''), [ready, setReady] = useState(false);
 const [stageOverride, setStageOverride] = useState<number | null>(null), stagePanel = useRef<HTMLDivElement>(null);
 // Storyboard
 const [frames, setFrames] = useState<StoryboardFrame[]>([]), [storyboardApproval, setStoryboardApproval] = useState(''), [imageTargets, setImageTargets] = useState<number[]>([]), [forceImages, setForceImages] = useState(false);
 const [imagePhase, setImagePhase] = useState<'start' | 'end'>('start'), [planning, setPlanning] = useState(false), [selected, setSelected] = useState(0), [editing, setEditing] = useState(false);
 // Video generation and preview
 const [jobs, setJobs] = useState<Job[]>([]), [rendering, setRendering] = useState(false), [progress, setProgress] = useState(-1), [videoTargets, setVideoTargets] = useState<number[] | null>(null);
 const [playing, setPlaying] = useState(false), [mediaURL, setMediaURL] = useState('');
 const [previewMode, setPreviewMode] = useState<PreviewMode>('video'), [previewLoading, setPreviewLoading] = useState(false), [previewError, setPreviewError] = useState(''), [previewNonce, setPreviewNonce] = useState(0), [playingClips, setPlayingClips] = useState(false);
 const [checking, setChecking] = useState(false), [videoNotice, setVideoNotice] = useState(''), [recoveryScene, setRecoveryScene] = useState(0), [recoveryTask, setRecoveryTask] = useState('');
 useEffect(() => setSidebarOpen(false), [view]);
 const activity = useRef(false), previewRequest = useRef(0);
 const board = useStoryboard({recipe, format, style, useImages, projectId, apiKey, frames, setFrames, onError: setError, onSelect: setSelected, imageModel: generation.imageModel, beforeCreate: (id, usd) => reserveRequest(id, usd, 'image'), onPersistFrames: persistFrames});
 const shotsChosen = shotChoiceReady(recipe, frames, jobs);
 const sceneSeconds = timelineSeconds(recipe, duration, generation.videoModel, jobs), totalSeconds = sceneSeconds.reduce((sum, n) => sum + n, 0);
 const workLocked = useRef(false), cancel = useRef(false), jobsRef = useRef<Job[]>([]), player = useRef<HTMLVideoElement>(null);
 jobsRef.current = jobs;

 // Restore saved work and accept recipes sent from the browser bookmarklet.
 useEffect(() => {
  try {
   let saved: Project[] = JSON.parse(localStorage.getItem('simmer-projects') || '[]');
   const draft: Project | null = JSON.parse(localStorage.getItem('simmer-draft') || 'null');
   const exampleDraft = draft && (draft.sampleChosen || JSON.stringify(draft.recipe) === JSON.stringify(sampleRecipe));
   if (draft && exampleDraft && (draft.sampleChosen || draft.frames?.some(Boolean) || draft.jobs?.some(Boolean))) {
    saved = [draft, ...saved.filter(p => p.id !== draft.id)];
    localStorage.setItem('simmer-projects', JSON.stringify(saved));
   }
   setProjects(saved);
   if (draft && !exampleDraft) load(draft);
   else setProjectId(crypto.randomUUID());
  } catch {setProjectId(crypto.randomUUID());}
  setReady(true);
  const receive = () => {
   try {
    const incoming = readBrowserImport(window.location.hash);
    if (incoming) {
     if (workLocked.current) {setError('Pause the current generation before importing another recipe.'); return;}
     setProjectId(crypto.randomUUID());
     apply(incoming);
     setUrl(incoming.source || '');
     setView('studio');
    }
   } catch (e) {setError(message(e));}
   finally {if (window.location.hash.startsWith('#import=')) window.history.replaceState(null, '', window.location.pathname + window.location.search);}
  };
  receive();
  window.addEventListener('hashchange', receive);
  return () => window.removeEventListener('hashchange', receive);
 }, []);
 // Autosave the draft and keep its saved project copy current.
 useEffect(() => {
  if (!ready) return;
  const p = {sampleChosen, id: projectId, recipe, format, style, duration, captions, useImages, music, musicVolume: volume, generation: generationRef.current, frames, storyboardApproval, jobs, updated: new Date().toISOString()};
  try {
   localStorage.setItem('simmer-draft', JSON.stringify(p));
   setProjects(previous => {
    if (!previous.some(x => x.id === p.id)) return previous;
    const next = previous.map(x => x.id === p.id ? p : x);
    try {localStorage.setItem('simmer-projects', JSON.stringify(next));} catch {}
    return next;
   });
  } catch {setError('Device storage is unavailable. Keep this tab open and export your work before leaving.');}
 }, [recipe, format, style, duration, captions, useImages, music, volume, frames, storyboardApproval, jobs, ready, projectId, sampleChosen, generation]);
 useEffect(() => {
  if (!modal) return;
  const escape = (e: KeyboardEvent) => {if (e.key === 'Escape') setModal('');};
  document.addEventListener('keydown', escape);
  return () => document.removeEventListener('keydown', escape);
 }, [modal]);
 useEffect(() => {
  if (!toast) return;
  const id = setTimeout(() => setToast(''), 4000);
  return () => clearTimeout(id);
 }, [toast]);
 // Advance the storyboard slideshow.
 useEffect(() => {
  if (!playing || previewMode !== 'storyboard') return;
  const id = setTimeout(() => setSelected(i => {if (i >= recipe.steps.length - 1) {setPlaying(false); return 0;} return i + 1;}), sceneSeconds[selected] * 1000);
  return () => clearTimeout(id);
 }, [playing, selected, sceneSeconds[selected], recipe.steps.length, previewMode]);
 useEffect(() => {return () => {if (mediaURL) URL.revokeObjectURL(mediaURL);};}, [mediaURL]);
 // Load the selected scene's clip for the video preview.
 useEffect(() => {
  const request = ++previewRequest.current;
  setMediaURL(''); setPreviewError(''); setPreviewLoading(false);
  if (previewMode !== 'video' || rendering || !jobs[selected]?.id || jobs[selected]?.status !== 'SUCCEEDED') return;
  setPreviewLoading(true);
  void videoBlob(jobs[selected])
   .then(blob => {if (request === previewRequest.current) setMediaURL(URL.createObjectURL(blob));})
   .catch(e => {if (request === previewRequest.current) setPreviewError(message(e));})
   .finally(() => {if (request === previewRequest.current) setPreviewLoading(false);});
  return () => {previewRequest.current++;};
 }, [selected, projectId, previewMode, previewNonce, apiKey, jobs[selected]?.id, jobs[selected]?.status, rendering]);

 // Projects
 function load(p: Project) {
  generationRef.current = safeSettings(p.generation); setGeneration(generationRef.current);
  setPreviewMode('video'); setPlayingClips(false); setPreviewError(''); setVideoNotice('');
  jobsRef.current = p.jobs || [];
  setSampleChosen(!!p.sampleChosen); setEditing(false); setFrames(p.frames || []); setStoryboardApproval(p.storyboardApproval || ''); setRecipe(p.recipe);
  setMusic(isMusicChoice(p.music) ? p.music : 'none'); setVolume(musicVolume(p.musicVolume ?? .35));
  setFormat(p.format); setStyle(p.style); setDuration(p.duration); setCaptions(p.captions); setUseImages(p.useImages);
  setJobs(p.jobs || []); setProjectId(p.id); setSelected(0); setPlaying(false); setMediaURL(''); setView('studio'); setError('');
 }
 function save() {
  if (!recipe.steps.length) return false;
  const p: Project = {sampleChosen, id: projectId, recipe, format, style, duration, captions, useImages, music, musicVolume: volume, generation: generationRef.current, frames, storyboardApproval, jobs, updated: new Date().toISOString()};
  const next = [p, ...projects.filter(x => x.id !== p.id)];
  try {
   localStorage.setItem('simmer-projects', JSON.stringify(next));
   setProjects(next);
   setToast('Project saved on this device.');
   return true;
  } catch {setError('Device storage is full. Export your recipe to keep a copy.'); return false;}
 }
 function apply(r: Recipe) {
  generationRef.current = defaultGenerationSettings(); setGeneration(generationRef.current);
  jobsRef.current = [];
  setVideoNotice(''); setPreviewError(''); setPreviewMode('video'); setPlayingClips(false); setSampleChosen(false); setEditing(false);
  setFrames([]); setStoryboardApproval(''); setImportBlocked(false); setRecipe(r); setJobs([]); setSelected(0); setPlaying(false); setMediaURL(''); setError('');
  setToast(`${r.steps.length} scenes added to your storyboard.`);
 }
 async function importRecipe() {
  setError(''); setImportBlocked(false); setBusy(true);
  try {
   if (tab === 'url') {
    const res = await fetch('/api/import', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url})});
    const data: ApiError & {recipe: Recipe} = await res.json();
    if (!res.ok) {setImportBlocked(data.code === 'WEBSITE_BLOCKED' || data.code === 'WEBSITE_UNAVAILABLE'); throw new Error(data.error as string);}
    apply(data.recipe);
   } else if (tab === 'json') apply(parseRecipe(json));
   else apply(parseRecipe({'@type': 'Recipe', name: form.name, recipeIngredient: form.ingredients.split('\n').filter(Boolean), recipeInstructions: form.steps.split('\n').filter(Boolean)}));
  } catch (e) {setError(message(e));} finally {setBusy(false);}
 }
 function resetEntry() {setTab('url'); setUrl(''); setJson(''); setForm({name: '', ingredients: '', steps: ''});}
 function startFresh() {load(seedProject()); resetEntry(); setModal('');}
 function startExample() {
  if (recipe.steps.length && !save()) return;
  load({...seedProject(), recipe: sampleRecipe, sampleChosen: true});
  resetEntry();
  setToast('Example loaded. Review the steps and try building its storyboard.');
 }
 function stopExample() {if ((frames.some(Boolean) || jobs.some(Boolean)) && !save()) return; startFresh(); setToast('Example closed. You can import your own recipe.');}
 function openNew() {setSidebarOpen(false); if (recipe.steps.length) setModal('new'); else {startFresh(); setView('studio');}}
 function newVideoVersion() {
  if (!save()) return;
  setProjectId(crypto.randomUUID()); jobsRef.current = []; setJobs([]); setMediaURL(''); setStoryboardApproval(''); setError('');
  setToast('Existing render saved. This version can use a new storyboard.');
 }
 function message(e: unknown) {return publicGenerationText(e instanceof Error ? e.message : 'Something went wrong. Please try again.');}

 // Storyboard
 function editableShot(i: number) {return !jobsRef.current[i] || failedJob(jobsRef.current[i]);}
 function requestImages(indices: number[], force = false, phase: 'start' | 'end' = 'start') {
  if (!shotsChosen) {setError('First create and apply a shot plan, or choose Keep imported steps to continue without AI planning.'); return;}
  setImagePhase(phase);
  if (jobs.some(Boolean) && !indices.every(i => editableShot(i))) {setError('Reject the shot you want to revise first. Other completed clips stay unchanged.'); return;}
  if (!apiKey) {setModal('settings'); return;}
  setImageTargets(indices); setForceImages(force); setModal('images');
 }
 function updateFrame(index: number, change: Partial<StoryboardFrame>) {setStoryboardApproval(''); setFrames(previous => {const next = [...previous]; next[index] = {...next[index], ...change}; return next;});}
 function splitSelected() {
  if (recipe.production) {setError('Edit the planned action and its states directly. Each planned shot should contain one visible action.'); return;}
  const shots = splitScene(recipe.steps[selected]);
  if (shots.length < 2) {setError('This step already reads as one shot. Edit the step to describe a single visible action.'); return;}
  if (recipe.steps.length + shots.length - 1 > 30) {setError('Keep this video to 30 scenes or fewer.'); return;}
  setFrames([]); setJobs([]); setStoryboardApproval('');
  setRecipe({...recipe, steps: [...recipe.steps.slice(0, selected), ...shots, ...recipe.steps.slice(selected + 1)]});
  setToast('Step split into shots. Review the instructions and generate a frame for each.');
 }
 async function downloadFrame(index: number) {
  setBusy(true);
  try {
   const value = await board.input(index);
   const response = await fetch(value);
   if (!response.ok) throw new Error('Could not download this photo. Open its source website instead.');
   download(await response.blob(), `storyboard-scene-${index + 1}.jpg`);
  } catch (e) {setError(message(e));} finally {setBusy(false);}
 }
 function persistFrames(next: StoryboardFrame[]) {
  try {
   const draft = JSON.parse(localStorage.getItem('simmer-draft') || '{}');
   localStorage.setItem('simmer-draft', JSON.stringify({...draft, frames: next, generation: generationRef.current}));
  } catch {throw new Error('Could not save storyboard progress. No further images will be submitted.');}
 }
 function reserveRequest(id: string, usd: number, kind: string) {
  try {
   const next = reserveSpend(generationRef.current, {id, usd, kind});
   const draft = JSON.parse(localStorage.getItem('simmer-draft') || '{}');
   localStorage.setItem('simmer-draft', JSON.stringify({...draft, generation: next}));
   generationRef.current = next; setGeneration(next);
  } catch (e) {throw new VideoRequestError(message(e), 400);}
 }
 function applyPlan(next: Recipe) {
  if (jobsRef.current.some(Boolean)) {setError('Save and start a new video version before changing the plan.'); return;}
  if (next.production !== recipe.production && next.steps !== recipe.steps) {
   if (!save()) return;
   setProjectId(crypto.randomUUID());
   setToast('Shot plan applied. Your previous storyboard and images are saved in Projects.');
  }
  setRecipe(next); setFrames([]); setStoryboardApproval(''); setDuration(3); setSelected(0);
 }
 function changeSetting(fn: () => void) {if (jobs.some(Boolean)) {setError('Start a new project to change video settings after rendering has begun. This keeps completed scenes consistent.'); return;} fn();}
 function changeGeneration(value: GenerationSettings) {generationRef.current = value; setGeneration(value);}

 // Video provider requests
 function api(body: VideoRequest, blob: true): Promise<Blob>;
 function api(body: VideoRequest): Promise<Job>;
 async function api(body: VideoRequest, blob = false): Promise<Blob | Job> {
  const existing = body.id ? jobsRef.current.find(j => j?.id === body.id) : undefined;
  const model = body.model || (body.action === 'create' ? generationRef.current.videoModel : existing?.model || 'runway');
  const res = await fetch('/api/video', {method: 'POST', headers: {'Content-Type': 'application/json', 'x-runway-key': apiKey, 'x-fal-key': falKey}, body: JSON.stringify({...body, model}), signal: AbortSignal.timeout(70000)});
  if (!res.ok) {
   const data = await res.json().catch(() => ({error: `Video service returned ${res.status}.`})) as ApiError;
   throw new VideoRequestError(failureMessage(data.error as string), res.status, Number(res.headers.get('retry-after') || 0) * 1000);
  }
  if (blob) return res.blob();
  const data: Job = await res.json();
  return {...data, model};
 }
 function updateJob(i: number, j: Job) {
  const next = [...jobsRef.current];
  next[i] = j;
  jobsRef.current = next;
  setJobs(next);
  try {localStorage.setItem('simmer-draft', JSON.stringify({sampleChosen, id: projectId, recipe, format, style, duration, captions, useImages, music, musicVolume: volume, generation: generationRef.current, frames, storyboardApproval, jobs: next, updated: new Date().toISOString()}));}
  catch {throw new Error('Could not save generation progress on this device. Keep this tab open; no further scenes will be submitted.');}
 }
 function canReadJob(job?: Job) {return job?.provider === 'local' || (usesFal(job?.model) ? !!falKey : !!apiKey);}
 function missingVideoKey() {return videoModels[generationRef.current.videoModel].provider === 'runway' ? !apiKey : !falKey;}
 async function videoBlob(job: Job) {
  let cached: Blob | undefined;
  try {cached = await loadVideo(job.id);} catch {}
  if (cached) return cached;
  if (job.provider === 'local') throw new Error('This device no longer has the uploaded clip. Select the footage again.');
  if (usesFal(job.model) ? !falKey : !apiKey) throw new Error('Connect the original provider key to retrieve this clip. Retrieval does not regenerate it.');
  const blob: Blob = await api({action: 'media', id: job.id, model: job.model || 'runway'}, true);
  try {await saveVideo(job.id, blob);} catch {setVideoNotice('This browser could not cache the clip. Download the completed MP4 to keep a copy.');}
  return blob;
 }
 async function cacheCompleted(_i: number, job: Job) {
  try {await videoBlob(job);} catch (e) {setVideoNotice(`Clip completed, but its download needs attention: ${message(e)} Generation progress is saved.`);}
 }
 async function generate() {
  if (activity.current) return;
  if (missingVideoKey()) {setModal('settings'); return;}
  activity.current = true;
  setError(''); setVideoNotice(''); setModal(''); setRendering(true); cancel.current = false; setPlaying(false); setPlayingClips(false);
  try {
   const targets = videoTargets || recipe.steps.map((_, i) => i);
   const plan = generationPlan(targets.map(i => jobsRef.current[i]), targets.length);
   if (plan.newCount && (!board.ready || storyboardApproval !== board.signature)) throw new Error('Approve the storyboard before starting new paid scenes. You can still check existing tasks and preview completed clips.');
   const images = new Map<number, string>(), motions = new Map<number, string>(), endings = new Map<number, string | undefined>();
   for (const position of [...plan.fresh, ...plan.retry]) {
    const i = targets[position];
    images.set(i, await board.input(i));
    motions.set(i, motionPrompt(recipe, i, frames[i]?.motion));
    endings.set(i, await board.endInput(i));
    if (endings.get(i) && !videoModels[generationRef.current.videoModel].endFrame) throw new Error(modelCopy('Remove the ending frame or select a video model that supports it.', 'The current generation settings use only a starting frame. Remove the ending frame before continuing.'));
   }
   await runVideoJobs({
    count: targets.length,
    getJob: i => jobsRef.current[targets[i]],
    write: (i, job) => updateJob(targets[i], {...job, ...(!job.model && ['SUBMITTING', 'SUBMISSION_UNKNOWN', 'NOT_SUBMITTED'].includes(job.status) ? {model: generationRef.current.videoModel, duration: shotSeconds(recipe, targets[i], duration, generationRef.current.videoModel)} : {})}),
    create: async (position, requestId) => {
     const index = targets[position], model = generationRef.current.videoModel, seconds = shotSeconds(recipe, index, duration, model);
     reserveRequest(requestId, videoModels[model].perSecond * seconds + videoModels[model].perShot, 'video');
     return api({action: 'create', recipe, index, format, style, duration: seconds, useImages, storyboardRequired: true, storyboardImage: images.get(index), endFrame: endings.get(index), motionPrompt: motions.get(index), requestId, model});
    },
    poll: id => api({action: 'status', id}),
    paused: () => cancel.current,
    onSelect: i => setSelected(targets[i]),
    notice: setVideoNotice,
    onComplete: (i, job) => cacheCompleted(targets[i], job),
   });
   if (!cancel.current && generationPlan(jobsRef.current, recipe.steps.length).completed.length === recipe.steps.length) {setToast('All video clips are ready. Preview the videos or export your film.'); previewClip(0);}
  } catch (e) {setError(message(e));} finally {activity.current = false; setRendering(false);}
 }
 async function checkProgress() {
  if (activity.current) return;
  if (jobsRef.current.some(j => j?.id && !settled.includes(j.status) && (usesFal(j.model) ? !falKey : !apiKey))) {setModal('settings'); return;}
  activity.current = true;
  setChecking(true); setModal(''); setError(''); setVideoNotice('Checking saved provider tasks. No new generation will be created.');
  try {
   for (let i = 0; i < recipe.steps.length; i++) {
    const job = jobsRef.current[i];
    if (!job?.id || settled.includes(job.status)) continue;
    try {
     const state = await pollWithRetry(job.id, {poll: id => api({action: 'status', id}), notice: setVideoNotice});
     if (state) {
      const updated = {...job, ...state, id: job.id};
      updateJob(i, updated);
      if (updated.status === 'SUCCEEDED') await cacheCompleted(i, updated);
     }
    } catch (e) {
     if (e instanceof VideoRequestError && e.status === 404) updateJob(i, {...job, status: 'MISSING', failure: 'The provider no longer has this task. Check your account before confirming a retry.'});
     else throw e;
    }
   }
   const plan = generationPlan(jobsRef.current, recipe.steps.length);
   setVideoNotice(`Status checked: ${plan.completed.length} completed, ${plan.tracking.length} still processing, ${plan.fresh.length} not started, ${plan.retry.length} need a retry. No new generation was requested.`);
   if (plan.completed.length) previewClip(plan.completed[0]);
  } catch (e) {setError(message(e));} finally {activity.current = false; setChecking(false);}
 }
 async function recoverTask() {
  if (activity.current) return;
  if (missingVideoKey()) {setModal('settings'); return;}
  if (jobsRef.current[recoveryScene]?.id) {setError('This scene already has a task ID. Use Check progress to inspect it.'); return;}
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(recoveryTask)) {setError('Enter the task ID shown in your provider task history.'); return;}
  setChecking(true); activity.current = true; setError('');
  try {
   const task = await api({action: 'status', id: recoveryTask, model: generationRef.current.videoModel});
   updateJob(recoveryScene, {...jobsRef.current[recoveryScene], ...task, id: recoveryTask});
   setRecoveryTask('');
   setToast('Task linked. Checking its status does not start a new generation.');
  } catch (e) {setError(message(e));} finally {setChecking(false); activity.current = false;}
 }
 function markNotSubmitted() {
  const old = jobsRef.current[recoveryScene];
  if (old && !old.id) {updateJob(recoveryScene, {...old, status: 'NOT_SUBMITTED', failure: 'User confirmed no matching task in Runway history.'});}
  setModal('');
 }
 function requestVideo(indices: number[] | null) {
  setVideoTargets(indices);
  if (missingVideoKey()) {setModal('settings'); return;}
  setModal('generate');
 }

 // Preview, review and export
 function previewClip(i: number) {setSelected(i); setPlaying(false); setPlayingClips(false); setPreviewError(''); setPreviewMode(jobsRef.current[i]?.status === 'SUCCEEDED' ? 'video' : 'storyboard'); setPreviewNonce(n => n + 1);}
 function playReadyClips() {
  const first = jobsRef.current.findIndex(j => j?.status === 'SUCCEEDED');
  if (first < 0) return;
  setSelected(first); setPreviewMode('video'); setPlaying(false); setPlayingClips(true); setPreviewNonce(n => n + 1);
 }
 function nextReadyClip() {
  if (!playingClips) return;
  const next = jobsRef.current.findIndex((j, i) => i > selected && j?.status === 'SUCCEEDED');
  if (next < 0) setPlayingClips(false); else setSelected(next);
 }
 function reviewClip(accept: boolean) {
  const job = jobsRef.current[selected];
  if (!job) return;
  updateJob(selected, {...job, status: accept ? 'SUCCEEDED' : 'REJECTED', review: accept ? 'accepted' : 'rejected'});
  setVideoNotice(accept ? 'Shot accepted.' : 'Shot rejected. Other clips are kept. Select a model and generate only this shot.');
 }
 function restorePreviousClip() {
  const job = jobsRef.current[selected], history = job?.replacedClips?.filter(clip => settled.includes(clip.status)) || [], old = history.at(-1);
  if (old) {
   updateJob(selected, {...old, status: 'SUCCEEDED', replacedClips: [...history.slice(0, -1), ...(settled.includes(job.status) ? [{...job, replacedClips: undefined}] : [])]});
   previewClip(selected);
  }
 }
 async function attachFootage(file: File) {
  const activeJob = jobsRef.current[selected];
  if (activeJob?.id && !['SUCCEEDED', 'REJECTED', 'FAILED', 'CANCELLED', 'DELETED', 'MISSING'].includes(activeJob.status)) {setError('Wait for the current task to finish before replacing its clip.'); return;}
  if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type) || !file.size || file.size > 100_000_000) {setError('Choose an MP4, WebM or QuickTime clip smaller than 100 MB.'); return;}
  setBusy(true);
  try {
   const id = 'local-' + crypto.randomUUID();
   await saveVideo(id, file);
   const previous = jobsRef.current[selected];
   updateJob(selected, {id, status: 'SUCCEEDED', provider: 'local', review: 'accepted', ...(previous ? {replacedClips: [...(previous.replacedClips || []), {...previous, replacedClips: undefined}]} : {})});
   previewClip(selected);
   setToast('Your footage is ready for this shot.');
  } catch (e) {setError(message(e));} finally {setBusy(false);}
 }
 async function exportFilm() {
  setProgress(0); setError('');
  let soundtrack: MusicSession | undefined;
  try {
   // Resume audio within the export click, before asynchronous clip downloads.
   if (music !== 'none') soundtrack = await createMusicSession(music, volume);
   const blobs = [];
   for (const job of jobs) blobs.push(await videoBlob(job));
   const output = await exportVideo(blobs, recipe, format, captions, setProgress, soundtrack ? {session: soundtrack, duration: totalSeconds} : undefined);
   download(output, `${fileStem(recipe.name)}.${output.type.includes('mp4') ? 'mp4' : 'webm'}`);
   setToast('Your video is ready to download.');
  } catch (e) {setError(message(e));} finally {try {await soundtrack?.close();} finally {setProgress(-1);}}
 }
 async function downloadScene() {
  const job = jobs[selected];
  if (job?.status !== 'SUCCEEDED') return;
  setBusy(true); setError('');
  try {
   const blob = await videoBlob(job);
   download(blob, `${fileStem(recipe.name)}-scene-${selected + 1}.mp4`);
   setToast(`Scene ${selected + 1} downloaded as MP4.`);
  } catch (e) {setError(message(e));} finally {setBusy(false);}
 }

 const hasRecipe = recipe.steps.length > 0, scene = recipe.steps[selected] || recipe.steps[0] || {title: '', text: ''}, photo = board.sources[selected], complete = jobs.filter(j => j?.status === 'SUCCEEDED').length, allReady = hasRecipe && complete === recipe.steps.length, locked = rendering || checking || progress >= 0 || board.generating || planning, approved = board.ready && storyboardApproval === board.signature;
 workLocked.current = locked;
 const resumePlan = generationPlan(videoTargets ? videoTargets.map(i => jobs[i]) : jobs, videoTargets?.length || recipe.steps.length), hasVideoJobs = jobs.some(Boolean), newSceneIndices = [...resumePlan.fresh, ...resumePlan.retry].map(i => videoTargets ? videoTargets[i] : i), newSeconds = timelineSeconds(recipe, duration, generation.videoModel), newCredits = videoEstimate(newSeconds, newSceneIndices, videoModels[generation.videoModel].perSecond, videoModels[generation.videoModel].perShot), newVideoSeconds = newSceneIndices.reduce((sum, i) => sum + newSeconds[i], 0);
 const spendRemaining = generation.limit - reservedUSD(generation);
 const workflowPhase = hasRecipe ? (approved || jobs.some(Boolean) ? 3 : shotsChosen ? 2 : 1) : 0;
 const activeStage = guidedStage(workflowPhase, stageOverride);
 useEffect(() => {setStageOverride(null);}, [projectId, workflowPhase]);
 useEffect(() => {
  if (view !== 'studio') return;
  stagePanel.current?.focus({preventScroll: true});
  window.scrollTo({top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
 }, [activeStage, view, shotsChosen]);
 const workflowState = {progress, rendering, checking, planning, generatingImages: board.generating, allReady, approved, hasRecipe, shotsChosen, storyboardReady: board.ready, busy, tab, complete, sceneCount: recipe.steps.length, framesReady: board.sources.filter(Boolean).length};
 const keys: ProviderKeys = {apiKey, anthropicKey, geminiKey, falKey};
 const keySetters = {apiKey: setApiKey, anthropicKey: setAnthropicKey, geminiKey: setGeminiKey, falKey: setFalKey};
 const editSelected = (next: Scene) => {setStoryboardApproval(''); setRecipe({...recipe, steps: recipe.steps.map((s, i) => i === selected ? next : s)});};

 return <div className="app-shell">
  <Sidebar open={sidebarOpen} view={view} locked={locked} projectCount={projects.length} connected={!!apiKey} onClose={() => setSidebarOpen(false)} onView={setView} onNew={openNew} onGuide={() => setModal('guide')} onSettings={() => setModal('settings')}/>
  <div className="workspace">
   <Topbar view={view} locked={locked} sidebarOpen={sidebarOpen} status={hasRecipe ? (sampleChosen ? 'Example project · saved on this device' : 'Saved on this device') : 'Ready for your recipe'} onOpenSidebar={() => setSidebarOpen(true)} onToggleView={() => setView(view === 'studio' ? 'projects' : 'studio')} onSettings={() => setModal('settings')}/>
   <main>
    {view === 'process'
     ? <ProcessTour onStart={() => setView('studio')} onExample={() => setView('examples')}/>
     : view === 'examples'
      ? <ExamplesView disabled={locked || busy} hasRecipe={hasRecipe} onBack={() => setView('studio')} onStart={startExample}/>
      : view === 'projects'
       ? <ProjectsView projects={projects} onNew={openNew} onBack={() => setView('studio')} onOpen={load}/>
       : <>
        <StudioHeading activeStage={activeStage} recipeName={recipe.name} canSave={!locked && hasRecipe} onSave={save}/>
        <WorkflowTracker activeStage={activeStage} phase={workflowPhase} locked={locked} working={rendering || board.generating || busy || progress >= 0} allReady={allReady} title={workflowTitle(workflowState)} description={workflowDescription(workflowState)} scene={(rendering || board.generating) && hasRecipe ? scene : undefined} sceneNumber={selected + 1} onStage={setStageOverride}/>
        <GuidedNavigation activeStage={activeStage} locked={locked} recipeName={hasRecipe ? recipe.name : undefined} onBack={() => setStageOverride(activeStage - 1)}/>
        <div ref={stagePanel} tabIndex={-1} role="region" aria-label={stageLabels[activeStage]} key={activeStage} className={`studio-grid guided-stage ${!hasRecipe ? 'awaiting-recipe' : ''}`}>
         {activeStage < 3 && <section className="left-column">
          {activeStage === 0 && (sampleChosen
           ? <ExampleSession disabled={locked || busy} onStop={stopExample}/>
           : <RecipeEntry tab={tab} url={url} json={json} form={form} busy={busy} locked={locked} importBlocked={importBlocked} onTab={setTab} onUrl={setUrl} onJson={setJson} onForm={setForm} onImport={importRecipe} onApply={apply} onExamples={() => setView('examples')}/>)}
          {hasRecipe ? <>
           {activeStage === 0 && <RecipeSummary recipe={recipe} isExample={sampleChosen} onIngredients={() => setModal('ingredients')}/>}
           {activeStage === 0 && <button className="primary guided-continue" disabled={locked} onClick={() => setStageOverride(1)}>Continue with this recipe<ArrowRight size={16}/></button>}
           {activeStage === 1 && <ShotWorkbench beforeDiagnostic={() => reserveRequest(crypto.randomUUID(), DIAGNOSTIC_RESERVATION_USD, 'planning diagnostics')} beforePlan={planner => reserveRequest(crypto.randomUUID(), plannerReservation(planner), 'planning')} onBusy={setPlanning} key={projectId} recipe={recipe} usingImportedSteps={shotsChosen && !recipe.production} disabled={locked || busy || jobs.some(Boolean)} geminiKey={geminiKey} anthropicKey={anthropicKey} onSettings={() => setModal('settings')} onApply={applyPlan} onApproach={original => {setStoryboardApproval(''); setRecipe({...recipe, storyboardApproach: original ? 'original' : 'choose'});}} onError={setError}/>}
           {activeStage === 1 && shotsChosen && <button className="primary guided-continue" disabled={locked} onClick={() => setStageOverride(2)}>Continue to storyboard images<ArrowRight size={16}/></button>}
           {activeStage === 2 && <StoryboardStage recipe={recipe} frames={frames} jobs={jobs} board={board} format={format} style={style} useImages={useImages} selected={selected} sceneSeconds={sceneSeconds} totalSeconds={totalSeconds} locked={locked} busy={busy} approved={approved} shotsChosen={shotsChosen}
            canEditMissing={![...board.missing, ...board.pending].some(i => !editableShot(i))}
            onFormat={value => changeSetting(() => setFormat(value))}
            onStyle={value => changeSetting(() => setStyle(value))}
            onUseImages={value => changeSetting(() => setUseImages(value))}
            onGenerateMissing={() => requestImages([...new Set([...board.missing, ...board.pending])])}
            onApprove={() => {setStoryboardApproval(board.signature); setToast('Storyboard approved. Video generation will use these frames.'); setStageOverride(3);}}
            onContinue={() => setStageOverride(3)}
            onNewVersion={newVideoVersion}
            onPreview={previewClip}>
            <SceneDetails key={selected} recipe={recipe} scene={scene} selected={selected} frame={frames[selected]} board={board} format={format} style={style} endFrameSupported={!!videoModels[generation.videoModel].endFrame} locked={locked} busy={busy} editing={editing} editable={editableShot(selected)} shotsChosen={shotsChosen} hasVideoJobs={jobs.some(Boolean)}
             onToggleEditing={() => setEditing(!editing)} onRecipe={setRecipe} onSceneChange={editSelected} onUpdateFrame={updateFrame} onSplit={splitSelected} onRequestImages={requestImages} onDownloadFrame={downloadFrame}/>
           </StoryboardStage>}
          </> : null}
         </section>}
         {hasRecipe && activeStage === 3 ? <aside className="output-panel panel">
          <VideoPreview recipe={recipe} scene={scene} selected={selected} jobs={jobs} format={format} mode={previewMode} mediaURL={mediaURL} loading={previewLoading} error={previewError} canRead={canReadJob(jobs[selected])} playing={playing} photo={photo} sceneSeconds={sceneSeconds} totalSeconds={totalSeconds} complete={complete} allReady={allReady} locked={locked} playerRef={player}
           onSelect={setSelected}
           onShowVideo={() => {setPreviewMode('video'); setPlaying(false);}}
           onShowStoryboard={() => {setPreviewMode('storyboard'); setPlayingClips(false);}}
           onClipEnded={nextReadyClip}
           onVideoError={() => {setPlayingClips(false); setPreviewError('This video could not be played in this browser. Download the completed MP4 or retry loading it.');}}
           onLoadClip={() => canReadJob(jobs[selected]) ? setPreviewNonce(n => n + 1) : setModal('settings')}
           onPhotoError={value => board.markBroken(selected, value)}
           onTogglePlay={() => setPlaying(!playing)}
           onPlayReady={playReadyClips}/>
          <VideoSettings planned={!!recipe.production} duration={duration} captions={captions} generation={generation} music={music} volume={volume} locked={locked} onDuration={value => changeSetting(() => setDuration(value))} onToggleCaptions={() => setCaptions(!captions)} onGeneration={changeGeneration} onMusic={setMusic} onVolume={setVolume}/>
          <GenerateSection recipe={recipe} jobs={jobs} selected={selected} locked={locked} busy={busy} approved={approved} hasVideoJobs={hasVideoJobs} checking={checking} rendering={rendering} allReady={allReady} progress={progress} complete={complete} music={music} videoNotice={videoNotice} error={error} videoModelName={videoModelLabel(generation.videoModel)} totalSeconds={totalSeconds} recoveryScene={recoveryScene} recoveryTask={recoveryTask} uncertain={resumePlan.uncertain}
           onGenerateOne={() => requestVideo([selected])}
           onReview={reviewClip}
           onUpload={file => void attachFootage(file)}
           onRestorePrevious={restorePreviousClip}
           onCheckProgress={checkProgress}
           onPauseMonitoring={() => {cancel.current = true; setVideoNotice('Monitoring paused. The provider may keep processing the current task. Resume checks its saved ID before creating any remaining scenes.');}}
           onExport={exportFilm}
           onGenerate={() => {if (!approved && !hasVideoJobs) {setError('Generate any missing frames and approve the storyboard first.'); return;} requestVideo(null);}}
           onDownloadScene={downloadScene}
           onRecoveryScene={setRecoveryScene}
           onRecoveryTask={setRecoveryTask}
           onRecover={recoverTask}
           onUnknown={() => setModal('unknown')}/>
         </aside> : null}
        </div>
       </>}
    {error && <div className="error-box" role="alert"><span>{publicGenerationText(error)}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={17}/></button></div>}
    <footer><span><Leaf size={13}/>Made for the love of food.</span><span>From recipe to reel, with a little simmer.</span></footer>
   </main>
  </div>
  {toast && <div className="toast" role="status"><CheckCircle2 size={18}/>{toast}</div>}
  {modal && <ModalFrame onClose={() => setModal('')}>
   {modal === 'images'
    ? <ImagesModal phase={imagePhase} force={forceImages} count={imageTargets.length} generation={generation} format={format} spendRemaining={spendRemaining} onConfirm={() => {setModal(''); setStoryboardApproval(''); if (imagePhase === 'end') void board.generateEnd(imageTargets[0]); else void board.generate(imageTargets, forceImages);}}/>
    : modal === 'settings'
     ? <SettingsModal keys={keys} generation={generation} locked={locked} onKey={(name, value) => keySetters[name](value)} onGeneration={changeGeneration} onConfirm={() => {setModal(''); setToast('Keys updated for this tab. They are checked on their first request.');}}/>
     : modal === 'generate'
      ? <GenerateModal recipeName={recipe.name} plan={resumePlan} targets={videoTargets} hasVideoJobs={hasVideoJobs} approved={approved} locked={locked} newVideoSeconds={newVideoSeconds} newCredits={newCredits} spendRemaining={spendRemaining} videoModel={generation.videoModel} onCheckProgress={checkProgress} onGenerate={generate}/>
      : modal === 'unknown'
       ? <UnknownTaskModal scene={recoveryScene + 1} onBack={() => setModal('')} onConfirm={markNotSubmitted}/>
       : modal === 'ingredients'
        ? <IngredientsModal recipe={recipe} onExport={() => download(new Blob([JSON.stringify(recipeSchema(recipe), null, 2)], {type: 'application/ld+json'}), 'recipe.json')}/>
        : modal === 'new'
         ? <NewProjectModal onSaveAndStart={() => {if (!save()) return; startFresh();}} onStart={() => {startFresh();}}/>
         : <GuideModal/>}
  </ModalFrame>}
 </div>;
}
