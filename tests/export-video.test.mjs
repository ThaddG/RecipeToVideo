import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportVideo } from '../lib/export-video.ts';

const recipe = { steps: [{ text: 'Mix the ingredients.' }, { text: 'Serve in warm bowls.' }] };
const clips = () => [new Blob(['first clip']), new Blob(['second clip'])];

function browser(options = {}) {
  const events = [], urls = [], revoked = [], videos = [];
  const originals = new Map();
  function replace(object, key, value) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    originals.set([object, key], descriptor);
    Object.defineProperty(object, key, { value, configurable: true, writable: true });
  }
  const context = {
    fillRect() {}, fillText() {}, measureText(text) { return { width: text.length * 10 }; },
    drawImage() { if (options.drawError) throw new Error('Canvas draw failed'); },
  };
  const stream = { getTracks: () => [{ stop: () => events.push('track stopped') }], addTrack:track=>events.push(`attached ${track.kind}`) };
  class Video extends EventTarget {
    duration = 0.01; videoWidth = 1280; videoHeight = 720; readyState = 0; currentTime = 0;
    set src(value) {
      this.uri = value;
      queueMicrotask(() => {
        if (options.decodeError) this.dispatchEvent(new Event('error'));
        else { this.readyState = 2; this.dispatchEvent(new Event('loadeddata')); }
      });
    }
    async play() {
      if (options.playError) throw new Error('Playback not allowed');
      this.timer = setTimeout(() => { this.currentTime = this.duration; this.dispatchEvent(new Event('ended')); }, 10);
    }
    pause() { clearTimeout(this.timer); }
    removeAttribute() { this.uri = ''; }
    load() {}
  }
  class Recorder {
    static isTypeSupported() { return true; }
    state = 'inactive';
    constructor() { if (options.constructorError) throw new Error('Recorder setup failed'); }
    start() {
      events.push('start'); this.state = 'recording';
      if (options.recorderError) queueMicrotask(() => { this.state = 'inactive'; this.onerror?.({}); });
    }
    pause() { events.push('pause'); this.state = 'paused'; }
    resume() { events.push('resume'); this.state = 'recording'; }
    stop() {
      events.push('stop'); this.state = 'inactive';
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(options.emptyOutput ? [] : ['recorded video']) });
        this.onstop?.();
      });
    }
  }
  replace(globalThis, 'document', { createElement(tag) {
    if (tag === 'canvas') return { getContext: () => context, captureStream: () => stream };
    const v = new Video(); videos.push(v); return v;
  } });
  replace(globalThis, 'MediaRecorder', Recorder);
  replace(globalThis, 'requestAnimationFrame', callback => setTimeout(callback, 1));
  replace(globalThis, 'cancelAnimationFrame', timer => clearTimeout(timer));
  replace(URL, 'createObjectURL', () => { const url = `blob:test-${urls.length}`; urls.push(url); return url; });
  replace(URL, 'revokeObjectURL', url => revoked.push(url));
  return { events, urls, revoked, videos, restore() {
    for (const [[object, key], descriptor] of originals) {
      if (descriptor) Object.defineProperty(object, key, descriptor); else delete object[key];
    }
  } };
}

test('rejects incomplete clips before attempting a recording', async () => {
  await assert.rejects(() => exportVideo([], recipe, '9:16', true, () => {}), /Every recipe step/);
  await assert.rejects(() => exportVideo([new Blob(), new Blob(['clip'])], recipe, '9:16', true, () => {}), /non-empty/);
});
test('records scenes in order, pauses between scenes, and releases media resources', async () => {
  const h = browser(), progress = [];
  try {
    const result = await exportVideo(clips(), recipe, '9:16', true, n => progress.push(n));
    assert.ok(result.size > 0);
    assert.deepEqual(h.events, ['start', 'pause', 'resume', 'pause', 'stop', 'track stopped']);
    assert.equal(progress.at(-1), 1);
    assert.deepEqual(h.revoked, h.urls);
    assert.ok(h.videos.every(v => !v.uri));
  } finally { h.restore(); }
});
for (const [option, pattern] of [
  ['recorderError', /could not finish recording/],
  ['decodeError', /could not be decoded/],
  ['playError', /Playback not allowed/],
  ['drawError', /Canvas draw failed/],
  ['constructorError', /Recorder setup failed/],
  ['emptyOutput', /empty recording/],
]) {
  test(`reports ${option} and stops capture without hanging`, { timeout: 2000 }, async () => {
    const h = browser({ [option]: true });
    try {
      await assert.rejects(() => exportVideo(clips(), recipe, '16:9', false, () => {}), pattern);
      assert.ok(h.events.includes('track stopped'));
      assert.deepEqual(h.revoked, h.urls);
    } finally { h.restore(); }
  });
}

test('music is attached to the recording and follows the scene timeline', async () => {
 const h=browser(),plays=[];let pauses=0;
 const session={stream:{getAudioTracks:()=>[{kind:'audio'}]},play:(...args)=>plays.push(args),pause:()=>pauses++};
 try{const result=await exportVideo(clips(),recipe,'9:16',true,()=>{},{session,duration:.02});assert.match(result.type,/opus/);assert.equal(h.events[0],'attached audio');assert.deepEqual(plays,[[0,.01,.02],[.01,.01,.02]]);assert.ok(pauses>=3);}finally{h.restore();}
});
test('music pauses and capture stops if rendering fails',async()=>{
 const h=browser({drawError:true});let pauses=0;
 const session={stream:{getAudioTracks:()=>[{kind:'audio'}]},play:()=>{},pause:()=>pauses++};
 try{await assert.rejects(()=>exportVideo(clips(),recipe,'9:16',true,()=>{},{session,duration:.02}),/Canvas draw failed/);assert.ok(pauses>0);assert.ok(h.events.includes('track stopped'));}finally{h.restore();}
});
test('an unavailable audio track fails instead of silently exporting without music',async()=>{
 const h=browser();const session={stream:{getAudioTracks:()=>[]},pause:()=>{}};
 try{await assert.rejects(()=>exportVideo(clips(),recipe,'9:16',true,()=>{},{session,duration:.02}),/music track is unavailable/);assert.ok(h.events.includes('track stopped'));}finally{h.restore();}
});
