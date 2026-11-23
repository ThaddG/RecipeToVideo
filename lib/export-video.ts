import type { Recipe } from './recipe';
import type { MusicSession } from './music';

function waitForVideo(video: HTMLVideoElement, event: 'loadeddata' | 'ended', timeout: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Export stalled. Keep this tab visible and try again, or download each scene separately.'));
    }, timeout);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, done);
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('A video scene could not be decoded. Download the individual scene or try another browser.')); };
    const aborted = () => { cleanup(); reject(signal.reason); };
    video.addEventListener(event, done, { once: true });
    video.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
    else if (event === 'loadeddata' && video.readyState >= 2) done();
  });
}

/** Record all scenes in order. Recording pauses while the next scene loads. */
export async function exportVideo(
  blobs: Blob[], recipe: Recipe, format: string, captions: boolean,
  onProgress: (n: number) => void,
  music?: {session: MusicSession; duration: number},
): Promise<Blob> {
  if (!blobs.length || blobs.length !== recipe.steps.length || blobs.some(b => !b.size)) {
    throw new Error('Every recipe step needs a completed, non-empty video before export.');
  }
  if (!['9:16', '16:9'].includes(format)) throw new Error('Choose portrait or landscape before exporting.');
  if (typeof MediaRecorder === 'undefined') throw new Error('Video export requires a browser with MediaRecorder support, such as Chrome.');
  if (music && (!Number.isFinite(music.duration) || music.duration <= 0)) throw new Error('Music needs a valid video duration.');
  const mime = (music ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm'] : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4', 'video/webm'])
    .find(x => MediaRecorder.isTypeSupported(x));
  if (!mime) throw new Error('Your browser does not support full video export. Download individual MP4 scenes or try Chrome.');
  const canvas = document.createElement('canvas');
  canvas.width = format === '9:16' ? 720 : 1280;
  canvas.height = format === '9:16' ? 1280 : 720;
  const ctx = canvas.getContext('2d');
  if (!ctx || !canvas.captureStream) throw new Error('Canvas recording is unavailable. Download individual MP4 scenes or try Chrome.');
  const stream = canvas.captureStream(30);
  const controller = new AbortController();
  let recorder: MediaRecorder | undefined;
  let video: HTMLVideoElement | undefined;
  let frame = 0;
  let elapsed = 0;
  const urls: string[] = [];
  const parts: Blob[] = [];
  try {
    if (music) {
      const tracks = music.session.stream.getAudioTracks();
      if (!tracks.length) throw new Error('The music track is unavailable. Select a track and try export again.');
      tracks.forEach(track => stream.addTrack(track));
    }
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const recording = recorder;
    recorder.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
    recorder.onerror = () => controller.abort(new Error('The browser could not finish recording. Download individual MP4 scenes or try Chrome.'));
    ctx.fillStyle = '#192e26';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onProgress(0);
    for (let i = 0; i < blobs.length; i++) {
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      const uri = URL.createObjectURL(blobs[i]);
      urls.push(uri);
      const v = video;
      // Subscribe before setting src so cached media cannot outrun the load listener.
      const loaded = waitForVideo(v, 'loadeddata', 30000, controller.signal);
      v.src = uri;
      await loaded;
      if (!Number.isFinite(v.duration) || v.duration <= 0 || !v.videoWidth || !v.videoHeight) {
        throw new Error('A scene has invalid video metadata. Download that scene separately or generate it again.');
      }
      const draw = () => {
        try {
          const scale = Math.max(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
          ctx.drawImage(v, (canvas.width - v.videoWidth * scale) / 2, (canvas.height - v.videoHeight * scale) / 2, v.videoWidth * scale, v.videoHeight * scale);
          if (captions) {
            const y = canvas.height - 165;
            ctx.fillStyle = 'rgba(14,27,22,.82)';
            ctx.fillRect(0, y - 20, canvas.width, 185);
            ctx.fillStyle = '#c4d5a5';
            ctx.font = '18px sans-serif';
            ctx.fillText(`SIMMER  /  STEP ${i + 1}`, 40, y + 12);
            ctx.fillStyle = 'white';
            ctx.font = '26px sans-serif';
            const lines: string[] = [];
            let line = '';
            for (const word of recipe.steps[i].text.split(/\s+/)) {
              if (ctx.measureText(line + ' ' + word).width > canvas.width - 80 && line) {
                lines.push(line); line = word;
              } else line += (line ? ' ' : '') + word;
            }
            if (line) lines.push(line);
            const pages = Math.max(1, Math.ceil(lines.length / 3));
            const page = Math.min(pages - 1, Math.floor(v.currentTime / v.duration * pages));
            lines.slice(page * 3, page * 3 + 3).forEach((l, j) => ctx.fillText(l, 40, y + 52 + j * 32));
          }
          onProgress(Math.min(1, (i + v.currentTime / v.duration) / blobs.length));
          frame = requestAnimationFrame(draw);
        } catch (error) { controller.abort(error); }
      };
      const ended = waitForVideo(v, 'ended', Math.max(30000, (v.duration + 15) * 1000), controller.signal);
      // Attach a rejection handler before play(), which can itself reject.
      void ended.catch(() => {});
      await v.play();
      if (controller.signal.aborted) throw controller.signal.reason;
      draw();
      if (recording.state === 'inactive') recording.start(1000);
      else if (recording.state === 'paused') recording.resume();
      music?.session.play(elapsed, v.duration, music.duration);
      await ended;
      cancelAnimationFrame(frame);
      recording.pause();
      music?.session.pause();
      elapsed += v.duration;
      v.pause();
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(uri);
      urls.pop();
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('The browser could not finalize the video. Try individual MP4 downloads.')), 15000);
      const aborted = () => finish(controller.signal.reason);
      const finish = (error?: unknown) => {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', aborted);
        if (error) reject(error);
        else resolve();
      };
      recording.onstop = () => finish();
      controller.signal.addEventListener('abort', aborted, { once: true });
      if (controller.signal.aborted) aborted();
      else recording.stop();
    });
    const result = new Blob(parts, { type: mime });
    if (!result.size) throw new Error('The browser returned an empty recording. Download individual MP4 scenes or try another browser.');
    onProgress(1);
    return result;
  } finally {
    controller.abort(new Error('Export ended.'));
    music?.session.pause();
    cancelAnimationFrame(frame);
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach(t => t.stop());
    urls.forEach(u => URL.revokeObjectURL(u));
  }
}
